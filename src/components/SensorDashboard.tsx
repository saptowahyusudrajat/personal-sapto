'use client';

import React, { useEffect, useState } from 'react';
import { Thermometer, Droplets, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useIsNarrow } from '@/components/useMediaQuery';

interface SensorReading {
  id: number;
  device_id: string;
  temperature: number;
  humidity: number;
  timestamp: number;
  rssi?: number | null;
  ping_latency?: number | null;
  uptime?: number | null;
  reconnect_count?: number | null;
  speed_mbps?: number | null;
}

interface ChartData {
  time: string;
  temp: number;
  humidity: number;
  timestamp: number;
  rssi?: number;
  ping_latency?: number;
  uptime?: number;
  reconnect_count?: number;
  speed_mbps?: number;
}

/** Interval auto-refresh data sensor (10 detik). */
const REFRESH_INTERVAL_MS = 10_000;

/** Pilihan rentang cepat, dalam jam. */
const QUICK_RANGES = [
  { hours: 1, label: '1 jam' },
  { hours: 24 * 7, label: '7 hari' },
  { hours: 24 * 14, label: '14 hari' },
  { hours: 24 * 30, label: '30 hari' },
  { hours: 24 * 90, label: '90 hari' },
];

const toChartData = (item: SensorReading): ChartData => ({
  time: new Date(item.timestamp * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
  temp: item.temperature,
  humidity: item.humidity,
  timestamp: item.timestamp,
  rssi: item.rssi ?? undefined,
  ping_latency: item.ping_latency ?? undefined,
  uptime: item.uptime ?? undefined,
  reconnect_count: item.reconnect_count ?? undefined,
  speed_mbps: item.speed_mbps ?? undefined,
});

export default function SensorDashboard({ isPublic = false }: { isPublic?: boolean } = {}) {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  // `loading` hanya untuk muat awal / ganti filter; auto-refresh memakai
  // `refreshing` supaya kartu dan grafik yang sudah tampil tidak hilang.
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Halaman publik dibuka di rentang 1 jam: dengan data tiap 10 detik, titik
  // baru langsung terlihat. Pada rentang 7 hari pergeserannya nyaris tak kasat mata.
  const [rangeHours, setRangeHours] = useState(isPublic ? 1 : 24 * 7);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  // Rentang tanggal baru dipakai setelah tombol Filter ditekan, bukan saat mengetik
  const [appliedRange, setAppliedRange] = useState<{ start: string; end: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const useCustomRange = appliedRange !== null;
  const isNarrow = useIsNarrow();

  const latestReading = chartData.length > 0 ? chartData[chartData.length - 1] : null;

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    const url = appliedRange
      ? `/api/sensor?start_date=${appliedRange.start}&end_date=${appliedRange.end}`
      : `/api/sensor?hours=${rangeHours}`;

    const load = async (silent: boolean) => {
      // Lewati jika permintaan sebelumnya belum selesai (koneksi lambat)
      if (inFlight) return;
      inFlight = true;
      if (silent) setRefreshing(true);
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('Gagal mengambil data sensor');
        const { data } = await res.json();
        if (cancelled) return;
        setChartData((data as SensorReading[]).map(toChartData));
        setError(null);
      } catch (err) {
        // Data lama dibiarkan tampil; cukup tampilkan pesan error
        if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal mengambil data sensor');
      } finally {
        inFlight = false;
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    load(false);
    const interval = setInterval(() => load(true), REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [rangeHours, appliedRange, reloadKey]);

  const handleRangeChange = (hours: number) => {
    if (hours === rangeHours && !useCustomRange) return;
    setLoading(true);
    setRangeHours(hours);
    setAppliedRange(null);
  };

  const handleCustomRange = () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setAppliedRange({ start: startDate, end: endDate });
  };

  const tempStats = chartData.length > 0 ? {
    min: Math.min(...chartData.map(d => d.temp)),
    max: Math.max(...chartData.map(d => d.temp)),
    avg: (chartData.reduce((sum, d) => sum + d.temp, 0) / chartData.length).toFixed(1),
  } : null;

  const humidityStats = chartData.length > 0 ? {
    min: Math.min(...chartData.map(d => d.humidity)),
    max: Math.max(...chartData.map(d => d.humidity)),
    avg: (chartData.reduce((sum, d) => sum + d.humidity, 0) / chartData.length).toFixed(1),
  } : null;

  const handleDeleteAll = async () => {
    if (!confirm('⚠️ Delete ALL data? This cannot be undone!')) return;
    if (!confirm('Really sure? All records will be permanently deleted!')) return;

    try {
      const res = await fetch('/api/sensor?delete=all', { method: 'DELETE' });
      if (res.ok) {
        alert('✓ All data deleted!');
        setReloadKey((k) => k + 1);
      } else {
        alert('✗ Error deleting data');
      }
    } catch (err) {
      alert('✗ Error: ' + err);
    }
  };

  const sentTime = latestReading ? new Date(latestReading.timestamp * 1000).toLocaleTimeString('id-ID') : '';

  // Gabungkan gaya dasar dengan gaya khusus layar sempit bila perlu
  const rs = <T extends object>(base: T, narrow: object): T => (isNarrow ? { ...base, ...narrow } : base);

  // Di layar sempit kartu dibuat satu baris (label kiri, angka kanan) supaya
  // ketiga kartu tidak memakan satu layar penuh.
  const renderRealtimeCard = (icon: React.ReactNode, label: string, value: string, time: string) => (
    <div style={rs(styles.realtimeCard, styles.realtimeCardNarrow)}>
      <div style={isNarrow ? styles.realtimeInfoNarrow : undefined}>
        <div style={rs(styles.realtimeHeader, styles.realtimeHeaderNarrow)}>
          {icon}
          <span style={styles.realtimeLabel}>{label}</span>
        </div>
        {isNarrow && <div style={styles.realtimeTime}>{time}</div>}
      </div>
      <div style={rs(styles.realtimeValue, styles.realtimeValueNarrow)}>{value}</div>
      {!isNarrow && <div style={styles.realtimeTime}>{time}</div>}
    </div>
  );

  // Grafik lebih pendek dan sumbu lebih ramping di ponsel; desktop memakai bawaan Recharts
  const renderChart = (dataKey: keyof ChartData, color: string) => (
    <ResponsiveContainer width="100%" height={isNarrow ? 220 : 300}>
      <LineChart data={chartData} margin={isNarrow ? { top: 5, right: 8, bottom: 0, left: 0 } : undefined}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" tick={isNarrow ? { fontSize: 11 } : undefined} minTickGap={isNarrow ? 24 : undefined} />
        <YAxis tick={isNarrow ? { fontSize: 11 } : undefined} width={isNarrow ? 36 : undefined} />
        <Tooltip />
        {/* Animasi dimatikan: tanpa ini garis digambar ulang dari awal tiap refresh */}
        <Line type="monotone" dataKey={dataKey} stroke={color} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );

  const cardStyle = rs(styles.card, styles.cardNarrow);

  return (
    <div style={rs(styles.container, styles.containerNarrow)}>
      <div style={rs(styles.header, styles.headerNarrow)}>
        <div style={{ minWidth: 0 }}>
          <h1 style={styles.title}>Monitoring Suhu & Kelembaban</h1>
          {latestReading && <div style={styles.lastUpdate}>Last Update: {new Date(latestReading.timestamp * 1000).toLocaleString('id-ID')}</div>}
          <div style={styles.refreshInfo}>
            <span style={{ ...styles.refreshDot, opacity: refreshing ? 1 : 0.35 }} />
            {refreshing ? 'Memperbarui data…' : 'Auto-refresh tiap 10 detik'}
          </div>
        </div>
        {!isPublic && (
          <button onClick={handleDeleteAll} style={styles.deleteButton}>🗑️ Erase All</button>
        )}
      </div>
      {error && <div style={styles.errorBox}>{error}</div>}

      {latestReading && (
        <div style={rs(styles.realtimeBox, styles.realtimeBoxNarrow)}>
          {renderRealtimeCard(
            <Thermometer size={isNarrow ? 20 : 24} color="#f59e0b" />,
            'Suhu Real-time',
            `${latestReading.temp.toFixed(1)}°C`,
            `Sent: ${sentTime}`
          )}
          {renderRealtimeCard(
            <Droplets size={isNarrow ? 20 : 24} color="#10b981" />,
            'Kelembaban Real-time',
            `${latestReading.humidity.toFixed(0)}%`,
            `Sent: ${sentTime}`
          )}
          {isPublic
            ? // Halaman publik: kartu ketiga menampilkan ping, bukan kecepatan internet
              renderRealtimeCard(
                <Activity size={isNarrow ? 20 : 24} color="#6366f1" />,
                'Ping Real-time',
                latestReading.ping_latency ? `${latestReading.ping_latency} ms` : 'N/A',
                `Sent: ${sentTime}`
              )
            : renderRealtimeCard(
                null,
                'Internet Speed',
                `${(latestReading.speed_mbps ?? 0).toFixed(2)} Mbps`,
                `Last: ${latestReading.speed_mbps ? sentTime : 'N/A'}`
              )}
        </div>
      )}

      <div style={rs(styles.filterBox, styles.filterBoxNarrow)}>
        <div style={rs(styles.filterGroup, styles.filterGroupNarrow)}>
          <label style={rs(styles.label, styles.labelNarrow)}>Quick Range:</label>
          <div style={rs(styles.buttonGroup, styles.buttonGroupNarrow)}>
            {QUICK_RANGES.map(({ hours, label }) => (
              <button key={hours} onClick={() => handleRangeChange(hours)} style={{ ...rs(styles.filterButton, styles.filterButtonNarrow), ...(rangeHours === hours && !useCustomRange ? styles.filterButtonActive : {}) }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div style={rs(styles.filterGroup, styles.filterGroupNarrow)}>
          <label style={rs(styles.label, styles.labelNarrow)}>Custom Range:</label>
          <div style={rs(styles.dateInputGroup, styles.dateInputGroupNarrow)}>
            <input type="date" aria-label="Tanggal mulai" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={rs(styles.dateInput, styles.dateInputNarrow)} />
            {!isNarrow && <span style={styles.toLabel}>to</span>}
            <input type="date" aria-label="Tanggal akhir" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={rs(styles.dateInput, styles.dateInputNarrow)} />
            <button onClick={handleCustomRange} style={{ ...rs(styles.filterButton, styles.filterSubmitNarrow), ...(useCustomRange ? styles.filterButtonActive : {}) }}>Filter</button>
          </div>
        </div>
      </div>
      {loading ? (
        <div style={styles.loading}>Loading data...</div>
      ) : chartData.length === 0 ? (
        <div style={styles.noData}>No data available</div>
      ) : (
        <>
          {latestReading && !isPublic && (
            <div style={cardStyle}>
              <h3 style={styles.networkTitle}>Network Health</h3>
              <div style={rs(styles.networkGrid, styles.networkGridNarrow)}>
                <div style={styles.networkMetric}>
                  <div style={styles.metricLabel}>Signal Strength</div>
                  <div style={styles.metricValue}>{latestReading.rssi ?? 'N/A'} dBm</div>
                  <div style={{ ...styles.metricBar, width: latestReading.rssi ? `${Math.max(0, Math.min(100, (latestReading.rssi + 100) * 1.5))}%` : '0%' }} />
                </div>
                <div style={styles.networkMetric}>
                  <div style={styles.metricLabel}>Ping Latency</div>
                  <div style={styles.metricValue}>{latestReading.ping_latency || 'N/A'} ms</div>
                </div>
                <div style={styles.networkMetric}>
                  <div style={styles.metricLabel}>Uptime</div>
                  <div style={styles.metricValue}>
                    {latestReading.uptime ?
                      `${Math.floor(latestReading.uptime / 3600)}h ${Math.floor((latestReading.uptime % 3600) / 60)}m`
                      : 'N/A'}
                  </div>
                </div>
                <div style={styles.networkMetric}>
                  <div style={styles.metricLabel}>Reconnects</div>
                  <div style={styles.metricValue}>{latestReading.reconnect_count ?? 'N/A'}</div>
                </div>
              </div>
            </div>
          )}

          <div style={cardStyle}>
            <div style={styles.cardHeader}>
              <Thermometer size={20} color="#f59e0b" />
              <h2 style={styles.cardTitle}>Trend Suhu</h2>
            </div>
            {tempStats && (
              <div style={styles.stats}>
                <span>Min: {tempStats.min.toFixed(1)}°C</span>
                <span>Avg: {tempStats.avg}°C</span>
                <span>Max: {tempStats.max.toFixed(1)}°C</span>
              </div>
            )}
            {renderChart('temp', '#f59e0b')}
          </div>
          <div style={cardStyle}>
            <div style={styles.cardHeader}>
              <Droplets size={20} color="#10b981" />
              <h2 style={styles.cardTitle}>Trend Kelembaban</h2>
            </div>
            {humidityStats && (
              <div style={styles.stats}>
                <span>Min: {humidityStats.min.toFixed(0)}%</span>
                <span>Avg: {humidityStats.avg}%</span>
                <span>Max: {humidityStats.max.toFixed(0)}%</span>
              </div>
            )}
            {renderChart('humidity', '#10b981')}
          </div>

          <div style={cardStyle}>
            <div style={styles.cardHeader}>
              <Activity size={20} color="#6366f1" />
              <h2 style={styles.cardTitle}>Ping Latency (ms)</h2>
            </div>
            {renderChart('ping_latency', '#6366f1')}
          </div>

          {!isPublic && (
            <div style={cardStyle}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Network Speed (Mbps)</h2>
              </div>
              {renderChart('speed_mbps', '#3b82f6')}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  container: { display: 'flex' as const, flexDirection: 'column' as const, gap: '24px', minWidth: 0 },
  containerNarrow: { gap: '14px' },
  header: { display: 'flex' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, gap: '16px', flexWrap: 'wrap' as const },
  headerNarrow: { alignItems: 'flex-start' as const, gap: '10px' },
  deleteButton: { padding: '8px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  title: { fontSize: 'clamp(20px, 5vw, 24px)', fontWeight: 700, color: 'var(--foreground)', margin: 0, lineHeight: 1.25 },
  lastUpdate: { fontSize: '13px', color: 'var(--text-muted)' },
  refreshInfo: { display: 'flex' as const, alignItems: 'center' as const, gap: '6px', fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' },
  refreshDot: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', transition: 'opacity 0.3s' },
  // min(100%, 220px) mencegah kartu lebih lebar dari layar pada lebar menengah
  realtimeBox: { display: 'grid' as const, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px' },
  realtimeBoxNarrow: { gridTemplateColumns: '1fr', gap: '10px' },
  realtimeCard: { backgroundColor: 'var(--card-bg)', border: '2px solid var(--primary-light)', borderRadius: 'var(--radius)', padding: '24px', textAlign: 'center' as const, minWidth: 0 },
  realtimeCardNarrow: { display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: '12px', padding: '12px 16px', textAlign: 'left' as const },
  realtimeInfoNarrow: { display: 'flex' as const, flexDirection: 'column' as const, gap: '2px', minWidth: 0 },
  realtimeHeader: { display: 'flex' as const, alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px' },
  realtimeHeaderNarrow: { justifyContent: 'flex-start', marginBottom: 0 },
  realtimeLabel: { fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)' },
  realtimeValue: { fontSize: 'clamp(36px, 4.5vw, 48px)', fontWeight: 700, color: 'var(--foreground)', marginBottom: '8px', whiteSpace: 'nowrap' as const },
  realtimeValueNarrow: { fontSize: '30px', marginBottom: 0, flexShrink: 0 },
  realtimeTime: { fontSize: '12px', color: 'var(--text-muted)' },
  errorBox: { padding: '12px 16px', backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: 'var(--radius)', color: '#dc2626', fontSize: '14px' },
  filterBox: { backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius)', padding: '16px', display: 'flex' as const, flexDirection: 'column' as const, gap: '16px' },
  filterBoxNarrow: { padding: '12px', gap: '12px' },
  filterGroup: { display: 'flex' as const, alignItems: 'center' as const, gap: '12px', flexWrap: 'wrap' as const },
  filterGroupNarrow: { flexDirection: 'column' as const, alignItems: 'stretch' as const, gap: '6px' },
  label: { fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', minWidth: '100px' },
  labelNarrow: { minWidth: 0, fontSize: '13px' },
  buttonGroup: { display: 'flex' as const, gap: '8px', flexWrap: 'wrap' as const },
  buttonGroupNarrow: { display: 'grid' as const, gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '6px' },
  // Sengaja tidak memakai shorthand `border`: filterButtonActive menimpa
  // borderColor, dan mencampur keduanya memicu peringatan React saat ganti filter.
  filterButton: { padding: '6px 12px', fontSize: '14px', fontWeight: 500, backgroundColor: 'var(--primary-light)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--card-border)', borderRadius: 'var(--radius)', color: 'var(--foreground)', cursor: 'pointer', whiteSpace: 'nowrap' as const },
  filterButtonActive: { backgroundColor: 'var(--primary)', color: 'white', borderColor: 'var(--primary)' },
  filterButtonNarrow: { padding: '7px 2px', fontSize: '13px' },
  filterSubmitNarrow: { gridColumn: '1 / -1', padding: '8px 12px' },
  dateInputGroup: { display: 'flex' as const, alignItems: 'center' as const, gap: '8px', flexWrap: 'wrap' as const },
  dateInputGroupNarrow: { display: 'grid' as const, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px' },
  dateInput: { padding: '6px 10px', fontSize: '14px', border: '1px solid var(--card-border)', borderRadius: 'var(--radius)', backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' },
  dateInputNarrow: { width: '100%', minWidth: 0, padding: '8px' },
  toLabel: { fontSize: '14px', color: 'var(--text-muted)' },
  loading: { textAlign: 'center' as const, padding: '40px 20px', color: 'var(--text-muted)' },
  noData: { textAlign: 'center' as const, padding: '40px 20px', color: 'var(--text-muted)' },
  card: { backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius)', padding: '20px', minWidth: 0 },
  cardNarrow: { padding: '14px 12px' },
  cardHeader: { display: 'flex' as const, alignItems: 'center' as const, gap: '12px', marginBottom: '12px' },
  cardTitle: { fontSize: '16px', fontWeight: 600, color: 'var(--foreground)', margin: 0 },
  stats: { display: 'flex' as const, gap: '8px 16px', marginBottom: '16px', fontSize: '13px', color: 'var(--text-muted)', flexWrap: 'wrap' as const },
  networkTitle: { fontSize: '16px', fontWeight: 600, color: 'var(--foreground)', margin: '0 0 16px 0' },
  networkGrid: { display: 'grid' as const, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' },
  networkGridNarrow: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' },
  networkMetric: { padding: '12px', backgroundColor: 'var(--primary-light)', borderRadius: 'var(--radius)', textAlign: 'center' as const },
  metricLabel: { fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' },
  metricValue: { fontSize: '20px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '8px' },
  metricBar: { height: '4px', backgroundColor: '#10b981', borderRadius: '2px', transition: 'width 0.3s' },
};
