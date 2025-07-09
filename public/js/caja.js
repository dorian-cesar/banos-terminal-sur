$(document).ready(function () {
  // Función para cargar y mostrar todas las cajas
  function cargarCajas() {
    $.get('/api/caja/listar', function (data) {
      if (data.success && data.cajas.length > 0) {
        const tbody = $('#tablaCaja tbody');
        tbody.empty();
        
        data.cajas.forEach(caja => {
          // Calcular total_efectivo
          const totalEfectivo = parseFloat(caja.monto_inicial) + parseFloat(caja.venta_efectivo || 0);
          
          const row = `
            <tr>
              <td>${caja.id}</td>
              <td>${caja.fecha}</td>
              <td>${caja.hora_inicio || '-'}</td>
              <td>${caja.hora_cierre || '-'}</td>
              <td>$${parseFloat(caja.monto_inicial).toFixed(2)}</td>
              <td>$${parseFloat(caja.venta_efectivo || 0).toFixed(2)}</td>
              <td>$${parseFloat(caja.venta_tarjeta || 0).toFixed(2)}</td>
              <td>$${totalEfectivo.toFixed(2)}</td>
              <td>${caja.estado}</td>
              <td>${caja.observaciones || '-'}</td>
            </tr>
          `;
          tbody.append(row);
        });
      } else {
        $('#tablaCaja tbody').html('<tr><td colspan="10" class="text-center">No hay registros de caja</td></tr>');
      }
    }).fail(function () {
      $('#mensaje').html('<div class="alert alert-danger">Error al cargar los registros de caja</div>');
    });
  }

  // Cargar cajas al iniciar
  cargarCajas();

  // Botón para actualizar la lista
  $('#btnActualizar').on('click', cargarCajas);

  $('#formInicioCaja').on('submit', function (e) {
    e.preventDefault();
    let monto = $('#monto_inicial_modal').val();
    let observaciones = $('#observaciones_modal').val();

    $.post('/api/caja/abrir', { 
      monto_inicial: monto,
      observaciones: observaciones 
    }, function (res) {
      if (res.success) {
        localStorage.setItem('id_caja', res.id);
        $('#modalInicio').modal('hide');
        $('#mensaje').html('<div class="alert alert-success">Caja abierta correctamente</div>');
        $('#btnAbrirCaja').prop('disabled', true);
        cargarCajas(); // Actualizar la tabla después de abrir
      } else {
        $('#mensaje').html('<div class="alert alert-danger">' + res.error + '</div>');
      }
    });
  });

  $('#btnCerrarCaja').on('click', function () {
    let id = localStorage.getItem('id_caja');
    if (!id) {
      $('#mensaje').html('<div class="alert alert-warning">No hay caja abierta.</div>');
      return;
    }

    $.ajax({
      url: '/api/caja/cerrar',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ id_caja: id }),
      success: function (data) {
        if (data.success) {
          localStorage.removeItem('id_caja');
          $('#mensaje').html('<div class="alert alert-info">Caja cerrada correctamente</div>');
          $('#btnAbrirCaja').prop('disabled', false);
          cargarCajas(); // Actualizar la tabla después de cerrar
        } else {
          $('#mensaje').html('<div class="alert alert-danger">' + (data.error || 'Error desconocido') + '</div>');
        }
      },
      error: function (xhr, status, error) {
        $('#mensaje').html('<div class="alert alert-danger">Error en el servidor: ' + error + '</div>');
      }
    });
  });

  $('#btnImprimir').on('click', function () {
    $('#resumenCaja').show();
    window.print();
    $('#resumenCaja').hide();
  });

  // Mostrar mensaje si hay caja abierta
  const id = localStorage.getItem('id_caja');
  if (id) {
    $('#mensajeCaja').html(`<div class="alert alert-info">Hay una caja abierta con ID: ${id}</div>`);
    $('#btnAbrirCaja').prop('disabled', true);
  }
  
  document.getElementById('btnVolver').addEventListener('click', () => {
    window.location.href = '/home.html';
  });

});