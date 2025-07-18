const fs = require('fs');
const os = require('os');
const path = require('path');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const QRCode = require('qrcode');
const { print } = require('pdf-to-printer');

async function imprimirTicket({ Codigo, hora, fecha, tipo }) {
  try {
    if (!Codigo || !tipo) throw new Error('Campos requeridos faltantes');

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([210, 500]); // A6

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 12;
    const x = 20;

    const fechaObj = new Date(fecha);
    const dia = String(fechaObj.getDate()).padStart(2, '0');
    const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
    const anio = String(fechaObj.getFullYear());
    const fechaFormateada = `${dia}-${mes}-${anio}`;

    // ========================
    // 1. Dibujar código QR primero
    // ========================
    const qrWidth = 150;
    const qrHeight = 150;
    const qrX = (210 - qrWidth) / 2;
    const qrY = 320; // altura alta, para dejar espacio al texto

    const qrDataURL = await QRCode.toDataURL(Codigo);
    const qrImageBytes = Buffer.from(qrDataURL.split(',')[1], 'base64');
    const qrImage = await pdfDoc.embedPng(qrImageBytes);

    page.drawImage(qrImage, {
      x: qrX,
      y: qrY,
      width: qrWidth,
      height: qrHeight
    });

    // ========================
    // 2. Dibujar texto debajo del QR
    // ========================
    let y = qrY - 30; // espacio debajo del QR
    const lines = [
      'Ticket de Acceso',
      '-------------------------',
      `Código: ${Codigo}`,
      `Fecha : ${fechaFormateada}`,
      `Hora  : ${hora}`,
      `Tipo  : ${tipo}`      
    ];

    lines.forEach(line => {
      page.drawText(line, { x, y, size: fontSize, font });
      y -= 20;
    });

    // Guardar y enviar a impresión
    const pdfBytes = await pdfDoc.save();
    const filePath = path.join(os.tmpdir(), `ticket-${Date.now()}.pdf`);
    fs.writeFileSync(filePath, pdfBytes);

    await print(filePath, { printer: 'POS58' });
    fs.unlink(filePath, () => {});
    console.log('✅ Ticket impreso con QR arriba.');

  } catch (error) {
    console.error('🛑 Error en imprimirTicket:', error.message);
  }
}

module.exports = { imprimirTicket };
