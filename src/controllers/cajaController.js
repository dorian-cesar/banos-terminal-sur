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

exports.listarCajaAbierta = async (req, res) => {
  const { numero_caja } = req.query;

  if (!numero_caja) {
    return res.status(400).json({
      success: false,
      message: 'Falta el número de caja',
    });
  }

  try {
    const [result] = await pool.execute(
      `SELECT 
         ac.id AS id_aperturas_cierres,
         ac.numero_caja,
         u.username AS nombre_usuario,
         ac.fecha_apertura,
         ac.hora_apertura,
         ac.estado
       FROM aperturas_cierres ac
       INNER JOIN users u ON ac.id_usuario_apertura = u.id
       WHERE ac.numero_caja = ? AND ac.estado = 'abierta'
       ORDER BY ac.id DESC
       LIMIT 1`,
      [numero_caja]
    );

    if (result.length === 0) {
      return res.json({
        success: false,
        message: 'No hay caja abierta para este número',
      });
    }

    return res.json({
      success: true,
      caja: result[0],
    });
  } catch (error) {
    console.error('Error al obtener la caja abierta:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
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

exports.listarMovimientosPorCaja = async (req, res) => {
  const numero_caja = req.query.numero_caja;

  if (!numero_caja || isNaN(numero_caja)) {
    return res.status(400).json({ success: false, error: 'Número de caja inválido.' });
  }

  try {
    // Verificar si hay una caja abierta para ese número
    const [cajaAbierta] = await pool.execute(
      `SELECT id 
       FROM aperturas_cierres 
       WHERE numero_caja = ? AND estado = 'abierta' 
       ORDER BY id DESC LIMIT 1`,
      [numero_caja]
    );

    if (cajaAbierta.length === 0) {
      return res.json({ success: false, mensaje: 'No hay caja abierta para este número.' });
    }

    const id_aperturas_cierres = cajaAbierta[0].id;

    // Obtener movimientos asociados a la sesión abierta
    const [movimientos] = await pool.execute(
      `SELECT 
         m.id,
         m.codigo,
         m.fecha,
         m.hora,
         m.monto,
         m.medio_pago,
         s.nombre AS nombre_servicio,
         s.tipo AS tipo_servicio,
         u.username AS nombre_usuario
       FROM movimientos m
       INNER JOIN servicios s ON s.id = m.id_servicio
       INNER JOIN users u ON u.id = m.id_usuario
       WHERE m.id_aperturas_cierres = ?
       ORDER BY m.fecha DESC, m.hora DESC`,
      [id_aperturas_cierres]
    );

    res.json({ success: true, movimientos });
  } catch (err) {
    console.error('Error al listar movimientos por caja:', err);
    res.status(500).json({ success: false, error: 'Error interno al listar movimientos.' });
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
  const { id_aperturas_cierres, id_usuario_cierre, observaciones } = req.body;

  if (!id_aperturas_cierres || !id_usuario_cierre) {
    return res.status(400).json({
      success: false,
      error: 'Datos obligatorios faltantes.',
    });
  }

  try {
    // Verificar que la sesión exista y esté abierta
    const [sesiones] = await pool.execute(
      `SELECT estado FROM aperturas_cierres WHERE id = ?`,
      [id_aperturas_cierres]
    );

    if (sesiones.length === 0) {
      return res.status(404).json({ success: false, error: 'Sesión no encontrada.' });
    }

    if (sesiones[0].estado !== 'abierta') {
      return res.status(400).json({ success: false, error: 'La sesión ya está cerrada.' });
    }

    // Obtener totales desde la tabla movimientos
    const [[totales]] = await pool.execute(
      `SELECT 
         SUM(CASE WHEN medio_pago = 'EFECTIVO' THEN monto ELSE 0 END) AS total_efectivo,
         SUM(CASE WHEN medio_pago = 'TARJETA' THEN monto ELSE 0 END) AS total_tarjeta
       FROM movimientos
       WHERE id_aperturas_cierres = ?`,
      [id_aperturas_cierres]
    );

    // Valores por defecto si no hubo ventas
    const total_efectivo = totales.total_efectivo || 0;
    const total_tarjeta = totales.total_tarjeta || 0;

    // Obtener fecha y hora actuales
    const now = new Date();
    const fecha_cierre = now.toISOString().split('T')[0];
    const hora_cierre = now.toTimeString().split(':').slice(0, 2).join(':');

    // Actualizar la sesión
    await pool.execute(
      `UPDATE aperturas_cierres
       SET estado = 'cerrada',
           fecha_cierre = ?,
           hora_cierre = ?,
           id_usuario_cierre = ?,
           total_efectivo = ?,
           total_tarjeta = ?,
           observaciones = ?
       WHERE id = ?`,
      [
        fecha_cierre,
        hora_cierre,
        id_usuario_cierre,
        total_efectivo,
        total_tarjeta,
        observaciones || null,
        id_aperturas_cierres,
      ]
    );

    res.json({
      success: true,
      mensaje: 'Caja cerrada correctamente.',
      data: {
        total_efectivo,
        total_tarjeta,
        total_general: total_efectivo + total_tarjeta,
        fecha_cierre,
        hora_cierre,
      },
    });
  } catch (err) {
    console.error('Error al cerrar la caja:', err);
    res.status(500).json({
      success: false,
      error: 'Error interno al cerrar la caja.',
    });
  }
};

exports.listarCajasDelDia = async (req, res) => {
  try {
    const [registros] = await pool.execute(
      `SELECT 
         ac.id,
         ac.fecha_apertura,
         ac.hora_apertura,
         ac.monto_inicial,
         ac.total_efectivo,
         ac.total_tarjeta,
         ac.observaciones,
         u.username,
         c.nombre AS nombre_caja
       FROM aperturas_cierres ac
       INNER JOIN users u ON u.id = ac.id_usuario_apertura
       INNER JOIN cajas c ON c.numero_caja = ac.numero_caja
       WHERE ac.fecha_apertura = CURDATE()
         AND ac.fue_arqueada = FALSE`
    );

    res.json({
      success: true,
      detalles: registros
    });
  } catch (err) {
    console.error('Error al listar cajas del día:', err);
    res.status(500).json({ success: false, error: 'Error interno.' });
  }
};

exports.realizarArqueoDelDia = async (req, res) => {
  const { nombre } = req.body;

  if (!nombre) {
    return res.status(400).json({ success: false, error: 'Nombre de usuario requerido.' });
  }

  try {
    // Cajas del día actual que NO han sido arqueadas
    const [registros] = await pool.execute(
      `SELECT 
         ac.id,
         ac.fecha_apertura,
         ac.hora_apertura,
         ac.monto_inicial,
         ac.total_efectivo,
         ac.total_tarjeta,
         ac.observaciones,
         u.username,
         c.nombre AS nombre_caja
       FROM aperturas_cierres ac
       INNER JOIN users u ON u.id = ac.id_usuario_apertura
       INNER JOIN cajas c ON c.numero_caja = ac.numero_caja
       WHERE ac.fecha_apertura = CURDATE()
         AND ac.fue_arqueada = FALSE`
    );

    if (!registros.length) {
      return res.json({
        success: true,
        mensaje: 'No hay cajas pendientes de arqueo hoy.',
        arqueadas: 0,
        detalles: []
      });
    }

    const ahora = new Date();
    const marca = `Arqueado por ${nombre} el ${ahora.toLocaleDateString()} a las ${ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const ids = registros.map(r => r.id);
    const placeholders = ids.map(() => '?').join(',');

    // Actualizar campo observaciones + fue_arqueada = true
    await pool.execute(
      `UPDATE aperturas_cierres 
       SET observaciones = ?, fue_arqueada = TRUE 
       WHERE id IN (${placeholders})`,
      [marca, ...ids]
    );

    const detallesActualizados = registros.map(r => ({ ...r, observaciones: marca }));

    res.json({
      success: true,
      mensaje: `Arqueadas ${ids.length} caja(s) del día.`,
      arqueadas: ids.length,
      detalles: detallesActualizados
    });
  } catch (err) {
    console.error('Error al realizar arqueo:', err);
    res.status(500).json({ success: false, error: 'Error interno al realizar el arqueo.' });
  }
};




