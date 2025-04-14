// Modal resumen tickets
document.addEventListener("DOMContentLoaded", function () {
  const ticketsData = [];

  // Crear data de tablas, implementar lógica de generar tickets
  for (let i = 0; i < 8; i++) {
    ticketsData.push({
      tipo: "Baño",
      codigo: "888888888888",
      fecha: "11-11-25",
      hora: "13:01:00",
    });
  }

  const tableBody = document.getElementById("sales-table-body");

  // Generar tablas
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
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
        `;

    printButton.addEventListener("click", function () {
      // Implementar lógica de impresión
    });

    printCell.appendChild(printButton);
    row.appendChild(printCell);
    tableBody.appendChild(row);
  });

  const closeButton = document.querySelector(".close-button");
  closeButton.addEventListener("click", function () {});
});

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
    document.getElementById('img-qr').style.transform = `rotate(${rotation}deg)`;
  }

  document.getElementById('btn-genera-baño').addEventListener('click', rotateQR);
  document.getElementById('btn-genera-ducha').addEventListener('click', rotateQR);