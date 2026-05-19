DO $$
DECLARE v_id uuid;
BEGIN

  -- 005724 ANTONIA ACOSTA LOPEZ
  INSERT INTO acreditados (clave, ciclo, nombre_completo, fecha_nacimiento, tiempo_residencia, antiguedad_negocio, dependientes, antiguedad_telefono, cuenta_banco, casa_habitacion, estado_civil, negocio_domicilio, destino_credito, automovil_propio, buro_credito, tipo_garantia, tipo_negocio, genero, puntaje_total, clasificacion_modelo, capturado_por_id)
  VALUES ('005724', '01', 'ANTONIA ACOSTA LOPEZ', '1960-01-17', 36, 30, 0, 7, 1, 'Familiar', 'Casado', true, 'Capital de trabajo', true, 'Buena', 'Equipo de transporte', 'Fijo', 'Femenino', 87.6, 'A', (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1))
  RETURNING id INTO v_id;
  INSERT INTO acreditado_referencias (acreditado_id, calidad) VALUES (v_id, 'Excelente');

  -- 006006 NANCY MARTINEZ BAUTISTA
  INSERT INTO acreditados (clave, ciclo, nombre_completo, fecha_nacimiento, tiempo_residencia, antiguedad_negocio, dependientes, antiguedad_telefono, cuenta_banco, casa_habitacion, estado_civil, negocio_domicilio, destino_credito, automovil_propio, buro_credito, tipo_garantia, tipo_negocio, genero, puntaje_total, clasificacion_modelo, capturado_por_id)
  VALUES ('006006', '01', 'NANCY MARTINEZ BAUTISTA', '1985-08-31', 22, 22, 1, 4, 2, 'Propia', 'Viudo', true, 'Capital de trabajo', false, 'Excelente', 'Ninguna', 'Fijo', 'Femenino', 90.8, 'A', (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1))
  RETURNING id INTO v_id;
  INSERT INTO acreditado_referencias (acreditado_id, calidad) VALUES (v_id, 'Excelente');

  -- 006048 CESAR GUADALUPE RENDON PICHARDO
  INSERT INTO acreditados (clave, ciclo, nombre_completo, fecha_nacimiento, tiempo_residencia, antiguedad_negocio, dependientes, antiguedad_telefono, cuenta_banco, casa_habitacion, estado_civil, negocio_domicilio, destino_credito, automovil_propio, buro_credito, tipo_garantia, tipo_negocio, genero, puntaje_total, clasificacion_modelo, capturado_por_id)
  VALUES ('006048', '01', 'CESAR GUADALUPE RENDON PICHARDO', '1990-04-15', 30, 14, 2, 1, 4, 'Propia', 'Casado', false, 'Capital de trabajo', true, 'Buena', 'Ninguna', 'Fijo', 'Masculino', 91.4, 'A', (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1))
  RETURNING id INTO v_id;
  INSERT INTO acreditado_referencias (acreditado_id, calidad) VALUES (v_id, 'Excelente');

  -- 005940 EDUARDO DANIEL MERCADO ROBLES
  INSERT INTO acreditados (clave, ciclo, nombre_completo, fecha_nacimiento, tiempo_residencia, antiguedad_negocio, dependientes, antiguedad_telefono, cuenta_banco, casa_habitacion, estado_civil, negocio_domicilio, destino_credito, automovil_propio, buro_credito, tipo_garantia, tipo_negocio, genero, puntaje_total, clasificacion_modelo, capturado_por_id)
  VALUES ('005940', '01', 'EDUARDO DANIEL MERCADO ROBLES', '1990-01-17', 1, 10, 2, 10, 2, 'Rentada', 'Union libre', true, 'Capital de trabajo', true, 'Regular', 'Ninguna', 'Fijo', 'Masculino', 80.6, 'A', (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1))
  RETURNING id INTO v_id;
  INSERT INTO acreditado_referencias (acreditado_id, calidad) VALUES (v_id, 'Buena');

  -- 004401 PATRICIA RODRIGUEZ BERMEO
  INSERT INTO acreditados (clave, ciclo, nombre_completo, fecha_nacimiento, tiempo_residencia, antiguedad_negocio, dependientes, antiguedad_telefono, cuenta_banco, casa_habitacion, estado_civil, negocio_domicilio, destino_credito, automovil_propio, buro_credito, tipo_garantia, tipo_negocio, genero, puntaje_total, clasificacion_modelo, capturado_por_id)
  VALUES ('004401', '02', 'PATRICIA RODRIGUEZ BERMEO', '1975-11-11', 20, 8, 2, 2, 1, 'Propia', 'Casado', true, 'Capital de trabajo', false, 'Buena', 'Ninguna', 'Fijo', 'Femenino', 84, 'A', (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1))
  RETURNING id INTO v_id;
  INSERT INTO acreditado_referencias (acreditado_id, calidad) VALUES (v_id, 'Buena');

  -- 001388 LORENA ARENAS DE JESUS
  INSERT INTO acreditados (clave, ciclo, nombre_completo, fecha_nacimiento, tiempo_residencia, antiguedad_negocio, dependientes, antiguedad_telefono, cuenta_banco, casa_habitacion, estado_civil, negocio_domicilio, destino_credito, automovil_propio, buro_credito, tipo_garantia, tipo_negocio, genero, puntaje_total, clasificacion_modelo, capturado_por_id)
  VALUES ('001388', '03', 'LORENA ARENAS DE JESUS', '1989-08-06', 20, 8, 0, 3, 2, 'Familiar', 'Union libre', true, 'Capital de trabajo', true, 'Excelente', 'Ninguna', 'Fijo', 'Femenino', 86.8, 'A', (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1))
  RETURNING id INTO v_id;
  INSERT INTO acreditado_referencias (acreditado_id, calidad) VALUES (v_id, 'Buena');

  -- 001384 MA GUADALUPE SOTO ARRIAGA
  INSERT INTO acreditados (clave, ciclo, nombre_completo, fecha_nacimiento, tiempo_residencia, antiguedad_negocio, dependientes, antiguedad_telefono, cuenta_banco, casa_habitacion, estado_civil, negocio_domicilio, destino_credito, automovil_propio, buro_credito, tipo_garantia, tipo_negocio, genero, puntaje_total, clasificacion_modelo, capturado_por_id)
  VALUES ('001384', '02', 'MA GUADALUPE SOTO ARRIAGA', '1971-09-15', 32, 11, 5, 4, 1, 'Propia', 'Casado', true, 'Capital de trabajo', false, 'Excelente', 'Ninguna', 'Fijo', 'Femenino', 87.2, 'A', (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1))
  RETURNING id INTO v_id;
  INSERT INTO acreditado_referencias (acreditado_id, calidad) VALUES (v_id, 'Buena');

  -- 006287 RAYMUNDO VALENTIN CONTRERAS
  INSERT INTO acreditados (clave, ciclo, nombre_completo, fecha_nacimiento, tiempo_residencia, antiguedad_negocio, dependientes, antiguedad_telefono, cuenta_banco, casa_habitacion, estado_civil, negocio_domicilio, destino_credito, automovil_propio, buro_credito, tipo_garantia, tipo_negocio, genero, puntaje_total, clasificacion_modelo, capturado_por_id)
  VALUES ('006287', '01', 'RAYMUNDO VALENTIN CONTRERAS', '1982-11-22', 2, 2, 0, 1, 2, 'Familiar', 'Union libre', false, 'Capital de trabajo', false, 'Excelente', 'Ninguna', 'Fijo', 'Masculino', 74.8, 'B', (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1))
  RETURNING id INTO v_id;
  INSERT INTO acreditado_referencias (acreditado_id, calidad) VALUES (v_id, 'Regular');

  -- 001459 IRMA CABALLERO GONZALEZ
  INSERT INTO acreditados (clave, ciclo, nombre_completo, fecha_nacimiento, tiempo_residencia, antiguedad_negocio, dependientes, antiguedad_telefono, cuenta_banco, casa_habitacion, estado_civil, negocio_domicilio, destino_credito, automovil_propio, buro_credito, tipo_garantia, tipo_negocio, genero, puntaje_total, clasificacion_modelo, capturado_por_id)
  VALUES ('001459', '03', 'IRMA CABALLERO GONZALEZ', '1966-06-06', 20, 4, 1, 15, 2, 'Propia', 'Soltero', true, 'Capital de trabajo', false, 'Regular', 'Ninguna', 'Fijo', 'Femenino', 80.6, 'A', (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1))
  RETURNING id INTO v_id;
  INSERT INTO acreditado_referencias (acreditado_id, calidad) VALUES (v_id, 'Excelente');

  -- 006304 GLORIA IVETTE MUNGUIA VALLEJO
  INSERT INTO acreditados (clave, ciclo, nombre_completo, fecha_nacimiento, tiempo_residencia, antiguedad_negocio, dependientes, antiguedad_telefono, cuenta_banco, casa_habitacion, estado_civil, negocio_domicilio, destino_credito, automovil_propio, buro_credito, tipo_garantia, tipo_negocio, genero, puntaje_total, clasificacion_modelo, capturado_por_id)
  VALUES ('006304', '01', 'GLORIA IVETTE MUNGUIA VALLEJO', '1985-04-06', 4, 15, 1, 3, 2, 'Familiar', 'Divorciado', true, 'Capital de trabajo', false, 'Buena', 'Ninguna', 'Semifijo', 'Femenino', 74.1, 'B', (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1))
  RETURNING id INTO v_id;
  INSERT INTO acreditado_referencias (acreditado_id, calidad) VALUES (v_id, 'Regular');

  -- 006228 MARIA EUGENIA RIOS AREVALO
  INSERT INTO acreditados (clave, ciclo, nombre_completo, fecha_nacimiento, tiempo_residencia, antiguedad_negocio, dependientes, antiguedad_telefono, cuenta_banco, casa_habitacion, estado_civil, negocio_domicilio, destino_credito, automovil_propio, buro_credito, tipo_garantia, tipo_negocio, genero, puntaje_total, clasificacion_modelo, capturado_por_id)
  VALUES ('006228', '01', 'MARIA EUGENIA RIOS AREVALO', '1977-05-28', 48, 20, 0, 1, 2, 'Propia', 'Casado', true, 'Capital de trabajo', true, 'Buena', 'Ninguna', 'Fijo', 'Femenino', 88.4, 'A', (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1))
  RETURNING id INTO v_id;
  INSERT INTO acreditado_referencias (acreditado_id, calidad) VALUES (v_id, 'Buena');

  -- 006354 GABRIELA DIAZLEAL NAVA
  INSERT INTO acreditados (clave, ciclo, nombre_completo, fecha_nacimiento, tiempo_residencia, antiguedad_negocio, dependientes, antiguedad_telefono, cuenta_banco, casa_habitacion, estado_civil, negocio_domicilio, destino_credito, automovil_propio, buro_credito, tipo_garantia, tipo_negocio, genero, puntaje_total, clasificacion_modelo, capturado_por_id)
  VALUES ('006354', '01', 'GABRIELA DIAZLEAL NAVA', '1973-02-27', 52, 3, 3, 1, 2, 'Propia', 'Soltero', true, 'Capital de trabajo', false, 'Excelente', 'Ninguna', 'Fijo', 'Femenino', 81.6, 'A', (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1))
  RETURNING id INTO v_id;
  INSERT INTO acreditado_referencias (acreditado_id, calidad) VALUES (v_id, 'Buena');

  -- 006380 ALMA ROSA CARRIOLA GIL
  INSERT INTO acreditados (clave, ciclo, nombre_completo, fecha_nacimiento, tiempo_residencia, antiguedad_negocio, dependientes, antiguedad_telefono, cuenta_banco, casa_habitacion, estado_civil, negocio_domicilio, destino_credito, automovil_propio, buro_credito, tipo_garantia, tipo_negocio, genero, puntaje_total, clasificacion_modelo, capturado_por_id)
  VALUES ('006380', '01', 'ALMA ROSA CARRIOLA GIL', '1991-11-15', 13, 20, 3, 5, 2, 'Propia', 'Casado', true, 'Capital de trabajo', true, 'Buena', 'Ninguna', 'Fijo', 'Femenino', 89, 'A', (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1))
  RETURNING id INTO v_id;
  INSERT INTO acreditado_referencias (acreditado_id, calidad) VALUES (v_id, 'Buena');

  -- 006379 MARIA LUCERO ROBLES AGUILAR
  INSERT INTO acreditados (clave, ciclo, nombre_completo, fecha_nacimiento, tiempo_residencia, antiguedad_negocio, dependientes, antiguedad_telefono, cuenta_banco, casa_habitacion, estado_civil, negocio_domicilio, destino_credito, automovil_propio, buro_credito, tipo_garantia, tipo_negocio, genero, puntaje_total, clasificacion_modelo, capturado_por_id)
  VALUES ('006379', '01', 'MARIA LUCERO ROBLES AGUILAR', '1996-05-22', 28, 8, 2, 2, 1, 'Familiar', 'Soltero', true, 'Capital de trabajo', false, 'Regular', 'Ninguna', 'Fijo', 'Femenino', 71.6, 'B', (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1))
  RETURNING id INTO v_id;
  INSERT INTO acreditado_referencias (acreditado_id, calidad) VALUES (v_id, 'Buena');

  -- 006358 COLUMBA DIAZ SANCHEZ
  INSERT INTO acreditados (clave, ciclo, nombre_completo, fecha_nacimiento, tiempo_residencia, antiguedad_negocio, dependientes, antiguedad_telefono, cuenta_banco, casa_habitacion, estado_civil, negocio_domicilio, destino_credito, automovil_propio, buro_credito, tipo_garantia, tipo_negocio, genero, puntaje_total, clasificacion_modelo, capturado_por_id)
  VALUES ('006358', '01', 'COLUMBA DIAZ SANCHEZ', '1960-09-17', 29, 20, 0, 2, 1, 'Propia', 'Casado', true, 'Capital de trabajo', true, 'Excelente', 'Ninguna', 'Fijo', 'Femenino', 90.6, 'A', (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1))
  RETURNING id INTO v_id;
  INSERT INTO acreditado_referencias (acreditado_id, calidad) VALUES (v_id, 'Excelente');

END $$;