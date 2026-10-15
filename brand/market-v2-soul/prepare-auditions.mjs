import fs from 'node:fs';
const ledger=JSON.parse(fs.readFileSync('public/art/market-v2-soul/generation-ledger.json'));
const directions=JSON.parse(fs.readFileSync('brand/market-v2-soul/voice-directions.json'));
const prompt=directions.spoken.replace('city. But','city. <#0.30#> But').replace('costs. In','costs. <#0.35#> In').replace('thin...','thin, <#0.28#>');
const jobs=directions.directions.map(d=>{
 const voice=ledger.jobs[d.id]?.result?.custom_voice_id;if(!voice)throw Error('Missing generated voice '+d.id);
 return{id:d.id.replace('VOICE','SAMPLE'),model:'fal-ai/minimax/speech-2.8-hd',folder:'audio',ext:'mp3',input:{prompt,voice_setting:{voice_id:voice,speed:1,pitch:0,vol:1,english_normalization:false},audio_setting:{sample_rate:44100,bitrate:256000,format:'mp3',channel:1},output_format:'url'}};
});
fs.writeFileSync('brand/market-v2-soul/generation-requests/auditions.json',JSON.stringify(jobs,null,2)+'\n');
console.log('Three Speech 2.8 HD auditions prepared.');
