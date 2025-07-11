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

  const fecha_apertura = new Date().toISOString().slice(0, 10);
  const hora_apertura = new Date().toTimeString().slice(0, 8);

  try {
    // Verificar si ya está abierta
    const [abierta] = await pool.execute(
      `SELECT estado, sesion FROM caja WHERE numero_caja = ?`,
      [numero_caja]
    );

    if (abierta.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'La caja física no está registrada en el sistema.' 
      });
    }

    if (abierta[0].estado === 'abierta') {
      return res.status(400).json({ 
        success: false, 
        error: 'La caja ya está abierta.' 
      });
    }

    const nueva_sesion = abierta[0].sesion + 1;

    // Actualizar los datos de la caja y nueva sesión
    const [updateResult] = await pool.execute(
      `UPDATE caja
       SET sesion = ?,
           estado = 'abierta',
           fecha_apertura = ?,
           hora_apertura = ?,
           monto_inicial = ?,
           observaciones = ?,
           id_usuario_apertura = ?,
           fecha_cierre = NULL,
           hora_cierre = NULL,
           id_usuario_cierre = NULL,
           venta_efectivo = 0,
           venta_tarjeta = 0
       WHERE numero_caja = ?`,
      [
        nueva_sesion,
        fecha_apertura,
        hora_apertura,
        parseFloat(monto_inicial),
        observaciones || null,
        id_usuario_apertura,
        numero_caja
      ]
    );

    res.json({
      success: true,
      numero_caja,
      sesion: nueva_sesion,
      fecha_apertura,
      hora_apertura,
      monto_inicial: parseFloat(monto_inicial),
      estado: 'abierta',
      observaciones: observaciones || null
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
        numero_caja,
        estado,
        fecha_apertura,
        hora_apertura,
        monto_inicial,
        observaciones
       FROM caja 
       WHERE numero_caja = ?`,
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

    res.json({
      success: true,
      numero_caja: caja[0].numero_caja,
      estado: caja[0].estado,
      fecha_apertura: caja[0].fecha_apertura,
      hora_apertura: caja[0].hora_apertura,
      monto_inicial: caja[0].monto_inicial,
      observaciones: caja[0].observaciones
    });
  } catch (error) {
    console.error('Error al obtener estado de caja:', error);
    res.status(500).json({ success: false, error: 'Error al consultar estado de caja' });
  }
};


exports.registrarMovimiento = async (req, res) => {
  try {
    const { codigo, fecha, hora, tipo, valor, metodoPago, id_usuario, sesion } = req.body;
    
    // Obtener el número de caja abierta desde la tabla caja
    const [cajaAbierta] = await pool.execute(
      'SELECT numero_caja FROM caja WHERE estado = "abierta" LIMIT 1'
    );

    if (cajaAbierta.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No hay ninguna caja abierta para registrar movimientos' 
      });
    }

    const numeroCajaAbierta = cajaAbierta[0].numero_caja;

    // Validaciones básicas
    if (!codigo || !fecha || !hora || !tipo || !valor || !metodoPago || !id_usuario || !sesion) {
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

    // Registrar movimiento
    const [result] = await pool.execute(
      `INSERT INTO movimientos (
        codigo, fecha, hora, tipo, valor, metodoPago, numero_caja, id_usuario, sesion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [codigo, fecha, hora, tipo, valor, metodoPago, numeroCajaAbierta, id_usuario, sesion]
    );

    res.json({ 
      success: true, 
      message: 'Movimiento registrado', 
      data: {
        id: result.insertId,
        numero_caja: numeroCajaAbierta,
        codigo,
        fecha,
        hora
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
  const { numero_caja, id_usuario_cierre } = req.body;

  if (!numero_caja || isNaN(numero_caja)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Número de caja inválido' 
    });
  }

  if (!id_usuario_cierre || isNaN(id_usuario_cierre)) {
    return res.status(400).json({ 
      success: false, 
      error: 'ID de usuario inválido' 
    });
  }

  const fecha_cierre = new Date().toISOString().slice(0, 10);
  const hora_cierre = new Date().toTimeString().slice(0, 8);

  try {
    // 🟨 Obtener la sesión actual de la caja abierta
    const [cajaAbierta] = await pool.execute(
      `SELECT sesion FROM caja WHERE numero_caja = ? AND estado = 'abierta'`,
      [numero_caja]
    );

    if (cajaAbierta.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No hay caja abierta para este número' 
      });
    }

    const sesion = cajaAbierta[0].sesion;

    // 🟩 Obtener totales de movimientos para esta sesión
    const [movimientos] = await pool.execute(
      `SELECT 
         SUM(CASE WHEN metodoPago = 'EFECTIVO' THEN valor ELSE 0 END) AS total_efectivo,
         SUM(CASE WHEN metodoPago = 'TARJETA' THEN valor ELSE 0 END) AS total_tarjeta
       FROM movimientos 
       WHERE numero_caja = ? AND sesion = ?`,
      [numero_caja, sesion]
    );

    const venta_efectivo = parseFloat(movimientos[0].total_efectivo || 0);
    const venta_tarjeta = parseFloat(movimientos[0].total_tarjeta || 0);

    // 🟦 Insertar en cierres_diarios incluyendo sesion
    await pool.execute(
      `INSERT INTO cierres_diarios (
         numero_caja, sesion, fecha, hora_cierre, venta_efectivo, venta_tarjeta, id_usuario
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [numero_caja, sesion, fecha_cierre, hora_cierre, venta_efectivo, venta_tarjeta, id_usuario_cierre]
    );

    // 🟥 Limpiar datos de la fila en tabla caja
    const [updateResult] = await pool.execute(
      `UPDATE caja
       SET estado = 'cerrada',
           fecha_apertura = NULL,
           hora_apertura = NULL,
           hora_cierre = NULL,
           fecha_cierre = NULL,
           monto_inicial = 0,
           venta_efectivo = 0,
           venta_tarjeta = 0,
           observaciones = NULL,
           id_usuario_apertura = NULL,
           id_usuario_cierre = NULL
       WHERE numero_caja = ?`,
      [numero_caja]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'La caja no existe o ya fue limpiada' 
      });
    }

    res.json({
      success: true,
      message: 'Caja cerrada correctamente y datos limpiados',
      cierre: {
        numero_caja,
        sesion,
        id_usuario_cierre,
        fecha_cierre,
        hora_cierre,
        venta_efectivo,
        venta_tarjeta
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
  try {
    // Obtener el número de caja desde las variables de entorno
    const numeroCajaDeseada = process.env.numero_caja;
    
    // Validar que exista el número de caja en el .env
    if (!numeroCajaDeseada) {
      return res.status(400).json({ 
        success: false, 
        error: 'No se ha configurado el número de caja en el sistema' 
      });
    }

    // Obtener la caja específica
    const [cajas] = await pool.execute(`
      SELECT 
        numero_caja,
        fecha_apertura,
        hora_apertura,
        hora_cierre,
        monto_inicial,
        estado,
        observaciones,
        fecha_cierre
      FROM caja
      WHERE numero_caja = ?
      ORDER BY fecha_apertura DESC, hora_apertura DESC
      LIMIT 1
    `, [numeroCajaDeseada]);

    // Si no se encuentra la caja
    if (cajas.length === 0) {
      return res.json({ 
        success: true, 
        cajas: [],
        message: 'No se encontró la caja especificada' 
      });
    }

    const caja = cajas[0];

    // Obtener los totales de movimientos para esta caja
    const [totales] = await pool.execute(
      `SELECT 
        SUM(CASE WHEN metodoPago = 'EFECTIVO' THEN valor ELSE 0 END) AS venta_efectivo,
        SUM(CASE WHEN metodoPago = 'TARJETA' THEN valor ELSE 0 END) AS venta_tarjeta
       FROM movimientos 
       WHERE numero_caja = ?`,
      [caja.numero_caja]
    );

    // Formatear la respuesta con los totales
    const cajaConTotales = {
      numero_caja: caja.numero_caja,
      fecha_apertura: caja.fecha_apertura,
      hora_apertura: caja.hora_apertura || '-',
      hora_cierre: caja.hora_cierre || '-',
      monto_inicial: parseFloat(caja.monto_inicial),
      venta_efectivo: parseFloat(totales[0]?.venta_efectivo || 0),
      venta_tarjeta: parseFloat(totales[0]?.venta_tarjeta || 0),
      total_efectivo: parseFloat(caja.monto_inicial) + parseFloat(totales[0]?.venta_efectivo || 0),
      estado: caja.estado,
      observaciones: caja.observaciones || '-',
      fecha_cierre: caja.fecha_cierre !== '0000-00-00' ? caja.fecha_cierre : '-'
    };

    res.json({ 
      success: true, 
      cajas: [cajaConTotales] // Devuelve un array con un solo elemento para mantener consistencia
    });

  } catch (error) {
    console.error('Error al listar cajas:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener el listado de cajas' 
    });
  }
};

exports.registrarArqueoDiario = async (req, res) => {
  const { creado_por } = req.body;

  if (!creado_por || isNaN(creado_por)) {
    return res.status(400).json({ success: false, error: 'ID de usuario inválido' });
  }

  const fechaHoy = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    // Verificar si ya existe un arqueo para hoy
    const [verificacion] = await pool.execute(
      `SELECT id FROM arqueos_caja WHERE fecha = ?`,
      [fechaHoy]
    );
    if (verificacion.length > 0) {
      return res.status(409).json({ success: false, error: 'Ya existe un arqueo para el día de hoy' });
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
      arqueo: {
        fecha: fechaHoy,
        total_efectivo,
        total_tarjeta,
        total_general: total_efectivo + total_tarjeta
      }
    });
  } catch (err) {
    console.error('Error al registrar arqueo diario:', err);
    res.status(500).json({ success: false, error: 'Error interno al registrar el arqueo' });
  }
};
