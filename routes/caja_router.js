const express = require('express');
const router = express.Router();
const cajaController = require('../src/controllers/cajaController');
const servicioController = require('../src/controllers/servicioController');

// Ruta para abrir caja
router.post('/api/caja/abrir', cajaController.abrirCaja);

router.get('/api/caja/abierta', cajaController.cargarCajaAbiertaPorUsuario);

router.post('/api/caja/movimiento', cajaController.registrarMovimiento);

// Ruta para cerrar caja
router.post('/api/caja/cerrar', cajaController.cerrarCaja);

// Ruta para listar cajas
router.get('/api/caja/listar', cajaController.listarCajas);

router.post('/api/caja/arqueo-diario', cajaController.registrarArqueoDiario);

router.get('/api/servicios', servicioController.obtenerServiciosActivos);

module.exports = router;
