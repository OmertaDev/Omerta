// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;
import {Test} from "forge-std/Test.sol";
import {OmertaPositionDescriptorV2} from "../../src/market-v2/OmertaPositionDescriptorV2.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPositionManager} from "../../lib/v4-periphery/src/interfaces/IPositionManager.sol";
import {PositionInfo} from "../../lib/v4-periphery/src/libraries/PositionInfoLibrary.sol";
import {IPositionDescriptor} from "../../lib/v4-periphery/src/interfaces/IPositionDescriptor.sol";

contract PositionDescriptorV2Fixture {
    IPoolManager public poolManager;
    constructor(address manager) { poolManager = IPoolManager(manager); }
    function getPoolAndPositionInfo(uint256 id) external pure returns (PoolKey memory key, PositionInfo info) {
        key=PoolKey(Currency.wrap(address(0)),Currency.wrap(address(5)),3000,60,IHooks(address(7)));
        if(id!=0) info=PositionInfo.wrap((uint256(1)<<248)|(uint256(uint24(int24(149400)))<<32)|(uint256(uint24(int24(-148800)))<<8));
    }
}
contract PositionDescriptorV2Test is Test {
    function testRejectsZeroBindings() public {
        vm.expectRevert(OmertaPositionDescriptorV2.BadConfiguration.selector);
        new OmertaPositionDescriptorV2(IPoolManager(address(0)),address(2));
        vm.expectRevert(OmertaPositionDescriptorV2.BadConfiguration.selector);
        new OmertaPositionDescriptorV2(IPoolManager(address(1)),address(0));
    }
    function testRejectsWrongManagerAndMissingPosition() public {
        OmertaPositionDescriptorV2 d=new OmertaPositionDescriptorV2(IPoolManager(address(1)),address(2));
        PositionDescriptorV2Fixture wrong=new PositionDescriptorV2Fixture(address(3));
        vm.expectRevert(OmertaPositionDescriptorV2.BadConfiguration.selector);
        d.tokenURI(IPositionManager(address(wrong)),1);
        PositionDescriptorV2Fixture right=new PositionDescriptorV2Fixture(address(1));
        vm.expectRevert(abi.encodeWithSelector(IPositionDescriptor.InvalidTokenId.selector,0));
        d.tokenURI(IPositionManager(address(right)),0);
    }
    function testMetadataAndRatioInterface() public {
        OmertaPositionDescriptorV2 d=new OmertaPositionDescriptorV2(IPoolManager(address(1)),address(2));
        PositionDescriptorV2Fixture positions=new PositionDescriptorV2Fixture(address(1));
        string memory uri=d.tokenURI(IPositionManager(address(positions)),1);
        assertGt(bytes(uri).length,100);
        assertEq(d.nativeCurrencyLabel(),"ETH");
        assertTrue(d.flipRatio(address(0),address(5)));
        assertTrue(d.flipRatio(address(2),address(5)));
        assertFalse(d.flipRatio(address(5),address(0)));
    }
}
