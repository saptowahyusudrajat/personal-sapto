import ExcelJS from 'exceljs';
import {
  MANDATORY_HOURS,
  EXTRA_HOUR_RATE,
  FEEDBACK_FEE,
  FEEDBACK_MIN_SCORE
} from './feeCalculator';

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

export async function generateExcelClaim(
  monthYear: string,
  instructorName: string,
  sessions: SessionRecord[]
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  
  // Create worksheets
  const templateSheet = workbook.addWorksheet('Template');
  const helperSheet = workbook.addWorksheet('Instruktur dan Asisten');

  // Helper Sheet Static Content
  helperSheet.columns = [{ header: '1. Jenjang jabatan instruktur', key: 'jenjang', width: 60 }];
  helperSheet.addRows([
    ['i. Yunior : 0 sd 2 tahun'],
    ['ii. Senior : > 2 tahun'],
    [''],
    ['Perpindahan jenjang harus dapat sertifikasi internasional, misal CCNA, OCA atau yang lain.'],
  ]);

  // Main Template Sheet Design
  templateSheet.views = [{ showGridLines: true }];

  // Metadata rows
  templateSheet.getCell('B1').value = 'Bulan';
  templateSheet.getCell('C1').value = ':';
  templateSheet.getCell('D1').value = monthYear;
  templateSheet.getCell('B2').value = 'Instruktur';
  templateSheet.getCell('C2').value = ':';
  templateSheet.getCell('D2').value = instructorName;

  // Metadata styling
  ['B1', 'B2', 'C1', 'C2'].forEach(cellId => {
    const cell = templateSheet.getCell(cellId);
    cell.font = { name: 'Arial', size: 10, bold: true };
  });
  ['D1', 'D2'].forEach(cellId => {
    const cell = templateSheet.getCell(cellId);
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1B365D' } };
  });

  // Table Headers at Row 4
  const headers = [
    'No.',
    'Materi',
    'I/O',
    'Inst/Ast',
    'Asst by',
    'Date Start',
    'Date End',
    'Teaching Hours',
    'Total Hours',
    'Participant',
    'Feedback',
    'Fdback fee',
    'Instansi'
  ];

  templateSheet.getRow(4).values = headers;
  templateSheet.getRow(4).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  templateSheet.getRow(4).height = 25;

  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4E78' } // Indigo Blue
  };

  for (let colIdx = 1; colIdx <= headers.length; colIdx++) {
    const cell = templateSheet.getCell(4, colIdx);
    cell.fill = headerFill;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'medium' },
      right: { style: 'thin' }
    };
  }

  // Populate teaching data rows starting from row 5
  const currentRawRow = 5;
  sessions.forEach((session, index) => {
    const rowNum = currentRawRow + index;
    const values = [
      index + 1,
      session.materi,
      session.io_type,
      'Inst',
      '-',
      new Date(session.date_start),
      new Date(session.date_end),
      session.teaching_hours,
      session.total_hours,
      session.participant_count,
      session.feedback_score,
      session.feedback_fee,
      session.instansi
    ];

    const row = templateSheet.getRow(rowNum);
    row.values = values;
    row.height = 22;
    row.font = { name: 'Arial', size: 9 };

    // Row borders and alignments
    for (let colIdx = 1; colIdx <= headers.length; colIdx++) {
      const cell = templateSheet.getCell(rowNum, colIdx);
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };

      // Alignment and formats
      if ([1, 3, 4, 5, 6, 7].includes(colIdx)) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if ([8, 9, 10, 11, 12].includes(colIdx)) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }

      // Number formatting
      if (colIdx === 6 || colIdx === 7) {
        cell.numFmt = 'yyyy-mm-dd';
      } else if (colIdx === 8 || colIdx === 9) {
        cell.numFmt = '0.0';
      } else if (colIdx === 10) {
        cell.numFmt = '#,##0';
      } else if (colIdx === 11) {
        cell.numFmt = '0.00';
      } else if (colIdx === 12) {
        cell.numFmt = '"Rp" #,##0';
      }
    }
  });

  const totalSessionsCount = sessions.length;
  const footerStartRow = 5 + totalSessionsCount;

  // Total Jam Mengajar Row
  templateSheet.getCell(`B${footerStartRow}`).value = 'Total Jam Mengajar';
  templateSheet.getCell(`I${footerStartRow}`).value = { formula: `=SUM(I5:I${footerStartRow - 1})` };
  templateSheet.getCell(`L${footerStartRow}`).value = { formula: `=SUM(L5:L${footerStartRow - 1})` };

  // Mandatory Row
  templateSheet.getCell(`B${footerStartRow + 1}`).value = 'Mandatory';
  templateSheet.getCell(`I${footerStartRow + 1}`).value = MANDATORY_HOURS;

  // Extra Jam Mengajar Row (kelebihan jam x Teaching Fee per jam)
  templateSheet.getCell(`B${footerStartRow + 2}`).value =
    `Extra Jam Mengajar (@ Rp ${EXTRA_HOUR_RATE.toLocaleString('id-ID')}/jam)`;
  templateSheet.getCell(`I${footerStartRow + 2}`).value = {
    formula: `=IF(I${footerStartRow}>I${footerStartRow + 1},I${footerStartRow}-I${footerStartRow + 1},0)`
  };
  templateSheet.getCell(`K${footerStartRow + 2}`).value = EXTRA_HOUR_RATE;
  templateSheet.getCell(`L${footerStartRow + 2}`).value = {
    formula: `=I${footerStartRow + 2}*K${footerStartRow + 2}`
  };

  // GRAND TOTAL Row
  templateSheet.getCell(`B${footerStartRow + 3}`).value = 'GRAND TOTAL';
  templateSheet.getCell(`L${footerStartRow + 3}`).value = {
    formula: `=L${footerStartRow}+L${footerStartRow + 2}`
  };

  // Style the Summary Section
  const summaryFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF2F2F2' }
  };

  for (let offset = 0; offset < 4; offset++) {
    const rowNum = footerStartRow + offset;
    const row = templateSheet.getRow(rowNum);
    row.height = 20;
    row.font = { name: 'Arial', size: 9, bold: true };

    for (let colIdx = 1; colIdx <= headers.length; colIdx++) {
      const cell = templateSheet.getCell(rowNum, colIdx);
      cell.fill = summaryFill;
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: offset === 3 ? 'medium' : 'thin' },
        right: { style: 'thin' }
      };

      if (colIdx === 9) {
        cell.numFmt = '0.0';
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else if (colIdx === 11) {
        // Tarif per jam pada baris Extra Jam Mengajar
        cell.numFmt = '"Rp" #,##0';
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else if (colIdx === 12) {
        cell.numFmt = '"Rp" #,##0';
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      }
    }
  }

  // Signatures section
  const dateStr = `Surabaya, ${monthYear}`;
  templateSheet.getCell(`K${footerStartRow + 5}`).value = dateStr;
  templateSheet.getCell(`K${footerStartRow + 5}`).font = { name: 'Arial', size: 10, italic: true };

  templateSheet.getCell(`K${footerStartRow + 11}`).value = instructorName;
  templateSheet.getCell(`K${footerStartRow + 11}`).font = { name: 'Arial', size: 10, bold: true, underline: true };

  // Footer notes section
  const notesStart = footerStartRow + 13;
  templateSheet.getCell(`B${notesStart}`).value = 'Catatan:';
  templateSheet.getCell(`B${notesStart}`).font = { name: 'Arial', size: 9, bold: true };

  const notesList = [
    '1. Tentang I/O',
    '   * I: In, mengajar tidak menginap',
    '   * O: Out, mengajar menginap (luar kota), Total Hours x 1.3',
    `2. Feedback >=${FEEDBACK_MIN_SCORE} dapat Feedback fee ${FEEDBACK_FEE.toLocaleString('id-ID')}, berlaku u/ tiap sesi (misal: DBMS Fundamen 1 feedback, DBMS Admin 1 feedback)`,
    `3. Md Hours (minimal jam mengajar) = ${MANDATORY_HOURS} jam mengajar. Lebih dari itu (Ext. hours) dapat fee per jam (Teach. Fee) Rp ${EXTRA_HOUR_RATE.toLocaleString('id-ID')}/jam`,
    '4. Tentang instruktur sebagai asisten instruktur lain, ada di worksheet "Instruktur dan Asisten"'
  ];

  notesList.forEach((note, idx) => {
    const cell = templateSheet.getCell(`B${notesStart + 1 + idx}`);
    cell.value = note;
    cell.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF595959' } };
  });

  // Adjust column widths beautifully
  const colWidths = [6, 45, 8, 12, 12, 15, 15, 15, 15, 12, 10, 15, 25];
  colWidths.forEach((width, index) => {
    templateSheet.getColumn(index + 1).width = width;
  });

  // Generate Buffer
  return workbook.xlsx.writeBuffer();
}
