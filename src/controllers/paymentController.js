const transbankService = require('../services/transbankService');
const responseHandler = require('../utils/responseHandler');
const axios = require('axios');

exports.processPayment = async (req, res) => {
  try {
    const { amount, ticketNumber } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) {
      throw new Error('Monto inválido');
    }

    if (!ticketNumber || typeof ticketNumber !== 'string') {
      throw new Error('Número de ticket/boleta inválido');
    }

    console.log(`Iniciando transacción - Monto: ${amount}, Ticket: ${ticketNumber}`);

    const result = await transbankService.enviarVenta(amount, ticketNumber);

    const responseCode = result?.responseCode;

       responseHandler.success(res, 'Resultado operación', {
      ...result
    });

  } catch (error) {
    // Manejo de errores en la conexión al POS
    const messageLower = (error.message || '').toLowerCase();
    const isUserCancelled = messageLower.includes('cancelada') || messageLower.includes('cancelado');
    const isPosDisconnected = messageLower.includes('no se pudo conectar') || messageLower.includes('pos no conectado') || messageLower.includes('pos desconectado');

    const statusCode = isUserCancelled || isPosDisconnected ? 400 : 500;
    let errorCode = 'UNKNOWN';
    let userMessage = 'Ocurrió un problema al procesar el pago';

    if (isUserCancelled) {
      errorCode = 'USER_CANCELLED';
      userMessage = 'Transacción cancelada por el usuario';
    } else if (isPosDisconnected) {
      errorCode = 'POS_DISCONNECTED';
      userMessage = 'El POS no está conectado';
    } else if (error.responseCode) {
      errorCode = error.responseCode;
    }

    console[isUserCancelled || isPosDisconnected ? 'warn' : 'error'](
      `Transacción ${isUserCancelled ? 'cancelada' : isPosDisconnected ? 'fallida por desconexión' : 'fallida'}: ${error.message}`,
      isUserCancelled || isPosDisconnected ? undefined : { stack: error.stack }
    );

    const meta = process.env.NODE_ENV === 'development' ? {
      detail: error.message,
      stack: error.stack
    } : {};

    responseHandler.error(res, userMessage, statusCode, errorCode, meta);
  }
};

exports.processRefund = async (req, res) => {
  try {
    const { amount, originalOperationNumber } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) {
      throw new Error('Monto inválido');
    }

    if (!originalOperationNumber) {
      throw new Error('Número de operación original requerido');
    }

    console.log(`Iniciando reversa - Monto: ${amount}, Operación original: ${originalOperationNumber}`);

    const result = await transbankService.enviarVentaReversa(amount, originalOperationNumber);

    console.log(`Reversa exitosa - Operación: ${result.operationNumber}`);
    responseHandler.success(res, 'Reversa exitosa', result);
  } catch (error) {
    console.error(`Error en reversa: ${error.message}`, { stack: error.stack });
    responseHandler.error(res, error.message, 500, error.responseCode || 'UNKNOWN');
  }
};