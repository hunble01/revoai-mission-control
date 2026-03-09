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
      'content_intelligence',
      'competitors',
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
    if (payload?.contentTopics || payload?.contentExcludeTopics || payload?.youtubeChannels || payload?.youtubeSearchTerms || payload?.linkedinFrequency || payload?.linkedinDays || payload?.facebookFrequency || payload?.facebookDays || payload?.postTime || typeof payload?.offsetPlatforms === 'boolean' || payload?.newsSources) {
      updates.push({
        key: 'content_intelligence',
        value: {
          contentTopics: payload?.contentTopics || [],
          contentExcludeTopics: payload?.contentExcludeTopics || [],
          newsSources: payload?.newsSources || {},
          youtubeChannels: payload?.youtubeChannels || [],
          youtubeSearchTerms: payload?.youtubeSearchTerms || [],
          linkedinFrequency: payload?.linkedinFrequency || 'EVERY_2_DAYS',
          linkedinDays: payload?.linkedinDays || ['Mon', 'Wed', 'Fri'],
          facebookFrequency: payload?.facebookFrequency || 'EVERY_2_DAYS',
          facebookDays: payload?.facebookDays || ['Tue', 'Thu', 'Sat'],
          postTime: payload?.postTime || '09:00',
          offsetPlatforms: typeof payload?.offsetPlatforms === 'boolean' ? payload.offsetPlatforms : true,
        },
      });
    }
    if (payload?.competitors) {
      updates.push({ key: 'competitors', value: payload.competitors });
    }

    for (const u of updates) {
      await this.prisma.setting.upsert({ where: { key: u.key }, create: { key: u.key, value: u.value }, update: { value: u.value } });
      await this.events.publish({ eventType: `safety.${u.key}.updated`, payload: u.value });
    }

    return this.getSafety();
  }

  async getBrand() {
    const row = await this.prisma.brandSettings.findUnique({ where: { id: 'default' } });
    if (row) return row;
    return this.prisma.brandSettings.create({ data: { id: 'default' } as any });
  }

  async saveBrand(payload: any) {
    const data = {
      yourName: payload?.yourName || null,
      yourTitle: payload?.yourTitle || null,
      companyName: payload?.companyName || null,
      phoneNumber: payload?.phoneNumber || null,
      websiteUrl: payload?.websiteUrl || null,
      logoData: payload?.logoData || null,
      signatureStyle: payload?.signatureStyle || 'Professional',
    };
    const saved = await this.prisma.brandSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...(data as any) },
      update: data as any,
    });
    await this.events.publish({ eventType: 'settings.brand.updated', payload: { signatureStyle: saved.signatureStyle } });
    return saved;
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
