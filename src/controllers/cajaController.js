const pool = require('../../db_config/db.js');
require('dotenv').config(); 

exports.abrirCaja = async (req, res) => {
  const { monto_inicial, observaciones, id_usuario_apertura } = req.body;
  const ID_CAJA = parseInt(process.env.ID_CAJA); // ID fijo de la caja física

  // Validaciones
  if (!monto_inicial || isNaN(monto_inicial) || parseFloat(monto_inicial) <= 0) {
    return res.status(400).json({ success: false, error: 'Monto inicial inválido. Debe ser un número mayor a 0.' });
  }

  if (!id_usuario_apertura || isNaN(id_usuario_apertura)) {
    return res.status(400).json({ success: false, error: 'ID de usuario inválido' });
  }

  const fecha = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const hora_inicio = new Date().toTimeString().slice(0, 8); // HH:MM:SS

  try {
    // Verificar si ya existe una caja abierta para esta caja física
    const [cajaAbierta] = await pool.execute(
      'SELECT id FROM caja WHERE id_caja = ? AND estado = "abierta"',
      [ID_CAJA]
    );

    if (cajaAbierta.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Ya existe una caja abierta para esta caja física.' 
      });
    }

    // Insertar nueva apertura
    const [result] = await pool.execute(
      `INSERT INTO caja 
        (id_caja, fecha, hora_inicio, monto_inicial, estado, observaciones, id_usuario_apertura) 
       VALUES (?, ?, ?, ?, 'abierta', ?, ?)`,
      [
        ID_CAJA,
        fecha,
        hora_inicio,
        parseFloat(monto_inicial),
        observaciones || null,
        id_usuario_apertura
      ]
    );

    res.json({
      success: true,
      id: result.insertId,       // ID autoincremental de la apertura
      id_caja: ID_CAJA,  // ID fijo de la caja física
      fecha,
      hora_inicio,
      monto_inicial: parseFloat(monto_inicial),
      estado: 'abierta',
      observaciones: observaciones || null
    });

  } catch (err) {
    console.error('Error al abrir caja:', err);
    res.status(500).json({ success: false, error: 'No se pudo abrir la caja.' });
  }
};


exports.registrarMovimiento = async (req, res) => {
  try {
    const { codigo, fecha, hora, tipo, valor, metodoPago, id_caja, id_usuario } = req.body;

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

    const [result] = await pool.execute(
      `INSERT INTO movimientos (codigo, fecha, hora, tipo, valor, metodoPago, id_caja, id_usuario)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [codigo, fecha, hora, tipo, valor, metodoPago, id_caja || null, id_usuario]
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
