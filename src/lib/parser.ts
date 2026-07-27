export interface ParsedFeedback {
  materi: string;
  periode: string;
  instruktur: string;
  instansi: string;
  score_materi: number;
  score_instruktur: number;
  score_fasilitas: number;
  score_pelayanan: number;
  score_konsumsi: number;
  notes_berkesan: string;
  notes_saran: string;
  notes_topik: string;
}

export function parseFeedback(text: string): ParsedFeedback {
  const getField = (regex: RegExp, fallback = '') => {
    const match = text.match(regex);
    return match ? match[1].trim() : fallback;
  };

  const getScore = (regex: RegExp, fallback = 0) => {
    const match = text.match(regex);
    if (match) {
      const val = parseFloat(match[1].replace(',', '.'));
      return isNaN(val) ? fallback : val;
    }
    return fallback;
  };

  const materi = getField(/Materi\s*:\s*(.*)/i);
  const periode = getField(/Periode\s*:\s*(.*)/i);
  const instruktur = getField(/Instruktur\s*:\s*(.*)/i);
  const instansi = getField(/Instansi\s*:\s*(.*)/i);

  const score_materi = getScore(/A\.\s*Nilai\s*Materi\s*:\s*([\d.,]+)/i);
  const score_instruktur = getScore(/B\.\s*Nilai\s*Instruktur\s*:\s*([\d.,]+)/i);
  const score_fasilitas = getScore(/C\.\s*Nilai\s*(?:Fasilitas|Laboratorium|Fasilitas Laboratorium)\s*:\s*([\d.,]+)/i);
  const score_pelayanan = getScore(/D\.\s*Nilai\s*Pelayanan\s*:\s*([\d.,]+)/i);
  const score_konsumsi = getScore(/E\.\s*Nilai\s*Konsumsi\s*:\s*([\d.,]+)/i);

  // Helper to extract content between sections
  const extractSection = (startMarker: string, endMarker: string | null) => {
    const lines = text.split('\n');
    let record = false;
    const sectionLines: string[] = [];

    for (const line of lines) {
      const cleanLine = line.trim();
      if (cleanLine.toLowerCase().startsWith(startMarker.toLowerCase())) {
        record = true;
        continue;
      }
      if (endMarker && cleanLine.toLowerCase().startsWith(endMarker.toLowerCase())) {
        record = false;
      }
      if (record) {
        sectionLines.push(line);
      }
    }

    return sectionLines.join('\n').trim();
  };

  const notes_berkesan = extractSection('F. Pengalaman', 'G. Saran');
  const notes_saran = extractSection('G. Saran', 'H. Topik');
  const notes_topik = extractSection('H. Topik', null);

  return {
    materi,
    periode,
    instruktur,
    instansi,
    score_materi,
    score_instruktur,
    score_fasilitas,
    score_pelayanan,
    score_konsumsi,
    notes_berkesan,
    notes_saran,
    notes_topik,
  };
}
