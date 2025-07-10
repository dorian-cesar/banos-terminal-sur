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
    const page = pdfDoc.addPage([210, 500]); // A6 en puntos (210 = ancho, 500 = alto)

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 12;

    // Coordenadas iniciales para imprimir el texto
    let y = 460;
    const x = 20;

    const fechaObj = new Date(fecha);
    const dia = String(fechaObj.getDate()).padStart(2, '0');
    const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
    const anio = String(fechaObj.getFullYear());
    const fechaFormateada = `${dia}-${mes}-${anio}`;


    const lines = [
      'Ticket de Acceso',
      '-------------------------',
      `Fecha : ${fechaFormateada}`,
      `Hora  : ${hora}`,
      `Tipo  : ${tipo}`,
      `Código: ${Codigo}`
    ];

    // Imprimir cada línea del contenido, de arriba hacia abajo
    lines.forEach(line => {
      page.drawText(line, { x, y, size: fontSize, font });
      y -= 20; // espacio vertical entre líneas
    });

    // ==============================
    // CONFIGURACIÓN DEL CÓDIGO QR
    // ==============================

    // Cambia estos valores para ajustar el tamaño del QR
    const qrWidth = 150;   // ancho en puntos (recomendado: 100–140)
    const qrHeight = 150;  // alto en puntos

    // Cambia este valor para ajustar la distancia desde el borde inferior del texto
    const qrY = 200; // posición vertical (más bajo = más separación del contenido)

    // Centrar horizontalmente el QR en la página
    const qrX = (210 - qrWidth) / 2;

    // Generar el QR en base64 y embederlo como imagen PNG
    const qrDataURL = await QRCode.toDataURL(Codigo);
    const qrImageBytes = Buffer.from(qrDataURL.split(',')[1], 'base64');
    const qrImage = await pdfDoc.embedPng(qrImageBytes);

    // Dibujar el QR en el ticket
    page.drawImage(qrImage, {
      x: qrX,         // posición horizontal (centrado)
      y: qrY,         // posición vertical (ajustable)
      width: qrWidth, // tamaño del QR
      height: qrHeight
    });

    // Guardar PDF temporal en carpeta del sistema
    const pdfBytes = await pdfDoc.save();
    const filePath = path.join(os.tmpdir(), `ticket-${Date.now()}.pdf`);
    fs.writeFileSync(filePath, pdfBytes);

    // Imprimir en impresora predeterminada o especificada
    await print(filePath, { printer: 'POS58' });

    // Borrar archivo temporal después de imprimir
    fs.unlink(filePath, () => {});
    console.log('✅ Ticket impreso correctamente.');

  } catch (error) {
    console.error('🛑 Error en imprimirTicket:', error.message);
  }
}

module.exports = { imprimirTicket };
