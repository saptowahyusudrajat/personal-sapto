/**
 * Mengubah teks "Periode" pada feedback INIXINDO menjadi tanggal mulai & selesai.
 *
 * Format yang didukung:
 *   "21 - 23 Juli 2026"                  -> 2026-07-21 .. 2026-07-23
 *   "30 Juli - 2 Agustus 2026"           -> 2026-07-30 .. 2026-08-02
 *   "30 Desember 2025 - 2 Januari 2026"  -> 2025-12-30 .. 2026-01-02
 *   "5 Agustus 2026"                     -> 2026-08-05 .. 2026-08-05
 *   "21 s/d 23 Juli 2026"                -> sama seperti pemisah "-"
 */

const MONTH_MAP: { [key: string]: number } = {
  januari: 1, februari: 2, pebruari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, nopember: 11,
  desember: 12,
  // Singkatan yang kadang dipakai di dokumen feedback
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, agu: 8, ags: 8,
  sep: 9, sept: 9, okt: 10, nov: 11, des: 12
};

export interface ParsedPeriode {
  dateStart: string; // yyyy-mm-dd
  dateEnd: string;   // yyyy-mm-dd
}

function monthNumber(name: string): number | null {
  return MONTH_MAP[name.toLowerCase().replace(/\./g, '')] ?? null;
}

function toIso(year: number, month: number, day: number): string | null {
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  // Tolak tanggal yang tidak ada di kalender, misal 31 April
  const d = new Date(`${iso}T00:00:00`);
  if (d.getFullYear() !== year || d.getMonth() + 1 !== month || d.getDate() !== day) {
    return null;
  }
  return iso;
}

/** Mengembalikan null bila teks periode tidak dikenali, supaya pemanggil bisa memberi peringatan. */
export function parsePeriode(periode: string): ParsedPeriode | null {
  if (!periode) return null;

  // Normalkan pemisah rentang (en dash, em dash, "s/d", "sd", "sampai") menjadi "-"
  const text = periode
    .replace(/[‐-―−]/g, '-') // en dash, em dash, minus, dll.
    .replace(/\s+(s\.?\/?d\.?|sampai(?:\s+dengan)?|hingga)\s+/gi, ' - ')
    .replace(/\s+/g, ' ')
    .trim();

  const DAY = '(\\d{1,2})';
  const MONTH = '([A-Za-z]+\\.?)';
  const YEAR = '(\\d{4})';

  // 1. Rentang penuh dengan dua tahun: "30 Desember 2025 - 2 Januari 2026"
  const full = text.match(
    new RegExp(`^${DAY}\\s+${MONTH}\\s+${YEAR}\\s*-\\s*${DAY}\\s+${MONTH}\\s+${YEAR}$`, 'i')
  );
  if (full) {
    const [, d1, m1, y1, d2, m2, y2] = full;
    const startMonth = monthNumber(m1);
    const endMonth = monthNumber(m2);
    if (startMonth && endMonth) {
      const dateStart = toIso(Number(y1), startMonth, Number(d1));
      const dateEnd = toIso(Number(y2), endMonth, Number(d2));
      if (dateStart && dateEnd) return { dateStart, dateEnd };
    }
    return null;
  }

  // 2. Rentang lintas bulan, satu tahun: "30 Juli - 2 Agustus 2026"
  const crossMonth = text.match(
    new RegExp(`^${DAY}\\s+${MONTH}\\s*-\\s*${DAY}\\s+${MONTH}\\s+${YEAR}$`, 'i')
  );
  if (crossMonth) {
    const [, d1, m1, d2, m2, year] = crossMonth;
    const startMonth = monthNumber(m1);
    const endMonth = monthNumber(m2);
    if (startMonth && endMonth) {
      // Bila bulan akhir lebih kecil dari bulan awal, periode menyeberang tahun
      // ("30 Desember - 2 Januari 2026" berarti mulai Desember tahun sebelumnya).
      const endYear = Number(year);
      const startYear = endMonth < startMonth ? endYear - 1 : endYear;
      const dateStart = toIso(startYear, startMonth, Number(d1));
      const dateEnd = toIso(endYear, endMonth, Number(d2));
      if (dateStart && dateEnd) return { dateStart, dateEnd };
    }
    return null;
  }

  // 3. Rentang dalam bulan yang sama: "21 - 23 Juli 2026"
  const sameMonth = text.match(
    new RegExp(`^${DAY}\\s*-\\s*${DAY}\\s+${MONTH}\\s+${YEAR}$`, 'i')
  );
  if (sameMonth) {
    const [, d1, d2, m, year] = sameMonth;
    const month = monthNumber(m);
    if (month) {
      const dateStart = toIso(Number(year), month, Number(d1));
      const dateEnd = toIso(Number(year), month, Number(d2));
      if (dateStart && dateEnd) return { dateStart, dateEnd };
    }
    return null;
  }

  // 4. Satu hari: "5 Agustus 2026"
  const singleDay = text.match(new RegExp(`^${DAY}\\s+${MONTH}\\s+${YEAR}$`, 'i'));
  if (singleDay) {
    const [, d, m, year] = singleDay;
    const month = monthNumber(m);
    if (month) {
      const iso = toIso(Number(year), month, Number(d));
      if (iso) return { dateStart: iso, dateEnd: iso };
    }
  }

  return null;
}

/** Menghitung jumlah hari kelas (inklusif) dari sepasang tanggal ISO. */
export function countDays(dateStart: string, dateEnd: string): number {
  const start = new Date(`${dateStart}T00:00:00`);
  const end = new Date(`${dateEnd}T00:00:00`);
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
  return diff >= 0 ? diff + 1 : 0;
}
