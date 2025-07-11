CREATE DATABASE IF NOT EXISTS modulo_banos;
USE modulo_banos;

-- Tabla de usuarios
CREATE TABLE users (
  id INT(11) NOT NULL AUTO_INCREMENT,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'cajero') NOT NULL DEFAULT 'cajero',
  PRIMARY KEY (id),
  UNIQUE KEY email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Usuario por defecto
INSERT INTO users (id, username, email, password, role) VALUES
(1, 'admin', 'admin@wit.la', '$2b$10$i5jGaiV0Eo9Rzn7Hd6blp.9HBBGReEeSg0gPADuof9eoxWE9kqcwK', 'admin'),
(2, 'cajero', 'cajero@wit.la', '$2b$10$i5jGaiV0Eo9Rzn7Hd6blp.9HBBGReEeSg0gPADuof9eoxWE9kqcwK', 'cajero');

INSERT INTO caja (numero_caja) VALUES (77);

-- Tabla de caja
CREATE TABLE caja (
  numero_caja INT PRIMARY KEY, 
  fecha_apertura DATE,
  hora_apertura TIME,
  monto_inicial DECIMAL(10, 2),
  estado ENUM('abierta', 'cerrada') NOT NULL DEFAULT 'cerrada',
  hora_cierre TIME DEFAULT NULL,
  fecha_cierre DATE DEFAULT NULL,
  venta_efectivo DECIMAL(10, 2) DEFAULT 0,
  venta_tarjeta DECIMAL(10, 2) DEFAULT 0,
  observaciones TEXT,
  id_usuario_apertura INT,
  id_usuario_cierre INT DEFAULT NULL,
  FOREIGN KEY (id_usuario_apertura) REFERENCES users(id),
  FOREIGN KEY (id_usuario_cierre) REFERENCES users(id)
);

-- Tabla de movimientos (baños y duchas)
CREATE TABLE movimientos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero_caja INT,
  codigo VARCHAR(20) NOT NULL,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  tipo ENUM('BAÑO', 'DUCHA') NOT NULL,
  valor INT NOT NULL,
  metodoPago ENUM('EFECTIVO', 'TARJETA') NOT NULL,  
  id_usuario INT NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (numero_caja) REFERENCES caja(numero_caja),
  FOREIGN KEY (id_usuario) REFERENCES users(id)
);

-- Tabla de cierres diarios
CREATE TABLE cierres_diarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero_caja INT NOT NULL,
  fecha DATE NOT NULL,
  hora_cierre TIME NOT NULL,
  venta_efectivo DECIMAL(10,2) NOT NULL,
  venta_tarjeta DECIMAL(10,2) NOT NULL,
  id_usuario INT NOT NULL,
  FOREIGN KEY (numero_caja) REFERENCES caja(numero_caja),
  FOREIGN KEY (id_usuario) REFERENCES users(id)
);

-- Tabla de arqueos
CREATE TABLE arqueos_caja (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fecha DATE NOT NULL UNIQUE,
  total_efectivo DECIMAL(10,2) NOT NULL,
  total_tarjeta DECIMAL(10,2) NOT NULL,
  total_general DECIMAL(10,2) AS (total_efectivo + total_tarjeta) STORED,
  creado_por INT NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creado_por) REFERENCES users(id)
);