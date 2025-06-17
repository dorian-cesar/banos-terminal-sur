require('dotenv').config();

const fs        = require('fs');
const path      = require('path');
const https     = require('https');
const express   = require('express');
const session   = require('express-session');

// -------- instancia Express principal creada en src/app.js --------
const app = require('./src/app');          // mantiene todas las rutas /api/ para transbank

// -------- middleware y rutas del módulo “baños-terminal-sur” --------
app.use(session({
  secret: 'clave-segura-wit',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,                         // pon true cuando sirvas HTTPS público
    maxAge: 24 * 60 * 60 * 1000            // 1 día
  }
}));

// estáticos para la interfaz de caja
// app.use(express.static(path.join(__dirname, 'views')));
app.use(express.static(path.join(__dirname, 'public')));

// rutas de autenticación (login / registro / logout)
const authRoutes = require('./routes/auth');
app.use('/', authRoutes);


// Redirección según sesión
// Ruta raíz del sistema:
// Si el usuario tiene una sesión activa (req.session.user),
// se redirige automáticamente al panel principal (home.html).
// En caso contrario, se carga la vista de inicio de sesión (login.html).
app.get('/', (req, res) => {
  if (req.session.user) {
    return res.sendFile(path.join(__dirname, 'views', 'home.html'));
  }
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});


// Ruta pública para acceder directamente a la vista de login:
// No verifica sesión permite al usuario acceder manualmente al login
// o si fue redirigido desde otra ruta protegida.
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/caja.html', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'views', 'caja.html'));
});


// ----------------- lógica de conexión y monitor POS -----------------
const transbankService  = require('./src/services/transbankService');
const terminalController = require('./src/controllers/terminalController');

const PORT        = process.env.PORT || 3000;
const ENV         = process.env.NODE_ENV || 'development';
const MAX_RETRIES = parseInt(process.env.TBK_CONNECTION_RETRIES || '10', 10);
const RETRY_DELAY = parseInt(process.env.TBK_RETRY_DELAY_MS || '5000', 10);

async function connectToPOS () {
  let attempt = 0;
  let connected = false;

  while (attempt < MAX_RETRIES && !connected) {
    attempt++;
    try {
      console.log(`Intento ${attempt} de conexión al POS...`);
      await transbankService.closeConnection().catch(() => {});

      const preferred = process.env.TBK_PORT_PATH;

      // 1) puerto preferido
      try {
        await transbankService.connectToPort(preferred);
        console.log(`POS conectado a puerto preferido: ${preferred}`);
        connected = true;
      } catch (err) {
        console.warn(`Falló puerto preferido (${preferred}): ${err.message}`);

        // 2) puertos ACM alternativos
        const all = await transbankService.listAvailablePorts();
        const acm = all.filter(p => p.path.includes('ACM'));

        for (const port of acm) {
          if (port.path === preferred) continue;
          try {
            await transbankService.connectToPort(port.path);
            console.log(`POS conectado a puerto alternativo: ${port.path}`);
            connected = true;
            break;
          } catch (e) {
            console.warn(`Falló conexión a ${port.path}: ${e.message}`);
          }
        }
      }

      if (connected) {
        await transbankService.loadKey();
        console.log('🔐  Llaves cargadas');
        await terminalController.startPOSMonitor();
        return true;
      }

      if (attempt < MAX_RETRIES) {
        console.log(`Reintentando en ${RETRY_DELAY / 1000}s...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY));
      }
    } catch (err) {
      console.error(`Error en intento ${attempt}: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAY));
      }
    }
  }

  if (!connected) {
    console.error(`❌  No se logró conectar al POS tras ${MAX_RETRIES} intentos`);
  }
}

// ---------------------- servidor HTTPS + shutdown -------------------
async function startServer () {
  try {
    console.log(`Iniciando servidor en modo ${ENV}`);

    const sslOptions = {
      key : fs.readFileSync(path.resolve(__dirname, 'ssl/key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, 'ssl/cert.pem'))
    };

    const server = https.createServer(sslOptions, app).listen(PORT, async () => {
      console.log(`✅  HTTPS activo en https://localhost:${PORT}`);
      await connectToPOS();
    });

    // apagado ordenado
    const shutdown = async signal => {
      console.log(`→ señal ${signal}. Cerrando…`);
      try {
        await Promise.race([
          new Promise(resolve => server.close(resolve)),
          new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout al cerrar servidor')), 5000))
        ]);
        console.log('Servidor HTTPS cerrado');
        await transbankService.closeConnection();
        console.log('Conexión POS cerrada');
      } catch (e) {
        console.error('Error en shutdown:', e.message);
      } finally {
        process.exit(0);
      }
    };

    process.on('SIGINT',  () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    process.on('uncaughtException', err => {
      console.error('❌ uncaughtException:', err);
      shutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason, p) => {
      console.error('❌ unhandledRejection:', reason);
      shutdown('unhandledRejection');
    });

  } catch (fatal) {
    console.error('Error crítico al iniciar:', fatal.message);
    process.exit(1);
  }
}

startServer();