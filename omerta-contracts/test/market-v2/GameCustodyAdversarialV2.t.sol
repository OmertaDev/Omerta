// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;
import {GameCustodyV2Test} from "./GameCustodyV2.t.sol";
import {OmertaGameCustodyV2,IGameCustodyTokenV2,IGameCustodyGenesisV2} from "../../src/market-v2/OmertaGameCustodyV2.sol";

contract GameCustodyAdversarialV2Test is GameCustodyV2Test {
    function test_AdversarialOversignedVouchersCannotExceedCapOrActualBacking() public {
        ready(); vault.fundReserve(100 ether);
        OmertaGameCustodyV2.Voucher memory first=voucher(80 ether,1);
        OmertaGameCustodyV2.Voucher memory second=voucher(80 ether,2);
        bytes memory firstConsent=signature(first); bytes memory secondConsent=signature(second);
        vault.claim(first,firstConsent);
        vm.expectRevert(OmertaGameCustodyV2.DailyCapExceeded.selector); vault.claim(second,secondConsent);
        assertFalse(vault.usedNonce(2)); assertEq(vault.cumulativeClaimed(),80 ether);
        // Even an owner-approved cap increase cannot turn unbacked signatures
        // into minted OMR; failure atomically restores nonce/cap accounting.
        vault.setDailyCap(200 ether);
        vm.expectRevert(); vault.claim(second,secondConsent);
        assertFalse(vault.usedNonce(2)); assertEq(vault.cumulativeClaimed(),80 ether);
        assertEq(vault.claimedOnDay(block.timestamp/1 days),80 ether);
        vault.fundReserve(60 ether); vault.claim(second,secondConsent);
        assertEq(vault.cumulativeFunded(),160 ether+1e12); assertEq(vault.cumulativeClaimed(),160 ether);
        assertEq(token.balanceOf(address(vault)),1e12); assertEq(token.balanceOf(alice),160 ether);
    }

    function test_AdversarialOtherCustodyDomainCannotAuthorizeThisVault() public {
        ready(); vault.fundReserve(10 ether);
        OmertaGameCustodyV2 original=vault;
        OmertaGameCustodyV2 other=new OmertaGameCustodyV2(address(this),signer,
            IGameCustodyTokenV2(address(token)),IGameCustodyGenesisV2(address(genesis)),100 ether);
        OmertaGameCustodyV2.Voucher memory claim=voucher(1 ether,1);
        vault=other; bytes memory wrongDomain=signature(claim); vault=original;
        vm.expectRevert(OmertaGameCustodyV2.InvalidVoucher.selector); vault.claim(claim,wrongDomain);
        assertFalse(vault.usedNonce(1)); assertEq(vault.cumulativeClaimed(),0);
    }
}
