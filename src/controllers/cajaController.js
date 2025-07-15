const pool = require('../../db_config/db.js');
require('dotenv').config(); 

exports.abrirCaja = async (req, res) => {
  const { monto_inicial, observaciones, id_usuario_apertura } = req.body;
  const NUMERO_CAJA = parseInt(process.env.NUMERO_CAJA); // número de caja desde .env

  // Validaciones
  if (!monto_inicial || isNaN(monto_inicial) || parseFloat(monto_inicial) <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Monto inicial inválido. Debe ser un número mayor a 0.',
    });
  }

  if (!id_usuario_apertura || isNaN(id_usuario_apertura)) {
    return res.status(400).json({
      success: false,
      error: 'ID de usuario inválido',
    });
  }

  const fecha = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const hora = new Date().toTimeString().slice(0, 8);   // HH:MM:SS

  try {
    // Validar que la caja exista y esté activa
    const [cajaData] = await pool.execute(
      'SELECT numero_caja FROM cajas WHERE numero_caja = ? AND estado = "activa" LIMIT 1',
      [NUMERO_CAJA]
    );

    if (cajaData.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Caja no registrada o inactiva.',
      });
    }

    // Verificar si ya hay una apertura activa
    const [yaAbierta] = await pool.execute(
      'SELECT id FROM aperturas_cierres WHERE numero_caja = ? AND estado = "abierta" LIMIT 1',
      [NUMERO_CAJA]
    );

    if (yaAbierta.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Ya existe una caja abierta para este número.',
      });
    }

    // Insertar nueva apertura
    const [result] = await pool.execute(
      `INSERT INTO aperturas_cierres 
        (numero_caja, id_usuario_apertura, fecha_apertura, hora_apertura, monto_inicial, estado, observaciones)
       VALUES (?, ?, ?, ?, ?, 'abierta', ?)`,
      [
        NUMERO_CAJA,
        id_usuario_apertura,
        fecha,
        hora,
        parseFloat(monto_inicial),
        observaciones || null,
      ]
    );

    res.json({
      success: true,
      id: result.insertId,
      numero_caja: NUMERO_CAJA,
      fecha_apertura: fecha,
      hora_apertura: hora,
      monto_inicial: parseFloat(monto_inicial),
      estado: 'abierta',
      observaciones: observaciones || null,
    });
  } catch (err) {
    console.error('Error al abrir caja:', err);
    res.status(500).json({
      success: false,
      error: 'No se pudo abrir la caja.',
    });
  }
};

exports.cargarCajaAbiertaPorUsuario = async (req, res) => {
  const id_usuario = req.query.id_usuario;

  if (!id_usuario || isNaN(id_usuario)) {
    return res.status(400).json({ success: false, error: 'ID de usuario inválido.' });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT 
         ac.id AS id_aperturas_cierres,
         ac.numero_caja,
         c.nombre AS nombre_caja,
         u.username AS nombre_usuario,
         ac.fecha_apertura,
         ac.hora_apertura,
         ac.monto_inicial,
         ac.estado,
         ac.total_efectivo,
         ac.total_tarjeta,
         ac.total_general,
         ac.observaciones
       FROM aperturas_cierres ac
       INNER JOIN cajas c ON c.numero_caja = ac.numero_caja
       INNER JOIN users u ON u.id = ac.id_usuario_apertura
       WHERE ac.id_usuario_apertura = ? AND ac.estado = 'abierta'
       ORDER BY ac.fecha_apertura DESC, ac.hora_apertura DESC
       LIMIT 1`,
      [id_usuario]
    );

    if (rows.length === 0) {
      return res.json({ success: false, mensaje: 'No hay caja abierta asociada a este usuario.' });
    }

    res.json({ success: true, caja: rows[0] });

  } catch (err) {
    console.error('Error al cargar caja abierta:', err);
    res.status(500).json({ success: false, error: 'Error al obtener la caja abierta.' });
  }
};

exports.listarMovimientosPorUsuario = async (req, res) => {
  const id_usuario = req.query.id_usuario;

  if (!id_usuario || isNaN(id_usuario)) {
    return res.status(400).json({ success: false, error: 'ID de usuario inválido.' });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT 
         m.id,
         m.fecha,
         m.hora,
         m.monto,
         m.medio_pago,
         m.observaciones,
         m.codigo,
         m.numero_caja,
         s.nombre AS nombre_servicio
       FROM movimientos m
       INNER JOIN servicios s ON s.id = m.id_servicio
       WHERE m.id_usuario = ?
       ORDER BY m.fecha DESC, m.hora DESC`,
      [id_usuario]
    );

    res.json({ success: true, movimientos: rows });
  } catch (err) {
    console.error('Error al obtener movimientos:', err);
    res.status(500).json({ success: false, error: 'Error al listar movimientos.' });
  }
};


exports.registrarMovimiento = async (req, res) => {
  try {
    const { codigo, fecha, hora, tipo, valor, metodoPago, id_usuario } = req.body;
    const numero_caja = parseInt(process.env.NUMERO_CAJA); // Se usa número_caja directamente

    // Validaciones básicas
    if (!codigo || !fecha || !hora || !tipo || !valor || !metodoPago || !id_usuario) {
      return res.status(400).json({ success: false, message: 'Faltan datos requeridos' });
    }

    if (isNaN(valor) || valor <= 0) {
      return res.status(400).json({ success: false, message: 'Valor debe ser un número mayor a 0' });
    }

    if (isNaN(id_usuario)) {
      return res.status(400).json({ success: false, message: 'ID de usuario inválido' });
    }

    // Obtener ID del servicio a partir del tipo (BAÑO o DUCHA)
    const [servicioData] = await pool.execute(
      'SELECT id FROM servicios WHERE tipo = ? AND estado = "activo" LIMIT 1',
      [tipo]
    );

    if (servicioData.length === 0) {
      return res.status(400).json({ success: false, message: 'Tipo de servicio no válido o inactivo' });
    }

    const id_servicio = servicioData[0].id;

    // Obtener ID de la sesión de caja abierta
    const [apertura] = await pool.execute(
      'SELECT id FROM aperturas_cierres WHERE numero_caja = ? AND estado = "abierta" ORDER BY id DESC LIMIT 1',
      [numero_caja]
    );

    if (apertura.length === 0) {
      return res.status(400).json({ success: false, message: 'No hay caja abierta' });
    }

    const id_aperturas_cierres = apertura[0].id;

    // Insertar movimiento
    const [result] = await pool.execute(
      `INSERT INTO movimientos 
       (codigo, fecha, hora, id_servicio, monto, medio_pago, numero_caja, id_usuario, id_aperturas_cierres)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [codigo, fecha, hora, id_servicio, valor, metodoPago, numero_caja, id_usuario, id_aperturas_cierres]
    );

    res.json({ success: true, message: 'Movimiento registrado', insertId: result.insertId });

  } catch (error) {
    console.error('Error al registrar movimiento:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};



exports.cerrarCaja = async (req, res) => {
  const { id_caja, id_usuario_cierre } = req.body;

  if (!id_caja || isNaN(id_caja)) {
    return res.status(400).json({ success: false, error: 'ID de caja inválido' });
  }

  if (!id_usuario_cierre || isNaN(id_usuario_cierre)) {
    return res.status(400).json({ success: false, error: 'ID de usuario inválido' });
  }

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

    // Registrar cierre diario
    await pool.execute(
      `INSERT INTO cierres_diarios (id_caja, fecha, hora_cierre, venta_efectivo, venta_tarjeta, id_usuario)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id_caja, fecha_cierre, hora_cierre, venta_efectivo, venta_tarjeta, id_usuario_cierre]
    );

    // Actualizar caja
    const [updateResult] = await pool.execute(
      `UPDATE caja
       SET estado = 'cerrada',
           hora_cierre = ?,
           fecha_cierre = ?,
           venta_efectivo = ?,
           venta_tarjeta = ?,
           id_usuario_cierre = ?
       WHERE id = ? AND estado = 'abierta'`,
      [hora_cierre, fecha_cierre, venta_efectivo, venta_tarjeta, id_usuario_cierre, id_caja]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(400).json({ success: false, error: 'La caja ya está cerrada o no existe' });
    }

    res.json({
      success: true,
      message: 'Caja cerrada correctamente',
      cierre: {
        id_caja,
        id_usuario_cierre,
        fecha_cierre,
        hora_cierre,
        venta_efectivo,
        venta_tarjeta
      }
    });

  } catch (error) {
    console.error('Error al cerrar caja:', error);
    res.status(500).json({ success: false, error: 'Error interno al cerrar caja' });
  }
};


