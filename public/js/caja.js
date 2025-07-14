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
      tipo: datos.tipo,
      valor: datos.valor,
      metodoPago: datos.metodoPago,
      id_usuario: id_usuario
    }),
    success: function(response) {
      if (response.success) {
        console.log('✅ Movimiento registrado:', response.data);
      } else {
        mostrarError(response.message);
      }
    },
    error: function(xhr) {
      mostrarError(xhr.responseJSON?.message || '❌ Error al registrar movimiento');
    }
  });
}

function parseJwt(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch (e) { return null; }
}

function cargarCajaAbierta() {
  const token = sessionStorage.getItem('authToken');
  if (!token) {
    $('#mensaje').html('<div class="alert alert-danger">Sesión expirada. Inicia sesión.</div>');
    window.location.href = '/login.html';
    return;
  }

  const usuario = parseJwt(token);
  if (!usuario?.id) {
    $('#mensaje').html('<div class="alert alert-danger">Token inválido.</div>');
    window.location.href = '/login.html';
    return;
  }

  $.get(`/api/caja/abierta/${usuario.id}`, function (res) {
    const tbody = $('#tablaCaja tbody');
    tbody.empty();

    if (res.success && res.data) {
      const c = res.data;
      const totalEfectivo = parseFloat(c.monto_inicial) + parseFloat(c.venta_efectivo);

      const row = `
        <tr>
          <td>${c.numero_caja}</td>
          <td>${c.fecha_apertura}</td>
          <td>${c.hora_apertura}</td>
          <td>-</td>
          <td>$${parseFloat(c.monto_inicial).toFixed(2)}</td>
          <td>$${c.venta_efectivo.toFixed(2)}</td>
          <td>$${c.venta_tarjeta.toFixed(2)}</td>
          <td>$${totalEfectivo.toFixed(2)}</td>
          <td>${c.estado}</td>
          <td>${c.observaciones || '-'}</td>
        </tr>`;
      tbody.append(row);
    } else {
      tbody.html('<tr><td colspan="10" class="text-center">No hay caja abierta para este usuario</td></tr>');
    }
  }).fail(() => {
    $('#mensaje').html('<div class="alert alert-danger">Error al consultar caja abierta</div>');
  });
}

function cargarCajasUsuario() {
  const token = sessionStorage.getItem('authToken');
  if (!token) {
    $('#mensaje').html('<div class="alert alert-danger">Sesión no válida. Inicia sesión nuevamente.</div>');
    return;
  }

  // Extraer ID desde el token JWT
  let id_usuario;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    id_usuario = payload.id;
  } catch (err) {
    $('#mensaje').html('<div class="alert alert-danger">Token inválido. Vuelve a iniciar sesión.</div>');
    return;
  }

  if (!id_usuario || isNaN(id_usuario)) {
    $('#mensaje').html('<div class="alert alert-danger">ID de usuario inválido.</div>');
    return;
  }

  $.get(`/api/caja/usuario/${id_usuario}`, function (res) {
    if (res.success) {
      const cajas = res.data;

      if (!cajas || cajas.length === 0) {
        $('#tablaCaja tbody').html('<tr><td colspan="10" class="text-center">No hay cajas registradas para este usuario</td></tr>');
        return;
      }

      const tbody = $('#tablaCaja tbody');
      tbody.empty();

      cajas.forEach(caja => {
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
      $('#mensaje').html(`<div class="alert alert-danger">${res.error || 'Error al obtener las cajas del usuario.'}</div>`);
    }
  }).fail(function (xhr) {
    const mensaje = xhr?.responseJSON?.error || 'Error inesperado al cargar las cajas del usuario';
    $('#mensaje').html(`<div class="alert alert-danger">${mensaje}</div>`);
  });
}

$(document).ready(() => {
  cargarCajaAbierta();
});

$(document).ready(function () {
  verificarEstadoCaja();
  // Función para cargar y mostrar todas las cajas
  // function cargarCaja() {
  //   $.get('/api/caja/listar', function (data) {
  //     if (data.success && data.data.length > 0) {
  //       const tbody = $('#tablaCaja tbody');
  //       tbody.empty();

  //       data.data.forEach(caja => {
  //         const totalEfectivo = parseFloat(caja.monto_inicial) + parseFloat(caja.venta_efectivo || 0);

  //         const row = `
  //           <tr>
  //             <td>${caja.numero_caja}</td>
  //             <td>${caja.fecha_apertura}</td>
  //             <td>${caja.hora_apertura || '-'}</td>
  //             <td>${caja.hora_cierre || '-'}</td>
  //             <td>$${parseFloat(caja.monto_inicial).toFixed(2)}</td>
  //             <td>$${parseFloat(caja.venta_efectivo || 0).toFixed(2)}</td>
  //             <td>$${parseFloat(caja.venta_tarjeta || 0).toFixed(2)}</td>
  //             <td>$${totalEfectivo.toFixed(2)}</td>
  //             <td>${caja.estado}</td>
  //             <td>${caja.observaciones || '-'}</td>
  //           </tr>
  //         `;
  //         tbody.append(row);
  //       });

  //     } else {
  //       $('#tablaCaja tbody').html('<tr><td colspan="10" class="text-center">No hay registros de caja</td></tr>');
  //     }
  //   }).fail(function () {
  //     $('#mensaje').html('<div class="alert alert-danger">Error al cargar los registros de caja</div>');
  //   });
  // }

  // Cargar cajas al iniciar
  cargarCajaAbierta();

  // Botón para actualizar la caja abierta
  $('#btnActualizar').on('click', cargarCajaAbierta);

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
    const id_usuario_apertura = payload?.id;

    if (!id_usuario_apertura || isNaN(id_usuario_apertura)) {
      alert('Token inválido. Vuelve a iniciar sesión.');
      sessionStorage.clear();
      window.location.href = '/login.html';
      return;
    }

    if (!monto || isNaN(monto) || parseFloat(monto) <= 0) {
      $('#mensaje').html('<div class="alert alert-danger">El monto inicial debe ser un número mayor a 0.</div>');
      return;
    }

    $.post('/api/caja/abrir', {
      monto_inicial: monto,
      observaciones: observaciones,
      id_usuario_apertura: id_usuario_apertura
    })
      .done(function (res) {
        localStorage.setItem('numero_caja', res.numero_caja);
        localStorage.setItem('sesionActiva', res.sesion);

        $('#modalInicio').modal('hide');
        $('#mensaje').html(`
          <div class="alert alert-success">
            Caja abierta correctamente<br>            
          </div>
        `);
        $('#btnAbrirCaja').prop('disabled', true);
        cargarCajaAbierta();
      })
      .fail(function (xhr) {
        const msg = xhr.responseJSON?.error || 'Error al abrir caja';
        if (msg === 'Ya existe una caja abierta con este número') {
          alert('⚠️ Esta caja ya está abierta. Cierre la sesión anterior antes de abrir una nueva.');
        } else {
          $('#mensaje').html('<div class="alert alert-danger">' + msg + '</div>');
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
          cargarCajasUsuario(); // Actualizar la tabla después de cerrar
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
        const arqueo = res.data;
        $('#mensaje').html(`
          <div class="alert alert-success">
            Arqueo registrado: <br>
            <strong>Fecha:</strong> ${arqueo.fecha}<br>
            <strong>Total Efectivo:</strong> $${arqueo.total_efectivo.toFixed(2)}<br>
            <strong>Total Tarjeta:</strong> $${arqueo.total_tarjeta.toFixed(2)}<br>
            <strong>Total General:</strong> $${arqueo.total_general.toFixed(2)}
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

   
  document.getElementById('btnVolver').addEventListener('click', () => {
    window.location.href = '/home.html';
  });

});