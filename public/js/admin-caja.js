const usuario = JSON.parse(localStorage.getItem('usuario'));
const nombre = usuario?.username || 'desconocido';

$(document).ready(() => {
  $('#btnArqueoCajas').on('click', () => {
    fetch('/api/caja/cajas-dia') 
      .then(res => res.json())
      .then(data => {
        if (!data.success || !Array.isArray(data.detalles) || data.detalles.length === 0) {
          $('#tablaArqueo tbody').html('<tr><td colspan="9" class="text-center text-muted">No hay cajas hoy.</td></tr>');
          return;
        }

        const filas = data.detalles.map(c => `
          <tr>
            <td>${c.id}</td>
            <td>${c.nombre_caja}</td>
            <td>${c.username}</td>
            <td>${c.fecha_apertura}</td>
            <td>${c.hora_apertura}</td>
            <td>$${parseFloat(c.monto_inicial).toLocaleString()}</td>
            <td>$${parseFloat(c.total_efectivo).toLocaleString()}</td>
            <td>$${parseFloat(c.total_tarjeta).toLocaleString()}</td>
            <td>${c.observaciones ?? '—'}</td>
          </tr>
        `).join('');

        $('#tablaArqueo tbody').html(filas);
        $('#btnConfirmarArqueo').removeClass('d-none').show();
      })
      .catch(err => {
        console.error('Error al cargar cajas:', err);
        alert('Error al cargar datos para arqueo.');
      });
  });

  $('#btnConfirmarArqueo').on('click', () => {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    const nombre_usuario = usuario?.username || 'desconocido';

    fetch('/api/caja/arqueo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre_usuario })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          alert(data.mensaje);

          const filas = data.detalles.map(c => `
            <tr>
              <td>${c.id}</td>
              <td>${c.nombre_caja}</td>
              <td>${c.username}</td>
              <td>${c.fecha_apertura}</td>
              <td>${c.hora_apertura}</td>
              <td>$${parseFloat(c.monto_inicial).toLocaleString()}</td>
              <td>$${parseFloat(c.total_efectivo).toLocaleString()}</td>
              <td>$${parseFloat(c.total_tarjeta).toLocaleString()}</td>
              <td>${c.observaciones}</td>
            </tr>
          `).join('');

          $('#tablaArqueo tbody').html(filas);
          $('#btnConfirmarArqueo').addClass('d-none');
        } else {
          alert('Error: ' + (data.error || 'No se pudo completar el arqueo.'));
        }
      })
      .catch(err => {
        console.error('Error en confirmación de arqueo:', err);
        alert('Error en el servidor al realizar arqueo.');
      });
  });

  $('#btnVolver').on('click', () => {
    window.location.href = '/home.html';
  });
});
