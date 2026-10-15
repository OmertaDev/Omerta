import fs from 'node:fs';
import path from 'node:path';
const here=path.resolve('brand/market-v2-soul');
fs.mkdirSync(path.join(here,'generation-requests'),{recursive:true});
let runner=fs.readFileSync('brand/market-v2-film/fal-session.mjs','utf8').replaceAll('market-v2-film','market-v2-soul');
runner=runner.replace("const key=process.env.FAL_KEY?.trim();\ndelete process.env.FAL_KEY;", "const lines=readline.createInterface({input:process.stdin,crlfDelay:Infinity});\nlet key=process.env.FAL_KEY?.trim();\ndelete process.env.FAL_KEY;\nif(!key){console.log('Waiting for process-only credential');key=(await new Promise(resolve=>lines.once('line',resolve))).trim();}");
runner=runner.replace("const lines=readline.createInterface({input:process.stdin,crlfDelay:Infinity});\nfor await", "for await");
fs.writeFileSync(path.join(here,'fal-session.mjs'),runner);
const spoken="Everybody wants control of the city. But control costs. In Oh-MAIR-tah, a trade changes what the reserves actually hold. And when they run thin... a price bounce won't refill them. The next move has to be paid for.";
const directions=[
 {id:'SOUL-VOICE-A',name:'Warm, low storyteller',description:'Original male voice, mature age 40 to 50, warm low baritone with a small amount of lived-in grain. Intimate close-microphone storytelling, calm confidence, restrained danger and warmth. Natural general American speech with a faint East Coast character. Conversational changes in cadence, small breaths, expressive emphasis, dry human humor. Speak to one person across a quiet table. Never a bombastic movie trailer announcer, never a growl or whisper, never robotic, never flat or cold. Clear consonants and comfortable natural pace. No imitation of any real person.'},
 {id:'SOUL-VOICE-B',name:'Younger voice with swagger',description:'Original male voice, age 25 to 32, medium-low register, energetic but relaxed, lightly textured and street-smart. Natural contemporary American speech, quick wit, a small knowing smile and effortless conversational swagger. Vary rhythm like telling a friend an incredible true story. Crisp intelligibility with unforced emphasis and a few natural breaths. Confident without shouting, no influencer hype, no announcer voice, no exaggerated accent, no singing, no robot cadence. No imitation of any real person.'},
 {id:'SOUL-VOICE-C',name:'Smooth, understated narrator',description:'Original male voice, age 35 to 45, smooth rich baritone with quiet sophistication and emotional warmth. Neutral American accent. Calm, intimate, observant and subtly amused, as if sharing an inside story after hours. Natural connected phrases, elegantly varied intonation, controlled pauses and precise consonants. Understated cinematic narration that feels like a person thinking aloud. Not cold or corporate, not a newsreader, not breathy ASMR, not artificially deep. No imitation of any real person.'}
];
fs.writeFileSync(path.join(here,'voice-directions.json'),JSON.stringify({text:spoken.replace('Oh-MAIR-tah','OMERTÀ'),spoken,directions},null,2)+'\n');
fs.writeFileSync(path.join(here,'generation-requests/voice-designs.json'),JSON.stringify(directions.map(d=>({id:d.id,model:'fal-ai/minimax/voice-design',folder:'voice-design',ext:'mp3',input:{prompt:d.description,preview_text:spoken}})),null,2)+'\n');
console.log('Three original voice directions prepared.');
