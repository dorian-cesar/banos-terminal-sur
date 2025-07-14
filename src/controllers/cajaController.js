const pool = require('../../db_config/db.js');
require('dotenv').config();

exports.abrirCaja = async (req, res) => {
  const { monto_inicial, observaciones, id_usuario_apertura } = req.body;
  const numero_caja = parseInt(process.env.numero_caja);

  // Validaciones
  if (!monto_inicial || isNaN(monto_inicial) || parseFloat(monto_inicial) <= 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'Monto inicial inválido. Debe ser un número mayor a 0.' 
    });
  }

  if (!id_usuario_apertura || isNaN(id_usuario_apertura)) {
    return res.status(400).json({ 
      success: false, 
      error: 'ID de usuario inválido' 
    });
  }

  try {
    // Verificar si ya existe una caja abierta
    const [cajaAbierta] = await pool.execute(
      `SELECT COUNT(*) as count FROM caja WHERE numero_caja = ? AND estado = 'abierta'`,
      [numero_caja]
    );

    if (cajaAbierta[0].count > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Ya existe una caja abierta con este número' 
      });
    }

    // Insertar nueva sesión de caja
    const [result] = await pool.execute(
      `INSERT INTO caja (
        numero_caja, 
        fecha_apertura, 
        hora_apertura, 
        monto_inicial, 
        estado, 
        id_usuario_apertura,
        observaciones
      ) VALUES (?, CURRENT_DATE(), CURRENT_TIME(), ?, 'abierta', ?, ?)`,
      [numero_caja, parseFloat(monto_inicial), id_usuario_apertura, observaciones || null]
    );

    // Obtener datos de la caja recién abierta
    const [nuevaCaja] = await pool.execute(
      `SELECT * FROM caja WHERE sesion = ?`,
      [result.insertId]
    );

    res.json({
      success: true,
      data: {
        numero_caja: nuevaCaja[0].numero_caja,
        sesion: nuevaCaja[0].sesion,
        fecha_apertura: nuevaCaja[0].fecha_apertura,
        hora_apertura: nuevaCaja[0].hora_apertura,
        monto_inicial: nuevaCaja[0].monto_inicial,
        estado: nuevaCaja[0].estado,
        observaciones: nuevaCaja[0].observaciones
      }
    });

  } catch (err) {
    console.error('Error al abrir caja:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno al abrir la caja.',
      detalle: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.obtenerEstadoCaja = async (req, res) => {
  const numero_caja = parseInt(process.env.numero_caja);
  
  try {
    const [caja] = await pool.execute(
      `SELECT 
        sesion,
        numero_caja,
        estado,
        fecha_apertura,
        hora_apertura,
        monto_inicial,
        venta_efectivo,
        venta_tarjeta,
        observaciones
       FROM caja 
       WHERE numero_caja = ?
       ORDER BY sesion DESC
       LIMIT 1`,
      [numero_caja]
    );

    if (caja.length === 0) {
      return res.json({ 
        success: true, 
        estado: 'cerrada',
        numero_caja,
        mensaje: 'No hay registro de esta caja'
      });
    }

    // Obtener totales de movimientos si la caja está abierta
    let totales = { venta_efectivo: 0, venta_tarjeta: 0 };
    if (caja[0].estado === 'abierta') {
      const [movimientos] = await pool.execute(
        `SELECT 
          SUM(CASE WHEN metodoPago = 'EFECTIVO' THEN valor ELSE 0 END) AS venta_efectivo,
          SUM(CASE WHEN metodoPago = 'TARJETA' THEN valor ELSE 0 END) AS venta_tarjeta
         FROM movimientos 
         WHERE sesion = ?`,
        [caja[0].sesion]
      );
      totales = movimientos[0];
    }

    res.json({
      success: true,
      data: {
        numero_caja: caja[0].numero_caja,
        sesion: caja[0].sesion,
        estado: caja[0].estado,
        fecha_apertura: caja[0].fecha_apertura,
        hora_apertura: caja[0].hora_apertura,
        monto_inicial: caja[0].monto_inicial,
        venta_efectivo: caja[0].venta_efectivo || totales.venta_efectivo,
        venta_tarjeta: caja[0].venta_tarjeta || totales.venta_tarjeta,
        observaciones: caja[0].observaciones
      }
    });
  } catch (error) {
    console.error('Error al obtener estado de caja:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al consultar estado de caja',
      detalle: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.registrarMovimiento = async (req, res) => {
  try {
    const { codigo, tipo, valor, metodoPago, id_usuario } = req.body;
    
    // Validaciones básicas
    if (!codigo || !tipo || !valor || !metodoPago || !id_usuario) {
      return res.status(400).json({ 
        success: false, 
        message: 'Faltan datos requeridos' 
      });
    }

    if (isNaN(valor) || valor <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valor debe ser un número mayor a 0' 
      });
    }

    // Obtener la caja abierta
    const [cajaAbierta] = await pool.execute(
      'SELECT sesion FROM caja WHERE estado = "abierta" AND numero_caja = ? LIMIT 1',
      [process.env.numero_caja]
    );

    if (cajaAbierta.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No hay ninguna caja abierta para registrar movimientos' 
      });
    }

    const sesion = cajaAbierta[0].sesion;

    // Registrar movimiento
    const [result] = await pool.execute(
      `INSERT INTO movimientos (
        codigo, fecha, hora, tipo, valor, metodoPago, sesion, id_usuario
      ) VALUES (?, CURRENT_DATE(), CURRENT_TIME(), ?, ?, ?, ?, ?)`,
      [codigo, tipo, valor, metodoPago, sesion, id_usuario]
    );

    res.json({ 
      success: true, 
      message: 'Movimiento registrado', 
      data: {
        id: result.insertId,
        sesion,
        codigo,
        fecha: new Date().toISOString().slice(0, 10),
        hora: new Date().toTimeString().slice(0, 8)
      }
    });

  } catch (error) {
    console.error('Error al registrar movimiento:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.cerrarCaja = async (req, res) => {
  const { id_usuario_cierre, observaciones } = req.body;
  const numero_caja = parseInt(process.env.numero_caja);

  if (!id_usuario_cierre || isNaN(id_usuario_cierre)) {
    return res.status(400).json({ 
      success: false, 
      error: 'ID de usuario inválido' 
    });
  }

  try {
    // Obtener la sesión actual de la caja abierta
    const [cajaAbierta] = await pool.execute(
      `SELECT sesion FROM caja WHERE numero_caja = ? AND estado = 'abierta' LIMIT 1`,
      [numero_caja]
    );

    if (cajaAbierta.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No hay caja abierta para cerrar' 
      });
    }

    const sesion = cajaAbierta[0].sesion;

    // Calcular totales de movimientos
    const [movimientos] = await pool.execute(
      `SELECT 
        SUM(CASE WHEN metodoPago = 'EFECTIVO' THEN valor ELSE 0 END) AS total_efectivo,
        SUM(CASE WHEN metodoPago = 'TARJETA' THEN valor ELSE 0 END) AS total_tarjeta
       FROM movimientos 
       WHERE sesion = ?`,
      [sesion]
    );

    const venta_efectivo = parseFloat(movimientos[0].total_efectivo || 0);
    const venta_tarjeta = parseFloat(movimientos[0].total_tarjeta || 0);

    // Actualizar caja (el trigger calculará los totales)
    await pool.execute(
      `UPDATE caja SET
        estado = 'cerrada',
        hora_cierre = CURRENT_TIME(),
        fecha_cierre = CURRENT_DATE(),
        id_usuario_cierre = ?,
        observaciones = ?
       WHERE sesion = ?`,
      [id_usuario_cierre, observaciones || null, sesion]
    );

    // Registrar cierre diario
    await pool.execute(
      `INSERT INTO cierres_diarios (
        sesion, fecha, hora_cierre, venta_efectivo, venta_tarjeta, id_usuario
      ) VALUES (?, CURRENT_DATE(), CURRENT_TIME(), ?, ?, ?)`,
      [sesion, venta_efectivo, venta_tarjeta, id_usuario_cierre]
    );

    res.json({
      success: true,
      message: 'Caja cerrada correctamente',
      data: {
        numero_caja,
        sesion,
        fecha_cierre: new Date().toISOString().slice(0, 10),
        hora_cierre: new Date().toTimeString().slice(0, 8),
        venta_efectivo,
        venta_tarjeta,
        total_general: venta_efectivo + venta_tarjeta
      }
    });

  } catch (error) {
    console.error('Error al cerrar caja:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno al cerrar caja',
      detalle: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.listarCajas = async (req, res) => {
  const numero_caja = parseInt(process.env.numero_caja);
  
  try {
    // Obtener todas las sesiones de la caja
    const [cajas] = await pool.execute(
      `SELECT 
        sesion,
        numero_caja,
        fecha_apertura,
        hora_apertura,
        fecha_cierre,
        hora_cierre,
        monto_inicial,
        estado,
        observaciones
       FROM caja
       WHERE numero_caja = ?
       ORDER BY sesion DESC`,
      [numero_caja]
    );

    // Obtener totales para cada sesión
    const cajasConTotales = await Promise.all(cajas.map(async (caja) => {
      const [totales] = await pool.execute(
        `SELECT 
          SUM(CASE WHEN metodoPago = 'EFECTIVO' THEN valor ELSE 0 END) AS venta_efectivo,
          SUM(CASE WHEN metodoPago = 'TARJETA' THEN valor ELSE 0 END) AS venta_tarjeta
         FROM movimientos 
         WHERE sesion = ?`,
        [caja.sesion]
      );

      return {
        ...caja,
        venta_efectivo: parseFloat(totales[0]?.venta_efectivo || 0),
        venta_tarjeta: parseFloat(totales[0]?.venta_tarjeta || 0),
        total_general: parseFloat(totales[0]?.venta_efectivo || 0) + parseFloat(totales[0]?.venta_tarjeta || 0)
      };
    }));

    res.json({ 
      success: true, 
      data: cajasConTotales
    });

  } catch (error) {
    console.error('Error al listar cajas:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener el listado de cajas',
      detalle: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.registrarArqueoDiario = async (req, res) => {
  const { creado_por } = req.body;

  if (!creado_por || isNaN(creado_por)) {
    return res.status(400).json({ success: false, error: 'ID de usuario inválido' });
  }

  const fechaHoy = new Date().toISOString().slice(0, 10);

  try {
    // Verificar si ya existe un arqueo para hoy
    const [verificacion] = await pool.execute(
      `SELECT id FROM arqueos_caja WHERE fecha = ?`,
      [fechaHoy]
    );
    
    if (verificacion.length > 0) {
      return res.status(409).json({ 
        success: false, 
        error: 'Ya existe un arqueo para el día de hoy' 
      });
    }

    // Sumar cierres del día
    const [result] = await pool.execute(
      `SELECT 
        COALESCE(SUM(venta_efectivo), 0) AS total_efectivo,
        COALESCE(SUM(venta_tarjeta), 0) AS total_tarjeta
       FROM cierres_diarios
       WHERE fecha = ?`,
      [fechaHoy]
    );

    const total_efectivo = result[0].total_efectivo;
    const total_tarjeta = result[0].total_tarjeta;

    // Insertar en arqueos_caja
    await pool.execute(
      `INSERT INTO arqueos_caja (fecha, total_efectivo, total_tarjeta, creado_por)
       VALUES (?, ?, ?, ?)`,
      [fechaHoy, total_efectivo, total_tarjeta, creado_por]
    );

    res.json({
      success: true,
      message: 'Arqueo del día registrado correctamente',
      data: {
        fecha: fechaHoy,
        total_efectivo,
        total_tarjeta,
        total_general: total_efectivo + total_tarjeta
      }
    });
  } catch (err) {
    console.error('Error al registrar arqueo diario:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno al registrar el arqueo',
      detalle: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};