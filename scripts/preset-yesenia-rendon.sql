-- Yesenia Rendon — solo permisos listos; ella elige nombre y área en onboarding.
-- Requiere migración 20260514000009_login_presets.sql aplicada antes.

insert into login_presets (email, rol, acceso_score, area_id, nombre_completo)
values (
  'yrendon@financieracrediflexi.com',
  'usuario',
  true,
  null,
  null
)
on conflict (email) do update set
  rol = excluded.rol,
  acceso_score = excluded.acceso_score,
  area_id = null,
  nombre_completo = null;

select email, rol, acceso_score, area_id, nombre_completo
from login_presets
where email = 'yrendon@financieracrediflexi.com';
