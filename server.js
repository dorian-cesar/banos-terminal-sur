import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import session from 'express-session';
import logoutRoutes from "./routes/logout.js"; 


const app = express();
const PORT = 8080;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
  session({
    secret: 'clave-segura-wit', 
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true } // Si usas HTTPS, cambia a `true`
  })
);

app.use(express.static(path.join(__dirname, 'public')));

// Usar las rutas de logout
app.use('/', logoutRoutes);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});