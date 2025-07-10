const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../../db_config/db.js'); 

const SECRET_KEY = 'tu_clave_secreta_super_segura'; // cambia esto en producción

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = rows[0];

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    // Crear payload y token
    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(tokenPayload, SECRET_KEY, { expiresIn: '4h' });

    // Retornar token y datos de usuario (para sessionStorage)
    const usuario = {
      username: user.username,
      email: user.email,
      role: user.role
    };

    return res.json({ token, usuario });

  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { login };
