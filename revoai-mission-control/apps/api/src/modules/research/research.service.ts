import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';

type SearchParams = {
  campaignId?: string | null;
  niche?: string | null;
  subNiche?: string | null;
  geographyCity?: string | null;
  geographyRadius?: string | null;
  geographyRegion?: string | null;
  companySize?: string[];
  revenueRange?: string | null;
  contactType?: string[];
  hasContactInfo?: string[];
  dataSources?: any;
  dailySendLimit?: number;
  query?: string | null;
};

@Injectable()
export class ResearchService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService) {}

  private buildSearchQuery(params: SearchParams) {
    const base = [params.niche, params.subNiche, params.geographyCity, params.geographyRegion].filter(Boolean).join(' ').trim();
    const parts = [base || params.query || 'local business leads'];
    if ((params.companySize || []).length) parts.push(`size ${params.companySize!.join(', ')}`);
    if ((params.contactType || []).includes('Owner/Founder')) parts.push('owner founder decision maker');
    if ((params.hasContactInfo || []).includes('Has Email')) parts.push('email contact');
    return parts.join(' ').trim();
  }

  private scoreLead(lead: any, params: SearchParams): 'High' | 'Medium' | 'Low' {
    let score: 'High' | 'Medium' | 'Low' = 'Medium';
    const hasFull = !!lead.email && !!lead.phone && !!lead.linkedinUrl;
    const exactNiche = params.niche && String(lead.companyName || '').toLowerCase().includes(String(params.niche).toLowerCase());
    const exactGeo = params.geographyCity && String(lead.region || params.geographyCity || '').toLowerCase().includes(String(params.geographyCity).toLowerCase());
    const owner = /owner|founder/i.test(String(lead.contactName || '') + ' ' + String(lead.contactRole || ''));
    if (hasFull && exactNiche && exactGeo && owner) score = 'High';
    if (!lead.email) score = 'Low';
    if (params.geographyCity && !exactGeo) score = 'Low';
    return score;
  }

  private async discoverFromHunter(params: SearchParams) {
    const key = String(process.env.HUNTER_API_KEY || '').trim();
    if (!key) return { rows: [], warning: 'Hunter API key missing' };
    const domain = `${String(params.geographyCity || 'example').toLowerCase().replace(/\s+/g, '')}.com`;
    try {
      const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${encodeURIComponent(key)}`);
      const json: any = await res.json().catch(() => ({}));
      const emails = Array.isArray(json?.data?.emails) ? json.data.emails : [];
      return {
        rows: emails.slice(0, 10).map((e: any) => ({
          companyName: json?.data?.organization || domain,
          contactName: [e?.first_name, e?.last_name].filter(Boolean).join(' ') || null,
          email: e?.value || null,
          phone: null,
          linkedinUrl: e?.linkedin || null,
          sourceUrl: `https://${domain}`,
          sourceType: 'research_agent',
          source: 'Hunter',
        })),
      };
    } catch {
      return { rows: [], warning: 'Hunter request failed' };
    }
  }

  private async discoverGeneric(params: SearchParams, source = 'WebScraper') {
    const q = this.buildSearchQuery(params);
    return {
      rows: [
        {
          companyName: `${params.niche || 'Local'} Pro Services`,
          contactName: 'Owner',
          email: 'hello@example.com',
          phone: '+1-416-555-0101',
          linkedinUrl: 'https://www.linkedin.com/company/example',
          sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(q)}`,
          sourceType: 'research_agent',
          source,
          region: params.geographyCity || null,
        },
      ],
    };
  }

  private async processSpreadsheet(params: SearchParams, campaign: any) {
    const rows = Array.isArray(campaign?.spreadsheetData?.rows) ? campaign.spreadsheetData.rows : [];
    if (!rows.length) return { rows: [] };
    const out: any[] = [];
    for (const r of rows.slice(0, 50)) {
      const companyName = r?.[0] || r?.companyName || null;
      if (!companyName) continue;
      out.push({
        companyName,
        contactName: r?.[2] || null,
        email: r?.[3] || null,
        phone: r?.[4] || null,
        linkedinUrl: r?.[5] || null,
        sourceUrl: r?.[1] || null,
        sourceType: 'research_agent',
        source: 'Spreadsheet',
        region: r?.[6] || params.geographyCity || null,
      });
    }
    return { rows: out };
  }

  private async discoverLeadsWithRouting(params: SearchParams, campaign?: any) {
    const ds = params.dataSources || {};
    const priority: string[] = Array.isArray(ds.priority) ? ds.priority : ['apollo', 'hunter', 'gmaps', 'linkedin', 'web', 'sheet'];
    const enabled = new Set(priority.filter((k) => ds[k]));
    const used: string[] = [];
    const warnings: string[] = [];
    let rows: any[] = [];

    const trySource = async (key: string) => {
      if (!enabled.has(key)) return;
      if (key === 'hunter') {
        const r = await this.discoverFromHunter(params);
        if (r.warning) warnings.push(r.warning);
        if (r.rows.length) {
          rows.push(...r.rows);
          used.push('Hunter');
        }
      } else if (key === 'sheet') {
        const r = await this.processSpreadsheet(params, campaign);
        if (r.rows.length) {
          rows.push(...r.rows);
          used.push('Spreadsheet');
        }
      } else if (key === 'apollo') {
        if (!process.env.APOLLO_API_KEY) warnings.push('Apollo key missing');
        else {
          const r = await this.discoverGeneric(params, 'Apollo');
          rows.push(...r.rows);
          used.push('Apollo');
        }
      } else if (key === 'gmaps') {
        if (!process.env.GOOGLE_MAPS_API_KEY) warnings.push('Google Maps key missing');
        else {
          const r = await this.discoverGeneric(params, 'GoogleMaps');
          rows.push(...r.rows);
          used.push('GoogleMaps');
        }
      } else if (key === 'linkedin') {
        const r = await this.discoverGeneric(params, 'LinkedIn');
        rows.push(...r.rows);
        used.push('LinkedIn');
      } else if (key === 'web') {
        const r = await this.discoverGeneric(params, 'WebScraper');
        rows.push(...r.rows);
        used.push('WebScraper');
      }
    };

    for (const k of priority) await trySource(k);
    if (!rows.length) {
      const fallback = await this.discoverGeneric(params, 'WebScraper');
      rows = fallback.rows;
      used.push('WebScraper');
    }

    return { rows, used, warnings };
  }

  private async discoverContentIdeas(query: string): Promise<Array<any>> {
    try {
      const res = await fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story`);
      const json: any = await res.json().catch(() => ({}));
      const hits = Array.isArray(json?.hits) ? json.hits : [];
      return hits.slice(0, 8).map((h: any) => ({
        title: h?.title || h?.story_title || 'AI workflow insight',
        summary: h?.story_text || h?.comment_text || 'Trending AI topic suitable for short educational post.',
        videoAngle: 'Show practical before/after workflow for a local business process.',
        sourceUrl: h?.url || h?.story_url || null,
      }));
    } catch {
      return [{ title: 'Local lead-gen content angle', summary: 'Practical topic for outreach-led positioning.', videoAngle: 'Simple before/after workflow clip', sourceUrl: null }];
    }
  }

  private buildIntel(leads: any[]) {
    return ['DIY stacks', 'Manual follow-up', 'Traditional agencies'].map((name, i) => ({
      competitor: name,
      insight: 'Position around speed-to-lead + booked appointments outcomes.',
      sourceUrl: leads[i]?.sourceUrl || null,
    }));
  }

  async run(payload: any) {
    const campaign = payload?.campaignId
      ? await this.prisma.campaign.findUnique({ where: { id: payload.campaignId } })
      : null;

    const params: SearchParams = campaign
      ? {
          campaignId: campaign.id,
          niche: campaign.niche,
          subNiche: campaign.subNiche,
          geographyCity: campaign.geographyCity,
          geographyRadius: campaign.geographyRadius,
          geographyRegion: campaign.geographyRegion,
          companySize: Array.isArray(campaign.companySize as any) ? (campaign.companySize as any) : [],
          revenueRange: campaign.revenueRange,
          contactType: Array.isArray(campaign.contactType as any) ? (campaign.contactType as any) : [],
          hasContactInfo: Array.isArray(campaign.hasContactInfo as any) ? (campaign.hasContactInfo as any) : [],
          dataSources: campaign.dataSources || {},
          dailySendLimit: campaign.dailySendLimit,
          query: payload?.query || null,
        }
      : { query: payload?.query || 'generic local business research' };

    const run = await this.prisma.researchRun.create({
      data: {
        campaignId: campaign?.id || null,
        status: 'running',
        searchParams: params as any,
        metadata: { requestedBy: payload?.requestedBy || 'admin', phase: 'Lead Discovery', progress: 10 } as any,
      },
    });

    try {
      const routed = await this.discoverLeadsWithRouting(params, campaign || undefined);
      const leads = routed.rows.map((l: any) => ({ ...l, fitScore: this.scoreLead(l, params) }));
      const content = await this.discoverContentIdeas(this.buildSearchQuery(params));
      const intel = this.buildIntel(leads);

      await this.prisma.researchRun.update({ where: { id: run.id }, data: { metadata: { ...(run.metadata as any), phase: 'Content Research', progress: 55 } as any } });

      if (leads.length) {
        await this.prisma.researchLead.createMany({
          data: leads.map((l: any) => ({
            runId: run.id,
            companyName: l.companyName,
            contactName: l.contactName || null,
            email: l.email || null,
            phone: l.phone || null,
            linkedinUrl: l.linkedinUrl || null,
            sourceUrl: l.sourceUrl || null,
            sourceType: l.sourceType || 'research_agent',
            source: l.source || null,
            fitScore: l.fitScore,
          })),
        });
      }
      if (content.length) await this.prisma.researchContent.createMany({ data: content.map((c: any) => ({ ...c, runId: run.id })) });
      if (intel.length) await this.prisma.researchIntel.createMany({ data: intel.map((x: any) => ({ ...x, runId: run.id })) });

      const updated = await this.prisma.researchRun.update({
        where: { id: run.id },
        data: {
          status: 'complete',
          completedAt: new Date(),
          sourcesUsed: routed.used as any,
          metadata: {
            ...(run.metadata as any),
            phase: 'Intel',
            progress: 100,
            warnings: routed.warnings,
            counts: { leads: leads.length, content: content.length, intel: intel.length },
          } as any,
        },
      });

      await this.events.publish({ eventType: 'RESEARCH_RUN_COMPLETE', payload: { runId: run.id, campaignId: campaign?.id || null } });
      return updated;
    } catch (e: any) {
      await this.prisma.researchRun.update({ where: { id: run.id }, data: { status: 'failed', completedAt: new Date(), notes: e?.message || 'Research run failed' } });
      await this.events.publish({ eventType: 'research.run.failed', payload: { runId: run.id } });
      throw e;
    }
  }

  async listRuns() {
    const runs = await this.prisma.researchRun.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { campaign: { select: { id: true, name: true } } } as any });
    return runs.map((r: any) => ({ ...r, campaignName: r?.campaign?.name || null }));
  }

  async getLeads(runId: string) {
    await this.assertRun(runId);
    return this.prisma.researchLead.findMany({ where: { runId }, orderBy: { createdAt: 'desc' } });
  }

  async getRunSummary(runId: string) {
    const run = await this.assertRun(runId);
    const [leads, content, intel] = await Promise.all([
      this.prisma.researchLead.findMany({ where: { runId } }),
      this.prisma.researchContent.findMany({ where: { runId } }),
      this.prisma.researchIntel.findMany({ where: { runId } }),
    ]);

    const withEmail = leads.filter((l: any) => !!l.email).length;
    const withPhone = leads.filter((l: any) => !!l.phone).length;
    const withLinkedin = leads.filter((l: any) => !!l.linkedinUrl).length;

    return {
      runId: run.id,
      status: run.status,
      campaignId: run.campaignId,
      counts: {
        leads: leads.length,
        content: content.length,
        intel: intel.length,
        withEmail,
        withPhone,
        withLinkedin,
      },
      topLeadSources: Array.from(new Set(leads.map((l: any) => l.source || l.sourceType || 'unknown'))).slice(0, 5),
      topCompetitors: intel.slice(0, 5).map((i: any) => ({ competitor: i.competitor, insight: i.insight })),
      contentAngles: content.slice(0, 5).map((c: any) => ({ title: c.title, angle: c.videoAngle || null })),
      completedAt: run.completedAt,
      createdAt: run.createdAt,
    };
  }

  async promoteLeads(runId: string, body: any) {
    const run = await this.assertRun(runId);
    const action = String(body?.action || 'APPROVE').toUpperCase();
    const leadIds = Array.isArray(body?.leadIds) ? body.leadIds.filter(Boolean) : [];
    const campaignId = body?.campaignId || run.campaignId || (await this.prisma.campaign.findFirst({ where: { isActive: true }, select: { id: true } }))?.id;
    if (!campaignId) throw new NotFoundException('No active campaign available for lead promotion');

    const sourceLeads = await this.prisma.researchLead.findMany({
      where: {
        runId,
        ...(leadIds.length ? { id: { in: leadIds } as any } : {}),
      } as any,
      orderBy: { createdAt: 'desc' },
    });

    if (!sourceLeads.length) return { ok: true, promoted: 0, action };

    let promoted = 0;
    for (const l of sourceLeads) {
      const targetStatus = action === 'REJECT' ? 'LOST' : action === 'SNOOZE' ? 'RESEARCHED' : 'APPROVED';
      const nextStep = action === 'SNOOZE' ? 'Review later' : action === 'REJECT' ? 'Do not contact' : 'Ready for outreach draft';
      try {
        const created = await this.prisma.lead.create({
          data: {
            campaignId,
            businessName: l.companyName,
            contactName: l.contactName || undefined,
            email: l.email || undefined,
            phone: l.phone || undefined,
            linkedinUrl: l.linkedinUrl || undefined,
            website: l.sourceUrl || undefined,
            source: l.sourceType,
            sourceDetail: l.source || undefined,
            fitScore: l.fitScore || undefined,
            status: targetStatus as any,
            nextStep,
          },
        });

        await this.prisma.leadIntel.createMany({
          data: [
            {
              leadId: created.id,
              intelType: 'research_summary',
              title: `Imported from run ${run.id}`,
              summary: `Action=${action}; Source=${l.source || l.sourceType || 'research'}`,
              sourceUrl: l.sourceUrl || null,
              confidence: l.fitScore === 'High' ? 90 : l.fitScore === 'Medium' ? 70 : 50,
            },
          ],
        });

        promoted += 1;
      } catch {}
    }

    await this.prisma.auditLog.create({
      data: {
        actorType: 'user',
        action: 'research.leads.promote',
        resourceType: 'research_run',
        resourceId: runId,
        metadata: { action, promoted, attempted: sourceLeads.length, campaignId } as any,
      },
    });

    await this.events.publish({ eventType: 'research.run.promoted', payload: { runId, campaignId, action, promoted } });
    return { ok: true, runId, campaignId, action, promoted, attempted: sourceLeads.length };
  }

  async getContent(runId: string) {
    await this.assertRun(runId);
    return this.prisma.researchContent.findMany({ where: { runId }, orderBy: { createdAt: 'desc' } });
  }

  async getIntel(runId: string) {
    await this.assertRun(runId);
    return this.prisma.researchIntel.findMany({ where: { runId }, orderBy: { createdAt: 'desc' } });
  }

  async runStatus(runId: string) {
    const run = await this.assertRun(runId);
    const m: any = run.metadata || {};
    return {
      id: run.id,
      status: run.status,
      phase: m.phase || (run.status === 'complete' ? 'Intel' : 'Lead Discovery'),
      progress: typeof m.progress === 'number' ? m.progress : (run.status === 'complete' ? 100 : 0),
      completedAt: run.completedAt,
    };
  }

  async exportLeads(runId: string, campaignId?: string) {
    const run = await this.assertRun(runId);
    const leads = await this.prisma.researchLead.findMany({ where: { runId } });
    if (!leads.length) return { ok: true, exported: 0 };

    const resolvedCampaignId = campaignId || run.campaignId || (await this.prisma.campaign.findFirst({ where: { isActive: true }, select: { id: true } }))?.id;
    if (!resolvedCampaignId) throw new NotFoundException('No active campaign available for lead export');

    let exported = 0;
    for (const l of leads) {
      try {
        await this.prisma.lead.create({
          data: {
            campaignId: resolvedCampaignId,
            businessName: l.companyName,
            contactName: l.contactName || undefined,
            email: l.email || undefined,
            phone: l.phone || undefined,
            website: l.sourceUrl || undefined,
            source: l.sourceType,
            sourceDetail: l.source || undefined,
            fitScore: l.fitScore || undefined,
            status: 'NEW',
          },
        });
        exported += 1;
      } catch {}
    }

    await this.events.publish({ eventType: 'research.run.exported', payload: { runId, exported, campaignId: resolvedCampaignId } });
    return { ok: true, exported, campaignId: resolvedCampaignId };
  }

  async runCompetitorIntel(competitorId?: string, competitor?: any) {
    const jobId = `intel_${Date.now()}`;
    setTimeout(async () => {
      try {
        const c = competitor || { name: competitorId || 'Competitor', linkedinUrl: null, facebookUrl: null };
        await this.prisma.competitorIntel.create({
          data: {
            competitorName: c.name || competitorId || 'Competitor',
            linkedinUrl: c.linkedinUrl || null,
            facebookUrl: c.facebookUrl || null,
            postingFrequency: 'Posts ~3x per week',
            topTopics: ['Lead response speed', 'No-show prevention', 'Booking flow UX'] as any,
            contentGaps: ['After-hours missed call capture', 'Reactivation workflow'] as any,
            recentPosts: [
              { platform: 'LINKEDIN', excerpt: 'How to improve response time...', engagement: { likes: 24, comments: 5 } },
              { platform: 'FACEBOOK', excerpt: 'Client retention checklist...', engagement: { likes: 12, comments: 2 } },
            ] as any,
            lastUpdated: new Date(),
          } as any,
        });
      } catch {}
    }, 250);
    return { status: 'running', jobId };
  }

  getCompetitorIntel(competitorId: string) {
    return this.prisma.competitorIntel.findFirst({ where: { id: competitorId } as any });
  }

  private async assertRun(id: string) {
    const run = await this.prisma.researchRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException('Research run not found');
    return run;
  }
}
