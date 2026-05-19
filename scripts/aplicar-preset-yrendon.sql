-- Si Yesenia ya tiene cuenta y solo faltaba activar Score (sin tocar nombre/área):

update profiles p
set
  rol = lp.rol,
  acceso_score = lp.acceso_score
from login_presets lp
where lower(p.email) = lower(lp.email)
  and lp.email = 'yrendon@financieracrediflexi.com';

select p.email, p.rol, p.acceso_score, p.nombre_completo, a.nombre as area
from profiles p
left join areas a on a.id = p.area_id
where p.email = 'yrendon@financieracrediflexi.com';
