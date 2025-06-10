import express from 'express';
const router = express.Router();

router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Error al cerrar sesión' });
    }
    res.redirect('http://localhost:3000'); 
  });
});

export default router; 