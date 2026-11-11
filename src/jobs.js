import { q } from './db.js';
import { sendSms } from './services/sms.js';
import { anomalies } from './services/anomaly.js';
import { renewals } from './billing.js';
async function reminders() {
  const rows = await q(`select a.id,a.starts_at,u.phone from appointments a join users u on u.id=a.patient_id where a.status in('agendado','confirmado') and a.reminded_at is null and u.phone is not null and a.starts_at>now() and a.starts_at<now()+(case when a.noshow_risk>=0.4 then interval '48 hours' else interval '24 hours' end)`);
  for (const r of rows) {
    const when = new Date(r.starts_at).toLocaleString('pt-BR', { timeZone: process.env.TZ || 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
    await sendSms(r.phone, `Lembrete: sua consulta é em ${when}. Abra o app para confirmar ou remarcar.`);
    await q('update appointments set reminded_at=now() where id=$1', [r.id]);
  }
}
export function startJobs(log) { // rode uma única instância do app (ou mova para um worker dedicado)
  const run = (n, f) => f().catch(e => log.error({ err: e.message }, n));
  setInterval(() => run('reminders', reminders), 15 * 60e3); setInterval(() => run('anomalies', anomalies), 10 * 60e3); setInterval(() => run('renovacoes', renewals), 60 * 60e3);
}
