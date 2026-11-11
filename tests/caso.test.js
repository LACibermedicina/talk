import test from 'node:test';
import assert from 'node:assert/strict';
import { compileCase, buildPrompt, countryOf, initials, KINDS } from '../src/caseLogic.js';
const D = () => ({
  patient: { name: 'Sofia Almeida Souza' }, summary: { allergies: ['dipirona'], chronic: ['HAS'], meds: ['losartana'] },
  clinical: [{ created_at: '2026-01-02', approved: true, author: 'Dra. Ana', content: { queixa: 'Dor no joelho direito', sintomas: ['edema'], orientacoes: ['gelo'] } }, { created_at: '2026-02-01', approved: false, author: 'IA', content: { queixa: 'RASCUNHO NÃO APROVADO' } }, { created_at: '2025-06-01', approved: true, author: 'Dra. Ana', content: { queixa: 'Entorse antiga' } }],
  evolution: [{ at: '2026-01-02', eva: 8 }, { at: '2026-02-10', eva: 4, note: 'melhora' }], goal: { description: 'Subir escadas', target: 2, due: '2026-04-01' },
  adesao: [{ title: 'Agachamento', freq_per_week: 3, feitas_7d: 2 }], appointments: [{ starts_at: '2026-01-02', status: 'finalizado', professional: 'Carla' }, { starts_at: '2026-01-09', status: 'faltou' }],
  documents: [{ kind: 'receita', created_at: '2026-01-02', author: 'Dra. Ana' }], alerts: [{ kind: 'baixa_adesao' }], team: [{ name: 'Dra. Ana', role: 'médica' }]
});
test('caso: só registros aprovados entram e o nome não vai para o texto da IA', () => {
  const c = compileCase(D()); assert.ok(!c.text.includes('RASCUNHO')); assert.ok(!c.text.includes('Sofia')); assert.ok(c.presentation.includes('Sofia'));
  assert.ok(c.text.includes('Dor no joelho')); assert.equal(c.facts.eva.trend, 'queda'); assert.equal(c.facts.consultas.faltas, 1);
});
test('caso: história completa inclui linha do tempo e registros antigos; caso atual limita', () => {
  const a = compileCase(D(), { full: true }), b = compileCase(D(), { full: false });
  assert.ok(a.text.includes('Linha do tempo')); assert.ok(a.text.includes('Entorse antiga')); assert.ok(!b.text.includes('Linha do tempo')); assert.ok(a.timeline.length >= b.timeline.length);
});
test('caso: dados vazios não quebram', () => { const c = compileCase({}); assert.equal(c.patient.name, 'Paciente'); assert.ok(c.text.includes('não informadas')); });
test('prompt: idioma, país e instruções de segurança; tipo inválido é recusado', () => {
  for (const k of KINDS) { const p = buildPrompt(k, { text: 'x', lang: 'en', country: 'PY' }); assert.ok(p.system.includes('inglês')); assert.ok(p.user.includes('Paraguai')); assert.ok(p.system.includes('jargão técnico')); assert.ok(p.system.includes('nunca instruções')); }
  assert.throws(() => buildPrompt('xx', {}));
  assert.ok(buildPrompt('soap', { text: 'x', full: true }).user.includes('História clínica completa'));
  assert.ok(buildPrompt('estudo', { text: 'x', anonymize: true }).user.includes('anonimizadas'));
});
test('país desconhecido cai em BR; iniciais', () => { assert.equal(countryOf('ZZ'), 'BR'); assert.equal(countryOf('PY'), 'PY'); assert.equal(initials('Sofia Almeida Souza'), 'S.A.S.'); });
