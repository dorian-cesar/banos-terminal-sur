const fs = require("fs");
const os = require("os");
const path = require("path");
const { PDFDocument, StandardFonts } = require("pdf-lib");
const QRCode = require("qrcode");
const { print } = require("pdf-to-printer");

module.exports = {
  imprimirTicket,
  imprimirCierreCaja,
  imprimirRetiro  
};

async function imprimirTicket({ Codigo, hora, fecha, tipo, valor }) {
  try {
    if (!Codigo || !tipo) throw new Error("Campos requeridos faltantes");

    const pdfDoc = await PDFDocument.create();

    // --- Datos base ---
    const fechaObj = new Date(fecha);
    const dia = String(fechaObj.getDate()).padStart(2, "0");
    const mes = String(fechaObj.getMonth() + 1).padStart(2, "0");
    const anio = String(fechaObj.getFullYear());
    const fechaFormateada = `${dia}-${mes}-${anio}`;

    // --- Secciones ---
    const encabezado = [
      "INMOBILIARIA E INVERSIONES", 
      "P Y R S.A.",
      "GIRO: OBRAS MENORES",
      "EN CONSTRUCCIÓN",
      "RUT: 96.971.370-5",
      "SAN BORJA N1251", 
      "ESTACION CENTRAL",
      "FONO 02-5603700",
      "Santiago - Chile",
      "---------------------------------------------",
    ];

    const detalle = [
      "BOLETO DE TRANSACCIÓN",
      "VENTA - COPIA CLIENTE",
      "---------------------------------------------",
      `Código Autorización : ${Codigo}`,
      `Fecha : ${fechaFormateada}`,
      `Hora  : ${hora}`,
      `Tipo  : ${tipo}`,
      valor ? `Monto : $${valor}` : null,
      "---------------------------------------------",
    ].filter(Boolean);

    const footer = ["VÁLIDO COMO BOLETA", "Gracias por su compra"];

    // --- Cálculo de alto dinámico en base a tu contenido ---
    const lineHeight = 15;
    const topMargin = 30;
    const bottomMargin = 30;
    const qrHeight = 120;
    const spaceBeforeQR = 10;
    const spaceAfterQR = 20;

    let altura =
      topMargin +
      encabezado.length * lineHeight +
      spaceBeforeQR +
      qrHeight +
      spaceAfterQR +
      (detalle.length + footer.length) * lineHeight +
      bottomMargin;

    const alturaMin = 420;
    altura = Math.max(altura, alturaMin);

    // --- Crear página ---
    const page = pdfDoc.addPage([210, altura]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 11;

    // Posición inicial
    let y = altura - topMargin;

    // --- Encabezado centrado ---
    encabezado.forEach((line) => {
      const textWidth = font.widthOfTextAtSize(line, fontSize);
      const centeredX = (210 - textWidth) / 2;
      page.drawText(line, { x: centeredX, y, size: fontSize, font });
      y -= lineHeight;
    });

    // --- QR centrado ---
    const qrWidth = 120;
    const qrX = (210 - qrWidth) / 2;
    const qrY = y - qrHeight - spaceBeforeQR;

    const qrDataURL = await QRCode.toDataURL(Codigo);
    const qrImageBytes = Buffer.from(qrDataURL.split(",")[1], "base64");
    const qrImage = await pdfDoc.embedPng(qrImageBytes);

    page.drawImage(qrImage, {
      x: qrX,
      y: qrY,
      width: qrWidth,
      height: qrHeight,
    });

    y = qrY - spaceAfterQR;

    // --- Detalle centrado ---
    detalle.forEach((line) => {
      const textWidth = font.widthOfTextAtSize(line, fontSize);
      const centeredX = (210 - textWidth) / 2;
      page.drawText(line, { x: centeredX, y, size: fontSize, font });
      y -= lineHeight;
    });

    // --- Footer centrado ---
    footer.forEach((line) => {
      const textWidth = font.widthOfTextAtSize(line, fontSize);
      const centeredX = (210 - textWidth) / 2;
      page.drawText(line, { x: centeredX, y, size: fontSize, font });
      y -= lineHeight;
    });

    // --- Guardar e imprimir ---
    const pdfBytes = await pdfDoc.save();
    const filePath = path.join(os.tmpdir(), `ticket-${Date.now()}.pdf`);
    fs.writeFileSync(filePath, pdfBytes);

    await print(filePath, { printer: "POS58" });
    fs.unlink(filePath, () => {});
  } catch (error) {
    console.error("🛑 Error en imprimirTicket:", error.message);
  }
}

async function imprimirCierreCaja({
  total_efectivo,
  total_tarjeta,
  total_retiros,
  balance_final,
  monto_inicial,
  fecha_cierre,
  hora_cierre,
  numero_caja,
  nombre_usuario,
}) {
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([210, 750]); // Aumentar altura para incluir retiros

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold); // Pre-cargar la fuente en negrita
    const fontSize = 12;
    const x = 20;
    let y = 720; // Ajustar posición inicial

    const lines = [
      "CIERRE DE CAJA",
      "-------------------------",
      `Caja         : N° ${numero_caja}`,
      `Cajero       : ${nombre_usuario}`,
      `Cerrado por  : ${nombre_usuario}`,
      `Fecha        : ${fecha_cierre}`,
      `Hora         : ${hora_cierre}`,
      "",
      `Monto Inicial     : $${parseFloat(monto_inicial).toLocaleString('es-CL')}`,
      `Total Efectivo    : $${parseFloat(total_efectivo).toLocaleString('es-CL')}`,
      `Total Tarjeta     : $${parseFloat(total_tarjeta).toLocaleString('es-CL')}`,
      `Total Retirado    : $${parseFloat(total_retiros).toLocaleString('es-CL')}`,
      "-------------------------",
      `TOTAL VENTAS      : $${parseFloat(Number(total_efectivo) + Number(total_tarjeta)).toLocaleString('es-CL')}`,
      "-------------------------",
      `BALANCE FINAL     : $${parseFloat(balance_final).toLocaleString('es-CL')}`,
      "-------------------------",
      "",
      ".",
      "",
      "",
    ];

    lines.forEach((line) => {
      // Destacar títulos y totales importantes
      const isTitle = line.includes("CIERRE DE CAJA");
      const isTotal = line.includes("TOTAL VENTAS") || line.includes("BALANCE FINAL");
      
      const currentFont = isTitle || isTotal ? boldFont : font;
      const currentSize = isTitle ? fontSize + 1 : isTotal ? fontSize + 1 : fontSize;
      
      page.drawText(line, { x, y, size: currentSize, font: currentFont });
      y -= 20;
    });

    const pdfBytes = await pdfDoc.save();
    const filePath = path.join(os.tmpdir(), `cierre-caja-${Date.now()}.pdf`);
    fs.writeFileSync(filePath, pdfBytes);

    await print(filePath, { printer: "POS58" });
    fs.unlink(filePath, () => {});
    console.log("✅ Ticket de cierre impreso correctamente.");
  } catch (error) {
    console.error("🛑 Error al imprimir ticket de cierre:", error.message);
  }
}

async function imprimirRetiro({
  codigo,
  fecha,
  hora,
  monto,
  nombre_usuario,
  nombre_caja,  // Cambiar de numero_caja a nombre_caja
  motivo
}) {
  try {
    if (!codigo || !monto) throw new Error("Campos requeridos faltantes");

    const pdfDoc = await PDFDocument.create();

    // --- Datos base ---
    const fechaObj = new Date(fecha);
    const dia = String(fechaObj.getDate()).padStart(2, "0");
    const mes = String(fechaObj.getMonth() + 1).padStart(2, "0");
    const anio = String(fechaObj.getFullYear());
    const fechaFormateada = `${dia}-${mes}-${anio}`;

    // --- Secciones simples ---
    const detalle = [
      "COMPROBANTE DE RETIRO",
      "DE EFECTIVO",
      "---------------------------------------------------",
      `Codigo: ${codigo}`,
      `Fecha:  ${fechaFormateada}`,
      `Hora:   ${hora}`,
      `Caja:   ${nombre_caja}`,  // Usar nombre_caja en lugar de numero_caja
      `Cajero: ${nombre_usuario}`,
      `Recaudado por: ${nombre_usuario}`,
      "---------------------------------------------------",
      "MONTO RETIRADO:",
      `$${parseFloat(monto).toLocaleString('es-CL')}`,
      "---------------------------------------------------",
    ];

    const footer = [
      " ",
      "FIRMA AUTORIZADA:",
      " ",
      " ",
      "_________________________",
      " ",
      " ",
      "."
    ];

    // --- Cálculo de altura ---
    const lineHeight = 15;
    const topMargin = 30;
    const bottomMargin = 30;
    const espacioFirma = 40;

    let altura = topMargin + 
                (detalle.length * lineHeight) + 
                espacioFirma + 
                (footer.length * lineHeight) + 
                bottomMargin;

    // --- Crear página ---
    const page = pdfDoc.addPage([210, altura]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Posición inicial
    let y = altura - topMargin;

    // --- Detalles ---
    detalle.forEach((line) => {
      const isTitle = line === "COMPROBANTE DE RETIRO" || line === "DE EFECTIVO";
      const isMonto = line.includes("MONTO RETIRADO") || line.includes("$");
      const isSeparator = line.includes("---");
      
      const currentFont = isTitle || isMonto ? boldFont : font;
      const currentSize = isMonto ? 13 : isTitle ? 13 : 12;
      
      if (isSeparator) {
        page.drawText(line, { x: 15, y, size: 12, font });
      } else {
        const textWidth = currentFont.widthOfTextAtSize(line, currentSize);
        const centeredX = (210 - textWidth) / 2;
        page.drawText(line, { x: centeredX, y, size: currentSize, font: currentFont });
      }
      y -= lineHeight;
    });

    // Espacio para firma
    y -= 20;

    // --- Footer ---
    footer.forEach((line) => {
      const isFirma = line === "FIRMA AUTORIZADA:";
      const currentFont = isFirma ? boldFont : font;
      const currentSize = isFirma ? 13 : 11;
      
      const textWidth = currentFont.widthOfTextAtSize(line, currentSize);
      const centeredX = (210 - textWidth) / 2;
      page.drawText(line, { x: centeredX, y, size: currentSize, font: currentFont });
      y -= lineHeight;
    });

    // --- Guardar e imprimir ---
    const pdfBytes = await pdfDoc.save();
    const filePath = path.join(os.tmpdir(), `retiro-${Date.now()}.pdf`);
    fs.writeFileSync(filePath, pdfBytes);

    await print(filePath, { printer: "POS58" });
    fs.unlink(filePath, () => {});
    
    console.log("✅ Comprobante de retiro impreso correctamente.");
  } catch (error) {
    console.error("🛑 Error en imprimirRetiro:", error.message);
    throw error;
  }
}
