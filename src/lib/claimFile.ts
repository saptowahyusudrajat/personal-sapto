/**
 * Penamaan berkas klaim. Sengaja dipisah dari excelGenerator.ts yang menarik
 * pustaka ExcelJS: berkas ini juga dipakai di sisi browser, dan ExcelJS tidak
 * boleh ikut terbawa ke bundel halaman.
 */

export const MONTHS_FULL = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/** Singkatan bulan sesuai penamaan berkas di folder REKAP MENGAJAR. */
export const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

/**
 * Mengikuti pola arsip yang sudah dipakai selama ini:
 *   "SSW Klaim Mengajar Instruktur - Jun2026.xlsx"
 * Memakai singkatan tiga huruf tanpa spasi, bukan nama bulan penuh.
 */
export function claimFileName(monthYear: string): string {
  const [monthName, year] = monthYear.split(' ');
  const index = MONTHS_FULL.indexOf(monthName);
  const short = index >= 0 ? MONTHS_SHORT[index] : monthName.slice(0, 3);
  return `SSW Klaim Mengajar Instruktur - ${short}${year}.xlsx`;
}

/** "Surabaya, 27 Juli 2026" memakai tanggal saat berkas dibuat. */
export function signatureLine(date: Date): string {
  return `Surabaya, ${date.getDate()} ${MONTHS_FULL[date.getMonth()]} ${date.getFullYear()}`;
}
