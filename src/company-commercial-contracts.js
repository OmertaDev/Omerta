// Closed discovery DTOs only. Canonical registrars enforce authority, arithmetic and source proofs.
const obj=(properties,required=Object.keys(properties))=>({type:'object',additionalProperties:false,properties,required});
const n=(minimum=0,maximum=Number.MAX_SAFE_INTEGER)=>({type:'integer',minimum,maximum}),id={type:'string',pattern:'^[A-Za-z0-9_-]{1,128}$'},party={type:'string',pattern:'^[A-Za-z0-9:_-]{1,128}$'},text={type:'string',minLength:1,maxLength:128},hash={type:'string',pattern:'^[a-f0-9]{64}$'},date={type:'string',format:'date-time'},yes={const:true},zero={const:0},bool={type:'boolean'};
const nullable=s=>({anyOf:[s,{type:'null'}]}),array=(items,maxItems)=>({type:'array',items,maxItems}),ref=s=>({$ref:'#/components/schemas/'+s}),state=values=>({enum:values});
const replay=properties=>obj({...properties,replayed:yes},Object.keys(properties));
const config=obj({salePrice:n(50,1000000),bidPrice:n(50,1000000),targetStock:n(1,40),reorderAt:n(0,39),restockBudget:n(50,100000000)});
const steps=array({oneOf:[obj({kind:{const:'cancel_order'},orderId:id}),obj({kind:{const:'withdraw'},amount:n(1,100000000)}),obj({kind:{const:'configure'},config})]},3);steps.minItems=1;
const plan={depotId:id,steps,maxWithdrawalCash:n(0,100000000),reserveCash:n(1000,100000000)},planState=state(['ready','executed','cancelled','expired','owner_dead']);
const restructureResult={oneOf:[obj({ok:yes,id}),obj({ok:yes,depotAction:{const:'cash_withdraw'},treasury:n(),withdrawn:n(1,100000000)}),obj({ok:yes,depotAction:{const:'cancel_order'},refunded:n(),awaiting:n(0,40)})]};
const disputeState=state(['proposed','agreed','settled','withdrawn','expired','party_dead']),settlement={const:'consensual_overdue_unstarted_order_unwind'},disputeTerms=obj({disputeId:party,expectedRevision:n(1,3),quoteHash:hash});
const insuranceTerms={coverageSeconds:n(60,604800),maximumCash:n(1,1000),offerSeconds:n(60,86400),premiumCash:n(1,1000),published:bool},product={const:'one_owned_belladonna_maintenance_fee'};
const concessionEffect={const:'paid_rental_workshop_healthy_tool_admission'},territoryEffect={const:'verified_retail_profit_to_original_family'};
const numericSequence={anyOf:[n(),{type:'string',pattern:'^[0-9]+$'}]};
const insurancePolicy=obj({id:text,insurer_account:text,insurer_character:text,insured_account:nullable(text),insured_character:nullable(text),item_id:nullable(text),state:state(['offered','accepted','claimed','recovery','closed']),published:bool,premium_cash:n(1,1000),maximum_cash:n(1,1000),coverage_seconds:n(60,604800),offer_expires_at:date,accepted_at:nullable(date),expires_at:nullable(date),baseline_sequence:nullable(numericSequence),reserve_id:text,premium_debit_id:nullable(text),premium_credit_id:nullable(text),escrow_cash:n(0,1000),paid_cash:n(0,1000),refunded_cash:n(0,1000),burned_cash:n(0,1000),insurer_dead:bool,close_reason:nullable({type:'string'})});
export const COMPANY_COMMERCIAL_SCHEMAS={
 CompanyRestructuringQuote:obj({ok:yes,sourceHash:hash,refundCapital:n(),withdrawCapital:n(),reserveCash:n(1000),stockUnchanged:yes,spentCadenceAuthorityUnchanged:yes}),
 CompanyRestructuringCreate:obj({ok:yes,planId:id,revision:{const:1},expiresAt:date,originalCharacter:id,depotId:id,sourceHash:hash,cashMoved:zero}),
 CompanyRestructuringRun:obj({ok:yes,planId:id,revision:{const:2},depotId:id,originalCharacter:id,sourceHash:hash,refundCapital:n(),withdrawCapital:n(),stock:n(0,40),stockCost:n(),treasury:n(),results:array(restructureResult,3),ledger:array(obj({journal:id,reason:state(['market:refund','depot:withdraw']),amount:n()}),2),spentCadenceAuthorityUnchanged:yes}),
 CompanyRestructuringCancel:obj({ok:yes,planId:id,revision:{const:2},state:{const:'cancelled'},cashMoved:zero}),
 CompanyRestructuringBoard:obj({plans:array(obj({id,depot_id:id,original_character:id,revision:n(1,2),state:planState,expires_at:date,receipt:nullable(ref('CompanyRestructuringRun'))}),20),scope:{const:'private_original_account_history'},effect:{const:'same_depot_capital_unwind_and_configuration'}}),
 CommercialDisputeOpen:obj({ok:yes,disputeId:party,revision:{const:1},quoteHash:hash,expiresAt:date,settlement,currentlyBackedRefund:n(),supplierCompensation:zero,cashMoved:zero}),
 CommercialDisputeConsent:obj({ok:yes,disputeId:party,revision:n(2,4),quoteHash:hash,state:{const:'agreed'},cashMoved:zero}),
 CommercialDisputeSettle:obj({ok:yes,disputeId:party,revision:n(2,4),settlement,releasedUnits:n(1,40),refundedToOriginalDepot:n(),refundJournalId:party,refundTransactionId:party,supplierCompensation:zero,listingFeeRefunded:zero,completedDelivery:{const:false}}),
 CommercialDisputeWithdraw:obj({ok:yes,disputeId:party,revision:n(2,4),state:{const:'withdrawn'},cashMoved:zero}),
 CommercialDisputeBoard:obj({disputes:array(obj({id:party,commitment_id:party,revision:n(1,4),quote_hash:hash,buyer_character:party,supplier_character:party,buyer_consent:bool,supplier_consent:bool,expires_at:date,state:disputeState,settlement_receipt:nullable(ref('CommercialDisputeSettle')),observedState:disputeState}),20),scope:{const:'private_original_party_history'},settlement}),
 EquipmentInsuranceBoard:array(insurancePolicy,50),
 EquipmentInsuranceOffers:array(obj({id:text,premium_cash:n(1,1000),maximum_cash:n(1,1000),coverage_seconds:n(60,604800),offer_expires_at:date}),50),
 EquipmentInsuranceOffer:replay({offerId:text,...insuranceTerms,escrowCash:n(1,1000),product}),
 EquipmentInsuranceAccept:replay({policyId:text,itemId:text,maximumCash:n(1,1000),premiumCash:n(1,1000),baselineSequence:{type:'string',pattern:'^[0-9]+$'},expiresAt:date,product}),
 EquipmentInsuranceClaim:replay({policyId:text,itemId:text,repairId:text,paidFee:n(1,1000),payoutCash:n(1,1000)}),
 EquipmentInsuranceClose:replay({policyId:text,refunded:n(0,1000),burned:n(0,1000),closed:yes}),
 InfrastructureConcessionBoard:obj({concessions:array(obj({concessionId:party,revision:n(1,3),sourceHash:hash,expiresAt:date,state:state(['offered','accepted','cancelled','expired','party_dead']),observedExpired:bool,businessId:nullable(party),itemId:party}),20),scope:{const:'private_original_parties'}}),
 InfrastructureConcessionOffers:obj({offers:array(obj({concessionId:party,revision:n(1,3),sourceHash:hash,expiresAt:date,premisesOfferId:party,rentalOfferId:party,premisesRent:n(1),rentalRent:n(1),rentalDeposit:n(),effect:concessionEffect,minimumCondition:{const:80}}),20)}),
 InfrastructureConcessionPublish:obj({ok:yes,concessionId:party,revision:{const:1},sourceHash:hash,expiresAt:date,effect:concessionEffect,cashMoved:zero,acquireSourcesThroughCanonicalAPIs:yes}),
 InfrastructureConcessionAccept:obj({ok:yes,concessionId:party,revision:{const:2},sourceHash:hash,businessId:party,itemId:party,expiresAt:date,effect:concessionEffect,minimumCondition:{const:80},cashMoved:zero,title:{const:'original_landlord_account'},canonicalInputsCostsOutputsUnchanged:yes}),
 InfrastructureConcessionCancel:obj({ok:yes,concessionId:party,revision:n(2,3),state:{const:'cancelled'},cashMoved:zero,canonicalLeaseRecovery:{const:'unchanged_source_APIs'}}),
 TerritoryEconomicsBoard:obj({profiles:array(obj({businessId:party,revision:n(1),enabled:bool,shareBps:n(1,2000),dailyCapCash:n(100,5000),lifetimeCapCash:n(100,10000),paidCash:n(),expiresAt:date,state:state(['active','closed','party_dead'])}),10),scope:{const:'private_original_account'},effect:territoryEffect}),
 TerritoryEconomicsConfigure:obj({ok:yes,businessId:party,revision:n(1,1000001),enabled:bool,expiresAt:date,effect:territoryEffect,cashMoved:zero}),
 TerritoryEconomicsRun:{oneOf:[obj({ok:yes,businessId:party,revision:n(1),paidCash:zero,eligibleProfit:n(),state:{const:'below_minimum_or_cap'},minimumCash:{const:100}}),obj({ok:yes,businessId:party,revision:n(1),paymentId:party,paidCash:n(100,5000),eligibleProfit:n(1),state:{const:'paid'},sourceSales:n(1)})]},
 TerritoryEconomicsClose:obj({ok:yes,businessId:party,revision:n(1,1000001),state:{const:'closed'},cashMoved:zero}),
};
const key={name:'Idempotency-Key',in:'header',required:true,schema:{type:'string',pattern:'^[!-~]{1,128}$'}};
const c=(operationId,response,requestSchema,path=false,needsKey=true)=>({operationId,responseSchema:ref(response),...(requestSchema?{requestSchema,...(needsKey?{requestParameters:[key]}:{})}:{}),...(path?{pathSchemas:{id:text}}:{})});
export const COMPANY_COMMERCIAL_CONTRACTS={
 'GET /v1/company/restructuring':c('getCompanyRestructuring','CompanyRestructuringBoard'),
 'POST /v1/company/restructuring/quote':c('quoteCompanyRestructuring','CompanyRestructuringQuote',obj(plan),false,false),
 'POST /v1/company/restructuring':c('createCompanyRestructuring','CompanyRestructuringCreate',obj({...plan,expiresInSeconds:n(5,600),sourceHash:hash,consent:yes})),
 'POST /v1/company/restructuring/:id/run':c('runCompanyRestructuring','CompanyRestructuringRun',obj({expectedRevision:{const:1},sourceHash:hash}),true),
 'POST /v1/company/restructuring/:id/cancel':c('cancelCompanyRestructuring','CompanyRestructuringCancel',obj({expectedRevision:{const:1},sourceHash:hash}),true),
 'GET /v1/company/disputes':c('getCommercialDisputes','CommercialDisputeBoard'),
 'POST /v1/company/disputes/open':c('openCommercialDispute','CommercialDisputeOpen',obj({commitmentId:party,expiresInSeconds:n(60,600),consent:yes})),
 'POST /v1/company/disputes/consent':c('consentCommercialDispute','CommercialDisputeConsent',disputeTerms),
 'POST /v1/company/disputes/settle':c('settleCommercialDispute','CommercialDisputeSettle',disputeTerms),
 'POST /v1/company/disputes/withdraw':c('withdrawCommercialDispute','CommercialDisputeWithdraw',disputeTerms),
 'GET /v1/company/equipment-insurance':c('getEquipmentInsurance','EquipmentInsuranceBoard'),
 'GET /v1/company/equipment-insurance/offers':c('getEquipmentInsuranceOffers','EquipmentInsuranceOffers'),
 'POST /v1/company/equipment-insurance':c('offerEquipmentInsurance','EquipmentInsuranceOffer',obj(insuranceTerms)),
 'POST /v1/company/equipment-insurance/accept':c('acceptEquipmentInsurance','EquipmentInsuranceAccept',obj({consent:yes,itemId:text,maximumCash:n(1,1000),offerId:text,premiumCash:n(1,1000)})),
 'POST /v1/company/equipment-insurance/claim':c('claimEquipmentInsurance','EquipmentInsuranceClaim',obj({policyId:text,repairId:text,wearEventId:text})),
 'POST /v1/company/equipment-insurance/:id/close':c('closeEquipmentInsurance','EquipmentInsuranceClose',{type:'object',additionalProperties:false,properties:{}},true),
 'GET /v1/company/concessions':c('getInfrastructureConcessions','InfrastructureConcessionBoard'),
 'GET /v1/company/concessions/offers':c('getInfrastructureConcessionOffers','InfrastructureConcessionOffers'),
 'POST /v1/company/concessions/publish':c('publishInfrastructureConcession','InfrastructureConcessionPublish',obj({premisesOfferId:party,rentalOfferId:party,expiresInSeconds:n(60,3600),published:bool})),
 'POST /v1/company/concessions/accept':c('acceptInfrastructureConcession','InfrastructureConcessionAccept',obj({concessionId:party,expectedRevision:n(1,3),sourceHash:hash,premisesLeaseId:party,rentalLeaseId:party,businessId:party,consent:yes})),
 'POST /v1/company/concessions/cancel':c('cancelInfrastructureConcession','InfrastructureConcessionCancel',obj({concessionId:party,expectedRevision:n(1,3),sourceHash:hash})),
 'GET /v1/company/territory-economics':c('getTerritoryEconomics','TerritoryEconomicsBoard'),
 'POST /v1/company/territory-economics/configure':c('configureTerritoryEconomics','TerritoryEconomicsConfigure',obj({businessId:party,expectedRevision:n(0,1000000),shareBps:n(1,2000),dailyCapCash:n(100,5000),lifetimeCapCash:n(100,10000),expiresInSeconds:n(60,3600),enabled:bool})),
 'POST /v1/company/territory-economics/run':c('runTerritoryEconomics','TerritoryEconomicsRun',obj({businessId:party,expectedRevision:n(0,1000000)})),
 'POST /v1/company/territory-economics/close':c('closeTerritoryEconomics','TerritoryEconomicsClose',obj({businessId:party,expectedRevision:n(0,1000000)})),
};
