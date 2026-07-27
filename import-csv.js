const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

try {
  // Parse .env.local
  const envPath = path.join(__dirname, '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] ? match[2].trim() : '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      env[match[1]] = value;
    }
  });

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  // Use Service Role Key to bypass RLS policies during import
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in .env.local');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const csvPath = path.join(__dirname, '../migrasi_sessions_fixed.csv');
  
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at ${csvPath}`);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf8');

  // Simple CSV Parser that handles double quotes and newlines inside quotes
  function parseCSV(text) {
    const lines = [];
    let row = [""];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i+1];
      if (c === '"') {
        if (inQuotes && next === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push("");
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && next === '\n') {
          i++;
        }
        lines.push(row);
        row = [""];
      } else {
        row[row.length - 1] += c;
      }
    }
    if (row.length > 1 || row[0] !== "") {
      lines.push(row);
    }
    return lines;
  }

  const parsed = parseCSV(csvContent);
  const headers = parsed[0].map(h => h.trim());
  const rows = parsed.slice(1);

  const records = [];

  for (const row of rows) {
    if (row.length < headers.length) continue;
    
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] ? row[i].trim() : '';
    });

    // Filter out rows with "nan" or empty materi
    if (!obj.materi || obj.materi.toLowerCase() === 'nan' || obj.materi === '') {
      continue;
    }

    records.push({
      materi: obj.materi,
      date_start: obj.date_start,
      date_end: obj.date_end,
      io_type: obj.io_type,
      instansi: obj.instansi,
      teaching_hours: parseFloat(obj.teaching_hours) || 0,
      total_hours: parseFloat(obj.total_hours) || 0,
      participant_count: parseInt(obj.participant_count, 10) || 0,
      feedback_score: obj.feedback_score ? parseFloat(obj.feedback_score) : null,
      feedback_fee: parseFloat(obj.feedback_fee) || 0
    });
  }

  console.log(`🔍 Berhasil mem-parse ${records.length} baris data sesi mengajar yang valid.`);

  async function run() {
    console.log('🔄 Memulai proses migrasi data ke Supabase (menggunakan Service Role Key)...');
    
    // First, clear existing entries if any, to avoid duplication
    console.log('🧹 Membersihkan sisa data lama di tabel "sessions"...');
    await supabase.from('sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    const { data, error } = await supabase.from('sessions').insert(records).select();
    
    if (error) {
      console.error('❌ Gagal melakukan migrasi data:', error.message);
    } else {
      console.log(`✅ Sukses bermigrasi! Berhasil memasukkan ${data.length} sesi mengajar ke tabel 'sessions'.`);
    }
  }

  run();
} catch (e) {
  console.error('❌ Terjadi kesalahan konfigurasi atau file:', e.message);
}
