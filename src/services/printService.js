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
    console.log("🟢 Iniciando proceso de impresión de ticket");
    console.log("📋 Datos recibidos:", { Codigo, hora, fecha, tipo, valor });
    
    if (!Codigo || !tipo) throw new Error("Campos requeridos faltantes");

    // --- Obtener número de boleta real desde la API ---
    let numeroBoleta = "001"; // Valor por defecto
    let apiResponse = null;
    
    try {
      console.log("🌐 Intentando conectar con API de boletas...");
      console.log("📤 Enviando payload:", { nombre: tipo, precio: valor || 0 });
      
      const response = await fetch('https://backend-banios.dev-wit.com/api/boletas/enviar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombre: tipo,
          precio: valor || 0
        })
      });
      
      console.log("📥 Respuesta recibida. Status:", response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log("✅ Datos recibidos de API:", data);
        apiResponse = data;
        
        // EXTRAER CORRECTAMENTE EL FOLIO DE LA RESPUESTA
        numeroBoleta = data.folio || data.numeroBoleta || data.id || data.numero || "001";
        console.log("🔢 Número de boleta asignado:", numeroBoleta);
      } else {
        console.warn("⚠️ No se pudo obtener número de boleta real, usando valor por defecto");
        console.warn("📋 Detalles de error:", response.status, response.statusText);
        
        // Intentar obtener más detalles del error si es posible
        try {
          const errorData = await response.text();
          console.warn("📋 Cuerpo de error:", errorData);
        } catch (e) {
          console.warn("📋 No se pudo obtener cuerpo de error");
        }
      }
    } catch (apiError) {
      console.warn("❌ Error al conectar con API de boletas:", apiError.message);
      console.warn("📋 Stack trace:", apiError.stack);
    }

    console.log("📄 Creando documento PDF...");
    const pdfDoc = await PDFDocument.create();

    // --- Datos base ---
    const fechaObj = new Date(fecha);
    const dia = String(fechaObj.getDate()).padStart(2, "0");
    const mes = String(fechaObj.getMonth() + 1).padStart(2, "0");
    const anio = String(fechaObj.getFullYear());
    const fechaFormateada = `${dia}-${mes}-${anio}`;

    // --- Secciones ---
    const encabezado = [
      "BOLETO DE TRANSACCIÓN",
      "VENTA - COPIA CLIENTE",
      " ",
      "INMOBILIARIA E INVERSIONES", 
      "P Y R S.A.",
      "RUT: 96.971.370-5",
      "SAN BORJA N1251", 
      "ESTACION CENTRAL",
      "Santiago - Chile",
      "---------------------------------------------",
    ];

    const detalle = [
      "---------------------------------------------",
      `Nº boleta : ${numeroBoleta}`, // Usamos el número real de boleta (folio)
      `Fecha : ${fechaFormateada}`,
      `Hora  : ${hora}`,
      `Tipo  : ${tipo}`,
      valor ? `Monto : $${valor}` : null,
      "---------------------------------------------",
    ].filter(Boolean);

    const footer = ["VÁLIDO COMO BOLETA", "Gracias por su compra"];

    // --- ESPACIOS MODIFICADOS ---
    const lineHeight = 15;
    const topMargin = 10;
    const bottomMargin = 10;
    const qrHeight = 120;
    const spaceBeforeQR = 0; // Sin espacio antes del QR
    const spaceAfterQR = 5;

    let altura =
      topMargin +
      encabezado.length * lineHeight +
      lineHeight + // Para el código de autorización
      spaceBeforeQR +
      qrHeight +
      spaceAfterQR +
      (detalle.length + footer.length) * lineHeight +
      bottomMargin;

    const alturaMin = 380;
    altura = Math.max(altura, alturaMin);
    
    console.log("📏 Altura calculada del PDF:", altura);

    // --- Crear página ---
    const page = pdfDoc.addPage([210, altura]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 11;

    // --------------------------------------------------------------------------------- Aqui empieza el ticket
    // Posición inicial
    let y = altura - topMargin;

    // --- Encabezado centrado ---
    console.log("🖋️ Dibujando encabezado...");
    encabezado.forEach((line) => {
      const textWidth = font.widthOfTextAtSize(line, fontSize);
      const centeredX = (210 - textWidth) / 2;
      page.drawText(line, { x: centeredX, y, size: fontSize, font });
      y -= lineHeight;
    });

    // --- Código de autorización encima del QR ---
    const codigoText = `Número Ticket : ${Codigo}`;
    const codigoWidth = font.widthOfTextAtSize(codigoText, fontSize);
    const codigoX = (210 - codigoWidth) / 2;
    page.drawText(codigoText, { x: codigoX, y, size: fontSize, font });
    y -= lineHeight;

    // --- CORRECCIÓN DEFINITIVA: QR PEGADO al texto ---
    const qrWidth = 120;
    const qrX = (210 - qrWidth) / 2;
    
    // CORRECCIÓN: El QR debe empezar JUSTO debajo del texto
    const qrY = y; // y ya está en la posición correcta (debajo del texto)

    console.log("🔳 Generando código QR...");
    const qrDataURL = await QRCode.toDataURL(Codigo);
    const qrImageBytes = Buffer.from(qrDataURL.split(",")[1], "base64");
    const qrImage = await pdfDoc.embedPng(qrImageBytes);

    // DIBUJAR EL QR EN LA POSICIÓN CORRECTA
    console.log("🖋️ Dibujando código QR...");
    page.drawImage(qrImage, {
      x: qrX,
      y: qrY - qrHeight, // El QR se dibuja EXTENDIÉNDOSE HACIA ARRIBA
      width: qrWidth,
      height: qrHeight,
    });

    // CORRECCIÓN CLAVE: Posicionar el texto debajo del QR correctamente
    y = qrY - qrHeight - spaceAfterQR;

    // --- Detalle centrado ---
    console.log("🖋️ Dibujando detalles...");
    detalle.forEach((line) => {
      const textWidth = font.widthOfTextAtSize(line, fontSize);
      const centeredX = (210 - textWidth) / 2;
      page.drawText(line, { x: centeredX, y, size: fontSize, font });
      y -= lineHeight;
    });

    // --- Footer centrado ---
    console.log("🖋️ Dibujando footer...");
    footer.forEach((line) => {
      const textWidth = font.widthOfTextAtSize(line, fontSize);
      const centeredX = (210 - textWidth) / 2;
      page.drawText(line, { x: centeredX, y, size: fontSize, font });
      y -= lineHeight;
    });
    // --------------------------------------------------------------------------------- Aqui termina el ticket

    // --- Guardar e imprimir ---
    console.log("💾 Guardando PDF...");
    const pdfBytes = await pdfDoc.save();
    const filePath = path.join(os.tmpdir(), `ticket-${Date.now()}.pdf`);
    fs.writeFileSync(filePath, pdfBytes);
    
    console.log("🖨️ Enviando a impresión...");
    console.log("📋 Ruta del archivo:", filePath);
    console.log("🖨️ Impresora:", "POS58");
    
    await print(filePath, { printer: "POS58" });
    
    console.log("✅ Impresión enviada correctamente");
    console.log("🗑️ Eliminando archivo temporal...");
    
    fs.unlink(filePath, (err) => {
      if (err) {
        console.warn("⚠️ No se pudo eliminar archivo temporal:", err.message);
      } else {
        console.log("✅ Archivo temporal eliminado");
      }
    });
    
    // Mostrar resumen final
    console.log("\n" + "=".repeat(60));
    console.log("🎉 TICKET IMPRESO EXITOSAMENTE");
    console.log("=".repeat(60));
    console.log(`🔢 Número de boleta (folio): ${numeroBoleta}`);
    console.log(`💰 Monto: $${valor || 0}`);
    console.log(`📋 Tipo: ${tipo}`);
    console.log(`🕒 Fecha/hora: ${fechaFormateada} ${hora}`);
    
    if (apiResponse) {
      console.log("🌐 API: Conexión exitosa");
      console.log(`📋 Folio API: ${apiResponse.folio}`);
      console.log(`📋 Mensaje: ${apiResponse.message}`);
    } else {
      console.log("⚠️ API: Se usó número por defecto");
    }
    console.log("=".repeat(60));
    
  } catch (error) {
    console.error("🛑 Error en imprimirTicket:", error.message);
    console.error("📋 Stack trace:", error.stack);
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
  nombre_caja, // ← Nuevo parámetro: nombre de la caja
  nombre_usuario,  // Usuario que cierra (admin/supervisor)
  nombre_cajero    // Nombre del cajero
}) {
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([210, 780]); // Aumentar altura para incluir ambas líneas

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontSize = 12;
    const x = 20;
    let y = 750; // Ajustar posición inicial

    const lines = [
      "CIERRE DE CAJA",
      "-------------------------",
      `Caja         : ${nombre_caja}`, // ← Cambiado: usar nombre_caja en lugar de numero_caja
      `Cajero       : ${nombre_cajero || 'Cajero'}`,
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
  nombre_usuario,  // Este es el usuario que autoriza (admin/recaudador)
  nombre_caja,
  nombre_cajero   // Nuevo parámetro: nombre del cajero que realiza la operación
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
      `Caja:   ${nombre_caja}`,
      `Cajero: ${nombre_cajero}`,  // Usar nombre_cajero en lugar de nombre_usuario
      `Autorizado por: ${nombre_usuario}`,  // Cambiar "Recaudado por" a "Autorizado por"
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
