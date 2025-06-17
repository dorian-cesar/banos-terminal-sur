const express = require('express');
const router = express.Router();
const cajaController = require('../src/controllers/cajaController');

// Ruta para abrir caja
router.post('/api/caja/abrir', cajaController.abrirCaja);

// Ruta para cerrar caja
router.post('/api/caja/cerrar', cajaController.cerrarCaja);

// Ruta para listar cajas
router.get('/api/caja/listar', cajaController.listarCajas);

module.exports = router;
