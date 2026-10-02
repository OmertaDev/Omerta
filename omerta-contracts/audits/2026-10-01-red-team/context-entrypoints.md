# Source declaration / entry-point inventory

All Solidity under src including interfaces/vendor. This lexical inventory does not imply behavioral review.


## omerta-contracts/src/AcquisitionAuthority.sol
- 11: contract AcquisitionAuthority is IAcquisitionAuthorityV2, EIP712, Ownable2Step, Pausable, ReentrancyGuard {
- 124: modifier finalizedState() {
- 129: function version() external pure returns (string memory) {
- 180: function _validatedLaunchSafe(address factory, bytes32 manifestHash, address safe) private pure returns (address) {
- 187: function authorityTopology() external view returns (address factory, bytes32 manifestHash, bool finalized) {
- 191: function authoritySnapshot()
- 258: function finalizeAuthority(bytes32 manifestHash) external {
- 286: function outflowNonce() external view returns (uint256) {
- 290: function pendingMainOperatorNomination() external view returns (PendingOperatorNomination memory) {
- 306: function pendingIngressProposal() external view returns (PendingIngressProposal memory) {
- 326: function getIngress(uint256 generation) external view returns (IngressRecord memory) {
- 350: function transferOwnership(address newOwner) public override finalizedState nonReentrant onlyOwner {
- 360: function acceptOwnership() public override finalizedState nonReentrant {
- 381: function renounceOwnership() public override finalizedState nonReentrant onlyOwner {
- 385: function nominateMainOperator(address nominee, bytes32 detailsHash)
- 414: function _emitOperatorProposalCreated(PendingOperatorNomination memory pending) private {
- 428: function _transitionOperator(address previous, address next, ReasonCode reason, bytes32 details) private {
- 444: function _emitProposalResult(
- 460: function cancelMainOperatorNomination(bytes32 proposalId, bytes32 detailsHash)
- 479: function expireMainOperatorNomination(bytes32 proposalId) external finalizedState nonReentrant {
- 494: function acceptMainOperatorNomination(bytes32 proposalId) external finalizedState nonReentrant {
- 503: function disableMainOperator(bytes32 detailsHash) external finalizedState nonReentrant onlyOwner {
- 522: function renounceMainOperator(bytes32 detailsHash) external finalizedState nonReentrant {
- 528: function replaceMainOperator(SuccessorConsent calldata consent, bytes calldata signature)
- 551: function invalidateOutflowNonce(uint256 newNextNonce, bytes32 detailsHash) external finalizedState nonReentrant {
- 571: function pause(bytes32 detailsHash) external finalizedState nonReentrant {
- 589: function unpause(bytes32 detailsHash) external finalizedState nonReentrant onlyOwner {
- 595: function hashOutflowAuthorization(OutflowAuthorization calldata authorization) public view returns (bytes32) {
- 613: function hashSuccessorConsent(SuccessorConsent calldata consent) public view returns (bytes32) {
- 631: function proposeIngress(IngressConfig calldata config, bytes32 detailsHash)
- 668: function _emitIngressProposalCreated(PendingIngressProposal memory pending) private {
- 684: function cancelIngressProposal(bytes32 proposalId, bytes32 detailsHash)
- 703: function expireIngressProposal(bytes32 proposalId) external finalizedState nonReentrant {
- 718: function activateIngress(bytes32 proposalId)
- 753: function _emitIngressActivated(uint256 generation, PendingIngressProposal memory pending, uint64 activatedAt)
- 771: function disableIngress(bytes32 detailsHash) external finalizedState nonReentrant onlyOwner {
- 793: function _initial(bool condition, uint8 field) private pure {
- 804: function _requireDetails(bytes32 detailsHash) private pure {
- 808: function _requireProposalTimestampRoom() private view {
- 814: function _checkedTimestamp() private view returns (uint64) {
- 819: function _nextGeneration() private view returns (uint256) {
- 824: function _requireDirectOperator() private view returns (address operator) {
- 830: function _requirePending(bytes32 proposalId) private view returns (PendingOperatorNomination memory pending) {
- 836: function _requirePendingIngress(bytes32 proposalId) private view returns (PendingIngressProposal memory pending) {
- 842: function _checkOwnerCandidate(address candidate, bool ignorePendingOwner) private view {
- 847: function _checkOperatorCandidate(address candidate, bool ignorePendingNominee) private view {
- 852: function _roleCollision(address candidate, uint8 ignored) private view returns (bool) {
- 860: function _constellationCollision(address candidate) private view returns (bool) {
- 865: function _activeIngressAddress() private view returns (address) {
- 869: function _validateIngressConfig(IngressConfig memory config, bool ignorePendingIngress) private view {
- 885: function _readCoreGlobalLifetimeCap() private view returns (uint256 cap) {
- 902: function _ingressConfigHash(IngressConfig memory config) private view returns (bytes32) {
- 912: function _ingressRecordConfigHash(IngressRecord memory record) private view returns (bytes32) {
- 923: function _configHash(address ingress, bytes32 runtimeHash, uint256 perCap, uint256 epochCap, uint256 lifetimeCap)
- 945: function _operatorStateHash(PendingOperatorNomination memory pending) private pure returns (bytes32 result) {
- 949: function _ownershipCancellationDetails(PendingOperatorNomination memory pending, address previous, address next)
- 971: function _operatorExpiryDetails(PendingOperatorNomination memory pending) private view returns (bytes32 result) {
- 988: function _ingressExpiryDetails(PendingIngressProposal memory pending) private view returns (bytes32 result) {
- 1006: function _operatorProposalId(PendingOperatorNomination memory pending) private view returns (bytes32 result) {
- 1029: function _ingressStateHash(PendingIngressProposal memory pending) private pure returns (bytes32 result) {
- 1050: function _ingressProposalId(PendingIngressProposal memory pending) private view returns (bytes32 result) {
- 1078: function _validateWindow(uint64 issuedAt, uint64 deadline) private view {
- 1086: function _validateSignature(address signer, bytes32 digest, bytes calldata signature) private view {
- 1137: function _predict(address deployer, uint8 nonce) private pure returns (address) {

## omerta-contracts/src/AcquisitionConstellationFactory.sol
- 4: contract AcquisitionConstellationFactory {
- 151: function factoryState()
- 179: function childCommitment(uint8 index)
- 188: function deployNext(bytes calldata initcode) external returns (address child) {
- 225: function finalizeConstellation() external {
- 254: function _checkAuthoritySnapshot() private view {
- 295: function _checkCoreSnapshot() private view {
- 325: function _coreSnapshotEq(uint256 actual, uint256 expected, uint8 field) private pure {
- 329: function _coreSnapshotAddress(uint256 word, address expected, uint8 field) private pure {
- 335: function _coreSnapshotBool(uint256 word, bool expected, uint8 field) private pure {
- 339: function _snapshotEq(uint256 actual, uint256 expected, uint8 field) private pure {
- 343: function _snapshotAddress(uint256 word, address expected, uint8 field) private pure {
- 349: function _snapshotBool(uint256 word, bool expected, uint8 field) private pure {
- 353: function _emptyOperatorStateHash() private pure returns (bytes32) {
- 359: function _emptyIngressStateHash() private pure returns (bytes32) {
- 379: function _checkDeployedChild(uint8 index, bool finalized) private view {
- 392: function _checkRegistry(address registry, bool checkCode) private view {
- 409: function _checkTopology(uint8 index, bool expectedFinalized, bool afterFinalizer) private view {
- 437: function _finalize(uint8 index) private {
- 444: function _callFinalizer(uint8 index, address child, bytes memory input) internal returns (uint256 afterGas) {
- 461: function _requireChildAddress(uint8 index, address expected, address actual) internal pure {
- 465: function _requireRuntimeSize(uint8 index, uint256 actual) internal pure {
- 469: function _topologySelector(uint8 index) private pure returns (bytes4) {
- 477: function _finalizerSelector(uint8 index) private pure returns (bytes4) {
- 485: function _predictCreateAddress(address deployer, uint8 nonce) private pure returns (address) {
- 489: function _hasFinalizerPrecheckGas(uint256 available) internal pure returns (bool) {
- 493: function _hasFinalizerPostcheckGas(uint256 available) internal pure returns (bool) {
- 497: function _requireFinalizerPrecheck(uint8 index, uint256 available) internal pure {
- 503: function _requireFinalizerPostcheck(uint8 index, uint256 available) internal pure {

## omerta-contracts/src/AcquisitionIntentExecution.sol
- 4: contract AcquisitionIntentExecution {
- 39: function intentExecutionTopology() external view returns (address factory, bytes32 manifestHash, bool finalized) {
- 43: function finalizeIntentExecution(bytes32 manifestHash) external {
- 51: function deriveIntentId(uint256 ballotDay, bytes32 assetVersionKey) external view returns (bytes32 intentId) {
- 55: function deriveAttemptId(
- 79: function _predictCreateAddress(address deployer, uint8 nonce) private pure returns (address) {

## omerta-contracts/src/AcquisitionReconciliation.sol
- 4: contract AcquisitionReconciliation {
- 22: function reconciliationTopology() external view returns (address factory, bytes32 manifestHash, bool finalized) {
- 26: function finalizeReconciliation(bytes32 manifestHash) external {

## omerta-contracts/src/AcquisitionVault.sol
- 13: contract AcquisitionVault is IAcquisitionVaultV1, EIP712, Ownable2Step, Pausable, ReentrancyGuard {
- 120: function pendingMainOperatorNomination() external view returns (PendingOperatorNomination memory) {
- 124: function pendingIngressProposal() external view returns (PendingIngressProposal memory) {
- 128: function getIngress(uint256 generation) external view returns (IngressRecord memory record) {
- 133: function getDeposit(bytes32 depositId) external view returns (DepositRecord memory record) {
- 138: function transferOwnership(address newOwner) public override onlyOwner {
- 148: function acceptOwnership() public override {
- 165: function renounceOwnership() public override onlyOwner {
- 169: function nominateMainOperator(address nominee, bytes32 detailsHash)
- 219: function cancelMainOperatorNomination(bytes32 proposalId, bytes32 detailsHash) external onlyOwner {
- 228: function expireMainOperatorNomination(bytes32 proposalId) external {
- 238: function acceptMainOperatorNomination(bytes32 proposalId) external {
- 253: function disableMainOperator(bytes32 detailsHash) external onlyOwner {
- 272: function renounceMainOperator(bytes32 detailsHash) external {
- 284: function replaceMainOperator(SuccessorConsent calldata consent, bytes calldata signature) external nonReentrant {
- 308: function invalidateOutflowNonce(uint256 newNextNonce, bytes32 detailsHash) external {
- 325: function pause(bytes32 detailsHash) external {
- 333: function unpause(bytes32 detailsHash) external onlyOwner {
- 343: function hashOutflowAuthorization(OutflowAuthorization calldata a) public view returns (bytes32) {
- 362: function hashSuccessorConsent(SuccessorConsent calldata c) public view returns (bytes32) {
- 380: function accountingTotals() public view returns (AccountingTotals memory totals) {
- 384: function syncBalance() external returns (bytes32 mutationId) {
- 426: function reclassifyUnattributed(uint256 amountWei, bytes32 detailsHash)
- 469: function proposeIngress(IngressConfig calldata config, bytes32 detailsHash)
- 516: function _emitIngressProposalCreated(PendingIngressProposal storage pending) private {
- 531: function cancelIngressProposal(bytes32 proposalId, bytes32 detailsHash) external onlyOwner {
- 542: function expireIngressProposal(bytes32 proposalId) external {
- 554: function activateIngress(bytes32 proposalId) external onlyOwner whenPaused returns (uint256 generation) {
- 596: function disableIngress(bytes32 detailsHash) external onlyOwner {
- 610: function depositCanonical(bytes32 sourceEventId) external payable returns (bytes32 depositId) {
- 676: function _emitCanonicalDepositEvidence(
- 730: function _checkOwnerCandidate(address candidate) private view {
- 739: function _checkOperatorCandidate(address candidate, bool ignorePendingNominee) private view {
- 744: function _operatorCollision(address candidate, bool ignorePendingNominee) private view returns (bool) {
- 751: function _requirePending(bytes32 proposalId) private view returns (PendingOperatorNomination memory p) {
- 757: function _requirePendingIngress(bytes32 proposalId) private view returns (PendingIngressProposal storage p) {
- 763: function _validateIngressConfig(IngressConfig memory config, bool ignorePendingIngress) private view {
- 777: function _requireHealthyIngress(address ingress, bytes32 expectedCodeHash, bool ignoreActiveIngress) private view {
- 782: function _requireIngressCodeHash(address ingress, bytes32 expectedCodeHash) private view {
- 790: function _ingressRoleCollision(address candidate, bool ignorePendingIngress, bool ignoreActiveIngress)
- 802: function _activeIngressAddress() private view returns (address) {
- 806: function _ingressConfigHash(IngressConfig memory config) private pure returns (bytes32) {
- 819: function _checkedTimestamp(uint256 timestamp) internal pure returns (uint64) {
- 824: function _checkedDepositTotal(DepositCapKind kind, uint256 capWei, uint256 priorWei, uint256 amountWei)
- 836: function _accountingTotalsAtBalance(uint256 actual) private view returns (AccountingTotals memory totals) {
- 856: function _requireDirectOperator() private view returns (address operator) {
- 862: function _nextGeneration() private view returns (uint256) {
- 867: function _nextAccountingSequence() private view returns (uint256) {
- 872: function _accountingMutationId(uint256 sequence, AccountingMutationKind kind, bytes32 subjectId)
- 882: function _emitAccountingComponent(
- 905: function _requireDetails(bytes32 detailsHash) private pure {
- 909: function _validateWindow(uint64 issuedAt, uint64 deadline) private view {
- 917: function _validateSignature(address signer, bytes32 digest, bytes calldata signature) private view {
- 942: function _requireErc1271PrecallGas(uint256 observedGas) internal pure {
- 946: function _requireErc1271PostcallGas(uint256 observedGas) internal pure {
- 950: function _localReadinessSatisfied() private view returns (bool) {

## omerta-contracts/src/AcquisitionVaultCore.sol
- 5: contract AcquisitionVaultCore is ReentrancyGuard {
- 157: modifier finalizedState() {
- 201: function stockTokenRegistryV2() external view returns (address) {
- 205: function globalLifetimeCanonicalDepositCapWei() external view returns (uint256) {
- 209: function accountingTotals() external view returns (AccountingTotals memory totals) {
- 213: function getDeposit(bytes32 depositId) external view returns (DepositRecord memory record) {
- 218: function syncBalance() external finalizedState nonReentrant returns (bytes32 mutationId) {
- 234: function reclassifyUnattributed(uint256 amountWei, bytes32 detailsHash)
- 259: function depositCanonical(bytes32 sourceEventId)
- 346: function coreTopology() external view returns (address factory, bytes32 manifestHash, bool finalized) {
- 350: function coreSnapshot()
- 378: function _coreSnapshotWords() private view returns (uint256[18] memory w) {
- 399: function finalizeCore(bytes32 manifestHash) external {
- 415: function _totals(uint256 v) private view returns (AccountingTotals memory t) {
- 429: function _next() private returns (uint256 n) {
- 435: function _mid(uint256 g, uint256 s, uint8 k, bytes32 subject) private view returns (bytes32) {
- 439: function _component(uint256 g, uint256 s, bytes32 m, uint256 i, uint8 k, bytes32 subject, uint256 amount) private {
- 444: function _cap(uint8 k, uint256 cap, uint256 prior, uint256 amount) private pure {
- 448: function _snapshot() private view returns (AuthoritySnapshot memory s) {
- 498: function _ingress(uint256 g, address active, bytes32 cfg) private view returns (IngressRecord memory r) {
- 527: function _clean(uint256 w, uint8 f) private pure {
- 531: function _collision(address c, AuthoritySnapshot memory s) private view {
- 539: function _predict(address d, uint8 n) private pure returns (address) {

## omerta-contracts/src/Alchemist.sol
- 43: contract Alchemist is Ownable2Step, ReentrancyGuard, FlashGuard {
- 173: function setLtvBps(uint16 bps) external onlyOwner {
- 200: function _assertLtvFeeCompatible(uint16 ltv, uint16 fee) internal pure {
- 206: function setHarvestFee(uint16 bps, address recipient) external onlyOwner {
- 226: function sweepFees() external nonReentrant {
- 236: function setMintCaps(uint256 perBlock, uint256 perDay) external onlyOwner {
- 242: function setAllowedContract(address who, bool allowed) external onlyOwner {
- 249: function collateralOf(address user) public view returns (uint256) {
- 256: function maxDebtOf(address user) public view returns (uint256) {
- 266: function deposit(uint256 assets, uint256 minSharesOut) external nonReentrant onlyAllowedCaller {
- 291: function withdraw(uint256 assets) external nonReentrant onlyAllowedCaller notSameBlockAsEntry(msg.sender) {
- 310: function mint(uint256 debtAmount) external nonReentrant onlyAllowedCaller notSameBlockAsEntry(msg.sender) {
- 343: function repay(uint256 assets) external nonReentrant {
- 371: function harvest(address user) external nonReentrant {

## omerta-contracts/src/BankBufferVault.sol
- 21: contract BankBufferVault is Ownable2Step, Pausable, ReentrancyGuard {
- 61: function fundingAmount() public view returns (uint256 amount) {
- 73: function fundDeficit() external nonReentrant whenNotPaused returns (uint256 amount) {
- 95: function pause() external onlyOwner { _pause(); }
- 96: function unpause() external onlyOwner { _unpause(); }
- 99: function recover(uint256 amount) external onlyOwner whenPaused nonReentrant {
- 109: function _checkDependencies() private view {

## omerta-contracts/src/CollateralEscrow.sol
- 40: contract CollateralEscrow {
- 55: modifier onlyController() {
- 71: function deployToVault(uint256 assets) external onlyController returns (uint256 shares) {
- 81: function withdraw(uint256 assets, address to) external onlyController {
- 87: function withdrawAll(address to) external onlyController returns (uint256 assets) {
- 99: function totalAssets() external view returns (uint256) {

## omerta-contracts/src/Denari.sol
- 44: contract Denari is ERC20, ERC20Permit, Ownable2Step {
- 63: function setMinter(address m) external onlyOwner {
- 72: function setBurner(address b) external onlyOwner {
- 77: function mint(address to, uint256 amount) external {
- 86: function burn(address from, uint256 amount) external {

## omerta-contracts/src/DynastyNFT.sol
- 49: contract DynastyNFT is ERC721, ERC2981, EIP712, Ownable2Step, Pausable, ReentrancyGuard {
- 104: function setSigner(address s) external onlyOwner {
- 110: function setDailyMintCap(uint256 cap) external onlyOwner {
- 115: function setBaseUri(string calldata base_) external onlyOwner {
- 122: function setDefaultRoyalty(address recipient, uint96 bps) external onlyOwner {
- 129: function pause() external onlyOwner {
- 133: function unpause() external onlyOwner {
- 138: function hashVoucher(MintVoucher calldata v) public view returns (bytes32) {
- 146: function claim(MintVoucher calldata v, bytes calldata sig) external nonReentrant whenNotPaused returns (uint256) {
- 166: function tokenURI(uint256 id) public view override returns (string memory) {
- 172: function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC2981) returns (bool) {

## omerta-contracts/src/FeeRevenueRouter.sol
- 9: interface IFeeRevenueRouter {
- 10: function policyId() external view returns (bytes32);
- 11: function feeContract() external view returns (address);
- 12: function devRecipient() external view returns (address payable);
- 13: function vigRecipient() external view returns (address payable);
- 14: function treasuryRecipient() external view returns (address payable);
- 15: function communityRecipient() external view returns (address payable);
- 16: function devBps() external view returns (uint256);
- 17: function vigBps() external view returns (uint256);
- 18: function treasuryBps() external view returns (uint256);
- 19: function communityBps() external view returns (uint256);
- 20: function route(uint256 nonce) external payable;
- 28: contract FeeRevenueRouter is IFeeRevenueRouter, ReentrancyGuard {
- 72: function route(uint256 nonce) external payable nonReentrant {
- 91: function recoverForcedETH() external nonReentrant {
- 98: function _checkRecipient(address recipient, address rail) private view {
- 102: function _send(address payable recipient, uint256 amount) private {

## omerta-contracts/src/FlashGuard.sol
- 52: abstract contract FlashGuard {
- 64: function _recordEntry(address account) internal {
- 75: modifier notSameBlockAsEntry(address account) {
- 81: function lastEntryBlock(address account) external view returns (uint256) {
- 101: function _meter(Flow storage f, uint256 amount, uint256 perBlockCap, uint256 perDayCap) internal {
- 139: modifier onlyAllowedCaller() {

## omerta-contracts/src/GearVault.sol
- 24: contract GearVault is ERC1155, Ownable2Step {
- 68: function setMinter(address m) external onlyOwner {
- 80: function setGearCap(uint256 tokenId, uint256 c) external onlyOwner {
- 91: function setImageBase(string calldata base_) external onlyOwner {
- 99: function setClassName(uint256 classKey, string calldata name_) external onlyOwner {
- 105: function setClassNames(uint256[] calldata classKeys, string[] calldata names) external onlyOwner {
- 113: function mint(address to, uint256 tokenId, uint256 amount) external {
- 142: function redeem(uint256 tokenId, uint256 amount) external {
- 160: function _isCar(uint256 id) internal pure returns (bool) {
- 164: function _isBoat(uint256 id) internal pure returns (bool) {
- 169: function _classKey(uint256 id) internal pure returns (uint256) {
- 176: function _classIdx(uint256 id) internal pure returns (uint256) {
- 183: function _rarityIdx(uint256 id) internal pure returns (uint256) {
- 189: function _typeName(uint256 id) internal pure returns (string memory) {
- 197: function _rarityName(uint256 i) internal pure returns (string memory) {
- 205: function _displayName(uint256 id) internal view returns (string memory) {
- 213: function uri(uint256 id) public view override returns (string memory) {

## omerta-contracts/src/GenesisLifecycleController.sol
- 24: interface IGenesisAuction {
- 25: function token() external view returns (address);
- 26: function currency() external view returns (address);
- 27: function fundsRecipient() external view returns (address);
- 28: function tokensRecipient() external view returns (address);
- 29: function startBlock() external view returns (uint64);
- 30: function endBlock() external view returns (uint64);
- 31: function sweepUnsoldTokensBlock() external view returns (uint256);
- 32: function checkpoint() external;
- 33: function sweepUnsoldTokens() external;
- 35: interface IGenesisStrategy {
- 36: function registeredPoolIds(bytes32 pool) external view returns (address);
- 37: function initializers(address auction) external view returns (GenesisMigratorParameters memory);
- 38: function migrate(address auction) external;
- 40: interface IGenesisFoundation {
- 41: function omr() external view returns (address);
- 42: function poolId() external view returns (bytes32);
- 43: function poolManager() external view returns (address);
- 44: function oracle() external view returns (address);
- 45: function positionId() external view returns (uint256);
- 46: function genesisController() external view returns (address);
- 47: function adoptGenesisFoundation(uint256 id) external;
- 48: function healthy() external view returns (bool);
- 49: function activationTimestamp() external view returns (uint256);
- 50: function warmup() external view returns (uint256);
- 51: function emergencyLatched() external view returns (bool);
- 53: interface IGenesisArbSys { function arbBlockNumber() external view returns (uint256); }
- 59: contract GenesisLifecycleController is Ownable2Step, ReentrancyGuard {
- 119: function bindAuction(IGenesisAuction a) external onlyOwner {
- 140: function setStopped(bool value) external onlyOwner { stopped = value; emit Stopped(value); }
- 143: function renounceOwnership() public view override onlyOwner { revert InvalidConfiguration(); }
- 145: function currentBlock() external view returns (uint256) { return _clock(); }
- 146: function _clock() private view returns (uint256) {
- 155: function _valid() private view returns (bool) {
- 163: function phase() public view returns (Phase) {
- 177: function checkpoint() external nonReentrant {
- 182: function migrate() external nonReentrant {
- 193: function acceptFoundation(uint256 positionId_) external nonReentrant {
- 201: function sweepUnsoldTokens() external nonReentrant {
- 209: function distributeResidual() external nonReentrant {
- 219: function _requireRunning() private view {

## omerta-contracts/src/GenesisOracle.sol
- 49: contract GenesisOracle is IOmrOracle, Ownable2Step {
- 79: function setPrice(uint256 price_, uint256 validUntil_) external onlyOwner {
- 87: function consult() external view returns (uint256 omrPerEth, uint256 updatedAt) {

## omerta-contracts/src/GenesisPlayerSale.sol
- 10: interface IGenesisPlayerIntegration {
- 12: function playerPriceX96() external view returns (uint256);
- 14: function playerClaimsOpen() external view returns (bool);
- 15: function playerMigrationSucceeded() external view returns (bool);
- 17: function finalizePlayerProceeds() external payable;
- 23: contract GenesisPlayerSale is ReentrancyGuard {
- 74: function cap(uint8 daysPlayed) public pure returns (uint256) {
- 83: function leaf(address wallet, uint8 daysPlayed) public view returns (bytes32) {
- 86: function open() external nonReentrant {
- 95: function contribute(uint8 daysPlayed, bytes32[] calldata proof) external payable nonReentrant {
- 104: function settle(address wallet) external {
- 116: function releaseProceeds() external nonReentrant {
- 126: function cancel() external {
- 130: function refund() external nonReentrant {
- 138: function claim() external nonReentrant {
- 145: function recoverUnsold() external nonReentrant {

## omerta-contracts/src/GenesisProceedsSplitter.sol
- 28: contract GenesisProceedsSplitter is ReentrancyGuard {
- 74: function canonicalPoolInitialized() public view returns (bool) {
- 80: function distributeResidual() external nonReentrant {
- 98: function recoverFailedLaunch() external nonReentrant {
- 108: function recoverToken(IERC20 token) external nonReentrant {
- 116: function _send(address payable recipient, uint256 amount) private {

## omerta-contracts/src/GenesisWalletCap.sol
- 4: interface IGenesisCapController {
- 5: function auction() external view returns (address);
- 6: function auctionCodeHash() external view returns (bytes32);
- 10: interface IGenesisBidValidation {
- 11: function validate(uint256 maxPrice, uint128 amount, address owner, address sender, bytes calldata hookData) external;
- 19: contract GenesisWalletCap is IGenesisBidValidation {
- 39: function validate(uint256, uint128 amount, address owner, address sender, bytes calldata) external {
- 57: function remainingCommitment(address wallet) external view returns (uint256) {
- 61: function supportsInterface(bytes4 interfaceId) external pure returns (bool) {

## omerta-contracts/src/IOmrOracle.sol
- 18: interface IOmrOracle {
- 21: function consult() external view returns (uint256 omrPerEth, uint256 updatedAt);

## omerta-contracts/src/KeeperGasVault.sol
- 14: contract KeeperGasVault is Ownable2Step, Pausable, ReentrancyGuard {
- 52: function setKeeperAllowed(address keeper, bool allowed) external onlyOwner {
- 60: function refillAmount(address keeper) public view returns (uint256 amount) {
- 71: function topUp(address payable keeper) external nonReentrant whenNotPaused returns (uint256 amount) {
- 85: function pause() external onlyOwner { _pause(); }
- 86: function unpause() external onlyOwner { _unpause(); }
- 89: function recover(uint256 amount) external onlyOwner whenPaused nonReentrant {

## omerta-contracts/src/LiquidityBuybackExecutor.sol
- 27: contract LiquidityBuybackExecutor is Ownable2Step, Pausable, ReentrancyGuard, IUnlockCallback {
- 110: function deposit() external payable { emit Deposit(msg.sender, msg.value); }
- 111: function destination() external view returns (address) { return primaryRecipient; }
- 112: function poolKey() external view returns (PoolKey memory) { return _poolKey; }
- 113: function setKeeper(address account, bool allowed) external onlyOwner {
- 118: function pause() external onlyOwner { _pause(); }
- 119: function unpause() external onlyOwner { _unpause(); }
- 121: function quoteFloor(uint256 amount) public view returns (uint256 floor) {
- 132: function execute(uint256 amount, uint256 minOut, uint256 deadline)
- 162: function distributeTokenRevenue() external nonReentrant whenNotPaused returns (uint256 amount) {
- 172: function unlockCallback(bytes calldata data) external returns (bytes memory) {
- 187: function _deliver(address recipient, uint256 amount) private {
- 194: function _distribute(uint256 amount) private returns (uint256 primary, uint256 secondary) {
- 203: function recover(IERC20 token, uint256 amount) external onlyOwner whenPaused nonReentrant {

## omerta-contracts/src/OmertaBond.sol
- 16: interface IOMRMintable {
- 17: function mint(address to, uint256 amount) external;
- 74: contract OmertaBond is EIP712, Ownable2Step, Pausable, ReentrancyGuard {
- 87: function setLiquidityHealthGuard(ILiquidityHealth guard) external onlyOwner {
- 96: function setEmergencyGuardian(address guardian) external onlyOwner {
- 102: function emergencyPause() external {
- 107: function liquidityHealthy() public view returns (bool) {
- 287: function setDailyCap(uint256 cap) external onlyOwner {
- 295: function setMaxRate(uint256 maxOmrPerEth_) external onlyOwner {
- 305: function setOracle(IOmrOracle o, uint256 toleranceBps, uint256 maxAge) external onlyOwner {
- 319: function priceCeiling() public view returns (uint256 ceiling, uint256 oraclePrice) {
- 327: function _oraclePrice() private view returns (uint256) {
- 342: function hashQuote(BondQuote calldata q) public view returns (bytes32) {
- 362: function bond(BondQuote calldata q, bytes calldata sig)
- 453: function claim(uint256 bondId) external nonReentrant returns (uint256 amount) {
- 465: function _vested(Bond storage b) private view returns (uint256) {
- 472: function claimable(uint256 bondId) external view returns (uint256) {
- 478: function setSigner(address s) external onlyOwner {
- 484: function setRecipients(address payable pol, address payable dev, address payable rwa, address payable vig)
- 499: function pause() external onlyOwner {
- 503: function unpause() external onlyOwner {
- 510: function sweep(address to, uint256 amount) external onlyOwner {
- 520: function sweepETH() external onlyOwner nonReentrant {

## omerta-contracts/src/OmertaFees.sol
- 21: contract OmertaFees is Ownable2Step, ReentrancyGuard {
- 107: function payMintFee() external payable nonReentrant {
- 115: function payRespawnFee() external payable nonReentrant {
- 123: function payRerollFee() external payable nonReentrant {
- 132: function payForPackage(uint256 sku) external payable nonReentrant {
- 146: function _forward(uint256 n, uint256 amount, uint256 paymentVigBps) private {
- 164: function setNonMintRouter(IFeeRevenueRouter router) external onlyOwner nonReentrant {
- 170: function _forwardNonMint(uint256 n, uint256 amount) private {
- 181: function _validateRouter(IFeeRevenueRouter router) private view {
- 192: function setFeeRecipient(address payable recipient) external onlyOwner {
- 200: function setVigRecipient(address payable recipient) external onlyOwner {
- 207: function setFees(uint256 mintFee_, uint256 respawnFee_) external onlyOwner {
- 215: function setRerollFee(uint256 rerollFee_) external onlyOwner {
- 223: function setPackagePrice(uint256 sku, uint256 price) external onlyOwner {
- 232: function sweep() external onlyOwner nonReentrant {

## omerta-contracts/src/OmertaHook.sol
- 24: interface IOmrHookObserver {
- 28: function observe(PoolKey calldata key) external;
- 118: contract OmertaHook is IHooks, IInitializerHook, IOmrV4ObservationSource, Ownable2Step {
- 275: modifier onlyPoolManager() {
- 295: function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
- 305: function setSellTax(uint256 bps, uint256 devBps, uint256 rwaBps, uint256 communityBps) external onlyOwner {
- 324: function setRecipients(address dev, address rwa, address community, address lp) external onlyOwner {
- 342: function setAllowedQuote(Currency currency, bool allowed) external onlyOwner {
- 347: function setObserver(IOmrHookObserver observer_) external onlyOwner {
- 355: function setAntiSnipe(uint256 blocks_, uint256 buyBps, uint256 maxBuy) external onlyOwner {
- 379: function setSurge(uint256 maxBps, uint256 fullBps) external onlyOwner {
- 408: function sweep(Currency currency) external {
- 439: function beforeInitialize(address sender, PoolKey calldata key, uint160)
- 454: function afterInitialize(address, PoolKey calldata key, uint160, int24 tick)
- 483: function beforeSwap(address, PoolKey calldata key, SwapParams calldata params, bytes calldata)
- 505: function _guardOpening(PoolKey calldata key, SwapParams calldata params) private view {
- 532: function afterSwap(
- 555: function currentTickCumulative(PoolId id)
- 575: function _writeTickAccumulator(PoolId id) private returns (uint160 sqrtPriceX96) {
- 594: function _fee(PoolKey calldata key, SwapParams calldata params, BalanceDelta delta, uint160 postSqrtPriceX96)
- 635: function _sellRate(uint160 postSqrtPriceX96) private view returns (uint256) {
- 661: function _openingBuyRate(PoolKey calldata key) private view returns (uint256) {
- 678: function _accrue(address sender, PoolKey calldata key, Currency feeCurrency, uint256 total) private {
- 704: function pokeObserver(PoolKey calldata key) external {
- 718: function beforeAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
- 726: function afterAddLiquidity(
- 737: function beforeRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
- 745: function afterRemoveLiquidity(
- 756: function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external pure returns (bytes4) {
- 760: function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external pure returns (bytes4) {

## omerta-contracts/src/OMR.sol
- 76: contract OMR is ERC20Permit, Ownable2Step {
- 125: function setMinter(address m) external onlyOwner {
- 135: function mint(address to, uint256 amount) external {
- 146: function setSellTax(uint256 bps, uint256 devBps, uint256 rwaBps, uint256 communityBps) external onlyOwner {
- 163: function setTaxRecipients(address dev, address rwa, address community, address lp) external onlyOwner {
- 175: function setPair(address pair, bool isPair) external onlyOwner {
- 182: function setExempt(address account, bool exempt) external onlyOwner {
- 188: function _update(address from, address to, uint256 value) internal override {

## omerta-contracts/src/OMRStaking.sol
- 15: contract OMRStaking is Ownable2Step, ReentrancyGuard {
- 49: function setApy(uint256 bps) external onlyOwner {
- 60: function fundRewards(uint256 amount) external {
- 66: function _updateRewardIndex() internal {
- 74: function _accrue(address user) internal {
- 84: function stake(uint256 amount) external nonReentrant {
- 93: function unstake(uint256 amount) external nonReentrant {
- 103: function claimRewards() external nonReentrant {
- 115: function pendingRewards(address user) external view returns (uint256) {

## omerta-contracts/src/OmrTwapOracle.sol
- 9: interface IUniswapV2Factory {
- 10: function getPair(address tokenA, address tokenB) external view returns (address pair);
- 13: interface IUniswapV2Pair {
- 14: function token0() external view returns (address);
- 15: function token1() external view returns (address);
- 16: function price0CumulativeLast() external view returns (uint256);
- 17: function price1CumulativeLast() external view returns (uint256);
- 18: function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
- 49: contract OmrTwapOracle is IOmrOracle, Ownable2Step {
- 138: function update() external {
- 185: function consult() external view returns (uint256 omrPerEth, uint256 updatedAt) {
- 194: function _decode(uint224 avg) private pure returns (uint256) {
- 203: function _currentCumulativePrices()

## omerta-contracts/src/OmrV4TwapOracle.sol
- 44: contract OmrV4TwapOracle is IOmrOracle, IOmrHookObserver {
- 127: function update() external {
- 135: function observe(PoolKey calldata key) external {
- 142: function consult() external view returns (uint256 omrPerEth, uint256 updatedAt) {
- 146: function _update(bool revertIfEarly) private {
- 204: function _setBaseline(int56 cumulative, uint32 timestamp) private {
- 215: function _omrPerEthAtTick(int24 tick) private pure returns (uint256) {

## omerta-contracts/src/PreVoteBudgetBook.sol
- 4: contract PreVoteBudgetBook {
- 104: function budgetBookTopology() external view returns (address factory, bytes32 manifestHash, bool finalized) {
- 108: function finalizeBudgetBook(bytes32 manifestHash) external {
- 116: function authorizePreVoteBudget(PreVoteBudgetInput calldata input, bytes32 detailsHash)
- 161: function getPreVoteBudget(uint256 ballotDay)
- 170: function _authorityState() private view returns (address safe, bool paused) {
- 222: function _accounting() private view returns (BudgetAccounting memory totals) {
- 253: function _deadline(uint256 ballotDay) private pure returns (uint64 expected) {
- 262: function _commit(PreVoteBudgetAuthorization memory a) private {
- 277: function _clean(uint256 word, uint8 field) private pure {
- 281: function _predict(address deployer, uint8 nonce) private pure returns (address) {

## omerta-contracts/src/ProtocolLiquidityVault.sol
- 26: interface IProtocolPositionManager is IPositionManager {
- 27: function permit2() external view returns (IAllowanceTransfer);
- 28: function ownerOf(uint256 tokenId) external view returns (address);
- 29: function safeTransferFrom(address from, address to, uint256 tokenId) external;
- 32: interface IProtocolInventoryExecutor {
- 33: function omr() external view returns (address);
- 34: function poolManager() external view returns (address);
- 35: function poolId() external view returns (bytes32);
- 36: function destination() external view returns (address);
- 37: function secondaryRecipient() external view returns (address);
- 38: function oracle() external view returns (address);
- 39: function healthGuard() external view returns (address);
- 40: function stream() external view returns (uint8);
- 41: function deposit() external payable;
- 44: interface IProtocolGenesisController {
- 45: function foundation() external view returns (address);
- 46: function omr() external view returns (address);
- 47: function poolId() external view returns (bytes32);
- 58: contract ProtocolLiquidityVault is Ownable2Step, ReentrancyGuard, IERC721Receiver {
- 244: modifier onlyKeeper() {
- 249: function poolKey() external view returns (PoolKey memory) { return _key; }
- 253: function healthy() external view returns (bool) {
- 257: function currentLiquidity() public view returns (uint128) {
- 263: function _healthy() private view returns (bool) {
- 268: function _dependenciesValid() private view returns (bool) {
- 275: function _foundationValid(uint256 id) private view returns (bool) {
- 292: function _live() private view {
- 298: function _deadline(uint256 deadline) private view {
- 304: function mintFoundation(uint128 nativeMax, uint128 omrMax, uint128 minLiquidityAdded, uint256 deadline)
- 316: function adoptFoundation(uint256 id) external onlyOwner nonReentrant {
- 325: function setGenesisController(address controller) external onlyOwner nonReentrant {
- 339: function adoptGenesisFoundation(uint256 id) external nonReentrant {
- 348: function onERC721Received(address operator, address from, uint256 id, bytes calldata)
- 358: function _acceptFoundation(uint256 id) private {
- 365: function increase(uint128 nativeMax, uint128 omrMax, uint128 minLiquidityAdded, uint256 deadline)
- 373: function quoteLiquidity(uint128 nativeMax, uint128 omrMax) external view returns (uint128) {
- 377: function _liquidityAtValidatedPrice(uint128 nativeMax, uint128 omrMax) private view returns (uint128 liquidity) {
- 393: function _add(bool minting, uint128 nativeMax, uint128 omrMax, uint128 minimum, uint256 deadline)
- 447: function pendingFees() external view returns (uint256 nativeFees, uint256 omrFees) {
- 461: function collectFees(uint256 deadline) external nonReentrant returns (uint256 nativeFees, uint256 omrFees) {
- 469: function _collectIntoVault(uint256 deadline) private returns (uint256 nativeFees, uint256 omrFees) {
- 485: function _routeFees(uint256 nativeFees, uint256 omrFees) private {
- 499: function setInventoryExecutor(address executor) external onlyOwner nonReentrant {
- 513: function fundInventory(uint128 nativeAmount) external onlyKeeper nonReentrant {
- 529: function budgetAvailable() public view returns (uint256 nativeAvailable, uint256 omrAvailable) {
- 537: function _activeSpend() private view returns (uint256 nativeSpent, uint256 omrSpent) {
- 547: function _reserveSpend(uint128 nativeAmount, uint128 omrAmount) private returns (uint256 slot) {
- 561: function pauseAutomation() external {
- 568: function setKeeper(address nextKeeper) external onlyOwner {
- 574: function resumeAutomation() external onlyOwner nonReentrant {
- 588: function latchEmergency() external {
- 596: function recoverEmergency() external onlyOwner nonReentrant {
- 608: function renounceOwnership() public override onlyOwner { revert InvalidConfiguration(); }
- 610: function _sendNative(address payable recipient, uint256 amount) private {

## omerta-contracts/src/RwaHealthOverlay.sol
- 7: contract RwaHealthOverlay is IRwaHealthOverlay {
- 33: function clearancePayloadHash(Clearance calldata value) external view override returns (bytes32) {
- 37: function safeCallIntentHash(Clearance calldata value) external view override returns (bytes32) {
- 41: function clearanceId(Clearance calldata value) external view override returns (bytes32) {
- 45: function recordClearance(Clearance calldata value) external override returns (bytes32 clearanceId_) {
- 83: function _validateLocal(Clearance calldata value) private view {
- 107: function _validateRegistry(Clearance calldata value) private view {
- 116: function _clearancePayloadHash(Clearance calldata value) private view returns (bytes32) {
- 143: function _safeCallIntentHash(Clearance calldata value) private view returns (bytes32) {
- 159: function _clearanceId(Clearance calldata value, bytes32 callIntentHash) private view returns (bytes32) {

## omerta-contracts/src/RwaStockBuyer.sol
- 10: interface IStockTokenRegistry {
- 11: function resolveBallot(uint256 day)
- 20: interface IStockSwapAdapter {
- 21: function buy(address token, address recipient, uint256 minUnits, bytes calldata routeData) external payable;
- 28: interface IStockQuoteOracle {
- 29: function minUnitsOut(address token, uint256 ethIn) external view returns (uint256 minUnits, uint256 observedAt);
- 43: contract RwaStockBuyer is Ownable2Step, Pausable, ReentrancyGuard {
- 91: modifier onlyKeeper() {
- 124: function setKeeper(address keeper_) external onlyOwner whenPaused {
- 129: function setAdapter(address adapter_) external onlyOwner whenPaused {
- 137: function setQuoteOracle(address oracle_, uint256 maxAge_) external onlyOwner whenPaused {
- 150: function setDailyEthCap(uint256 cap) external onlyOwner whenPaused {
- 156: function pause() external onlyOwner {
- 160: function unpause() external onlyOwner {
- 168: function buy(uint256 ballotDay, uint256 ethIn, uint256 minUnits, bytes calldata routeData)
- 194: function _resolveActiveBallot(uint256 ballotDay) private view returns (bytes32 assetKey, address token) {
- 200: function _chargeDailyCap(uint256 ethIn) private {
- 207: function _enforcedMinimum(address token, uint256 ethIn, uint256 keeperMinUnits) private view returns (uint256) {
- 215: function _acquire(address token, uint256 ethIn, uint256 minUnits, bytes calldata routeData)
- 228: function sweepEth(address payable to, uint256 amount) external onlyOwner nonReentrant {
- 237: function sweepToken(address token, address to, uint256 amount) external onlyOwner {

## omerta-contracts/src/SettlementGasPool.sol
- 10: interface ISettlementGasPoolMigrationCandidate {
- 11: function version() external view returns (bytes32);
- 12: function supportedChainId() external view returns (uint256);
- 13: function gameplayVault() external view returns (address);
- 14: function predecessor() external view returns (address);
- 15: function owner() external view returns (address);
- 16: function paused() external view returns (bool);
- 17: function acceptMigration(bytes32 migrationProposalId) external payable;
- 24: contract SettlementGasPool is Ownable2Step, Pausable, ReentrancyGuard {
- 271: function contribute(bytes32 memo) external payable {
- 275: function acceptMigration(bytes32 migrationProposalId) external payable {
- 282: function recordSettlementCredit(CreditRequest calldata request)
- 318: function withdrawCredit() external nonReentrant returns (uint256 amount) {
- 332: function unreservedBalance() public view returns (uint256) {
- 338: function settlementKey(bytes32 eventId, bytes32 victimAccountId, uint256 victimNonce)
- 346: function previewCredit(uint256 measuredSettlementGas)
- 371: function pauseCredits(bytes32 reasonHash) external onlyOwner {
- 377: function unpauseCredits(bytes32 reasonHash) external onlyOwner {
- 385: function reduceCaps(uint128 priorityFeeCapWei, uint128 perSettlementWeiCap, uint128 dataFeeWeiCap)
- 416: function proposeConfig(Config calldata nextConfig, bytes32 reasonHash)
- 445: function cancelConfigProposal(bytes32 proposalId) external onlyOwner {
- 455: function executeConfigProposal(bytes32 proposalId) external onlyOwner {
- 481: function getConfigProposal(bytes32 proposalId) external view returns (ConfigProposal memory) {
- 485: function configProposalState(bytes32 proposalId) public view returns (ProposalState) {
- 497: function proposeMigration(address successor_, uint256 amount, bytes32 reasonHash)
- 540: function cancelMigrationProposal(bytes32 proposalId) external onlyOwner {
- 549: function executeMigration(bytes32 proposalId) external onlyOwner nonReentrant {
- 577: function getMigrationProposal(bytes32 proposalId) external view returns (MigrationProposal memory) {
- 581: function migrationProposalState(bytes32 proposalId) public view returns (ProposalState) {
- 591: function version() public pure returns (bytes32) {
- 595: function renounceOwnership() public view override onlyOwner {
- 599: function _recordContribution(bytes32 memo) private {
- 605: function _calculateCredit(uint256 measuredSettlementGas)
- 644: function _approvedDataFee() private view returns (uint256) {
- 665: function _cancelLiveConfigProposal(bytes32 cancellationReasonHash) private {
- 675: function _validateDataFeeSourceConfig(Config memory config_) private view {
- 688: function _validateProposedConfig(Config calldata nextConfig)
- 707: function _emitConfigProposalCreated(ConfigProposal storage proposal, bytes32 nextConfigHash) private {
- 719: function _configHash(Config memory config_) private pure returns (bytes32) {
- 723: function _deriveProposalId(uint256 nonce, bytes32 baseConfigHash, bytes32 nextConfigHash, bytes32 reasonHash)
- 745: function _validateMigrationSuccessor(address candidateAddress) private view {
- 760: function _deriveMigrationProposalId(
- 787: function _addCapped(uint256 a, uint256 b, uint256 cap) private pure returns (uint256) {
- 792: function _mulCapped(uint256 a, uint256 b, uint256 cap) private pure returns (uint256) {

## omerta-contracts/src/StockTokenRegistry.sol
- 18: contract StockTokenRegistry is Ownable2Step {
- 70: modifier onlyPublisher() {
- 81: function keyOf(string memory ticker) public pure returns (bytes32) {
- 88: function upsertAsset(
- 130: function setAssetActive(bytes32 assetKey, bool active) external onlyOwner {
- 138: function setPublisher(address publisher_) external onlyOwner {
- 143: function assetCount() external view returns (uint256) {
- 147: function assetKeyAt(uint256 index) external view returns (bytes32) {
- 151: function getAsset(bytes32 assetKey) external view returns (Asset memory) {
- 159: function publishBallot(uint256 day, bytes32 assetKey, bytes32 tallyHash) external onlyPublisher {
- 173: function resolveBallot(uint256 day)

## omerta-contracts/src/StockTokenRegistryV2.sol
- 10: contract StockTokenRegistryV2 is IStockTokenRegistryV2, Ownable2Step {
- 27: modifier onlyPublisher() {
- 37: function assetVersionKey(string memory normalizedTicker, address token, bytes32 robinhoodAssetIdHash)
- 46: function activateVersion(Activation calldata activation) external override onlyOwner returns (bytes32 versionKey) {
- 120: function deactivateVersion(bytes32 versionKey, bytes32 reasonHash) external override onlyOwner {
- 131: function publishBallot(
- 173: function resolveBallot(uint256 day)
- 201: function setPublisher(address publisher_) external override onlyOwner {
- 206: function versionCount() external view override returns (uint256) {
- 210: function versionKeyAt(uint256 index) external view override returns (bytes32) {
- 214: function getVersion(bytes32 versionKey) external view override returns (AssetVersion memory) {
- 220: function getBallot(uint256 day) external view override returns (Ballot memory) {
- 226: function _validateActivation(Activation calldata activation) private view {
- 241: function _validTicker(bytes memory ticker) private pure returns (bool) {
- 253: function _deactivateConflict(bytes32 conflictKey, bytes32 targetKey, uint256 nextCatalogVersion) private {
- 259: function _deactivate(bytes32 versionKey, bytes32 reasonHash, uint256 nextCatalogVersion) private {
- 276: function _isExactlyActive(bytes32 versionKey, AssetVersion storage version) private view returns (bool) {
- 282: function _isLiveBallot(uint256 day, bytes32 versionKey, AssetVersion storage version) private view returns (bool) {

## omerta-contracts/src/StockVault.sol
- 44: contract StockVault is Ownable2Step, Pausable, ReentrancyGuard, EIP712 {
- 100: modifier onlyKeeper() {
- 116: function setKeeper(address k) external onlyOwner {
- 123: function setAllocationSigner(address signer_) external onlyOwner {
- 128: function setDailyCap(address token, uint256 cap) external onlyOwner {
- 135: function setDefaultDailyCap(uint256 cap) external onlyOwner {
- 142: function effectiveDailyCap(address token) public view returns (uint256) {
- 148: function pause() external onlyOwner {
- 152: function unpause() external onlyOwner {
- 158: function sweep(address token, address to, uint256 amount) external onlyOwner {
- 168: function deliver(uint256 deliveryId, address token, address to, uint256 units)
- 181: function deliverAuthorized(DeliveryAuthorization calldata auth, bytes calldata signature)
- 195: function hashAuthorization(DeliveryAuthorization calldata auth) public view returns (bytes32) {
- 215: function deliverBatch(
- 229: function _deliver(uint256 deliveryId, address token, address to, uint256 units) private {

## omerta-contracts/src/StreetDeed.sol
- 37: contract StreetDeed is ERC721, EIP712, Ownable2Step, Pausable, ReentrancyGuard {
- 113: function setSigner(address s) external onlyOwner {
- 119: function setDailyMintCap(uint256 cap) external onlyOwner {
- 124: function setImageBase(string calldata base_) external onlyOwner {
- 129: function setExternalBase(string calldata base_) external onlyOwner {
- 136: function pause() external onlyOwner {
- 140: function unpause() external onlyOwner {
- 145: function tokenIdFor(string memory name) public pure returns (uint256) {
- 149: function hashVoucher(DeedVoucher calldata v) public view returns (bytes32) {
- 168: function claim(DeedVoucher calldata v, bytes calldata sig) external nonReentrant whenNotPaused {
- 197: function setTransferLock(uint256 tokenId, bool locked) external {
- 203: function redeem(uint256 tokenId) external {
- 215: function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
- 231: function tokenURI(uint256 id) public view override returns (string memory) {
- 262: function _json(string memory s) internal pure returns (string memory) {

## omerta-contracts/src/Transmuter.sol
- 59: contract Transmuter is Ownable2Step, ReentrancyGuard, FlashGuard {
- 110: function setFunder(address who, bool allowed) external onlyOwner {
- 115: function setBufferFloorBps(uint16 bps) external onlyOwner {
- 121: function setRedeemCaps(uint256 perBlock, uint256 perDay) external onlyOwner {
- 128: function setAllowedContract(address who, bool allowed) external onlyOwner {
- 135: function requiredBuffer() public view returns (uint256) {
- 140: function bufferHealthy() external view returns (bool) {
- 145: function fund(uint256 assets) external nonReentrant {
- 169: function redeem(uint256 debtAmount) external nonReentrant returns (uint256 assetsOut) {

## omerta-contracts/src/VoucherClaim.sol
- 12: interface IGearVault {
- 13: function mint(address to, uint256 gearId, uint256 amount) external;
- 17: function redeemed(uint256 tokenId) external view returns (uint256);
- 28: contract VoucherClaim is EIP712, Ownable2Step, Pausable, ReentrancyGuard {
- 81: function setSigner(address s) external onlyOwner {
- 87: function setDailyCap(uint256 cap) external onlyOwner {
- 96: function setGearSupplyCap(uint256 gearId, uint256 cap) external onlyOwner {
- 102: function pause() external onlyOwner {
- 106: function unpause() external onlyOwner {
- 111: function sweep(address to, uint256 amount) external onlyOwner {
- 117: function hashVoucher(Voucher calldata v) public view returns (bytes32) {
- 123: function claim(Voucher calldata v, bytes calldata sig) external nonReentrant whenNotPaused {

## omerta-contracts/src/genesis-auction/OmertaGuardedAuction.sol
- 7: interface IOmertaGenesisClaimGate {
- 8: function playerClaimsOpen() external view returns (bool);
- 14: contract OmertaGuardedAuction is ContinuousClearingAuction {
- 35: function claimsReady() external view returns (bool) {
- 39: function blockNumberish() external view returns (uint256) {
- 43: function _internalClaimTokens(uint256 bidId)

## omerta-contracts/src/genesis-auction/vendor/blocknumberish/src/BlockNumberish.sol
- 8: contract BlockNumberish {
- 39: function _getBlockNumberish() internal view returns (uint256 blockNumber) {
- 60: function _getFlashblockNumberish() internal view returns (uint256 flashblockNumber) {

## omerta-contracts/src/genesis-auction/vendor/cca/AuctionStorage.sol
- 14: abstract contract AuctionStorage is IAuctionStorage {
- 91: function _sweepCurrency(uint256 _blockNumberIsh, uint256 _amount) internal {
- 100: function _sweepUnsoldTokens(uint256 _blockNumberIsh, uint256 _amount) internal {
- 111: function currencyRaised() public view returns (uint256) {
- 116: function currencyRaisedQ96X7() public view returns (ValueX7) {
- 121: function sumCurrencyDemandAboveClearingQ96() public view returns (uint256) {
- 126: function totalClearedQ96X7() public view returns (ValueX7) {
- 131: function totalCleared() public view returns (uint256) {
- 136: function remainingSupplyQ96X7() public view returns (ValueX7) {
- 140: function _remainingSupplyQ96X7() internal view returns (ValueX7) {
- 145: function remainingSupply() public view returns (uint256) {

## omerta-contracts/src/genesis-auction/vendor/cca/BidStorage.sol
- 8: abstract contract BidStorage is IBidStorage {
- 17: function _getBid(uint256 bidId) internal view returns (Bid storage) {
- 30: function _createBid(
- 54: function nextBidId() external view returns (uint256) {
- 59: function bids(uint256 bidId) external view returns (Bid memory) {

## omerta-contracts/src/genesis-auction/vendor/cca/CheckpointStorage.sol
- 9: abstract contract CheckpointStorage is ICheckpointStorage {
- 19: function latestCheckpoint() public view returns (Checkpoint memory) {
- 24: function _getCheckpoint(uint64 blockNumber) internal view returns (Checkpoint memory) {
- 30: function _insertCheckpoint(Checkpoint memory checkpoint, uint64 blockNumber) internal {
- 46: function lastCheckpointedBlock() external view returns (uint64) {
- 51: function checkpoints(uint64 blockNumber) external view returns (Checkpoint memory) {

## omerta-contracts/src/genesis-auction/vendor/cca/ContinuousClearingAuction.sol
- 39: contract ContinuousClearingAuction is
- 98: modifier onlyActiveAuction() {
- 105: function _onlyActiveAuction() internal view {
- 111: modifier ensureEndBlockIsCheckpointed() {
- 119: function onTokensReceived() external override {
- 134: function lbpInitializationParams() external view returns (LBPInitializationParams memory params) {
- 151: function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
- 156: function clearingPrice() external view returns (uint256) {
- 161: function isGraduated() external view returns (bool) {
- 167: function _isGraduated() internal view returns (bool) {
- 176: function _iterateOverTicksAndFindClearingPrice(uint256 _untilTickPriceQ96, uint24 _cumulativeMps)
- 240: function _checkpointAtBlock(uint64 _blockNumber) internal returns (Checkpoint memory _checkpoint) {
- 335: function _getFinalCheckpoint() internal returns (Checkpoint memory) {
- 344: function _submitBid(
- 400: function _processExit(uint256 _bidId, uint256 _tokensFilled, uint256 _currencySpentQ96) internal {
- 420: function checkpoint() public onlyActiveAuction returns (Checkpoint memory) {
- 432: function forceIterateOverTicks(uint256 _untilTickPriceQ96)
- 464: function submitBid(
- 486: function submitBid(uint256 _maxPriceQ96, uint128 _amount, address _owner, bytes calldata _hookData)
- 495: function exitBid(uint256 _bidId) external onlyAfterAuctionIsOver {
- 514: function exitPartiallyFilledBid(uint256 _bidId, uint64 _lastFullyFilledCheckpointBlock, uint64 _outbidBlock)
- 604: function claimTokens(uint256 _bidId) external onlyAfterClaimBlock ensureEndBlockIsCheckpointed {
- 617: function claimTokensBatch(address _owner, uint256[] calldata _bidIds)
- 649: function _internalClaimTokens(uint256 _bidId) internal virtual returns (address owner, uint256 tokensFilled) {
- 663: function sweepCurrency() external onlyAfterAuctionIsOver ensureEndBlockIsCheckpointed {
- 687: function sweepUnsoldTokens() external onlyAfterAuctionIsOver ensureEndBlockIsCheckpointed {
- 704: function requiredDemandQ96(uint256 _priceQ96) public view returns (uint256) {
- 711: function requiredDemandQ96AtNextActiveTick() public view returns (uint256) {
- 719: function currency() external view returns (address) {
- 724: function token() external view returns (address) {
- 729: function totalSupply() external view returns (uint128) {
- 734: function tokensRecipient() external view returns (address) {
- 739: function fundsRecipient() external view returns (address) {
- 744: function startBlock() external view returns (uint64) {
- 749: function endBlock() external view returns (uint64) {
- 754: function claimBlock() external view returns (uint64) {
- 759: function validationHook() external view returns (IValidationHook) {

## omerta-contracts/src/genesis-auction/vendor/cca/StepStorage.sol
- 13: contract StepStorage is BlockNumberish, IStepStorage {
- 50: modifier onlyAfterAuctionIsOver() {
- 56: modifier onlyAfterClaimBlock() {
- 66: function _advanceToStartOfCurrentStep(uint64 _blockNumber, uint64 _lastCheckpointedBlock)
- 92: function _validate(address _pointer) internal view {
- 116: function _advanceStep() internal returns (AuctionStep memory) {
- 135: function step() external view returns (AuctionStep memory) {
- 141: function pointer() external view returns (address) {

## omerta-contracts/src/genesis-auction/vendor/cca/TickStorage.sol
- 9: abstract contract TickStorage is ITickStorage {
- 40: function _getTick(uint256 priceQ96) internal view returns (Tick storage) {
- 53: function _initializeTickIfNeeded(uint256 prevPriceQ96, uint256 priceQ96) internal {
- 89: function _updateTickDemand(uint256 priceQ96, uint256 currencyDemandQ96) internal {
- 97: function floorPrice() external view returns (uint256) {
- 102: function tickSpacing() external view returns (uint256) {
- 107: function nextActiveTickPrice() external view returns (uint256) {
- 112: function ticks(uint256 priceQ96) external view returns (Tick memory) {

## omerta-contracts/src/genesis-auction/vendor/cca/interfaces/IAuctionStorage.sol
- 7: interface IAuctionStorage {
- 40: function currencyRaisedQ96X7() external view returns (ValueX7);
- 45: function currencyRaised() external view returns (uint256);
- 48: function sumCurrencyDemandAboveClearingQ96() external view returns (uint256);
- 51: function totalClearedQ96X7() external view returns (ValueX7);
- 55: function totalCleared() external view returns (uint256);
- 59: function remainingSupplyQ96X7() external view returns (ValueX7);
- 64: function remainingSupply() external view returns (uint256);

## omerta-contracts/src/genesis-auction/vendor/cca/interfaces/IBidStorage.sol
- 7: interface IBidStorage {
- 13: function nextBidId() external view returns (uint256);
- 19: function bids(uint256 bidId) external view returns (Bid memory);

## omerta-contracts/src/genesis-auction/vendor/cca/interfaces/ICheckpointStorage.sol
- 7: interface ICheckpointStorage {
- 15: function latestCheckpoint() external view returns (Checkpoint memory);
- 21: function lastCheckpointedBlock() external view returns (uint64);
- 25: function checkpoints(uint64 blockNumber) external view returns (Checkpoint memory);

## omerta-contracts/src/genesis-auction/vendor/cca/interfaces/IContinuousClearingAuction.sol
- 31: interface IContinuousClearingAuction is
- 136: function submitBid(
- 152: function submitBid(uint256 maxPriceQ96, uint128 amount, address owner, bytes calldata hookData)
- 161: function checkpoint() external returns (Checkpoint memory _checkpoint);
- 168: function clearingPrice() external view returns (uint256);
- 174: function isGraduated() external view returns (bool);
- 179: function exitBid(uint256 bidId) external;
- 186: function exitPartiallyFilledBid(uint256 bidId, uint64 lastFullyFilledCheckpointBlock, uint64 outbidBlock) external;
- 192: function claimTokens(uint256 bidId) external;
- 199: function claimTokensBatch(address owner, uint256[] calldata bidIds) external;
- 204: function sweepCurrency() external;
- 208: function supportsInterface(bytes4 interfaceId) external view override(IERC165) returns (bool);
- 211: function currency() external view returns (address);
- 214: function token() external view returns (address);
- 217: function totalSupply() external view returns (uint128);
- 220: function tokensRecipient() external view returns (address);
- 223: function fundsRecipient() external view returns (address);
- 227: function startBlock() external view override(ILBPInitializer) returns (uint64);
- 231: function endBlock() external view override(ILBPInitializer) returns (uint64);
- 234: function claimBlock() external view returns (uint64);
- 237: function validationHook() external view returns (IValidationHook);
- 242: function sweepUnsoldTokens() external;
- 246: function requiredDemandQ96(uint256 _priceQ96) external view returns (uint256);
- 251: function requiredDemandQ96AtNextActiveTick() external view returns (uint256);

## omerta-contracts/src/genesis-auction/vendor/cca/interfaces/IStepStorage.sol
- 7: interface IStepStorage {
- 33: function pointer() external view returns (address);
- 36: function step() external view returns (AuctionStep memory);

## omerta-contracts/src/genesis-auction/vendor/cca/interfaces/ITickStorage.sol
- 13: interface ITickStorage {
- 44: function nextActiveTickPrice() external view returns (uint256);
- 48: function floorPrice() external view returns (uint256);
- 52: function tickSpacing() external view returns (uint256);
- 58: function ticks(uint256 priceQ96) external view returns (Tick memory);

## omerta-contracts/src/genesis-auction/vendor/cca/interfaces/IValidationHook.sol
- 5: interface IValidationHook {
- 13: function validate(uint256 maxPrice, uint128 amount, address owner, address sender, bytes calldata hookData) external;

## omerta-contracts/src/genesis-auction/vendor/cca/interfaces/external/IERC20Minimal.sol
- 5: interface IERC20Minimal {
- 9: function balanceOf(address account) external view returns (uint256);
- 15: function transfer(address recipient, uint256 amount) external returns (bool);
- 21: function approve(address spender, uint256 amount) external returns (bool);

## omerta-contracts/src/genesis-auction/vendor/cca/libraries/BidLib.sol
- 17: library BidLib {
- 28: function mpsRemainingInAuctionAfterSubmission(Bid memory bid) internal pure returns (uint24) {
- 37: function toEffectiveAmount(Bid memory bid) internal pure returns (uint256) {

## omerta-contracts/src/genesis-auction/vendor/cca/libraries/CheckpointAccountingLib.sol
- 11: library CheckpointAccountingLib {
- 23: function accountFullyFilledCheckpoints(Checkpoint memory upper, Checkpoint memory startCheckpoint, Bid memory bid)
- 41: function accountPartiallyFilledCheckpoints(
- 68: function calculateFill(Bid memory bid, uint256 cumulativeMpsPerPriceDelta, uint24 cumulativeMpsDelta)

## omerta-contracts/src/genesis-auction/vendor/cca/libraries/CheckpointLib.sol
- 17: library CheckpointLib {
- 21: function remainingMpsInAuction(Checkpoint memory _checkpoint) internal pure returns (uint24) {
- 30: function getMpsPerPrice(uint24 mps, uint256 price) internal pure returns (uint256) {

## omerta-contracts/src/genesis-auction/vendor/cca/libraries/ConstantsLib.sol
- 6: library ConstantsLib {

## omerta-contracts/src/genesis-auction/vendor/cca/libraries/CurrencyLibrary.sol
- 13: library CurrencyLibrary {
- 23: function transfer(Currency currency, address to, uint256 amount) internal {
- 70: function balanceOf(Currency currency, address owner) internal view returns (uint256) {
- 78: function isAddressZero(Currency currency) internal pure returns (bool) {

## omerta-contracts/src/genesis-auction/vendor/cca/libraries/DemandLib.sol
- 12: library DemandLib {
- 24: function currencyRaisedAtPrice(
- 60: function requiredDemandAtPrice(ValueX7 _remainingSupplyQ96X7, uint256 _priceQ96, uint256 _remainingMps)
- 104: function canClearSupplyAtPrice(
- 131: function toPriceCeiling(uint256 _demandQ96, uint256 _remainingSupplyQ96X7, uint256 _remainingMps)

## omerta-contracts/src/genesis-auction/vendor/cca/libraries/FixedPoint96.sol
- 7: library FixedPoint96 {

## omerta-contracts/src/genesis-auction/vendor/cca/libraries/MaxBidPriceLib.sol
- 9: library MaxBidPriceLib {
- 86: function maxBidPrice(uint128 _totalSupply) internal pure returns (uint256) {

## omerta-contracts/src/genesis-auction/vendor/cca/libraries/PriceLib.sol
- 9: library PriceLib {
- 16: function toTokensRoundingUp(uint256 _currencyQ96, uint256 _priceQ96) internal pure returns (uint256) {
- 24: function toPriceRoundingUp(uint256 _currencyQ96, uint256 _tokensQ96) internal pure returns (uint256) {

## omerta-contracts/src/genesis-auction/vendor/cca/libraries/StepLib.sol
- 11: library StepLib {
- 23: function parse(bytes8 data) internal pure returns (uint24 mps, uint40 blockDelta) {
- 29: function get(bytes memory data, uint256 offset) internal pure returns (uint24 mps, uint40 blockDelta) {

## omerta-contracts/src/genesis-auction/vendor/cca/libraries/ValidationHookLib.sol
- 8: library ValidationHookLib {
- 14: function handleValidate(

## omerta-contracts/src/genesis-auction/vendor/cca/libraries/ValueX7Lib.sol

## omerta-contracts/src/genesis-auction/vendor/launcher/src/interfaces/IDistributor.sol
- 8: interface IDistributor {
- 19: function onTokensReceived() external;

## omerta-contracts/src/genesis-auction/vendor/launcher/src/interfaces/ILBPInitializer.sol
- 20: interface ILBPInitializer is IDistributor, IERC165 {
- 23: function lbpInitializationParams() external view returns (LBPInitializationParams memory);
- 30: function sweepCurrency() external;
- 34: function sweepUnsoldTokens() external;
- 37: function token() external view returns (address);
- 39: function currency() external view returns (address);
- 41: function totalSupply() external view returns (uint128);
- 43: function tokensRecipient() external view returns (address);
- 45: function fundsRecipient() external view returns (address);
- 47: function startBlock() external view returns (uint64);
- 49: function endBlock() external view returns (uint64);

## omerta-contracts/src/genesis-auction/vendor/launcher/src/interfaces/IProtocolFeeController.sol
- 10: interface IProtocolFeeController {
- 59: function setProtocolFeeRecipient(address recipient) external;
- 65: function setGlobalProtocolFeePips(uint24 globalProtocolFeePips) external;
- 74: function setProtocolFeeBracketsForCurrency(address currency, ProtocolFeeBracket[] calldata fees) external;
- 79: function getProtocolFeeBracketsForCurrency(address currency)
- 85: function protocolFeeRecipient() external view returns (address);
- 93: function getProtocolFeeAmount(address currency, uint256 amount) external view returns (uint256 protocolFeeAmount);

## omerta-contracts/src/genesis-auction/vendor/launcher/src/libraries/ProtocolFeeLib.sol
- 10: library ProtocolFeeLib {
- 22: function getProtocolFeeAmount(IProtocolFeeController protocolFeeController, address currency, uint256 amount)
- 39: function transferProtocolFee(

## omerta-contracts/src/genesis-auction/vendor/solady/utils/FixedPointMathLib.sol
- 7: library FixedPointMathLib {
- 64: function mulWad(uint256 x, uint256 y) internal pure returns (uint256 z) {
- 79: function sMulWad(int256 x, int256 y) internal pure returns (int256 z) {
- 93: function rawMulWad(uint256 x, uint256 y) internal pure returns (uint256 z) {
- 101: function rawSMulWad(int256 x, int256 y) internal pure returns (int256 z) {
- 109: function mulWadUp(uint256 x, uint256 y) internal pure returns (uint256 z) {
- 125: function rawMulWadUp(uint256 x, uint256 y) internal pure returns (uint256 z) {
- 133: function divWad(uint256 x, uint256 y) internal pure returns (uint256 z) {
- 146: function sDivWad(int256 x, int256 y) internal pure returns (int256 z) {
- 160: function rawDivWad(uint256 x, uint256 y) internal pure returns (uint256 z) {
- 168: function rawSDivWad(int256 x, int256 y) internal pure returns (int256 z) {
- 176: function divWadUp(uint256 x, uint256 y) internal pure returns (uint256 z) {
- 189: function rawDivWadUp(uint256 x, uint256 y) internal pure returns (uint256 z) {
- 199: function powWad(int256 x, int256 y) internal pure returns (int256) {
- 207: function expWad(int256 x) internal pure returns (int256 r) {
- 277: function lnWad(int256 x) internal pure returns (int256 r) {
- 353: function lambertW0Wad(int256 x) internal pure returns (int256 w) {
- 441: function fullMulEq(uint256 a, uint256 b, uint256 x, uint256 y)
- 455: function fullMulDiv(uint256 x, uint256 y, uint256 d) internal pure returns (uint256 z) {
- 517: function fullMulDivUnchecked(uint256 x, uint256 y, uint256 d)
- 548: function fullMulDivUp(uint256 x, uint256 y, uint256 d) internal pure returns (uint256 z) {
- 566: function fullMulDivN(uint256 x, uint256 y, uint8 n) internal pure returns (uint256 z) {
- 595: function mulDiv(uint256 x, uint256 y, uint256 d) internal pure returns (uint256 z) {
- 610: function mulDivUp(uint256 x, uint256 y, uint256 d) internal pure returns (uint256 z) {
- 624: function invMod(uint256 a, uint256 n) internal pure returns (uint256 x) {
- 645: function divUp(uint256 x, uint256 d) internal pure returns (uint256 z) {
- 657: function zeroFloorSub(uint256 x, uint256 y) internal pure returns (uint256 z) {
- 665: function saturatingSub(uint256 x, uint256 y) internal pure returns (uint256 z) {
- 673: function saturatingAdd(uint256 x, uint256 y) internal pure returns (uint256 z) {
- 681: function saturatingMul(uint256 x, uint256 y) internal pure returns (uint256 z) {
- 689: function ternary(bool condition, uint256 x, uint256 y) internal pure returns (uint256 z) {
- 697: function ternary(bool condition, bytes32 x, bytes32 y) internal pure returns (bytes32 z) {
- 705: function ternary(bool condition, address x, address y) internal pure returns (address z) {
- 713: function coalesce(uint256 x, uint256 y) internal pure returns (uint256 z) {
- 721: function coalesce(bytes32 x, bytes32 y) internal pure returns (bytes32 z) {
- 729: function coalesce(address x, address y) internal pure returns (address z) {
- 738: function rpow(uint256 x, uint256 y, uint256 b) internal pure returns (uint256 z) {
- 775: function sqrt(uint256 x) internal pure returns (uint256 z) {
- 833: function cbrt(uint256 x) internal pure returns (uint256 z) {
- 857: function sqrtWad(uint256 x) internal pure returns (uint256 z) {
- 872: function cbrtWad(uint256 x) internal pure returns (uint256 z) {
- 899: function factorial(uint256 x) internal pure returns (uint256 z) {
- 914: function log2(uint256 x) internal pure returns (uint256 r) {
- 930: function log2Up(uint256 x) internal pure returns (uint256 r) {
- 940: function log10(uint256 x) internal pure returns (uint256 r) {
- 965: function log10Up(uint256 x) internal pure returns (uint256 r) {
- 975: function log256(uint256 x) internal pure returns (uint256 r) {
- 988: function log256Up(uint256 x) internal pure returns (uint256 r) {
- 998: function sci(uint256 x) internal pure returns (uint256 mantissa, uint256 exponent) {
- 1043: function packSci(uint256 x) internal pure returns (uint256 packed) {
- 1056: function unpackSci(uint256 packed) internal pure returns (uint256 unpacked) {
- 1063: function avg(uint256 x, uint256 y) internal pure returns (uint256 z) {
- 1070: function avg(int256 x, int256 y) internal pure returns (int256 z) {
- 1077: function abs(int256 x) internal pure returns (uint256 z) {
- 1084: function dist(uint256 x, uint256 y) internal pure returns (uint256 z) {
- 1092: function dist(int256 x, int256 y) internal pure returns (uint256 z) {
- 1100: function min(uint256 x, uint256 y) internal pure returns (uint256 z) {
- 1108: function min(int256 x, int256 y) internal pure returns (int256 z) {
- 1116: function max(uint256 x, uint256 y) internal pure returns (uint256 z) {
- 1124: function max(int256 x, int256 y) internal pure returns (int256 z) {
- 1132: function clamp(uint256 x, uint256 minValue, uint256 maxValue)
- 1145: function clamp(int256 x, int256 minValue, int256 maxValue) internal pure returns (int256 z) {
- 1154: function gcd(uint256 x, uint256 y) internal pure returns (uint256 z) {
- 1169: function lerp(uint256 a, uint256 b, uint256 t, uint256 begin, uint256 end)
- 1187: function lerp(int256 a, int256 b, int256 t, int256 begin, int256 end)
- 1205: function isEven(uint256 x) internal pure returns (bool) {
- 1214: function rawAdd(uint256 x, uint256 y) internal pure returns (uint256 z) {
- 1221: function rawAdd(int256 x, int256 y) internal pure returns (int256 z) {
- 1228: function rawSub(uint256 x, uint256 y) internal pure returns (uint256 z) {
- 1235: function rawSub(int256 x, int256 y) internal pure returns (int256 z) {
- 1242: function rawMul(uint256 x, uint256 y) internal pure returns (uint256 z) {
- 1249: function rawMul(int256 x, int256 y) internal pure returns (int256 z) {
- 1256: function rawDiv(uint256 x, uint256 y) internal pure returns (uint256 z) {
- 1264: function rawSDiv(int256 x, int256 y) internal pure returns (int256 z) {
- 1272: function rawMod(uint256 x, uint256 y) internal pure returns (uint256 z) {
- 1280: function rawSMod(int256 x, int256 y) internal pure returns (int256 z) {
- 1288: function rawAddMod(uint256 x, uint256 y, uint256 d) internal pure returns (uint256 z) {
- 1296: function rawMulMod(uint256 x, uint256 y, uint256 d) internal pure returns (uint256 z) {

## omerta-contracts/src/genesis-auction/vendor/solady/utils/ReentrancyGuardTransient.sol
- 9: abstract contract ReentrancyGuardTransient {
- 31: modifier nonReentrant() virtual {
- 86: modifier nonReadReentrant() virtual {
- 120: function _useTransientReentrancyGuardOnlyOnMainnet() internal view virtual returns (bool) {

## omerta-contracts/src/genesis-auction/vendor/solady/utils/SafeTransferLib.sol
- 11: library SafeTransferLib {
- 90: function safeTransferETH(address to, uint256 amount) internal {
- 101: function safeTransferAllETH(address to) internal {
- 113: function forceSafeTransferETH(address to, uint256 amount, uint256 gasStipend) internal {
- 130: function forceSafeTransferAllETH(address to, uint256 gasStipend) internal {
- 143: function forceSafeTransferETH(address to, uint256 amount) internal {
- 160: function forceSafeTransferAllETH(address to) internal {
- 174: function trySafeTransferETH(address to, uint256 amount, uint256 gasStipend)
- 185: function trySafeTransferAllETH(address to, uint256 gasStipend)
- 204: function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
- 227: function trySafeTransferFrom(address token, address from, address to, uint256 amount)
- 251: function safeTransferAllFrom(address token, address from, address to)
- 288: function safeTransfer(address token, address to, uint256 amount) internal {
- 308: function safeTransferAll(address token, address to) internal returns (uint256 amount) {
- 340: function safeApprove(address token, address to, uint256 amount) internal {
- 361: function safeApproveWithRetry(address token, address to, uint256 amount) internal {
- 392: function balanceOf(address token, address account) internal view returns (uint256 amount) {
- 411: function checkBalanceOf(address token, address account)
- 431: function totalSupply(address token) internal view returns (uint256 result) {
- 450: function safeTransferFrom2(address token, address from, address to, uint256 amount) internal {
- 458: function permit2TransferFrom(address token, address from, address to, uint256 amount)
- 488: function permit2(
- 545: function simplePermit2(
- 598: function permit2Approve(address token, address spender, uint160 amount, uint48 expiration)
- 618: function permit2Lockdown(address token, address spender) internal {

## omerta-contracts/src/genesis-auction/vendor/solady/utils/SSTORE2.sol
- 10: library SSTORE2 {
- 35: function write(bytes memory data) internal returns (address pointer) {
- 69: function writeCounterfactual(bytes memory data, bytes32 salt)
- 91: function writeDeterministic(bytes memory data, bytes32 salt)
- 132: function initCodeHash(bytes memory data) internal pure returns (bytes32 hash) {
- 145: function predictCounterfactualAddress(bytes memory data, bytes32 salt)
- 156: function predictCounterfactualAddress(bytes memory data, bytes32 salt, address deployer)
- 176: function predictDeterministicAddress(bytes32 salt) internal view returns (address pointer) {
- 181: function predictDeterministicAddress(bytes32 salt, address deployer)
- 209: function read(address pointer) internal view returns (bytes memory data) {
- 221: function read(address pointer, uint256 start) internal view returns (bytes memory data) {
- 238: function read(address pointer, uint256 start, uint256 end)

## omerta-contracts/src/interfaces/IAcquisitionAuthorityV2.sol
- 4: interface IAcquisitionAuthorityV2 {

## omerta-contracts/src/interfaces/IAcquisitionIntentExecutionV2.sol
- 4: interface IAcquisitionIntentExecutionV2 {

## omerta-contracts/src/interfaces/IAcquisitionVaultV1.sol
- 4: interface IAcquisitionVaultV1 {
- 334: function supportedChainId() external view returns (uint256);
- 335: function OPERATOR_NOMINATION_DELAY() external view returns (uint64);
- 336: function OPERATOR_ACCEPTANCE_WINDOW() external view returns (uint64);
- 337: function INGRESS_PROPOSAL_DELAY() external view returns (uint64);
- 338: function INGRESS_ACCEPTANCE_WINDOW() external view returns (uint64);
- 339: function MAX_AUTHORIZATION_LIFETIME() external view returns (uint64);
- 340: function MAX_SIGNATURE_BYTES() external view returns (uint256);
- 341: function ERC1271_CALL_GAS() external view returns (uint256);
- 342: function ERC1271_POST_CALL_GAS_RESERVE() external view returns (uint256);
- 343: function ERC1271_MIN_PRECALL_GAS() external view returns (uint256);
- 344: function MAX_ACTIVE_ORDINARY_RESERVATIONS() external view returns (uint256);
- 345: function MAX_ACTIVE_RECONCILIATIONS() external view returns (uint256);
- 346: function MAX_OPERATOR_OUTFLOW_COMPONENTS() external view returns (uint256);
- 347: function OUTFLOW_AUTHORIZATION_TYPEHASH() external view returns (bytes32);
- 348: function SUCCESSOR_CONSENT_TYPEHASH() external view returns (bytes32);
- 349: function stockTokenRegistryV2() external view returns (address);
- 350: function version() external view returns (string memory);
- 351: function mainOperator() external view returns (address);
- 352: function operatorGeneration() external view returns (uint256);
- 353: function outflowNonce() external view returns (uint256);
- 354: function nominationNonce() external view returns (uint256);
- 355: function pendingMainOperatorNomination() external view returns (PendingOperatorNomination memory);
- 356: function nominateMainOperator(address nominee, bytes32 detailsHash) external returns (bytes32);
- 357: function cancelMainOperatorNomination(bytes32 proposalId, bytes32 detailsHash) external;
- 358: function expireMainOperatorNomination(bytes32 proposalId) external;
- 359: function acceptMainOperatorNomination(bytes32 proposalId) external;
- 360: function disableMainOperator(bytes32 detailsHash) external;
- 361: function renounceMainOperator(bytes32 detailsHash) external;
- 362: function replaceMainOperator(SuccessorConsent calldata consent, bytes calldata signature) external;
- 363: function invalidateOutflowNonce(uint256 newNextNonce, bytes32 detailsHash) external;
- 364: function pause(bytes32 detailsHash) external;
- 365: function unpause(bytes32 detailsHash) external;
- 366: function hashOutflowAuthorization(OutflowAuthorization calldata authorization) external view returns (bytes32);
- 367: function hashSuccessorConsent(SuccessorConsent calldata consent) external view returns (bytes32);
- 368: function globalLifetimeCanonicalDepositCapWei() external view returns (uint256);
- 369: function availableWei() external view returns (uint256);
- 370: function unattributedWei() external view returns (uint256);
- 371: function ordinaryReservedWei() external view returns (uint256);
- 372: function reconciliationLiabilityWei() external view returns (uint256);
- 373: function reconciliationBackingWei() external view returns (uint256);
- 374: function accountingSequence() external view returns (uint256);
- 375: function lastObservedBalanceDeficitWei() external view returns (uint256);
- 376: function accountingTotals() external view returns (AccountingTotals memory);
- 377: function syncBalance() external returns (bytes32 mutationId);
- 378: function reclassifyUnattributed(uint256 amountWei, bytes32 detailsHash) external returns (bytes32 mutationId);
- 379: function globalLifetimeCanonicalDepositedWei() external view returns (uint256);
- 380: function ingressProposalNonce() external view returns (uint256);
- 381: function ingressGeneration() external view returns (uint256);
- 382: function activeIngressGeneration() external view returns (uint256);
- 383: function pendingIngressProposal() external view returns (PendingIngressProposal memory);
- 384: function getIngress(uint256 generation) external view returns (IngressRecord memory);
- 385: function proposeIngress(IngressConfig calldata config, bytes32 detailsHash) external returns (bytes32 proposalId);
- 386: function cancelIngressProposal(bytes32 proposalId, bytes32 detailsHash) external;
- 387: function expireIngressProposal(bytes32 proposalId) external;
- 388: function activateIngress(bytes32 proposalId) external returns (uint256 generation);
- 389: function disableIngress(bytes32 detailsHash) external;
- 390: function ingressLifetimeDepositedWei(uint256 generation) external view returns (uint256);
- 391: function ingressEpochDepositedWei(uint256 generation, uint256 epochDay) external view returns (uint256);
- 392: function getDeposit(bytes32 depositId) external view returns (DepositRecord memory);
- 393: function depositCanonical(bytes32 sourceEventId) external payable returns (bytes32 depositId);

## omerta-contracts/src/interfaces/IInitializerHook.sol
- 10: interface IInitializerHook is IERC165 {
- 12: function authorized() external view returns (address);

## omerta-contracts/src/interfaces/ILiquidityHealth.sol
- 5: interface ILiquidityHealth {
- 6: function healthy() external view returns (bool);

## omerta-contracts/src/interfaces/IOmrV4ObservationSource.sol
- 10: interface IOmrV4ObservationSource {
- 11: function poolManager() external view returns (IPoolManager);
- 13: function currentTickCumulative(PoolId poolId)

## omerta-contracts/src/interfaces/IRwaHealthOverlay.sol
- 6: interface IRwaHealthOverlay {
- 49: function supportedChainId() external view returns (uint256);
- 50: function SAFE() external view returns (address);
- 51: function REGISTRY() external view returns (IStockTokenRegistryV2);
- 52: function clearanceGeneration(bytes32 assetVersionKey) external view returns (uint256 generation);
- 53: function latestClearanceId(bytes32 assetVersionKey) external view returns (bytes32 clearanceId_);
- 54: function usedClearanceId(bytes32 clearanceId_) external view returns (bool used);
- 56: function clearancePayloadHash(Clearance calldata value) external view returns (bytes32);
- 57: function safeCallIntentHash(Clearance calldata value) external view returns (bytes32);
- 58: function clearanceId(Clearance calldata value) external view returns (bytes32);
- 59: function recordClearance(Clearance calldata value) external returns (bytes32 clearanceId_);

## omerta-contracts/src/interfaces/ISettlementDataFeeSource.sol
- 4: interface ISettlementDataFeeSource {
- 5: function currentTransactionNativeDataFee() external view returns (uint256);

## omerta-contracts/src/interfaces/IStockTokenRegistryV2.sol
- 4: interface IStockTokenRegistryV2 {
- 99: function assetVersionKey(string memory normalizedTicker, address token, bytes32 robinhoodAssetIdHash)
- 103: function activateVersion(Activation calldata activation) external returns (bytes32 versionKey);
- 104: function deactivateVersion(bytes32 versionKey, bytes32 reasonHash) external;
- 105: function publishBallot(
- 113: function resolveBallot(uint256 day)
- 127: function supportedChainId() external view returns (uint256);
- 128: function publisher() external view returns (address);
- 129: function catalogVersion() external view returns (uint256);
- 130: function activationGeneration(bytes32 versionKey) external view returns (uint256);
- 131: function ballotActivationGeneration(uint256 day) external view returns (uint256);
- 132: function versionCount() external view returns (uint256);
- 133: function versionKeyAt(uint256 index) external view returns (bytes32);
- 134: function getVersion(bytes32 versionKey) external view returns (AssetVersion memory);
- 135: function activeVersionForTickerHash(bytes32 tickerHash) external view returns (bytes32);
- 136: function activeVersionForToken(address token) external view returns (bytes32);
- 137: function activeVersionForProviderIdHash(bytes32 providerIdHash) external view returns (bytes32);
- 138: function setPublisher(address publisher_) external;
- 139: function getBallot(uint256 day) external view returns (Ballot memory);

## omerta-contracts/src/market-v2/IOmertaMarketStateV2.sol
- 7: interface IOmertaMarketStateV2 {
- 20: function snapshot() external view returns (Snapshot memory);

## omerta-contracts/src/market-v2/OmertaArbitrageV2.sol
- 21: contract OmertaArbitrageV2 is IUnlockCallback, ReentrancyGuard {
- 89: function poolKey() external view returns (PoolKey memory) {
- 93: function hashPlan(address solver, Plan calldata plan) public view returns (bytes32) {
- 97: function commit(bytes32 planHash) external {
- 103: function execute(Plan calldata plan) external payable nonReentrant returns (uint256 profit) {
- 129: function unlockCallback(bytes calldata data) external returns (bytes memory) {
- 150: function claim(address payable receiver) external nonReentrant {
- 155: function claimFor(address payable beneficiary) external nonReentrant {
- 159: function _claim(address beneficiary, address payable receiver) private {

## omerta-contracts/src/market-v2/OmertaCommitmentVaultV2.sol
- 19: interface ICommitmentPositionManagerV2 is IPositionManager {
- 20: function ownerOf(uint256 tokenId) external view returns (address);
- 21: function safeTransferFrom(address from, address to, uint256 tokenId) external;
- 30: contract OmertaCommitmentVaultV2 is Ownable2Step, ReentrancyGuard, IERC721Receiver {
- 108: function campaign(uint64 id) external view returns (Campaign memory) { return _campaigns[id]; }
- 109: function commitment(uint256 id) external view returns (Commitment memory) { return commitments[id]; }
- 111: function createCampaign(CampaignTerms calldata terms) external payable onlyOwner returns (uint64 id) {
- 124: function fundCampaign(uint64 id) external payable {
- 132: function setPaused(bool value) external onlyOwner {
- 137: function commit(uint256 tokenId, uint64 campaignId, uint32 duration) external nonReentrant {
- 162: function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata) external view returns (bytes4) {
- 169: function checkpoint(uint256 tokenId) external nonReentrant {
- 178: function withdraw(uint256 tokenId, address recipient) external nonReentrant {
- 188: function claimReward(address payable recipient) external nonReentrant {
- 200: function recoverUnusedBudget(uint64 id, address payable recipient) external onlyOwner nonReentrant {
- 212: function usefulDepth(uint256 tokenId, IOmertaMarketStateV2.Snapshot memory s, uint24 halfWidth)
- 230: function _checkpoint(uint256 tokenId, Commitment storage p) internal {
- 267: function _breakAnchor(uint256 tokenId, Commitment storage p) internal {

## omerta-contracts/src/market-v2/OmertaGameSettlementV2.sol
- 10: contract OmertaGameSettlementV2 is ReentrancyGuard {
- 28: modifier onlyGame() {
- 33: function bindRegistry(OmertaTurfV2 registry_) external {
- 43: function registerLane(OmertaTurfFeeBridgeV2 bridge) external {
- 63: function activeLanes() external view returns (OmertaTurfFeeBridgeV2[] memory) {
- 68: function archiveLane(uint256 index) external nonReentrant {
- 77: function setFamilyTreasury(uint64 family, address treasury, uint64 expectedRevision)
- 90: function settleOwnership(
- 102: function settleStatus(
- 115: function startSiege(
- 129: function resolveSiege(uint64 season, uint32 turf, bool attackerWon, uint64 revision, uint64 epoch, bytes32 receipt)
- 139: function expireSiege(uint64 season, uint32 turf) external nonReentrant {
- 146: function _checkpoint(uint64 season, uint32 turf) private {

## omerta-contracts/src/market-v2/OmertaGenesisCoordinatorV2.sol
- 22: interface IGenesisGatedAuction {
- 23: function checkpoint() external;
- 24: function lbpInitializationParams() external view returns (uint256, uint256, uint256);
- 25: function fundsRecipient() external view returns (address);
- 26: function launchGate() external view returns (address);
- 27: function token() external view returns (address);
- 28: function currency() external view returns (address);
- 29: function claimsReady() external view returns (bool);
- 30: function startBlock() external view returns (uint64);
- 31: function blockNumberish() external view returns (uint256);
- 32: function sweepCurrency() external;
- 35: interface IGenesisMarketHook {
- 36: function authorized() external view returns (address);
- 37: function poolKey() external view returns (PoolKey memory);
- 43: contract OmertaGenesisCoordinatorV2 is IGenesisPlayerIntegration, ReentrancyGuard {
- 97: function poolKey() external view returns (PoolKey memory) { return _key; }
- 100: function bind(IGenesisGatedAuction auction_, GenesisPlayerSale sale_) external {
- 119: function checkpointAuction() external nonReentrant {
- 127: function playerClaimsOpen() external view override returns (bool) {
- 131: function migrate() external nonReentrant {
- 140: function finalizePlayerProceeds() external payable override {
- 147: function migratePublicAfterCancellation() external nonReentrant {
- 152: function _initializeLiquidity(uint256 playerProceeds) private {
- 210: function withdrawResidual() external nonReentrant {
- 216: function recoverTokenDust() external nonReentrant {

## omerta-contracts/src/market-v2/OmertaHookV2.sol
- 27: contract OmertaHookV2 is IHooks, IInitializerHook, IOmrV4ObservationSource, ReentrancyGuard {
- 146: modifier onlyPoolManager() {
- 155: function poolKey() public view returns (PoolKey memory) {
- 159: function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
- 164: function getHookPermissions() external pure returns (Hooks.Permissions memory p) {
- 174: function beforeInitialize(address sender, PoolKey calldata key, uint160)
- 182: function afterInitialize(address, PoolKey calldata key, uint160, int24 tick)
- 197: function beforeSwap(address, PoolKey calldata key, SwapParams calldata, bytes calldata)
- 208: function afterSwap(address sender, PoolKey calldata key, SwapParams calldata params, BalanceDelta delta, bytes calldata)
- 217: function _collectFee(address sender, PoolKey calldata key, SwapParams calldata params, BalanceDelta delta)
- 242: function afterAddLiquidity(address, PoolKey calldata key, ModifyLiquidityParams calldata, BalanceDelta, BalanceDelta, bytes calldata)
- 249: function afterRemoveLiquidity(address, PoolKey calldata key, ModifyLiquidityParams calldata, BalanceDelta, BalanceDelta, bytes calldata)
- 257: function sweep(Currency currency, uint8 bucket) external nonReentrant returns (uint256 amount) {
- 263: function claim(Currency currency, uint8 bucket, address destination) external nonReentrant returns (uint256 amount) {
- 269: function _pay(Currency currency, uint8 bucket, address destination) private returns (uint256 amount) {
- 278: function checkpoint() external {
- 282: function latestEpoch() external view returns (Epoch memory) { return _latest; }
- 283: function activeEpoch() external view returns (Epoch memory) { return _active; }
- 285: function currentTickCumulative(PoolId id) external view returns (int56 cumulative, uint32 timestamp, bool ready) {
- 292: function _checkPool(PoolKey calldata key) private view {
- 299: function _afterLiquidity(PoolKey calldata key) private {
- 305: function _adoptPoolState(PoolId id) private {
- 310: function _openingRate(uint256 actualQuote, bool exactOutput) private view returns (uint16) {
- 324: function _surgeRate() private returns (uint16 rate) {
- 346: function _accrueBase(Currency currency, uint256 base) private {
- 357: function _abs(int128 value) private pure returns (uint256) {
- 361: function _saturatingAdd(uint128 value, uint256 addition) private pure returns (uint128) {
- 366: function _newEpoch(uint64 id) private view returns (Epoch memory e) {
- 372: function _integrate(Epoch memory e, uint32 seconds_) private view returns (Epoch memory) {
- 383: function _advance() private {
- 403: function beforeAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata) external pure returns (bytes4) { revert HookNotImplemented(); }
- 404: function beforeRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata) external pure returns (bytes4) { revert HookNotImplemented(); }
- 405: function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external pure returns (bytes4) { revert HookNotImplemented(); }
- 406: function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external pure returns (bytes4) { revert HookNotImplemented(); }

## omerta-contracts/src/market-v2/OmertaInventoryBondV2.sol
- 20: contract OmertaInventoryBondV2 is ReentrancyGuard {
- 144: function fundInventory(uint256 amount) external nonReentrant {
- 153: function setPaused(bool value) external {
- 162: function purchase(uint64 expectedEpoch, uint256 minimumOmr, uint64 deadline, bytes32 nonce)
- 205: function quote(uint256 nativeAmount, uint64 expectedEpoch) external view returns (uint256 amount) {
- 212: function claim(bytes32 id) external nonReentrant returns (uint256 amount) {
- 222: function claimable(bytes32 id) public view returns (uint256) {
- 230: function claimProceeds() external nonReentrant {
- 241: function retireInventory(uint256 amount) external nonReentrant {
- 249: function _price(uint256 nativeAmount, uint256 omrPerEth) private view returns (uint256) {
- 255: function _observation(uint64 epoch) private view returns (IOmertaMarketStateV2.Snapshot memory s) {

## omerta-contracts/src/market-v2/OmertaMarketStateV2.sol
- 14: contract OmertaMarketStateV2 is IOmertaMarketStateV2 {
- 35: function refresh() external returns (Snapshot memory reading) {
- 73: function snapshot() public view returns (Snapshot memory reading) {

## omerta-contracts/src/market-v2/OmertaReserveFundingV2.sol
- 12: contract OmertaReserveFundingV2 is ReentrancyGuard {
- 37: function bindController(Controller controller_) external {
- 49: function flush() external nonReentrant {

## omerta-contracts/src/market-v2/OmertaStabilityControllerV2.sol
- 26: contract OmertaStabilityControllerV2 is ReentrancyGuard, IUnlockCallback {
- 236: function poolKey() external view returns (PoolKey memory) {
- 240: function limits(Tranche t) external view returns (Limits memory) {
- 244: function account(Tranche t) external view returns (Account memory) {
- 248: function position(Tranche t) external view returns (Position memory) {
- 254: function fund(Tranche t, uint256 omrAmount) external payable nonReentrant {
- 267: function setPaused(bool value) external {
- 275: function deploy(Tranche t, uint64 expectedEpoch) external nonReentrant {
- 315: function collect(Tranche t) external nonReentrant {
- 321: function exit(Tranche t) external nonReentrant {
- 328: function expireTurf() external nonReentrant {
- 335: function finalize(Tranche t) external nonReentrant {
- 344: function _exit(Tranche t) private {
- 354: function claimFees(Tranche t) external nonReentrant {
- 370: function observeRecovery(Tranche t, uint64 expectedEpoch) external nonReentrant {
- 395: function regenerate(Tranche t, uint64 expectedEpoch) external nonReentrant {
- 428: function retire(Tranche t, uint256 nativeAmount, uint256 omrAmount) external nonReentrant {
- 440: function positionInventory(Tranche t) external view returns (uint256 nativeAmount, uint256 omrAmount) {
- 454: function previewRange(Tranche t, uint64 expectedEpoch) external view returns (int24 lower, int24 upper) {
- 459: function _observation(uint64 epoch) private view returns (IOmertaMarketStateV2.Snapshot memory s) {
- 474: function _updateRegime(IOmertaMarketStateV2.Snapshot memory s) private {
- 486: function _range(Tranche t, IOmertaMarketStateV2.Snapshot memory s) private view returns (int24 lower, int24 upper) {
- 520: function _modify(Tranche t, Operation op, uint128 liquidity, uint256 budget0, uint256 budget1) private {
- 527: function unlockCallback(bytes calldata data) external returns (bytes memory) {
- 584: function _settle(Currency currency, int128 delta) private {
- 601: function _send(address to, uint256 amount0, uint256 amount1) private {
- 609: function _downside(Tranche t) private pure returns (bool) {
- 613: function _upside(Tranche t) private pure returns (bool) {
- 617: function _min(uint256 a, uint256 b) private pure returns (uint256) {
- 621: function _popcount(uint32 n) private pure returns (uint256 count) {

## omerta-contracts/src/market-v2/OmertaTurfFeeBridgeV2.sol
- 12: contract OmertaTurfFeeBridgeV2 is ReentrancyGuard {
- 47: function bindSource(OmertaStabilityControllerV2 controller) external {
- 70: function checkpointFees() external nonReentrant {
- 75: function close() external nonReentrant {
- 83: function _checkpoint() private {

## omerta-contracts/src/market-v2/OmertaTurfV2.sol
- 15: contract OmertaTurfV2 is Ownable2Step, ReentrancyGuard {
- 99: function bindFeeSource(address source, uint64 seasonId, uint32 turfId) external onlyOwner {
- 109: function setFamilyTreasury(uint64 family, address treasury, uint64 expectedRevision) external {
- 118: function createSeason(uint64 startsAt, uint64 endsAt) external onlyOwner returns (uint64 id) {
- 127: function createTurf(uint64 seasonId, int24 lower, int24 upper, Split calldata initialOwners)
- 145: function turf(uint64 seasonId, uint32 turfId) external view returns (Turf memory) { return _turfs[seasonId][turfId]; }
- 146: function siege(uint64 seasonId, uint32 turfId) external view returns (Siege memory) { return _sieges[seasonId][turfId]; }
- 148: function settleOwnership(uint64 seasonId, uint32 turfId, Split calldata nextOwners, uint64 expectedRevision,
- 163: function settleStatus(uint64 seasonId, uint32 turfId, uint64 corridors, uint8 fortification, uint16 loyaltyBps,
- 179: function startSiege(uint64 seasonId, uint32 turfId, Split calldata attacker, uint32 duration,
- 196: function resolveSiege(uint64 seasonId, uint32 turfId, bool attackerWon, uint64 expectedRevision,
- 207: function expireSiege(uint64 seasonId, uint32 turfId) external {
- 217: function depositFees(uint64 seasonId, uint32 turfId, uint256 omrAmount) external payable nonReentrant {
- 246: function claim(address payable recipient) external nonReentrant {
- 261: function _settlement(uint64 seasonId, uint32 turfId, uint64 revision, uint64 epoch, bytes32 id)
- 280: function _recipients(Split memory split) internal view returns (Recipients memory r) {
- 298: function _credit(Recipients memory r, uint256 nativeAmount, uint256 omrAmount) internal {
- 311: function _finishSiege(uint64 seasonId, uint32 turfId, bool attackerWon, bool expired) internal {
- 328: function _connected(Turf storage a, Turf storage b, bool right) internal view returns (bool) {
