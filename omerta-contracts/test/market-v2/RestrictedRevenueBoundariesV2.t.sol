// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {RestrictedPoolManagerV2Test, OmertaPoolManagerV2} from "./RestrictedPoolManagerV2.t.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/interfaces/callback/IUnlockCallback.sol";
import {IProtocolFees} from "v4-core/interfaces/IProtocolFees.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {BalanceDelta, toBalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";
import {TransientStateLibrary} from "v4-core/libraries/TransientStateLibrary.sol";

/// @dev Test-only recipient installed at a fixed revenue address; no operator registration is needed.
contract RestrictedReentrantRecipientFixtureV2 {
    IPoolManager public manager;
    uint256 public receipts;
    bool[5] public succeeded;
    bytes4[5] public failures;

    function configure(IPoolManager manager_) external {
        manager = manager_;
    }

    receive() external payable {
        ++receipts;
        Currency native = Currency.wrap(address(0));
        _attempt(0, abi.encodeCall(OmertaPoolManagerV2.sweep, (native, 0)));
        _attempt(1, abi.encodeCall(OmertaPoolManagerV2.claim, (native, 0, address(this))));
        _attempt(2, abi.encodeCall(IProtocolFees.collectProtocolFees, (address(this), native, 0)));
        _attempt(3, abi.encodeCall(IPoolManager.unlock, (bytes(""))));
        _attempt(4, abi.encodeCall(IPoolManager.sync, (native)));
    }

    function _attempt(uint256 index, bytes memory payload) private {
        (bool ok, bytes memory result) = address(manager).call(payload);
        succeeded[index] = ok;
        if (result.length >= 4) {
            bytes4 selector;
            assembly ("memory-safe") { selector := mload(add(result, 32)) }
            failures[index] = selector;
        }
    }
}

contract RestrictedRevenueBoundariesV2Test is RestrictedPoolManagerV2Test, IUnlockCallback {
    using StateLibrary for IPoolManager;
    using TransientStateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    /// @dev This fixture is already a pinned custody operator. Deliberately settle the raw pool
    ///      deltas and omit only the extra revenue debt, including in internally funded token sales.
    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(manager));
        (PoolKey memory key, SwapParams memory params) = abi.decode(data, (PoolKey, SwapParams));
        bool feeInNative = params.amountSpecified < 0 ? !params.zeroForOne : params.zeroForOne;
        Currency feeCurrency = feeInNative ? key.currency0 : key.currency1;
        uint256 owedBefore = revenueManager.totalOwed(feeCurrency);
        BalanceDelta adjusted = manager.swap(key, params, "");
        uint256 fee = revenueManager.totalOwed(feeCurrency) - owedBefore;
        require(fee != 0, "counterexample requires nonzero fee");
        BalanceDelta raw = toBalanceDelta(
            int128(int256(adjusted.amount0()) + (feeInNative ? int256(fee) : int256(0))),
            int128(int256(adjusted.amount1()) + (feeInNative ? int256(0) : int256(fee)))
        );

        if (raw.amount0() < 0) {
            manager.sync(key.currency0);
            manager.settle{value: uint256(-int256(raw.amount0()))}();
        }
        if (raw.amount1() < 0) {
            manager.sync(key.currency1);
            omr.transfer(address(manager), uint256(-int256(raw.amount1())));
            manager.settle();
        }
        if (raw.amount0() > 0) manager.take(key.currency0, address(this), uint256(int256(raw.amount0())));
        if (raw.amount1() > 0) manager.take(key.currency1, address(this), uint256(int256(raw.amount1())));
        return abi.encode(adjusted);
    }

    function testRawDeltaUnderpaymentRollsBackAllModesAndRevenueLiabilities() public {
        uint256 managerNative = address(manager).balance;
        uint256 managerToken = omr.balanceOf(address(manager));
        uint256 holderNative = address(this).balance;
        uint256 holderToken = omr.balanceOf(address(this));
        (uint160 priceBefore, int24 tickBefore,,) = manager.getSlot0(noHookKey.toId());
        for (uint256 mode; mode < 4; ++mode) {
            bool buy = mode < 2;
            bool exactInput = mode % 2 == 0;
            SwapParams memory params = SwapParams(buy, exactInput ? -int256(1 ether) : int256(1 ether), buy ? Q96 / 2 : Q96 * 2);
            vm.expectRevert(IPoolManager.CurrencyNotSettled.selector);
            manager.unlock(abi.encode(noHookKey, params));
            assertEq(address(manager).balance, managerNative, "failed native settlements roll back");
            assertEq(omr.balanceOf(address(manager)), managerToken, "failed token settlements roll back");
            assertEq(address(this).balance, holderNative);
            assertEq(omr.balanceOf(address(this)), holderToken);
            assertEq(revenueManager.totalOwed(eth), 0, "failed swap cannot create native liabilities");
            assertEq(revenueManager.totalOwed(token), 0, "failed swap cannot create token liabilities");
            for (uint8 bucket; bucket < 4; ++bucket) {
                assertEq(revenueManager.owed(eth, bucket), 0);
                assertEq(revenueManager.owed(token, bucket), 0);
            }
            (uint160 priceAfter, int24 tickAfter,,) = manager.getSlot0(noHookKey.toId());
            assertEq(priceAfter, priceBefore, "failed swap rolls back pool price");
            assertEq(tickAfter, tickBefore, "failed swap rolls back pool tick");
            assertEq(manager.getLiquidity(noHookKey.toId()), INITIAL_L);
            assertEq(manager.getNonzeroDeltaCount(), 0, "failed unlock cannot leave debt behind");
        }
        _swap(noHookKey, true, -1 ether, Q96 / 2);
        assertGt(revenueManager.totalOwed(token), 0, "fully paid trades remain usable after failed unlocks");
    }

    function testProtocolAndTradeRevenueRemainSeparateThroughBothCurrencyWithdrawals() public {
        _registerWallet(address(0xCAFE));
        _registerWallet(address(0xBEEF));
        manager.setProtocolFeeController(address(this));
        manager.setProtocolFee(noHookKey, uint24(1000 | (1000 << 12)));
        _swap(noHookKey, true, -10 ether, Q96 / 2);
        _swap(noHookKey, false, -10 ether, Q96 * 2);
        manager.sync(eth);
        _assertDistinctWithdrawals(eth, address(0xCAFE), true);
        _assertDistinctWithdrawals(token, address(0xBEEF), false);
    }

    function testRecipientReentryCannotRepeatPayoutOrEnterSettlement() public {
        RestrictedReentrantRecipientFixtureV2 template = new RestrictedReentrantRecipientFixtureV2();
        vm.etch(recipients[0], address(template).code);
        RestrictedReentrantRecipientFixtureV2 recipient = RestrictedReentrantRecipientFixtureV2(payable(recipients[0]));
        recipient.configure(manager);
        _swap(noHookKey, false, -10 ether, Q96 * 2);
        uint256 entitlement = revenueManager.owed(eth, 0);
        uint256 totalBefore = revenueManager.totalOwed(eth);
        uint256 balanceBefore = address(manager).balance;
        uint256 recipientBefore = recipients[0].balance;
        assertGt(entitlement, 0);
        assertFalse(omr.isOperator(recipients[0]), "recipient is intentionally outside operator registry");

        assertEq(revenueManager.sweep(eth, 0), entitlement);
        assertEq(recipient.receipts(), 1, "one funded payout reaches the recipient");
        assertEq(recipients[0].balance - recipientBefore, entitlement);
        assertEq(address(manager).balance, balanceBefore - entitlement);
        assertEq(revenueManager.owed(eth, 0), 0);
        assertEq(revenueManager.totalOwed(eth), totalBefore - entitlement);
        for (uint256 index; index < 5; ++index) {
            assertFalse(recipient.succeeded(index), "callback cannot enter another withdrawal or settlement");
            assertEq(recipient.failures(index), OmertaPoolManagerV2.WithdrawalReentered.selector);
        }
        _assertLiabilities(eth);
        _swap(noHookKey, true, -1 ether, Q96 / 2);
        assertGt(revenueManager.totalOwed(token), 0, "withdrawal guard resets after payout");
    }

    function _assertDistinctWithdrawals(Currency currency, address protocolRecipient, bool protocolFirst) private {
        bool native = Currency.unwrap(currency) == address(0);
        uint256 protocolBefore = manager.protocolFeesAccrued(currency);
        uint256 tradeBefore = revenueManager.totalOwed(currency);
        uint256 developerBefore = revenueManager.owed(currency, 0);
        uint256 balanceBefore = native ? address(manager).balance : omr.balanceOf(address(manager));
        uint256 recipientBefore = native ? protocolRecipient.balance : omr.balanceOf(protocolRecipient);
        assertGt(protocolBefore, 0, "test must exercise funded protocol fees");
        assertGt(tradeBefore, 0, "test must exercise funded trade fees in the same currency");

        if (!protocolFirst) {
            assertEq(revenueManager.sweep(currency, 0), developerBefore);
            assertEq(manager.protocolFeesAccrued(currency), protocolBefore, "trade withdrawal preserves protocol entitlement");
            assertEq(revenueManager.totalOwed(currency), tradeBefore - developerBefore);
        }

        assertEq(manager.collectProtocolFees(protocolRecipient, currency, 0), protocolBefore);
        assertEq(manager.protocolFeesAccrued(currency), 0);
        assertEq(
            revenueManager.totalOwed(currency), protocolFirst ? tradeBefore : tradeBefore - developerBefore,
            "protocol withdrawal cannot consume trade entitlement"
        );
        assertEq(revenueManager.owed(currency, 0), protocolFirst ? developerBefore : 0);
        uint256 recipientAfter = native ? protocolRecipient.balance : omr.balanceOf(protocolRecipient);
        assertEq(recipientAfter - recipientBefore, protocolBefore);
        assertEq(
            native ? address(manager).balance : omr.balanceOf(address(manager)),
            balanceBefore - protocolBefore - (protocolFirst ? 0 : developerBefore)
        );

        if (protocolFirst) assertEq(revenueManager.sweep(currency, 0), developerBefore);
        assertEq(manager.protocolFeesAccrued(currency), 0, "trade withdrawal cannot recreate protocol entitlement");
        assertEq(revenueManager.totalOwed(currency), tradeBefore - developerBefore);
        assertEq(revenueManager.owed(currency, 0), 0);
        assertEq(
            native ? address(manager).balance : omr.balanceOf(address(manager)),
            balanceBefore - protocolBefore - developerBefore,
            "distinct withdrawals debit only their funded assets"
        );
        _assertLiabilities(currency);
    }
}
