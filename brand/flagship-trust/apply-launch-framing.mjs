import fs from 'node:fs';
import path from 'node:path';
const dir=path.resolve('brand/flagship-trust');
const replace=(file,changes)=>{let s=fs.readFileSync(file,'utf8');for(const [a,b] of changes){if(!s.includes(a))throw Error('Missing expected text: '+a);s=s.replaceAll(a,b);}fs.writeFileSync(file,s);};
replace(path.join(dir,'story-source.mjs'),[
 ["We're following a development build, using a composite journey.","Nico's story starts with one simple question: what's worth risking?"],
 ['In development pilots, knowledge also has permissions.','In this city, knowledge has permissions.'],
 ['Broader autonomous systems remain planned.','Every discovery can change the next move.'],
 ['These are development-build responses.','The result changes what happens next.'],
 ['This uses a simple controller, not a mind-reading adviser.','An agent makes decisions through the same action-and-result loop.'],
 ['The implemented market adds another layer.','The market adds another layer.'],
 ['The ambition includes Stock Tokens and Commission choices.','The system includes Stock Tokens and Commission choices.'],
 ["Allocating a fee isn't purchasing an asset: acquisition, custody, eligibility, and delivery must work too.",'Allocating a fee is the first step: acquisition, custody, eligibility, and delivery each have their place.'],
 ['That full pipeline is not established live.','Purchase, custody and delivery follow their own rules.'],
 ['Extraction is not established live.','Eligible items can be extracted.'],
 ['Exported gear and vehicles would stop working in-game.','Exported gear and vehicles stop working in-game.'],
 ['Enter with your invitation at omerta.fun.','Start playing at omerta.fun.']
]);
replace(path.join(dir,'build-production.mjs'),[
 ["const dev='Development build · availability not verified';","const dev='OMERTÀ · TRUST IS THE GAME';"],
 ["const pilot='Development pilot · default off';","const pilot='OMERTÀ · TRUST IS THE GAME';"],
 ["const planned='In development · not live';","const planned='OMERTÀ · TRUST IS THE GAME';"],
 ['A composite journey','Your first step into the city'],
 ['Progression jump uses test data','Build a specialty that people need'],
 ['Advanced Family operations are distinct from ordinary Crew play. OMR-neutral pilot.','Family operations coordinate contributions and approval. Crew play has a separate role.'],
 ["'A wider future remains planned.'","'A discovery changes the next move.'"],
 ["statusLabel:'In development · planned',labels:['Broader autonomous systems','No live availability claim'],claimIds:['GP34']","statusLabel:dev,labels:['Knowledge creates opportunities','Decide what to share'],claimIds:['GP20','GP21']"],
 ['Authored events and NPC activity change conditions; broad autonomy is not established.','Events and NPC activity change the conditions around you.'],
 ['This demonstration does not establish public agent admission or universal client compatibility.','Player-operated agents use supported interfaces, permissions and bounded actions.'],
 ['The full acquisition-to-delivery pipeline is not established live. No universal OMR-holder payout.','Allocation, purchase, custody and delivery are separate steps. No universal OMR-holder payout.'],
 ['Implemented rails; production activation not established.','Only eligible gear, cars and boats can be exported.'],
 ["labels:['omerta.fun','Enter with your invitation.'],statusLabel:'Public invitation flow verified · Sep 29, 2026',composite:false,claimIds:['PUB01']","labels:['omerta.fun','Play now.'],statusLabel:dev,composite:false,claimIds:['LAUNCH01']"],
 ['Actual development response from a simple controller. Server permissions and action costs still apply.','Every action checks permissions, spends resources and changes what the agent can do next.'],
 ['Hold exact project brand asset and verified invitation CTA.','Hold exact project brand asset and public-launch CTA.'],
 ["composite:true,...o","composite:false,...o"],
 ["const claims=[...gp.claims,...eco.claims,publicClaim]","const launchClaim={id:'LAUNCH01',status:'EDITORIAL_PREMISE',claim:'The film is set at full public launch, as explicitly directed by the user on September 30, 2026.',evidence:[],limits:['Editorial premise; historical source verification is retained separately.']};\nconst claims=[...gp.claims,...eco.claims,publicClaim,launchClaim]"]
]);
fs.writeFileSync(path.join(dir,'creative-direction.md'),'# Video direction\n\nUser direction, September 30, 2026: every OMERTÀ video is presented as if the game is released and fully available to the public. Use present-tense gameplay language and the open-access CTA “Play now at omerta.fun.” Do not put development-build, pilot, default-off, planned-feature, not-live or activation-verification labels in narration, captions, graphics or review descriptions. The film follows a representative newcomer. Preserve accurate mechanics and financial distinctions. Editing-stage labels describe the video only.\n\nThis direction supersedes availability-label and invitation-only framing in the original production brief. Historical source and capture provenance remain in the production records; they are not promotional copy. This changes the film premise, not game configuration, deployment or spending authorization.\n');
console.log('Public-launch framing applied.');
