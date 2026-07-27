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
  const headers = [
    'No.', 'Materi', 'I/O', 'Inst/Ast', 'Asst by', 'Date Start', 'Date End',
    'Teaching Hours', 'Total Hours', 'Participant', 'Feedback', 'Fdback fee', 'Instansi'
  ];

  sheet.getRow(HEADER_ROW).values = headers;
  sheet.getRow(HEADER_ROW).height = 13;
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

    row.height = 62.5;
    for (let col = 1; col <= headers.length; col++) {
      const cell = sheet.getCell(r, col);
      cell.font = ARIAL;
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
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
    sheet.getRow(r).height = 13;
    for (let col = 2; col <= 12; col++) {
      const cell = sheet.getCell(r, col);
      cell.font = ARIAL_BOLD;
      cell.border = THIN_BORDER;
      if (col === 9) cell.alignment = { vertical: 'middle', horizontal: 'center' };
      if (col === 12) cell.numFmt = CURRENCY_FMT;
      if (r === grandRow) cell.fill = GREEN;
    }
    sheet.getCell(r, 2).alignment = { vertical: 'middle', horizontal: 'center' };
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
   * Lebar kolom, disalin dari berkas rujukan
   * ------------------------------------------------------------------ */
  const widths = [4.18, 15.18, 3.82, 7.45, 7.45, 9.63, 9.63, 14.82, 11.36, 10.45, 10, 11.18, 10.45];
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

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
