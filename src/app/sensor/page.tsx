import SensorDashboard from '@/components/SensorDashboard';

export const metadata = {
  title: 'Monitoring Suhu & Kelembaban | Teaching Portal',
  description: 'Real-time sensor monitoring DHT11',
};

export default function SensorPage() {
  return <SensorDashboard />;
}
