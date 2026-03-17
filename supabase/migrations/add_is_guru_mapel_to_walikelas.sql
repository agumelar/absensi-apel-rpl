alter table if exists public.walikelas
add column if not exists is_guru_mapel boolean not null default false;

comment on column public.walikelas.is_guru_mapel is
'Flag akses modul guru mapel (V2 Teacher Flow).';
