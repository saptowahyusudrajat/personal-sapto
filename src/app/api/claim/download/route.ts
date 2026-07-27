import { NextRequest, NextResponse } from 'next/server';
import { generateExcelClaim, SessionRecord } from '@/lib/excelGenerator';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Endpoint ini membaca data lewat service-role key yang menembus RLS, jadi
 * pemanggilnya wajib membuktikan diri lebih dulu lewat token login Supabase.
 * Tanpa ini, siapa pun yang tahu URL-nya bisa mengunduh seluruh data klaim.
 */
async function getAuthenticatedUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';

  if (!token) return null;

  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

const ID_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Tidak terautentikasi. Silakan login kembali.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const monthYear = searchParams.get('month_year'); // e.g., "Januari 2026"

    if (!monthYear) {
      return NextResponse.json({ error: 'Missing month_year query parameter' }, { status: 400 });
    }

    const [monthName, yearStr] = monthYear.split(' ');
    const monthIndex = ID_MONTHS.indexOf(monthName);
    const year = parseInt(yearStr);

    if (monthIndex === -1 || isNaN(year)) {
      return NextResponse.json({ error: 'Invalid month_year format. Use "Bulan Tahun" (e.g. "Januari 2026")' }, { status: 400 });
    }

    // Calculate first and last day of the month
    const firstDay = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
    const lastDay = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(new Date(year, monthIndex + 1, 0).getDate()).padStart(2, '0')}`;

    // ATURAN KLAIM: sebuah sesi diklaim PENUH pada bulan tanggal mulainya.
    // Kelas lintas bulan (mis. 29 Jan - 2 Feb) seluruh jamnya masuk klaim Januari,
    // tidak dipecah ke Februari. Karena itu penyaringan hanya memakai date_start.
    // Jangan ubah ke date_end atau rentang tumpang tindih tanpa keputusan baru:
    // batas mandatory 50 jam berlaku per bulan, sehingga penempatan ini
    // menentukan besar Extra Jam Fee.
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select('*')
      .gte('date_start', firstDay)
      .lte('date_start', lastDay)
      .order('date_start', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ error: 'No teaching sessions found for this month.' }, { status: 404 });
    }

    // Format data for excel generator
    const recordList: SessionRecord[] = sessions.map(s => ({
      materi: s.materi,
      io_type: s.io_type as 'In' | 'Out',
      date_start: s.date_start,
      date_end: s.date_end,
      teaching_hours: Number(s.teaching_hours),
      total_hours: Number(s.total_hours),
      participant_count: Number(s.participant_count),
      feedback_score: Number(s.feedback_score || 0),
      feedback_fee: Number(s.feedback_fee),
      instansi: s.instansi || ''
    }));

    // Nama instruktur diambil dari profil user yang login, dengan cadangan env var
    const instructorName =
      (user.user_metadata?.full_name as string | undefined) ||
      process.env.INSTRUCTOR_NAME ||
      'Sapto Wahyu Sudrajat';

    // Generate Excel Buffer
    const buffer = await generateExcelClaim(monthYear, instructorName, recordList);

    // Set headers and return file
    const headers = new Headers();
    headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    headers.set('Content-Disposition', `attachment; filename="SSW Klaim Mengajar Instruktur - ${monthYear.replace(' ', '')}.xlsx"`);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Kesalahan tidak diketahui';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
