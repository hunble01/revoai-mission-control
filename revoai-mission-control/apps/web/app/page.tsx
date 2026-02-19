import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Table } from '../components/ui/Table';

const kpis = [
  { label: 'Pipeline Revenue', value: '$10,312.10', delta: '+18.4% vs last month' },
  { label: 'Total Sales Projects', value: '224', delta: '+9.2% vs last month' },
  { label: 'Total Deals', value: '3,612', delta: '+6.1% vs last month' },
  { label: 'Conversion Rate', value: '67%', delta: '+1.2% vs last month' },
];

export default function Home() {
  return (
    <div className="dash-stack">
      <section className="kpi-grid">
        {kpis.map((k) => (
          <Card key={k.label}>
            <p className="kpi-title">{k.label}</p>
            <p className="kpi-value">{k.value}</p>
            <p className="kpi-sub">{k.delta}</p>
          </Card>
        ))}
      </section>

      <section className="split-panels">
        <Card title="Lead Sources" subtitle="Last 30 days">
          <div className="donut-wrap" role="img" aria-label="Lead source split chart">
            <div className="donut">
              <div className="donut-hole">
                <strong>3521</strong>
                <span>Total leads</span>
              </div>
            </div>
            <ul className="legend">
              <li><span className="dot dot-1" /> Website <b>1445</b></li>
              <li><span className="dot dot-2" /> Paid Ads <b>803</b></li>
              <li><span className="dot dot-3" /> Emails <b>722</b></li>
              <li><span className="dot dot-4" /> Referral <b>451</b></li>
            </ul>
          </div>
        </Card>

        <Card title="Revenue Flow" subtitle="Total Revenue (Last 6 Months)">
          <p className="rev-number">$272,500</p>
          <div className="line-chart" role="img" aria-label="Revenue trend line chart">
            <div className="gridline" />
            <div className="gridline" />
            <div className="gridline" />
            <svg viewBox="0 0 300 120" preserveAspectRatio="none" aria-hidden>
              <polyline points="10,90 55,82 100,66 145,72 190,54 235,42 290,28" />
            </svg>
          </div>
          <div className="legend-inline">
            <Badge tone="info">This Year</Badge>
            <Badge>Prev Year</Badge>
          </div>
        </Card>
      </section>

      <Card title="Active Deals" subtitle="Recent opportunities">
        <div className="table-toolbar">
          <Input placeholder="Search deals..." aria-label="Search deals" />
          <Button variant="ghost">Filter</Button>
          <Button variant="secondary">Import</Button>
          <Button variant="primary">+ New</Button>
        </div>

        <Table>
          <thead>
            <tr>
              <th>Deal Name</th>
              <th>Client</th>
              <th>Stage</th>
              <th>Value</th>
              <th>Owner</th>
              <th>Expected Close</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>TechCorp Upgrade</td>
              <td>TechCorp Inc.</td>
              <td><Badge tone="info">Negotiation</Badge></td>
              <td>$11,600</td>
              <td>Alex Ray</td>
              <td>Jul 21, 2026</td>
            </tr>
            <tr>
              <td>Clinic Follow-up Automation</td>
              <td>Northside Clinic</td>
              <td><Badge tone="warning">Review</Badge></td>
              <td>$7,400</td>
              <td>Jamie K</td>
              <td>Jul 25, 2026</td>
            </tr>
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
