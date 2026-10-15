import {spawn} from 'node:child_process';
import path from 'node:path';
const allowed=['PATH','SystemRoot','WINDIR','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','COMSPEC','PATHEXT'];
const env=Object.fromEntries(allowed.filter(key=>process.env[key]).map(key=>[key,process.env[key]]));
const child=spawn(process.execPath,[path.resolve('brand/flagship-trust/capture-fixture.mjs')],{env,stdio:'inherit',windowsHide:true});
child.on('exit',code=>process.exit(code ?? 1));
