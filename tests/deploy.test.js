import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const rd = f => readFileSync(f, 'utf8');
test('arquivos de implantação existem', () => { for (const f of ['docker-compose.yml', 'deploy/k8s/20-web.yaml', 'deploy/k8s/30-worker.yaml', 'deploy/k8s/40-ingress.yaml', 'deploy/k8s/kustomization.yaml', 'deploy/oxmgr/oxfile.toml', 'deploy/oxmgr/talk-m3d.service', 'deploy/oxmgr/install.sh', 'deploy/gen-secrets.sh', 'deploy/README.md', 'src/worker.js']) assert.ok(existsSync(f), f); });
test('web sem jobs e worker único em todos os modos', () => {
  assert.match(rd('docker-compose.yml'), /RUN_JOBS: "false"/); assert.match(rd('deploy/k8s/20-web.yaml'), /RUN_JOBS[\s\S]{0,20}"false"/); assert.match(rd('deploy/oxmgr/oxfile.toml'), /RUN_JOBS=false/);
  assert.match(rd('deploy/k8s/20-web.yaml'), /replicas: 1/); assert.match(rd('deploy/k8s/30-worker.yaml'), /replicas: 1/); assert.match(rd('deploy/k8s/20-web.yaml'), /type: Recreate/);
  assert.match(rd('src/server.js'), /RUN_JOBS !== 'false'/);
});
test('limites de recursos e sondas de saúde definidos', () => {
  assert.match(rd('docker-compose.yml'), /mem_limit/); assert.match(rd('deploy/k8s/20-web.yaml'), /limits:/); assert.match(rd('deploy/k8s/20-web.yaml'), /readinessProbe/); assert.match(rd('deploy/oxmgr/talk-m3d.service'), /MemoryMax=/);
  assert.match(rd('src/server.js'), /\/api\/health/); assert.match(rd('src/boot/server.js'), /\/api\/health/);
});
test('oxfile usa só campos documentados e tem os dois processos', () => {
  const t = rd('deploy/oxmgr/oxfile.toml'); assert.equal((t.match(/\[\[apps\]\]/g) || []).length, 2); assert.match(t, /name = "talk-web"/); assert.match(t, /name = "talk-worker"/); assert.match(t, /^version = 1/m);
  for (const m of t.matchAll(/^([a-z_]+) =/gm)) assert.ok(['version', 'name', 'command', 'restart_policy', 'max_restarts', 'stop_timeout_secs'].includes(m[1]), m[1]);
});
test('segredos nunca versionados no k8s', () => { const k = rd('deploy/k8s/kustomization.yaml'); assert.ok(!/secret/i.test(k.split('\n').filter(l => l.startsWith('resources')).join('')) ); assert.match(rd('deploy/k8s/10-secret.example.yaml'), /troque-por/); });
