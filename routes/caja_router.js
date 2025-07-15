const express = require('express');
const router = express.Router();
const cajaController = require('../src/controllers/cajaController');
const servicioController = require('../src/controllers/servicioController');

// Rutas para abrir caja
router.post('/api/caja/abrir', cajaController.abrirCaja);

router.get('/api/caja/abierta', cajaController.cargarCajaAbiertaPorUsuario);


// Rutas para los movimientos
router.post('/api/caja/movimiento', cajaController.registrarMovimiento);

router.get('/api/caja/movimiento', cajaController.listarMovimientosPorUsuario);


// Ruta para cerrar caja
router.post('/api/caja/cerrar', cajaController.cerrarCaja);

router.get('/api/caja/cajas-dia', cajaController.listarCajasDelDia);

router.post('/api/caja/arqueo', cajaController.realizarArqueoDelDia);


router.get('/api/servicios', servicioController.obtenerServiciosActivos);

module.exports = router;
