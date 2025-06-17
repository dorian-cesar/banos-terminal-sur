CREATE DATABASE IF NOT EXISTS modulo_banos;
USE modulo_banos;

-- Tabla de usuarios
CREATE TABLE users (
  id INT(11) NOT NULL AUTO_INCREMENT,
  username VARCHAR(100) NOT NULL,
  password VARCHAR(255) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Usuario por defecto
INSERT INTO users (id, username, password) VALUES
(1, 'admin', '$2b$10$i5jGaiV0Eo9Rzn7Hd6blp.9HBBGReEeSg0gPADuof9eoxWE9kqcwK');

-- Tabla de caja
CREATE TABLE caja (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  monto_inicial DECIMAL(10, 2) NOT NULL,
  estado ENUM('abierta', 'cerrada') NOT NULL DEFAULT 'abierta',
  hora_cierre TIME DEFAULT NULL,
  fecha_cierre DATE NOT NULL,
  total_efectivo DECIMAL(10, 2) DEFAULT 0,
  total_tarjeta DECIMAL(10, 2) DEFAULT 0,
  observaciones TEXT
);

-- Tabla de movimientos (baños y duchas)
CREATE TABLE movimientos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(20) NOT NULL,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  tipo ENUM('BAÑO', 'DUCHA') NOT NULL,
  valor INT NOT NULL,
  metodoPago ENUM('EFECTIVO', 'TARJETA') NOT NULL,
  id_caja INT,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de cierres diarios
CREATE TABLE cierres_diarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_caja INT NOT NULL,
  fecha DATE NOT NULL,
  hora_cierre TIME NOT NULL,
  total_efectivo DECIMAL(10,2) NOT NULL,
  total_tarjeta DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (id_caja) REFERENCES caja(id)
);
