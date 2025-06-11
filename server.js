const express = require('express');
const path = require('path');
const session = require('express-session');
const authRoutes = require('./routes/auth.js');

const app = express();
const PORT = 8080;


// Configuración de sesión
app.use(
  session({
    secret: 'clave-segura-wit',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Cambiar a true en producción con HTTPS
      maxAge: 24 * 60 * 60 * 1000 // 1 día
    }
  })
);

// Middleware para parsear el cuerpo de las solicitudes
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configurar archivos estáticos desde views y public
app.use(express.static(path.join(__dirname, 'views')));
app.use(express.static(path.join(__dirname, 'public')));

// Usar las rutas de autenticación
app.use('/', authRoutes);

// Redirigir a login si no está autenticado
app.get('/', (req, res) => {
  if (req.session.user) {
    return res.sendFile(path.join(__dirname, 'views', 'home.html'));
  }
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
