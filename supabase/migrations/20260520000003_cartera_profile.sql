alter table profiles
  add column if not exists acceso_cartera boolean not null default false;
