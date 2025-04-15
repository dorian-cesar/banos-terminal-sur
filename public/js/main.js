document.addEventListener("DOMContentLoaded", function () {
  // const ticketsData = [];

  // // Crear data de tablas, implementar lógica de generar tickets - máximo 8 últimos
  // for (let i = 0; i < 8; i++) {
  //   ticketsData.push({
  //     tipo: "Baño",
  //     codigo: "777777777777",
  //     fecha: "11-11-25",
  //     hora: "13:01:00",
  //   });
  // }

  const ticketsData = [
    {
      tipo: "Baño",
      codigo: "123456789",
      fecha: "11-11-25",
      hora: "13:01:00",
      qrCode: "images/QR@2x.png",
    },
    {
      tipo: "Ducha",
      codigo: "987654321",
      fecha: "12-08-25",
      hora: "11:01:00",
      qrCode: "images/QR@2x.png",
    },
  ];

  const tableBody = document.getElementById("sales-table-body");
  ticketsData.forEach((sale) => {
    const row = document.createElement("tr");

    const tipoCell = document.createElement("td");
    tipoCell.textContent = sale.tipo;
    row.appendChild(tipoCell);

    const codigoCell = document.createElement("td");
    codigoCell.textContent = sale.codigo;
    row.appendChild(codigoCell);

    const fechaCell = document.createElement("td");
    fechaCell.textContent = sale.fecha;
    row.appendChild(fechaCell);

    const horaCell = document.createElement("td");
    horaCell.textContent = sale.hora;
    row.appendChild(horaCell);

    const printCell = document.createElement("td");
    printCell.style.textAlign = "center";

    const printButton = document.createElement("button");
    printButton.className = "print-button";
    printButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 6 2 18 2 18 9"></polyline>
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
        <rect x="6" y="14" width="12" height="8"></rect>
      </svg>
    `;

    // modal imprimir ticket
    printButton.addEventListener("click", function () {
      const overlay = document.getElementById("ticket-print-overlay");
      const modal = document.getElementById("ticket-print-modal");
      const modalResume = document.getElementById("resumen-overlay");
      modalResume.style.display = "none";

      overlay.style.display = "flex";

      const infoItems = modal.querySelectorAll(".info-item");

      infoItems.forEach((item) => {
        const label = item.querySelector(".info-label").textContent.trim();
        const value = item.querySelector(".info-value");

        if (label === "TIPO") value.textContent = sale.tipo;
        if (label === "CÓDIGO") value.textContent = sale.codigo;
        if (label === "FECHA") value.textContent = sale.fecha;
        if (label === "HORA") value.textContent = sale.hora;
      });
      const qrImage = modal.querySelector(".qr-image");
      qrImage.src = sale.qrCode || "images/QR@2x.png";
    });

    printCell.appendChild(printButton);
    row.appendChild(printCell);
    tableBody.appendChild(row);
  });
});

// abrir y cerrar modal de resumen de tickets
function openResumen() {
  const modal = document.getElementById("resumen-overlay");
  modal.style.display = "flex";
}

function closeResumen() {
  const modal = document.getElementById("resumen-overlay");
  modal.style.display = "none";
}

document
  .getElementById("resumen-overlay")
  .addEventListener("click", function (e) {
    if (e.target.id === "resumen-overlay") {
      closeResumen();
    }
  });

// cerrar modal de imprimir ticket
function closeTicketModal() {
  document.getElementById("ticket-print-overlay").style.display = "none";
}

document
  .getElementById("ticket-print-overlay")
  .addEventListener("click", function (e) {
    if (e.target.id === "ticket-print-overlay") {
      closeTicketModal();
    }
  });

// modal de ticket
document.addEventListener("DOMContentLoaded", function () {
  const modal = document.getElementById("ticket-overlay");
  const inputField = document.getElementById("ticketInput");
  const closeBtn = document.querySelector(".close-button");
  const reimprimirBtn = document.getElementById("reimprimirBtn");

  inputField.addEventListener("click", function () {
    modal.style.display = "flex";
  });

  inputField.addEventListener("focus", function () {
    modal.style.display = "flex";
  });

  closeBtn.addEventListener("click", function () {
    modal.style.display = "none";
    inputField.value = "";
  });

  window.addEventListener("click", function (event) {
    if (event.target === modal) {
      modal.style.display = "none";
      inputField.value = "";
    }
  });

  reimprimirBtn.addEventListener("click", function () {
    // Agregar la lógica para reimprimir el ticket
  });
});

// animacion codigo qr
let rotation = 0;

function rotateQR() {
  rotation += 90;
  document.querySelector(".img-qr").style.transform = `rotate(${rotation}deg)`;
}

document.querySelector(".btn-genera-baño").addEventListener("click", rotateQR);
document.querySelector(".btn-genera-ducha").addEventListener("click", rotateQR);
