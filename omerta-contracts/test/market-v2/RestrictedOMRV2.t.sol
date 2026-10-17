// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {IOmertaRestrictedOMRV2} from "../../src/market-v2/IOmertaRestrictedOMRV2.sol";
import {OmertaRestrictedOMRV2 as RestrictedOMR} from "../../src/market-v2/OmertaRestrictedOMRV2.sol";
import {OmertaSwapRouterV2 as SwapRouter} from "../../src/market-v2/OmertaSwapRouterV2.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/interfaces/callback/IUnlockCallback.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/types/PoolOperation.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {BalanceDelta, toBalanceDelta} from "v4-core/types/BalanceDelta.sol";

/// @dev Transfer probes deliberately expose broad calls to test each token-level role boundary.
contract RestrictedRoleProbeV2 {
    function burnFrom(IOmertaRestrictedOMRV2 token, address from, uint256 amount) external {
        token.burnFrom(from, amount);
    }

    function transfer(IOmertaRestrictedOMRV2 token, address to, uint256 amount) external {
        token.transfer(to, amount);
    }

    function transferFrom(IOmertaRestrictedOMRV2 token, address from, address to, uint256 amount) external {
        token.transferFrom(from, to, amount);
    }
}

contract RestrictedManagerPolicyMockV2 is RestrictedRoleProbeV2 {
    address public immutable omr;
    uint16 public immutable TRADE_FEE_BPS;
    bytes32 private immutable _policyId;

    constructor(address token, uint16 feeBps, bytes32 policyId) {
        omr = token;
        TRADE_FEE_BPS = feeBps;
        _policyId = policyId;
    }

    function revenuePolicyId() external view returns (bytes32) {
        return _policyId;
    }
}

contract RestrictedOMRV2Test is Test, IUnlockCallback {
    function testBurnIsAllowanceConsumingOnlySealedPinnedCustodyAndReducesSupply() public {
        token.approve(address(custody), 10 ether);
        vm.expectRevert(RestrictedOMR.UnauthorizedTransfer.selector);
        custody.burnFrom(token, address(this), 1 ether);
        _seal();
        token.approve(address(custody), 10 ether);
        uint256 supply = token.totalSupply();
        uint256 walletBefore = token.balanceOf(address(this));
        custody.burnFrom(token, address(this), 3 ether);
        assertEq(token.totalSupply(), supply - 3 ether);
        assertEq(token.balanceOf(address(this)), walletBefore - 3 ether);
        assertEq(token.allowance(address(this), address(custody)), 7 ether);
        vm.expectRevert(RestrictedOMR.UnauthorizedTransfer.selector);
        token.burnFrom(address(this), 1 ether);
        vm.expectRevert(RestrictedOMR.UnauthorizedTransfer.selector);
        input.burnFrom(token, address(this), 1 ether);
        vm.expectRevert(RestrictedOMR.UnauthorizedTransfer.selector);
        manager.burnFrom(token, address(this), 1 ether);
        vm.expectRevert();
        custody.burnFrom(token, address(this), 8 ether);
        assertEq(token.totalSupply(), supply - 3 ether);
        vm.etch(address(custody), hex"00");
        vm.prank(address(custody));
        vm.expectRevert(RestrictedOMR.UnauthorizedTransfer.selector);
        token.burnFrom(address(this), 1 ether);
    }

    RestrictedOMR token;
    RestrictedManagerPolicyMockV2 manager;
    RestrictedRoleProbeV2 input;
    RestrictedRoleProbeV2 custody;
    IPoolManager private _foreignManager;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    bytes32 constant POLICY_ID = keccak256("OMERTA_RESTRICTED_LP_REVENUE_V2_500_BOTH_DIRECTIONS");
    bytes32 constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    function setUp() public {
        token = new RestrictedOMR(address(this));
        manager = new RestrictedManagerPolicyMockV2(address(token), 500, POLICY_ID);
        input = new RestrictedRoleProbeV2();
        custody = new RestrictedRoleProbeV2();
        _registerWallet(alice);
        _registerWallet(bob);
    }

    function testFixedSupplyMetadataAndZeroOwner() public {
        assertEq(token.name(), "OMERTA");
        assertEq(token.symbol(), "OMR");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), 100_000_000e18);
        assertEq(token.owner(), address(this));
        assertEq(token.balanceOf(address(this)), token.SUPPLY());
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new RestrictedOMR(address(0));
    }

    function testBeforeSealOnlyOwnerCanDistributeItsOwnBalance() public {
        token.transfer(alice, 100 ether);
        token.transfer(bob, 1 ether);
        vm.prank(alice, alice);
        vm.expectRevert(RestrictedOMR.UnauthorizedTransfer.selector);
        token.transfer(bob, 1 ether);
        vm.prank(alice, alice);
        token.approve(address(this), 2 ether);
        vm.expectRevert(RestrictedOMR.UnauthorizedTransfer.selector);
        token.transferFrom(alice, bob, 1 ether);
        token.approve(address(input), 1 ether);
        vm.expectRevert(RestrictedOMR.UnauthorizedTransfer.selector);
        input.transferFrom(token, address(this), bob, 1 ether);
        assertEq(token.allowance(address(this), address(input)), 1 ether);
        assertEq(token.allowance(alice, address(this)), 2 ether);
    }

    function testConfigurationRequiresOwnerContractAndMatchingRuntime() public {
        vm.prank(alice, alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        token.setOperator(address(input), IOmertaRestrictedOMRV2.OperatorRole.SettlementInput, address(input).codehash);
        vm.expectRevert(RestrictedOMR.InvalidRuntimeHash.selector);
        token.setOperator(alice, IOmertaRestrictedOMRV2.OperatorRole.SettlementInput, alice.codehash);
        vm.expectRevert(RestrictedOMR.InvalidRuntimeHash.selector);
        token.setOperator(address(input), IOmertaRestrictedOMRV2.OperatorRole.SettlementInput, bytes32(uint256(1)));
        vm.expectRevert(RestrictedOMR.InvalidOperator.selector);
        token.setOperator(address(input), IOmertaRestrictedOMRV2.OperatorRole.SettlementManager, address(input).codehash);
        _registerOperators();
        assertTrue(token.isOperator(address(input)));
        assertFalse(token.isOperator(alice));
        token.setOperator(address(input), IOmertaRestrictedOMRV2.OperatorRole.None, bytes32(0));
        assertFalse(token.isOperator(address(input)));
    }

    function testBindingRequiresExactTokenFeePolicyAndRuntimeAndIsOneTime() public {
        RestrictedManagerPolicyMockV2 foreign = new RestrictedManagerPolicyMockV2(address(1), 500, POLICY_ID);
        _expectInvalidManager(foreign);
        foreign = new RestrictedManagerPolicyMockV2(address(token), 549, POLICY_ID);
        _expectInvalidManager(foreign);
        foreign = new RestrictedManagerPolicyMockV2(address(token), 500, bytes32(uint256(1)));
        _expectInvalidManager(foreign);
        vm.expectRevert(RestrictedOMR.InvalidSettlementManager.selector);
        token.bindSettlementManager(address(input), address(input).codehash);
        vm.expectRevert(RestrictedOMR.InvalidRuntimeHash.selector);
        token.bindSettlementManager(address(manager), bytes32(uint256(1)));
        token.bindSettlementManager(address(manager), address(manager).codehash);
        assertEq(token.settlementManager(), address(manager));
        assertEq(uint8(token.operatorRole(address(manager))), uint8(IOmertaRestrictedOMRV2.OperatorRole.SettlementManager));
        vm.expectRevert(RestrictedOMR.SettlementManagerAlreadyBound.selector);
        token.bindSettlementManager(address(manager), address(manager).codehash);
        vm.expectRevert(RestrictedOMR.InvalidOperator.selector);
        token.setOperator(address(manager), IOmertaRestrictedOMRV2.OperatorRole.None, bytes32(0));
    }

    function testSealRequiresBindingAndLivePinsAndFreezesPolicy() public {
        vm.expectRevert(RestrictedOMR.InvalidSettlementManager.selector);
        token.sealPolicy();
        _registerOperators();
        token.bindSettlementManager(address(manager), address(manager).codehash);
        bytes memory original = address(input).code;
        vm.etch(address(input), hex"00");
        vm.expectRevert(RestrictedOMR.InvalidRuntimeHash.selector);
        token.sealPolicy();
        vm.etch(address(input), original);
        token.sealPolicy();
        assertTrue(token.policySealed());
        vm.expectRevert(RestrictedOMR.PolicySealed.selector);
        token.setOperator(address(input), IOmertaRestrictedOMRV2.OperatorRole.None, bytes32(0));
        vm.expectRevert(RestrictedOMR.PolicySealed.selector);
        token.bindSettlementManager(address(manager), address(manager).codehash);
        vm.expectRevert(RestrictedOMR.PolicySealed.selector);
        token.sealPolicy();
        vm.expectRevert(RestrictedOMR.UnauthorizedTransfer.selector);
        token.transfer(bob, 1 ether);
    }

    function testSealRejectsAnyInventoryAlreadyDistributedOutsideOwner() public {
        _registerOperators();
        token.bindSettlementManager(address(manager), address(manager).codehash);
        token.transfer(alice, 1);
        vm.expectRevert(RestrictedOMR.InvalidGenesisInventory.selector);
        token.sealPolicy();
        assertFalse(token.policySealed());
        assertEq(token.balanceOf(alice), 1);
    }

    function testNativeForeignManagerCannotBePrefundedBeforeSeal() public {
        _foreignManager = IPoolManager(deployCode("PoolManager.sol:PoolManager", abi.encode(address(this))));
        PoolKey memory foreignKey =
            PoolKey(Currency.wrap(address(0)), Currency.wrap(address(token)), 0, 60, IHooks(address(0)));
        _foreignManager.initialize(foreignKey, 79228162514264337593543950336);
        vm.deal(address(this), 10 ether);
        vm.expectRevert(RestrictedOMR.InvalidRecipient.selector);
        _foreignManager.unlock(abi.encode(foreignKey));
        assertEq(token.balanceOf(address(_foreignManager)), 0, "foreign manager funding is rejected atomically");
        assertEq(token.balanceOf(address(this)), token.SUPPLY());
        assertFalse(token.isOperator(address(_foreignManager)));
        _registerOperators();
        token.bindSettlementManager(address(manager), address(manager).codehash);
        token.sealPolicy();
        assertTrue(token.policySealed(), "blocked foreign funding leaves the full genesis inventory sealable");
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(_foreignManager));
        PoolKey memory foreignKey = abi.decode(data, (PoolKey));
        (BalanceDelta delta,) = _foreignManager.modifyLiquidity(
            foreignKey, ModifyLiquidityParams(-887220, 887220, 1 ether, bytes32(0)), ""
        );
        _foreignManager.sync(foreignKey.currency0);
        _foreignManager.settle{value: uint256(-int256(delta.amount0()))}();
        _foreignManager.sync(foreignKey.currency1);
        token.transfer(address(_foreignManager), uint256(-int256(delta.amount1())));
        _foreignManager.settle();
        return abi.encode(delta);
    }

    function testSettlementInputCanOnlyPullIntoBoundManager() public {
        _seal();
        vm.prank(alice, alice);
        token.approve(address(input), 10 ether);
        input.transferFrom(token, alice, address(manager), 3 ether);
        assertEq(token.balanceOf(address(manager)), 103 ether);
        assertEq(token.allowance(alice, address(input)), 7 ether);
        vm.expectRevert(RestrictedOMR.UnauthorizedTransfer.selector);
        input.transferFrom(token, alice, bob, 1 ether);
        vm.prank(alice, alice);
        vm.expectRevert(RestrictedOMR.UnauthorizedTransfer.selector);
        token.transfer(address(manager), 1 ether);
        vm.prank(alice, alice);
        token.approve(bob, 1 ether);
        vm.prank(bob);
        vm.expectRevert(RestrictedOMR.UnauthorizedTransfer.selector);
        token.transferFrom(alice, address(manager), 1 ether);
    }

    function testCustodyRoleOnlyMovesItsOwnCustody() public {
        _seal();
        vm.prank(alice, alice);
        token.approve(address(custody), 10 ether);
        custody.transferFrom(token, alice, address(custody), 3 ether);
        custody.transfer(token, bob, 2 ether);
        assertEq(token.balanceOf(address(custody)), 101 ether);
        assertEq(token.balanceOf(bob), 2 ether);
        vm.expectRevert(RestrictedOMR.UnauthorizedTransfer.selector);
        custody.transferFrom(token, alice, bob, 1 ether);
        vm.expectRevert(RestrictedOMR.UnauthorizedTransfer.selector);
        custody.transferFrom(token, alice, address(manager), 1 ether);
    }

    function testManagerCanOnlyMoveBalancesFromManager() public {
        _seal();
        manager.transfer(token, bob, 3 ether);
        assertEq(token.balanceOf(bob), 3 ether);
        vm.prank(alice, alice);
        token.approve(address(manager), 1 ether);
        vm.expectRevert(RestrictedOMR.UnauthorizedTransfer.selector);
        manager.transferFrom(token, alice, address(manager), 1 ether);
        vm.expectRevert(RestrictedOMR.UnauthorizedTransfer.selector);
        manager.transferFrom(token, alice, bob, 1 ether);
    }

    function testChangedRuntimeCannotTransferAfterSealing() public {
        _seal();
        vm.prank(alice, alice);
        token.approve(address(input), 1 ether);
        vm.etch(address(input), hex"00");
        assertFalse(token.isOperator(address(input)));
        vm.prank(address(input));
        vm.expectRevert(RestrictedOMR.UnauthorizedTransfer.selector);
        token.transferFrom(alice, address(manager), 1 ether);
        vm.etch(address(manager), hex"00");
        assertFalse(token.isOperator(address(manager)));
        vm.prank(address(manager));
        vm.expectRevert(RestrictedOMR.UnauthorizedTransfer.selector);
        token.transfer(bob, 1 ether);
    }

    function testPermitAndFiniteInfiniteAllowancesRemainStandard() public {
        uint256 key = 0xA11CE;
        address holder = vm.addr(key);
        _seal();
        _registerWallet(holder);
        custody.transfer(token, holder, 10 ether);
        uint256 deadline = block.timestamp + 1 days;
        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, holder, address(input), 4 ether, 0, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        token.permit(holder, address(input), 4 ether, deadline, v, r, s);
        assertEq(token.nonces(holder), 1);
        input.transferFrom(token, holder, address(manager), 3 ether);
        assertEq(token.allowance(holder, address(input)), 1 ether);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(input), 1 ether, 2 ether)
        );
        input.transferFrom(token, holder, address(manager), 2 ether);
        vm.prank(holder);
        token.approve(address(input), type(uint256).max);
        input.transferFrom(token, holder, address(manager), 2 ether);
        assertEq(token.allowance(holder, address(input)), type(uint256).max);
        assertEq(token.totalSupply(), token.SUPPLY());
    }

    function testOwnershipRemainsTwoStepAndCannotUnlockSealedTransfers() public {
        _seal();
        token.transferOwnership(alice);
        assertEq(token.owner(), address(this));
        assertEq(token.pendingOwner(), alice);
        vm.prank(alice, alice);
        token.acceptOwnership();
        assertEq(token.owner(), alice);
        vm.prank(alice, alice);
        vm.expectRevert(RestrictedOMR.UnauthorizedTransfer.selector);
        token.transfer(bob, 1 ether);
        vm.prank(alice, alice);
        vm.expectRevert(RestrictedOMR.PolicySealed.selector);
        token.setOperator(address(input), IOmertaRestrictedOMRV2.OperatorRole.None, bytes32(0));
    }

    function testReceivingContractHolderHasNoTransferOrOperatorAuthority() public {
        RestrictedRoleProbeV2 holder = new RestrictedRoleProbeV2();
        token.setContractHolder(address(holder), address(holder).codehash);
        _seal();
        assertTrue(token.isRecipient(address(holder)));
        assertFalse(token.isOperator(address(holder)));
        custody.transfer(token, address(holder), 1 ether);
        assertEq(token.balanceOf(address(holder)), 1 ether);
        vm.expectRevert(RestrictedOMR.UnauthorizedTransfer.selector);
        holder.transfer(token, bob, 1 ether);
        vm.prank(alice, alice);
        token.approve(address(holder), 1 ether);
        vm.expectRevert(RestrictedOMR.UnauthorizedTransfer.selector);
        holder.transferFrom(token, alice, address(manager), 1 ether);
    }

    function testContractHolderEnumerationPinsRevocationAndSealFreeze() public {
        RestrictedRoleProbeV2 holder = new RestrictedRoleProbeV2();
        assertEq(token.contractHolderCount(), 0, "immutable genesis pin is separate from holder enumeration");
        token.setContractHolder(address(holder), address(holder).codehash);
        assertEq(token.contractHolderCount(), 1);
        assertEq(token.contractHolderAt(0), address(holder));
        assertEq(token.contractHolderRuntimeHash(address(holder)), address(holder).codehash);
        vm.prank(alice, alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        token.setContractHolder(address(holder), address(holder).codehash);
        vm.expectRevert(RestrictedOMR.InvalidRuntimeHash.selector);
        token.setContractHolder(alice, bytes32(uint256(1)));
        vm.expectRevert(RestrictedOMR.InvalidRecipient.selector);
        token.setContractHolder(address(this), address(this).codehash);
        token.setContractHolder(address(holder), bytes32(0));
        assertFalse(token.isRecipient(address(holder)));
        assertEq(token.contractHolderCount(), 1, "revoked entries remain enumerable");
        token.setContractHolder(address(holder), address(holder).codehash);
        _seal();
        assertEq(token.operatorCount(), 3);
        assertEq(token.operatorAt(0), address(input));
        vm.expectRevert(RestrictedOMR.PolicySealed.selector);
        token.setContractHolder(address(holder), bytes32(0));
        vm.etch(address(holder), hex"00");
        assertFalse(token.isRecipient(address(holder)));
        vm.expectRevert(RestrictedOMR.InvalidRecipient.selector);
        custody.transfer(token, address(holder), 1 ether);
    }

    function testSealChecksLiveContractHolderPin() public {
        RestrictedRoleProbeV2 holder = new RestrictedRoleProbeV2();
        token.setContractHolder(address(holder), address(holder).codehash);
        _registerOperators();
        token.bindSettlementManager(address(manager), address(manager).codehash);
        vm.etch(address(holder), hex"00");
        vm.expectRevert(RestrictedOMR.InvalidRuntimeHash.selector);
        token.sealPolicy();
    }

    function testWalletRegistrationRequiresOriginProofOrPinnedInputRouter() public {
        address wallet = address(0xCAFE);
        assertFalse(token.isRecipient(wallet));
        vm.expectRevert(RestrictedOMR.UnauthorizedWalletRegistration.selector);
        token.registerWallet(wallet);
        vm.prank(alice, alice);
        vm.expectRevert(RestrictedOMR.UnauthorizedWalletRegistration.selector);
        token.registerWallet(wallet);
        _registerOperators();
        vm.prank(address(custody), wallet);
        vm.expectRevert(RestrictedOMR.UnauthorizedWalletRegistration.selector);
        token.registerWallet(wallet);
        vm.prank(address(input), wallet);
        token.registerWallet(wallet);
        assertTrue(token.registeredWallet(wallet));
        assertTrue(token.isRecipient(wallet));
        assertFalse(token.isOperator(wallet));
        vm.etch(address(input), hex"00");
        address anotherWallet = address(0xCAFF);
        vm.prank(address(input), anotherWallet);
        vm.expectRevert(RestrictedOMR.UnauthorizedWalletRegistration.selector);
        token.registerWallet(anotherWallet);
        _registerWallet(anotherWallet);
        assertTrue(token.isRecipient(anotherWallet));
    }

    function testSelfProvenWalletRegistrationRemainsOpenAfterSealAndLiveCodeRevokesReceipt() public {
        _seal();
        address wallet = address(0xCAFE);
        _registerWallet(wallet);
        assertTrue(token.registeredWallet(wallet));
        custody.transfer(token, wallet, 1 ether);
        vm.etch(wallet, hex"00");
        assertFalse(token.isRecipient(wallet), "new code invalidates EOA registration");
        vm.expectRevert(RestrictedOMR.InvalidRecipient.selector);
        custody.transfer(token, wallet, 1 ether);
        vm.prank(wallet, wallet);
        vm.expectRevert(RestrictedOMR.UnauthorizedWalletRegistration.selector);
        token.registerWallet(wallet);
    }

    function testUnregisteredDeployedAndCounterfactualContractRecipientsAreBlocked() public {
        RestrictedRoleProbeV2 foreign = new RestrictedRoleProbeV2();
        address futureManager = address(0xC0FFEE);
        vm.expectRevert(RestrictedOMR.InvalidRecipient.selector);
        token.transfer(address(foreign), 1 ether);
        vm.expectRevert(RestrictedOMR.InvalidRecipient.selector);
        token.transfer(futureManager, 1 ether);
        _seal();
        vm.expectRevert(RestrictedOMR.InvalidRecipient.selector);
        manager.transfer(token, address(foreign), 1 ether);
        vm.expectRevert(RestrictedOMR.InvalidRecipient.selector);
        manager.transfer(token, futureManager, 1 ether);
        vm.etch(futureManager, address(foreign).code);
        assertFalse(token.isRecipient(futureManager));
        vm.expectRevert(RestrictedOMR.InvalidRecipient.selector);
        custody.transfer(token, futureManager, 1 ether);
    }

    function testSealPreservesImmutableGenesisTreasuryAndRejectsChangedOwner() public {
        assertEq(token.genesisTreasury(), address(this));
        assertEq(token.genesisTreasuryRuntimeHash(), address(this).codehash);
        assertTrue(token.isRecipient(address(this)));
        token.bindSettlementManager(address(manager), address(manager).codehash);
        token.transferOwnership(alice);
        vm.prank(alice, alice);
        token.acceptOwnership();
        vm.prank(alice, alice);
        vm.expectRevert(RestrictedOMR.InvalidGenesisInventory.selector);
        token.sealPolicy();
        assertEq(token.balanceOf(address(this)), token.SUPPLY());
        assertEq(token.genesisTreasury(), address(this));
    }

    function testEoaGenesisTreasuryRequiresLiveEmptyCode() public {
        RestrictedOMR eoaToken = new RestrictedOMR(alice);
        RestrictedManagerPolicyMockV2 eoaManager = new RestrictedManagerPolicyMockV2(address(eoaToken), 500, POLICY_ID);
        assertEq(eoaToken.genesisTreasuryRuntimeHash(), keccak256(""));
        assertTrue(eoaToken.isRecipient(alice));
        vm.prank(alice, alice);
        eoaToken.bindSettlementManager(address(eoaManager), address(eoaManager).codehash);
        vm.etch(alice, hex"00");
        assertFalse(eoaToken.isRecipient(alice));
        vm.prank(alice, alice);
        vm.expectRevert(RestrictedOMR.InvalidRuntimeHash.selector);
        eoaToken.sealPolicy();
    }

    function testContractGenesisTreasuryRuntimeMustRemainPinnedForSeal() public {
        token.bindSettlementManager(address(manager), address(manager).codehash);
        bytes memory original = address(this).code;
        vm.etch(address(this), hex"00");
        assertFalse(token.isRecipient(address(this)));
        vm.expectRevert(RestrictedOMR.InvalidRuntimeHash.selector);
        token.sealPolicy();
        vm.etch(address(this), original);
        assertTrue(token.isRecipient(address(this)));
        token.sealPolicy();
    }

    function _expectInvalidManager(RestrictedManagerPolicyMockV2 foreign) private {
        vm.expectRevert(RestrictedOMR.InvalidSettlementManager.selector);
        token.bindSettlementManager(address(foreign), address(foreign).codehash);
    }

    function _registerWallet(address wallet) private {
        vm.prank(wallet, wallet);
        token.registerWallet(wallet);
    }

    function _registerOperators() private {
        token.setOperator(address(input), IOmertaRestrictedOMRV2.OperatorRole.SettlementInput, address(input).codehash);
        token.setOperator(address(custody), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody, address(custody).codehash);
    }

    function _seal() private {
        _registerOperators();
        token.bindSettlementManager(address(manager), address(manager).codehash);
        token.sealPolicy();
        token.approve(address(custody), 300 ether);
        custody.transferFrom(token, address(this), address(custody), 300 ether);
        custody.transfer(token, alice, 100 ether);
        custody.transfer(token, address(manager), 100 ether);
    }
}

/// @dev Supplies already fee-adjusted deltas and observes the router's settlement calls.
contract RestrictedRouterManagerMockV2 is RestrictedManagerPolicyMockV2 {
    BalanceDelta private _delta;
    Currency private _syncedCurrency;
    uint256 private _syncedBalance;
    uint8 public callbackMode;
    uint256 public lastSettled;

    constructor(address token)
        RestrictedManagerPolicyMockV2(token, 500, keccak256("OMERTA_RESTRICTED_LP_REVENUE_V2_500_BOTH_DIRECTIONS"))
    {}

    function configure(int128 amount0, int128 amount1, uint8 mode) external {
        _delta = toBalanceDelta(amount0, amount1);
        callbackMode = mode;
    }

    function unlock(bytes calldata data) external returns (bytes memory result) {
        if (callbackMode == 1) return IUnlockCallback(msg.sender).unlockCallback(abi.encodePacked(data, bytes1(0)));
        if (callbackMode == 3) return abi.encode(_delta);
        result = IUnlockCallback(msg.sender).unlockCallback(data);
        if (callbackMode == 2) IUnlockCallback(msg.sender).unlockCallback(data);
    }

    function swap(PoolKey calldata, SwapParams calldata, bytes calldata) external view returns (BalanceDelta) {
        return _delta;
    }

    function sync(Currency currency) external {
        _syncedCurrency = currency;
        if (Currency.unwrap(currency) != address(0)) {
            _syncedBalance = IOmertaRestrictedOMRV2(omr).balanceOf(address(this));
        }
    }

    function settle() external payable returns (uint256 paid) {
        if (Currency.unwrap(_syncedCurrency) == address(0)) {
            paid = msg.value;
        } else {
            require(msg.value == 0);
            paid = IOmertaRestrictedOMRV2(omr).balanceOf(address(this)) - _syncedBalance;
        }
        lastSettled = paid;
    }

    function take(Currency currency, address to, uint256 amount) external {
        if (Currency.unwrap(currency) == address(0)) {
            (bool ok,) = to.call{value: amount}("");
            require(ok);
        } else {
            IOmertaRestrictedOMRV2(omr).transfer(to, amount);
        }
    }

    receive() external payable {}
}

contract RestrictedSwapRouterV2Test is Test {
    RestrictedOMR token;
    RestrictedRouterManagerMockV2 manager;
    SwapRouter router;
    PoolKey key;
    address alice = address(0xA11CE);

    function setUp() public {
        token = new RestrictedOMR(address(this));
        manager = new RestrictedRouterManagerMockV2(address(token));
        router = new SwapRouter(IPoolManager(address(manager)), token);
        RestrictedRoleProbeV2 custody = new RestrictedRoleProbeV2();
        token.setOperator(address(router), IOmertaRestrictedOMRV2.OperatorRole.SettlementInput, address(router).codehash);
        token.setOperator(address(custody), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody, address(custody).codehash);
        token.bindSettlementManager(address(manager), address(manager).codehash);
        token.sealPolicy();
        vm.prank(alice, alice);
        token.registerWallet(alice);
        token.approve(address(custody), 2_000 ether);
        custody.transferFrom(token, address(this), address(custody), 2_000 ether);
        custody.transfer(token, alice, 1_000 ether);
        custody.transfer(token, address(manager), 1_000 ether);
        vm.deal(alice, 10 ether);
        vm.deal(address(manager), 10 ether);
        key = PoolKey(Currency.wrap(address(0)), Currency.wrap(address(token)), 0, 60, IHooks(address(0)));
        vm.prank(alice, alice);
        token.approve(address(router), type(uint256).max);
    }

    function testNativeBuySettlesActualInputAndRefundsOnlyCallFunding() public {
        vm.deal(address(router), 5 ether);
        manager.configure(-1 ether, 94.5 ether, 0);
        vm.prank(alice, alice);
        BalanceDelta delta = router.swap{value: 2 ether}(key, _params(true, -2 ether), 94.5 ether, 1 ether, _deadline());
        assertEq(delta.amount0(), -1 ether);
        assertEq(delta.amount1(), 94.5 ether);
        assertEq(alice.balance, 9 ether);
        assertEq(address(router).balance, 5 ether);
        assertEq(token.balanceOf(address(router)), 0);
        assertEq(token.balanceOf(alice), 1_094.5 ether);
        assertEq(manager.lastSettled(), 1 ether);
    }

    function testOmrSellPullsDirectlyToManagerAndTakesNetNativeOutput() public {
        manager.configure(0.945 ether, -100 ether, 0);
        vm.prank(alice, alice);
        router.swap(key, _params(false, -100 ether), 0.945 ether, 100 ether, _deadline());
        assertEq(alice.balance, 10.945 ether);
        assertEq(token.balanceOf(alice), 900 ether);
        assertEq(token.balanceOf(address(manager)), 1_100 ether);
        assertEq(token.balanceOf(address(router)), 0);
        assertEq(manager.lastSettled(), 100 ether);
    }

    function testLimitsUseActualFeeAdjustedDeltasAndAllowPartialFills() public {
        manager.configure(-1 ether, 94.5 ether, 0);
        vm.prank(alice, alice);
        vm.expectRevert(SwapRouter.OutputBelowMinimum.selector);
        router.swap{value: 2 ether}(key, _params(true, -2 ether), 95 ether, 2 ether, _deadline());
        vm.prank(alice, alice);
        vm.expectRevert(SwapRouter.InputAboveMaximum.selector);
        router.swap{value: 2 ether}(key, _params(true, -2 ether), 94.5 ether, 0.9 ether, _deadline());
        vm.prank(alice, alice);
        router.swap{value: 2 ether}(key, _params(true, -2 ether), 94.5 ether, 1 ether, _deadline());
        assertEq(alice.balance, 9 ether);
    }

    function testForcedBalanceCannotFundNativeInput() public {
        vm.deal(address(router), 5 ether);
        manager.configure(-1 ether, 94.5 ether, 0);
        vm.prank(alice, alice);
        vm.expectRevert(SwapRouter.InsufficientNativeFunding.selector);
        router.swap(key, _params(true, -1 ether), 94.5 ether, 1 ether, _deadline());
        assertEq(address(router).balance, 5 ether);
    }

    function testCallbacksRejectWrongSenderChangedPayloadReplayAndMissingCall() public {
        vm.expectRevert(SwapRouter.UnauthorizedCallback.selector);
        router.unlockCallback("");
        for (uint8 mode = 1; mode <= 3; ++mode) {
            manager.configure(-1 ether, 94.5 ether, mode);
            vm.prank(alice, alice);
            vm.expectRevert(SwapRouter.UnauthorizedCallback.selector);
            router.swap{value: 1 ether}(key, _params(true, -1 ether), 94.5 ether, 1 ether, _deadline());
        }
        manager.configure(-1 ether, 94.5 ether, 0);
        vm.prank(alice, alice);
        router.swap{value: 1 ether}(key, _params(true, -1 ether), 94.5 ether, 1 ether, _deadline());
        vm.prank(address(manager));
        vm.expectRevert(SwapRouter.UnauthorizedCallback.selector);
        router.unlockCallback("");
    }

    function testWrongPoolExpiredDeadlineAndChangedManagerRuntimeFailClosed() public {
        manager.configure(-1 ether, 94.5 ether, 0);
        PoolKey memory foreign = key;
        foreign.currency1 = Currency.wrap(address(1));
        vm.prank(alice, alice);
        vm.expectRevert(SwapRouter.InvalidPool.selector);
        router.swap{value: 1 ether}(foreign, _params(true, -1 ether), 94.5 ether, 1 ether, _deadline());
        vm.prank(alice, alice);
        vm.expectRevert(SwapRouter.DeadlineExpired.selector);
        router.swap{value: 1 ether}(key, _params(true, -1 ether), 94.5 ether, 1 ether, uint64(block.timestamp - 1));
        vm.etch(address(manager), hex"00");
        vm.prank(alice, alice);
        vm.expectRevert(SwapRouter.PolicyUnavailable.selector);
        router.swap{value: 1 ether}(key, _params(true, -1 ether), 94.5 ether, 1 ether, _deadline());
    }

    function testNativeReceiveRejectsSenderOtherThanManager() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(router).call{value: 1 ether}("");
        assertFalse(ok);
        assertEq(address(router).balance, 0);
    }

    function testRouterAutomaticallyRegistersDirectEoaPayer() public {
        address buyer = address(0xBEEF);
        vm.deal(buyer, 2 ether);
        assertFalse(token.registeredWallet(buyer));
        manager.configure(-1 ether, 94.5 ether, 0);
        vm.prank(buyer, buyer);
        router.swap{value: 1 ether}(key, _params(true, -1 ether), 94.5 ether, 1 ether, _deadline());
        assertTrue(token.registeredWallet(buyer));
        assertTrue(token.isRecipient(buyer));
        assertEq(token.balanceOf(buyer), 94.5 ether);
    }

    function testRouterRejectsUnregisteredContractPayerAndDoesNotEnrollIt() public {
        RestrictedRoleProbeV2 foreign = new RestrictedRoleProbeV2();
        vm.deal(address(foreign), 1 ether);
        vm.prank(address(foreign), alice);
        vm.expectRevert(SwapRouter.PolicyUnavailable.selector);
        router.swap{value: 1 ether}(key, _params(true, -1 ether), 94.5 ether, 1 ether, _deadline());
        assertFalse(token.registeredWallet(address(foreign)));
    }

    function _params(bool zeroForOne, int256 specified) private pure returns (SwapParams memory) {
        return SwapParams(zeroForOne, specified, 0);
    }

    function _deadline() private view returns (uint64) {
        return uint64(block.timestamp + 1 days);
    }
}
