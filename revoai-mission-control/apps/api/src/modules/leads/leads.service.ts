import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { FollowUpService } from './followup.service';
import { UnsubscribeService } from '../unsubscribe/unsubscribe.service';
import { Channel } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';

// ---- RevoAI brand context (mirrors REVOAI_PRODUCT_CONTEXT.md constraints) ----
const REVOAI_SYSTEM_PROMPT = `You are the outbound copywriter for RevoAI, an AI receptionist for local service businesses.
You write short, direct, brand-voiced cold emails. One message at a time.

PRODUCT (the only facts you may cite):
- RevoAI is an AI receptionist that answers calls and texts 24/7 for local businesses
- Sub-second response, unlimited simultaneous calls, real human-sounding voice
- Books straight into Google/Outlook/iCloud calendar in real time; no double-booking
- Two-way SMS AI handles questions + confirmations + reminders
- AI chatbox for their website captures leads 24/7
- Live dashboard shows every call, text, and booking as it happens
- Plans from $97/mo CAD (vs. ~$2,500+/mo for a human receptionist); 7-day free trial; 10-minute setup; no contract
- Product launches 2026 (currently early access)
- Sign-up URL: https://revoai.ca/sign-up

BRAND VOICE: warm, professional, calm. Botanical/organic — not aggressive SaaS bro. Confident not pushy.
Short sentences. Specific over vague.

ABSOLUTE RULES — violating any of these rules breaks the brand:
- NEVER say "revolutionize", "game-changer", "in today's fast-paced world", "synergy", or any AI-cliché filler
- NEVER claim "no credit card required" — a card IS required (trial just doesn't charge)
- NEVER cite review counts, star ratings, fake testimonials, "rated X", "4.8 stars", "240+ reviews"
- NEVER promise specific ROI as a guarantee ("will make you $X")
- NEVER mention competitors by name, especially negatively
- Maximum ONE exclamation mark per message. Zero is better.
- Never mention "AI-powered" — just describe what it does
- Never use em-dashes in clusters. One per message max.
- Do NOT make up facts about the prospect's business beyond what's given

EMAIL REQUIREMENTS:
- 4–8 sentences TOTAL (not counting greeting/signoff)
- Subject line under 50 characters, no clickbait, no ALL CAPS
- Structure: (1) personalized opener referencing their specific business, (2) niche-specific pain, (3) one paragraph on what RevoAI does for them, (4) pricing sentence, (5) single soft CTA with the sign-up URL, (6) one-line signoff
- Include a "Take a look: https://revoai.ca/sign-up" CTA on its own line
- End with "— {senderFirstName}"

OUTPUT FORMAT — return a JSON object with EXACTLY these keys:
{
  "subject": "<50-char subject>",
  "body": "<full email body starting with greeting, ending with signoff>"
}

Do not add any preamble, explanation, or markdown. Output only the JSON.`;

const BANNED_PHRASES: RegExp[] = [
  /revolutioniz[a-z]*/i,
  /game.?changer/i,
  /in today'?s fast[- ]paced/i,
  /synergy/i,
  /no credit card required/i,
  /\b(4\.[0-9]|5\.0|rated|stars?|reviews?|testimonial)\b/i,
  /guaranteed? (roi|return|revenue|income)/i,
  /\bai[- ]powered\b/i,
];

function countExclamations(s: string): number {
  return (s.match(/!/g) || []).length;
}

function violatesBrandRules(text: string): { violates: boolean; reason?: string } {
  for (const re of BANNED_PHRASES) {
    const m = text.match(re);
    if (m) return { violates: true, reason: `banned phrase: "${m[0]}"` };
  }
  if (countExclamations(text) > 1) return { violates: true, reason: 'more than one exclamation mark' };
  return { violates: false };
}

// -------- LLM website enrichment --------

const ENRICH_SYSTEM_PROMPT = `You extract structured business data from a webpage's visible text.
You receive the text of a local business's website (homepage or about page).
You respond with ONLY a JSON object (no preamble, no markdown). Use null for missing fields.

Schema:
{
  "contactName": "<owner or main contact's full name, or null if not stated>",
  "contactRole": "<role title e.g. 'Owner', 'Founder', 'Dr.', or null>",
  "email": "<primary email visible on the page, or null>",
  "services": ["<up to 5 core services offered, short phrases>"],
  "painHint": "<one sentence — any signal about their pain: e.g., staffing, after-hours, volume>",
  "trustMarker": "<one sentence — strongest credibility signal: years in business, awards, tech used, reviews>"
}

Rules:
- NEVER invent data. If the page doesn't mention it, return null.
- NEVER use placeholder fake emails like info@example.com unless that is literally on the page.
- Only extract emails you can see as plain text on the page.
- services should be specific to THIS business (their actual offerings), not generic.
- Keep each string under 160 characters.`;

async function enrichLeadFromWebsite(lead: any): Promise<{
  contactName?: string | null;
  contactRole?: string | null;
  email?: string | null;
  services?: string[];
  painHint?: string | null;
  trustMarker?: string | null;
} | null> {
  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) return null;
  const url = String(lead?.website || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) return null;

  // Fetch the homepage HTML with a tight timeout
  let html = '';
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RevoAIBot/1.0; +https://revoai.ca)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    } as any);
    clearTimeout(timer);
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  // Strip scripts, styles, HTML tags — keep visible text
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000); // cap tokens

  if (text.length < 80) return null;

  try {
    const client = new Anthropic({ apiKey });
    const model = (process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001').trim();
    const resp = await client.messages.create({
      model,
      max_tokens: 400,
      system: ENRICH_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Business name: ${lead.businessName || 'unknown'}\nURL: ${url}\n\nPage text:\n${text}\n\nReturn only the JSON.`,
        },
      ],
    });
    const raw = (resp.content || [])
      .map((b: any) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()
      .replace(/^```json\s*/, '')
      .replace(/```\s*$/, '')
      .trim();
    const parsed = JSON.parse(raw);
    return {
      contactName: parsed?.contactName || null,
      contactRole: parsed?.contactRole || null,
      email: parsed?.email || null,
      services: Array.isArray(parsed?.services) ? parsed.services.slice(0, 5) : [],
      painHint: parsed?.painHint || null,
      trustMarker: parsed?.trustMarker || null,
    };
  } catch (err: any) {
    console.warn('[enrichLeadFromWebsite] LLM call failed:', err?.message || err);
    return null;
  }
}

async function generateOutreachCopyWithLLM(
  channel: string,
  lead: any,
  brand: any,
): Promise<{ subject: string; content: string } | null> {
  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey || channel !== 'EMAIL') return null; // only EMAIL for now; LinkedIn/FB keep templates

  const client = new Anthropic({ apiKey });
  const model = (process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001').trim();

  const senderFirst = String(brand?.yourName || '').trim().split(/\s+/)[0] || 'Tony';
  // Strip common honorifics so "Dr. Sarah Chen" → "Sarah", not "Dr."
  const stripTitle = (s: string) => {
    const parts = String(s || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '';
    if (/^(Dr|Mr|Mrs|Ms|Mx|Prof|Rev|Sir|Dame|Madam)\.?$/i.test(parts[0])) {
      return parts[1] || parts[0];
    }
    return parts[0];
  };
  const contactFirst = stripTitle(lead?.contactName || '');
  // Pull enriched fields stashed by enrichLeadFromWebsite into sourceDetail JSON
  let enriched: any = {};
  try { enriched = JSON.parse(String(lead?.sourceDetail || '{}')); } catch { enriched = {}; }
  const leadBrief = [
    `Business name: ${lead?.businessName || 'Unknown'}`,
    lead?.niche ? `Industry/niche: ${lead.niche}` : null,
    lead?.region ? `Location: ${lead.region}` : null,
    contactFirst ? `Contact first name (use as greeting): ${contactFirst}` : `Contact first name: unknown — greet as "Hi there,"`,
    lead?.contactRole ? `Contact role: ${lead.contactRole}` : null,
    lead?.website ? `Website: ${lead.website}` : null,
    Array.isArray(enriched?.services) && enriched.services.length ? `Services they offer: ${enriched.services.join(', ')}` : null,
    enriched?.painHint ? `Pain signal from their site: ${enriched.painHint}` : null,
    enriched?.trustMarker ? `What they're proud of (cite if natural, don't force): ${enriched.trustMarker}` : null,
    lead?.email ? `Email is known — address the lead directly` : null,
    `Sender first name: ${senderFirst}`,
  ].filter(Boolean).join('\n');

  const userPrompt = `Write a cold outreach email for this lead. Personalize to their specific business and niche.

LEAD DATA:
${leadBrief}

DEMO VIDEO URL (if non-empty, include a single line "Here's a 90-second demo: <URL>" before the CTA): ${(process.env.DEMO_VIDEO_URL || '').trim() || '(not set — omit the demo line)'}

Return only the JSON object.`;

  try {
    const resp = await client.messages.create({
      model,
      max_tokens: 800,
      system: REVOAI_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = (resp.content || [])
      .map((b: any) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim();

    // Claude sometimes wraps JSON in ```json ... ``` — strip those
    const jsonText = raw.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(jsonText);
    if (!parsed?.subject || !parsed?.body) return null;

    const combined = `${parsed.subject}\n${parsed.body}`;
    const check = violatesBrandRules(combined);
    if (check.violates) {
      // One retry with stricter instruction
      const retry = await client.messages.create({
        model,
        max_tokens: 800,
        system: REVOAI_SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: userPrompt },
          { role: 'assistant', content: raw },
          { role: 'user', content: `Your last output violated brand rules (${check.reason}). Rewrite. Output only the JSON.` },
        ],
      });
      const retryText = (retry.content || []).map((b: any) => (b.type === 'text' ? b.text : '')).join('').trim();
      const retryJson = retryText.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
      const retryParsed = JSON.parse(retryJson);
      if (!retryParsed?.subject || !retryParsed?.body) return null;
      const retryCheck = violatesBrandRules(`${retryParsed.subject}\n${retryParsed.body}`);
      if (retryCheck.violates) return null;
      return { subject: String(retryParsed.subject).slice(0, 60), content: String(retryParsed.body).trim() };
    }

    return { subject: String(parsed.subject).slice(0, 60), content: String(parsed.body).trim() };
  } catch (err: any) {
    console.warn('[generateOutreachCopyWithLLM] falling back to template:', err?.message || err);
    return null;
  }
}

/**
 * Generate RevoAI-brand-voice outreach copy tailored by channel + niche.
 * Rules pulled from REVOAI_PRODUCT_CONTEXT.md:
 *  - Email: 4-8 sentences, subject <50 chars, plain text preferred
 *  - LinkedIn DM: 2-4 sentences, observation-led
 *  - FB/IG DM: 1-3 sentences, lowercase-friendly, question-first
 *  - Single CTA, no "revolutionize/game-changer", no false claims,
 *    no review counts, no "no credit card required"
 */
function generateOutreachCopy(
  channel: string,
  lead: any,
  brand: any,
): { subject: string; content: string } {
  const contactName = String(lead?.contactName || '').trim().split(/\s+/)[0] || 'there';
  const businessName = String(lead?.businessName || 'your business').trim();
  const niche = String(lead?.niche || '').toLowerCase();
  const senderFirst = String(brand?.yourName || '').trim().split(/\s+/)[0] || 'Tony';

  // Niche-aware pain framing
  const painLine = (() => {
    if (/dent|ortho|med|vet|clinic/.test(niche)) {
      return `Most clinics miss 30–60% of calls — every unanswered ring is a patient booking with whoever answered first.`;
    }
    if (/hvac|plumb|electric|roof|contractor|gc/.test(niche)) {
      return `Emergency calls don't wait. A missed ring is usually a job booked with whoever picked up first.`;
    }
    if (/salon|barber|nail|spa|beauty/.test(niche)) {
      return `Missed calls = walk-ins at the next salon over. Local shops miss 30–60% of inbound calls, most of them after hours.`;
    }
    if (/law|legal|attorney/.test(niche)) {
      return `Prospective clients call one firm, then move on. Voicemail after hours usually means they're someone else's client by morning.`;
    }
    if (/gym|yoga|fitness|training/.test(niche)) {
      return `Trial-class calls don't leave a voicemail — they book with the first studio that picks up.`;
    }
    if (/clean|landscape|lawn/.test(niche)) {
      return `Quote calls are time-sensitive. If the phone goes to voicemail the lead is usually gone.`;
    }
    // default
    return `Most local service businesses miss 30–60% of calls — voicemail after hours, busy signal at peak times. Each missed call is a booking walking to the next result on Google.`;
  })();

  if (channel === 'EMAIL') {
    const subject = `Quick idea for ${businessName}`.slice(0, 50);
    const videoUrl = (process.env.DEMO_VIDEO_URL || '').trim();
    const demoLine = videoUrl
      ? `Here's a 90-second demo: ${videoUrl}`
      : '';
    const content = [
      `Hi ${contactName},`,
      ``,
      `${painLine}`,
      ``,
      `RevoAI is an AI receptionist built for businesses like ${businessName}. It answers every call in a real human voice, handles two-way SMS, and books straight into your calendar — all 24/7.`,
      ``,
      `You'll also get a live dashboard showing every call, text, and booking as it happens, plus an AI chatbox for your website that answers questions and captures leads while you sleep.`,
      ``,
      `Plans start at $97/mo CAD (vs. $2,500+ for a human receptionist). 7-day free trial, 10-minute setup, no contract.`,
      ``,
      demoLine,
      demoLine ? `` : null,
      `Take a look: https://revoai.ca/sign-up`,
      ``,
      `— ${senderFirst}`,
    ].filter((line) => line !== null).join('\n');
    return { subject, content };
  }

  if (channel === 'LINKEDIN') {
    // 2-4 sentences, observation-led, one soft CTA
    const content = [
      `Hi ${contactName},`,
      ``,
      `Saw ${businessName} — nice presence. Quick thought: most local shops miss 30–60% of calls, mostly after hours, and each one is usually a booking that went elsewhere.`,
      ``,
      `We built RevoAI to answer every call/text 24/7 and book straight into your calendar. $97/mo CAD vs. ~$2,500 for a human.`,
      ``,
      `Open to a 60-second look? https://revoai.ca`,
    ].join('\n');
    return { subject: '', content };
  }

  if (channel === 'FACEBOOK') {
    // 1-3 sentences, conversational
    const content = [
      `hey ${contactName} — saw ${businessName} online. quick question: are after-hours calls going to voicemail? we built an AI receptionist that answers every call 24/7 and books into your calendar for $97/mo. happy to show you: https://revoai.ca`,
    ].join('\n');
    return { subject: '', content };
  }

  // Fallback — same as email
  const subject = `Quick idea for ${businessName}`.slice(0, 50);
  const content = `Hi ${contactName},\n\n${painLine}\n\nRevoAI answers every call/text 24/7 and books into your calendar. $97/mo, 7-day free trial.\n\nhttps://revoai.ca\n\nThanks,\n${senderFirst}`;
  return { subject, content };
}

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly followUp: FollowUpService,
    private readonly unsubscribe: UnsubscribeService,
  ) {}

  list(q?: { search?: string; status?: string }) {
    return this.prisma.lead.findMany({
      where: {
        status: q?.status as any || undefined,
        OR: q?.search
          ? [
              { businessName: { contains: q.search, mode: 'insensitive' } },
              { region: { contains: q.search, mode: 'insensitive' } },
              { niche: { contains: q.search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  create(data: any) {
    return this.prisma.lead.create({ data });
  }

  async update(id: string, data: any, actorId?: string) {
    const before = await this.prisma.lead.findUnique({
      where: { id },
      select: { id: true, status: true, campaignId: true, updatedAt: true },
    });

    const updated = await this.prisma.lead.update({ where: { id }, data });

    if (before && typeof data?.status === 'string' && data.status !== before.status) {
      await this.prisma.auditLog.create({
        data: {
          actorType: 'user',
          actorId: actorId || null,
          action: 'lead.status.updated',
          resourceType: 'lead',
          resourceId: id,
          beforeState: { status: before.status },
          afterState: { status: updated.status },
          metadata: { campaignId: updated.campaignId },
        },
      });
    }

    return updated;
  }

  async overrideScore(id: string, score: 'A' | 'B' | 'C', reason: string) {
    const lead = await this.prisma.lead.update({
      where: { id },
      data: {
        scoreOverride: score,
        scoreOverrideReason: reason,
      },
    });

    await this.events.publish({
      eventType: 'lead.score.overridden',
      payload: { leadId: id, score, reason },
      campaignId: lead.campaignId,
    });

    return lead;
  }

  async enrichLead(id: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');

    // 1. LLM-driven website enrichment (contact name, email, services, pain)
    const webData = await enrichLeadFromWebsite(lead);

    // 2. Hunter domain search (fallback / supplement when website didn't yield email)
    const hunterApiKey = String(process.env.HUNTER_API_KEY || '').trim();
    let hunterEmail: string | null = null;
    let hunterLinkedin: string | undefined;
    if (hunterApiKey && lead.website && !(webData?.email)) {
      try {
        const domain = lead.website.replace(/^https?:\/\//, '').split('/')[0];
        const res = await fetch(
          `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${encodeURIComponent(hunterApiKey)}`,
        );
        const json: any = await res.json().catch(() => ({}));
        const emailRow = Array.isArray(json?.data?.emails) ? json.data.emails[0] : null;
        hunterEmail = emailRow?.value || null;
        hunterLinkedin = emailRow?.linkedin || undefined;
      } catch {
        // graceful fallback
      }
    }

    // Merge — prefer website-extracted data over Hunter
    const patch: any = {};
    if (!lead.contactName && webData?.contactName) patch.contactName = webData.contactName;
    if (!lead.contactRole && webData?.contactRole) patch.contactRole = webData.contactRole;
    if (!lead.email && (webData?.email || hunterEmail)) patch.email = webData?.email || hunterEmail;
    if (!lead.linkedinUrl && hunterLinkedin) patch.linkedinUrl = hunterLinkedin;
    if (!lead.linkedinUrl && !patch.linkedinUrl) {
      patch.linkedinUrl = `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(lead.businessName)}`;
    }
    patch.status = lead.status === 'NEW' ? 'ENRICHED' : lead.status;

    // Re-score now that enrichment may have filled in email / contact name.
    // Conservative bump — don't downgrade a lead that was already scored higher.
    const nowHasEmail = !!(lead.email || patch.email);
    const nowHasName = !!(lead.contactName || patch.contactName);
    const nowHasWebsite = !!lead.website;
    const currentScore = lead.fitScore || 'Low';
    let nextScore = currentScore;
    if (nowHasEmail && nowHasName && nowHasWebsite) nextScore = 'High';
    else if (nowHasEmail && nowHasWebsite) nextScore = 'Medium';
    const rank = (s: string) => (s === 'High' ? 3 : s === 'Medium' ? 2 : 1);
    if (rank(nextScore) > rank(currentScore)) patch.fitScore = nextScore;

    // Stash services + pain + trust marker in sourceDetail for the draft generator
    if (webData?.services?.length || webData?.painHint || webData?.trustMarker) {
      const existing = (() => {
        try { return JSON.parse(String(lead.sourceDetail || '{}')); } catch { return {}; }
      })();
      patch.sourceDetail = JSON.stringify({
        ...existing,
        services: webData?.services || existing?.services || [],
        painHint: webData?.painHint || existing?.painHint || null,
        trustMarker: webData?.trustMarker || existing?.trustMarker || null,
        enrichedAt: new Date().toISOString(),
        enrichedBy: webData ? 'llm+website' : 'hunter-only',
      });
    }

    const updated = await this.prisma.lead.update({ where: { id }, data: patch });

    await this.events.publish({
      eventType: 'lead.enriched',
      campaignId: updated.campaignId,
      payload: { leadId: updated.id, source: webData ? 'llm+website' : hunterEmail ? 'hunter' : 'none' },
    });
    return { ok: true, lead: updated, enrichment: webData || null };
  }

  /**
   * Reply-assist: classifies an inbound reply from a lead and suggests
   * a response draft. Does NOT send anything — returns text for the
   * user to review, edit, and send manually.
   */
  async assistReply(leadId: string, replyText: string) {
    const trimmed = String(replyText || '').trim();
    if (!trimmed) throw new BadRequestException('replyText required');
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId }, include: { campaign: true } });
    if (!lead) throw new NotFoundException('Lead not found');

    const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
    if (!apiKey) throw new BadRequestException('ANTHROPIC_API_KEY not configured');

    const model = (process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001').trim();
    const brand = await this.prisma.brandSettings.findUnique({ where: { id: 'default' } });
    const senderName = brand?.yourName || 'Michael';
    const senderCompany = brand?.companyName || 'RevoAI';

    // Pull the most recent draft we sent to this lead so Claude has
    // context on what they're replying TO
    const priorSend = await this.prisma.draft.findFirst({
      where: { leadId, status: { in: ['SENT', 'APPROVED'] as any } },
      orderBy: { updatedAt: 'desc' },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    const priorBody = priorSend?.versions?.[0]?.content || (priorSend as any)?.content || '';

    const systemPrompt = `You are ${senderName}, founder of ${senderCompany}. A cold-outreach recipient just replied to your email about RevoAI (AI receptionist + SMS booking assistant for local service businesses, $97 CAD/month).

Analyze the reply and return STRICT JSON only (no code fences, no prose). Schema:
{
  "intent": "interested" | "objection" | "question" | "not_interested" | "out_of_office" | "unsubscribe" | "bounce" | "wrong_person" | "other",
  "confidence": 0.0-1.0,
  "reasoning": "<one short sentence — what signals in the reply led to this classification>",
  "recommendedAction": "reply_now" | "reply_after_check" | "pause_sequence" | "mark_unsubscribed" | "no_action",
  "suggestedResponse": "<2-6 sentence reply draft in the founder's voice — ONLY if recommendedAction is reply_now or reply_after_check, else empty string>"
}

Voice rules for suggestedResponse:
- Natural founder voice. No buzzwords. No 'revolutionize'. No em-dashes.
- Address their specific concern/question.
- If they asked about price — say $97/month CAD, 10-min setup, 7-day free trial.
- If objection — acknowledge then pivot to concrete value.
- If interested — offer a 15-min call. Keep it short.
- If question — answer directly in 1-2 sentences then CTA.
- Close with '— ${senderName}' on its own line.
- NEVER invent product features not in the brief above.`;

    const userMessage = [
      `Lead: ${lead.businessName || 'Unknown business'}${lead.contactName ? ` · Contact: ${lead.contactName}` : ''}${lead.campaign?.niche ? ` · Niche: ${lead.campaign.niche}` : ''}`,
      priorBody ? `\nOur most recent email to them:\n---\n${priorBody.slice(0, 1500)}\n---` : '',
      `\nTheir reply:\n---\n${trimmed.slice(0, 3000)}\n---`,
      '\nReturn the JSON now.',
    ].filter(Boolean).join('\n');

    try {
      const client = new Anthropic({ apiKey });
      const resp = await client.messages.create({
        model,
        max_tokens: 800,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });
      const raw = (resp.content || [])
        .map((b: any) => (b.type === 'text' ? b.text : ''))
        .join('')
        .trim()
        .replace(/^```json\s*/, '')
        .replace(/```\s*$/, '')
        .trim();
      const parsed = JSON.parse(raw);
      const intent = String(parsed?.intent || 'other');
      const confidence = Number(parsed?.confidence || 0);
      const reasoning = String(parsed?.reasoning || '');
      const recommendedAction = String(parsed?.recommendedAction || 'no_action');
      const suggestedResponse = String(parsed?.suggestedResponse || '');

      const saved = await (this.prisma as any).replyAnalysis.create({
        data: {
          subjectType: 'lead',
          subjectId: leadId,
          leadId,
          replyText: trimmed.slice(0, 8000),
          intent,
          confidence,
          reasoning,
          recommendedAction,
          suggestedResponse,
        },
      });

      return {
        ok: true,
        id: saved.id,
        intent,
        confidence,
        reasoning,
        recommendedAction,
        suggestedResponse,
      };
    } catch (err: any) {
      throw new BadRequestException(`reply-assist failed: ${err?.message || err}`);
    }
  }

  /**
   * List recent reply analyses for a lead — audit trail in the /leads drawer.
   */
  async listReplyAnalyses(leadId: string, limit = 10) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');
    return (this.prisma as any).replyAnalysis.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit) || 10, 50),
    });
  }

  /**
   * Apply the recommended action on a reply analysis. One-click follow-through:
   *   pause_sequence    → mark lead as REPLIED + pause follow-ups
   *   mark_unsubscribed → suppress email + pause follow-ups + status LOST
   *   mark_bounced      → suppress email (BOUNCE) + pause follow-ups + status LOST
   *   no_action         → record only, no side effect
   *
   * Idempotent — re-applying the same action is a no-op on the side effects but
   * refreshes the audit row.
   */
  async applyReplyAction(leadId: string, analysisId: string, action: string, actorId?: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');

    const analysis = await (this.prisma as any).replyAnalysis.findUnique({ where: { id: analysisId } });
    if (!analysis || analysis.leadId !== leadId) throw new NotFoundException('Reply analysis not found for this lead');

    const allowed = ['pause_sequence', 'mark_unsubscribed', 'mark_bounced', 'no_action'];
    if (!allowed.includes(action)) {
      throw new BadRequestException(`Invalid action. Allowed: ${allowed.join(', ')}`);
    }

    if (action === 'pause_sequence') {
      await this.followUp.pauseSequence(leadId, 'replied');
    } else if (action === 'mark_unsubscribed') {
      if (lead.email) {
        await this.unsubscribe.suppress(lead.email, 'UNSUBSCRIBE', 'reply', 'Marked from Reply Intelligence', lead.campaignId);
      }
      await this.followUp.pauseSequence(leadId, 'unsubscribed');
    } else if (action === 'mark_bounced') {
      if (lead.email) {
        await this.unsubscribe.suppress(lead.email, 'BOUNCE', 'reply', 'Bounce detected from Reply Intelligence', lead.campaignId);
      }
      await this.followUp.pauseSequence(leadId, 'unsubscribed');
    }

    const updated = await (this.prisma as any).replyAnalysis.update({
      where: { id: analysisId },
      data: { appliedAction: action, appliedAt: new Date(), appliedBy: actorId || null },
    });

    await this.prisma.auditLog.create({
      data: {
        actorType: 'user',
        actorId: actorId || null,
        action: 'lead.reply.action_applied',
        resourceType: 'lead',
        resourceId: leadId,
        metadata: { analysisId, action, intent: analysis.intent } as any,
      },
    });

    return { ok: true, analysis: updated };
  }

  /**
   * Draft + enqueue a LinkedIn DM for a lead. Reuses the cold-email
   * personalization stack but outputs a 2-3 sentence intro under
   * LinkedIn's ~300-char cold-DM limit. Honors EmailSuppression as
   * cross-channel suppression — if a lead unsubscribed via email, we
   * never DM them on LinkedIn either.
   */
  async draftLinkedinDmForLead(leadId: string, actorId?: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (!lead.linkedinUrl) throw new BadRequestException('Lead has no linkedinUrl');

    if (lead.email) {
      const suppressed = await this.unsubscribe.isSuppressed(lead.email);
      if (suppressed) throw new BadRequestException('Lead is on the email suppression list — skipping cross-channel');
    }

    const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
    const brand = await this.prisma.brandSettings.findUnique({ where: { id: 'default' } });
    const senderName = (brand?.yourName || 'Michael').trim();
    const senderFirst = senderName.split(/\s+/)[0] || 'Michael';
    const companyName = brand?.companyName || 'RevoAI';

    let body = '';
    if (apiKey) {
      const model = (process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001').trim();
      const stripTitle = (s: string) => {
        const parts = String(s || '').trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return '';
        if (/^(Dr|Mr|Mrs|Ms|Mx|Prof|Rev|Sir|Dame|Madam)\.?$/i.test(parts[0])) return parts[1] || parts[0];
        return parts[0];
      };
      const contactFirst = stripTitle(lead.contactName || '');

      const systemPrompt = `You are ${senderFirst}, founder of ${companyName} — an AI receptionist for local service businesses (24/7 call answering, calendar booking, two-way SMS). You write short, warm, founder-voice LinkedIn cold DMs.

ABSOLUTE RULES:
- Max 280 characters total (LinkedIn cold DM limit ~300, leave headroom).
- 2-3 sentences. No more.
- Open with their first name (or "Hi there," if unknown).
- Mention something specific about their business or niche in the first sentence.
- Pivot to one concrete value prop (calls answered after-hours, fewer no-shows, automated booking — pick one).
- Soft CTA: "Worth a 10-min look?" or "Open to a quick chat?". NEVER a hard ask.
- NO emojis. NO em-dashes. NO "revolutionize", "synergy", "seamless".
- No links (LinkedIn flags them as spam in cold DMs).
- Sign with "— ${senderFirst}".

Return STRICT JSON: {"messageBody": "<the DM, 2-3 sentences, signed>"}`;

      const userMsg = [
        `Lead: ${lead.businessName}${lead.niche ? ` (${lead.niche})` : ''}${lead.region ? ` in ${lead.region}` : ''}`,
        contactFirst ? `Contact first name: ${contactFirst}` : 'Contact first name: unknown — open with "Hi there,"',
        lead.contactRole ? `Contact role: ${lead.contactRole}` : null,
        lead.website ? `Their website: ${lead.website}` : null,
        '',
        'Return the JSON now.',
      ].filter(Boolean).join('\n');

      try {
        const client = new Anthropic({ apiKey });
        const resp = await client.messages.create({
          model,
          max_tokens: 350,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMsg }],
        });
        const raw = (resp.content || [])
          .map((b: any) => (b.type === 'text' ? b.text : ''))
          .join('')
          .trim()
          .replace(/^```json\s*/, '')
          .replace(/```\s*$/, '')
          .trim();
        const parsed = JSON.parse(raw);
        body = String(parsed?.messageBody || '').trim();
      } catch {
        // fall through to template
      }
    }

    if (!body) {
      // Template fallback when no API key or LLM fails
      const contactFirst = (lead.contactName || '').trim().split(/\s+/)[0] || 'there';
      body = `Hi ${contactFirst}, saw ${lead.businessName}${lead.niche ? ` and the ${lead.niche.toLowerCase()} space you're in` : ''}. We help local businesses answer calls and book appointments 24/7 with an AI receptionist. Worth a 10-min look?\n— ${senderFirst}`;
      body = body.slice(0, 280);
    }

    const created = await this.prisma.linkedinMessage.create({
      data: {
        leadId,
        messageBody: body,
        status: 'queued',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorType: 'user',
        actorId: actorId || null,
        action: 'lead.linkedin_dm.drafted',
        resourceType: 'lead',
        resourceId: leadId,
        metadata: { messageId: created.id, source: apiKey ? 'llm' : 'template' } as any,
      },
    });

    return { ok: true, message: created };
  }

  async generateDraftForLead(id: string, body: any, actorId?: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');

    const channel = String(body?.channel || lead.preferredChannel || 'EMAIL').toUpperCase() as Channel;
    if (!['EMAIL', 'LINKEDIN', 'FACEBOOK'].includes(channel)) {
      throw new BadRequestException('Unsupported draft channel');
    }

    const campaignId = body?.campaignId || lead.campaignId;
    const brand = await this.prisma.brandSettings.findUnique({ where: { id: 'default' } });

    // Prefer LLM-generated personalized copy; fall back to template if the
    // LLM is unavailable, rate-limited, or output violates brand rules.
    const llmCopy = await generateOutreachCopyWithLLM(channel, lead, brand);
    const generated = llmCopy ?? generateOutreachCopy(channel, lead, brand);
    const copySource = llmCopy ? 'llm' : 'template';

    const content = String(body?.content || generated.content).trim();
    const subject = channel === 'EMAIL' ? String(body?.subject || generated.subject) : null;

    const draft = await this.prisma.draft.create({
      data: {
        campaignId,
        leadId: lead.id,
        channel: channel as any,
        draftType: 'OUTREACH',
        status: 'NEEDS_APPROVAL' as any,
        subject,
        content,
        createdBy: actorId || null,
      } as any,
    });

    await this.prisma.draftVersion.create({
      data: {
        draftId: draft.id,
        versionNumber: 1,
        content,
        changeNote: 'Generated from lead profile',
        createdBy: actorId || null,
      },
    });

    await this.prisma.lead.update({ where: { id: lead.id }, data: { status: 'DRAFTED', lastActionAt: new Date() } as any });

    await this.prisma.auditLog.create({
      data: {
        actorType: 'user',
        actorId: actorId || null,
        action: 'lead.draft.generated',
        resourceType: 'lead',
        resourceId: lead.id,
        metadata: { draftId: draft.id, channel, copySource } as any,
      },
    });

    await this.events.publish({ eventType: 'lead.draft.generated', campaignId: lead.campaignId, payload: { leadId: lead.id, draftId: draft.id, channel, copySource } });
    return { ok: true, draftId: draft.id, status: draft.status, copySource };
  }

  async importMappedCsv(data: {
    campaignId?: string;
    fileName?: string;
    headers: string[];
    rows: string[][];
    mapping: Record<string, 'name' | 'company' | 'email' | 'phone' | 'source' | ''>;
  }, actorId?: string) {
    if (!Array.isArray(data?.headers) || !Array.isArray(data?.rows)) {
      throw new BadRequestException({
        code: 'INVALID_PAYLOAD',
        message: 'Invalid CSV payload: headers/rows must be arrays.',
        details: { field: 'headers|rows' },
      });
    }

    if (!data.headers.length) {
      throw new BadRequestException({
        code: 'MISSING_HEADERS',
        message: 'CSV headers are required.',
      });
    }

    const requiredMappings = new Set(Object.values(data.mapping || {}).filter(Boolean));
    if (!requiredMappings.has('name') && !requiredMappings.has('company')) {
      throw new BadRequestException({
        code: 'MISSING_REQUIRED_MAPPING',
        message: 'At least one column must map to name or company.',
        details: { required: ['name', 'company'] },
      });
    }

    const unknownMappedHeaders = Object.keys(data.mapping || {}).filter((h) => !data.headers.includes(h));
    if (unknownMappedHeaders.length) {
      throw new BadRequestException({
        code: 'UNKNOWN_MAPPED_HEADER',
        message: `CSV mapping references unknown headers: ${unknownMappedHeaders.join(', ')}`,
        details: { unknownMappedHeaders },
      });
    }

    if ((data.rows || []).length > 5000) {
      throw new BadRequestException({
        code: 'ROW_LIMIT_EXCEEDED',
        message: 'CSV import exceeds 5000-row limit for a single run.',
        details: { maxRows: 5000, receivedRows: (data.rows || []).length },
      });
    }

    const campaignId =
      data.campaignId ||
      (
        await this.prisma.campaign.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        })
      )?.id;

    if (!campaignId) {
      throw new BadRequestException({
        code: 'CAMPAIGN_REQUIRED',
        message: 'No campaign available for lead ingestion.',
      });
    }

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { name: true, isActive: true },
    });

    if (!campaign) {
      throw new BadRequestException({
        code: 'CAMPAIGN_NOT_FOUND',
        message: 'Selected campaign was not found.',
      });
    }

    if (!campaign.isActive) {
      throw new BadRequestException({
        code: 'CAMPAIGN_INACTIVE',
        message: 'Selected campaign is inactive and cannot receive imports.',
      });
    }
    const existing = await this.prisma.lead.findMany({
      where: { campaignId },
      select: { email: true, phone: true },
    });

    const seenEmails = new Set(existing.map((l) => (l.email || '').trim().toLowerCase()).filter(Boolean));
    const seenPhones = new Set(existing.map((l) => (l.phone || '').replace(/\D+/g, '')).filter(Boolean));

    let imported = 0;
    let skippedDuplicates = 0;
    let invalidRows = 0;

    const reasonCounts: Record<string, number> = {
      INVALID_ROW_SHAPE: 0,
      MISSING_IDENTITY: 0,
      MISSING_CONTACT: 0,
      DUPLICATE: 0,
      WRITE_FAILED: 0,
    };
    const rowIssues: Array<{ rowNumber: number; code: string; reason: string }> = [];

    for (let rowIndex = 0; rowIndex < (data.rows || []).length; rowIndex++) {
      const row = data.rows[rowIndex];
      const rowNumber = rowIndex + 2;
      if (!Array.isArray(row) || row.length > data.headers.length + 20) {
        invalidRows += 1;
        reasonCounts.INVALID_ROW_SHAPE += 1;
        if (rowIssues.length < 25) rowIssues.push({ rowNumber, code: 'INVALID_ROW_SHAPE', reason: 'Row shape is invalid.' });
        continue;
      }

      const mapped: Record<string, string> = {};

      for (let i = 0; i < data.headers.length; i++) {
        const sourceHeader = data.headers[i];
        const targetField = data.mapping?.[sourceHeader];
        if (!targetField) continue;
        mapped[targetField] = (row[i] || '').trim();
      }

      const businessName = (mapped.company || mapped.name || '').trim();
      const email = mapped.email ? mapped.email.trim().toLowerCase() : null;
      const phone = mapped.phone ? mapped.phone.replace(/\D+/g, '') : null;
      const source = (mapped.source || 'csv-import').trim();

      if (!businessName) {
        invalidRows += 1;
        reasonCounts.MISSING_IDENTITY += 1;
        if (rowIssues.length < 25) rowIssues.push({ rowNumber, code: 'MISSING_IDENTITY', reason: 'Missing Name/Company.' });
        continue;
      }

      if (!email && !phone) {
        invalidRows += 1;
        reasonCounts.MISSING_CONTACT += 1;
        if (rowIssues.length < 25) rowIssues.push({ rowNumber, code: 'MISSING_CONTACT', reason: 'Missing Email/Phone.' });
        continue;
      }

      const duplicate = !!(
        (email && seenEmails.has(email)) ||
        (phone && seenPhones.has(phone))
      );

      if (duplicate) {
        skippedDuplicates += 1;
        reasonCounts.DUPLICATE += 1;
        if (rowIssues.length < 25) rowIssues.push({ rowNumber, code: 'DUPLICATE', reason: 'Duplicate email/phone in campaign.' });
        continue;
      }

      try {
        await this.prisma.lead.create({
          data: {
            campaignId,
            businessName,
            contactName: mapped.name || null,
            email,
            phone,
            source,
            status: 'NEW',
          },
        });

        if (email) seenEmails.add(email);
        if (phone) seenPhones.add(phone);
        imported += 1;
      } catch {
        invalidRows += 1;
        reasonCounts.WRITE_FAILED += 1;
        if (rowIssues.length < 25) rowIssues.push({ rowNumber, code: 'WRITE_FAILED', reason: 'Database write failed.' });
      }
    }

    const result = {
      campaignId,
      campaignName: campaign?.name || 'Unknown campaign',
      fileName: data.fileName || 'csv-import',
      imported,
      skippedDuplicates,
      invalidRows,
      totalRows: (data.rows || []).length,
      errorModel: {
        reasonCounts,
        rowIssues,
      },
    };

    await this.prisma.auditLog.create({
      data: {
        actorType: 'user',
        actorId: actorId || null,
        action: 'lead.import.csv',
        resourceType: 'lead_import_run',
        resourceId: campaignId,
        metadata: result as any,
      },
    });

    return result;
  }

  async listImportRuns(limit = 10) {
    const take = Math.min(Math.max(Number.isFinite(limit) ? Number(limit) : 10, 1), 50);
    const rows = await this.prisma.auditLog.findMany({
      where: {
        action: 'lead.import.csv',
        resourceType: 'lead_import_run',
      },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        createdAt: true,
        actorId: true,
        resourceId: true,
        metadata: true,
      },
    });

    return rows.map((r) => ({
      id: String(r.id),
      createdAt: r.createdAt,
      actorId: r.actorId,
      campaignId: r.resourceId,
      ...(r.metadata as Record<string, any>),
    }));
  }
}
