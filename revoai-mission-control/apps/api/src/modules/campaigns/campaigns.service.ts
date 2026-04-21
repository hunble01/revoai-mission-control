import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService) {}

  private normalizeStatus(v?: string) {
    const s = String(v || 'active').toLowerCase();
    if (s === 'paused' || s === 'archived') return s;
    return 'active';
  }

  private withDefaults(data: any) {
    return {
      name: data.name,
      niche: data.niche || 'Other',
      subNiche: data.subNiche || null,
      geography: data.geography || data.geographyCity || 'Any',
      geographyCity: data.geographyCity || null,
      geographyRadius: data.geographyRadius || 'Any',
      geographyRegion: data.geographyRegion || null,
      minScore: data.minScore ?? 'B',
      outreachTemplates: data.outreachTemplates ?? {},
      contentThemes: data.contentThemes ?? [],
      metrics: data.metrics ?? {},
      companySize: Array.isArray(data.companySize) ? data.companySize : [],
      revenueRange: data.revenueRange || 'Any',
      contactType: Array.isArray(data.contactType) ? data.contactType : [],
      hasContactInfo: Array.isArray(data.hasContactInfo) ? data.hasContactInfo : [],
      defaultChannel: data.defaultChannel || 'Email',
      dailySendLimit: Number(data.dailySendLimit || 20),
      dataSources: data.dataSources ?? {},
      spreadsheetData: data.spreadsheetData ?? null,
      notes: data.notes || null,
      painPoint: data.painPoint || null,
      yourOffer: data.yourOffer || null,
      yourProof: data.yourProof || null,
      emailSubjectTemplate: data.emailSubjectTemplate || null,
      emailBodyTemplate: data.emailBodyTemplate || null,
      emailAiGenerate: typeof data.emailAiGenerate === 'boolean' ? data.emailAiGenerate : true,
      dmBodyTemplate: data.dmBodyTemplate || null,
      dmAiGenerate: typeof data.dmAiGenerate === 'boolean' ? data.dmAiGenerate : true,
      followupEnabled: typeof data.followupEnabled === 'boolean' ? data.followupEnabled : false,
      followupSequence: data.followupSequence ?? [],
      sendWindowFrom: data.sendWindowFrom || null,
      sendWindowTo: data.sendWindowTo || null,
      sendDays: Array.isArray(data.sendDays) ? data.sendDays : [],
      status: this.normalizeStatus(data.status),
      isActive: this.normalizeStatus(data.status) === 'active',
    };
  }

  async list() {
    const campaigns = await this.prisma.campaign.findMany({ orderBy: { createdAt: 'desc' } });
    const leads = await this.prisma.lead.findMany({ select: { campaignId: true, status: true } });
    const counts: Record<string, any> = {};
    for (const l of leads) {
      const k = l.campaignId;
      if (!counts[k]) counts[k] = { leadsCount: 0, contactedCount: 0, repliedCount: 0, bookedCount: 0 };
      counts[k].leadsCount += 1;
      const s = String(l.status || '').toUpperCase();
      if (s === 'CONTACTED') counts[k].contactedCount += 1;
      if (s === 'REPLIED') counts[k].repliedCount += 1;
      if (s === 'BOOKED') counts[k].bookedCount += 1;
    }
    return campaigns.map((c: any) => ({ ...c, ...(counts[c.id] || { leadsCount: 0, contactedCount: 0, repliedCount: 0, bookedCount: 0 }) }));
  }

  async create(data: any) {
    const payload = this.withDefaults(data);
    const campaign = await this.prisma.campaign.create({ data: payload });
    await this.events.publish({ eventType: 'campaign.created', campaignId: campaign.id, payload: campaign });
    return campaign;
  }

  async update(id: string, data: any) {
    const existing = await this.prisma.campaign.findUnique({ where: { id } });
    if (!existing) throw new BadRequestException('Campaign not found.');
    const next = this.withDefaults({ ...existing, ...data });
    const campaign = await this.prisma.campaign.update({ where: { id }, data: next });
    await this.events.publish({ eventType: 'campaign.updated', campaignId: id, payload: next });
    return campaign;
  }

  async remove(id: string) {
    await this.prisma.campaign.delete({ where: { id } });
    await this.events.publish({ eventType: 'campaign.deleted', campaignId: id, payload: { id } });
    return { ok: true };
  }

  async clone(id: string) {
    const c = await this.prisma.campaign.findUnique({ where: { id } });
    if (!c) throw new BadRequestException('Campaign not found.');
    const copy = await this.prisma.campaign.create({
      data: {
        ...c,
        id: undefined as any,
        name: `Copy of — ${c.name}`,
        createdAt: undefined as any,
        updatedAt: undefined as any,
      },
    });
    await this.events.publish({ eventType: 'campaign.cloned', campaignId: copy.id, payload: { from: id } });
    return copy;
  }

  async upload(id: string, body: any) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new BadRequestException('Campaign not found.');
    const current = (campaign.spreadsheetData as any) || { rows: [] };
    const nextRows = Array.isArray(body?.rows) ? body.rows : [];
    const mapped = {
      fileName: body?.fileName || 'upload.csv',
      mapping: body?.mapping || {},
      rows: nextRows,
      uploadedAt: new Date().toISOString(),
    };
    const updated = await this.prisma.campaign.update({ where: { id }, data: { spreadsheetData: { ...current, ...mapped } as any } });
    await this.events.publish({ eventType: 'campaign.uploaded', campaignId: id, payload: { fileName: mapped.fileName, rows: nextRows.length } });
    return updated;
  }
}
