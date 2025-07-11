const express = require('express');
const router = express.Router();
const cajaController = require('../src/controllers/cajaController');

// Ruta para abrir caja
router.post('/api/caja/abrir', cajaController.abrirCaja);

router.get('/api/caja/estado', cajaController.obtenerEstadoCaja);

router.post('/api/caja/movimiento', cajaController.registrarMovimiento);

// Ruta para cerrar caja
router.post('/api/caja/cerrar', cajaController.cerrarCaja);

// Ruta para listar cajas
router.get('/api/caja/listar', cajaController.listarCajas);

router.post('/api/caja/arqueo-diario', cajaController.registrarArqueoDiario);

module.exports = router;
