import type { Metadata } from 'next';
import './globals.css';
import AppShell from '@/components/AppShell';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'Sapto Wahyu Sudrajat - Teaching Portal',
  description: 'Personal Teaching Portfolio & Claim Portal for INIXINDO Surabaya',
};

/**
 * Dijalankan sebelum halaman digambar, supaya pengguna mode gelap tidak
 * melihat kedipan putih lebih dulu. Sengaja ditulis ringkas dan defensif:
 * bila localStorage diblokir, tema jatuh ke pengaturan sistem.
 */
const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('sapto-portal-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored === 'dark' || stored === 'light' ? stored : (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
