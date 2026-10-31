// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/interfaces/callback/IUnlockCallback.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolModifyLiquidityTest} from "v4-core/test/PoolModifyLiquidityTest.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {SwapParams, ModifyLiquidityParams} from "v4-core/types/PoolOperation.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {BalanceDelta, toBalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {TransientStateLibrary} from "v4-core/libraries/TransientStateLibrary.sol";
import {OmertaWbtcConverterV2} from "../../src/market-v2/OmertaWbtcConverterV2.sol";

contract ConverterVaultFixtureV2 {
    OmertaWbtcConverterV2 public converter;
    bool public reentryAccepted;
    bytes4 public reentryFailure;
    function configure(OmertaWbtcConverterV2 value) external { converter = value; }
    function convert(uint256 minimum, uint64 deadline) external payable returns (uint256) {
        return converter.convertNativeToWbtc{value: msg.value}(minimum, deadline);
    }
    function reenter() external {
        try converter.convertNativeToWbtc{value: 1}(1, uint64(block.timestamp + 1)) returns (uint256) {
            reentryAccepted = true;
        } catch (bytes memory reason) {
            if (reason.length >= 4) {
                bytes4 selector;
                assembly ("memory-safe") { selector := mload(add(reason, 32)) }
                reentryFailure = selector;
            }
        }
    }
}

contract ConverterWbtcFixtureV2 is ERC20 {
    uint8 private immutable _decimals;
    bool public burnOne;
    bool public failTransfer;
    ConverterVaultFixtureV2 public reentryVault;
    constructor(uint8 decimals_) ERC20("Wrapped BTC", "WBTC") { _decimals = decimals_; }
    function decimals() public view override returns (uint8) { return _decimals; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function setBurnOne(bool value) external { burnOne = value; }
    function setFailTransfer(bool value) external { failTransfer = value; }
    function setReentryVault(ConverterVaultFixtureV2 vault) external { reentryVault = vault; }
    function transfer(address to, uint256 amount) public override returns (bool) {
        if (failTransfer) return false;
        if (address(reentryVault) != address(0)) reentryVault.reenter();
        if (burnOne && amount != 0) {
            _burn(msg.sender, 1);
            return super.transfer(to, amount - 1);
        }
        return super.transfer(to, amount);
    }
}

contract ConverterForceNativeV2 {
    constructor(address payable target) payable { selfdestruct(target); }
}

/// @dev Adversarial stand-in, not evidence about any live manager, bridge or price.
contract ConverterManagerFixtureV2 {
    enum Mode {
        Good, NoCallback, WrongData, DoubleCallback, PartialInput, PositiveInput, ZeroOutput,
        NegativeOutput, BadSettlement, ShortDelivery, ExtraDelivery, Refund, ForceRefund,
        ForgedReturn, VaultReentry, CallbackReentry
    }
    ConverterWbtcFixtureV2 public immutable token;
    Mode public mode;
    uint256 public output = 100_000;
    uint256 public settled;
    uint256 public taken;
    address public recipient;
    address public locker;
    bytes private _payload;
    ConverterVaultFixtureV2 public reentryVault;
    bool public callbackReentryAccepted;
    bytes4 public callbackReentryFailure;
    bytes32 public lastKeyHash;
    int256 public lastAmountSpecified;
    bool public lastZeroForOne;
    uint160 public lastPriceLimit;
    constructor(ConverterWbtcFixtureV2 token_) { token = token_; }
    function setMode(Mode value) external { mode = value; }
    function setOutput(uint256 value) external { output = value; }
    function setReentryVault(ConverterVaultFixtureV2 vault) external { reentryVault = vault; }
    function unlock(bytes calldata data) external returns (bytes memory result) {
        locker = msg.sender;
        _payload = data;
        if (mode == Mode.NoCallback) return "";
        if (mode == Mode.WrongData) return IUnlockCallback(msg.sender).unlockCallback(abi.encode(uint256(1), uint256(1)));
        result = IUnlockCallback(msg.sender).unlockCallback(data);
        if (mode == Mode.DoubleCallback) IUnlockCallback(msg.sender).unlockCallback(data);
        if (mode == Mode.ForgedReturn) return abi.encode(type(uint256).max);
    }
    function swap(PoolKey memory key, SwapParams memory params, bytes calldata hookData) external returns (BalanceDelta) {
        require(msg.sender == locker && hookData.length == 0, "fixed callback context");
        lastKeyHash = keccak256(abi.encode(key));
        lastAmountSpecified = params.amountSpecified;
        lastZeroForOne = params.zeroForOne;
        lastPriceLimit = params.sqrtPriceLimitX96;
        if (mode == Mode.VaultReentry) reentryVault.reenter();
        if (mode == Mode.CallbackReentry) {
            (bool accepted, bytes memory reason) = locker.call(abi.encodeCall(IUnlockCallback.unlockCallback, (_payload)));
            callbackReentryAccepted = accepted;
            if (reason.length >= 4) {
                bytes4 selector;
                assembly ("memory-safe") { selector := mload(add(reason, 32)) }
                callbackReentryFailure = selector;
            }
        }
        int128 input = int128(params.amountSpecified);
        int128 result = int128(uint128(output));
        if (mode == Mode.PartialInput) input /= 2;
        if (mode == Mode.PositiveInput) input = -input;
        if (mode == Mode.ZeroOutput) result = 0;
        if (mode == Mode.NegativeOutput) result = -result;
        return toBalanceDelta(input, result);
    }
    function sync(Currency currency) external pure { require(Currency.unwrap(currency) == address(0), "native only"); }
    function settle() external payable returns (uint256) {
        settled += msg.value;
        if (mode == Mode.Refund) {
            (bool ok,) = msg.sender.call{value: 1}("");
            require(ok, "refund rejected");
        }
        if (mode == Mode.ForceRefund) new ConverterForceNativeV2{value: 1}(payable(msg.sender));
        return mode == Mode.BadSettlement ? msg.value - 1 : msg.value;
    }
    function take(Currency currency, address to, uint256 amount) external {
        require(Currency.unwrap(currency) == address(token), "WBTC only");
        recipient = to;
        taken += amount;
        if (mode == Mode.ShortDelivery) --amount;
        if (mode == Mode.ExtraDelivery) ++amount;
        require(token.transfer(to, amount), "token refused");
    }
}

contract WbtcConverterV2Test is Test {
    ConverterWbtcFixtureV2 internal wbtc;
    ConverterManagerFixtureV2 internal manager;
    OmertaWbtcConverterV2 internal converter;
    PoolKey internal key;
    function setUp() public {
        vm.warp(1000);
        vm.deal(address(this), 1000 ether);
        wbtc = new ConverterWbtcFixtureV2(8);
        manager = new ConverterManagerFixtureV2(wbtc);
        key = PoolKey(Currency.wrap(address(0)), Currency.wrap(address(wbtc)), 3000, 60, IHooks(address(0)));
        converter = _deploy(address(this), wbtc, address(manager), key, address(manager).codehash, address(wbtc).codehash);
        wbtc.mint(address(manager), 1e35);
    }
    function _deploy(address vault, IERC20Metadata token, address poolManager, PoolKey memory pool, bytes32 managerHash, bytes32 tokenHash)
        internal returns (OmertaWbtcConverterV2)
    {
        return new OmertaWbtcConverterV2(vault, token, IPoolManager(poolManager), pool, managerHash, tokenHash);
    }
    function _convert(uint256 amount, uint256 minimum) internal returns (uint256) {
        return converter.convertNativeToWbtc{value: amount}(minimum, uint64(block.timestamp + 1));
    }
    function testConstructorPinsFixedPoolAndAllowsCounterfactualVault() public {
        address futureVault = address(0x123456);
        OmertaWbtcConverterV2 other = _deploy(futureVault, wbtc, address(manager), key, address(manager).codehash, address(wbtc).codehash);
        assertEq(other.authorizedVault(), futureVault);
        assertEq(address(other.externalManager()), address(manager));
        assertEq(address(other.wbtc()), address(wbtc));
        assertEq(abi.encode(other.poolKey()), abi.encode(key));
        assertEq(other.MAX_DEADLINE_DELAY(), 1 days);
    }
    function testConstructorRejectsInvalidRolesAssetsAndRuntimePins() public {
        vm.expectRevert(OmertaWbtcConverterV2.InvalidConfiguration.selector);
        _deploy(address(0), wbtc, address(manager), key, address(manager).codehash, address(wbtc).codehash);
        vm.expectRevert(OmertaWbtcConverterV2.InvalidConfiguration.selector);
        _deploy(address(this), wbtc, address(0x123), key, bytes32(uint256(1)), address(wbtc).codehash);
        vm.expectRevert(OmertaWbtcConverterV2.InvalidConfiguration.selector);
        _deploy(address(this), IERC20Metadata(address(0x123)), address(manager), key, address(manager).codehash, bytes32(uint256(1)));
        vm.expectRevert(OmertaWbtcConverterV2.InvalidConfiguration.selector);
        _deploy(address(this), wbtc, address(manager), key, bytes32(0), address(wbtc).codehash);
        vm.expectRevert(OmertaWbtcConverterV2.InvalidConfiguration.selector);
        _deploy(address(this), wbtc, address(manager), key, address(manager).codehash, bytes32(uint256(1)));
        ConverterWbtcFixtureV2 wrongDecimals = new ConverterWbtcFixtureV2(18);
        PoolKey memory bad = key;
        bad.currency1 = Currency.wrap(address(wrongDecimals));
        vm.expectRevert(OmertaWbtcConverterV2.InvalidConfiguration.selector);
        _deploy(address(this), wrongDecimals, address(manager), bad, address(manager).codehash, address(wrongDecimals).codehash);
    }
    function testConstructorRejectsOtherCurrenciesHooksDynamicFeeAndSpacing() public {
        for (uint256 i; i < 7; ++i) {
            PoolKey memory bad = key;
            if (i == 0) bad.currency0 = Currency.wrap(address(wbtc));
            if (i == 1) bad.currency1 = Currency.wrap(address(0x123));
            if (i == 2) bad.hooks = IHooks(address(1));
            if (i == 3) bad.fee = 0x800000;
            if (i == 4) bad.fee = 1_000_000;
            if (i == 5) bad.tickSpacing = 0;
            if (i == 6) bad.tickSpacing = 32768;
            vm.expectRevert(OmertaWbtcConverterV2.InvalidConfiguration.selector);
            _deploy(address(this), wbtc, address(manager), bad, address(manager).codehash, address(wbtc).codehash);
        }
    }
    function testOnlyVaultCanConvertAndNobodyCanSendOrdinaryNative() public {
        vm.deal(address(0x123), 1 ether);
        vm.prank(address(0x123));
        vm.expectRevert(OmertaWbtcConverterV2.UnauthorizedVault.selector);
        _convert(1 ether, 1);
        (bool ok,) = address(converter).call{value: 1}("");
        assertFalse(ok);
        assertEq(address(converter).balance, 0);
    }
    function testZeroInputMinimumAndInt128OverflowRejected() public {
        vm.expectRevert(OmertaWbtcConverterV2.InvalidConversion.selector);
        _convert(0, 1);
        vm.expectRevert(OmertaWbtcConverterV2.InvalidConversion.selector);
        _convert(1, 0);
        uint256 tooLarge = uint256(uint128(type(int128).max)) + 1;
        vm.deal(address(this), tooLarge);
        vm.expectRevert(OmertaWbtcConverterV2.InvalidConversion.selector);
        _convert(tooLarge, 1);
    }
    function testDeadlineMustBeStrictlyFutureAndAtMostOneDay() public {
        vm.expectRevert(OmertaWbtcConverterV2.InvalidDeadline.selector);
        converter.convertNativeToWbtc{value: 1}(1, uint64(block.timestamp));
        vm.expectRevert(OmertaWbtcConverterV2.InvalidDeadline.selector);
        converter.convertNativeToWbtc{value: 1}(1, uint64(block.timestamp - 1));
        vm.expectRevert(OmertaWbtcConverterV2.InvalidDeadline.selector);
        converter.convertNativeToWbtc{value: 1}(1, uint64(block.timestamp + 1 days + 1));
        assertEq(converter.convertNativeToWbtc{value: 1}(1, uint64(block.timestamp + 1 days)), manager.output());
    }
    function testRuntimeDriftOfEitherDependencyRejectsBeforeConversion() public {
        bytes memory managerCode = address(manager).code;
        vm.etch(address(manager), hex"00");
        vm.expectRevert(OmertaWbtcConverterV2.RuntimeMismatch.selector);
        _convert(1, 1);
        vm.etch(address(manager), managerCode);
        vm.etch(address(wbtc), hex"00");
        vm.expectRevert(OmertaWbtcConverterV2.RuntimeMismatch.selector);
        _convert(1, 1);
    }
    function testCallbackRequiresManagerAndOneActiveExactPayload() public {
        vm.expectRevert(OmertaWbtcConverterV2.UnauthorizedCallback.selector);
        converter.unlockCallback(abi.encode(uint256(1), uint256(1)));
        vm.prank(address(manager));
        vm.expectRevert(OmertaWbtcConverterV2.UnauthorizedCallback.selector);
        converter.unlockCallback(abi.encode(uint256(1), uint256(1)));
        ConverterManagerFixtureV2.Mode[3] memory modes = [
            ConverterManagerFixtureV2.Mode.NoCallback, ConverterManagerFixtureV2.Mode.WrongData,
            ConverterManagerFixtureV2.Mode.DoubleCallback
        ];
        for (uint256 i; i < modes.length; ++i) {
            manager.setMode(modes[i]);
            vm.expectRevert(OmertaWbtcConverterV2.UnauthorizedCallback.selector);
            _convert(1 ether, 1);
            assertEq(manager.settled(), 0);
            assertEq(wbtc.balanceOf(address(this)), 0);
        }
    }
    function testRejectsPartialFillWrongInputSignAndNonpositiveOutput() public {
        ConverterManagerFixtureV2.Mode[4] memory modes = [
            ConverterManagerFixtureV2.Mode.PartialInput, ConverterManagerFixtureV2.Mode.PositiveInput,
            ConverterManagerFixtureV2.Mode.ZeroOutput, ConverterManagerFixtureV2.Mode.NegativeOutput
        ];
        for (uint256 i; i < modes.length; ++i) {
            manager.setMode(modes[i]);
            vm.expectRevert(OmertaWbtcConverterV2.InvalidSwapDelta.selector);
            _convert(1 ether, 1);
            assertEq(manager.settled(), 0);
            assertEq(wbtc.balanceOf(address(this)), 0);
        }
    }
    function testActualVaultBalanceMustExactlyMatchDeclaredOutput() public {
        manager.setMode(ConverterManagerFixtureV2.Mode.ShortDelivery);
        vm.expectRevert(OmertaWbtcConverterV2.SettlementMismatch.selector);
        _convert(1 ether, 1);
        manager.setMode(ConverterManagerFixtureV2.Mode.ExtraDelivery);
        vm.expectRevert(OmertaWbtcConverterV2.SettlementMismatch.selector);
        _convert(1 ether, 1);
        manager.setMode(ConverterManagerFixtureV2.Mode.ShortDelivery);
        uint256 minimum = manager.output();
        vm.expectRevert(OmertaWbtcConverterV2.OutputBelowMinimum.selector);
        _convert(1 ether, minimum);
        assertEq(address(manager).balance, 0);
        assertEq(wbtc.balanceOf(address(this)), 0);
    }
    function testBadSettlementAndOrdinaryOrForcedRefundRollBack() public {
        manager.setMode(ConverterManagerFixtureV2.Mode.BadSettlement);
        vm.expectRevert(OmertaWbtcConverterV2.SettlementMismatch.selector);
        _convert(1 ether, 1);
        manager.setMode(ConverterManagerFixtureV2.Mode.Refund);
        vm.expectRevert();
        _convert(1 ether, 1);
        manager.setMode(ConverterManagerFixtureV2.Mode.ForceRefund);
        vm.expectRevert(OmertaWbtcConverterV2.SettlementMismatch.selector);
        _convert(1 ether, 1);
        assertEq(address(manager).balance, 0);
        assertEq(address(converter).balance, 0);
        assertEq(manager.settled(), 0);
    }
    function testPrefundedBalancesExcludedAndUntrustedUnlockReturnIgnored() public {
        vm.deal(address(converter), 7 ether);
        wbtc.mint(address(this), 12345);
        manager.setMode(ConverterManagerFixtureV2.Mode.ForgedReturn);
        uint256 actual = _convert(2 ether, 1);
        assertEq(actual, manager.output());
        assertEq(wbtc.balanceOf(address(this)), 12345 + actual);
        assertEq(address(converter).balance, 7 ether);
        assertEq(address(manager).balance, 2 ether);
        assertEq(manager.settled(), 2 ether);
        assertEq(manager.recipient(), address(this));
        assertEq(manager.lastAmountSpecified(), -int256(2 ether));
        assertTrue(manager.lastZeroForOne());
        assertEq(manager.lastKeyHash(), keccak256(abi.encode(key)));
    }
    function testRepeatedConversionsClearCallbackAndOutputContext() public {
        assertEq(_convert(1 ether, 1), 100_000);
        manager.setOutput(250_000);
        assertEq(_convert(2 ether, 250_000), 250_000);
        assertEq(wbtc.balanceOf(address(this)), 350_000);
        assertEq(manager.settled(), 3 ether);
        vm.prank(address(manager));
        vm.expectRevert(OmertaWbtcConverterV2.UnauthorizedCallback.selector);
        converter.unlockCallback(abi.encode(uint256(2 ether), uint256(250_000)));
    }
    function _vaultConverter() internal returns (ConverterVaultFixtureV2 vault) {
        vault = new ConverterVaultFixtureV2();
        converter = _deploy(address(vault), wbtc, address(manager), key, address(manager).codehash, address(wbtc).codehash);
        vault.configure(converter);
        vm.deal(address(vault), 1 ether);
    }
    function testReentrantAuthorizedVaultCannotConvertDuringManagerSwap() public {
        ConverterVaultFixtureV2 vault = _vaultConverter();
        manager.setReentryVault(vault);
        manager.setMode(ConverterManagerFixtureV2.Mode.VaultReentry);
        assertEq(vault.convert{value: 1 ether}(1, uint64(block.timestamp + 1)), 100_000);
        assertFalse(vault.reentryAccepted());
        assertEq(vault.reentryFailure(), bytes4(keccak256("ReentrancyGuardReentrantCall()")));
        assertEq(manager.settled(), 1 ether);
        assertEq(wbtc.balanceOf(address(vault)), 100_000);
    }
    function testReentrantAuthorizedVaultCannotConvertDuringTokenTransfer() public {
        ConverterVaultFixtureV2 vault = _vaultConverter();
        wbtc.setReentryVault(vault);
        vault.convert{value: 1 ether}(1, uint64(block.timestamp + 1));
        assertFalse(vault.reentryAccepted());
        assertEq(vault.reentryFailure(), bytes4(keccak256("ReentrancyGuardReentrantCall()")));
        assertEq(manager.settled(), 1 ether);
    }
    function testNestedCallbackIsConsumedBeforeManagerSwap() public {
        manager.setMode(ConverterManagerFixtureV2.Mode.CallbackReentry);
        _convert(1 ether, 1);
        assertFalse(manager.callbackReentryAccepted());
        assertEq(manager.callbackReentryFailure(), OmertaWbtcConverterV2.UnauthorizedCallback.selector);
    }
    function testRefusingAndFeeOnTransferTokenFailClosed() public {
        wbtc.setFailTransfer(true);
        vm.expectRevert();
        _convert(1 ether, 1);
        wbtc.setFailTransfer(false);
        wbtc.setBurnOne(true);
        vm.expectRevert(OmertaWbtcConverterV2.SettlementMismatch.selector);
        _convert(1 ether, 1);
        assertEq(manager.settled(), 0);
        assertEq(wbtc.balanceOf(address(this)), 0);
    }
    function testFuzz_ExactInputAndOutputConservation(uint96 nativeAmount, uint96 outputAmount) public {
        uint256 amount = bound(uint256(nativeAmount), 1, 100 ether);
        uint256 output = bound(uint256(outputAmount), 1, 1e25);
        manager.setOutput(output);
        uint256 before = address(this).balance;
        assertEq(_convert(amount, output), output);
        assertEq(address(this).balance, before - amount);
        assertEq(address(manager).balance, amount);
        assertEq(manager.settled(), amount);
        assertEq(wbtc.balanceOf(address(this)), output);
        assertEq(wbtc.balanceOf(address(converter)), 0);
        assertEq(address(converter).balance, 0);
    }
    function testFuzz_MinimumAboveActualRollsBack(uint96 nativeAmount, uint96 outputAmount) public {
        uint256 amount = bound(uint256(nativeAmount), 1, 100 ether);
        uint256 output = bound(uint256(outputAmount), 1, 1e25);
        manager.setOutput(output);
        uint256 before = address(this).balance;
        vm.expectRevert(OmertaWbtcConverterV2.OutputBelowMinimum.selector);
        _convert(amount, output + 1);
        assertEq(address(this).balance, before);
        assertEq(address(manager).balance, 0);
        assertEq(wbtc.balanceOf(address(this)), 0);
        assertEq(manager.settled(), 0);
    }
}

/// @dev Actual standard v4 accounting with synthetic local balances, not a live pool or price claim.
contract WbtcConverterStandardManagerV2Test is Test {
    using TransientStateLibrary for IPoolManager;
    ConverterWbtcFixtureV2 internal wbtc;
    IPoolManager internal manager;
    OmertaWbtcConverterV2 internal converter;
    PoolKey internal key;
    function setUp() public {
        vm.warp(1000);
        vm.deal(address(this), 1000 ether);
        wbtc = new ConverterWbtcFixtureV2(8);
        // Use the real manager's default-profile artifact, as other market tests do. Embedding its
        // creation code in this via-IR test would change the manager's reviewed compiler pipeline.
        manager = IPoolManager(deployCode("PoolManager.sol:PoolManager", abi.encode(address(this))));
        key = PoolKey(Currency.wrap(address(0)), Currency.wrap(address(wbtc)), 3000, 60, IHooks(address(0)));
        // Equal raw-unit price is a fixture only; no real ETH/WBTC quote is asserted.
        manager.initialize(key, uint160(1 << 96));
        PoolModifyLiquidityTest liquidity = new PoolModifyLiquidityTest(manager);
        wbtc.mint(address(this), 1e30);
        wbtc.approve(address(liquidity), type(uint256).max);
        liquidity.modifyLiquidity{value: 200 ether}(key, ModifyLiquidityParams(-887220, 887220, 1 ether, bytes32(0)), "");
        converter = new OmertaWbtcConverterV2(address(this), wbtc, manager, key, address(manager).codehash, address(wbtc).codehash);
    }
    function testActualStandardManagerSettlesNativeAndDeliversDirectToVault() public {
        uint256 nativeBefore = address(manager).balance;
        uint256 before = wbtc.balanceOf(address(this));
        uint256 actual = converter.convertNativeToWbtc{value: 1 ether}(1, uint64(block.timestamp + 1));
        assertGt(actual, 0);
        assertEq(wbtc.balanceOf(address(this)) - before, actual);
        assertEq(address(manager).balance - nativeBefore, 1 ether);
        assertEq(address(converter).balance, 0);
        assertEq(wbtc.balanceOf(address(converter)), 0);
        assertEq(manager.getNonzeroDeltaCount(), 0);
    }
    function testActualStandardManagerMinimumFailureRollsBackAllBalances() public {
        uint256 nativeBefore = address(manager).balance;
        uint256 tokenBefore = wbtc.balanceOf(address(this));
        vm.expectRevert(OmertaWbtcConverterV2.OutputBelowMinimum.selector);
        converter.convertNativeToWbtc{value: 1 ether}(type(uint128).max, uint64(block.timestamp + 1));
        assertEq(address(manager).balance, nativeBefore);
        assertEq(wbtc.balanceOf(address(this)), tokenBefore);
        assertEq(address(converter).balance, 0);
        assertEq(manager.getNonzeroDeltaCount(), 0);
    }
    function testActualStandardManagerPartialFillRejectsInsteadOfRefunding() public {
        uint256 input = uint256(uint128(type(int128).max));
        vm.deal(address(this), input);
        uint256 nativeBefore = address(manager).balance;
        uint256 tokenBefore = wbtc.balanceOf(address(this));
        vm.expectRevert(OmertaWbtcConverterV2.InvalidSwapDelta.selector);
        converter.convertNativeToWbtc{value: input}(1, uint64(block.timestamp + 1));
        assertEq(address(manager).balance, nativeBefore);
        assertEq(wbtc.balanceOf(address(this)), tokenBefore);
        assertEq(manager.getNonzeroDeltaCount(), 0);
    }
    receive() external payable {}
}
