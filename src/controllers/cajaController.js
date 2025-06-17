const pool = require('../../db_config/db.js');

exports.abrirCaja = async (req, res) => {
  const { monto_inicial, observaciones } = req.body;

  if (!monto_inicial || isNaN(monto_inicial)) {
    return res.status(400).json({ success: false, error: 'Monto inicial inválido' });
  }

  const fecha = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const hora_inicio = new Date().toTimeString().slice(0, 8); // HH:MM:SS

  try {
    const [result] = await pool.execute(
      "INSERT INTO caja (fecha, hora_inicio, monto_inicial, estado, observaciones, fecha_cierre) VALUES (?, ?, ?, 'abierta', ?, ?)",
      [fecha, hora_inicio, parseFloat(monto_inicial), observaciones || null, '0000-00-00'] // Fecha cierre temporal
    );

    res.json({
      success: true,
      id: result.insertId,
      fecha,
      hora_inicio,
      monto_inicial,
      estado: 'abierta',
      observaciones: observaciones || null
    });
  } catch (err) {
    console.error('Error al abrir caja:', err);
    res.status(500).json({ success: false, error: 'No se pudo abrir caja.' });
  }
};

exports.registrarMovimiento = async (req, res) => {
  try {
    const { codigo, fecha, hora, tipo, valor, metodoPago, id_caja } = req.body;

    if (!codigo || !fecha || !hora || !tipo || !valor || !metodoPago) {
      return res.status(400).json({ success: false, message: 'Faltan datos requeridos' });
    }

    const [result] = await pool.execute(
      `INSERT INTO movimientos (codigo, fecha, hora, tipo, valor, metodoPago, id_caja)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [codigo, fecha, hora, tipo, valor, metodoPago, id_caja || null]
    );

    res.json({ success: true, message: 'Movimiento registrado', insertId: result.insertId });
  } catch (error) {
    console.error('Error al registrar movimiento:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

exports.cerrarCaja = async (req, res) => {
  const { id_caja } = req.body;
  const fecha_cierre = new Date().toISOString().slice(0, 10);
  const hora_cierre = new Date().toTimeString().slice(0, 8);

  try {
    // Obtener montos de movimientos
    const [movimientos] = await pool.execute(
      `SELECT 
        SUM(CASE WHEN metodoPago = 'EFECTIVO' THEN valor ELSE 0 END) AS total_efectivo,
        SUM(CASE WHEN metodoPago = 'TARJETA' THEN valor ELSE 0 END) AS total_tarjeta
       FROM movimientos 
       WHERE id_caja = ?`,
      [id_caja]
    );

    const venta_efectivo = movimientos[0].total_efectivo || 0;
    const venta_tarjeta = movimientos[0].total_tarjeta || 0;

    // Registrar cierre
    await pool.execute(
      `INSERT INTO cierres_diarios (id_caja, fecha, hora_cierre, venta_efectivo, venta_tarjeta)
       VALUES (?, ?, ?, ?, ?)`,
      [id_caja, fecha_cierre, hora_cierre, venta_efectivo, venta_tarjeta]
    );

    // Actualizar caja
    await pool.execute(
      `UPDATE caja
       SET estado = 'cerrada',
           hora_cierre = ?,
           fecha_cierre = ?,
           venta_efectivo = ?,
           venta_tarjeta = ?
       WHERE id = ? AND estado = 'abierta'`,
      [hora_cierre, fecha_cierre, venta_efectivo, venta_tarjeta, id_caja]
    );

    res.json({
      success: true,
      message: 'Caja cerrada correctamente',
      cierre: { id_caja, fecha_cierre, hora_cierre, venta_efectivo, venta_tarjeta }
    });
  } catch (error) {
    console.error('Error al cerrar caja:', error);
    res.status(500).json({ success: false, error: 'Error interno al cerrar caja' });
  }
};

exports.listarCajas = async (req, res) => {
  try {
    // Obtener todas las cajas
    const [cajas] = await pool.execute(`
      SELECT 
        id,
        fecha,
        hora_inicio,
        hora_cierre,
        monto_inicial,
        estado,
        observaciones,
        fecha_cierre
      FROM caja
      ORDER BY fecha DESC, hora_inicio DESC
    `);

    // Para cada caja, obtener los totales de movimientos
    const cajasConTotales = await Promise.all(cajas.map(async (caja) => {
      const [totales] = await pool.execute(
        `SELECT 
          SUM(CASE WHEN metodoPago = 'EFECTIVO' THEN valor ELSE 0 END) AS venta_efectivo,
          SUM(CASE WHEN metodoPago = 'TARJETA' THEN valor ELSE 0 END) AS venta_tarjeta
         FROM movimientos 
         WHERE id_caja = ?`,
        [caja.id]
      );

      return {
        ...caja,
        venta_efectivo: parseFloat(totales[0]?.venta_efectivo || 0),
        venta_tarjeta: parseFloat(totales[0]?.venta_tarjeta || 0),
        total_efectivo: parseFloat(caja.monto_inicial) + parseFloat(totales[0]?.venta_efectivo || 0)
      };
    }));

    // Formatear respuesta
    const cajasFormateadas = cajasConTotales.map(caja => ({
      id: caja.id,
      fecha: caja.fecha,
      hora_inicio: caja.hora_inicio || '-',
      hora_cierre: caja.hora_cierre || '-',
      monto_inicial: parseFloat(caja.monto_inicial),
      venta_efectivo: caja.venta_efectivo,
      venta_tarjeta: caja.venta_tarjeta,
      total_efectivo: caja.total_efectivo,
      estado: caja.estado,
      observaciones: caja.observaciones || '-',
      fecha_cierre: caja.fecha_cierre !== '0000-00-00' ? caja.fecha_cierre : '-'
    }));

    res.json({ success: true, cajas: cajasFormateadas });
  } catch (error) {
    console.error('Error al listar cajas:', error);
    res.status(500).json({ success: false, error: 'Error al obtener el listado de cajas' });
  }
};