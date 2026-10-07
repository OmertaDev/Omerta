// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
contract GenesisCharacterMock is ERC721 {
    uint256 public nextId = 1;
    constructor() ERC721("Genesis Character", "CHAR") {}
    function mint(address to) external returns (uint256 id) { id = nextId++; _mint(to, id); }
}
