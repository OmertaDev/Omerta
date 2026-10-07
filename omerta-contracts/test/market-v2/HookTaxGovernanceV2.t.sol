// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {Test} from "forge-std/Test.sol";
import {OmertaHookV2Fixture, MockOmrMarketV2} from "./OmertaHookV2.t.sol";
import {OmertaHookV2} from "../../src/market-v2/OmertaHookV2.sol";
import {PoolSwapTest} from "v4-core/test/PoolSwapTest.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";

contract HookTaxGovernanceV2Test is OmertaHookV2Fixture {
    // Preserve the observed value across vm.chainId: the optimizer may rematerialize CHAINID.
    function observedChainId() external view returns (uint256) { return block.chainid; }
    function _apply(OmertaHookV2.TaxConfig memory config) internal {
        hook.queueTaxConfig(config); vm.warp(hook.queuedTaxExecuteAfter());
        hook.executeTaxConfig(config,hook.taxConfigNonce());
    }
    function _bounded(uint16 a,uint16 b,uint16 c,uint16 d) internal pure returns (OmertaHookV2.TaxConfig memory) {
        uint16 rwa = a%801; uint16 community = b%(801-rwa);
        uint16 pol = c%(801-rwa-community); uint16 surge = d%(801-rwa-community-pol);
        return OmertaHookV2.TaxConfig(rwa,community,pol,surge);
    }
    function testSafeOnlyQueueCancelExecuteAndExact48HourBoundary() public {
        OmertaHookV2.TaxConfig memory config = OmertaHookV2.TaxConfig(50,60,70,120);
        vm.prank(address(0xBAD)); vm.expectRevert(OmertaHookV2.OnlyGovernanceSafe.selector);
        hook.queueTaxConfig(config);
        hook.queueTaxConfig(config);
        assertEq(hook.queuedTaxHash(),hook.taxConfigHash(config,1)); assertEq(hook.baseSellBps(),900);
        uint64 due = hook.queuedTaxExecuteAfter(); assertEq(due,block.timestamp+48 hours);
        vm.prank(address(0xBAD)); vm.expectRevert(OmertaHookV2.OnlyGovernanceSafe.selector); hook.cancelTaxConfig();
        vm.prank(address(0xBAD)); vm.expectRevert(OmertaHookV2.OnlyGovernanceSafe.selector); hook.executeTaxConfig(config,1);
        vm.warp(due-1); vm.expectRevert(OmertaHookV2.TaxProposalNotReady.selector); hook.executeTaxConfig(config,1);
        vm.warp(due); hook.executeTaxConfig(config,1); assertEq(hook.baseSellBps(),380);
        assertEq(hook.queuedTaxHash(),bytes32(0)); assertEq(hook.queuedTaxExecuteAfter(),0);
        assertTrue(hook.TAX_EXECUTION_SAFE_ONLY()); assertEq(hook.TAX_CONFIG_DELAY(),48 hours);
    }
    function testExactPayloadNonceCancelAndAppliedReplayRejected() public {
        OmertaHookV2.TaxConfig memory first = OmertaHookV2.TaxConfig(0,0,0,0);
        OmertaHookV2.TaxConfig memory other = OmertaHookV2.TaxConfig(1,0,0,0);
        hook.queueTaxConfig(first); vm.expectRevert(OmertaHookV2.TaxProposalPending.selector); hook.queueTaxConfig(other);
        vm.warp(hook.queuedTaxExecuteAfter());
        vm.expectRevert(OmertaHookV2.TaxProposalMismatch.selector); hook.executeTaxConfig(other,1);
        vm.expectRevert(OmertaHookV2.TaxProposalMismatch.selector); hook.executeTaxConfig(first,2);
        hook.cancelTaxConfig(); vm.expectRevert(OmertaHookV2.TaxProposalMismatch.selector); hook.executeTaxConfig(first,1);
        hook.queueTaxConfig(first); assertEq(hook.taxConfigNonce(),2); vm.warp(hook.queuedTaxExecuteAfter());
        vm.expectRevert(OmertaHookV2.TaxProposalMismatch.selector); hook.executeTaxConfig(first,1);
        hook.executeTaxConfig(first,2); vm.expectRevert(OmertaHookV2.TaxProposalMismatch.selector); hook.executeTaxConfig(first,2);
    }
    function testChainAndHookDomainsCannotReplay() public {
        OmertaHookV2.TaxConfig memory config = OmertaHookV2.TaxConfig(0,0,0,0);
        hook.queueTaxConfig(config); bytes32 queued = hook.queuedTaxHash(); vm.warp(hook.queuedTaxExecuteAfter());
        uint256 originalChain = this.observedChainId(); vm.chainId(originalChain+1);
        assertNotEq(hook.taxConfigHash(config,1),queued);
        vm.expectRevert(OmertaHookV2.TaxProposalMismatch.selector); hook.executeTaxConfig(config,1);
        vm.chainId(originalChain);
        address alternative = address(uint160((uint256(0xABCD)<<144)|FLAGS));
        deployCodeTo("OmertaHookV2.sol:OmertaHookV2",abi.encode(manager,address(omr),address(this),uint24(3000),int24(60),
            recipients,OmertaHookV2.OpeningConfig(0,0,0),uint24(100),uint32(60),address(this)),alternative);
        assertNotEq(OmertaHookV2(payable(alternative)).taxConfigHash(config,1),queued);
        hook.executeTaxConfig(config,1);
    }
    function testHardCapWideInputsAndFounderMinimum() public {
        vm.expectRevert(OmertaHookV2.InvalidConfiguration.selector);
        hook.queueTaxConfig(OmertaHookV2.TaxConfig(type(uint16).max,type(uint16).max,type(uint16).max,type(uint16).max));
        vm.expectRevert(OmertaHookV2.InvalidConfiguration.selector); hook.queueTaxConfig(OmertaHookV2.TaxConfig(801,0,0,0));
        _apply(OmertaHookV2.TaxConfig(0,0,0,0)); assertEq(hook.baseSellBps(),200); assertEq(hook.OPS_SELL_BPS(),200);
        uint256 beforeOps = hook.owed(eth,0); uint256 beforeTotal = hook.totalOwed(eth);
        BalanceDelta result = _swap(false,-2 ether);
        uint256 total = hook.totalOwed(eth)-beforeTotal; uint256 gross = uint256(uint128(result.amount0()))+total;
        assertEq(hook.owed(eth,0)-beforeOps,gross*200/10_000); assertEq(total,gross*200/10_000);
    }
    function testOnlyFutureFeesChangeAndAllOldReceiverCreditsStayProtected() public {
        _swap(false,-1 ether); uint256[5] memory prior;
        for (uint8 i; i<5; ++i) prior[i]=hook.owed(eth,i);
        address lockedOps = hook.opsRecipient(); uint64 openingEnd = hook.openingEndsAtBlock();
        _apply(OmertaHookV2.TaxConfig(50,100,200,0));
        for (uint8 i; i<5; ++i) { assertEq(hook.owed(eth,i),prior[i]); assertEq(hook.recipients(i),recipients[i]); }
        uint256 oldTotal = hook.totalOwed(eth); BalanceDelta result = _swap(false,-2 ether);
        uint256 total = hook.totalOwed(eth)-oldTotal; uint256 gross = uint256(uint128(result.amount0()))+total;
        assertEq(total,gross*550/10_000);
        assertEq(hook.owed(eth,0)-prior[0],gross*200/10_000);
        assertEq(hook.owed(eth,1)-prior[1],gross*50/10_000);
        assertEq(hook.owed(eth,2)-prior[2],gross*100/10_000);
        assertEq(hook.owed(eth,3)-prior[3],total-gross*200/10_000-gross*50/10_000-gross*100/10_000);
        assertEq(hook.opsRecipient(),lockedOps); assertEq(hook.openingEndsAtBlock(),openingEnd);
        assertEq(hook.poolFee(),3000); assertEq(hook.tickSpacing(),60);
        _assertConserved(eth);
        uint256 credit = hook.owed(eth,1); hook.sweep(eth,1); assertEq(recipients[1].balance,credit);
        assertEq(hook.owed(eth,0),prior[0]+gross*200/10_000); _assertConserved(eth);
    }
    function testExactOutputFounderValueAndBuyDoesNotAcquireSellTax() public {
        _apply(OmertaHookV2.TaxConfig(0,0,100,200));
        BalanceDelta result = _swap(false,int256(1 ether));
        uint256 total = hook.totalOwed(token); uint256 gross = uint256(-int256(result.amount1()))-total;
        assertEq(hook.owed(token,0),gross*200/10_000); assertLe(total,gross*1000/10_000);
        _assertConserved(token);
        uint256 oldOps = hook.owed(token,0); uint256 oldEthOps = hook.owed(eth,0);
        _swap(true,-1 ether); assertEq(hook.owed(token,0),oldOps); assertEq(hook.owed(eth,0),oldEthOps);
    }
    function testFuzzFutureFeeConservationAndOpsValue(uint16 a,uint16 b,uint16 c,uint16 d,uint64 amountSeed) public {
        OmertaHookV2.TaxConfig memory config = _bounded(a,b,c,d); _apply(config);
        uint256 amount = bound(amountSeed,1e9,3 ether); BalanceDelta result = _swap(false,-int256(amount));
        uint256 total = hook.totalOwed(eth); uint256 gross = uint256(uint128(result.amount0()))+total;
        assertEq(hook.owed(eth,0),gross*200/10_000); assertLe(total,gross*1000/10_000);
        assertGe(hook.baseSellBps(),200); assertLe(uint256(hook.baseSellBps())+config.surgeMaxBps,1000);
        _assertConserved(eth); _assertConserved(token);
    }
}

contract HookTaxGovernanceHandler is Test {
    OmertaHookV2 public hook;
    MockOmrMarketV2 public omr;
    PoolSwapTest private router;
    PoolKey private key;
    OmertaHookV2.TaxConfig private queued;
    uint256 public expectedOpsEth;
    uint256 public expectedOpsToken;
    uint256 public swaps;
    constructor(OmertaHookV2 h,PoolSwapTest r,MockOmrMarketV2 t) {
        hook=h; router=r; omr=t; key=h.poolKey(); t.approve(address(r),type(uint256).max);
    }
    receive() external payable {}
    function propose(uint16 a,uint16 b,uint16 c,uint16 d) external {
        if (hook.queuedTaxHash()!=bytes32(0)) return;
        uint16 rwa=a%801; uint16 community=b%(801-rwa);
        uint16 pol=c%(801-rwa-community); uint16 surge=d%(801-rwa-community-pol);
        queued=OmertaHookV2.TaxConfig(rwa,community,pol,surge);
        vm.prank(hook.governanceSafe()); hook.queueTaxConfig(queued);
    }
    function progress(uint32 timeForward,bool cancel) external {
        vm.warp(block.timestamp+bound(timeForward,0,3 days));
        if (hook.queuedTaxHash()==bytes32(0)) return;
        if (cancel) {vm.prank(hook.governanceSafe()); hook.cancelTaxConfig();}
        else if (block.timestamp>=hook.queuedTaxExecuteAfter()) {
            vm.prank(hook.governanceSafe()); hook.executeTaxConfig(queued,hook.taxConfigNonce());
        }
    }
    function trade(uint64 seed,bool buy,bool exactOutput) external {
        vm.deal(address(this),1000 ether); omr.mint(address(this),1000 ether);
        uint256 amount=bound(seed,1e9,0.1 ether);
        Currency currency=exactOutput?key.currency1:key.currency0;
        uint256 oldTotal=hook.totalOwed(currency);
        BalanceDelta result=router.swap{value:buy?100 ether:0}(key,SwapParams(buy,exactOutput?int256(amount):-int256(amount),
            buy?TickMath.MIN_SQRT_PRICE+1:TickMath.MAX_SQRT_PRICE-1),PoolSwapTest.TestSettings(false,false),"");
        if (!buy) {
            uint256 fees=hook.totalOwed(currency)-oldTotal;
            uint256 gross=exactOutput?uint256(-int256(result.amount1()))-fees:uint256(uint128(result.amount0()))+fees;
            assertLe(fees,gross*1000/10_000);
            if(exactOutput)expectedOpsToken+=gross*200/10_000; else expectedOpsEth+=gross*200/10_000;
        }
        ++swaps;
    }
    function sweep(uint8 rawBucket,bool tokenFee) external {
        hook.sweep(Currency.wrap(tokenFee?address(omr):address(0)),uint8(bound(rawBucket,1,4)));
    }
}

contract HookTaxGovernanceInvariantTest is OmertaHookV2Fixture {
    HookTaxGovernanceHandler private handler;
    function setUp() public override {
        super.setUp(); handler=new HookTaxGovernanceHandler(hook,router,omr); targetContract(address(handler));
    }
    function invariantProtectedOpsAndFundedLiabilitiesWithDelayedTaxChanges() public view {
        _assertConserved(eth); _assertConserved(token);
        assertEq(hook.owed(eth,0),handler.expectedOpsEth()); assertEq(hook.owed(token,0),handler.expectedOpsToken());
        assertEq(hook.opsRecipient(),recipients[0]); assertEq(hook.governanceSafe(),address(this));
        (uint16 rwa,uint16 community,uint16 pol,uint16 surge)=hook.taxConfig();
        assertEq(hook.baseSellBps(),200+uint256(rwa)+community+pol);
        assertLe(uint256(hook.baseSellBps())+surge,1000); assertGe(hook.baseSellBps(),200);
        assertEq(hook.openingEndsAtBlock(),300); assertEq(hook.poolFee(),3000); assertEq(hook.tickSpacing(),60);
        assertTrue(hook.TAX_EXECUTION_SAFE_ONLY());
    }
}
