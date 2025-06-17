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

CREATE TABLE caja (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  monto_inicial DECIMAL(10, 2) NOT NULL,
  estado ENUM('abierta', 'cerrada') NOT NULL DEFAULT 'abierta',
  hora_cierre TIME DEFAULT NULL,
  total_efectivo DECIMAL(10, 2) DEFAULT 0,
  total_tarjeta DECIMAL(10, 2) DEFAULT 0,
  observaciones TEXT
);

CREATE TABLE cierres_diarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_caja INT NOT NULL,
  fecha DATE NOT NULL,
  hora_cierre TIME NOT NULL,
  total_efectivo DECIMAL(10,2) NOT NULL,
  total_tarjeta DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (id_caja) REFERENCES caja(id)
);