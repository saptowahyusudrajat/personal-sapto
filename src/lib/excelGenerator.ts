import ExcelJS from 'exceljs';
import {
  MANDATORY_HOURS,
  EXTRA_HOUR_RATE,
  FEEDBACK_FEE,
  FEEDBACK_MIN_SCORE
} from './feeCalculator';
import { signatureLine } from './claimFile';
export { claimFileName } from './claimFile';

export interface SessionRecord {
  materi: string;
  io_type: 'In' | 'Out';
  date_start: string;
  date_end: string;
  teaching_hours: number;
  total_hours: number;
  participant_count: number;
  feedback_score: number;
  feedback_fee: number;
  instansi: string;
}


// Format akuntansi yang dipakai berkas rujukan pada kolom rupiah
const CURRENCY_FMT = '_(* #,##0_);_(* (#,##0);_(* "-"??_);_(@_)';
const ARIAL = { name: 'Arial', size: 10 };
const ARIAL_BOLD = { name: 'Arial', size: 10, bold: true };

const THIN_BORDER: ExcelJS.Borders = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' }
} as ExcelJS.Borders;

/* -------------------------------------------------------------------------- *
 * Penyesuaian lebar kolom dan tinggi baris.
 *
 * Lebar kolom TIDAK disalin mentah dari berkas rujukan, karena di sana kolom
 * Materi hanya selebar 15 karakter sehingga judul kelas yang panjang pecah
 * menjadi banyak baris. Lebar di bawah dihitung dari isi yang sebenarnya,
 * dengan batas bawah agar judul kolom tetap muat, dan batas atas agar satu
 * kolom tidak melebar berlebihan.
 * -------------------------------------------------------------------------- */

interface ColumnSpec {
  header: string;
  min: number;
  max: number;
  wrap: boolean;
}

const COLUMN_SPECS: ColumnSpec[] = [
  { header: 'No.', min: 5, max: 6, wrap: false },
  { header: 'Materi', min: 24, max: 46, wrap: true },
  { header: 'I/O', min: 5, max: 7, wrap: false },
  { header: 'Inst/Ast', min: 9, max: 11, wrap: false },
  { header: 'Asst by', min: 8, max: 11, wrap: false },
  { header: 'Date Start', min: 11, max: 13, wrap: false },
  { header: 'Date End', min: 11, max: 13, wrap: false },
  { header: 'Teaching Hours', min: 11, max: 13, wrap: true },
  { header: 'Total Hours', min: 9, max: 12, wrap: true },
  // "Participant" satu kata dan tidak bisa dipatah, jadi kolomnya harus
  // cukup lebar untuk kata utuh. Sebelumnya terpotong jadi "Participan"/"t".
  { header: 'Participant', min: 13, max: 14, wrap: true },
  { header: 'Feedback', min: 11, max: 12, wrap: true },
  { header: 'Fdback fee', min: 12, max: 14, wrap: false },
  { header: 'Instansi', min: 18, max: 34, wrap: true }
];

/* Tinggi satu baris teks Arial 10 di Excel, ditambah sedikit ruang napas.
   Nilai 13 yang dipakai berkas rujukan ternyata memotong huruf. */
const LINE_HEIGHT = 15;
const ROW_PADDING = 3;

const rowHeightFor = (lines: number) => Math.max(18, lines * LINE_HEIGHT + ROW_PADDING);

/** Bentuk tampil tanggal pada format "d-mmm", mis. "2-Jun". Dipakai untuk
 *  memperkirakan lebar kolom, bukan untuk mengisi sel. */
function formatShortDate(value: string): string {
  const d = new Date(value);
  const short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()}-${short[d.getMonth()]}`;
}

/** Perkiraan lebar tampil sebuah nilai dalam satuan karakter. */
function displayWidth(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return String(value).length;
}

/** Jumlah baris hasil pembungkusan teks pada kolom selebar `width` karakter. */
function wrappedLineCount(text: string, width: number): number {
  if (!text) return 1;
  const usable = Math.max(4, width - 1);
  let lines = 1;
  let current = 0;
  for (const word of String(text).split(/\s+/)) {
    // Kata yang lebih panjang dari kolom akan dipotong sendiri oleh Excel
    const wordLines = Math.ceil(word.length / usable);
    if (wordLines > 1) {
      lines += wordLines - 1;
      current = word.length % usable;
      continue;
    }
    if (current === 0) {
      current = word.length;
    } else if (current + 1 + word.length <= usable) {
      current += 1 + word.length;
    } else {
      lines += 1;
      current = word.length;
    }
  }
  return lines;
}

export async function generateExcelClaim(
  monthYear: string,
  instructorName: string,
  sessions: SessionRecord[],
  exportedAt: Date = new Date()
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Template');
  const helper = workbook.addWorksheet('Instruktur dan Asisten');

  /* ------------------------------------------------------------------ *
   * Judul dan metadata (baris 1 sampai 3)
   * ------------------------------------------------------------------ */
  sheet.getCell('B1').value = 'Claim Mengajar Instruktur';
  sheet.getCell('B1').font = ARIAL_BOLD;

  sheet.getCell('B2').value = 'Bulan';
  sheet.getCell('C2').value = ':';
  sheet.getCell('D2').value = monthYear;
  sheet.getCell('B3').value = 'Instruktur';
  sheet.getCell('C3').value = ':';
  sheet.getCell('D3').value = instructorName;
  ['B2', 'C2', 'D2', 'B3', 'C3', 'D3'].forEach(ref => {
    sheet.getCell(ref).font = ARIAL;
  });

  /* ------------------------------------------------------------------ *
   * Kepala tabel (baris 5). Berkas rujukan tidak memakai warna latar,
   * hanya huruf tebal dan garis tepi.
   * ------------------------------------------------------------------ */
  const HEADER_ROW = 5;
  const headers = COLUMN_SPECS.map(spec => spec.header);

  /* Lebar kolom dihitung dari isi terpanjang di setiap kolom. Dilakukan
     sebelum baris ditulis, karena tinggi baris bergantung pada lebar ini. */
  const formattedDates = sessions.map(s => ({
    start: formatShortDate(s.date_start),
    end: formatShortDate(s.date_end)
  }));

  const contentWidths: number[][] = [
    sessions.map((_, i) => displayWidth(i + 1)),
    sessions.map(s => displayWidth(s.materi)),
    sessions.map(s => displayWidth(s.io_type)),
    sessions.map(() => displayWidth('Inst')),
    sessions.map(() => displayWidth('-')),
    formattedDates.map(d => displayWidth(d.start)),
    formattedDates.map(d => displayWidth(d.end)),
    sessions.map(s => displayWidth(s.teaching_hours)),
    sessions.map(s => displayWidth(s.total_hours)),
    sessions.map(s => displayWidth(s.participant_count)),
    sessions.map(s => displayWidth(s.feedback_score)),
    // Format akuntansi menambah tanda kurung dan jarak di kedua sisi
    sessions.map(s => displayWidth(Number(s.feedback_fee || 0).toLocaleString('id-ID')) + 4),
    sessions.map(s => displayWidth(s.instansi))
  ];

  const columnWidths = COLUMN_SPECS.map((spec, i) => {
    const longest = Math.max(0, ...contentWidths[i]);
    // Judul yang dibungkus boleh pecah antar kata, tetapi satu kata utuh tidak
    // bisa dipatah. Jadi patokannya kata terpanjang, bukan separuh panjang
    // judul, supaya tidak muncul potongan seperti "Participan" + "t".
    const longestHeaderWord = Math.max(...spec.header.split(/\s+/).map(w => w.length));
    const headerNeed = spec.wrap ? longestHeaderWord + 3 : spec.header.length + 2;
    const width = Math.min(spec.max, Math.max(spec.min, headerNeed, longest + 2));
    // ExcelJS menganggap 9 sebagai lebar bawaan dan tidak menuliskannya ke
    // berkas, sehingga kolomnya malah jatuh ke lebar default Excel (8.43).
    // Digeser sedikit supaya lebarnya benar-benar tersimpan.
    return width === 9 ? 9.5 : width;
  });

  columnWidths.forEach((width, i) => {
    sheet.getColumn(i + 1).width = width;
  });

  sheet.getRow(HEADER_ROW).values = headers;
  // Tinggi kepala tabel mengikuti judul terpanjang setelah dibungkus
  const headerLines = Math.max(
    ...COLUMN_SPECS.map((spec, i) =>
      spec.wrap ? wrappedLineCount(spec.header, columnWidths[i]) : 1
    )
  );
  sheet.getRow(HEADER_ROW).height = rowHeightFor(headerLines);
  for (let col = 1; col <= headers.length; col++) {
    const cell = sheet.getCell(HEADER_ROW, col);
    cell.font = ARIAL_BOLD;
    cell.border = THIN_BORDER;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  }

  /* ------------------------------------------------------------------ *
   * Baris data (mulai baris 6).
   * Kolom Total Hours dan Fdback fee sengaja ditulis sebagai RUMUS, sama
   * seperti berkas rujukan, supaya angkanya tetap hidup bila ada koreksi
   * manual di Excel.
   * ------------------------------------------------------------------ */
  const FIRST_DATA_ROW = 6;
  sessions.forEach((session, index) => {
    const r = FIRST_DATA_ROW + index;
    const row = sheet.getRow(r);

    row.getCell(1).value = index + 1;
    row.getCell(2).value = session.materi;
    row.getCell(3).value = session.io_type;
    row.getCell(4).value = 'Inst';
    row.getCell(5).value = '-';
    row.getCell(6).value = new Date(session.date_start);
    row.getCell(7).value = new Date(session.date_end);
    row.getCell(8).value = session.teaching_hours;
    row.getCell(9).value = {
      formula: `IFERROR(_xlfn.IFS(C${r}="In",H${r}*1,C${r}="Out",H${r}*1.3),0)`
    };
    row.getCell(10).value = session.participant_count;
    row.getCell(11).value = session.feedback_score;
    row.getCell(12).value = {
      formula: `IF(K${r}>=${FEEDBACK_MIN_SCORE},${FEEDBACK_FEE},0)`
    };
    row.getCell(13).value = session.instansi;

    // Tinggi baris mengikuti kolom yang isinya paling banyak terbungkus.
    // Sebelumnya dipaku 62.5 untuk semua baris, sehingga judul pendek pun
    // menyisakan ruang kosong yang lebar.
    const lines = Math.max(
      wrappedLineCount(session.materi, columnWidths[1]),
      wrappedLineCount(session.instansi, columnWidths[12])
    );
    row.height = rowHeightFor(lines);

    for (let col = 1; col <= headers.length; col++) {
      const cell = sheet.getCell(r, col);
      cell.font = ARIAL;
      cell.border = THIN_BORDER;
      cell.alignment = {
        vertical: 'middle',
        // Teks panjang lebih terbaca rata kiri; angka dan kode tetap di tengah
        horizontal: col === 2 || col === 13 ? 'left' : 'center',
        wrapText: COLUMN_SPECS[col - 1].wrap
      };
      if (col === 6 || col === 7) cell.numFmt = 'd-mmm';
      if (col === 12) cell.numFmt = CURRENCY_FMT;
    }
  });

  const lastDataRow = FIRST_DATA_ROW + sessions.length - 1;

  /* ------------------------------------------------------------------ *
   * Ringkasan. Berkas rujukan menyisakan satu baris kosong setelah data,
   * lalu empat baris ringkasan dengan label yang digabung dari B sampai H.
   * ------------------------------------------------------------------ */
  const totalRow = lastDataRow + 2;
  const mandatoryRow = totalRow + 1;
  const extraRow = totalRow + 2;
  const grandRow = totalRow + 3;

  sheet.mergeCells(`B${totalRow}:H${totalRow}`);
  sheet.mergeCells(`B${mandatoryRow}:H${mandatoryRow}`);
  sheet.mergeCells(`B${extraRow}:H${extraRow}`);
  sheet.mergeCells(`B${grandRow}:K${grandRow}`);

  sheet.getCell(`B${totalRow}`).value = 'Total Jam Mengajar';
  sheet.getCell(`I${totalRow}`).value = { formula: `SUM(I${FIRST_DATA_ROW}:I${lastDataRow})` };
  sheet.getCell(`L${totalRow}`).value = { formula: `SUM(L${FIRST_DATA_ROW}:L${lastDataRow})` };

  sheet.getCell(`B${mandatoryRow}`).value = 'Mandatory';
  sheet.getCell(`I${mandatoryRow}`).value = MANDATORY_HOURS;

  sheet.getCell(`B${extraRow}`).value = 'Extra Jam Mengajar';
  sheet.getCell(`I${extraRow}`).value = {
    formula: `IF(I${totalRow}<=${MANDATORY_HOURS},0,(I${totalRow}-I${mandatoryRow}))`
  };
  sheet.getCell(`L${extraRow}`).value = { formula: `I${extraRow}*${EXTRA_HOUR_RATE}` };

  sheet.getCell(`B${grandRow}`).value = 'GRAND TOTAL';
  sheet.getCell(`L${grandRow}`).value = {
    formula: `SUM(L${totalRow}:L${extraRow})`
  };

  // Baris GRAND TOTAL diberi latar hijau, sama seperti berkas rujukan
  const GREEN: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF92D050' }
  };

  [totalRow, mandatoryRow, extraRow, grandRow].forEach(r => {
    // Tinggi 13 pada berkas rujukan memotong huruf pada label maupun angkanya
    sheet.getRow(r).height = rowHeightFor(1);
    for (let col = 2; col <= 12; col++) {
      const cell = sheet.getCell(r, col);
      cell.font = ARIAL_BOLD;
      cell.border = THIN_BORDER;
      if (col === 9) cell.alignment = { vertical: 'middle', horizontal: 'center' };
      if (col === 12) cell.numFmt = CURRENCY_FMT;
      if (r === grandRow) cell.fill = GREEN;
    }
    // Sesuai berkas rujukan: hanya GRAND TOTAL yang rata tengah, label
    // lainnya rata kiri agar tidak mengambang di tengah rentang gabungan.
    sheet.getCell(r, 2).alignment = {
      vertical: 'middle',
      horizontal: r === grandRow ? 'center' : 'left'
    };
  });

  /* ------------------------------------------------------------------ *
   * Tanda tangan. Tanggalnya adalah hari berkas ini dibuat, bukan bulan
   * klaimnya, mengikuti kebiasaan pada arsip.
   * ------------------------------------------------------------------ */
  const signRow = totalRow + 5;
  const nameRow = totalRow + 11;

  sheet.getCell(`K${signRow}`).value = signatureLine(exportedAt);
  sheet.getCell(`K${signRow}`).font = ARIAL;
  sheet.getCell(`K${signRow}`).alignment = { horizontal: 'center' };

  // Nama mengacu ke sel metadata, persis seperti berkas rujukan
  sheet.getCell(`K${nameRow}`).value = { formula: 'D3' };
  sheet.getCell(`K${nameRow}`).font = ARIAL_BOLD;
  sheet.getCell(`K${nameRow}`).alignment = { horizontal: 'center' };

  /* ------------------------------------------------------------------ *
   * Catatan kaki
   * ------------------------------------------------------------------ */
  const notesRow = totalRow + 12;
  sheet.getCell(`B${notesRow}`).value = 'Catatan:';
  sheet.getCell(`B${notesRow}`).font = ARIAL;

  const notes = [
    '1. Tentang I/O',
    '    * I: In, mengajar tidak menginap',
    '   * O: Out, mengajar menginap (luar kota), Total Hours x 1.3',
    `2. Feedback >=${FEEDBACK_MIN_SCORE} dapat Feedback fee ${FEEDBACK_FEE.toLocaleString('id-ID')}, berlaku u/ tiap sesi (misal: DBMS Fundamen 1 feedback, DBMS Admin 1 feedback)`,
    `3. Md Hours (minimal jam mengajar) = ${MANDATORY_HOURS} jam mengajar. Lebih dari itu (Ext. hours) dapat fee per jam (Teach. Fee)`,
    '4. Tentang instruktur sebagai asisten instruktur lain, ada di worksheet "Instruktur dan Asisten"'
  ];
  notes.forEach((note, i) => {
    const cell = sheet.getCell(`B${notesRow + 1 + i}`);
    cell.value = note;
    cell.font = ARIAL;
  });

  /* ------------------------------------------------------------------ *
   * Lebar kolom sudah ditetapkan di atas, dihitung dari isi tabel.
   * ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------ *
   * Lembar kedua: aturan jenjang dan pembagian fee, sesuai arsip
   * ------------------------------------------------------------------ */
  const helperLines = [
    '1. Jenjang jabatan instruktur',
    'i. Yunior : 0 sd 2 tahun',
    'ii. Senior : > 2 tahun',
    '',
    'Perpindahan jenjang harus dapat sertifikasi internasional, misal CCNA, OCA atau yang lain.',
    '',
    '2. Rumus claim ngajar ',
    'i. Tanpa memperhatikan jumlah peserta',
    `ii. Minimal ngajar ${MANDATORY_HOURS} jam`,
    `iii. Lebih dari ${MANDATORY_HOURS} jam, rumus yang digunakan :`,
    '     a. Junior : JamLebih * 30.000',
    '     b. Senior : JamLebih * 50.000',
    '',
    '3. Instruktur dan Asisten',
    'i. Bila instruktur meng-asisteni instruktur (peserta > 10)',
    '   a. Jam ngajar keduanya dihitung sama (dianggap sama-sama ngajar)',
    `   b. Bila claim ( > ${MANDATORY_HOURS} jam) :`,
    '       * untuk instruktur (yang mengajar di depan): fee mengajar 100%',
    '       * untuk asisten (instruktur yang membantu): fee mengajar 75%',
    '   c. Sama-sama dapat fee feedback 100%',
    '   d. Di lembar claim, ditulis di kolom "Inst/Ast" sebagai Inst ataukah Ast'
  ];
  helperLines.forEach((line, i) => {
    const cell = helper.getCell(`A${i + 1}`);
    cell.value = line;
    cell.font = ARIAL;
  });
  helper.getColumn(1).width = 80;

  return workbook.xlsx.writeBuffer();
}
