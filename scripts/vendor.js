import { readdirSync, copyFileSync, mkdirSync, existsSync } from 'node:fs';
const d = 'node_modules/agora-rtc-sdk-ng/';
if (!existsSync(d)) { console.log('agora-rtc-sdk-ng ausente; pulando'); process.exit(0); }
const f = readdirSync(d).find(x => /^AgoraRTC_N.*\.js$/.test(x) && !/\.map$/.test(x));
mkdirSync('public/vendor', { recursive: true });
if (f) { copyFileSync(d + f, 'public/vendor/agora.js'); console.log('SDK Agora copiado:', f); } else console.log('Arquivo do SDK Agora não encontrado');
