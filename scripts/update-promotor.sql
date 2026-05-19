UPDATE acreditados SET
  calificacion_promotor = 'A',
  justificacion_promotor = 'De acuerdo con calificacion',
  promotor_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
  WHERE clave = '005724';

UPDATE acreditados SET
  calificacion_promotor = 'A',
  justificacion_promotor = 'De acuerdo con la calificación',
  promotor_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
  WHERE clave = '006006';

UPDATE acreditados SET
  calificacion_promotor = 'A',
  justificacion_promotor = 'ok',
  promotor_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
  WHERE clave = '006048';

UPDATE acreditados SET
  calificacion_promotor = 'B',
  justificacion_promotor = 'No tiene experiencia en cuentas similares a la solicitada, paga creditos pequeños, el domicilio actual es rentado y lleva un año,',
  promotor_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
  WHERE clave = '005940';

UPDATE acreditados SET
  calificacion_promotor = 'A',
  justificacion_promotor = 'No tiene experiencia en cuentas similares a la solicitada, paga creditos pequeños, el domicilio actual es rentado y lleva un año,',
  promotor_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
  WHERE clave = '004401';

UPDATE acreditados SET
  calificacion_promotor = 'A',
  justificacion_promotor = 'De acuerdo con la categoria',
  promotor_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
  WHERE clave = '001388';

UPDATE acreditados SET
  calificacion_promotor = 'A',
  justificacion_promotor = 'OK',
  promotor_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
  WHERE clave = '001384';

UPDATE acreditados SET
  calificacion_promotor = 'B',
  justificacion_promotor = 'De acuerdo',
  promotor_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
  WHERE clave = '006287';

UPDATE acreditados SET
  calificacion_promotor = 'B',
  justificacion_promotor = 'DE ACUERDO',
  promotor_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
  WHERE clave = '001459';

UPDATE acreditados SET
  calificacion_promotor = 'B',
  justificacion_promotor = 'De acuerdo',
  promotor_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
  WHERE clave = '006304';

UPDATE acreditados SET
  calificacion_promotor = 'A',
  justificacion_promotor = 'De acuerdo',
  promotor_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
  WHERE clave = '006228';

UPDATE acreditados SET
  calificacion_promotor = 'A',
  justificacion_promotor = 'DE ACUERDO',
  promotor_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
  WHERE clave = '006354';

UPDATE acreditados SET
  calificacion_promotor = 'A',
  justificacion_promotor = 'De acuerdo',
  promotor_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
  WHERE clave = '006380';

UPDATE acreditados SET
  calificacion_promotor = 'B',
  justificacion_promotor = 'De acuerdo',
  promotor_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
  WHERE clave = '006379';

UPDATE acreditados SET
  calificacion_promotor = 'A',
  justificacion_promotor = 'De acuerdo',
  promotor_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
  WHERE clave = '006358';
