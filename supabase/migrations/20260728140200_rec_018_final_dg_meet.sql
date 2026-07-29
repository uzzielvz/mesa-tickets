-- REC-063 — S7: entrevista final con la DG.
-- Al pasar comité → final_dg se agenda un Meet (candidato + Director General) y se
-- envía la plantilla pase_fase3. Persistimos fecha/hora y liga para que el admin
-- pueda consultarla/copiarla después (se la puede reenviar por otro medio).

alter table rec_candidatos
  add column if not exists final_dg_at       timestamptz,
  add column if not exists final_dg_meet_url text;
