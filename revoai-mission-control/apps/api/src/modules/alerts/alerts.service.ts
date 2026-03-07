import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const now = Date.now();
    const since24h = new Date(now - 24 * 60 * 60 * 1000);
    const since2h = new Date(now - 2 * 60 * 60 * 1000);

    const [importRuns, approvalsStaleCount, schedulerFailures] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { action: 'lead.import.csv', createdAt: { gte: since24h } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.draft.count({ where: { status: 'NEEDS_APPROVAL', updatedAt: { lt: since2h } } }),
      this.prisma.schedulerRun.findMany({
        where: { status: 'failed', startedAt: { gte: since24h } },
        orderBy: { startedAt: 'desc' },
        take: 50,
      }),
    ]);

    const importFailures = importRuns.filter((r: any) => {
      const md: any = r.metadata || {};
      return Number(md.invalidRows || 0) > 0 || Number(md.imported || 0) === 0;
    }).length;

    const alerts: Array<{ key: string; severity: 'high' | 'medium' | 'low'; status: 'ok' | 'warn'; message: string; value: number }> = [];

    alerts.push({
      key: 'import_failures_24h',
      severity: importFailures >= 5 ? 'high' : importFailures > 0 ? 'medium' : 'low',
      status: importFailures > 0 ? 'warn' : 'ok',
      message: importFailures > 0 ? `${importFailures} problematic import runs in last 24h` : 'No problematic import runs in last 24h',
      value: importFailures,
    });

    alerts.push({
      key: 'approvals_stall_2h',
      severity: approvalsStaleCount >= 10 ? 'high' : approvalsStaleCount > 0 ? 'medium' : 'low',
      status: approvalsStaleCount > 0 ? 'warn' : 'ok',
      message: approvalsStaleCount > 0 ? `${approvalsStaleCount} approval drafts stale >2h` : 'No stale approvals >2h',
      value: approvalsStaleCount,
    });

    alerts.push({
      key: 'scheduler_failures_24h',
      severity: schedulerFailures.length >= 3 ? 'high' : schedulerFailures.length > 0 ? 'medium' : 'low',
      status: schedulerFailures.length > 0 ? 'warn' : 'ok',
      message: schedulerFailures.length > 0 ? `${schedulerFailures.length} scheduler failures in last 24h` : 'No scheduler failures in last 24h',
      value: schedulerFailures.length,
    });

    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      alerts,
    };
  }
}
