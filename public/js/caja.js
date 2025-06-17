$(document).ready(function () {
  function mostrarCaja(data) {
    $('#infoCaja').html(`
      <div class="card mt-3">
        <div class="card-header">Resumen de Caja</div>
        <div class="card-body">
          <p><strong>ID Caja:</strong> ${data.id || data.id_caja}</p>
          <p><strong>Fecha:</strong> ${data.fecha}</p>
          <p><strong>Hora inicio:</strong> ${data.hora_inicio || '-'}</p>
          <p><strong>Monto inicial:</strong> $${data.monto_inicial}</p>
          <p><strong>Monto efectivo:</strong> $${data.total_efectivo || 0}</p>
          <p><strong>Monto tarjeta:</strong> $${data.total_tarjeta || 0}</p>
          <p><strong>Hora cierre:</strong> ${data.hora_cierre || '-'}</p>
          <p><strong>Estado:</strong> ${data.estado}</p>
        </div>
      </div>
    `);
  }

  $('#formInicioCaja').on('submit', function (e) {
    e.preventDefault();
    let monto = $('#monto_inicial_modal').val();

    $.post('/api/caja/abrir', { monto_inicial: monto }, function (res) {
      if (res.success) {
        localStorage.setItem('id_caja', res.id);
        mostrarCaja(res);
        $('#modalInicio').modal('hide');
        $('#mensaje').html('<div class="alert alert-success">Caja abierta correctamente</div>');
        $('#btnAbrirCaja').prop('disabled', true);
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
          mostrarCaja(data);
          $('#mensaje').html('<div class="alert alert-info">Caja cerrada correctamente</div>');
          $('#btnAbrirCaja').prop('disabled', false);
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

  // Mostrar caja si hay una abierta
  const id = localStorage.getItem('id_caja');
  if (id) {
    $('#mensajeCaja').html(`<div class="alert alert-info">Hay una caja abierta con ID: ${id}</div>`);
    $.post('/api/caja/mostrar', { id_caja: id }, function (res) {
      if (res.success) {
        mostrarCaja(res);
        $('#btnAbrirCaja').prop('disabled', true);
      }
    });
  }
});
