const express = require('express');
const bcrypt = require('bcrypt');
const path = require('path');
const db = require('../db_config/db.js');

const router = express.Router();

// Procesar login
router.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Usuario no encontrado' });
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (passwordMatch) {
      req.session.user = user.username;
      return res.json({ success: true, message: 'Login exitoso' });
    } else {
      return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
    }
  } catch (error) {
    console.error('Error en el login:', error);
    res.status(500).json({ success: false, message: 'Error en el servidor' });
  }
});

// Mostrar formulario de registro
router.get('/registro', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'views', 'registro.html'));
});

// Procesar registro
router.post('/registro', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [existing] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.send(`<script>alert("Usuario ya existe"); window.location.href="/registro";</script>`);
    }

    const hashed = await bcrypt.hash(password, 10);
    await db.execute('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashed]);

    res.send(`<script>alert("Usuario creado exitosamente"); window.location.href="/";</script>`);
  } catch (err) {
    console.error('Error al registrar:', err);
    res.status(500).send('Error en el servidor');
  }
});

// Cerrar sesión
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Error al cerrar sesión'});
    }
    res.clearCookie('connect.sid');
    res.redirect('/'); 
  });
});

module.exports = router;