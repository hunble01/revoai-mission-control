import './globals.css';
import { AppShell } from '../components/AppShell';

export const metadata = {
  title: 'RevoAI Mission Control',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
