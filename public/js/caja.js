// Función para verificar estado de la caja
function verificarEstadoCaja() {
  $.get('/api/caja/estado', function(data) {
    if (data.success) {
      if (data.estado === 'abierta') {
        $('#mensajeCaja').html(`
          <div class="alert alert-info">
            Caja ${data.numero_caja} abierta<br>
            <small>Fecha: ${data.fecha_apertura} ${data.hora_apertura}</small>
          </div>
        `);
        $('#btnAbrirCaja').prop('disabled', true);
        localStorage.setItem('caja_abierta', 'true');
      } else {
        $('#btnAbrirCaja').prop('disabled', false);
        localStorage.removeItem('caja_abierta');
      }
    }
  }).fail(function() {
    $('#mensaje').html('<div class="alert alert-danger">Error al verificar estado de caja</div>');
  });
}

function registrarMovimiento(datos) {
  const sesion = localStorage.getItem('sesionActiva');
  const numero_caja = localStorage.getItem('numero_caja');
  const id_usuario = obtenerIdUsuario(); // Función que obtiene el ID del usuario logueado

  if (!sesion || !numero_caja || !id_usuario) {
    mostrarError('Faltan datos de sesión o usuario. Asegúrate de que la caja esté abierta y la sesión activa.');
    return;
  }

  return $.ajax({
    url: '/api/caja/movimiento',
    type: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({
      codigo: datos.codigo,
      fecha: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      hora: new Date().toTimeString().slice(0, 8),    // HH:MM:SS
      tipo: datos.tipo,
      valor: datos.valor,
      metodoPago: datos.metodoPago,
      numero_caja: parseInt(numero_caja),
      sesion: parseInt(sesion),
      id_usuario: id_usuario
    }),
    success: function(response) {
      if (response.success) {
        console.log('✅ Movimiento registrado:', response.data);
        // Puedes mostrar mensaje de éxito aquí
      } else {
        mostrarError(response.message);
      }
    },
    error: function(xhr) {
      mostrarError(xhr.responseJSON?.message || '❌ Error al registrar movimiento');
    }
  });
}


$(document).ready(function () {
  verificarEstadoCaja();
  // Función para cargar y mostrar todas las cajas
  function cargarCaja() {
    $.get('/api/caja/listar', function (data) {
      if (data.success && data.cajas.length > 0) {
        const tbody = $('#tablaCaja tbody');
        tbody.empty();
        
        data.cajas.forEach(caja => {
          // Calcular total_efectivo
          const totalEfectivo = parseFloat(caja.monto_inicial) + parseFloat(caja.venta_efectivo || 0);
          
          const row = `
            <tr>
              <td>${caja.numero_caja}</td>
              <td>${caja.fecha_apertura}</td>
              <td>${caja.hora_apertura || '-'}</td>
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
  cargarCaja();

  // Botón para actualizar la lista
  $('#btnActualizar').on('click', cargarCaja);

  $('#formInicioCaja').on('submit', function (e) {
    e.preventDefault();

    const monto = $('#monto_inicial_modal').val();
    const observaciones = $('#observaciones_modal').val();

    // Obtener token y datos de sesión
    const token = sessionStorage.getItem('authToken');
    const usuarioJSON = sessionStorage.getItem('usuario');

    if (!token || !usuarioJSON) {
      alert('Sesión no válida. Vuelve a iniciar sesión.');
      sessionStorage.clear();
      window.location.href = '/login.html';
      return;
    }

    // Función para decodificar el JWT y extraer el ID de usuario
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
    if (!payload || !payload.id) {
      alert('Token inválido. Vuelve a iniciar sesión.');
      sessionStorage.clear();
      window.location.href = '/login.html';
      return;
    }

    const id_usuario_apertura = payload.id;

    // Validar monto
    if (!monto || isNaN(monto) || parseFloat(monto) <= 0) {
      $('#mensaje').html('<div class="alert alert-danger">El monto inicial debe ser un número mayor a 0.</div>');
      return;
    }

    // Enviar apertura al backend
    $.post('/api/caja/abrir', {
      monto_inicial: monto,
      observaciones: observaciones,
      id_usuario_apertura: id_usuario_apertura
    }, function (res) {
      if (res.success) {
        // Guardar número de caja y sesión activa
        localStorage.setItem('numero_caja', res.numero_caja);
        localStorage.setItem('sesionActiva', res.sesion); // NUEVO

        $('#modalInicio').modal('hide');
        $('#mensaje').html(`
          <div class="alert alert-success">
            Caja ${res.numero_caja} abierta correctamente<br>
            <small>Sesión: ${res.sesion} | Fecha: ${res.fecha_apertura} ${res.hora_apertura}</small>
          </div>
        `);

        $('#btnAbrirCaja').prop('disabled', true);
        cargarCaja(); // Refresca datos en la vista
      } else {
        $('#mensaje').html('<div class="alert alert-danger">' + res.error + '</div>');
      }
    });
  });


 $('#btnCerrarCaja').on('click', function () {
    const numero_caja = localStorage.getItem('numero_caja');

    if (!numero_caja) {
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
        numero_caja: numero_caja,
        id_usuario_cierre: id_usuario_cierre
      }),
      success: function (data) {
        if (data.success) {
          localStorage.removeItem('numero_caja');
          $('#mensaje').html('<div class="alert alert-info">Caja cerrada correctamente</div>');
          $('#btnAbrirCaja').prop('disabled', false);
          cargarCaja(); // Actualizar la tabla después de cerrar
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
  const id = localStorage.getItem('numero_caja');
  if (id) {
    $('#mensajeCaja').html(`<div class="alert alert-info">Hay una caja abierta con ID: ${id}</div>`);
    $('#btnAbrirCaja').prop('disabled', true);
  }
  
  document.getElementById('btnVolver').addEventListener('click', () => {
    window.location.href = '/home.html';
  });

});