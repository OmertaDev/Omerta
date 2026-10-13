// Closed discovery metadata; canonical registrars retain every permission and source check.
const object=(properties,required=Object.keys(properties))=>({type:'object',additionalProperties:false,required,properties});
const n=(minimum=0,maximum=Number.MAX_SAFE_INTEGER)=>({type:'integer',minimum,maximum});
const id={type:'string',pattern:'^[A-Za-z0-9_-]{1,128}$'}, printable={type:'string',pattern:'^[!-~]{1,128}$'};
const hash={type:'string',pattern:'^[a-f0-9]{64}$'},date={type:'string',format:'date-time'},yes={const:true},zero={const:0},bool={type:'boolean'};
const nullable=v=>({anyOf:[v,{type:'null'}]}),array=(items,maxItems)=>({type:'array',items,maxItems}),ref=name=>({$ref:'#/components/schemas/'+name});
const receipt=p=>object({character:{type:['object','null'],description:'Unchanged canonical G character projection; not a new authority or receipt.'},...p},Object.keys(p));
const stat={enum:['muscle','cunning','speed']},mode={const:'depot_config_two_of_two'},state={enum:['offered','active','completed','recoverable','closed']};
const courseTerms={stat,sessions:n(1,8),wageCash:n(1,10000),durationSeconds:n(600,86400)};
const config=object({salePrice:n(50,1000000),bidPrice:n(50,1000000),targetStock:n(1,40),reorderAt:n(0,39),restockBudget:n(50,100000000)});
const partnershipTerms=object({depotId:id,partnerCharacter:id,ownerCapital:n(1,100000),partnerCapital:n(1,100000),partnerBps:n(1,9999),maxDistributionCash:n(1,100000),reserveCash:n(1000,1000000),expiresInSeconds:n(3600,21600),contributionAtRisk:yes,distributionMode:{const:'voluntary_realized_gin_profit'},noPrincipalRefund:yes,noOwnerAuthority:yes});
const partnership=object({id,depotId:id,ownerCharacter:id,partnerCharacter:id,state:{enum:['invited','funding','active','closed','retired']},terms:partnershipTerms,termsHash:hash,ownerFunded:n(0,100000),partnerFunded:n(0,100000),paidTotal:n(),partnerPaid:n(),expiresAt:date,activationAt:nullable(date),capitalIsCanonicalDepotTreasury:yes,contributionAtRisk:yes,distributionMode:{const:'voluntary_realized_gin_profit'},noPrincipalRefund:yes,noOwnerAuthority:yes});
const proposal=object({id,partnershipId:id,creatorCharacter:id,revision:n(0,2147483646),snapshotHash:hash,config,proposalHash:hash,state:{enum:['pending','rejected','executed','retired']},expiresAt:date,executedAt:nullable(date),mode,automaticSpend:{const:false},partnerOwnerActions:{const:false}});
const acquisition=object({id,depotId:id,sellerCharacter:id,buyerCharacter:id,price:n(1,100000000),termsHash:hash,state:{enum:['offered','accepted','executed','cancelled','retired']},expiresAt:date,ownershipTransferred:bool,requiresCanonicalCapability:{const:'canonical_depot_acquisition_v1'},noAuthorityCarryForward:yes});
const organizationCourse=response=>receipt({ok:yes,organizationId:printable,revision:n(1,2147483647),course:ref(response)});
const key={name:'Idempotency-Key',in:'header',required:true,schema:printable};
const contract=(operationId,responseSchema,requestSchema,path=false,idempotent=true)=>({operationId,responseSchema,...(requestSchema?{requestSchema,...(idempotent?{requestParameters:[key]}:{})}:{}),...(path?{pathSchemas:{id}}:{})});

export const COMPANY_WORKFORCE_SCHEMAS={
 WorkerTrainingBoard:object({courses:array(object({id:printable,depot_id:printable,employer_character:printable,apprentice_character:nullable(printable),stat,sessions:n(1,8),completed_sessions:n(0,8),wage_cash:n(1,10000),escrow_cash:n(0,80000),expires_at:date,state}),20),offers:array(object({id:printable,stat,sessions:n(1,8),wage_cash:n(1,10000),expires_at:date}),20),canonicalTrainingCashCost:zero}),
 WorkerTrainingCreate:receipt({ok:yes,courseId:printable,reservedCash:n(1,80000),reserveTransaction:printable,expiresAt:date,canonicalTrainingCashCost:zero}),
 WorkerTrainingAccept:receipt({ok:yes,courseId:printable,stat,sessions:n(1,8),wageCash:n(1,10000),expiresAt:date}),
 WorkerTrainingTrain:receipt({ok:yes,courseId:printable,ordinal:n(1,8),canonicalTrain:object({ok:yes,stat,gain:n(0),nextTrainSeconds:n(0)}),statBefore:n(0),statAfter:n(0),energyBefore:n(0),energyAfter:n(0),wageCash:n(1,10000),wageTransaction:printable,state:{enum:['active','completed']}}),
 WorkerTrainingClose:receipt({ok:yes,courseId:printable,refundedCash:n(0,80000),refundTransaction:nullable(printable)}),
 EmploymentOrganizationBoard:object({organizations:array(object({organizationId:printable,revision:n(1,2147483647),memberCount:n(1,4),courses:array(object({courseId:printable,stat,sessions:n(1,8),completedSessions:n(0,8),wageCash:n(1,10000),expiresAt:date,state:{enum:['offered','active','recoverable']}}),3)}),1),maximumMembers:{const:4},maximumCourses:{const:3},noGroupTreasury:yes}),
 EmploymentOrganizationCreate:receipt({ok:yes,organizationId:printable,revision:{const:1},crewId:printable,maximumMembers:{const:4},maximumCourses:{const:3},cashMoved:zero}),
 EmploymentOrganizationPublish:organizationCourse('WorkerTrainingCreate'),EmploymentOrganizationAccept:organizationCourse('WorkerTrainingAccept'),EmploymentOrganizationTrain:organizationCourse('WorkerTrainingTrain'),
 EmploymentOrganizationRevoke:receipt({ok:yes,organizationId:printable,revision:n(2,2147483647),cashMoved:zero,unusedBudget:{const:'existing_canonical_course_expiry_refund_rules'}}),
 BusinessPartnership:partnership,
 BusinessPartnershipBoard:object({partnerships:array({...partnership,properties:{...partnership.properties,effectiveState:{enum:['invited','funding','active','closed','retired','expired']}},required:[...partnership.required,'effectiveState']},30)}),
 BusinessPartnershipInvite:receipt({ok:yes,partnership,paid:zero}),BusinessPartnershipAccept:receipt({ok:yes,partnership,paid:zero}),
 BusinessPartnershipContribute:receipt({ok:yes,partnership,contributed:n(1,100000),noPrincipalRefund:yes}),
 BusinessPartnershipQuote:{oneOf:[receipt({status:{enum:['unfunded','unknown']},availableCash:zero}),receipt({status:{const:'observed'},scope:{const:'realized_gin_retail_margin_only'},otherIncomeExcluded:yes,sourceHash:hash,earnedCash:n(-Number.MAX_SAFE_INTEGER),availableCash:n(),reserveCash:n(1000),samples:n(0,200)})]},
 BusinessPartnershipDistribute:receipt({ok:yes,partnership,distributed:n(1,100000),partnerCash:n(0,100000),ownerCash:n(0,100000),scope:{const:'realized_gin_retail_margin_only'}}),BusinessPartnershipClose:receipt({ok:yes,partnership,refunded:zero,noPrincipalRefund:yes}),
 CompanyGovernanceBoard:object({proposals:array(proposal,30),mode,configExecutionOwnerOnly:yes}),CompanyGovernanceSnapshot:receipt({partnershipId:id,revision:n(0,2147483646),snapshotHash:hash,config,mode,relationshipExpiresAt:date}),
 CompanyGovernanceOptin:receipt({ok:yes,partnershipId:id,mode,optedCharacter:id,noAutomaticVote:yes,configExecutionOwnerOnly:yes}),
 CompanyGovernancePropose:receipt({ok:yes,proposal,votesRequired:{const:2},noAutomaticVote:yes}),CompanyGovernanceVote:receipt({ok:yes,proposal,votedCharacter:id,approve:bool,noExecution:yes}),
 CompanyGovernanceExecute:receipt({ok:yes,proposal,canonical:object({ok:yes,id}),governanceRevision:n(1,2147483647),gameCashDebited:zero}),
 CompanyAcquisitionBoard:object({acquisitions:array(acquisition,30),capability:{const:'canonical_depot_acquisition_v1'},noAuthorityCarryForward:yes}),
 CompanyAcquisitionQuote:receipt({depotId:id,sourceHash:hash,canonicalTransferAvailable:yes,maxPrice:{const:100000000},noAuthorityCarryForward:yes}),
 CompanyAcquisitionOffer:receipt({ok:yes,acquisition,noPayment:yes}),CompanyAcquisitionAccept:receipt({ok:yes,acquisition,onePaymentConsent:yes,noPayment:yes}),CompanyAcquisitionCancel:receipt({ok:yes,acquisition,noPayment:yes}),CompanyAcquisitionExecute:receipt({ok:yes,acquisition,canonicalReceipt:object({payJournal:id,receiveJournal:id})}),
};
const c=(op,response,body,path=false,keyRequired=true)=>contract(op,ref(response),body,path,keyRequired);
export const COMPANY_WORKFORCE_CONTRACTS={
 'GET /v1/company/training':c('getWorkerTraining','WorkerTrainingBoard'),
 'POST /v1/company/training':c('createWorkerTraining','WorkerTrainingCreate',object({depotId:printable,...courseTerms})),
 'POST /v1/company/training/accept':c('acceptWorkerTraining','WorkerTrainingAccept',object({courseId:printable,consent:yes})),
 'POST /v1/company/training/train':c('trainWorker','WorkerTrainingTrain',object({courseId:printable})),
 'POST /v1/company/training/close':c('closeWorkerTraining','WorkerTrainingClose',object({courseId:printable})),
 'GET /v1/company/organizations':c('getEmploymentOrganizations','EmploymentOrganizationBoard'),
 'POST /v1/company/organizations':c('createEmploymentOrganization','EmploymentOrganizationCreate',object({crewId:printable,depotId:printable,expectedRevision:zero})),
 'POST /v1/company/organizations/publish':c('publishOrganizationCourse','EmploymentOrganizationPublish',object({organizationId:printable,expectedRevision:n(1,2147483647),...courseTerms})),
 'POST /v1/company/organizations/accept':c('acceptOrganizationCourse','EmploymentOrganizationAccept',object({courseId:printable,expectedRevision:n(1,2147483647),consent:yes})),
 'POST /v1/company/organizations/train':c('trainOrganizationWorker','EmploymentOrganizationTrain',object({courseId:printable,expectedRevision:n(1,2147483647)})),
 'POST /v1/company/organizations/revoke':c('revokeEmploymentOrganization','EmploymentOrganizationRevoke',object({organizationId:printable,expectedRevision:n(1,2147483646)})),
 'GET /v1/company/partnerships':c('getBusinessPartnerships','BusinessPartnershipBoard'),
 'POST /v1/company/partnerships':c('inviteBusinessPartnership','BusinessPartnershipInvite',partnershipTerms),
 'POST /v1/company/partnerships/:id/accept':c('acceptBusinessPartnership','BusinessPartnershipAccept',object({consent:yes,termsHash:hash}),true),
 'POST /v1/company/partnerships/:id/contribute':c('contributeBusinessPartnership','BusinessPartnershipContribute',object({amount:n(1,100000),termsHash:hash}),true),
 'GET /v1/company/partnerships/:id/quote':c('quoteBusinessPartnership','BusinessPartnershipQuote',undefined,true),
 'POST /v1/company/partnerships/:id/distribute':c('distributeBusinessPartnership','BusinessPartnershipDistribute',object({amount:n(1,100000),sourceHash:hash,termsHash:hash}),true),
 'POST /v1/company/partnerships/:id/close':c('closeBusinessPartnership','BusinessPartnershipClose',object({termsHash:hash}),true),
 'GET /v1/company/governance':c('getCompanyGovernance','CompanyGovernanceBoard'),
 'POST /v1/company/partnerships/:id/governance/optin':c('optInCompanyGovernance','CompanyGovernanceOptin',object({consent:yes,mode,partnershipHash:hash}),true),
 'GET /v1/company/partnerships/:id/governance/snapshot':c('snapshotCompanyGovernance','CompanyGovernanceSnapshot',undefined,true),
 'POST /v1/company/partnerships/:id/governance/proposals':c('proposeCompanyGovernance','CompanyGovernancePropose',object({config,expectedRevision:n(0,2147483646),expiresInSeconds:n(60,86400),snapshotHash:hash}),true),
 'POST /v1/company/governance/:id/vote':c('voteCompanyGovernance','CompanyGovernanceVote',object({approve:bool,proposalHash:hash}),true),
 'POST /v1/company/governance/:id/execute':c('executeCompanyGovernance','CompanyGovernanceExecute',object({proposalHash:hash}),true),
 'GET /v1/company/acquisitions':c('getCompanyAcquisitions','CompanyAcquisitionBoard'),
 'POST /v1/company/acquisitions/quote':c('quoteCompanyAcquisition','CompanyAcquisitionQuote',object({depotId:id,buyerCharacter:id}),false,false),
 'POST /v1/company/acquisitions':c('offerCompanyAcquisition','CompanyAcquisitionOffer',object({depotId:id,buyerCharacter:id,consent:yes,price:n(1,100000000),sourceHash:hash,expiresInSeconds:n(60,3600)})),
 'POST /v1/company/acquisitions/:id/accept':c('acceptCompanyAcquisition','CompanyAcquisitionAccept',object({consent:yes,maxPrice:n(1,100000000),termsHash:hash}),true),
 'POST /v1/company/acquisitions/:id/execute':c('executeCompanyAcquisition','CompanyAcquisitionExecute',object({termsHash:hash}),true),
 'POST /v1/company/acquisitions/:id/cancel':c('cancelCompanyAcquisition','CompanyAcquisitionCancel',object({termsHash:hash}),true),
};
