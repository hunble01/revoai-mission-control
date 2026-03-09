import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async generateIdeas() {
    const jobId = `content_${Date.now()}`;
    setTimeout(async () => {
      try {
        const seeds = [
          { platform: 'BOTH', headline: 'Why local businesses lose leads overnight', source: 'Google News', contentType: 'Educational', angle: 'Speed-to-lead breakdown', aiDraft: 'Most local businesses lose hot leads after hours. Here is how to fix that in 3 steps...' },
          { platform: 'LINKEDIN', headline: 'No-show reduction playbook for clinics', source: 'YouTube', contentType: 'Social Proof', angle: 'Appointment reminder system', aiDraft: 'No-shows are avoidable. Our reminder stack reduced missed visits with simple timing changes...' },
          { platform: 'FACEBOOK', headline: 'Community trust beats ad spend', source: 'Reddit', contentType: 'Engagement', angle: 'Neighborhood-first messaging', aiDraft: 'Before spending more on ads, tighten local trust signals in your follow-up and booking flow...' },
        ];
        for (const s of seeds) {
          await this.prisma.contentIdea.create({ data: s as any });
        }
      } catch {}
    }, 250);
    return { status: 'running', jobId };
  }

  listIdeas() {
    return this.prisma.contentIdea.findMany({ where: { dismissed: false }, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async dismissIdea(id: string) {
    await this.prisma.contentIdea.update({ where: { id }, data: { dismissed: true } as any });
    return { ok: true };
  }
}
