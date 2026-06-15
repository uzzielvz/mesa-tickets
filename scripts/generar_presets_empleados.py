# Genera la migración de alta de empleados (áreas + login_presets)
# a partir del Excel de RH "Información para Sistemas - con AREA.xlsx".
#
# Uso:  python scripts/generar_presets_empleados.py <ruta_excel> <ruta_salida_sql>
#
# Reglas:
# - Las áreas propuestas del Excel se insertan en `areas` si no existen,
#   mapeando nombres a las áreas ya sembradas ('Crédito', 'Sistemas').
# - login_presets: ON CONFLICT DO NOTHING para no pisar presets manuales
#   existentes (ej. yrendon).
# - rol 'responsable' solo para quienes atienden tickets (Tesorería y
#   Data Science); el resto 'usuario'. acceso_score=false para todos
#   (se habilita por persona desde /admin/usuarios).

import sys
import pandas as pd

# Mapeo de área propuesta en Excel -> nombre canónico en la tabla `areas`
AREA_MAP = {
    'Crédito (central)': 'Crédito',
    'Sistemas / TI': 'Sistemas',
}

# Atienden tickets según junta de procesos (Tesorería y Data Science)
RESPONSABLES = {
    'heber.padilla@financieracrediflexi.com',
    'anahi.baca@financieracrediflexi.com',
    'felix.gutierrez@financieracrediflexi.com',
    'carlos.mejia@financieracrediflexi.com',
}

PARTICULAS = {'de', 'del', 'la', 'las', 'los', 'y'}


def title_es(nombre: str) -> str:
    palabras = nombre.strip().split()
    out = []
    for i, p in enumerate(palabras):
        t = p.title()
        if i > 0 and t.lower() in PARTICULAS:
            t = t.lower()
        out.append(t)
    return ' '.join(out)


def sql_str(v: str) -> str:
    return "'" + v.replace("'", "''") + "'"


def main(excel_path: str, out_path: str) -> None:
    raw = pd.read_excel(excel_path, sheet_name=0, header=None)

    # Localizar la fila de encabezados (la que contiene 'NOMBRE')
    header_row = None
    for i in range(min(10, len(raw))):
        if any(str(c).strip().upper() == 'NOMBRE' for c in raw.iloc[i]):
            header_row = i
            break
    if header_row is None:
        raise SystemExit('No se encontró la fila de encabezados (NOMBRE)')

    df = raw.iloc[header_row + 1:].copy()
    # Columnas por posición: 0=#, 1=nombre, 2=posición, 3=jefe, 4=correo, 5=área, 6=revisar
    df = df[[1, 2, 4, 5]]
    df.columns = ['nombre', 'posicion', 'correo', 'area']
    df = df.dropna(subset=['nombre', 'correo'])
    df['correo'] = df['correo'].astype(str).str.strip().str.lower()
    df = df[df['correo'].str.contains('@financieracrediflexi.com')]
    df['area'] = df['area'].astype(str).str.strip().map(lambda a: AREA_MAP.get(a, a))
    df['nombre'] = df['nombre'].astype(str).map(title_es)

    dups = df[df['correo'].duplicated(keep=False)]
    if not dups.empty:
        print('ADVERTENCIA: correos duplicados:\n', dups[['nombre', 'correo']])

    areas = sorted(df['area'].unique())

    lines = []
    lines.append('-- ================================================================')
    lines.append('-- ALTA DE EMPLEADOS: áreas organizacionales + login_presets')
    lines.append(f'-- Generado por scripts/generar_presets_empleados.py ({len(df)} empleados)')
    lines.append('-- Fuente: Excel de RH "Información para Sistemas - con AREA"')
    lines.append('-- Al primer login de cada persona, handle_new_user aplica el preset')
    lines.append('-- (rol, área, nombre) y salta el onboarding.')
    lines.append('-- Idempotente: ON CONFLICT DO NOTHING (no pisa presets manuales).')
    lines.append('-- ================================================================')
    lines.append('')
    lines.append('-- 1) Áreas (las propuestas pendientes de confirmar se ajustan en /admin)')
    lines.append('insert into areas (nombre) values')
    lines.append(',\n'.join(f'  ({sql_str(a)})' for a in areas))
    lines.append('on conflict (nombre) do nothing;')
    lines.append('')
    lines.append('-- 2) Presets de login (uno por empleado)')
    lines.append('insert into login_presets (email, rol, acceso_score, area_id, nombre_completo)')
    lines.append('values')

    rows = []
    for _, r in df.iterrows():
        rol = 'responsable' if r['correo'] in RESPONSABLES else 'usuario'
        rows.append(
            f"  ({sql_str(r['correo'])}, {sql_str(rol)}, false, "
            f"(select id from areas where nombre = {sql_str(r['area'])}), {sql_str(r['nombre'])})"
        )
    lines.append(',\n'.join(rows))
    lines.append('on conflict (email) do nothing;')
    lines.append('')

    with open(out_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

    print(f'OK: {len(df)} empleados, {len(areas)} áreas -> {out_path}')
    print('Áreas:', ', '.join(areas))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
