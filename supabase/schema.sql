-- =====================================================================
-- CBT SMK - Skema Database Supabase
-- Jalankan seluruh file ini di Supabase Dashboard -> SQL Editor -> Run
-- Aman dijalankan ulang (idempotent) untuk tabel & fungsi.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- TABEL
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  nama_sekolah text default 'SMK Mamba''ul Ulum',
  npsn text,
  alamat text,
  kota text default 'Mojokerto',
  telepon text,
  email text,
  kepala_sekolah text,
  nip_kepsek text,
  tahun_ajaran text default '2026/2027',
  semester text default 'Ganjil',
  judul_ujian text default 'Penilaian Akhir Semester',
  logo_url text,
  updated_at timestamptz default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;
update public.settings set nama_sekolah = 'SMK Mamba''ul Ulum', kota = coalesce(kota, 'Mojokerto') where id = 1 and nama_sekolah = 'SMK Negeri';

create table if not exists public.kelas (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  jurusan text,
  created_at timestamptz default now()
);

create table if not exists public.siswa (
  id uuid primary key default gen_random_uuid(),
  nis text not null unique,
  nama text not null,
  kelas_id uuid references public.kelas(id) on delete set null,
  jk text,
  password text not null,
  ruang text,
  sesi text,
  session_token uuid,
  last_login timestamptz,
  last_seen timestamptz,
  created_at timestamptz default now()
);
create index if not exists siswa_kelas_idx on public.siswa(kelas_id);

create table if not exists public.mapel (
  id uuid primary key default gen_random_uuid(),
  kode text,
  nama text not null,
  created_at timestamptz default now()
);

create table if not exists public.bank_soal (
  id uuid primary key default gen_random_uuid(),
  mapel_id uuid references public.mapel(id) on delete set null,
  nama text not null,
  keterangan text,
  created_at timestamptz default now()
);

-- tipe: 'pg' (pilihan ganda), 'mcma' (PG kompleks multi jawaban),
--       'kategori' (PG kompleks kategori: Benar/Salah, Sesuai/Tidak Sesuai)
-- opsi : [{"id":"A","teks":"..."}]  (untuk kategori: daftar pernyataan)
-- kunci: pg -> "A" ; mcma -> ["A","C"] ; kategori -> {"1":"Benar","2":"Salah"}
create table if not exists public.soal (
  id uuid primary key default gen_random_uuid(),
  bank_id uuid not null references public.bank_soal(id) on delete cascade,
  tipe text not null default 'pg' check (tipe in ('pg','mcma','kategori')),
  pertanyaan text not null default '',
  opsi jsonb not null default '[]'::jsonb,
  kunci jsonb,
  label_kategori jsonb not null default '["Benar","Salah"]'::jsonb,
  bobot numeric not null default 1,
  urutan int not null default 0,
  created_at timestamptz default now()
);
create index if not exists soal_bank_idx on public.soal(bank_id);

create table if not exists public.ujian (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  bank_id uuid not null references public.bank_soal(id) on delete restrict,
  kelas_ids uuid[] not null default '{}',
  mulai timestamptz,
  selesai timestamptz,
  durasi_menit int not null default 60,
  token text,
  acak_soal boolean not null default true,
  acak_opsi boolean not null default true,
  tampil_nilai boolean not null default false,
  skor_parsial boolean not null default false,
  max_pelanggaran int not null default 3,
  aktif boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists public.peserta_ujian (
  id uuid primary key default gen_random_uuid(),
  ujian_id uuid not null references public.ujian(id) on delete cascade,
  siswa_id uuid not null references public.siswa(id) on delete cascade,
  status text not null default 'berlangsung' check (status in ('berlangsung','selesai','terkunci')),
  mulai_at timestamptz default now(),
  batas_at timestamptz,
  selesai_at timestamptz,
  urutan_soal uuid[] not null default '{}',
  urutan_opsi jsonb not null default '{}'::jsonb,
  jawaban jsonb not null default '{}'::jsonb,
  ragu jsonb not null default '[]'::jsonb,
  nilai numeric,
  benar int,
  pelanggaran int not null default 0,
  unique (ujian_id, siswa_id)
);

create table if not exists public.log_pelanggaran (
  id bigserial primary key,
  peserta_id uuid not null references public.peserta_ujian(id) on delete cascade,
  jenis text not null,
  created_at timestamptz default now()
);
create index if not exists log_peserta_idx on public.log_pelanggaran(peserta_id);

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY & PERAN PENGGUNA
-- Admin  = user Supabase Auth dengan peran 'admin' di tabel pengguna -> akses penuh.
-- Guru   = user Supabase Auth dengan peran 'guru' -> kelola bank soal & ujian
--          miliknya sendiri, memantau ujiannya, membaca data kelas/mapel/siswa.
-- Siswa  = role anon -> TIDAK punya akses tabel langsung; semua lewat
--          fungsi RPC (security definer) yang memvalidasi token sesi.
--          Ini mencegah siswa membaca kunci jawaban / data siswa lain.
-- ---------------------------------------------------------------------
create table if not exists public.pengguna (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text not null,
  email text,
  role text not null default 'guru' check (role in ('admin','guru')),
  mapel_ids uuid[] not null default '{}',
  created_at timestamptz default now()
);
-- Tugas mengajar: guru mengampu mapel di kelas tertentu
create table if not exists public.pengajaran (
  id uuid primary key default gen_random_uuid(),
  guru_id uuid not null references public.pengguna(id) on delete cascade,
  mapel_id uuid not null references public.mapel(id) on delete cascade,
  kelas_id uuid not null references public.kelas(id) on delete cascade,
  unique (guru_id, mapel_id, kelas_id)
);
alter table public.bank_soal add column if not exists created_by uuid default auth.uid();
alter table public.ujian add column if not exists created_by uuid default auth.uid();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.pengguna where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_staf()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.pengguna where id = auth.uid());
$$;

-- guru boleh mengelola bank soal buatannya atau bank soal mapel yang diampunya
create or replace function public.boleh_bank(p_bank uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists(
    select 1 from public.bank_soal b join public.pengguna g on g.id = auth.uid()
     where b.id = p_bank and (b.created_by = g.id or b.mapel_id = any(g.mapel_ids)));
$$;

create or replace function public.boleh_ujian(p_ujian uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists(
    select 1 from public.ujian u where u.id = p_ujian and (u.created_by = auth.uid() or public.boleh_bank(u.bank_id)));
$$;

-- guru hanya boleh menjadwalkan ujian untuk kelas yang diajarnya pada mapel bank soal tsb
create or replace function public.boleh_kelas_ujian(p_bank uuid, p_kelas uuid[])
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or not exists(
    select 1 from unnest(coalesce(p_kelas, '{}')) k
     where not exists(
       select 1 from public.pengajaran a join public.bank_soal b on b.mapel_id = a.mapel_id
        where b.id = p_bank and a.guru_id = auth.uid() and a.kelas_id = k));
$$;

do $$
declare t text;
begin
  foreach t in array array['settings','kelas','siswa','mapel','bank_soal','soal','ujian','peserta_ujian','log_pelanggaran','pengguna','pengajaran'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "admin_all" on public.%I', t);
    execute format('create policy "admin_all" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('drop policy if exists "guru_baca" on public.%I', t);
    execute format('drop policy if exists "guru_kelola" on public.%I', t);
  end loop;
end $$;

-- guru: baca data master
create policy "guru_baca" on public.settings for select to authenticated using (public.is_staf());
create policy "guru_baca" on public.kelas for select to authenticated using (public.is_staf());
create policy "guru_baca" on public.mapel for select to authenticated using (public.is_staf());
create policy "guru_baca" on public.siswa for select to authenticated using (public.is_staf());
create policy "guru_baca" on public.pengguna for select to authenticated using (id = auth.uid());
create policy "guru_baca" on public.pengajaran for select to authenticated using (guru_id = auth.uid());
-- guru: kelola bank soal, soal, ujian miliknya
create policy "guru_kelola" on public.bank_soal for all to authenticated
  using (public.is_staf() and public.boleh_bank(id))
  with check (public.is_staf() and (created_by = auth.uid() or public.boleh_bank(id)));
create policy "guru_kelola" on public.soal for all to authenticated
  using (public.boleh_bank(bank_id)) with check (public.boleh_bank(bank_id));
create policy "guru_kelola" on public.ujian for all to authenticated
  using (public.is_staf() and (created_by = auth.uid() or public.boleh_bank(bank_id)))
  with check (public.is_staf() and public.boleh_bank(bank_id) and public.boleh_kelas_ujian(bank_id, kelas_ids));
create policy "guru_kelola" on public.peserta_ujian for all to authenticated
  using (public.boleh_ujian(ujian_id)) with check (public.boleh_ujian(ujian_id));
create policy "guru_baca" on public.log_pelanggaran for select to authenticated
  using (exists(select 1 from public.peserta_ujian p where p.id = peserta_id and public.boleh_ujian(p.ujian_id)));

drop policy if exists "public_read_settings" on public.settings;
create policy "public_read_settings" on public.settings for select to anon using (true);

-- ---------------------------------------------------------------------
-- FUNGSI INTERNAL
-- ---------------------------------------------------------------------
create or replace function public._siswa_by_token(p_token uuid)
returns public.siswa
language plpgsql security definer set search_path = public as $$
declare s public.siswa;
begin
  if p_token is null then raise exception 'SESI_TIDAK_VALID'; end if;
  select * into s from public.siswa where session_token = p_token;
  if not found then raise exception 'SESI_TIDAK_VALID'; end if;
  update public.siswa set last_seen = now() where id = s.id;
  return s;
end $$;

create or replace function public._peserta_milik(p_token uuid, p_peserta uuid)
returns public.peserta_ujian
language plpgsql security definer set search_path = public as $$
declare s public.siswa; p public.peserta_ujian;
begin
  s := public._siswa_by_token(p_token);
  select * into p from public.peserta_ujian where id = p_peserta and siswa_id = s.id;
  if not found then raise exception 'Data ujian tidak ditemukan'; end if;
  return p;
end $$;

create or replace function public.hitung_nilai(p_peserta uuid)
returns numeric
language plpgsql security definer set search_path = public as $$
declare
  p public.peserta_ujian; u public.ujian; q record;
  total numeric := 0; dapat numeric := 0; jml_benar int := 0;
  j jsonb; n int; c int; salah int; skor numeric; hasil numeric;
begin
  select * into p from public.peserta_ujian where id = p_peserta;
  select * into u from public.ujian where id = p.ujian_id;
  for q in select * from public.soal where id = any(p.urutan_soal) loop
    total := total + q.bobot;
    j := p.jawaban -> (q.id::text);
    skor := 0;
    if j is not null and q.kunci is not null then
      if q.tipe = 'pg' then
        if j = q.kunci then skor := 1; end if;
      elsif q.tipe = 'mcma' then
        n := jsonb_array_length(q.kunci);
        if jsonb_typeof(j) = 'array' and n > 0 then
          select count(*) filter (where q.kunci ? x), count(*) filter (where not (q.kunci ? x))
            into c, salah from jsonb_array_elements_text(j) x;
          if c = n and salah = 0 then skor := 1;
          elsif u.skor_parsial then skor := greatest(0, (c - salah)::numeric / n);
          end if;
        end if;
      elsif q.tipe = 'kategori' then
        select count(*), count(*) filter (where j ->> k.key = k.value)
          into n, c from jsonb_each_text(q.kunci) k;
        if n > 0 then
          if c = n then skor := 1;
          elsif u.skor_parsial then skor := c::numeric / n;
          end if;
        end if;
      end if;
    end if;
    if skor = 1 then jml_benar := jml_benar + 1; end if;
    dapat := dapat + skor * q.bobot;
  end loop;
  hasil := case when total > 0 then round(dapat / total * 100, 2) else 0 end;
  update public.peserta_ujian set nilai = hasil, benar = jml_benar where id = p_peserta;
  return hasil;
end $$;

create or replace function public._finalisasi(p_peserta uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.hitung_nilai(p_peserta);
  update public.peserta_ujian
     set status = 'selesai', selesai_at = coalesce(selesai_at, now())
   where id = p_peserta;
end $$;

-- ---------------------------------------------------------------------
-- RPC SISWA (dipanggil dari browser dengan role anon)
-- ---------------------------------------------------------------------
create or replace function public.siswa_login(p_nis text, p_password text)
returns json
language plpgsql security definer set search_path = public as $$
declare s public.siswa; t uuid := gen_random_uuid(); sedang boolean;
begin
  select * into s from public.siswa where nis = trim(p_nis) and password = p_password;
  if not found then raise exception 'NIS atau password salah'; end if;
  -- Anti joki: tolak login ganda bila akun sedang aktif ujian di perangkat lain
  select exists(select 1 from public.peserta_ujian where siswa_id = s.id and status = 'berlangsung')
    into sedang;
  if sedang and s.session_token is not null and s.last_seen > now() - interval '90 seconds' then
    raise exception 'Akun sedang dipakai di perangkat lain. Minta pengawas melakukan Reset Login.';
  end if;
  update public.siswa set session_token = t, last_login = now(), last_seen = now() where id = s.id;
  return json_build_object('token', t, 'id', s.id, 'nis', s.nis, 'nama', s.nama,
    'kelas', (select nama from public.kelas where id = s.kelas_id), 'ruang', s.ruang, 'sesi', s.sesi);
end $$;

create or replace function public.siswa_me(p_token uuid)
returns json
language plpgsql security definer set search_path = public as $$
declare s public.siswa;
begin
  s := public._siswa_by_token(p_token);
  return json_build_object('token', p_token, 'id', s.id, 'nis', s.nis, 'nama', s.nama,
    'kelas', (select nama from public.kelas where id = s.kelas_id), 'ruang', s.ruang, 'sesi', s.sesi);
end $$;

create or replace function public.siswa_logout(p_token uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.siswa set session_token = null where session_token = p_token;
end $$;

create or replace function public.siswa_daftar_ujian(p_token uuid)
returns json
language plpgsql security definer set search_path = public as $$
declare s public.siswa; r json;
begin
  s := public._siswa_by_token(p_token);
  -- selesaikan otomatis ujian yang waktunya habis
  perform public._finalisasi(id) from public.peserta_ujian
    where siswa_id = s.id and status = 'berlangsung' and batas_at < now();
  select coalesce(json_agg(x order by x.mulai nulls last, x.nama), '[]'::json) into r from (
    select u.id, u.nama, u.mulai, u.selesai, u.durasi_menit,
           (u.token is not null and u.token <> '') as pakai_token,
           m.nama as mapel,
           (select count(*) from public.soal where bank_id = u.bank_id) as jumlah_soal,
           p.status, p.id as peserta_id,
           case when u.tampil_nilai and p.status = 'selesai' then p.nilai end as nilai
      from public.ujian u
      join public.bank_soal b on b.id = u.bank_id
      left join public.mapel m on m.id = b.mapel_id
      left join public.peserta_ujian p on p.ujian_id = u.id and p.siswa_id = s.id
     where u.aktif and s.kelas_id = any(u.kelas_ids)
  ) x;
  return r;
end $$;

create or replace function public.siswa_mulai_ujian(p_token uuid, p_ujian uuid, p_kode text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare s public.siswa; u public.ujian; p public.peserta_ujian; urut uuid[]; uop jsonb; pid uuid;
begin
  s := public._siswa_by_token(p_token);
  select * into u from public.ujian where id = p_ujian and aktif;
  if not found or not (s.kelas_id = any(u.kelas_ids)) then raise exception 'Ujian tidak tersedia'; end if;
  if u.mulai is not null and now() < u.mulai then raise exception 'Ujian belum dimulai'; end if;
  if coalesce(u.token, '') <> '' and upper(trim(coalesce(p_kode, ''))) <> upper(trim(u.token)) then
    raise exception 'Token ujian salah';
  end if;

  select * into p from public.peserta_ujian where ujian_id = u.id and siswa_id = s.id;
  if found then
    if p.status = 'selesai' then raise exception 'Ujian sudah selesai dikerjakan'; end if;
    if p.status = 'terkunci' then raise exception 'Ujian terkunci. Hubungi pengawas untuk membuka.'; end if;
    if p.batas_at < now() then
      perform public._finalisasi(p.id);
      raise exception 'Waktu ujian sudah habis';
    end if;
    return p.id;
  end if;

  if u.selesai is not null and now() > u.selesai then raise exception 'Jadwal ujian sudah berakhir'; end if;

  select array_agg(id order by case when u.acak_soal then random() else 0 end, urutan, created_at)
    into urut from public.soal where bank_id = u.bank_id;
  if urut is null then raise exception 'Ujian belum memiliki soal'; end if;

  select coalesce(jsonb_object_agg(q.id::text, (
           select jsonb_agg(o ->> 'id' order by case when u.acak_opsi and q.tipe <> 'kategori' then random() else 0 end, ord)
             from jsonb_array_elements(q.opsi) with ordinality as e(o, ord))), '{}'::jsonb)
    into uop from public.soal q where q.bank_id = u.bank_id and jsonb_array_length(q.opsi) > 0;

  insert into public.peserta_ujian (ujian_id, siswa_id, urutan_soal, urutan_opsi, batas_at)
  values (u.id, s.id, urut, uop,
          case when u.selesai is null then now() + make_interval(mins => u.durasi_menit)
               else least(now() + make_interval(mins => u.durasi_menit), u.selesai) end)
  returning id into pid;
  return pid;
end $$;

create or replace function public.siswa_ambil_soal(p_token uuid, p_peserta uuid)
returns json
language plpgsql security definer set search_path = public as $$
declare p public.peserta_ujian; u public.ujian; s public.siswa; daftar json;
begin
  p := public._peserta_milik(p_token, p_peserta);
  if p.status = 'berlangsung' and p.batas_at < now() then
    perform public._finalisasi(p.id);
    select * into p from public.peserta_ujian where id = p_peserta;
  end if;
  select * into u from public.ujian where id = p.ujian_id;

  -- kunci jawaban TIDAK pernah dikirim ke siswa
  select coalesce(json_agg(json_build_object(
           'id', q.id, 'tipe', q.tipe, 'pertanyaan', q.pertanyaan,
           'label_kategori', q.label_kategori,
           'opsi', (select coalesce(json_agg(json_build_object('id', o ->> 'id', 'teks', o ->> 'teks') order by oi.ord), '[]'::json)
                      from jsonb_array_elements_text(coalesce(p.urutan_opsi -> (q.id::text), '[]'::jsonb)) with ordinality as oi(oid, ord)
                      join jsonb_array_elements(q.opsi) o on o ->> 'id' = oi.oid)
         ) order by su.ord), '[]'::json)
    into daftar
    from unnest(p.urutan_soal) with ordinality as su(sid, ord)
    join public.soal q on q.id = su.sid;

  return json_build_object(
    'ujian', json_build_object('id', u.id, 'nama', u.nama, 'max_pelanggaran', u.max_pelanggaran,
             'mapel', (select m.nama from public.bank_soal b left join public.mapel m on m.id = b.mapel_id where b.id = u.bank_id)),
    'status', p.status, 'batas_at', p.batas_at, 'server_now', now(),
    'pelanggaran', p.pelanggaran, 'jawaban', p.jawaban, 'ragu', p.ragu,
    'nilai', case when u.tampil_nilai and p.status = 'selesai' then p.nilai end,
    'soal', case when p.status = 'berlangsung' then daftar else '[]'::json end);
end $$;

create or replace function public.siswa_simpan_jawaban(p_token uuid, p_peserta uuid, p_soal uuid, p_jawaban jsonb, p_ragu boolean default false)
returns json
language plpgsql security definer set search_path = public as $$
declare p public.peserta_ujian;
begin
  p := public._peserta_milik(p_token, p_peserta);
  if p.status <> 'berlangsung' then raise exception 'UJIAN_%', upper(p.status); end if;
  if now() > p.batas_at + interval '30 seconds' then
    perform public._finalisasi(p.id);
    raise exception 'UJIAN_SELESAI';
  end if;
  if not (p_soal = any(p.urutan_soal)) then raise exception 'Soal tidak valid'; end if;
  update public.peserta_ujian set
    jawaban = case when p_jawaban is null or p_jawaban = 'null'::jsonb
                   then jawaban - (p_soal::text)
                   else jawaban || jsonb_build_object(p_soal::text, p_jawaban) end,
    ragu = case when p_ragu
                then (select coalesce(jsonb_agg(distinct v), '[]'::jsonb) from jsonb_array_elements_text(ragu || to_jsonb(p_soal::text)) v)
                else (select coalesce(jsonb_agg(v), '[]'::jsonb) from jsonb_array_elements_text(ragu) v where v <> p_soal::text) end
  where id = p.id;
  return json_build_object('ok', true, 'server_now', now());
end $$;

create or replace function public.siswa_ping(p_token uuid, p_peserta uuid)
returns json
language plpgsql security definer set search_path = public as $$
declare p public.peserta_ujian;
begin
  p := public._peserta_milik(p_token, p_peserta);
  if p.status = 'berlangsung' and p.batas_at < now() then
    perform public._finalisasi(p.id);
    select * into p from public.peserta_ujian where id = p_peserta;
  end if;
  return json_build_object('status', p.status, 'batas_at', p.batas_at, 'server_now', now(), 'pelanggaran', p.pelanggaran);
end $$;

create or replace function public.siswa_lapor_pelanggaran(p_token uuid, p_peserta uuid, p_jenis text)
returns json
language plpgsql security definer set search_path = public as $$
declare p public.peserta_ujian; u public.ujian; jml int; st text;
begin
  p := public._peserta_milik(p_token, p_peserta);
  if p.status <> 'berlangsung' then
    return json_build_object('pelanggaran', p.pelanggaran, 'status', p.status);
  end if;
  select * into u from public.ujian where id = p.ujian_id;
  insert into public.log_pelanggaran (peserta_id, jenis) values (p.id, left(coalesce(p_jenis, 'Tidak diketahui'), 200));
  jml := p.pelanggaran + 1;
  st := case when u.max_pelanggaran > 0 and jml >= u.max_pelanggaran then 'terkunci' else 'berlangsung' end;
  update public.peserta_ujian set pelanggaran = jml, status = st where id = p.id;
  return json_build_object('pelanggaran', jml, 'status', st, 'max', u.max_pelanggaran);
end $$;

create or replace function public.siswa_selesai(p_token uuid, p_peserta uuid)
returns json
language plpgsql security definer set search_path = public as $$
declare p public.peserta_ujian; u public.ujian;
begin
  p := public._peserta_milik(p_token, p_peserta);
  if p.status = 'terkunci' then raise exception 'Ujian terkunci. Hubungi pengawas.'; end if;
  if p.status = 'berlangsung' then perform public._finalisasi(p.id); end if;
  select * into p from public.peserta_ujian where id = p_peserta;
  select * into u from public.ujian where id = p.ujian_id;
  return json_build_object('status', p.status,
    'nilai', case when u.tampil_nilai then p.nilai end,
    'benar', case when u.tampil_nilai then p.benar end);
end $$;

-- ---------------------------------------------------------------------
-- RPC ADMIN (role authenticated)
-- ---------------------------------------------------------------------
create or replace function public.admin_finalisasi_kadaluarsa(p_ujian uuid default null)
returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; r record;
begin
  if not public.is_staf() then raise exception 'Akses ditolak'; end if;
  for r in select id from public.peserta_ujian
            where status = 'berlangsung' and batas_at < now()
              and (p_ujian is null or ujian_id = p_ujian) and public.boleh_ujian(ujian_id) loop
    perform public._finalisasi(r.id); n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.admin_selesaikan(p_peserta uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from public.peserta_ujian where id = p_peserta and public.boleh_ujian(ujian_id)) then
    raise exception 'Akses ditolak';
  end if;
  perform public._finalisasi(p_peserta);
end $$;

create or replace function public.admin_hitung_ulang(p_ujian uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; r record;
begin
  if not public.boleh_ujian(p_ujian) then raise exception 'Akses ditolak'; end if;
  for r in select id from public.peserta_ujian where ujian_id = p_ujian and status = 'selesai' loop
    perform public.hitung_nilai(r.id); n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- AKUN ADMIN & GURU
-- ---------------------------------------------------------------------
-- Dipanggil setelah login. Akun pertama yang login otomatis menjadi admin.
create or replace function public.profil_saya()
returns json
language plpgsql security definer set search_path = public as $$
declare p public.pengguna; em text;
begin
  if auth.uid() is null then return null; end if;
  select * into p from public.pengguna where id = auth.uid();
  if not found then
    if exists(select 1 from public.pengguna where role = 'admin') then return null; end if;
    select email into em from auth.users where id = auth.uid();
    insert into public.pengguna (id, nama, email, role) values (auth.uid(), coalesce(split_part(em, '@', 1), 'Admin'), em, 'admin')
    returning * into p;
  end if;
  return row_to_json(p);
end $$;

drop function if exists public.admin_simpan_pengguna(uuid, text, text, text, text, uuid[]);
-- p_ajar: [{"mapel_id":"...","kelas_id":"..."}, ...]
create or replace function public.admin_simpan_pengguna(
  p_id uuid, p_nama text, p_email text, p_password text, p_role text, p_ajar jsonb default '[]'::jsonb)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := p_id; em text := lower(trim(p_email)); p_mapel uuid[];
begin
  select coalesce(array_agg(distinct (x ->> 'mapel_id')::uuid), '{}') into p_mapel
    from jsonb_array_elements(coalesce(p_ajar, '[]'::jsonb)) x;
  if not public.is_admin() then raise exception 'Hanya admin yang dapat mengelola akun'; end if;
  if coalesce(trim(p_nama), '') = '' or em = '' then raise exception 'Nama dan email wajib diisi'; end if;
  if p_role not in ('admin', 'guru') then raise exception 'Peran tidak valid'; end if;
  if exists(select 1 from auth.users where lower(email) = em and id is distinct from uid) then
    raise exception 'Email sudah dipakai akun lain';
  end if;
  if uid is null then
    if length(coalesce(p_password, '')) < 6 then raise exception 'Password minimal 6 karakter'; end if;
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em,
      crypt(p_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('nama', p_nama), now(), now(),
      '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text,
      jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true), 'email', now(), now(), now());
    insert into public.pengguna (id, nama, email, role, mapel_ids) values (uid, trim(p_nama), em, p_role, coalesce(p_mapel, '{}'));
  else
    if uid = auth.uid() and p_role <> 'admin' then raise exception 'Tidak bisa menurunkan peran akun sendiri'; end if;
    update public.pengguna set nama = trim(p_nama), email = em, role = p_role, mapel_ids = coalesce(p_mapel, '{}') where id = uid;
    if not found then
      if not exists(select 1 from auth.users where id = uid) then raise exception 'Akun tidak ditemukan'; end if;
      insert into public.pengguna (id, nama, email, role, mapel_ids) values (uid, trim(p_nama), em, p_role, coalesce(p_mapel, '{}'));
    end if;
    update auth.users set email = em, updated_at = now() where id = uid;
    update auth.identities set identity_data = identity_data || jsonb_build_object('email', em) where user_id = uid and provider = 'email';
    if coalesce(p_password, '') <> '' then
      if length(p_password) < 6 then raise exception 'Password minimal 6 karakter'; end if;
      update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where id = uid;
    end if;
  end if;
  delete from public.pengajaran where guru_id = uid;
  if p_role = 'guru' then
    insert into public.pengajaran (guru_id, mapel_id, kelas_id)
    select distinct uid, (x ->> 'mapel_id')::uuid, (x ->> 'kelas_id')::uuid
      from jsonb_array_elements(coalesce(p_ajar, '[]'::jsonb)) x
     where x ->> 'kelas_id' is not null
    on conflict do nothing;
  end if;
  return uid;
end $$;

create or replace function public.admin_hapus_pengguna(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Hanya admin yang dapat mengelola akun'; end if;
  if p_id = auth.uid() then raise exception 'Tidak bisa menghapus akun sendiri'; end if;
  delete from auth.users where id = p_id;
end $$;

-- pengawas/guru boleh reset login siswa yang tertahan "dipakai di perangkat lain"
create or replace function public.staf_reset_login(p_siswa uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staf() then raise exception 'Akses ditolak'; end if;
  update public.siswa set session_token = null where id = p_siswa;
end $$;

-- ---------------------------------------------------------------------
-- HAK AKSES FUNGSI
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on function public.siswa_login(text, text) to anon, authenticated;
grant execute on function public.siswa_me(uuid) to anon, authenticated;
grant execute on function public.siswa_logout(uuid) to anon, authenticated;
grant execute on function public.siswa_daftar_ujian(uuid) to anon, authenticated;
grant execute on function public.siswa_mulai_ujian(uuid, uuid, text) to anon, authenticated;
grant execute on function public.siswa_ambil_soal(uuid, uuid) to anon, authenticated;
grant execute on function public.siswa_simpan_jawaban(uuid, uuid, uuid, jsonb, boolean) to anon, authenticated;
grant execute on function public.siswa_ping(uuid, uuid) to anon, authenticated;
grant execute on function public.siswa_lapor_pelanggaran(uuid, uuid, text) to anon, authenticated;
grant execute on function public.siswa_selesai(uuid, uuid) to anon, authenticated;
grant execute on function public.admin_finalisasi_kadaluarsa(uuid) to authenticated;
grant execute on function public.admin_selesaikan(uuid) to authenticated;
grant execute on function public.admin_hitung_ulang(uuid) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staf() to authenticated;
grant execute on function public.boleh_bank(uuid) to authenticated;
grant execute on function public.boleh_ujian(uuid) to authenticated;
grant execute on function public.profil_saya() to authenticated;
grant execute on function public.admin_simpan_pengguna(uuid, text, text, text, text, jsonb) to authenticated;
grant execute on function public.boleh_kelas_ujian(uuid, uuid[]) to authenticated;
grant execute on function public.admin_hapus_pengguna(uuid) to authenticated;
grant execute on function public.staf_reset_login(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- STORAGE: bucket "media" untuk gambar soal & logo sekolah
-- (baca publik, tulis hanya admin)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('media', 'media', true)
      on conflict (id) do update set public = true;
    drop policy if exists "media_public_read" on storage.objects;
    create policy "media_public_read" on storage.objects for select using (bucket_id = 'media');
    drop policy if exists "media_admin_insert" on storage.objects;
    create policy "media_admin_insert" on storage.objects for insert to authenticated with check (bucket_id = 'media');
    drop policy if exists "media_admin_update" on storage.objects;
    create policy "media_admin_update" on storage.objects for update to authenticated using (bucket_id = 'media');
    drop policy if exists "media_admin_delete" on storage.objects;
    create policy "media_admin_delete" on storage.objects for delete to authenticated using (bucket_id = 'media');
  end if;
end $$;
