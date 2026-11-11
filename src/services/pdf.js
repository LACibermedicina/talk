import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
const T = { receita: 'Receita', atestado: 'Atestado', pedido_exames: 'Pedido de exames', relatorio: 'Relatório' };
// signer: { name, reg, img } ; img = data URL PNG/JPEG cadastrada pelo administrador (assinatura eletrônica simples, não ICP-Brasil)
export async function renderPdf(d, patient, signer) {
  const qr = await QRCode.toBuffer(`${process.env.APP_ORIGIN}/r/${d.token}`, { margin: 1, width: 220 });
  return new Promise(res => {
    const p = new PDFDocument({ margin: 50 }), b = [];
    p.on('data', x => b.push(x)); p.on('end', () => res(Buffer.concat(b)));
    p.fontSize(18).text(T[d.kind] || d.kind).moveDown();
    p.fontSize(11).text(`Paciente: ${patient}`).text(`Emitido em: ${new Date(d.created_at).toLocaleString('pt-BR', { timeZone: process.env.TZ || 'America/Sao_Paulo' })}`);
    if (d.valid_until) p.text(`Válido até: ${new Date(d.valid_until).toLocaleDateString('pt-BR')} · Usos permitidos: ${d.max_uses}`);
    p.moveDown().text(d.texto).moveDown(2);
    if (signer.img) { try { p.image(Buffer.from(signer.img.split(',')[1], 'base64'), { fit: [150, 55] }); } catch { /* imagem inválida: segue sem */ } }
    p.fontSize(11).text(signer.name).text(signer.reg || '');
    p.fontSize(8).text('Assinatura eletrônica simples (selo do sistema + hash). Não é assinatura ICP-Brasil.').text(`SHA-256: ${d.hash}`).text('Escaneie o QR code para verificar e dar baixa.');
    p.image(qr, p.page.width - 150, p.page.height - 170, { width: 90 }); p.end();
  });
}
