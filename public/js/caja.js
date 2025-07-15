$(document).ready(function () {
  // Función para cargar y mostrar todas las cajas
  function cargarCajaUsuario() {
    const usuarioJSON = sessionStorage.getItem('usuario');
    const token = sessionStorage.getItem('authToken');

    if (!usuarioJSON || !token) {
      $('#infoCaja').html('');
      $('#tablaCaja tbody').html('<tr><td colspan="10" class="text-center text-danger">No hay sesión activa. Por favor inicia sesión.</td></tr>');
      return;
    }

    const payload = parseJwt(token);
    if (!payload || !payload.id) {
      $('#infoCaja').html('');
      $('#tablaCaja tbody').html('<tr><td colspan="10" class="text-center text-danger">Token inválido. Vuelve a iniciar sesión.</td></tr>');
      return;
    }

    const id_usuario = payload.id;

    $.get(`/api/caja/abierta?id_usuario=${id_usuario}`, function (res) {
      if (!res.success) {
        $('#infoCaja').html('');
        $('#tablaCaja tbody').html(`<tr><td colspan="10" class="text-center text-warning">${res.mensaje}</td></tr>`);
        return;
      }

      const c = res.caja;

      // Card de información
      const card = `
        <div class="card shadow-sm border-primary">
          <div class="card-body">
            <h5 class="card-title mb-2">Caja Abierta por: ${c.nombre_usuario}</h5>
            <p class="mb-1"><strong>N° Caja:</strong> ${c.numero_caja}</p>
            <p class="mb-1"><strong>Fecha:</strong> ${c.fecha_apertura} &nbsp; <strong>Hora:</strong> ${c.hora_apertura}</p>
          </div>
        </div>
      `;

      // Fila de la tabla
      const fila = `
        <tr>
          <td>${c.id_aperturas_cierres}</td>
          <td>${c.fecha_apertura}</td>
          <td>${c.hora_apertura}</td>
          <td>${c.hora_cierre ?? '—'}</td>
          <td>$${parseFloat(c.monto_inicial).toLocaleString()}</td>
          <td>$${parseFloat(c.total_efectivo ?? 0).toLocaleString()}</td>
          <td>$${parseFloat(c.total_tarjeta ?? 0).toLocaleString()}</td>
          <td><strong>$${parseFloat(c.total_general ?? 0).toLocaleString()}</strong></td>
          <td>${c.estado}</td>
          <td>${c.observaciones ?? '—'}</td>
        </tr>
      `;

      // Renderizar por separado
      $('#infoCaja').html(card);
      $('#tablaCaja tbody').html(fila);
    }).fail(function () {
      $('#infoCaja').html('');
      $('#tablaCaja tbody').html('<tr><td colspan="10" class="text-center text-danger">No se pudo cargar la caja abierta.</td></tr>');
    });
  }

  // Helper para decodificar JWT
  function parseJwt(token) {
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload));
    } catch (e) {
      return null;
    }
  }

  // Cargar cajas al iniciar
  cargarCajaUsuario();

  // Botón para actualizar la lista
  $('#btnActualizar').on('click', cargarCajaUsuario);

 $('#formInicioCaja').on('submit', function (e) {
    e.preventDefault();

    const monto = $('#monto_inicial_modal').val();
    const observaciones = $('#observaciones_modal').val();

    const token = sessionStorage.getItem('authToken');
    const usuarioJSON = sessionStorage.getItem('usuario');

    if (!token || !usuarioJSON) {
      alert('Sesión no válida. Vuelve a iniciar sesión.');
      sessionStorage.clear();
      window.location.href = '/login.html';
      return;
    }

    function parseJwt(token) {
      try {
        const payload = token.split('.')[1];
        return JSON.parse(atob(payload));
      } catch (err) {
        return null;
      }
    }

    const payload = parseJwt(token);
    if (!payload || !payload.id) {
      alert('Token inválido. Vuelve a iniciar sesión.');
      sessionStorage.clear();
      window.location.href = '/login.html';
      return;
    }

    const id_usuario_apertura = payload.id;

    if (!monto || isNaN(monto) || parseFloat(monto) <= 0) {
      $('#mensaje').html('<div class="alert alert-danger">El monto inicial debe ser un número mayor a 0.</div>');
      return;
    }

    $.post('/api/caja/abrir', {
      monto_inicial: monto,
      observaciones: observaciones,
      id_usuario_apertura: id_usuario_apertura
    }, function (res) {
      if (res.success) {
        localStorage.setItem('id_aperturas_cierres', res.id);
        localStorage.setItem('estado_caja', 'abierta');
        localStorage.setItem('numero_caja', res.numero_caja); 
        $('#modalInicio').modal('hide');
        $('#mensaje').html('<div class="alert alert-success">Caja abierta correctamente</div>');
        $('#btnAbrirCaja').prop('disabled', true);
        cargarCajaUsuario(); 
      } else {
        $('#mensaje').html('<div class="alert alert-danger">' + res.error + '</div>');
      }
    });
  });

 $('#btnCerrarCaja').on('click', function () {
    const id = localStorage.getItem('id_caja');

    if (!id) {
      $('#mensaje').html('<div class="alert alert-warning">No hay caja abierta.</div>');
      return;
    }

    // Función para decodificar JWT y obtener el payload
    function parseJwt(token) {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        return JSON.parse(jsonPayload);
      } catch (err) {
        console.error('Token inválido:', err);
        return null;
      }
    }

    // Obtener token y decodificar
    const token = sessionStorage.getItem('authToken');
    if (!token) {
      $('#mensaje').html('<div class="alert alert-danger">Sesión no válida. Inicia sesión nuevamente.</div>');
      sessionStorage.clear();
      window.location.href = '/login.html';
      return;
    }

    const payload = parseJwt(token);
    const id_usuario_cierre = payload?.id;

    if (!id_usuario_cierre || isNaN(id_usuario_cierre)) {
      $('#mensaje').html('<div class="alert alert-danger">Usuario inválido para cerrar caja.</div>');
      return;
    }

    // Enviar datos al backend
    $.ajax({
      url: '/api/caja/cerrar',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        id_caja: id,
        id_usuario_cierre: id_usuario_cierre
      }),
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

  $('#btnArqueo').on('click', function () {
    const token = sessionStorage.getItem('authToken');

    if (!token) {
      $('#mensaje').html('<div class="alert alert-danger">Sesión inválida. Inicia sesión nuevamente.</div>');
      sessionStorage.clear();
      window.location.href = '/login.html';
      return;
    }

    function parseJwt(token) {
      try {
        const payload = token.split('.')[1];
        const decoded = JSON.parse(atob(payload));
        return decoded;
      } catch (err) {
        return null;
      }
    }

    const payload = parseJwt(token);
    const creado_por = payload?.id;

    if (!creado_por || isNaN(creado_por)) {
      $('#mensaje').html('<div class="alert alert-danger">Usuario inválido para realizar el arqueo.</div>');
      return;
    }

    $.post('/api/caja/arqueo-diario', { creado_por }, function (res) {
      if (res.success) {
        $('#mensaje').html(`
          <div class="alert alert-success">
            Arqueo registrado: <br>
            <strong>Fecha:</strong> ${res.arqueo.fecha}<br>
            <strong>Total Efectivo:</strong> $${res.arqueo.total_efectivo.toFixed(2)}<br>
            <strong>Total Tarjeta:</strong> $${res.arqueo.total_tarjeta.toFixed(2)}<br>
            <strong>Total General:</strong> $${res.arqueo.total_general.toFixed(2)}
          </div>
        `);
      } else {
        $('#mensaje').html(`<div class="alert alert-danger">${res.error || 'Error al registrar arqueo.'}</div>`);
      }
    }).fail(function (xhr) {
      const mensaje = xhr?.responseJSON?.error || 'Error inesperado en el servidor';
      $('#mensaje').html(`<div class="alert alert-danger">${mensaje}</div>`);
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