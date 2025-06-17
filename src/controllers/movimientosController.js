const pool = require('../../db_config/db.js');

exports.abrirCaja = async (req, res) => {
  const { monto_inicial } = req.body;

  if (!monto_inicial || isNaN(monto_inicial)) {
    return res.status(400).json({ success: false, error: 'Monto inicial inválido' });
  }

  const fecha = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const hora = new Date().toTimeString().slice(0, 8);   // HH:MM:SS

  try {
    const [result] = await pool.execute(
      "INSERT INTO caja (fecha, hora_inicio, monto_inicial, estado) VALUES (?, ?, ?, 'abierta')",
      [fecha, hora, parseFloat(monto_inicial)]
    );

    res.json({
      success: true,
      id: result.insertId,
      fecha,
      hora_inicio: hora,
      monto_inicial,
      estado: 'abierta'
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
  const fecha = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const hora_cierre = new Date().toTimeString().slice(0, 8); // HH:MM:SS

  try {
    // Total efectivo
    const [efectivoResult] = await pool.execute(
      "SELECT SUM(valor) AS total FROM movimientos WHERE id_caja = ? AND metodoPago = 'efectivo'",
      [id_caja]
    );
    const total_efectivo = efectivoResult[0].total || 0;

    // Total tarjeta
    const [tarjetaResult] = await pool.execute(
      "SELECT SUM(valor) AS total FROM movimientos WHERE id_caja = ? AND metodoPago = 'tarjeta'",
      [id_caja]
    );
    const total_tarjeta = tarjetaResult[0].total || 0;

    // Insertar en cierres_diarios
    await pool.execute(
      `INSERT INTO cierres_diarios (id_caja, fecha, hora_cierre, total_efectivo, total_tarjeta)
       VALUES (?, ?, ?, ?, ?)`,
      [id_caja, fecha, hora_cierre, total_efectivo, total_tarjeta]
    );

    res.json({
      success: true,
      message: 'Caja cerrada correctamente',
      cierre: {
        id_caja,
        fecha,
        hora_cierre,
        total_efectivo,
        total_tarjeta
      }
    });
  } catch (error) {
    console.error('Error al cerrar caja:', error);
    res.status(500).json({ success: false, error: 'Error interno al cerrar caja' });
  }
};


