// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IOmertaMarketStateV2} from "../../src/market-v2/IOmertaMarketStateV2.sol";

contract GameTokenFixtureV2 is ERC20 {
    constructor() ERC20("Game fixture", "GAME") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

/// Explicit observation fixture; real NFT custody tests do not pretend this proves oracle production.
contract MarketGameFixtureV2 is IOmertaMarketStateV2 {
    Snapshot private _snapshot;
    bool public reverts;
    function set(Snapshot memory value) external { _snapshot = value; }
    function setReverts(bool value) external { reverts = value; }
    function snapshot() external view returns (Snapshot memory) {
        require(!reverts, "oracle unavailable");
        return _snapshot;
    }
}
