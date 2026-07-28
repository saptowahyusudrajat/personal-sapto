'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useTheme, chartColors } from '@/components/ThemeProvider';
import { useIsNarrow } from '@/components/useMediaQuery';
// Dashboard sengaja tidak mengimpor apa pun yang menghasilkan nominal rupiah.
// Perhitungan fee ada di halaman Rekap Fee (src/app/fee/page.tsx).
import { calculateClaimSummary, MANDATORY_HOURS, FEEDBACK_MIN_SCORE } from '@/lib/feeCalculator';
import {
  Award,
  BookOpen,
  Clock,
  Users,
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
}

export default function Dashboard() {
  const { theme } = useTheme();
  const colors = chartColors(theme);
  const isNarrow = useIsNarrow();
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
  const uniqueMateri = new Set(filteredSessions.map(s => s.materi)).size;
  const totalParticipants = filteredSessions.reduce(
    (acc, curr) => acc + Number(curr.participant_count || 0),
    0
  );
  const uniqueInstansi = new Set(filteredSessions.map(s => s.instansi).filter(Boolean)).size;
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

  // Jumlah label sumbu X dibatasi sesuai lebar layar. Sebelumnya seluruh label
  // dipaksa tampil (interval 0) sehingga saling menumpuk di ponsel.
  const maxAxisLabels = isNarrow ? 5 : 13;
  const axisInterval = Math.max(0, Math.ceil(chartData.length / maxAxisLabels) - 1);
  // Nama kelas panjang butuh ruang lebih di bawah grafik saat dimiringkan
  const axisHeight = isPerClassMode ? (isNarrow ? 96 : 80) : 32;

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
      {/* Progres jam mengajar terhadap batas mandatory */}
      <div style={styles.progressCard}>
        <div style={styles.progressHeader}>
          <div>
            <h3 style={styles.progressTitle}>
              <Target size={18} style={{ color: 'var(--accent)' }} />
              Progres Jam Mengajar {progressMonth}
            </h3>
            <p style={styles.progressSubtitle}>
              Batas mandatory {MANDATORY_HOURS} jam per bulan.
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

        {/* Nominal rupiah sengaja tidak ditampilkan di sini; seluruhnya ada di
            halaman Rekap Fee agar dashboard aman dipresentasikan. */}
        <div style={styles.progressFooter}>
          {progress.totalHours === 0 ? (
            <span>Belum ada sesi mengajar tercatat pada {progressMonth}.</span>
          ) : progress.extraHours > 0 ? (
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>
              Batas mandatory terlampaui {progress.extraHours.toFixed(1)} jam
            </span>
          ) : (
            <span>
              Kurang <strong>{hoursToMandatory.toFixed(1)} jam</strong> lagi menuju batas mandatory.
            </span>
          )}
          <span style={styles.progressFooterRight}>
            {progressSessions.length} sesi pada {progressMonth}
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

        {/* Kartu ini dulu menampilkan Total Fee Klaim. Nominalnya dipindah ke
            halaman Rekap Fee, digantikan angka yang aman dipresentasikan. */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <Users size={20} style={{ color: 'var(--accent)' }} />
            <span style={styles.cardTitle}>Peserta Dilatih</span>
          </div>
          <div style={styles.cardValue}>
            {totalParticipants.toLocaleString('id-ID')} <span style={styles.valueUnit}>Orang</span>
          </div>
          <div style={styles.cardLabel}>Dari {uniqueInstansi} instansi berbeda</div>
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
                  : 'Bulan tanpa kelas tetap ditampilkan sebagai 0.'}
                {selectedMonth !== 'All' && ' Grafik ini punya pengatur sendiri, tidak mengikuti filter bulan pada tabel.'}
              </p>
              {!isPerClassMode && (
                <div style={styles.chartLegend}>
                  <span style={styles.legendDash} />
                  <span>Batas mandatory {MANDATORY_HOURS} jam</span>
                </div>
              )}
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
                  {/* Recharts menulis warna sebagai atribut SVG, di mana var(--...)
                      tidak dijamin diterjemahkan. Karena itu warnanya dipilih
                      dari tema aktif lewat chartColors(). */}
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: isNarrow ? 12 : 13, fill: colors.axis }}
                    tickLine={false}
                    interval={axisInterval}
                    angle={isPerClassMode ? -35 : 0}
                    textAnchor={isPerClassMode ? 'end' : 'middle'}
                    height={axisHeight}
                    minTickGap={8}
                  />
                  <YAxis
                    tick={{ fontSize: isNarrow ? 12 : 13, fill: colors.axis }}
                    tickLine={false}
                    width={isNarrow ? 34 : 42}
                  />
                  <Tooltip
                    cursor={{ fill: colors.grid, opacity: 0.4 }}
                    formatter={value => [`${Number(value ?? 0)} jam`, 'Total Jam']}
                    contentStyle={{
                      backgroundColor: colors.tooltipBg,
                      color: 'var(--foreground)',
                      borderRadius: '8px',
                      border: `1px solid ${colors.tooltipBorder}`,
                      boxShadow: 'var(--shadow-md)',
                      fontSize: '15px'
                    }}
                  />
                  {/* Batas mandatory hanya bermakna pada agregat bulanan.
                      Tanpa label menempel: teksnya dulu menabrak batang.
                      Keterangannya dipindah ke penanda di bawah judul. */}
                  {!isPerClassMode && (
                    <ReferenceLine
                      y={MANDATORY_HOURS}
                      stroke={colors.reference}
                      strokeDasharray="4 4"
                    />
                  )}
                  <Bar dataKey="hours" name="Total Jam" fill={colors.bar} radius={[4, 4, 0, 0]} />
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

        {/* Di layar sempit tabel 8 kolom tidak terbaca: judul materi terpaksa
            pecah satu kata per baris. Karena itu barisnya disajikan sebagai
            kartu, bukan dipaksa masuk ke bentuk tabel. */}
        {isNarrow ? (
          <div style={styles.cardList}>
            {filteredSessions.length > 0 ? (
              filteredSessions.map(s => (
                <Link key={s.id} href={`/sessions/${s.id}`} style={styles.sessionCard}>
                  <div style={styles.sessionCardTop}>
                    <h4 style={styles.sessionCardTitle}>{s.materi}</h4>
                    <span
                      style={{
                        ...styles.badge,
                        flexShrink: 0,
                        backgroundColor: s.io_type === 'Out' ? 'var(--accent-light)' : 'var(--primary-light)',
                        color: s.io_type === 'Out' ? 'var(--accent)' : 'var(--primary)'
                      }}
                    >
                      {s.io_type}
                    </span>
                  </div>

                  <p style={styles.sessionCardMeta}>{s.instansi || 'Tanpa instansi'}</p>
                  <p style={styles.sessionCardMeta}>
                    {new Date(s.date_start).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} sampai{' '}
                    {new Date(s.date_end).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>

                  <div style={styles.sessionCardStats}>
                    <div style={styles.sessionCardStat}>
                      <span style={styles.sessionCardStatLabel}>Jam</span>
                      <span style={styles.sessionCardStatValue}>{s.total_hours}</span>
                    </div>
                    <div style={styles.sessionCardStat}>
                      <span style={styles.sessionCardStatLabel}>Peserta</span>
                      <span style={styles.sessionCardStatValue}>{s.participant_count}</span>
                    </div>
                    <div style={styles.sessionCardStat}>
                      <span style={styles.sessionCardStatLabel}>Feedback</span>
                      <span
                        style={{
                          ...styles.sessionCardStatValue,
                          color: s.feedback_score >= FEEDBACK_MIN_SCORE ? 'var(--success)' : 'var(--text-muted)'
                        }}
                      >
                        {s.feedback_score || '-'}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div style={styles.emptyCard}>Tidak ada riwayat mengajar yang cocok dengan filter Anda.</div>
            )}
          </div>
        ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Materi</th>
                <th style={styles.th}>Instansi</th>
                <th style={styles.th}>Tanggal</th>
                <th style={styles.th}>I/O</th>
                <th style={styles.th}>Jam</th>
                <th style={styles.th}>Peserta</th>
                <th style={styles.th}>Feedback</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.length > 0 ? (
                filteredSessions.map((s, idx) => (
                  <tr key={s.id} style={{ ...styles.tr, backgroundColor: idx % 2 === 0 ? 'var(--card-bg)' : 'var(--card-bg-alt)' }}>
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
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={styles.emptyCell}>Tidak ada riwayat mengajar yang cocok dengan filter Anda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
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
  progressCard: {
    backgroundColor: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-lg)',
    padding: 'clamp(16px, 3vw, 24px)',
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
    fontSize: '17px',
    fontWeight: 700,
    color: 'var(--foreground)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  progressSubtitle: {
    fontSize: '14px',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  progressFigure: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '4px',
  },
  progressBig: {
    fontSize: '30px',
    fontWeight: 700,
    color: 'var(--foreground)',
    letterSpacing: '-1px',
  },
  progressOf: {
    fontSize: '15px',
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
    fontSize: '15px',
    color: 'var(--text-muted)',
  },
  progressFooterRight: {
    fontSize: '14px',
    color: 'var(--text-muted)',
  },
  filterNotice: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: 'var(--accent)',
    backgroundColor: 'var(--accent-light)',
    border: '1px solid var(--accent-border)',
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
    backgroundColor: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-lg)',
    padding: 'clamp(16px, 3vw, 24px)',
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
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  cardValue: {
    fontSize: 'clamp(20px, 2.6vw, 24px)',
    fontWeight: 700,
    color: 'var(--foreground)',
    // Nominal rupiah panjang tidak boleh mendorong lebar kartu
    overflowWrap: 'anywhere' as const,
  },
  valueUnit: {
    fontSize: '16px',
    fontWeight: 400,
    color: 'var(--text-muted)',
  },
  cardLabel: {
    fontSize: '13px',
    color: 'var(--text-faint)',
  },
  chartSection: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '24px',
  },
  chartCard: {
    backgroundColor: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-lg)',
    padding: 'clamp(16px, 3vw, 24px)',
    boxShadow: 'var(--shadow-sm)',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: 'var(--foreground)',
  },
  chartLegend: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '8px',
    fontSize: '13px',
    color: 'var(--accent)',
    fontWeight: 600,
  },
  legendDash: {
    display: 'inline-block',
    width: '26px',
    height: 0,
    borderTop: '2px dashed var(--accent)',
  },
  cardList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    padding: '4px 0 8px',
  },
  sessionCard: {
    display: 'block',
    backgroundColor: 'var(--card-bg-alt)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '16px',
    color: 'var(--foreground)',
    textDecoration: 'none',
  },
  sessionCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '10px',
  },
  sessionCardTitle: {
    fontSize: '16px',
    fontWeight: 700,
    lineHeight: 1.4,
    color: 'var(--foreground)',
  },
  sessionCardMeta: {
    fontSize: '14px',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  sessionCardStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
    marginTop: '14px',
    paddingTop: '12px',
    borderTop: '1px solid var(--card-border)',
  },
  sessionCardStat: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    minWidth: 0,
  },
  sessionCardStatLabel: {
    fontSize: '12px',
    color: 'var(--text-faint)',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.4px',
  },
  sessionCardStatValue: {
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--foreground)',
    overflowWrap: 'anywhere' as const,
  },
  emptyCard: {
    padding: '32px 16px',
    textAlign: 'center' as const,
    color: 'var(--text-muted)',
    fontSize: '15px',
    border: '1px dashed var(--card-border)',
    borderRadius: 'var(--radius-lg)',
  },
  chartSubtitle: {
    fontSize: '14px',
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
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  segmentedBtnActive: {
    backgroundColor: 'var(--card-bg)',
    color: 'var(--foreground)',
    boxShadow: 'var(--shadow-sm)',
  },
  chartMonthSelect: {
    padding: '8px 12px',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--card-bg)',
    fontSize: '14px',
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
    fontSize: '15px',
    color: 'var(--text-muted)',
    border: '1px dashed var(--card-border)',
    borderRadius: 'var(--radius)',
  },
  tableSection: {
    backgroundColor: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-lg)',
    padding: 'clamp(16px, 3vw, 24px)',
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
    fontSize: '15px',
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
    backgroundColor: 'var(--card-bg)',
    fontSize: '15px',
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
    // Tanpa lebar minimum, 8 kolom akan saling menghimpit di layar ponsel.
    // Dengan ini tabel menggulir mendatar di dalam wadahnya dan tetap terbaca.
    minWidth: '760px',
    borderCollapse: 'collapse' as const,
    fontSize: '15px',
    textAlign: 'left' as const,
  },
  th: {
    padding: '12px 16px',
    borderBottom: '2px solid var(--card-border)',
    fontWeight: 600,
    color: 'var(--text-muted)',
    fontSize: '14px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  tr: {
    borderBottom: '1px solid var(--card-border)',
    transition: 'background-color 0.2s',
  },
  tdMateri: {
    padding: '14px 16px',
    fontWeight: 600,
    color: 'var(--foreground)',
    // Lebar minimum mencegah kolom judul tergencet sampai satu kata per baris
    minWidth: '260px',
    maxWidth: '340px',
    whiteSpace: 'normal' as const,
    overflowWrap: 'break-word' as const,
  },
  td: {
    padding: '14px 16px',
    // Naik dari --text-muted: isi tabel adalah data utama, bukan keterangan
    // pendukung, jadi harus punya kontras penuh.
    color: 'var(--foreground)',
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
  badge: {
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: 600,
  },
  emptyCell: {
    padding: '40px',
    textAlign: 'center' as const,
    color: 'var(--text-muted)',
  },
};
export type DashboardStylesType = typeof styles;
