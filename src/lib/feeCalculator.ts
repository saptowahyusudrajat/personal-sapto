/**
 * Aturan klaim mengajar INIXINDO Surabaya:
 * 1. Feedback >= 3.3 dapat Feedback fee 75.000 per sesi.
 * 2. Md Hours (minimal jam mengajar) = 50 jam per bulan. Kelebihannya (Ext. hours)
 *    dibayar per jam sebesar Teaching Fee.
 */
export const MANDATORY_HOURS = 50;
/**
 * Tarif per jam untuk kelebihan jam mengajar, jenjang Junior.
 * Sesuai sheet "Instruktur dan Asisten" pada arsip klaim:
 *   Junior : JamLebih * 30.000
 *   Senior : JamLebih * 50.000
 * Ganti ke 50000 bila jenjang naik ke Senior (masa kerja di atas 2 tahun).
 */
export const EXTRA_HOUR_RATE = 30000;
export const FEEDBACK_FEE = 75000;
export const FEEDBACK_MIN_SCORE = 3.3;

/**
 * Perkiraan jam mengajar per hari kelas, dipakai untuk mengisi otomatis
 * kolom Jam Mengajar dari rentang tanggal.
 *
 * Ini DUGAAN AWAL, bukan aturan pasti. Dari 40 sesi yang sudah tercatat,
 * 23 sesi (57%) memang 5 jam per hari, sisanya bervariasi: sejumlah kelas
 * 6 jam per hari dan kelas MOS sampai 8 jam per hari. Karena itu nilainya
 * selalu bisa ditimpa manual di formulir.
 */
export const HOURS_PER_DAY = 5;

/** Feedback fee per sesi: penuh bila nilai instruktur mencapai ambang, 0 bila tidak. */
export function calculateFeedbackFee(score: number | string | null): number {
  return Number(score || 0) >= FEEDBACK_MIN_SCORE ? FEEDBACK_FEE : 0;
}

export interface FeeInput {
  total_hours: number | string | null;
  feedback_fee: number | string | null;
}

export interface ClaimSummary {
  /** Total jam mengajar (sudah termasuk pengali 1.3 untuk kelas Out) */
  totalHours: number;
  /** Batas minimum jam mengajar per bulan */
  mandatoryHours: number;
  /** Jam di atas mandatory, 0 jika belum melewati batas */
  extraHours: number;
  /** Tarif per jam untuk kelebihan jam */
  extraHourRate: number;
  /** extraHours x extraHourRate */
  extraHoursFee: number;
  /** Akumulasi feedback fee dari seluruh sesi */
  totalFeedbackFee: number;
  /** Feedback fee + extra jam fee */
  grandTotalFee: number;
}

/** Membulatkan jam ke 1 desimal agar konsisten dengan tampilan dan Excel. */
function roundHours(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Menghitung ringkasan klaim untuk satu periode (satu bulan). */
export function calculateClaimSummary(sessions: FeeInput[]): ClaimSummary {
  const totalHours = roundHours(
    sessions.reduce((acc, curr) => acc + Number(curr.total_hours || 0), 0)
  );
  const totalFeedbackFee = sessions.reduce(
    (acc, curr) => acc + Number(curr.feedback_fee || 0),
    0
  );

  const extraHours =
    totalHours > MANDATORY_HOURS ? roundHours(totalHours - MANDATORY_HOURS) : 0;
  const extraHoursFee = Math.round(extraHours * EXTRA_HOUR_RATE);

  return {
    totalHours,
    mandatoryHours: MANDATORY_HOURS,
    extraHours,
    extraHourRate: EXTRA_HOUR_RATE,
    extraHoursFee,
    totalFeedbackFee,
    grandTotalFee: totalFeedbackFee + extraHoursFee
  };
}

/**
 * Menghitung ringkasan klaim untuk kumpulan sesi lintas bulan.
 * Batas mandatory 50 jam berlaku per bulan, jadi kelebihan jam dihitung
 * per bulan lalu dijumlahkan.
 *
 * Pengelompokan memakai `date_start`: sesi yang menyeberang bulan
 * (mis. 29 Januari - 2 Februari) dihitung PENUH di bulan tanggal mulainya,
 * sama seperti penyaringan pada ekspor klaim.
 */
export function calculateClaimSummaryByMonth<T extends FeeInput & { date_start: string }>(
  sessions: T[]
): ClaimSummary {
  const groups = new Map<string, T[]>();
  sessions.forEach(s => {
    const d = new Date(s.date_start);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(s);
    } else {
      groups.set(key, [s]);
    }
  });

  const monthly = Array.from(groups.values()).map(calculateClaimSummary);

  const sum = (pick: (s: ClaimSummary) => number) =>
    monthly.reduce((acc, curr) => acc + pick(curr), 0);

  return {
    totalHours: roundHours(sum(s => s.totalHours)),
    mandatoryHours: MANDATORY_HOURS,
    extraHours: roundHours(sum(s => s.extraHours)),
    extraHourRate: EXTRA_HOUR_RATE,
    extraHoursFee: sum(s => s.extraHoursFee),
    totalFeedbackFee: sum(s => s.totalFeedbackFee),
    grandTotalFee: sum(s => s.grandTotalFee)
  };
}
