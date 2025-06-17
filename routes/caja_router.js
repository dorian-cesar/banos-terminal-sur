const express = require('express');
const router = express.Router();
const movimientosController = require('../src/controllers/movimientosController');

// Ruta para abrir caja
router.post('/api/caja/abrir', movimientosController.abrirCaja);

// Ruta para cerrar caja
router.post('/api/caja/cerrar', movimientosController.cerrarCaja);

module.exports = router;
