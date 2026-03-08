import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService) {}

  async getSafety() {
    const keys = [
      'dry_run_mode',
      'outbound_channels',
      'global_pause',
      'research_agent_settings',
      'rate_limit_guardrails',
      'content_defaults',
      'notification_settings',
    ];
    const rows = await this.prisma.setting.findMany({ where: { key: { in: keys } } });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async updateSafety(payload: any) {
    const updates: Array<{ key: string; value: any }> = [];
    if (typeof payload?.dryRunEnabled === 'boolean') {
      updates.push({ key: 'dry_run_mode', value: { enabled: payload.dryRunEnabled } });
    }
    if (payload?.outboundChannels) {
      updates.push({ key: 'outbound_channels', value: payload.outboundChannels });
    }
    if (typeof payload?.globalPause === 'boolean') {
      updates.push({ key: 'global_pause', value: { paused: payload.globalPause } });
    }
    if (payload?.researchAgentSettings) {
      updates.push({ key: 'research_agent_settings', value: payload.researchAgentSettings });
    }
    if (payload?.rateLimitGuardrails) {
      updates.push({ key: 'rate_limit_guardrails', value: payload.rateLimitGuardrails });
    }
    if (payload?.contentDefaults) {
      updates.push({ key: 'content_defaults', value: payload.contentDefaults });
    }
    if (payload?.notificationSettings) {
      updates.push({ key: 'notification_settings', value: payload.notificationSettings });
    }

    for (const u of updates) {
      await this.prisma.setting.upsert({ where: { key: u.key }, create: { key: u.key, value: u.value }, update: { value: u.value } });
      await this.events.publish({ eventType: `safety.${u.key}.updated`, payload: u.value });
    }

    return this.getSafety();
  }

  async clearDraftQueue() {
    await this.prisma.draft.deleteMany({ where: { status: { in: ['DRAFT', 'NEEDS_APPROVAL'] as any } as any } });
    await this.events.publish({ eventType: 'safety.danger.clear_draft_queue', payload: { ok: true } });
    return { ok: true };
  }

  async resetAgentStates() {
    await this.prisma.agent.updateMany({ data: { status: 'IDLE', currentTaskId: null } as any });
    await this.events.publish({ eventType: 'safety.danger.reset_agent_states', payload: { ok: true } });
    return { ok: true };
  }

  async assertOutboundAllowed(channel: 'email' | 'facebook' | 'instagram' | 'linkedin') {
    const safety = await this.getSafety();
    const dry = (safety?.dry_run_mode as any)?.enabled;
    const channels = (safety?.outbound_channels as any) || {};

    if (dry) throw new BadRequestException('dry-run mode is enabled; outbound execution blocked');
    if (!channels[channel]) throw new BadRequestException(`${channel} outbound toggle is OFF`);

    const providerMap: Record<string, 'EMAIL' | 'FACEBOOK' | 'INSTAGRAM' | 'LINKEDIN'> = {
      email: 'EMAIL',
      facebook: 'FACEBOOK',
      instagram: 'INSTAGRAM',
      linkedin: 'LINKEDIN',
    };

    const provider = providerMap[channel];
    const connection = await this.prisma.connection.findUnique({ where: { provider } });
    if (!connection || connection.status !== 'CONNECTED' || connection.health !== 'HEALTHY') {
      throw new BadRequestException(`${channel} provider is not connected/healthy`);
    }
  }
}
