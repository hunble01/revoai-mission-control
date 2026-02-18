export const metadata = {
  title: 'RevoAI Mission Control',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'Inter, system-ui, sans-serif', background: '#0b1020', color: '#e8ecf1' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', minHeight: '100vh' }}>
          <aside style={{ borderRight: '1px solid #1c2540', padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>Mission Control</h2>
            <nav style={{ display: 'grid', gap: 8 }}>
              <a href="/board">Board</a>
              <a href="/agents">Agents</a>
              <a href="/feed">Live Feed</a>
              <a href="/approvals">Approvals</a>
              <a href="/leads">Leads</a>
              <a href="/drafts">Drafts</a>
              <a href="/campaigns">Campaigns</a>
              <a href="/scheduler">Scheduler</a>
              <a href="/audit">Audit</a>
            </nav>
          </aside>
          <main style={{ padding: 20 }}>{children}</main>
        </div>
      </body>
    </html>
  );
}
