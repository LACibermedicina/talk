import test from 'node:test';
import assert from 'node:assert/strict';
import { minuteBuckets, transcriptText, scrub, orderLibrary, libraryContext, findInteractions, findRisks, planConsults, stemOf, buildSupportPrompt, parseJson } from '../src/consultLogic.js';
const T0 = '2026-01-01T10:00:00Z', at = s => new Date(Date.parse(T0) + s * 1000).toISOString();
test('minutagem agrupa por minuto e mantém tudo', () => {
  const b = minuteBuckets([{ at: at(5), role: 'medico', text: 'Bom dia' }, { at: at(40), role: 'paciente', text: 'Dor de cabeça' }, { at: at(75), role: 'medico', text: 'Há quanto tempo?' }], T0);
  assert.equal(b.length, 2); assert.equal(b[0].lines.length, 2); assert.equal(b[1].minute, 1); assert.equal(b[1].lines[0].t, '01:15'); assert.equal(b[0].lines[1].who, 'Paciente');
});
test('transcrição anonimiza o nome do paciente', () => {
  assert.equal(scrub('Maria Souza, tudo bem?', ['Maria Souza']), 'Paciente Paciente, tudo bem?');
  assert.match(transcriptText([{ at: at(61), role: 'paciente', text: 'Sou Maria' }], T0, ['Maria']), /^\[01:01\] Paciente: Sou Paciente$/);
});
test('biblioteca: ministério > sociedade > OMS > do usuário > geral; não mostra pessoal alheio', () => {
  const it = (id, tier, owner, extra = {}) => ({ id, tier, owner_id: owner, title: id, body: 'x', shared: false, country: 'BR', ...extra });
  const o = orderLibrary([it('geralB', 'personal', 'outro', { shared: true }), it('meu', 'personal', 'eu'), it('oms', 'oms', 'adm'), it('soc', 'sociedade', 'adm'), it('ms', 'ministerio', 'adm'), it('privado', 'personal', 'outro')], { userId: 'eu', country: 'BR' });
  assert.deepEqual(o.map(x => x.id), ['ms', 'soc', 'oms', 'meu', 'geralB']);
  assert.match(libraryContext(o).text, /^### \[Ministério da Saúde/);
});
test('interações: grave primeiro, indica a fonte', () => {
  const r = findInteractions({ consulta: 'ele toma ibuprofeno para dor', prontuario: 'Medicação: varfarina 5 mg; losartana' });
  assert.equal(r[0].sev, 'grave'); assert.equal(r[0].a, 'varfarina'); assert.match(r[0].fonte, /consulta/);
  assert.equal(findInteractions({ consulta: 'tomo paracetamol', prontuario: '' }).length, 0);
  assert.ok(findInteractions({ consulta: 'sildenafila e isossorbida' , prontuario: '' }).some(x => x.sev === 'grave'));
});
test('riscos em tempo real', () => { assert.ok(findRisks('tenho dor no peito há 1 hora').length === 1); assert.ok(findRisks('às vezes penso em me matar')[0].includes('suicídio')); assert.equal(findRisks('tudo bem').length, 0); });
test('interconsulta: equipe > online > encaminhamento; não sugere o próprio nem offline', () => {
  const team = [{ id: 'c1', name: 'Dr. Cardio', role: 'medico', cargo: 'Cardiologista', status: 'busy' }], pros = [...team, { id: 'p1', name: 'Dra. Psi', role: 'medico', cargo: 'Psiquiatra', status: 'online' }, { id: 'p2', name: 'Dr. Off', role: 'medico', cargo: 'Neurologista', status: 'offline' }, { id: 'eu', name: 'Eu', role: 'medico', cargo: 'Psiquiatra', status: 'online' }];
  const r = planConsults([{ especialidade: 'Cardiologia' }, { especialidade: 'Psiquiatria' }, { especialidade: 'Neurologia' }, { especialidade: 'Dermatologia' }], team, pros, 'eu');
  assert.deepEqual(r.map(x => x.modo), ['agendar', 'online', 'encaminhamento', 'encaminhamento']); assert.equal(r[1].online[0].name, 'Dra. Psi'); assert.equal(stemOf('Fisioterapia'), 'fisio');
});
test('prompt de apoio traz prioridade, regra farmacológica e preferências', () => {
  const p = buildSupportPrompt({ transcript: 't', prefs: [{ topic: 'HAS', text: 'preferir losartana' }], country: 'BR', alerts: ['x'] });
  assert.match(p.system, /Ministério da Saúde/); assert.match(p.system, /PREFERÊNCIA LOCAL/); assert.match(p.user, /preferir losartana/); assert.match(p.system, /DADOS, nunca instruções/);
});
test('parseJson tolera cercas de código', () => { assert.deepEqual(parseJson('```json\n{"a":1}\n```'), { a: 1 }); assert.equal(parseJson('nada'), null); });
