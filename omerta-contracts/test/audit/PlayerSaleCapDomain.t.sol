// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {GenesisCharacterMock} from "../helpers/GenesisCharacterMock.sol";
import {Test} from "forge-std/Test.sol";
import {GenesisPlayerSale} from "../../src/GenesisPlayerSale.sol";
import {PlayerTokenMock, PlayerIntegrationMock} from "../GenesisPlayerSale.t.sol";

contract PlayerSaleCapDomainTest is Test {
    function test_allUint8TiersReturnPublishedCapOrEligibilityError() public {
        GenesisPlayerSale sale = new GenesisPlayerSale(
            new PlayerTokenMock(), new PlayerIntegrationMock(), bytes32(uint256(1)),
            1 ether, block.timestamp + 1 days, block.timestamp + 5 days, address(0xCAFE), new GenesisCharacterMock()
        );
        uint256[5] memory published = [uint256(0.5 ether), 1 ether, 2.5 ether, 5 ether, 5 ether];
        for (uint256 tier; tier < 256; ++tier) {
            (bool ok, bytes memory result) = address(sale).staticcall(
                abi.encodeCall(sale.cap, (uint8(tier)))
            );
            if (tier >= 1 && tier <= 5) {
                assertTrue(ok);
                assertEq(abi.decode(result, (uint256)), published[tier - 1]);
            } else {
                assertFalse(ok);
                assertEq(result, abi.encodeWithSelector(GenesisPlayerSale.InvalidEligibility.selector));
            }
        }
    }
}
