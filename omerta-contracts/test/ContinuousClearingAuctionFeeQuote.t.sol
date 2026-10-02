// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ContinuousClearingAuction} from "../src/genesis-auction/vendor/cca/ContinuousClearingAuction.sol";
import {AuctionParameters} from "../src/genesis-auction/vendor/cca/interfaces/IContinuousClearingAuction.sol";
import {LBPInitializationParams} from "../src/genesis-auction/vendor/launcher/src/interfaces/ILBPInitializer.sol";

contract FeeQuoteToken is ERC20 {
    constructor() ERC20("OMR", "OMR") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract ExcessiveAuctionFeeController {
    address public constant protocolFeeRecipient = address(0xFEE);
    function getProtocolFeeAmount(address, uint256 amount) external pure returns (uint256) {
        return amount + 1;
    }
}

contract ContinuousClearingAuctionFeeQuoteTest is Test {
    uint256 constant Q96 = 1 << 96;
    address constant ALICE = address(0xA11CE);

    function _completedAuction(address controller) private returns (ContinuousClearingAuction auction) {
        vm.roll(1);
        FeeQuoteToken token = new FeeQuoteToken();
        AuctionParameters memory p = AuctionParameters(address(0), address(0xCAFE), address(this),
            10, 20, 30, 2, address(0), (Q96 / 1000) / 2 * 2, 1,
            abi.encodePacked(uint24(1_000_000), uint40(10)));
        auction = new ContinuousClearingAuction(address(token), 1000 ether, p, controller);
        token.mint(address(auction), 1000 ether);
        auction.onTokensReceived();
        vm.deal(ALICE, 10 ether);
        vm.roll(10);
        vm.prank(ALICE);
        auction.submitBid{value: 2 ether}(Q96, uint128(2 ether), ALICE, bytes(""));
        vm.roll(20);
        auction.checkpoint();
        assertTrue(auction.isGraduated());
        assertGt(auction.currencyRaised(), 0);
    }

    function testExcessiveFeeDoesNotBlockInitializationAndMatchesSweep() public {
        ExcessiveAuctionFeeController controller = new ExcessiveAuctionFeeController();
        ContinuousClearingAuction auction = _completedAuction(address(controller));
        uint256 raised = auction.currencyRaised();
        // Before the patch this required initialization read panicked, blocking migration callers.
        LBPInitializationParams memory params = auction.lbpInitializationParams();
        assertEq(params.currencyRaised, 0);
        assertGt(params.initialPriceX96, 0);
        assertGt(params.tokensSold, 0);
        uint256 recipientBefore = address(this).balance;
        uint256 feeBefore = controller.protocolFeeRecipient().balance;
        auction.sweepCurrency();
        assertEq(address(this).balance, recipientBefore);
        assertEq(controller.protocolFeeRecipient().balance, feeBefore + raised);
    }

    function testZeroControllerKeepsEntireRaiseForInitializer() public {
        ContinuousClearingAuction auction = _completedAuction(address(0));
        uint256 raised = auction.currencyRaised();
        assertEq(auction.lbpInitializationParams().currencyRaised, raised);
        uint256 beforeSweep = address(this).balance;
        auction.sweepCurrency();
        assertEq(address(this).balance, beforeSweep + raised);
    }

    receive() external payable {}
}
