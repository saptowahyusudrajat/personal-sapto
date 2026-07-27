'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  calculateClaimSummary,
  calculateClaimSummaryByMonth,
  MANDATORY_HOURS,
  EXTRA_HOUR_RATE,
  FEEDBACK_MIN_SCORE
} from '@/lib/feeCalculator';
import {
  Award, 
  BookOpen, 
  Clock, 
  DollarSign, 
  Search,
  SlidersHorizontal,
  Target
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine
} from 'recharts';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

type ChartRange = 'year' | 'all' | 'month';

const CHART_RANGE_LABELS: { value: ChartRange; label: string }[] = [
  { value: 'year', label: '1 Tahun Terakhir' },
  { value: 'all', label: 'Semua Data' },
  { value: 'month', label: 'Bulan Tertentu' }
];

/** Kunci bulan "YYYY-MM" dengan bulan 0-based, aman untuk diurutkan sebagai teks. */
const monthKeyOf = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
};

const fullMonthLabel = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  return `${MONTHS[month]} ${year}`;
};

const shortMonthLabel = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  return `${MONTHS[month].slice(0, 3)} ${String(year).slice(-2)}`;
};

interface Session {
  id: string;
  materi: string;
  date_start: string;
  date_end: string;
  io_type: 'In' | 'Out';
  instansi: string;
  teaching_hours: number;
  total_hours: number;
  participant_count: number;
  feedback_score: number;
  feedback_fee: number;
}

export default function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInstansi, setSelectedInstansi] = useState('All');
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [chartRange, setChartRange] = useState<ChartRange>('year');
  const [chartMonthKey, setChartMonthKey] = useState('');

  useEffect(() => {
    async function fetchSessions() {
      try {
        const { data, error } = await supabase
          .from('sessions')
          .select('*')
          .order('date_start', { ascending: false });

        if (error) {
          console.error(error);
        } else if (data) {
          setSessions(data as Session[]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchSessions();
  }, []);

  // List of unique instansi for filter (selalu dari seluruh data agar opsi filter tidak hilang)
  const instansiList = ['All', ...Array.from(new Set(sessions.map(s => s.instansi).filter(Boolean)))];

  // Helper to extract Indonesian Month-Year name
  const getIndonesianMonthYear = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  };

  const monthYearList = ['All', ...Array.from(new Set(sessions.map(s => getIndonesianMonthYear(s.date_start))))];

  // Filtered sessions
  const filteredSessions = sessions.filter(session => {
    const matchesSearch =
      session.materi.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (session.instansi && session.instansi.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesInstansi = selectedInstansi === 'All' || session.instansi === selectedInstansi;
    const matchesMonth = selectedMonth === 'All' || getIndonesianMonthYear(session.date_start) === selectedMonth;

    return matchesSearch && matchesInstansi && matchesMonth;
  });

  // Statistik mengikuti filter yang sedang aktif, supaya angka kartu selalu
  // konsisten dengan isi tabel di bawahnya.
  const isFiltered = searchTerm !== '' || selectedInstansi !== 'All' || selectedMonth !== 'All';
  const totalSessions = filteredSessions.length;
  const totalTeachingHours = filteredSessions.reduce((acc, curr) => acc + Number(curr.teaching_hours || 0), 0);
  const totalHoursWithIO = filteredSessions.reduce((acc, curr) => acc + Number(curr.total_hours || 0), 0);
  // Batas mandatory 50 jam berlaku per bulan, jadi kelebihan jam diakumulasi per bulan
  const { totalFeedbackFee, extraHours, extraHoursFee, grandTotalFee } =
    calculateClaimSummaryByMonth(filteredSessions);
  const uniqueMateri = new Set(filteredSessions.map(s => s.materi)).size;
  const scoredSessions = filteredSessions.filter(s => Number(s.feedback_score) > 0);
  const avgFeedback =
    scoredSessions.reduce((acc, curr) => acc + Number(curr.feedback_score || 0), 0) /
    (scoredSessions.length || 1);

  // Progres jam mengajar terhadap batas mandatory. Mengikuti bulan yang dipilih;
  // bila filter bulan "Semua", memakai bulan berjalan.
  const progressMonth =
    selectedMonth !== 'All' ? selectedMonth : getIndonesianMonthYear(new Date().toISOString());
  const progressSessions = sessions.filter(s => getIndonesianMonthYear(s.date_start) === progressMonth);
  const progress = calculateClaimSummary(progressSessions);
  const progressPercent = Math.min(100, (progress.totalHours / MANDATORY_HOURS) * 100);
  const hoursToMandatory = Math.max(0, MANDATORY_HOURS - progress.totalHours);

  // Grafik tren bulanan.
  // Mengikuti filter pencarian & instansi, tetapi punya pengatur rentangnya
  // sendiri dan tidak mengikuti filter bulan pada tabel di bawah.
  const chartSourceSessions = sessions.filter(session => {
    const matchesSearch =
      session.materi.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (session.instansi && session.instansi.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesInstansi = selectedInstansi === 'All' || session.instansi === selectedInstansi;
    return matchesSearch && matchesInstansi;
  });

  const hoursByMonthKey = new Map<string, number>();
  chartSourceSessions.forEach(s => {
    hoursByMonthKey.set(
      monthKeyOf(s.date_start),
      (hoursByMonthKey.get(monthKeyOf(s.date_start)) || 0) + Number(s.total_hours || 0)
    );
  });

  // Pilihan bulan untuk mode "Bulan tertentu", terbaru lebih dulu
  const chartMonthOptions = Array.from(new Set(sessions.map(s => monthKeyOf(s.date_start)))).sort().reverse();
  const activeChartMonth = chartMonthKey || chartMonthOptions[0] || monthKeyOf(new Date().toISOString());

  // Rentang bulan yang akan digambar (inklusif)
  const now = new Date();
  let rangeEnd = { year: now.getFullYear(), month: now.getMonth() };
  let rangeStart: { year: number; month: number };

  if (chartRange === 'all') {
    const keys = Array.from(hoursByMonthKey.keys()).sort();
    if (keys.length > 0) {
      const [firstYear, firstMonth] = keys[0].split('-').map(Number);
      rangeStart = { year: firstYear, month: firstMonth };
      // Bila ada sesi yang dijadwalkan di masa depan, perpanjang ujung kanannya
      const [lastYear, lastMonth] = keys[keys.length - 1].split('-').map(Number);
      if (lastYear > rangeEnd.year || (lastYear === rangeEnd.year && lastMonth > rangeEnd.month)) {
        rangeEnd = { year: lastYear, month: lastMonth };
      }
    } else {
      rangeStart = { ...rangeEnd };
    }
  } else {
    const d = new Date(rangeEnd.year, rangeEnd.month - 11, 1);
    rangeStart = { year: d.getFullYear(), month: d.getMonth() };
  }

  const monthSpan =
    (rangeEnd.year - rangeStart.year) * 12 + (rangeEnd.month - rangeStart.month) + 1;

  // Bulan tanpa sesi tetap ditampilkan sebagai 0, bukan dilewati. Kalau bulan
  // kosong dihilangkan, jeda mengajar terlihat seolah tidak pernah terjadi dan
  // trennya menyesatkan.
  const monthlyChartData = Array.from({ length: Math.max(1, monthSpan) }, (_, offset) => {
    const d = new Date(rangeStart.year, rangeStart.month + offset, 1);
    return {
      label: shortMonthLabel(monthKeyOf(d.toISOString())),
      hours: hoursByMonthKey.get(monthKeyOf(d.toISOString())) || 0
    };
  });

  // Mode "Bulan tertentu": satu batang per kelas, bukan satu batang per bulan.
  // Satu bulan yang diagregasi hanya menghasilkan sebatang dan tidak terbaca.
  const perClassChartData = chartSourceSessions
    .filter(s => monthKeyOf(s.date_start) === activeChartMonth)
    .sort((a, b) => a.date_start.localeCompare(b.date_start))
    .map(s => ({
      label: s.materi.length > 22 ? `${s.materi.slice(0, 21)}...` : s.materi,
      hours: Number(s.total_hours || 0)
    }));

  const isPerClassMode = chartRange === 'month';
  const chartData = isPerClassMode ? perClassChartData : monthlyChartData;

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Memuat data portofolio...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Welcome Hero */}
      <section style={styles.hero}>
        <h2 style={styles.heroTitle}>Selamat Datang di Portal Mengajar Anda</h2>
        <p style={styles.heroSubtitle}>
          Analisis kinerja mengajar, rekapitulasi feedback peserta, dan otomasi pengajuan klaim bulanan di INIXINDO Surabaya secara tersentralisasi.
        </p>
      </section>

      {/* Progres jam mengajar terhadap batas mandatory */}
      <div style={styles.progressCard}>
        <div style={styles.progressHeader}>
          <div>
            <h3 style={styles.progressTitle}>
              <Target size={18} style={{ color: 'var(--accent)' }} />
              Progres Jam Mengajar {progressMonth}
            </h3>
            <p style={styles.progressSubtitle}>
              Batas mandatory {MANDATORY_HOURS} jam. Kelebihannya dibayar Rp {EXTRA_HOUR_RATE.toLocaleString('id-ID')}/jam.
            </p>
          </div>
          <div style={styles.progressFigure}>
            <span style={styles.progressBig}>{progress.totalHours.toFixed(1)}</span>
            <span style={styles.progressOf}> / {MANDATORY_HOURS} Jam</span>
          </div>
        </div>

        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressBar,
              width: `${progressPercent}%`,
              backgroundColor: progress.extraHours > 0 ? 'var(--success)' : 'var(--primary)'
            }}
          />
        </div>

        <div style={styles.progressFooter}>
          {progress.totalHours === 0 ? (
            <span>Belum ada sesi mengajar tercatat pada {progressMonth}.</span>
          ) : progress.extraHours > 0 ? (
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>
              Batas mandatory terlampaui {progress.extraHours.toFixed(1)} jam &rarr; extra fee Rp{' '}
              {progress.extraHoursFee.toLocaleString('id-ID')}
            </span>
          ) : (
            <span>
              Kurang <strong>{hoursToMandatory.toFixed(1)} jam</strong> lagi menuju batas mandatory. Setiap
              jam setelahnya bernilai Rp {EXTRA_HOUR_RATE.toLocaleString('id-ID')}.
            </span>
          )}
          <span style={styles.progressFooterRight}>
            {progressSessions.length} sesi &bull; feedback fee Rp {progress.totalFeedbackFee.toLocaleString('id-ID')}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      {isFiltered && (
        <div style={styles.filterNotice}>
          <SlidersHorizontal size={14} />
          <span>Angka di bawah ini dihitung dari {filteredSessions.length} sesi yang cocok dengan filter aktif, bukan seluruh data.</span>
        </div>
      )}
      <div style={styles.statsGrid}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <Clock size={20} style={{ color: 'var(--accent)' }} />
            <span style={styles.cardTitle}>Total Jam Mengajar</span>
          </div>
          <div style={styles.cardValue}>{totalHoursWithIO.toFixed(1)} <span style={styles.valueUnit}>Jam</span></div>
          <div style={styles.cardLabel}>{totalTeachingHours.toFixed(1)} jam tatap muka</div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <BookOpen size={20} style={{ color: 'var(--primary)' }} />
            <span style={styles.cardTitle}>Materi Unik</span>
          </div>
          <div style={styles.cardValue}>{uniqueMateri} <span style={styles.valueUnit}>Topik</span></div>
          <div style={styles.cardLabel}>Diajarkan di {totalSessions} kelas</div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <Award size={20} style={{ color: 'var(--success)' }} />
            <span style={styles.cardTitle}>Rata-rata Feedback</span>
          </div>
          <div style={styles.cardValue}>{avgFeedback.toFixed(2)}</div>
          <div style={styles.cardLabel}>
            Dari {scoredSessions.length} sesi bernilai (skala 1 - 4)
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <DollarSign size={20} style={{ color: 'var(--accent)' }} />
            <span style={styles.cardTitle}>Total Fee Klaim</span>
          </div>
          <div style={styles.cardValue}>Rp {grandTotalFee.toLocaleString('id-ID')}</div>
          <div style={styles.cardLabel}>
            Feedback Rp {totalFeedbackFee.toLocaleString('id-ID')} + Extra {extraHours.toFixed(1)} jam Rp {extraHoursFee.toLocaleString('id-ID')}
          </div>
        </div>
      </div>

      {/* Visual Analytics & Charts */}
      <div style={styles.chartSection}>
        <div style={styles.chartCard}>
          <div style={styles.chartHeader}>
            <div>
              <h3 style={styles.sectionTitle}>
                {isPerClassMode
                  ? `Jam Mengajar per Kelas, ${fullMonthLabel(activeChartMonth)}`
                  : 'Tren Jam Mengajar Bulanan'}
              </h3>
              <p style={styles.chartSubtitle}>
                {isPerClassMode
                  ? 'Satu batang mewakili satu kelas pada bulan tersebut.'
                  : `Bulan tanpa kelas tetap ditampilkan sebagai 0. Garis putus-putus menandai batas mandatory ${MANDATORY_HOURS} jam.`}
                {selectedMonth !== 'All' && ' Grafik ini punya pengatur sendiri, tidak mengikuti filter bulan pada tabel.'}
              </p>
            </div>

            <div style={styles.chartControls}>
              <div style={styles.segmented}>
                {CHART_RANGE_LABELS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setChartRange(option.value)}
                    style={{
                      ...styles.segmentedBtn,
                      ...(chartRange === option.value ? styles.segmentedBtnActive : {})
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {isPerClassMode && (
                <select
                  value={activeChartMonth}
                  onChange={e => setChartMonthKey(e.target.value)}
                  style={styles.chartMonthSelect}
                >
                  {chartMonthOptions.length === 0 ? (
                    <option value={activeChartMonth}>{fullMonthLabel(activeChartMonth)}</option>
                  ) : (
                    chartMonthOptions.map(key => (
                      <option key={key} value={key}>{fullMonthLabel(key)}</option>
                    ))
                  )}
                </select>
              )}
            </div>
          </div>

          <div style={{ width: '100%', height: 300, marginTop: '24px' }}>
            {chartData.length === 0 ? (
              <div style={styles.chartEmpty}>
                Tidak ada kelas pada {fullMonthLabel(activeChartMonth)} yang cocok dengan filter aktif.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: isPerClassMode ? 60 : 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0ece6" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#70685e' }}
                    tickLine={false}
                    interval={0}
                    angle={isPerClassMode ? -35 : 0}
                    textAnchor={isPerClassMode ? 'end' : 'middle'}
                    height={isPerClassMode ? 80 : 30}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#70685e' }} tickLine={false} />
                  <Tooltip
                    formatter={value => [`${Number(value ?? 0)} jam`, 'Total Jam']}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid var(--card-border)',
                      boxShadow: 'var(--shadow-md)',
                      fontSize: '13px'
                    }}
                  />
                  {/* Batas mandatory hanya bermakna pada agregat bulanan */}
                  {!isPerClassMode && (
                    <ReferenceLine
                      y={MANDATORY_HOURS}
                      stroke="var(--accent)"
                      strokeDasharray="4 4"
                      label={{ value: `Mandatory ${MANDATORY_HOURS}j`, position: 'insideTopRight', fontSize: 10, fill: 'var(--accent)' }}
                    />
                  )}
                  <Bar dataKey="hours" name="Total Jam" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Controls & Session Table */}
      <div style={styles.tableSection}>
        <div style={styles.tableHeaderSection}>
          <h3 style={styles.sectionTitle}>Riwayat Sesi Kelas Mengajar</h3>
          
          <div style={styles.filterBar}>
            <div style={styles.searchWrapper}>
              <Search size={16} style={styles.searchIcon} />
              <input 
                type="text" 
                placeholder="Cari materi atau instansi..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={styles.searchInput}
              />
            </div>

            <div style={styles.filtersGroup}>
              <div style={styles.selectWrapper}>
                <SlidersHorizontal size={14} style={styles.filterIcon} />
                <select 
                  value={selectedInstansi} 
                  onChange={e => setSelectedInstansi(e.target.value)}
                  style={styles.selectInput}
                >
                  <option value="All">Semua Instansi</option>
                  {instansiList.map((inst, idx) => inst !== 'All' && inst && (
                    <option key={idx} value={inst}>{inst}</option>
                  ))}
                </select>
              </div>

              <div style={styles.selectWrapper}>
                <select 
                  value={selectedMonth} 
                  onChange={e => setSelectedMonth(e.target.value)}
                  style={styles.selectInput}
                >
                  <option value="All">Semua Bulan</option>
                  {monthYearList.map((m, idx) => m !== 'All' && m && (
                    <option key={idx} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Table View */}
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Materi</th>
                <th style={styles.th}>Instansi</th>
                <th style={styles.th}>Tanggal</th>
                <th style={styles.th}>I/O</th>
                <th style={styles.th}>Jam</th>
                <th style={styles.th}>Siswa</th>
                <th style={styles.th}>Feedback</th>
                <th style={styles.th}>Feedback Fee</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.length > 0 ? (
                filteredSessions.map((s, idx) => (
                  <tr key={s.id} style={{ ...styles.tr, backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fcfcfb' }}>
                    <td style={styles.tdMateri}>
                      <Link href={`/sessions/${s.id}`} style={styles.materiLink}>
                        {s.materi}
                      </Link>
                    </td>
                    <td style={styles.td}>{s.instansi || '-'}</td>
                    <td style={styles.tdDate}>
                      {new Date(s.date_start).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} - {new Date(s.date_end).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={styles.td}>
                      <span style={{ 
                        ...styles.badge, 
                        backgroundColor: s.io_type === 'Out' ? 'var(--accent-light)' : 'var(--primary-light)',
                        color: s.io_type === 'Out' ? 'var(--accent)' : 'var(--primary)'
                      }}>
                        {s.io_type}
                      </span>
                    </td>
                    <td style={styles.tdNumber}>{s.total_hours}h</td>
                    <td style={styles.tdNumber}>{s.participant_count}</td>
                    <td style={styles.tdNumber}>
                      <span style={{ 
                        fontWeight: 600, 
                        color: s.feedback_score >= FEEDBACK_MIN_SCORE ? 'var(--success)' : 'var(--text-muted)'
                      }}>
                        {s.feedback_score || '-'}
                      </span>
                    </td>
                    <td style={styles.tdFee}>
                      {s.feedback_fee > 0 ? `Rp ${Number(s.feedback_fee).toLocaleString('id-ID')}` : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={styles.emptyCell}>Tidak ada riwayat mengajar yang cocok dengan filter Anda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '32px',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 0',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid var(--primary-light)',
    borderTop: '3px solid var(--primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  hero: {
    backgroundColor: '#ffffff',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '32px',
    boxShadow: 'var(--shadow-sm)',
  },
  heroTitle: {
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--foreground)',
    marginBottom: '8px',
    letterSpacing: '-0.5px',
  },
  heroSubtitle: {
    fontSize: '14px',
    color: 'var(--text-muted)',
    maxWidth: '800px',
    lineHeight: 1.6,
  },
  progressCard: {
    backgroundColor: '#ffffff',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap' as const,
    gap: '12px',
  },
  progressTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--foreground)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  progressSubtitle: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  progressFigure: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '4px',
  },
  progressBig: {
    fontSize: '28px',
    fontWeight: 700,
    color: 'var(--foreground)',
    letterSpacing: '-1px',
  },
  progressOf: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  progressTrack: {
    width: '100%',
    height: '10px',
    backgroundColor: 'var(--primary-light)',
    borderRadius: '999px',
    overflow: 'hidden' as const,
  },
  progressBar: {
    height: '100%',
    borderRadius: '999px',
    transition: 'width 0.4s ease',
  },
  progressFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: '8px',
    fontSize: '13px',
    color: 'var(--text-muted)',
  },
  progressFooterRight: {
    fontSize: '12px',
    color: 'var(--text-muted)',
  },
  filterNotice: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: 'var(--accent)',
    backgroundColor: 'var(--accent-light)',
    border: '1px solid #f2ddd1',
    borderRadius: 'var(--radius)',
    padding: '10px 14px',
    marginBottom: '-16px',
  },
  materiLink: {
    color: 'var(--foreground)',
    textDecoration: 'none',
    borderBottom: '1px dotted var(--card-border)',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '20px',
  },
  card: {
    backgroundColor: '#ffffff',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    boxShadow: 'var(--shadow-sm)',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  cardTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  cardValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--foreground)',
  },
  valueUnit: {
    fontSize: '14px',
    fontWeight: 400,
    color: 'var(--text-muted)',
  },
  cardLabel: {
    fontSize: '11px',
    color: '#a0988f',
  },
  chartSection: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '24px',
  },
  chartCard: {
    backgroundColor: '#ffffff',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
    boxShadow: 'var(--shadow-sm)',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: 'var(--foreground)',
  },
  chartSubtitle: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    marginTop: '4px',
    maxWidth: '560px',
  },
  chartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap' as const,
    gap: '16px',
  },
  chartControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap' as const,
  },
  segmented: {
    display: 'inline-flex',
    backgroundColor: 'var(--primary-light)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius)',
    padding: '3px',
    gap: '3px',
  },
  segmentedBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  segmentedBtnActive: {
    backgroundColor: '#ffffff',
    color: 'var(--foreground)',
    boxShadow: 'var(--shadow-sm)',
  },
  chartMonthSelect: {
    padding: '8px 12px',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius)',
    backgroundColor: '#ffffff',
    fontSize: '12px',
    fontWeight: 500,
    outline: 'none',
    cursor: 'pointer',
  },
  chartEmpty: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center' as const,
    fontSize: '13px',
    color: 'var(--text-muted)',
    border: '1px dashed var(--card-border)',
    borderRadius: 'var(--radius)',
  },
  tableSection: {
    backgroundColor: '#ffffff',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
    boxShadow: 'var(--shadow-sm)',
  },
  tableHeaderSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: '16px',
    marginBottom: '24px',
  },
  filterBar: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap' as const,
    width: '100%',
    justifyContent: 'space-between',
    marginTop: '12px',
  },
  searchWrapper: {
    position: 'relative' as const,
    flex: '1',
    minWidth: '240px',
  },
  searchIcon: {
    position: 'absolute' as const,
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--text-muted)',
  },
  searchInput: {
    width: '100%',
    padding: '8px 12px 8px 36px',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--background)',
    fontSize: '13px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  filtersGroup: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap' as const,
  },
  selectWrapper: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center',
  },
  filterIcon: {
    position: 'absolute' as const,
    left: '12px',
    color: 'var(--text-muted)',
    pointerEvents: 'none' as const,
  },
  selectInput: {
    appearance: 'none' as const,
    padding: '8px 32px 8px 32px',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius)',
    backgroundColor: '#ffffff',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer',
    color: 'var(--foreground)',
  },
  tableContainer: {
    overflowX: 'auto' as const,
    width: '100%',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '13px',
    textAlign: 'left' as const,
  },
  th: {
    padding: '12px 16px',
    borderBottom: '2px solid var(--card-border)',
    fontWeight: 600,
    color: 'var(--text-muted)',
    fontSize: '12px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  tr: {
    borderBottom: '1px solid var(--card-border)',
    transition: 'background-color 0.2s',
  },
  tdMateri: {
    padding: '12px 16px',
    fontWeight: 500,
    color: 'var(--foreground)',
    maxWidth: '300px',
    whiteSpace: 'normal' as const,
    wordBreak: 'break-word' as const,
  },
  td: {
    padding: '12px 16px',
    color: 'var(--text-muted)',
  },
  tdDate: {
    padding: '12px 16px',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap' as const,
  },
  tdNumber: {
    padding: '12px 16px',
    textAlign: 'right' as const,
    color: 'var(--text-muted)',
  },
  tdFee: {
    padding: '12px 16px',
    textAlign: 'right' as const,
    fontWeight: 500,
    color: 'var(--foreground)',
  },
  badge: {
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 600,
  },
  emptyCell: {
    padding: '40px',
    textAlign: 'center' as const,
    color: 'var(--text-muted)',
  },
};
export type DashboardStylesType = typeof styles;
