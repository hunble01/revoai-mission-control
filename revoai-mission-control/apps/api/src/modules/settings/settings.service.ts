import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService) {}

  async getSafety() {
    const rows = await this.prisma.setting.findMany({ where: { key: { in: ['dry_run_mode', 'outbound_channels', 'global_pause'] } } });
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

    for (const u of updates) {
      await this.prisma.setting.upsert({ where: { key: u.key }, create: { key: u.key, value: u.value }, update: { value: u.value } });
      await this.events.publish({ eventType: `safety.${u.key}.updated`, payload: u.value });
    }

    return this.getSafety();
  }

  async assertOutboundAllowed(channel: 'email' | 'facebook' | 'instagram' | 'linkedin') {
    const safety = await this.getSafety();
    const dry = (safety?.dry_run_mode as any)?.enabled;
    const channels = (safety?.outbound_channels as any) || {};

    if (dry) throw new BadRequestException('dry-run mode is enabled; outbound execution blocked');
    if (!channels[channel]) throw new BadRequestException(`${channel} outbound toggle is OFF`);
  }
}
