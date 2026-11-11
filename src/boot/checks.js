// Verificações do servidor antes da instalação. Cada item explica POR QUE importa (why) e COMO resolver (fix).
import os from 'node:os';
import { accessSync, constants, existsSync } from 'node:fs';
import dns from 'node:dns/promises';
import { dataDir, originOf } from './config.js';
const item = (id, t, ok, level, detail, why, fix) => ({ id, t, ok: !!ok, level, detail, why, fix });
export async function bootChecks(req) {
  const C = [], h = req.headers || {}, proto = String(h['x-forwarded-proto'] || 'http').split(',')[0], origin = originOf(h);
  C.push(item('node', 'Node.js 22 ou superior', +process.versions.node.split('.')[0] >= 22, 'req', 'Versão ' + process.versions.node, 'O sistema usa recursos modernos do Node (módulos ES, fetch, crypto). Versões antigas falham ao iniciar.', 'Use a imagem node:22 do Dockerfile (docker compose build --no-cache app).'));
  let w = false; try { accessSync(dataDir(), constants.W_OK); w = true; } catch { /* sem escrita */ }
  C.push(item('data', 'Pasta de configuração com permissão de escrita', w, 'req', dataDir(), 'É onde o instalador guarda as chaves de segurança que você vai gerar. Sem escrita, a instalação não pode ser salva e se perderia a cada reinício.', 'No docker-compose.yml mantenha o volume "appdata:/app/data". Fora do Docker: mkdir -p data && chown seu_usuario data.'));
  C.push(item('mem', 'Memória de 512 MB ou mais', os.totalmem() >= 480 * 2 ** 20, 'rec', Math.round(os.totalmem() / 2 ** 20) + ' MB', 'O servidor, a criptografia de senhas (argon2) e a geração de PDFs consomem memória; abaixo disso podem ocorrer quedas durante consultas.', 'Use um servidor com 1 GB ou mais.'));
  C.push(item('root', 'Roda sem privilégio de root', typeof process.getuid === 'function' && process.getuid() !== 0, 'rec', 'uid ' + (process.getuid ? process.getuid() : '?'), 'Se alguém explorar uma falha no app, um processo sem privilégios limita o estrago ao próprio contêiner.', 'Mantenha "USER node" no Dockerfile.'));
  C.push(item('tz', 'Fuso horário definido (TZ)', !!process.env.TZ, 'rec', process.env.TZ || 'não definido (UTC)', 'Lembretes de consulta, agenda e relatórios usam a hora local. Sem TZ, tudo aparece no horário de Londres.', 'Escolha o fuso na etapa "Endereço" (ex.: America/Sao_Paulo).'));
  C.push(item('proxy', 'Proxy HTTPS (Caddy) na frente do app', proto === 'https', 'rec', proto === 'https' ? 'HTTPS detectado' : 'Acesso por HTTP (sem criptografia)', 'Dados de saúde não podem trafegar sem criptografia, e o login por cookie seguro exige HTTPS. Em HTTP, qualquer pessoa na rede pode ler as senhas.', 'Aponte o domínio para este servidor e execute: echo "DOMAIN=seu.dominio" >> .env && docker compose up -d caddy (o certificado é emitido sozinho). Você pode instalar agora por HTTP e migrar depois.'));
  C.push(item('host', 'Endereço de acesso reconhecido', !!origin, 'req', origin || 'não foi possível ler o endereço', 'O sistema só aceita comandos vindos do próprio endereço (proteção contra sites falsos). Precisamos saber qual é o seu.', 'Acesse pelo endereço definitivo (domínio ou IP:porta) e não por túneis temporários.'));
  C.push(item('sdk', 'SDK de vídeo (Agora) presente', existsSync(new URL('../../public/vendor/agora.js', import.meta.url)), 'rec', 'public/vendor/agora.js', 'É o componente do navegador que faz a videochamada. Sem ele, a teleconsulta por vídeo não abre (chat e agenda continuam).', 'Refaça o build: docker compose build --no-cache app.'));
  let net = false, nd = ''; try { await Promise.race([dns.lookup('registry.npmjs.org'), new Promise((_, r) => setTimeout(() => r(new Error('t')), 3000))]); net = true; nd = 'DNS externo funcionando'; } catch { nd = 'sem resolução de nomes externa'; }
  C.push(item('net', 'Acesso de saída à internet (DNS)', net, 'req', nd, 'O banco Neon, o Agora, a IA e o PayPal ficam fora do seu servidor. Sem saída para a internet, nenhum deles funciona.', 'Libere a saída (portas 443 e 5432) no firewall e confira o DNS do servidor (cat /etc/resolv.conf).'));
  return C;
}
