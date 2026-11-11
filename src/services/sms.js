export async function sendSms(to, body) {
  const sid = process.env.TWILIO_SID, tok = process.env.TWILIO_TOKEN;
  if (!sid || !tok) return { skipped: true };
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { method: 'POST', headers: { authorization: 'Basic ' + Buffer.from(sid + ':' + tok).toString('base64') }, body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM, Body: body }) });
  return { ok: r.ok };
}
