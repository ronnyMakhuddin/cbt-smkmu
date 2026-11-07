# CBT SMK

Aplikasi ujian berbasis komputer (Computer Based Test) untuk SMK. Dibangun dengan React + Vite, database Supabase, siap di-deploy ke Vercel, dengan desain claymorphism.

## Fitur

**Panel Admin** (login lewat Supabase Auth, alamat `/admin`)
- Dashboard ringkasan
- **Akun Guru & Admin**: admin membuat akun guru langsung dari aplikasi (menu *Guru & Admin*), memilih mapel yang diampu, dan reset password
- Data siswa: tambah/edit, **import Excel**, export, generate password, reset login
- Kelas & mata pelajaran
- Bank soal dengan editor soal:
  - Tipe **Pilihan Ganda**, **PG Kompleks MCMA** (jawaban lebih dari satu), **PG Kompleks Kategori** (Benar/Salah, Sesuai/Tidak Sesuai, Ya/Tidak, Fakta/Opini)
  - **Upload gambar** (tombol atau tempel Ctrl+V) di soal maupun opsi
  - **Penulisan rumus** LaTeX (KaTeX) dengan palet rumus siap pakai
  - **Import soal dari Excel** (dengan pratinjau & validasi) dan export
- Jadwal ujian: pilih kelas, waktu, durasi, token, acak soal/opsi, skor parsial, batas pelanggaran
- Monitoring real-time (auto refresh): status peserta, progres, pelanggaran, buka kunci, reset, selesaikan paksa, export nilai Excel
- **Kartu ujian** siap cetak (8 per A4) berisi logo, identitas, username, password, serta **jadwal & token ujian**
- **Pengaturan sekolah & logo**, ganti password admin

**Siswa** (login NIS + password, alamat `/`)
- Daftar ujian sesuai kelas, masuk dengan token
- Navigasi nomor soal, ragu-ragu, ukuran huruf, timer dari server, simpan otomatis

**Anti curang**
- Wajib layar penuh; keluar layar penuh, pindah tab/aplikasi tercatat sebagai pelanggaran
- Ujian **terkunci otomatis** setelah batas pelanggaran, hanya pengawas yang bisa membuka
- Blokir klik kanan, salin/tempel, seleksi teks, shortcut DevTools/print/screenshot, tombol back
- Watermark nama & NIS siswa di layar
- Satu akun hanya bisa aktif di satu perangkat (anti joki)
- Urutan soal & opsi diacak per siswa
- **Kunci jawaban tidak pernah dikirim ke browser siswa**; nilai dihitung di database
- Waktu ujian dihitung di server, ujian otomatis selesai saat waktu habis

## Cara Pasang

### 1. Siapkan Supabase
1. Buat project di [supabase.com](https://supabase.com).
2. Buka **SQL Editor**, tempel seluruh isi [`supabase/schema.sql`](supabase/schema.sql), lalu **Run**. File ini membuat tabel, keamanan (RLS), fungsi ujian, dan bucket storage `media`.
3. Buka **Authentication → Users → Add user**, buat akun admin (email + password, centang *Auto Confirm*). Akun pertama yang login ke `/admin` otomatis menjadi **admin**.
4. Buka **Authentication → Sign In / Providers** dan **matikan "Allow new users to sign up"**, supaya tidak ada orang lain yang bisa mendaftar sebagai admin.
5. Buka **Project Settings → API**, salin **Project URL** dan **anon public key**.

### 2. Deploy ke Vercel
1. Di [vercel.com](https://vercel.com) pilih **Add New → Project**, import repository ini.
2. Framework otomatis terdeteksi **Vite**.
3. Di **Environment Variables** isi:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon public key
4. Klik **Deploy**.

### 3. Mulai pakai
1. Buka `https://domain-anda/admin`, login admin.
2. **Pengaturan**: isi identitas sekolah dan unggah logo.
3. **Kelas & Mapel** → **Siswa** (import Excel, unduh template dulu) → **Bank Soal** → **Ujian**.
4. **Kartu Ujian**: cetak dan bagikan ke siswa.
5. Siswa membuka `https://domain-anda/` dan login dengan NIS + password.

## Peran Akun

| Peran | Akses |
|---|---|
| Admin | Semua menu: siswa, kelas & mapel, akun guru, bank soal, ujian, monitoring, kartu ujian, pengaturan |
| Guru | Bank soal mapel yang diajar, ujian hanya untuk **kelas yang diajar** pada mapel itu, monitoring & nilai ujiannya, ganti password sendiri |
| Siswa | Login NIS + password, mengerjakan ujian |

Tugas mengajar (guru → mapel → kelas) diatur admin di menu **Guru & Admin** saat menambah/mengedit akun guru. Akun guru/admin tambahan dibuat dari menu **Guru & Admin** (bukan dari dashboard Supabase). Guru login di `/admin` dengan email & password yang diberikan admin.

## Format Import Soal (Excel)

Unduh template dari tombol **Template** di halaman bank soal. Kolom:

| Kolom | Isi |
|---|---|
| `tipe` | `PG`, `MCMA`, atau `KATEGORI` |
| `pertanyaan` | Teks soal. Rumus ditulis `$\frac{1}{2}$`, gambar `![](https://url-gambar)` |
| `gambar` | (opsional) URL gambar soal |
| `opsi_a` … `opsi_e` | Opsi jawaban A sampai E (maksimal 5), atau pernyataan untuk tipe KATEGORI |
| `kunci` | PG: `A` · MCMA: `A,C,E` · KATEGORI: `B,S,B` atau `Sesuai,Tidak Sesuai` (urut sesuai pernyataan) |
| `label` | Khusus KATEGORI: `Benar/Salah` atau `Sesuai/Tidak Sesuai` |
| `bobot` | Bobot nilai (default 1) |

## Penilaian
- Nilai = (jumlah skor × bobot) / total bobot × 100.
- MCMA & Kategori: benar penuh bila semua tepat. Jika **Skor parsial** diaktifkan pada ujian, MCMA mendapat (benar − salah) / jumlah kunci dan Kategori mendapat proporsi pernyataan yang benar.
- Jika kunci soal diubah setelah ujian, klik **Hitung Ulang** di halaman Monitoring.

## Pengembangan Lokal
```bash
npm install
cp .env.example .env   # isi URL & anon key
npm run dev
```

## Catatan Keamanan
- Siswa tidak memiliki akses langsung ke tabel. Semua aksi siswa melewati fungsi database (`siswa_*`) yang memeriksa token sesi.
- Hanya akun yang terdaftar di tabel `pengguna` yang bisa masuk panel. Tetap matikan pendaftaran publik (langkah 1.4).
- Browser tidak bisa sepenuhnya mencegah kecurangan (misalnya HP kedua). Untuk pengamanan maksimal gunakan bersama aplikasi exam browser / pengawasan ruang.
