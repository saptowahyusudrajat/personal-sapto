import SensorDashboard from '@/components/SensorDashboard';

export const metadata = {
  title: 'Monitoring Suhu, Kelembaban & Ping',
  description: 'Pemantauan suhu, kelembaban, dan ping internet secara real-time (sensor DHT11).',
};

/** Halaman publik: bisa dibuka tanpa login (lihat PUBLIC_PATHS di AppShell). */
export default function PublicMonitoringPage() {
  return <SensorDashboard isPublic />;
}
