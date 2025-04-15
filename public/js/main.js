document.addEventListener("DOMContentLoaded", function () {
  function openResumen() {
    const modal = document.getElementById("resumen-overlay");
    modal.style.display = "flex";
    cargarTabla();
  }

  function cargarTabla() {
    const endpointURL = urlBase + "/TerminalCalama/PHP/Restroom/load.php";
    const tableBody = document.getElementById("sales-table-body");

    tableBody.innerHTML = "";

    fetch(endpointURL)
      .then((response) => response.json())
      .then((data) => {
        const ordenado = data.sort((a, b) => {
          const fechaA = new Date(`${a.date} ${a.time}`);
          const fechaB = new Date(`${b.date} ${b.time}`);
          return fechaB - fechaA;
        });

        const ultimos = ordenado.slice(0, 8);

        ultimos.forEach((item) => {
          const row = document.createElement("tr");

          const tipoCell = document.createElement("td");
          tipoCell.textContent = item.tipo;
          row.appendChild(tipoCell);

          const codigoCell = document.createElement("td");
          codigoCell.textContent = item.Codigo;
          row.appendChild(codigoCell);

          const fechaCell = document.createElement("td");
          fechaCell.textContent = item.date;
          row.appendChild(fechaCell);

          const horaCell = document.createElement("td");
          horaCell.textContent = item.time;
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

          printButton.addEventListener("click", function () {
            const overlay = document.getElementById("ticket-print-overlay");
            const modal = document.getElementById("ticket-print-modal");
            const modalResume = document.getElementById("resumen-overlay");
            modalResume.style.display = "none";
            overlay.style.display = "flex";

            const infoItems = modal.querySelectorAll(".info-item");
            infoItems.forEach((infoItem) => {
              const label = infoItem
                .querySelector(".info-label")
                .textContent.trim();
              const value = infoItem.querySelector(".info-value");

              if (label === "TIPO") value.textContent = item.tipo;
              if (label === "CÓDIGO") value.textContent = item.Codigo;
              if (label === "FECHA") value.textContent = item.date;
              if (label === "HORA") value.textContent = item.time;
            });

            // const QR = new QRCode(contenedorQR);
            // QR.makeCode("wit");

            // const contenedorTicketQR =
            //   document.getElementById("contenedorTicketQR");
            // QR.makeCode(numeroT);
            // const qrImage = modal.querySelector(".qr-image");
            // qrImage.src = "images/QR@2x.png";
          });

          printCell.appendChild(printButton);
          row.appendChild(printCell);

          tableBody.appendChild(row);
        });
      })
      .catch((error) => {
        console.error("Error al obtener datos:", error);
      });
  }

  document
    .getElementById("resumen-overlay")
    .addEventListener("click", function (e) {
      if (e.target.id === "resumen-overlay") {
        closeResumen();
      }
    });

  document
    .getElementById("resumen-button")
    .addEventListener("click", openResumen);

  document
    .getElementById("ticket-print-overlay")
    .addEventListener("click", function (e) {
      if (e.target.id === "ticket-print-overlay") {
        closeTicketModal();
      }
    });
});

function closeResumen() {
  const modal = document.getElementById("resumen-overlay");
  modal.style.display = "none";
}

function closeTicketModal() {
  document.getElementById("ticket-print-overlay").style.display = "none";
}

// modal de ticket
document.addEventListener("DOMContentLoaded", function () {
  const modal = document.getElementById("ticket-overlay");
  const inputField = document.getElementById("ticketInput");
  const closeBtn = document.querySelector(".close-button");
  const reimprimirBtn = document.getElementById("reimprimirBtn");
  const searchBtn = document.getElementById("searchTicketBtn");
  const url = urlBase + "/TerminalCalama/PHP/Restroom/load.php";

  const tipoEl = modal.querySelector(".info-item:nth-child(1) .info-value");
  const codigoEl = modal.querySelector(".info-item:nth-child(2) .info-value");
  const fechaEl = modal.querySelector(".info-item:nth-child(3) .info-value");
  const horaEl = modal.querySelector(".info-item:nth-child(4) .info-value");

  searchBtn.addEventListener("click", async function () {
    const codigo = inputField.value.trim();
    if (!codigo) return;

    try {
      const res = await fetch(url);
      const data = await res.json();

      const ticket = data.find((t) => t.Codigo === codigo);
      console.log(ticket);

      if (ticket) {
        tipoEl.textContent = ticket.tipo;
        codigoEl.textContent = ticket.Codigo;
        fechaEl.textContent = ticket.date;
        horaEl.textContent = ticket.time;
        console.log("Mostrando modal");
        modal.style.display = "flex";
      } else {
        alert("Código no encontrado");
        modal.style.display = "none";
      }
    } catch (err) {
      console.error("Error al buscar ticket:", err);
    }
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
    // Tu lógica de reimpresión
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
