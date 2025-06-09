const contenedorQR = document.getElementById("contenedorQR");
const parrafoCodigo = document.getElementById("codigo");
const parrafoFecha = document.getElementById("fecha");
const parrafoHora = document.getElementById("hora");
const parrafoTipo = document.getElementById("tipo");
const botonesQR = document.querySelectorAll(".generarQR");

const restroom = {
  BAÑO: 500,
  DUCHA: 4000
};

const QR = new QRCode(contenedorQR);
QR.makeCode("wit");

const urlBase = "https://andenes.terminal-calama.com";
const url = urlBase + "/TerminalCalama/PHP/Restroom/save.php";

// console.log(urlBase);

// leerDatosServer();
let datosPendientes = null;

let botonActivo = null;

botonesQR.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();

    // Validación de id_caja en localStorage
    const id_caja = localStorage.getItem('id_caja');
    // if (!id_caja) {
    //     alert('Por favor, primero debe abrir la caja antes de generar un QR.');
    //     return; // Detiene la ejecución si no hay id_caja
    // }

    const fechaHoraAct = new Date();
    const horaStr = `${fechaHoraAct.getHours().toString().padStart(2, '0')}:${fechaHoraAct.getMinutes().toString().padStart(2, '0')}:${fechaHoraAct.getSeconds().toString().padStart(2, '0')}`;
    const fechaStr = fechaHoraAct.toISOString().split("T")[0];
    const tipoStr = btn.dataset.tipo;
    const numeroT = generarTokenNumerico();    
    const valor = restroom[tipoStr] || 0;           

    datosPendientes = {
      Codigo: numeroT,
      hora: horaStr,
      fecha: fechaStr,
      tipo: tipoStr,
      valor: valor,       
      id_caja: id_caja     
    };

    botonActivo = btn;    
    btn.classList.add("disabled");

    document.getElementById("modalPago").style.display = "flex";
  });
});

function cerrarModalPago() {
  document.getElementById("modalPago").style.display = "none";
  if (botonActivo) {
    botonActivo.disabled = false;
    botonActivo.classList.remove("disabled");
    botonActivo = null;
  }
  datosPendientes = null;
}

async function continuarConPago(metodoPago) {
  if (!datosPendientes) return;

  const { Codigo, hora, fecha, tipo, valor, id_caja } = datosPendientes;
  const datos = { Codigo, hora, fecha, tipo, valor, id_caja }

  // Si es tarjeta, primero procesar el pago
  if (metodoPago === "TARJETA") {
    const monto = tipo === "BAÑO" ? 500 : tipo === "DUCHA" ? 4000 : 0;

    try {
      showSpinner();

      const res = await fetch("https://localhost:3000/api/payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: monto,
          ticketNumber: Codigo,
        }),
      });

      const contentType = res.headers.get("content-type");
      if (!res.ok) {
        if (contentType?.includes("application/json")) {
          const errData = await res.json();
          throw new Error(errData.message || "Error en el pago");
        } else {
          const text = await res.text();
          throw new Error(text);
        }
      }

      const result = await res.json();
      console.log("✅ Transacción aprobada:", result);
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Pago fallido",
        text: err.message || "No se pudo completar el pago con tarjeta.",
        customClass: {
          title: "swal-font",
          htmlContainer: "swal-font",
          popup: "alert-card",
          confirmButton: "my-confirm-btn",
        },
        buttonsStyling: false,
      });

      hideSpinner();
      cerrarModalPago();
      return; // NO CONTINÚA si falló el pago
    }
  }

  // Mostrar datos en la interfaz
  parrafoFecha.textContent = fecha;
  parrafoHora.textContent = hora;
  parrafoTipo.textContent = tipo + ` (${metodoPago})`;
  parrafoCodigo.textContent = Codigo;

  showSpinner();

  await callApi(datos);

  QR.makeCode(Codigo);
  await new Promise(resolve => setTimeout(resolve, 500));

  const qrCanvas = contenedorQR.querySelector("canvas");
  let qrBase64 = "";
  if (qrCanvas) {
    qrBase64 = qrCanvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
  }

  const payload = {
    Codigo,
    hora,
    fecha,
    tipo,
    qrBase64
  };

  const estado = document.createElement("p");
  contenedorQR.appendChild(estado);

  fetch('https://localhost:3000/api/print', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(async res => {
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Error inesperado');
      }
    } else {
      const text = await res.text();
      throw new Error(`Respuesta no JSON: ${text}`);
    }
  })
  .catch(err => {
    estado.textContent = `❌ Error al imprimir: ${err.message}`;
  })
  .finally(() => {
    hideSpinner();
    if (botonActivo) {
      botonActivo.disabled = false;
      botonActivo.classList.remove("disabled");
      botonActivo = null;
    }
  });

  addUser(Codigo);
  setTimeout(() => {
    addUserAccessLevel(Codigo.substring(0, 6));
  }, 1000);

  document.getElementById("modalPago").style.display = "none";
  datosPendientes = null;
}


// Eventos de los botones del modal de pago
document.getElementById("btnPagoEfectivo").addEventListener("click", () => {
  continuarConPago("EFECTIVO");
});


function generarTokenNumerico() {
  let token = (Math.floor(Math.random() * 9) + 1).toString();
  for (let i = 1; i < 10; i++) {
    token += Math.floor(Math.random() * 10);
  }
  return token;
}

function escribirTexto() {
  contenedorContador.innerHTML = "texto";
}

async function callApi(datos) {
  let ret = await fetch(url, {
    method: "POST",
    mode: "cors",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(datos),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Error en la solicitud");
      }
      return response.text();
    })
    .then((result) => {
      console.log("Respuesta del servidor:", result);
    })
    .catch((error) => {
      console.error("Error al enviar la solicitud:", error);
    });
  return ret;
}

function printQR() {
  const ventanaImpr = window.open("", "_blank");

  // Obtenemos la fecha y hora actual
  const dateAct = new Date();
  const horaStr =
    dateAct.getHours().toString().padStart(2, "0") +
    ":" +
    dateAct.getMinutes().toString().padStart(2, "0") +
    ":" +
    dateAct.getSeconds().toString().padStart(2, "0");
  const fechaStr = dateAct.toISOString().split("T")[0];

  // Obtener el código QR generado
  const codigoQR = document.getElementById("keycont").value;
  const tipoSeleccionado = document.querySelector(
    'input[name="tipo"]:checked'
  ).value;

  if (!codigoQR) {
    alert("No hay código QR generado para imprimir.");
    return;
  }

  // Obtener el precio desde restroom.js
  const precio =
    restroom[tipoSeleccionado] !== undefined
      ? `$${restroom[tipoSeleccionado]}`
      : "No definido";

  ventanaImpr.document.write(`
        <html>
            <head>
                <title>Imprimir QR</title>
                <style>
                    body { text-align: center; font-family: Arial, sans-serif; }
                    h1, h3 { margin: 5px; }
                    .qr-container { display: flex; justify-content: center; margin-top: 10px; }
                    .close-btn {
                        background-color: red;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        font-size: 16px;
                        cursor: pointer;
                        margin-top: 20px;
                        border-radius: 5px;
                    }
                    .close-btn:hover {
                        background-color: darkred;
                    }
                    @media print {
                        .close-btn {
                            display: none;
                        }
                    }
                </style>
            </head>
            <body onload="window.print(); setTimeout(() => window.close(), 500);">
                <h1>Ticket de Acceso</h1>
                <h3>Fecha: ${fechaStr}</h3>
                <h3>Hora: ${horaStr}</h3>
                <h3>Tipo: ${tipoSeleccionado}</h3>
                <h3>Precio: ${precio}</h3>
                <h3>Código: ${codigoQR}</h3>
                <div class="qr-container">
                    ${document.getElementById("contenedorQR").innerHTML}
                </div>
                <button type="button" class="close-btn" onclick="window.close();">Cerrar</button>
            </body>
        </html>
    `);
  ventanaImpr.document.close();
}

async function addUser(token) {
  const url = urlBase + "/TerminalCalama/PHP/Restroom/addUser.php";

  const userData = { pin: token, idNo: token };

  try {
    let response = await fetch(url, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });

    let result = await response.text(); // Esperar a que la respuesta se convierta en texto
    console.log("Respuesta de addUser:", result);
  } catch (error) {
    console.error("Error al agregar usuario:", error);
  }
}

// Función para asignar niveles de acceso al usuario
async function addUserAccessLevel(token) {
  const url = urlBase + "/TerminalCalama/PHP/Restroom/addLevelUser.php";
  const accessData = { pin: token };

  try {
    let response = await fetch(url, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(accessData),
    });

    let result = await response.text(); // Esperar la respuesta
    console.log("Respuesta de addLevelUser:", result);
  } catch (error) {
    console.error("Error al asignar niveles de acceso:", error);
  }
}

function cerrarModalPago() {
  document.getElementById("modalPago").style.display = "none";
  datosPendientes = null;
}

// Eventos para botones de pago
document.getElementById("btnPagoEfectivo").addEventListener("click", () => {
  continuarConPago("EFECTIVO");
});

document.getElementById("btnPagoTarjeta").addEventListener("click", () => {
  continuarConPago("TARJETA");
});
