'use client';

import React, { useEffect, useState } from 'react';
import { Thermometer, Droplets } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SensorReading {
  id: number;
  device_id: string;
  temperature: number;
  humidity: number;
  timestamp: number;
}

interface ChartData {
  time: string;
  temp: number;
  humidity: number;
}

export default function SensorDashboard() {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [useCustomRange, setUseCustomRange] = useState(false);

  const latestReading = chartData.length > 0 ? chartData[chartData.length - 1] : null;

  const fetchData = async (newDays?: number, custom?: boolean) => {
    setLoading(true);
    setError(null);
    try {
      let url = '/api/sensor';
      if (custom && startDate && endDate) {
        url += `?start_date=${startDate}&end_date=${endDate}`;
      } else {
        const daysToFetch = newDays || days;
        url += `?days=${daysToFetch}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch data');
      const { data } = await res.json();
      const formatted = data.map((item: SensorReading) => ({
        time: new Date(item.timestamp * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        temp: item.temperature,
        humidity: item.humidity,
      }));
      setChartData(formatted);
    } catch (err: any) {
      setError(err.message || 'Error fetching data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh setiap 10 detik
    const interval = setInterval(() => {
      fetchData();
    }, 10000);

    return () => clearInterval(interval);
  }, [days, useCustomRange, startDate, endDate]);

  const handleDaysChange = (newDays: number) => {
    setDays(newDays);
    setUseCustomRange(false);
    fetchData(newDays, false);
  };

  const handleCustomRange = () => {
    if (startDate && endDate) fetchData(undefined, true);
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

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Monitoring Suhu & Kelembaban</h1>
        {latestReading && <div style={styles.lastUpdate}>Updated: {new Date().toLocaleString('id-ID')}</div>}
      </div>
      {error && <div style={styles.errorBox}>{error}</div>}

      {latestReading && (
        <div style={styles.realtimeBox}>
          <div style={styles.realtimeCard}>
            <div style={styles.realtimeHeader}>
              <Thermometer size={24} color="#f59e0b" />
              <span style={styles.realtimeLabel}>Suhu Real-time</span>
            </div>
            <div style={styles.realtimeValue}>{latestReading.temp.toFixed(1)}°C</div>
            <div style={styles.realtimeTime}>Updated: {new Date().toLocaleTimeString('id-ID')}</div>
          </div>

          <div style={styles.realtimeCard}>
            <div style={styles.realtimeHeader}>
              <Droplets size={24} color="#10b981" />
              <span style={styles.realtimeLabel}>Kelembaban Real-time</span>
            </div>
            <div style={styles.realtimeValue}>{latestReading.humidity.toFixed(0)}%</div>
            <div style={styles.realtimeTime}>Updated: {new Date().toLocaleTimeString('id-ID')}</div>
          </div>
        </div>
      )}

      <div style={styles.filterBox}>
        <div style={styles.filterGroup}>
          <label style={styles.label}>Quick Range:</label>
          <div style={styles.buttonGroup}>
            {[7, 14, 30, 90].map((d) => (
              <button key={d} onClick={() => handleDaysChange(d)} style={{ ...styles.filterButton, ...(days === d && !useCustomRange ? styles.filterButtonActive : {}) }}>
                {d} hari
              </button>
            ))}
          </div>
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.label}>Custom Range:</label>
          <div style={styles.dateInputGroup}>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={styles.dateInput} />
            <span style={styles.toLabel}>to</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={styles.dateInput} />
            <button onClick={handleCustomRange} style={{ ...styles.filterButton, ...(useCustomRange ? styles.filterButtonActive : {}) }}>Filter</button>
          </div>
        </div>
      </div>
      {loading ? (
        <div style={styles.loading}>Loading data...</div>
      ) : chartData.length === 0 ? (
        <div style={styles.noData}>No data available</div>
      ) : (
        <>
          <div style={styles.card}>
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
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="temp" stroke="#f59e0b" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={styles.card}>
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
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="humidity" stroke="#10b981" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  container: { display: 'flex' as const, flexDirection: 'column' as const, gap: '24px' },
  header: { display: 'flex' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  title: { fontSize: '24px', fontWeight: 700, color: 'var(--foreground)', margin: 0 },
  lastUpdate: { fontSize: '13px', color: 'var(--text-muted)' },
  realtimeBox: { display: 'grid' as const, gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' },
  realtimeCard: { backgroundColor: 'var(--card-bg)', border: '2px solid var(--primary-light)', borderRadius: 'var(--radius)', padding: '24px', textAlign: 'center' as const },
  realtimeHeader: { display: 'flex' as const, alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px' },
  realtimeLabel: { fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)' },
  realtimeValue: { fontSize: '48px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '8px' },
  realtimeTime: { fontSize: '12px', color: 'var(--text-muted)' },
  errorBox: { padding: '12px 16px', backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: 'var(--radius)', color: '#dc2626', fontSize: '14px' },
  filterBox: { backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius)', padding: '16px', display: 'flex' as const, flexDirection: 'column' as const, gap: '16px' },
  filterGroup: { display: 'flex' as const, alignItems: 'center' as const, gap: '12px', flexWrap: 'wrap' as const },
  label: { fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', minWidth: '100px' },
  buttonGroup: { display: 'flex' as const, gap: '8px', flexWrap: 'wrap' as const },
  filterButton: { padding: '6px 12px', fontSize: '14px', fontWeight: 500, backgroundColor: 'var(--primary-light)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius)', color: 'var(--foreground)', cursor: 'pointer' },
  filterButtonActive: { backgroundColor: 'var(--primary)', color: 'white', borderColor: 'var(--primary)' },
  dateInputGroup: { display: 'flex' as const, alignItems: 'center' as const, gap: '8px', flexWrap: 'wrap' as const },
  dateInput: { padding: '6px 10px', fontSize: '14px', border: '1px solid var(--card-border)', borderRadius: 'var(--radius)', backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' },
  toLabel: { fontSize: '14px', color: 'var(--text-muted)' },
  loading: { textAlign: 'center' as const, padding: '40px 20px', color: 'var(--text-muted)' },
  noData: { textAlign: 'center' as const, padding: '40px 20px', color: 'var(--text-muted)' },
  card: { backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius)', padding: '20px' },
  cardHeader: { display: 'flex' as const, alignItems: 'center' as const, gap: '12px', marginBottom: '12px' },
  cardTitle: { fontSize: '16px', fontWeight: 600, color: 'var(--foreground)', margin: 0 },
  stats: { display: 'flex' as const, gap: '16px', marginBottom: '16px', fontSize: '13px', color: 'var(--text-muted)', flexWrap: 'wrap' as const },
};
