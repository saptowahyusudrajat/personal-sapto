========================================================================
             SAPTO TEACHING PORTAL - SETUP & DEPLOYMENT GUIDE
========================================================================

Dokumen ini berisi panduan lengkap untuk:
1. Menjalankan Aplikasi di Komputer Lokal (Local Run)
2. Impor Data Awal dari CSV ke Supabase
3. Mengatasi Masalah Dashboard Kosong (Supabase Row-Level Security)
4. Upload Project ke GitHub
5. Deploy Aplikasi ke Vercel (Produksi)

------------------------------------------------------------------------
1. CARA MENJALANKAN SECARA LOKAL (LOCAL RUN)
------------------------------------------------------------------------
Prasyarat: Pastikan komputer Anda sudah terinstal Node.js (versi 18 atau lebih baru).

Langkah-langkah:
A. Masuk ke direktori aplikasi melalui Terminal / Command Prompt:
   cd sapto-teaching-portal

B. Instal seluruh dependensi aplikasi (node_modules):
   npm install

C. Konfigurasi Environment Variables:
   Pastikan file ".env.local" di dalam folder "sapto-teaching-portal" 
   sudah terisi dengan kredensial Supabase Anda:
   ------------------------------------------------------------------
   NEXT_PUBLIC_SUPABASE_URL=https://sjyadusqdqjopkvektbr.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5c...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5c...
   ------------------------------------------------------------------

D. Jalankan Server Development:
   npm run dev

E. Akses Aplikasi di Browser:
   Buka alamat berikut di browser Anda:
   👉 http://localhost:3000

------------------------------------------------------------------------
2. IMPOR DATA AWAL DARI CSV KE SUPABASE
------------------------------------------------------------------------
Jika Anda baru pertama kali membuat database Supabase, tabel Anda akan kosong. 
Telah disediakan skrip otomatis untuk mengimpor seluruh data dari file 
"migrasi_sessions_fixed.csv" Anda langsung ke database Supabase:

A. Pastikan Anda berada di folder "sapto-teaching-portal" di terminal.
B. Jalankan skrip import dengan perintah:
   node import-csv.js
C. Skrip akan otomatis mengimpor 35 baris data sesi mengajar yang valid.

------------------------------------------------------------------------
3. LOGIN & KEAMANAN DATA (SUPABASE AUTH + ROW-LEVEL SECURITY / RLS)
------------------------------------------------------------------------
Portal ini memuat data honor dan klaim mengajar Anda. Karena aplikasi
di-deploy ke internet (Vercel), seluruh halaman kini dilindungi login.
Tanpa login, aplikasi akan otomatis mengalihkan Anda ke halaman /login.

3.1 MEMBUAT AKUN LOGIN ANDA
A. Buka dashboard Supabase: https://supabase.com/dashboard
B. Pilih proyek database Anda.
C. Masuk ke menu "Authentication" -> "Users" -> klik "Add user"
   -> "Create new user".
D. Isi Email dan Password yang akan Anda pakai untuk masuk ke portal.
E. Centang "Auto Confirm User" agar akun langsung aktif tanpa verifikasi email.

CATATAN NAMA INSTRUKTUR PADA BERKAS EXCEL
Modal "Create new user" TIDAK menyediakan kolom User Metadata, jadi jangan
dicari di sana. Nama instruktur diambil berurutan dari:
   1) metadata "full_name" pada akun Supabase
   2) variabel INSTRUCTOR_NAME (sudah diisi di .env.local)
   3) nilai bawaan di dalam kode
Karena nomor 2 sudah terisi, Anda TIDAK perlu melakukan apa pun. Berkas Excel
akan tetap mencantumkan nama yang benar.

Bila tetap ingin menyimpannya di metadata akun, jalankan SQL ini sekalian
saat mengerjakan bagian 3.2 (ganti email sesuai akun Anda):

   UPDATE auth.users
   SET raw_user_meta_data =
         COALESCE(raw_user_meta_data, '{}'::jsonb)
         || '{"full_name":"Sapto Wahyu Sudrajat"}'::jsonb
   WHERE email = 'email-anda@contoh.com';

3.2 MENGAKTIFKAN RLS (WAJIB - JANGAN DIMATIKAN)
Dengan RLS aktif, data hanya bisa dibaca/diubah oleh akun yang sudah login.
Jalankan SQL berikut lewat menu "SQL Editor" -> "New Query" -> "Run":

   -- Aktifkan RLS pada kedua tabel
   ALTER TABLE public.sessions  ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

   -- Hapus policy lama yang terlanjur membuka akses untuk publik/anonim
   DROP POLICY IF EXISTS "Allow public read access on sessions"    ON public.sessions;
   DROP POLICY IF EXISTS "Allow public insert access on sessions"  ON public.sessions;
   DROP POLICY IF EXISTS "Allow public read access on feedbacks"   ON public.feedbacks;
   DROP POLICY IF EXISTS "Allow public insert access on feedbacks" ON public.feedbacks;

   -- Beri akses penuh HANYA untuk pengguna yang sudah login
   CREATE POLICY "Authenticated full access on sessions"
     ON public.sessions FOR ALL
     TO authenticated USING (true) WITH CHECK (true);

   CREATE POLICY "Authenticated full access on feedbacks"
     ON public.feedbacks FOR ALL
     TO authenticated USING (true) WITH CHECK (true);

   -- (OPSIONAL) Hapus feedback otomatis saat sesinya dihapus.
   -- Aplikasi sudah menghapus feedback lebih dulu, jadi ini hanya pengaman
   -- tambahan. Blok DO di bawah mencari nama constraint yang sebenarnya,
   -- supaya tidak tercipta foreign key ganda bila namanya berbeda.
   DO $$
   DECLARE nama_constraint text;
   BEGIN
     SELECT conname INTO nama_constraint
       FROM pg_constraint
      WHERE conrelid = 'public.feedbacks'::regclass
        AND contype  = 'f'
        AND conkey   = ARRAY[(SELECT attnum FROM pg_attribute
                               WHERE attrelid = 'public.feedbacks'::regclass
                                 AND attname  = 'session_id')];
     IF nama_constraint IS NOT NULL THEN
       EXECUTE format('ALTER TABLE public.feedbacks DROP CONSTRAINT %I', nama_constraint);
     END IF;
   END $$;

   ALTER TABLE public.feedbacks
     ADD CONSTRAINT feedbacks_session_id_fkey
     FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;

3.3 KALAU DASHBOARD MASIH KOSONG SETELAH LOGIN
- Pastikan Anda benar-benar sudah masuk (nama menu "Keluar" muncul di kanan atas).
- Pastikan kedua policy di atas sudah dibuat (menu "Authentication" -> "Policies").
- Perhatikan: skrip "node import-csv.js" memakai SERVICE_ROLE_KEY sehingga tetap
  bisa menulis data walaupun RLS aktif. Ini normal dan aman selama berkas
  .env.local tidak pernah diunggah ke GitHub.

------------------------------------------------------------------------
3B. ATURAN PERHITUNGAN FEE YANG DIPAKAI APLIKASI
------------------------------------------------------------------------
Seluruh aturan di bawah ini terkumpul di satu berkas:
src/lib/feeCalculator.ts

A. Feedback fee
   Nilai instruktur >= 3.3 mendapat Rp 75.000 per sesi. Di bawah itu, Rp 0.

B. Mandatory 50 jam & Extra Jam Fee
   Batas minimal 50 jam mengajar berlaku PER BULAN. Jam di atas 50 dibayar
   Rp 35.000 per jam. Contoh: bulan dengan 63 jam -> extra 13 jam
   -> 13 x 35.000 = Rp 455.000.

C. Kelas Out (luar kota)
   Total Hours = Jam Tatap Muka x 1.3. Nilai inilah yang dipakai untuk
   menghitung batas 50 jam.

D. KELAS LINTAS BULAN  <-- PENTING
   Sesi diklaim PENUH pada bulan TANGGAL MULAI-nya, tidak dipecah.
   Contoh: kelas 29 Januari - 2 Februari dengan 30 jam, seluruh 30 jam
   masuk klaim JANUARI; klaim Februari tidak menerima jam dari kelas ini.
   Aturan ini dipakai konsisten di tiga tempat: dashboard, pratinjau klaim,
   dan berkas Excel yang diunduh.

   Karena batas 50 jam berlaku per bulan, penempatan ini memengaruhi
   besarnya Extra Jam Fee. Jika suatu saat INIXINDO meminta jam dipecah
   menurut hari mengajar di tiap bulan, yang perlu diubah adalah
   penyaringan date_start pada:
     - src/app/api/claim/download/route.ts
     - src/app/claim/page.tsx
     - calculateClaimSummaryByMonth() di src/lib/feeCalculator.ts

   Cara manual sementara bila ingin memecah: input sebagai dua sesi
   terpisah (29-31 Januari dan 1-2 Februari) dengan jam masing-masing.

------------------------------------------------------------------------
4. CARA DEPLOY / UPLOAD KE GITHUB
------------------------------------------------------------------------
Langkah untuk mengunggah kode sumber aplikasi Anda ke repositori GitHub pribadi:

A. Pastikan Anda berada di dalam folder proyek utama ("sapto-teaching-portal").
B. Inisialisasi Git Lokal (jika belum pernah dilakukan):
   git init

C. Buat berkas ".gitignore" (sudah otomatis dibuatkan) agar folder 
   node_modules, .next, dan .env.local tidak ikut terunggah ke internet:
   Pastikan .env.local tercantum di dalam .gitignore! JANGAN PERNAH
   mengunggah file .env.local ke repositori publik demi keamanan database.

D. Ambil snapshot seluruh file dan lakukan commit awal:
   git add .
   git commit -m "Initial commit - Sapto Teaching Portal"

E. Hubungkan ke repositori GitHub Anda:
   - Masuk ke akun GitHub Anda di browser, lalu klik "New Repository".
   - Beri nama repositori (contoh: "sapto-teaching-portal").
   - Biarkan repositori KOSONG (jangan centang opsi README, .gitignore, atau license).
   - Klik "Create Repository".
   - Salin URL repositori yang muncul (contoh: https://github.com/username/sapto-teaching-portal.git).

F. Sambungkan Git lokal ke repositori GitHub online:
   git remote add origin https://github.com/username/sapto-teaching-portal.git
   git branch -M main

G. Unggah (push) file ke GitHub:
   git push -u origin main

------------------------------------------------------------------------
5. CARA DEPLOY KE VERCEL (PRODUKSI ONLINE)
------------------------------------------------------------------------
Vercel adalah platform terbaik untuk menghosting aplikasi Next.js secara gratis, cepat, dan otomatis.

Langkah-langkah:
A. Daftarkan Akun di Vercel:
   - Buka https://vercel.com
   - Daftarkan diri Anda (Sangat disarankan mendaftar menggunakan akun GitHub Anda).

B. Hubungkan Repositori GitHub ke Vercel:
   - Di dashboard Vercel, klik tombol "Add New..." lalu pilih "Project".
   - Jika baru pertama kali, Anda akan diminta untuk menghubungkan akun GitHub Anda.
   - Pilih repositori "sapto-teaching-portal" dari daftar repositori GitHub yang muncul, lalu klik "Import".

C. Konfigurasi Project Settings & Environment Variables (SANGAT PENTING!):
   Sebelum mengklik tombol "Deploy", cari bagian "Environment Variables" 
   pada halaman pengaturan tersebut. Tambahkan 3 variabel dari file 
   .env.local agar aplikasi produksi dapat berkomunikasi dengan Supabase:

   - Variable 1:
     Key:   NEXT_PUBLIC_SUPABASE_URL
     Value: https://sjyadusqdqjopkvektbr.supabase.co
     (Klik "Add")

   - Variable 2:
     Key:   NEXT_PUBLIC_SUPABASE_ANON_KEY
     Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ...
     (Klik "Add")

   - Variable 3:
     Key:   SUPABASE_SERVICE_ROLE_KEY
     Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ...
     (Klik "Add")

   - Variable 4 (OPSIONAL):
     Key:   INSTRUCTOR_NAME
     Value: Sapto Wahyu Sudrajat
     Dipakai sebagai nama instruktur di berkas Excel klaim bila akun Supabase
     Anda belum diisi metadata "full_name" (lihat bagian 3.1 poin F).

D. Jalankan Deployment:
   - Klik tombol "Deploy".
   - Tunggu sekitar 1-2 menit hingga proses build selesai.
   - Vercel akan memberikan Anda URL gratis yang aktif (contoh: https://sapto-teaching-portal.vercel.app).
   - Selamat! Aplikasi Anda kini sudah online dan bisa diakses dari mana saja!

E. Pembaruan Otomatis (CI/CD):
   Setiap kali Anda mengubah kode di komputer lokal Anda, Anda cukup melakukan:
   git add .
   git commit -m "deskripsi perubahan"
   git push origin main
   Vercel akan mendeteksi perubahan tersebut di GitHub dan melakukan build ulang secara otomatis dalam hitungan detik!

========================================================================
                         ~ SELAMAT MENCOBA ~
========================================================================
