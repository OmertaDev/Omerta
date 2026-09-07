// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";

contract RwaHealthIdentityVectorsTest is Test {
    uint256 private constant CHAIN_ID = 4663;
    address private constant REGISTRY = 0x1111111111111111111111111111111111111111;
    address private constant TOKEN = 0x4444444444444444444444444444444444444444;
    bytes32 private constant SNAPSHOT = 0x2222222222222222222222222222222222222222222222222222222222222222;
    bytes32 private constant ASSET_KEY = 0x3333333333333333333333333333333333333333333333333333333333333333;
    bytes32 private constant PROVIDER_HASH = 0x5555555555555555555555555555555555555555555555555555555555555555;
    bytes32 private constant REASON_HASH = 0x6666666666666666666666666666666666666666666666666666666666666666;
    bytes32 private constant REVIEWER_EVIDENCE = 0x7777777777777777777777777777777777777777777777777777777777777777;

    function test_lowLevelFrozenVector() external pure {
        bytes32 rules = _ruleSetHash();
        bytes32 endpoint = keccak256(bytes("https://api.robinhood.com/rhj/assets"));
        bytes32 providerBody = keccak256(bytes('{"assets":[]}'));
        bytes32 identity = _expectedIdentity(PROVIDER_HASH);
        bytes32[] memory identities = new bytes32[](1);
        identities[0] = identity;
        bytes32 ordered = keccak256(abi.encode(identities));
        bytes32 activeSet = keccak256(abi.encode(_tag("OMERTA_RWA_HEALTH_ACTIVE_SET_V2"), uint16(1), ordered));
        bytes32 batch = keccak256(
            abi.encode(
                _tag("OMERTA_RWA_HEALTH_BATCH_V2"),
                CHAIN_ID,
                REGISTRY,
                uint256(7),
                SNAPSHOT,
                activeSet,
                uint256(123456),
                rules,
                endpoint,
                providerBody
            )
        );
        bytes32 page = keccak256(
            abi.encode(_tag("OMERTA_RWA_HEALTH_PAGE_V2"), batch, uint8(0), ASSET_KEY, ASSET_KEY, uint16(1))
        );
        bytes32 predicates = _allPassPredicates();
        bytes32 evidence = keccak256(
            abi.encode(
                _tag("OMERTA_RWA_HEALTH_EVIDENCE_V2"),
                batch,
                page,
                ASSET_KEY,
                identity,
                predicates,
                providerBody
            )
        );
        bytes32 evaluation = keccak256(
            abi.encode(
                _tag("OMERTA_RWA_HEALTH_EVALUATION_V2"),
                batch,
                page,
                ASSET_KEY,
                identity,
                predicates,
                uint8(0),
                evidence
            )
        );
        bytes32 episode = keccak256(
            abi.encode(_tag("OMERTA_RWA_HEALTH_EPISODE_V2"), CHAIN_ID, REGISTRY, ASSET_KEY, uint256(1))
        );
        bytes32 reviewer = keccak256(
            abi.encode(
                _tag("OMERTA_RWA_HEALTH_REVIEWER_ACTION_V2"),
                CHAIN_ID,
                REGISTRY,
                ASSET_KEY,
                uint256(1),
                keccak256(bytes("reviewer-main")),
                uint8(2),
                keccak256(bytes("reviewer_material_drift")),
                REASON_HASH,
                REVIEWER_EVIDENCE
            )
        );
        bytes32 eventId = keccak256(
            abi.encode(
                _tag("OMERTA_RWA_HEALTH_EPISODE_EVENT_V2"),
                episode,
                uint8(0),
                reviewer,
                uint8(2),
                REVIEWER_EVIDENCE
            )
        );

        assertEq(rules, 0xe573492c63c7d528d740eb1bc084c1a2b3a18f54ef80814e3c795c6033fd1a44);
        assertEq(endpoint, 0xd1616a50a719c165db656e87acb677b7c7b657b665298efd7637affc2a1f0940);
        assertEq(providerBody, 0x301bac8171566f7339d37f74456521447fb173cb2857e16fd36223f00b6bffb2);
        assertEq(identity, 0x31f93ef1d8559de405528c84466deb1a82c681b2c21739b8c2a0541de6abe7a1);
        assertEq(ordered, 0x283dd429c3373f0773f65309fc41aae31fb82510a8a9c52947ce11832097ce5b);
        assertEq(activeSet, 0x07947b4429f7b3178d5c7a09cd9138954cf14caea7000828c16041dc5659e950);
        assertEq(batch, 0x56f9229bea2e725ace8af6589d4199ff81efdd49fedab40818482fde05b0dbc7);
        assertEq(page, 0x021eaef8ce468814a91960655f408e12a2507193eb54aa341ca42c2165e1d777);
        assertEq(predicates, 0x57997db6fdedcea02ef32a0b2b63e2b4ee88f938c7ac39bfb17da1c6db5baa20);
        assertEq(evidence, 0x0512f05825571476353452d0d3e0d7fc3c4ca68db615fb626d9f5c5895d7bf5f);
        assertEq(evaluation, 0x197238d4ff6ea6f268ebdb14143ade4f2933612e88ae6c841cd07657b7aecb5c);
        assertEq(episode, 0xea515d89dd346a1aaee6d8b144dfc9eb58130136fe3eecef5267979afdcd4e8b);
        assertEq(reviewer, 0x079de776ced65165fc079b850c36f5c50f0bba2d72d4cce7f7030277d7b37055);
        assertEq(eventId, 0xf13bb7f31f1302bbc4beedfd18410f09d3738377d97347786070bfe7d3a2cc8a);
    }

    function test_endToEndHealthyFrozenVector() external pure {
        bytes memory body = bytes(
            '{"assets":[{"id":"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","tokenSymbol":"AAPL","deployments":[{"chainId":4663,"contractAddress":"0x4444444444444444444444444444444444444444"}],"status":"ASSET_STATUS_ACTIVE","tradingCapabilities":{"fractionalTradability":"tradable"},"tokenDecimals":18}]}'
        );
        bytes32 providerHash = keccak256(bytes("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"));
        bytes32 identity = _expectedIdentity(providerHash);
        bytes32[] memory identities = new bytes32[](1);
        identities[0] = identity;
        bytes32 ordered = keccak256(abi.encode(identities));
        bytes32 activeSet = keccak256(abi.encode(_tag("OMERTA_RWA_HEALTH_ACTIVE_SET_V2"), uint16(1), ordered));
        bytes32 providerBody = keccak256(body);
        bytes32 batch = keccak256(
            abi.encode(
                _tag("OMERTA_RWA_HEALTH_BATCH_V2"), CHAIN_ID, REGISTRY, uint256(7), SNAPSHOT, activeSet,
                uint256(123456), _ruleSetHash(), keccak256(bytes("https://api.robinhood.com/rhj/assets")), providerBody
            )
        );
        bytes32 page = keccak256(
            abi.encode(_tag("OMERTA_RWA_HEALTH_PAGE_V2"), batch, uint8(0), ASSET_KEY, ASSET_KEY, uint16(1))
        );
        bytes32 evidence = keccak256(
            abi.encode(_tag("OMERTA_RWA_HEALTH_EVIDENCE_V2"), batch, page, ASSET_KEY, identity, _allPassPredicates(), providerBody)
        );
        bytes32 evaluation = keccak256(
            abi.encode(_tag("OMERTA_RWA_HEALTH_EVALUATION_V2"), batch, page, ASSET_KEY, identity, _allPassPredicates(), uint8(0), evidence)
        );

        assertEq(providerHash, 0x6f236a709c03559aa775103b0b8d9b9b21f8d50cd309dd3cac8be02b210e3906);
        assertEq(providerBody, 0x3b5f77010541efb32b0d5240b89a4348f298675a75851cb98f8e5ed0297eb90c);
        assertEq(identity, 0xa0faba01855d519ec80cf3444ded76a9474ae749633c95d30e5279ba32d611c8);
        assertEq(ordered, 0x31341f566fb4a2e79dbf0ad133b22d07d1d3ebe849b6fa920c1780465ea7dd8e);
        assertEq(activeSet, 0x3b00dd34e55833c772669801a158d334953688d4de560da927c55f3e083e7beb);
        assertEq(batch, 0xed8e94f3aa0277a54173b26f3f5d8e341a2e375982c22216b5158e87611264ca);
        assertEq(page, 0x087b89ee0cca9923ad927406256be8ce01b7fe5b3bad9f521059fd93fcadc95a);
        assertEq(evidence, 0xe85d47d8586fe0a1272f0379818e1687b5175ab509f3099122ea7c3f10094a0f);
        assertEq(evaluation, 0x3a57071c40411ec64909c0661ac44cb43455e20851ba1aef9d707604c3f16f10);
    }

    function _expectedIdentity(bytes32 providerHash) private pure returns (bytes32) {
        return keccak256(
            abi.encode(
                _tag("OMERTA_RWA_HEALTH_EXPECTED_IDENTITY_V2"), CHAIN_ID, REGISTRY, ASSET_KEY,
                keccak256(bytes("AAPL")), TOKEN, uint8(18), providerHash, uint256(7), SNAPSHOT
            )
        );
    }

    function _ruleSetHash() private pure returns (bytes32) {
        return keccak256(
            abi.encode(
                _tag("RWA_HEALTH_RHJ_ASSET_IDENTITY_V2"),
                _tag("provider_record"), _tag("supported_chain"), _tag("ticker_identity"),
                _tag("token_identity"), _tag("token_decimals"), _tag("provider_active"),
                _tag("fractional_tradable"), uint8(0), uint8(1), uint8(2)
            )
        );
    }

    function _allPassPredicates() private pure returns (bytes32) {
        return keccak256(
            abi.encode(_tag("OMERTA_RWA_HEALTH_PREDICATES_V2"), uint8(0), uint8(0), uint8(0), uint8(0), uint8(0), uint8(0), uint8(0))
        );
    }

    function _tag(string memory value) private pure returns (bytes32) {
        return keccak256(bytes(value));
    }
}
