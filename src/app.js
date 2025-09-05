require('express-async-errors'); 
const cors = require('cors');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { imprimirTicket } = require('./services/printService');
const { reimprimirTicket } = require('./services/printService');

const paymentController = require('./controllers/paymentController');
const terminalController = require('./controllers/terminalController');
const transbankService = require('./services/transbankService');

const cajaRoutes = require('../routes/caja_router');

const app = express();

// Middleware CORS según entorno
const corsOptions = process.env.NODE_ENV === 'development'
  ? { origin: '*', credentials: false }
  : {
      origin: process.env.ALLOWED_ORIGINS.split(','),
      credentials: true
    };

app.use(cors(corsOptions));

app.use(bodyParser.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(bodyParser.urlencoded({ extended: true }));

// Ruta de impresion
app.post('/api/print', async (req, res) => {
  try {
    const resultado = await imprimirTicket(req.body);
    res.json({ success: true, message: resultado });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/reprint', async (req, res) => {
  try {
    const resultado = await reimprimirTicket(req.body);
    res.json({ success: true, message: resultado });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rutas de pagos
app.post('/api/payment', paymentController.processPayment);
app.post('/api/refund', paymentController.processRefund);

// Rutas del terminal POS
app.post('/api/terminal/cierre-diario', terminalController.closeTerminal);
app.post('/api/terminal/loadKeys', terminalController.loadKey);
app.get('/api/terminal/last-transaction', terminalController.getLastTransaction);
app.get('/api/terminal/ports', terminalController.listPorts);
app.post('/api/terminal/connect', terminalController.conectarPuerto);
app.get('/api/terminal/status', terminalController.statusPos); 
app.post('/api/terminal/start-monitor', terminalController.startHealthMonitor);
app.post('/api/terminal/release-port', async (req, res) => {
  try {
    await transbankService.closeConnection();
    res.status(200).json({ status: 'success', message: 'Puerto liberado manualmente' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message, code: 'PORT_RELEASE_FAILED' });
  }
});
app.get('/tester', (req, res) => {
  res.sendFile(path.join(__dirname, 'tester.html'));
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Ruta simple de monitoreo del servidor
app.get('/monitor', (req, res) => {
  res.json({ success: true, server: true });
});

app.use(cajaRoutes);

// Manejo de errores generales
app.use((err, req, res, next) => {
  console.error('Error no manejado:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    body: req.body
  });

  res.status(500).json({
    error: err.message || 'Algo salió mal',
    code: err.responseCode || 'INTERNAL_ERROR'
  });
});

// Captura errores fatales para evitar que caiga el servidor
process.on('uncaughtException', (err) => {
  console.error('❌ uncaughtException:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ unhandledRejection:', reason);
});

app.post('/api/apagar', (req, res) => {
  const { exec } = require('child_process');
  exec('shutdown /s /t 0', (err) => {
    if (err) return res.status(500).json({ success: false, error: 'No se pudo apagar' });
    res.json({ success: true });
  });
});

module.exports = app;