CREATE DATABASE IF NOT EXISTS modulo_banos;
USE modulo_banos;

-- Tabla de usuarios
CREATE TABLE users (
  id INT(11) NOT NULL AUTO_INCREMENT,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'cajero') NOT NULL DEFAULT 'cajero',
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Usuario por defecto
INSERT INTO users (id, username, email, password, role) VALUES
(1, 'admin', 'admin@wit.la', '$2b$10$i5jGaiV0Eo9Rzn7Hd6blp.9HBBGReEeSg0gPADuof9eoxWE9kqcwK', 'admin'),
(2, 'cajero', 'cajero@wit.la', '$2b$10$i5jGaiV0Eo9Rzn7Hd6blp.9HBBGReEeSg0gPADuof9eoxWE9kqcwK', 'cajero');

-- Tabla de caja
CREATE TABLE caja (
  sesion INT AUTO_INCREMENT PRIMARY KEY,
  numero_caja INT NOT NULL,
  fecha_apertura DATE NOT NULL,
  hora_apertura TIME NOT NULL,
  monto_inicial DECIMAL(10,2) NOT NULL,
  estado ENUM('abierta', 'cerrada') NOT NULL DEFAULT 'cerrada',
  hora_cierre TIME,
  fecha_cierre DATE,
  venta_efectivo DECIMAL(10,2) DEFAULT 0,
  venta_tarjeta DECIMAL(10,2) DEFAULT 0,
  observaciones TEXT,
  id_usuario_apertura INT NOT NULL,
  id_usuario_cierre INT,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  estado_abierta INT GENERATED ALWAYS AS (
    CASE WHEN estado = 'abierta' THEN numero_caja ELSE NULL END
  ) VIRTUAL,

  FOREIGN KEY (id_usuario_apertura) REFERENCES users(id),
  FOREIGN KEY (id_usuario_cierre) REFERENCES users(id),

  UNIQUE INDEX idx_unica_caja_abierta (estado_abierta)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Tabla de movimientos
CREATE TABLE movimientos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sesion INT NOT NULL,
  codigo VARCHAR(20) NOT NULL,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  tipo ENUM('BAÑO', 'DUCHA') NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  metodoPago ENUM('EFECTIVO', 'TARJETA') NOT NULL,
  id_usuario INT NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sesion) REFERENCES caja(sesion),
  FOREIGN KEY (id_usuario) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Tabla de cierres diarios
CREATE TABLE cierres_diarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sesion INT NOT NULL,
  fecha DATE NOT NULL,
  hora_cierre TIME NOT NULL,
  venta_efectivo DECIMAL(10,2) NOT NULL,
  venta_tarjeta DECIMAL(10,2) NOT NULL,
  id_usuario INT NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sesion) REFERENCES caja(sesion),
  FOREIGN KEY (id_usuario) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Tabla de arqueos
CREATE TABLE arqueos_caja (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fecha DATE NOT NULL UNIQUE,
  total_efectivo DECIMAL(10,2) NOT NULL,
  total_tarjeta DECIMAL(10,2) NOT NULL,
  total_general DECIMAL(10,2) AS (total_efectivo + total_tarjeta) STORED,
  creado_por INT NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (creado_por) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Triggers y procedimientos
DELIMITER //

-- Trigger: evitar movimientos en cajas cerradas
CREATE TRIGGER before_movimiento_insert
BEFORE INSERT ON movimientos
FOR EACH ROW
BEGIN
    DECLARE caja_estado VARCHAR(10);
    SELECT estado INTO caja_estado 
    FROM caja 
    WHERE sesion = NEW.sesion;

    IF caja_estado != 'abierta' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No se pueden registrar movimientos en cajas cerradas';
    END IF;
END//

-- Trigger: actualizar totales y hora/fecha al cerrar caja
CREATE TRIGGER before_caja_update
BEFORE UPDATE ON caja
FOR EACH ROW
BEGIN
    DECLARE total_efectivo DECIMAL(10,2) DEFAULT 0;
    DECLARE total_tarjeta DECIMAL(10,2) DEFAULT 0;

    IF NEW.estado = 'cerrada' AND OLD.estado = 'abierta' THEN
        SELECT 
            SUM(CASE WHEN metodoPago = 'EFECTIVO' THEN valor ELSE 0 END),
            SUM(CASE WHEN metodoPago = 'TARJETA' THEN valor ELSE 0 END)
        INTO total_efectivo, total_tarjeta
        FROM movimientos
        WHERE sesion = NEW.sesion;

        SET NEW.venta_efectivo = IFNULL(total_efectivo, 0);
        SET NEW.venta_tarjeta = IFNULL(total_tarjeta, 0);
        SET NEW.fecha_cierre = CURRENT_DATE();
        SET NEW.hora_cierre = CURRENT_TIME();
    END IF;
END//

-- Procedimiento: abrir caja
CREATE PROCEDURE abrir_caja(
    IN p_numero_caja INT,
    IN p_monto_inicial DECIMAL(10,2),
    IN p_id_usuario INT,
    IN p_observaciones TEXT
)
BEGIN
    DECLARE caja_abierta INT;

    SELECT COUNT(*) INTO caja_abierta 
    FROM caja 
    WHERE numero_caja = p_numero_caja AND estado = 'abierta';

    IF caja_abierta > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Ya existe una caja abierta con este número';
    ELSE
        INSERT INTO caja (
            numero_caja, 
            fecha_apertura, 
            hora_apertura, 
            monto_inicial, 
            estado, 
            id_usuario_apertura,
            observaciones
        ) VALUES (
            p_numero_caja,
            CURRENT_DATE(),
            CURRENT_TIME(),
            p_monto_inicial,
            'abierta',
            p_id_usuario,
            p_observaciones
        );
    END IF;
END//

-- Procedimiento: cerrar caja
CREATE PROCEDURE cerrar_caja(
    IN p_sesion INT,
    IN p_id_usuario INT,
    IN p_observaciones TEXT
)
BEGIN
    UPDATE caja SET
        estado = 'cerrada',
        id_usuario_cierre = p_id_usuario,
        observaciones = CONCAT(IFNULL(observaciones, ''), ' | ', p_observaciones)
    WHERE sesion = p_sesion AND estado = 'abierta';

    INSERT INTO cierres_diarios (
        sesion, 
        fecha, 
        hora_cierre, 
        venta_efectivo, 
        venta_tarjeta, 
        id_usuario
    )
    SELECT 
        sesion, 
        fecha_cierre, 
        hora_cierre, 
        venta_efectivo, 
        venta_tarjeta, 
        p_id_usuario
    FROM caja 
    WHERE sesion = p_sesion;
END//

DELIMITER ;
