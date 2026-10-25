import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type ServiceStatus = {
  name: string;
  status: 'Healthy' | 'Degraded' | 'Down' | 'Unknown';
  responseTime?: number;
  lastChecked: string;
  detail?: string;
  error?: string;
};

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Minimal liveness probe — used by Docker healthcheck. Stays fast. */
  @Get('live')
  live() {
    return { ok: true, service: 'revoai-mission-control-api' };
  }

  /**
   * Full health report for the /health page. Runs actual checks against
   * each subsystem and returns a services array consumed by the UI.
   */
  @Get()
  async health() {
    const services = await Promise.all([
      this.checkDb(),
      this.checkResend(),
      this.checkAnthropic(),
      this.checkGoogleMaps(),
      this.checkCrons(),
      this.checkProviders(),
    ]);
    const worst = services.some((s) => s.status === 'Down')
      ? 'Down'
      : services.some((s) => s.status === 'Degraded')
      ? 'Degraded'
      : 'Healthy';
    return { ok: worst === 'Healthy', service: 'revoai-mission-control-api', overall: worst, services };
  }

  private async checkDb(): Promise<ServiceStatus> {
    const now = new Date().toISOString();
    const t0 = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { name: 'Database', status: 'Healthy', responseTime: Date.now() - t0, lastChecked: now };
    } catch (err: any) {
      return { name: 'Database', status: 'Down', lastChecked: now, error: String(err?.message || err) };
    }
  }

  private async checkResend(): Promise<ServiceStatus> {
    const now = new Date().toISOString();
    const key = (process.env.EMAIL_SMTP_PASS || '').trim();
    if (!key.startsWith('re_')) {
      return { name: 'Email Service (Resend)', status: 'Unknown', lastChecked: now, detail: 'EMAIL_SMTP_PASS not a Resend key' };
    }
    const t0 = Date.now();
    try {
      const resp = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!resp.ok) return { name: 'Email Service (Resend)', status: 'Degraded', responseTime: Date.now() - t0, lastChecked: now, error: `HTTP ${resp.status}` };
      const body: any = await resp.json().catch(() => ({}));
      const count = Array.isArray(body?.data) ? body.data.length : 0;
      return { name: 'Email Service (Resend)', status: 'Healthy', responseTime: Date.now() - t0, lastChecked: now, detail: `${count} verified domain(s)` };
    } catch (err: any) {
      return { name: 'Email Service (Resend)', status: 'Down', lastChecked: now, error: String(err?.message || err) };
    }
  }

  private async checkAnthropic(): Promise<ServiceStatus> {
    const now = new Date().toISOString();
    const key = (process.env.ANTHROPIC_API_KEY || '').trim();
    if (!key) return { name: 'Claude AI (Anthropic)', status: 'Unknown', lastChecked: now, detail: 'ANTHROPIC_API_KEY missing' };
    const valid = /^sk-ant-[a-zA-Z0-9_-]{20,}$/.test(key);
    return {
      name: 'Claude AI (Anthropic)',
      status: valid ? 'Healthy' : 'Degraded',
      lastChecked: now,
      detail: valid ? `model=${process.env.ANTHROPIC_MODEL || 'default'}` : 'key format looks wrong',
    };
  }

  private async checkGoogleMaps(): Promise<ServiceStatus> {
    const now = new Date().toISOString();
    const key = (process.env.GOOGLE_MAPS_API_KEY || '').trim();
    if (!key) return { name: 'Google Maps (Places API)', status: 'Unknown', lastChecked: now, detail: 'GOOGLE_MAPS_API_KEY missing' };
    const valid = /^AIza[0-9A-Za-z_-]{20,}$/.test(key);
    return {
      name: 'Google Maps (Places API)',
      status: valid ? 'Healthy' : 'Degraded',
      lastChecked: now,
      detail: valid ? 'key format valid' : 'key format looks wrong',
    };
  }

  private async checkCrons(): Promise<ServiceStatus> {
    const now = new Date().toISOString();
    const flags = {
      followup: String(process.env.FOLLOWUP_AUTOCRON || 'on') !== 'off',
      scheduled: String(process.env.SCHEDULED_AUTORUN || 'on') !== 'off',
      queueDrain: String(process.env.QUEUE_DRAIN || 'on') !== 'off',
      deliveryTracker: String(process.env.DELIVERY_TRACKER_AUTOCRON || 'on') !== 'off',
    };
    const enabled = Object.values(flags).filter(Boolean).length;
    const total = Object.keys(flags).length;
    return {
      name: 'Background Crons',
      status: enabled === total ? 'Healthy' : enabled > 0 ? 'Degraded' : 'Down',
      lastChecked: now,
      detail: `${enabled}/${total} enabled — follow-up · scheduled-autorun · queue-drain · delivery-tracker`,
    };
  }

  private async checkProviders(): Promise<ServiceStatus> {
    const now = new Date().toISOString();
    try {
      const providers = await this.prisma.providerToken.findMany({ select: { provider: true, expiresAt: true } });
      const valid = providers.filter((p: any) => !p.expiresAt || new Date(p.expiresAt) > new Date());
      const list = valid.map((p: any) => p.provider).join(', ') || 'none connected';
      return {
        name: 'OAuth Connections',
        status: valid.length > 0 ? 'Healthy' : 'Degraded',
        lastChecked: now,
        detail: `${valid.length} active: ${list}`,
      };
    } catch (err: any) {
      return { name: 'OAuth Connections', status: 'Unknown', lastChecked: now, error: String(err?.message || err) };
    }
  }

  @Get('history')
  async history() {
    const rows = await this.prisma.auditLog.findMany({
      where: { action: { contains: 'health' } },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });
    return rows.map((r: any) => ({
      timestamp: r.createdAt,
      service: r.resourceType || 'system',
      status: r.action,
      detail: r.metadata ? JSON.stringify(r.metadata).slice(0, 120) : '',
    }));
  }
}
