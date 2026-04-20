import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createDecipheriv, createHash } from 'crypto';
import { ApprovalAction, DraftStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { SettingsService } from '../settings/settings.service';
import { UnsubscribeService } from '../unsubscribe/unsubscribe.service';

const allowedDraftTransitions: Record<string, string[]> = {
  DRAFT: [DraftStatus.NEEDS_APPROVAL],
  NEEDS_APPROVAL: [DraftStatus.DRAFT, DraftStatus.APPROVED, DraftStatus.REJECTED],
  APPROVED: [DraftStatus.DRAFT, 'SENT'],
  REJECTED: [DraftStatus.DRAFT],
  SENT: [],
};

type BrandBlock = {
  senderName?: string;
  senderTitle?: string;
  senderCompany?: string;
  senderPhone?: string;
  senderWebsite?: string;
  unsubscribeUrl: string;
  recipientEmail?: string;
  leadNiche?: string;
};

function pickHeroSlug(niche?: string): string {
  const n = String(niche || '').toLowerCase();
  if (/dent|ortho|med|vet|clinic|health|physio|chiro/.test(n)) return 'hero-medical';
  if (/hvac|plumb|electric|roof|contractor|gc|auto|repair|detail/.test(n)) return 'hero-trades';
  if (/salon|barber|nail|spa|beauty|hair|med ?spa/.test(n)) return 'hero-beauty';
  return 'hero-glass';
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPlainText(body: string, b: BrandBlock): string {
  const lines: string[] = [body.trim()];
  const sigLines: string[] = [];
  if (b.senderName) sigLines.push(b.senderName);
  if (b.senderTitle && b.senderCompany) sigLines.push(`${b.senderTitle}, ${b.senderCompany}`);
  else if (b.senderCompany) sigLines.push(b.senderCompany);
  if (b.senderPhone) sigLines.push(b.senderPhone);
  if (b.senderWebsite) sigLines.push(b.senderWebsite);
  if (sigLines.length) lines.push('', '--', ...sigLines);
  lines.push(
    '',
    '----',
    `If you'd rather not hear from us: ${b.unsubscribeUrl}`,
  );
  return lines.join('\n');
}

function extractPrimaryCta(body: string): { cleanedBody: string; ctaUrl: string | null; ctaLabel: string } {
  // Find the last plausible CTA URL in the body (most cold-outreach templates
  // put the CTA near the bottom: "Worth a look? https://..."). Extract it for
  // a styled button and strip it from the remaining body text so it doesn't
  // render twice in HTML.
  const urlMatches = Array.from(body.matchAll(/https?:\/\/[^\s)]+/g));
  if (!urlMatches.length) return { cleanedBody: body, ctaUrl: null, ctaLabel: 'See more' };
  const last = urlMatches[urlMatches.length - 1];
  const url = last[0].replace(/[.,;!?]+$/, '');
  // Heuristic label: based on URL path
  let label = 'Learn more';
  if (/sign[-_]?up|signup|start/i.test(url)) label = 'Start free trial';
  else if (/demo|book|meet|calendly/i.test(url)) label = 'Book a demo';
  else if (/revoai\.ca\/?$/i.test(url)) label = 'Take a look';
  // Remove the URL from the body (and leading soft CTA phrase if present)
  const cleanedBody = body
    .replace(new RegExp(`\\s*${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[.,;!?]*`, 'g'), '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { cleanedBody, ctaUrl: url, ctaLabel: label };
}

function monogramFor(name: string): string {
  const t = String(name || '').trim();
  if (!t) return 'R';
  const parts = t.split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + (parts[parts.length - 1][0] || '')).toUpperCase();
}

function buildHtml(body: string, b: BrandBlock): string {
  const { cleanedBody, ctaUrl, ctaLabel } = extractPrimaryCta(body);
  const paragraphs = cleanedBody
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 18px;line-height:1.75;color:#2A2824;font-size:16px;font-family:Georgia,Cambria,'Times New Roman',serif;">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('');

  const brandName = b.senderCompany || 'RevoAI';
  const initials = monogramFor(b.senderName || brandName);

  // Base URL for hosted email assets (hero image, icons). Falls back to
  // the VPS IP until DNS is live; swap to PUBLIC_APP_BASE later.
  // New filename on each hero iteration forces Gmail image proxy to re-fetch
  // instead of serving the cached version from earlier sends.
  const assetBase = (process.env.PUBLIC_APP_BASE || 'http://187.77.198.39').replace(/\/+$/, '');
  const heroUrl = `${assetBase}/email/${pickHeroSlug(b.leadNiche)}.svg`;

  // Palette — mirrors revoai.ca (warm, botanical, organic)
  //   cream canvas  #FAF7F2
  //   cream deep    #F4EDE1
  //   card paper    #FFFFFF
  //   ink warm      #2A2824
  //   ink soft      #6B6159
  //   rose/blush    #E8B4B8
  //   rose deep     #C98991
  //   sage          #9CAF88
  //   sage deep     #5F7A4E
  //   gold          #D4AF37
  //   gold soft     #F4D798

  const ctaBlock = ctaUrl
    ? `
      <div style="margin:32px 0 14px;text-align:center;">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeHtml(ctaUrl)}" style="height:58px;v-text-anchor:middle;width:280px;" arcsize="50%" strokecolor="#5F7A4E" fillcolor="#5F7A4E">
          <w:anchorlock/>
          <center style="color:#FAF7F2;font-family:Georgia,serif;font-size:16px;font-weight:700;">${escapeHtml(ctaLabel)}</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-- -->
        <a href="${escapeHtml(ctaUrl)}"
           style="display:inline-block;padding:18px 40px;border-radius:999px;background:linear-gradient(135deg,#8AA076 0%,#5F7A4E 100%);color:#FAF7F2;text-decoration:none;font-weight:600;font-size:16px;letter-spacing:.02em;font-family:Georgia,serif;box-shadow:0 10px 26px rgba(95,122,78,0.28),0 2px 6px rgba(95,122,78,0.22);text-align:center;">
          ${escapeHtml(ctaLabel)} &nbsp;→
        </a>
        <!--<![endif]-->
        <div style="margin-top:12px;color:#6B6159;font-size:12px;letter-spacing:.06em;font-style:italic;">7-day free trial · 10-minute setup · No contract</div>
      </div>`
    : '';

  // Stat strip — soft pastel tiles matching revoai.ca's botanical palette
  const statStrip = `
    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;margin:28px 0 8px;">
      <tr>
        <td style="padding:4px;">
          <div style="background:#FCF3F3;border:1px solid #F0D9DB;border-radius:18px;padding:20px 12px;text-align:center;">
            <div style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:#C98991;line-height:1.1;">24/7</div>
            <div style="font-size:10px;letter-spacing:.2em;color:#8A7872;font-weight:600;text-transform:uppercase;margin-top:6px;">Always On</div>
          </div>
        </td>
        <td style="padding:4px;">
          <div style="background:#F5F7EE;border:1px solid #DDE4CC;border-radius:18px;padding:20px 12px;text-align:center;">
            <div style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:#5F7A4E;line-height:1.1;">10 min</div>
            <div style="font-size:10px;letter-spacing:.2em;color:#6B7862;font-weight:600;text-transform:uppercase;margin-top:6px;">Setup</div>
          </div>
        </td>
        <td style="padding:4px;">
          <div style="background:#FBF5E5;border:1px solid #EDDFB7;border-radius:18px;padding:20px 12px;text-align:center;">
            <div style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:#A8821C;line-height:1.1;">$97</div>
            <div style="font-size:10px;letter-spacing:.2em;color:#8A7A50;font-weight:600;text-transform:uppercase;margin-top:6px;">/ mo CAD</div>
          </div>
        </td>
      </tr>
    </table>`;

  // Feature tiles — now 6 tiles (3x2) covering voice, SMS, dashboard, AI chatbox,
  // calendar, and speed-to-live. Matches what's actually pitched in the body copy.
  const featureCards = `
    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;margin:10px 0 6px;">
      <tr>
        <td style="padding:10px 14px;vertical-align:top;width:50%;">
          <div style="display:inline-block;width:40px;height:40px;border-radius:50%;background:#FCEDEE;text-align:center;line-height:40px;font-size:18px;margin-bottom:10px;">📞</div>
          <div style="font-family:Georgia,serif;font-weight:700;font-size:15px;color:#2A2824;">Answers every call, 24/7</div>
          <div style="color:#6B6159;font-size:13.5px;line-height:1.55;margin-top:4px;">Unlimited simultaneous calls, human-sounding voice, sub-second response.</div>
        </td>
        <td style="padding:10px 14px;vertical-align:top;width:50%;">
          <div style="display:inline-block;width:40px;height:40px;border-radius:50%;background:#FBF1DA;text-align:center;line-height:40px;font-size:18px;margin-bottom:10px;">💬</div>
          <div style="font-family:Georgia,serif;font-weight:700;font-size:15px;color:#2A2824;">AI replies to every text</div>
          <div style="color:#6B6159;font-size:13.5px;line-height:1.55;margin-top:4px;">Two-way SMS that books appointments, answers FAQs, and confirms automatically.</div>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 14px;vertical-align:top;">
          <div style="display:inline-block;width:40px;height:40px;border-radius:50%;background:#EFF4E4;text-align:center;line-height:40px;font-size:18px;margin-bottom:10px;">📅</div>
          <div style="font-family:Georgia,serif;font-weight:700;font-size:15px;color:#2A2824;">Books into your calendar</div>
          <div style="color:#6B6159;font-size:13.5px;line-height:1.55;margin-top:4px;">Google, Outlook, iCloud — real-time availability, no double-booking.</div>
        </td>
        <td style="padding:10px 14px;vertical-align:top;">
          <div style="display:inline-block;width:40px;height:40px;border-radius:50%;background:#FCEDEE;text-align:center;line-height:40px;font-size:18px;margin-bottom:10px;">🌐</div>
          <div style="font-family:Georgia,serif;font-weight:700;font-size:15px;color:#2A2824;">AI chatbox for your website</div>
          <div style="color:#6B6159;font-size:13.5px;line-height:1.55;margin-top:4px;">Handles questions, captures leads, and guides visitors to booking.</div>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 14px;vertical-align:top;">
          <div style="display:inline-block;width:40px;height:40px;border-radius:50%;background:#F5F7EE;text-align:center;line-height:40px;font-size:18px;margin-bottom:10px;">📊</div>
          <div style="font-family:Georgia,serif;font-weight:700;font-size:15px;color:#2A2824;">Live dashboard</div>
          <div style="color:#6B6159;font-size:13.5px;line-height:1.55;margin-top:4px;">See every call, text, and booking as it happens. Your whole front desk in one view.</div>
        </td>
        <td style="padding:10px 14px;vertical-align:top;">
          <div style="display:inline-block;width:40px;height:40px;border-radius:50%;background:#FBF1DA;text-align:center;line-height:40px;font-size:18px;margin-bottom:10px;">⚡</div>
          <div style="font-family:Georgia,serif;font-weight:700;font-size:15px;color:#2A2824;">Live in 10 minutes</div>
          <div style="color:#6B6159;font-size:13.5px;line-height:1.55;margin-top:4px;">No setup calls. No contract. Cancel anytime.</div>
        </td>
      </tr>
    </table>`;

  // Dashboard showcase — screenshot with a gold-bordered frame. Shows the
  // product, not just describes it. Between feature grid and video/how-it-works.
  const dashboardUrl = `${assetBase}/email/dashboard.png`;
  const dashboardBlock = `
    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;margin:26px 0 10px;">
      <tr>
        <td style="text-align:center;padding-bottom:14px;">
          <div style="letter-spacing:.28em;font-size:10px;font-weight:700;color:#B89A6A;text-transform:uppercase;margin-bottom:4px;">— The dashboard —</div>
          <div style="font-family:Georgia,serif;font-style:italic;font-size:15px;color:#6B6159;">Your whole front desk, in one view.</div>
        </td>
      </tr>
      <tr>
        <td style="padding:0;">
          <div style="padding:6px;background:linear-gradient(135deg,#F4D798,#D4AF37,#B89A6A);border-radius:16px;box-shadow:0 14px 34px rgba(42,40,36,0.18);">
            <img src="${dashboardUrl}" width="560" alt="RevoAI dashboard — live calls, texts, bookings all in one view" style="display:block;width:100%;max-width:560px;height:auto;border-radius:11px;border:0;outline:none;"/>
          </div>
        </td>
      </tr>
    </table>`;

  // Logo mark (small, for the header above the hero and inline in signature row)
  const logoUrl = `${assetBase}/email/logo-aurora-r-72.png`;

  // Optional video demo block — only renders when DEMO_VIDEO_URL is set in env
  const demoVideoUrl = (process.env.DEMO_VIDEO_URL || '').trim();
  const videoBlock = demoVideoUrl
    ? `
      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;margin:24px 0 4px;">
        <tr>
          <td style="padding:0;">
            <a href="${escapeHtml(demoVideoUrl)}" style="display:block;text-decoration:none;">
              <div style="position:relative;background:linear-gradient(135deg,#1A1510 0%,#2A2218 60%,#1A1510 100%);border-radius:18px;padding:36px 24px;text-align:center;">
                <div style="display:inline-block;width:68px;height:68px;border-radius:50%;background:linear-gradient(135deg,#F4D798,#D4AF37);line-height:68px;font-size:26px;color:#1A1510;margin-bottom:14px;box-shadow:0 8px 24px rgba(212,175,55,0.3);">▶</div>
                <div style="font-family:Georgia,serif;font-size:18px;font-weight:700;color:#F4D798;margin-bottom:4px;">Watch the 90-second demo</div>
                <div style="color:#B8A889;font-size:13px;letter-spacing:.04em;">See what every call, text, and booking looks like for your business</div>
              </div>
            </a>
          </td>
        </tr>
      </table>`
    : '';

  // Ornamental divider — soft botanical flourish between sections
  const flourish = `
    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;margin:26px 0 18px;">
      <tr>
        <td style="text-align:center;">
          <span style="display:inline-block;width:60px;height:1px;background:linear-gradient(90deg,transparent,#D4AF37);vertical-align:middle;"></span>
          <span style="display:inline-block;color:#D4AF37;font-size:14px;margin:0 12px;vertical-align:middle;">❦</span>
          <span style="display:inline-block;width:60px;height:1px;background:linear-gradient(90deg,#D4AF37,transparent);vertical-align:middle;"></span>
        </td>
      </tr>
    </table>`;

  // Numbered "How it works" — three steps, magazine/editorial style
  const howItWorks = `
    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;margin:8px 0 4px;">
      <tr>
        <td style="text-align:center;padding:0 24px 14px;">
          <div style="letter-spacing:.28em;font-size:10px;font-weight:700;color:#B89A6A;text-transform:uppercase;">— How it works —</div>
        </td>
      </tr>
      <tr>
        <td style="padding:4px 10px;vertical-align:top;width:33%;">
          <div style="text-align:center;padding:8px;">
            <div style="display:inline-block;width:36px;height:36px;border-radius:50%;background:#FCEDEE;border:1px solid #F0D9DB;color:#C98991;text-align:center;line-height:34px;font-family:Georgia,serif;font-size:18px;font-weight:700;margin-bottom:10px;">01</div>
            <div style="font-family:Georgia,serif;font-weight:700;font-size:14px;color:#2A2824;">Connect</div>
            <div style="color:#6B6159;font-size:12.5px;line-height:1.55;margin-top:4px;">Plug in your calendar and phone number. Five minutes.</div>
          </div>
        </td>
        <td style="padding:4px 10px;vertical-align:top;width:33%;">
          <div style="text-align:center;padding:8px;">
            <div style="display:inline-block;width:36px;height:36px;border-radius:50%;background:#F5F7EE;border:1px solid #DDE4CC;color:#5F7A4E;text-align:center;line-height:34px;font-family:Georgia,serif;font-size:18px;font-weight:700;margin-bottom:10px;">02</div>
            <div style="font-family:Georgia,serif;font-weight:700;font-size:14px;color:#2A2824;">Customize</div>
            <div style="color:#6B6159;font-size:12.5px;line-height:1.55;margin-top:4px;">Pick a voice, set your hours, add your FAQs.</div>
          </div>
        </td>
        <td style="padding:4px 10px;vertical-align:top;width:33%;">
          <div style="text-align:center;padding:8px;">
            <div style="display:inline-block;width:36px;height:36px;border-radius:50%;background:#FBF5E5;border:1px solid #EDDFB7;color:#A8821C;text-align:center;line-height:34px;font-family:Georgia,serif;font-size:18px;font-weight:700;margin-bottom:10px;">03</div>
            <div style="font-family:Georgia,serif;font-weight:700;font-size:14px;color:#2A2824;">Go live</div>
            <div style="color:#6B6159;font-size:12.5px;line-height:1.55;margin-top:4px;">Every call, text, and booking — handled, 24/7.</div>
          </div>
        </td>
      </tr>
    </table>`;

  // "Crafted with care" pull-quote strip — echoes revoai.ca's brand line
  const careStrip = `
    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;margin:24px 0 4px;">
      <tr>
        <td style="text-align:center;padding:24px 28px;background:linear-gradient(90deg,#FAF7F2 0%,#F4EDE1 50%,#FAF7F2 100%);border-radius:16px;border-left:3px solid #D4AF37;">
          <div style="letter-spacing:.28em;font-size:10px;font-weight:700;color:#B89A6A;text-transform:uppercase;margin-bottom:8px;">— Crafted with care —</div>
          <div style="font-family:Georgia,serif;font-style:italic;font-size:17px;color:#2A2824;line-height:1.5;">&ldquo;A receptionist that never sleeps.<br/>&nbsp;And never sighs.&rdquo;</div>
          <div style="margin-top:8px;font-size:11px;color:#8A7872;letter-spacing:.08em;">BUILT FOR LOCAL BUSINESSES</div>
        </td>
      </tr>
    </table>`;

  const sigRows: string[] = [];
  if (b.senderName) {
    sigRows.push(`<div style="font-family:Georgia,serif;font-weight:700;color:#2A2824;font-size:17px;">${escapeHtml(b.senderName)}</div>`);
  }
  if (b.senderTitle || b.senderCompany) {
    const titleCompany = [b.senderTitle, b.senderCompany].filter(Boolean).map(escapeHtml).join(' · ');
    sigRows.push(`<div style="color:#6B6159;font-size:13px;margin-top:3px;font-style:italic;">${titleCompany}</div>`);
  }
  if (b.senderPhone) {
    sigRows.push(`<div style="color:#6B6159;font-size:13px;margin-top:2px;">${escapeHtml(b.senderPhone)}</div>`);
  }
  if (b.senderWebsite) {
    const href = escapeHtml(b.senderWebsite);
    const display = escapeHtml(b.senderWebsite.replace(/^https?:\/\//, ''));
    sigRows.push(`<div style="font-size:13px;margin-top:3px;"><a href="${href}" style="color:#5F7A4E;text-decoration:none;font-weight:600;border-bottom:1px solid #CFD9BF;padding-bottom:1px;">${display} →</a></div>`);
  }
  // Real headshot (circular avatar) replaces the gradient-initials monogram.
  // Gmail will load the hosted JPG once the sender is trusted ("not spam" /
  // contacts); before that, it shows the alt text — no broken layout.
  const avatarUrl = `${assetBase}/email/tony-headshot.jpg`;
  const signatureBlock = sigRows.length
    ? `
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:34px;padding-top:24px;border-top:1px solid #EDE7DC;width:100%;">
        <tr>
          <td style="vertical-align:top;padding-right:18px;width:60px;">
            <img src="${avatarUrl}" width="56" height="56" alt="${escapeHtml(b.senderName || 'Tony')}" style="display:block;width:56px;height:56px;border-radius:50%;border:2px solid #FFFFFF;box-shadow:0 4px 14px rgba(42,40,36,0.22);object-fit:cover;"/>
          </td>
          <td style="vertical-align:middle;">${sigRows.join('')}</td>
        </tr>
      </table>`
    : '';

  const unsubHref = escapeHtml(b.unsubscribeUrl);
  const footer = `
    <div style="margin-top:28px;padding-top:20px;border-top:1px solid #F0EADF;font-size:11px;color:#8A7872;line-height:1.65;font-family:Georgia,serif;">
      <div style="letter-spacing:.24em;text-transform:uppercase;font-size:10px;color:#B89A6A;font-weight:600;margin-bottom:6px;font-family:-apple-system,BlinkMacSystemFont,Helvetica,sans-serif;">${escapeHtml(brandName)} · Launching 2026</div>
      <span style="font-style:italic;">You're hearing from us because we thought ${escapeHtml(brandName)} might be a fit for your business.</span>
      Prefer quiet? <a href="${unsubHref}" style="color:#5F7A4E;text-decoration:underline;">Unsubscribe here</a>.
    </div>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <meta name="color-scheme" content="light"/>
    <meta name="supported-color-schemes" content="light"/>
    <title>${escapeHtml(brandName)}</title>
  </head>
  <body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2A2824;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Every call answered, with care — day or night.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FAF7F2;padding:36px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#FFFFFF;border-radius:22px;box-shadow:0 1px 3px rgba(42,40,36,.04),0 14px 44px rgba(42,40,36,.08);overflow:hidden;">
            <!-- Brand bar: logo mark + wordmark above the hero -->
            <tr>
              <td style="padding:18px 28px 14px;background:#FFFFFF;border-bottom:1px solid #F1EADF;">
                <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="${logoUrl}" width="32" height="32" alt="${escapeHtml(brandName)}" style="display:inline-block;vertical-align:middle;width:32px;height:32px;border:0;outline:none;"/>
                      <span style="display:inline-block;vertical-align:middle;margin-left:10px;font-family:Georgia,serif;font-weight:700;font-size:17px;letter-spacing:.01em;color:#2A2824;">${escapeHtml(brandName)}</span>
                    </td>
                    <td align="right" style="vertical-align:middle;color:#B89A6A;font-size:10px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;">
                      ${(b.leadNiche && /dent|ortho|med|vet|clinic|physio|chiro|health/.test(b.leadNiche.toLowerCase())) ? 'For clinics' :
                        (b.leadNiche && /hvac|plumb|electric|roof|contractor|auto|repair/.test(b.leadNiche.toLowerCase())) ? 'For the trades' :
                        (b.leadNiche && /salon|barber|nail|spa|beauty|hair/.test(b.leadNiche.toLowerCase())) ? 'For salon & spa' :
                        'Early Access · 2026'}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Hero (clickable — whole banner links to primary CTA) -->
            <tr>
              <td style="background:#1A1510;padding:0;line-height:0;">
                ${ctaUrl
                  ? `<a href="${escapeHtml(ctaUrl)}" style="display:block;line-height:0;text-decoration:none;"><img src="${heroUrl}" alt="${escapeHtml(brandName)} — every call, answered. 24/7." width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;"/></a>`
                  : `<img src="${heroUrl}" alt="${escapeHtml(brandName)} — every call, answered. 24/7." width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"/>`}
              </td>
            </tr>
            <!-- body -->
            <tr>
              <td style="padding:40px 48px 8px;">
                ${paragraphs}
                ${statStrip}
                ${ctaBlock}
              </td>
            </tr>
            <!-- feature grid -->
            <tr>
              <td style="padding:10px 34px 6px;">
                ${featureCards}
              </td>
            </tr>
            <!-- dashboard showcase -->
            <tr>
              <td style="padding:12px 44px 0;">
                ${dashboardBlock}
              </td>
            </tr>
            <!-- ornamental divider -->
            <tr>
              <td style="padding:0 44px;">
                ${flourish}
              </td>
            </tr>
            <!-- how it works -->
            <tr>
              <td style="padding:0 28px 6px;">
                ${howItWorks}
              </td>
            </tr>
            <!-- optional video demo (only when DEMO_VIDEO_URL env is set) -->
            ${videoBlock ? `<tr><td style="padding:6px 44px 8px;">${videoBlock}</td></tr>` : ''}
            <!-- crafted with care pull quote -->
            <tr>
              <td style="padding:8px 44px 8px;">
                ${careStrip}
              </td>
            </tr>
            <!-- signature + footer -->
            <tr>
              <td style="padding:0 48px 42px;">
                ${signatureBlock}
                ${footer}
              </td>
            </tr>
          </table>
          <!-- fine print under card -->
          <div style="max-width:600px;margin:18px auto 0;padding:0 8px;text-align:center;color:#8A7872;font-size:11px;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;">
            <a href="${escapeHtml(b.senderWebsite || 'https://revoai.ca')}" style="color:#8A7872;text-decoration:none;">revoai.ca</a>
            &nbsp;·&nbsp; Toronto, Canada
            &nbsp;·&nbsp; <a href="${unsubHref}" style="color:#8A7872;text-decoration:none;">Unsubscribe</a>
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

@Injectable()
export class DraftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly settings: SettingsService,
    private readonly unsubscribe: UnsubscribeService,
  ) {}

  private decryptSecret(value?: string | null) {
    if (!value) return null;
    const [ivB64, tagB64, dataB64] = String(value).split('.');
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const secret = createHash('sha256').update(process.env.SESSION_SECRET || process.env.ADMIN_TOKEN || 'change-me').digest();
    const iv = Buffer.from(ivB64, 'base64url');
    const tag = Buffer.from(tagB64, 'base64url');
    const data = Buffer.from(dataB64, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', secret, iv);
    decipher.setAuthTag(tag);
    const out = Buffer.concat([decipher.update(data), decipher.final()]);
    return out.toString('utf8');
  }

  async list(q?: { search?: string; status?: string }) {
    const status = q?.status ? String(q.status).toUpperCase() : undefined;
    return this.prisma.draft.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        OR: q?.search
          ? [
              { draftType: { contains: q.search, mode: 'insensitive' } },
              { channel: { equals: q.search as any } },
            ]
          : undefined,
      },
      include: { versions: true, approvals: true, lead: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async create(data: any) {
    const draft = await this.prisma.draft.create({
      data: {
        campaignId: data.campaignId,
        leadId: data.leadId,
        channel: data.channel,
        draftType: data.draftType,
        status: (data?.status ? String(data.status).toUpperCase() : DraftStatus.NEEDS_APPROVAL) as any,
        content: data.content ?? '',
        subject: data.subject ?? null,
        createdBy: data.createdBy,
      } as any,
    });
    await this.prisma.draftVersion.create({
      data: {
        draftId: draft.id,
        versionNumber: 1,
        content: data.content ?? '',
        changeNote: 'Initial draft',
      },
    });
    await this.events.publish({ eventType: 'draft.created', campaignId: draft.campaignId, payload: { draftId: draft.id } });
    return draft;
  }

  async update(id: string, data: any, actorRole: string) {
    const current = await this.prisma.draft.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Draft not found');

    if (data.status && data.status !== current.status) {
      const allowed = allowedDraftTransitions[current.status] || [];
      if (!allowed.includes(data.status)) {
        throw new BadRequestException(`Invalid draft transition ${current.status} -> ${data.status}`);
      }

      if (data.status === DraftStatus.APPROVED && actorRole !== 'admin') {
        throw new BadRequestException('Only admin can approve drafts');
      }
      if (data.status === DraftStatus.REJECTED && actorRole !== 'admin') {
        throw new BadRequestException('Only admin can reject drafts');
      }
    }

    if (data.content) {
      await this.prisma.draftVersion.create({
        data: {
          draftId: id,
          versionNumber: current.currentVersion + 1,
          content: data.content,
          changeNote: data.changeNote ?? 'Updated draft',
        },
      });
      data.currentVersion = current.currentVersion + 1;
    }

    const updated = await this.prisma.draft.update({ where: { id }, data });
    await this.events.publish({ eventType: 'draft.updated', campaignId: updated.campaignId, payload: { draftId: id } });
    return updated;
  }

  async approvalDecision(
    id: string,
    action: 'approve' | 'reject' | 'request-changes' | 'approve-with-notes' | 'edit-inline-approve',
    body: { notes?: string; content?: string },
    actorRole: string,
    actorId?: string,
  ) {
    if (actorRole !== 'admin') throw new BadRequestException('Only admin can perform approval decisions');

    const draft = await this.prisma.draft.findUnique({ where: { id } });
    if (!draft) throw new NotFoundException('Draft not found');
    if (draft.status !== DraftStatus.NEEDS_APPROVAL) {
      throw new BadRequestException('Draft is not in NEEDS_APPROVAL state');
    }

    const notes = (body?.notes || '').trim();
    const content = body?.content || '';

    let nextStatus: DraftStatus = DraftStatus.NEEDS_APPROVAL;
    let approvalAction: ApprovalAction = ApprovalAction.REQUEST_CHANGES;

    if (action === 'approve') {
      nextStatus = DraftStatus.APPROVED;
      approvalAction = ApprovalAction.APPROVE;
    } else if (action === 'reject') {
      nextStatus = DraftStatus.REJECTED;
      approvalAction = ApprovalAction.REJECT;
    } else if (action === 'request-changes') {
      nextStatus = DraftStatus.DRAFT;
      approvalAction = ApprovalAction.REQUEST_CHANGES;
    } else if (action === 'approve-with-notes') {
      nextStatus = DraftStatus.APPROVED;
      approvalAction = ApprovalAction.APPROVE_WITH_NOTES;
    } else if (action === 'edit-inline-approve') {
      if (!content.trim()) throw new BadRequestException('Inline content is required for inline approve');
      nextStatus = DraftStatus.APPROVED;
      approvalAction = ApprovalAction.EDIT_INLINE_APPROVE;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.draft.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Draft not found');

      if (action === 'edit-inline-approve') {
        await tx.draftVersion.create({
          data: {
            draftId: id,
            versionNumber: current.currentVersion + 1,
            content,
            changeNote: 'Inline edit during approval',
          },
        });
      }

      await tx.approval.create({
        data: {
          draftId: id,
          action: approvalAction,
          notes: notes || null,
          editorContent: action === 'edit-inline-approve' ? content : null,
          decidedBy: 'admin',
        },
      });

      const updatedDraft = await tx.draft.update({
        where: { id },
        data: {
          status: nextStatus,
          ...(action === 'edit-inline-approve' ? { currentVersion: current.currentVersion + 1 } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          actorType: 'user',
          actorId: actorId || null,
          action: 'draft.approval.decision',
          resourceType: 'draft',
          resourceId: id,
          beforeState: { status: current.status },
          afterState: { status: updatedDraft.status, currentVersion: updatedDraft.currentVersion },
          metadata: { decision: action },
        },
      });

      return updatedDraft;
    });

    await this.events.publish({
      eventType: 'draft.approval.decided',
      campaignId: updated.campaignId,
      payload: { draftId: id, action, nextStatus },
    });

    return {
      ok: true,
      contractVersion: 'mvp.v1',
      data: {
        draftId: id,
        action,
        nextStatus,
        currentVersion: updated.currentVersion,
      },
    };
  }

  async renderPreview(id: string) {
    const draft = await this.prisma.draft.findUnique({ where: { id } });
    if (!draft) throw new NotFoundException('Draft not found');
    const lead = draft.leadId ? await this.prisma.lead.findUnique({ where: { id: draft.leadId } }) : null;
    const version = await this.prisma.draftVersion.findFirst({
      where: { draftId: draft.id, versionNumber: draft.currentVersion },
    });
    const rawBody = (version?.content || (draft as any).content || '').trim();

    const brand = await this.prisma.brandSettings.findUnique({ where: { id: 'default' } });
    const from = process.env.EMAIL_FROM || process.env.BOOTSTRAP_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '';
    const to = (lead?.email || '').trim() || 'recipient@example.com';
    const subject = ((draft as any).subject || `Quick idea for ${lead?.businessName || 'your business'}`).trim();
    const unsubscribeUrl = this.unsubscribe.buildUnsubscribeUrl(to);
    const brandBlock = {
      senderName: (brand?.yourName || '').trim(),
      senderTitle: (brand?.yourTitle || '').trim(),
      senderCompany: (brand?.companyName || 'RevoAI').trim(),
      senderPhone: (brand?.phoneNumber || '').trim(),
      senderWebsite: (brand?.websiteUrl || 'https://revoai.ca').trim(),
      unsubscribeUrl,
      recipientEmail: to,
      leadNiche: (lead as any)?.niche || undefined,
    };

    return {
      subject,
      from: brandBlock.senderName ? `${brandBlock.senderName}, ${brandBlock.senderCompany} <${from}>` : `${brandBlock.senderCompany} <${from}>`,
      to,
      channel: draft.channel,
      status: draft.status,
      plainText: buildPlainText(rawBody, brandBlock),
      html: buildHtml(rawBody, brandBlock),
    };
  }

  async sendApprovedEmail(id: string, actorRole: string, actorId?: string) {
    if (actorRole !== 'admin') throw new BadRequestException('Admin only action');

    await this.settings.assertOutboundAllowed('email');

    const draft = await this.prisma.draft.findUnique({ where: { id } });
    if (!draft) throw new NotFoundException('Draft not found');
    if (draft.channel !== 'EMAIL') throw new BadRequestException('Send email is only enabled for EMAIL drafts');
    if (draft.status !== DraftStatus.APPROVED) throw new BadRequestException('Draft must be approved before send');

    const existingSent = await this.prisma.outboundSend.findFirst({
      where: { provider: 'EMAIL', draftId: draft.id, status: 'sent' },
      orderBy: { sentAt: 'desc' },
    });
    if (existingSent) {
      throw new BadRequestException('Email already sent for this draft');
    }

    const lead = draft.leadId ? await this.prisma.lead.findUnique({ where: { id: draft.leadId } }) : null;
    const to = (lead?.email || '').trim();
    if (!to) throw new BadRequestException('Lead email is required for email send');

    if (await this.unsubscribe.isSuppressed(to)) {
      throw new BadRequestException(`Recipient ${to} is on the suppression list`);
    }

    const version = await this.prisma.draftVersion.findFirst({
      where: { draftId: draft.id, versionNumber: draft.currentVersion },
    });
    const rawBody = (version?.content || (draft as any).content || '').trim();
    if (!rawBody) throw new BadRequestException('Draft content is empty');

    // Brand signature + subject + HTML/plain-text multipart
    const brand = await this.prisma.brandSettings.findUnique({ where: { id: 'default' } });
    const senderName = (brand?.yourName || '').trim();
    const senderTitle = (brand?.yourTitle || '').trim();
    const senderCompany = (brand?.companyName || 'RevoAI').trim();
    const senderPhone = (brand?.phoneNumber || '').trim();
    const senderWebsite = (brand?.websiteUrl || 'https://revoai.ca').trim();

    const from = process.env.EMAIL_FROM || process.env.BOOTSTRAP_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '';
    const fromName = senderName ? `${senderName}, ${senderCompany}` : senderCompany;
    const fromHeader = from ? `${fromName} <${from}>` : fromName;

    const unsubscribeUrl = this.unsubscribe.buildUnsubscribeUrl(to);
    const subjectLine = ((draft as any).subject || `Quick idea for ${lead?.businessName || 'your business'}`).trim();

    const plainText = buildPlainText(rawBody, {
      senderName,
      senderTitle,
      senderCompany,
      senderPhone,
      senderWebsite,
      unsubscribeUrl,
    });

    const htmlBody = buildHtml(rawBody, {
      senderName,
      senderTitle,
      senderCompany,
      senderPhone,
      senderWebsite,
      unsubscribeUrl,
      recipientEmail: to,
      leadNiche: (lead as any)?.niche || undefined,
    });

    const connection = await this.prisma.connection.findUnique({ where: { provider: 'EMAIL' } });
    const encryptedAccessToken = (connection?.tokenMeta as any)?.encryptedAccessToken || null;
    const accessToken = this.decryptSecret(encryptedAccessToken);

    const providerSendUrl = process.env.EMAIL_PROVIDER_SEND_URL || '';
    const stubMode = String(process.env.OAUTH_STUB_MODE || '1') !== '0';

    const classifyFailure = (statusCode?: number, msg?: string) => {
      const m = String(msg || '').toLowerCase();
      if (statusCode === 401 || statusCode === 403 || m.includes('unauthorized') || m.includes('forbidden') || m.includes('token')) return 'auth_error';
      if (statusCode === 429 || statusCode === 502 || statusCode === 503 || statusCode === 504 || m.includes('timeout') || m.includes('temporar')) return 'transient_failure';
      if (statusCode && statusCode >= 500) return 'provider_error';
      return 'permanent_failure';
    };

    let messageId: string | null = null;
    let sendStatus: 'sent' | 'transient_failure' | 'permanent_failure' | 'auth_error' | 'provider_error' = 'provider_error';
    let sendError: string | null = null;
    let attempts = 0;
    const maxAttempts = 2;

    const smtpHost = String(process.env.EMAIL_SMTP_HOST || '').trim();
    const smtpPort = Number(process.env.EMAIL_SMTP_PORT || 587);
    const smtpUser = String(process.env.EMAIL_SMTP_USER || '').trim();
    const smtpPass = String(process.env.EMAIL_SMTP_PASS || '').trim();
    const smtpSecure = String(process.env.EMAIL_SMTP_SECURE || 'false').toLowerCase() === 'true';
    const useSmtp = !!(smtpHost && smtpUser && smtpPass && from);

    while (attempts < maxAttempts) {
      attempts += 1;
      try {
        if (stubMode && !useSmtp && (!providerSendUrl || !accessToken)) {
          messageId = `stub_email_${Date.now()}`;
          sendStatus = 'sent';
          sendError = null;
          break;
        }

        if (useSmtp) {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const nodemailer = require('nodemailer');
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            auth: { user: smtpUser, pass: smtpPass },
          });

          const info = await transporter.sendMail({
            from: fromHeader,
            to,
            subject: subjectLine,
            text: plainText,
            html: htmlBody,
            headers: {
              'List-Unsubscribe': `<${unsubscribeUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          });

          messageId = (info as any)?.messageId || null;
          sendStatus = 'sent';
          sendError = null;
          break;
        }

        if (!providerSendUrl || !from || !accessToken) {
          throw new Error('Email provider send config/token missing');
        }

        const sendRes = await fetch(providerSendUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            from: fromHeader,
            to,
            subject: subjectLine,
            text: plainText,
            html: htmlBody,
          }),
        });

        const sendJson: any = await sendRes.json().catch(() => ({}));
        if (!sendRes.ok) {
          sendStatus = classifyFailure(sendRes.status, sendJson?.error?.message || sendJson?.message) as any;
          sendError = sendJson?.error?.message || sendJson?.message || `Email provider send failed (HTTP ${sendRes.status})`;
          if (sendStatus === 'transient_failure' && attempts < maxAttempts) continue;
          break;
        }

        messageId = sendJson?.id || sendJson?.messageId || null;
        sendStatus = 'sent';
        sendError = null;
        break;
      } catch (e: any) {
        const code = String(e?.code || '').toUpperCase();
        sendError = e?.message || 'Email send failed';
        if (code === 'EAUTH') sendStatus = 'auth_error';
        else if (code === 'ETIMEDOUT' || code === 'ECONNECTION' || code === 'ESOCKET') sendStatus = 'transient_failure';
        else sendStatus = classifyFailure(undefined, sendError) as any;
        if (sendStatus === 'transient_failure' && attempts < maxAttempts) continue;
        break;
      }
    }

    await this.prisma.outboundSend.create({
      data: {
        provider: 'EMAIL',
        draftId: draft.id,
        leadId: draft.leadId,
        status: sendStatus,
        externalMessageId: messageId,
        error: sendError ? `${sendError} (attempts:${attempts})` : null,
        sentAt: new Date(),
      },
    });

    if (sendStatus === 'sent') {
      await this.prisma.draft.update({ where: { id }, data: { status: 'SENT' as any } });
      if (draft.leadId) {
        await this.prisma.lead.update({ where: { id: draft.leadId }, data: { status: 'CONTACTED', lastActionAt: new Date() } }).catch(() => {});
      }
    }

    await this.prisma.auditLog.create({
      data: {
        actorType: 'user',
        actorId: actorId || null,
        action: 'draft.email_send',
        resourceType: 'draft',
        resourceId: draft.id,
        metadata: {
          provider: 'EMAIL',
          result: sendStatus,
          attempts,
          hasExternalId: !!messageId,
        } as any,
      },
    });

    await this.events.publish({
      eventType: sendStatus === 'sent' ? 'draft.email.sent' : 'draft.email.failed',
      campaignId: draft.campaignId,
      payload: {
        draftId: draft.id,
        leadId: draft.leadId,
        provider: 'EMAIL',
        result: sendStatus,
        attempts,
      },
    });

    if (sendStatus !== 'sent') {
      throw new BadRequestException(sendError || `Email send failed (${sendStatus})`);
    }

    return { ok: true, provider: 'EMAIL', status: sendStatus, attempts, externalMessageId: messageId };
  }

  async emailPipelineStatus() {
    const now = new Date();
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const rows = await this.prisma.outboundSend.findMany({
      where: { provider: 'EMAIL', sentAt: { gte: start } },
      orderBy: { sentAt: 'desc' },
      take: 500,
    });

    const sent = rows.filter((r: any) => String(r.status).toLowerCase() === 'sent').length;
    const failed = rows.length - sent;
    const failureRate = rows.length ? Math.round((failed / rows.length) * 100) : 0;

    return {
      windowHours: 24,
      totals: { attempts: rows.length, sent, failed, failureRatePct: failureRate },
      lastAttemptAt: rows[0]?.sentAt || null,
      stable: failureRate < 20,
      recentFailures: rows
        .filter((r: any) => String(r.status).toLowerCase() !== 'sent')
        .slice(0, 5)
        .map((r: any) => ({ id: r.id, status: r.status, error: r.error, sentAt: r.sentAt })),
    };
  }

  async listEmailSendHistory(limit = 50) {
    const rows = await this.prisma.outboundSend.findMany({
      where: { provider: 'EMAIL' },
      orderBy: { sentAt: 'desc' },
      take: Math.min(Math.max(Number(limit) || 50, 1), 200),
    });

    const leadIds = Array.from(new Set(rows.map((r) => r.leadId).filter(Boolean))) as string[];
    const leads = leadIds.length
      ? await this.prisma.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, email: true } })
      : [];
    const emailByLeadId = new Map(leads.map((l) => [l.id, l.email || null]));

    return rows.map((r: any) => ({
      id: r.id,
      draftId: r.draftId || null,
      recipient: r.leadId ? (emailByLeadId.get(r.leadId) || null) : null,
      provider: r.provider,
      status: r.status,
      timestamp: r.sentAt,
      externalMessageId: r.externalMessageId || null,
      failureClassification: r.status === 'sent' ? null : r.status,
      error: r.error || null,
    }));
  }

  async handleEmailDeliveryHook(payload: any) {
    const externalMessageId = String(payload?.externalMessageId || payload?.messageId || '').trim();
    const outboundSendId = String(payload?.outboundSendId || '').trim();
    const type = String(payload?.type || payload?.event || '').trim().toLowerCase();
    const error = String(payload?.error || payload?.reason || '').trim() || null;

    if (!externalMessageId && !outboundSendId) {
      throw new BadRequestException('externalMessageId or outboundSendId is required');
    }

    let nextStatus = 'provider_error';
    if (type.includes('bounce') || type.includes('hard_fail') || type.includes('reject')) nextStatus = 'permanent_failure';
    else if (type.includes('temp') || type.includes('retry') || type.includes('defer')) nextStatus = 'transient_failure';
    else if (type.includes('auth')) nextStatus = 'auth_error';

    const where = outboundSendId ? { id: outboundSendId } : { externalMessageId };
    const current = await this.prisma.outboundSend.findFirst({ where: where as any });
    if (!current) throw new NotFoundException('Outbound send record not found');

    const updated = await this.prisma.outboundSend.update({
      where: { id: current.id },
      data: { status: nextStatus, error: error || current.error || `delivery_event:${type || 'unknown'}` },
    });

    await this.prisma.auditLog.create({
      data: {
        actorType: 'system',
        action: 'draft.email_delivery_update',
        resourceType: 'outbound_send',
        resourceId: updated.id,
        metadata: {
          provider: 'EMAIL',
          eventType: type || 'unknown',
          status: nextStatus,
        } as any,
      },
    });

    await this.events.publish({
      eventType: 'draft.email.delivery_update',
      campaignId: null,
      payload: {
        outboundSendId: updated.id,
        externalMessageId: updated.externalMessageId,
        status: updated.status,
      },
    });

    return { ok: true, id: updated.id, status: updated.status };
  }

  async sendApprovedLinkedin(id: string, actorRole: string) {
    if (actorRole !== 'admin') throw new BadRequestException('Admin only action');
    await this.settings.assertOutboundAllowed('linkedin');

    const draft = await this.prisma.draft.findUnique({ where: { id } });
    if (!draft) throw new NotFoundException('Draft not found');
    if (draft.channel !== 'LINKEDIN') throw new BadRequestException('LinkedIn send only for LinkedIn drafts');
    if (draft.status !== DraftStatus.APPROVED) throw new BadRequestException('Draft must be approved before send');

    const version = await this.prisma.draftVersion.findFirst({ where: { draftId: draft.id, versionNumber: draft.currentVersion } });
    const messageBody = (version?.content || (draft as any).content || '').trim();
    if (!messageBody) throw new BadRequestException('Draft content is empty');

    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const usedToday = await this.prisma.linkedinMessage.count({ where: { status: 'sent', sentAt: { gte: start, lt: end } } as any });
    if (usedToday >= 20) throw new BadRequestException('LinkedIn DM daily limit reached (20/day)');

    const msg = await this.prisma.linkedinMessage.create({
      data: { leadId: draft.leadId, draftId: draft.id, messageBody, status: 'approved' },
    });

    const sent = await this.prisma.linkedinMessage.update({
      where: { id: msg.id },
      data: { status: 'sent', sentAt: new Date(), externalThreadId: `li_dm_stub_${Date.now()}` },
    });

    await this.prisma.draft.update({ where: { id }, data: { status: 'SENT' as any } });
    if (draft.leadId) {
      await this.prisma.lead.update({ where: { id: draft.leadId }, data: { status: 'CONTACTED', lastActionAt: new Date() } }).catch(() => {});
    }

    await this.prisma.auditLog.create({
      data: {
        actorType: 'user',
        action: 'draft.linkedin_send',
        resourceType: 'draft',
        resourceId: draft.id,
        metadata: { messageId: sent.id } as any,
      },
    });

    await this.events.publish({ eventType: 'LINKEDIN_DM_SENT', campaignId: draft.campaignId, payload: { draftId: draft.id, linkedinMessageId: sent.id } });
    return { ok: true, id: sent.id };
  }

  async sendApprovedFacebook(id: string, actorRole: string) {
    if (actorRole !== 'admin') throw new BadRequestException('Admin only action');
    await this.settings.assertOutboundAllowed('facebook');

    const draft = await this.prisma.draft.findUnique({ where: { id } });
    if (!draft) throw new NotFoundException('Draft not found');
    if (draft.channel !== 'FACEBOOK') throw new BadRequestException('Facebook send only for Facebook drafts');
    if (draft.status !== DraftStatus.APPROVED) throw new BadRequestException('Draft must be approved before send');

    const res = await fetch(`${process.env.PUBLIC_API_BASE || 'http://localhost:3001'}/api/facebook/publish`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-token': process.env.ADMIN_TOKEN || 'change-me' },
      body: JSON.stringify({ draftId: draft.id, mode: 'draft' }),
    });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new BadRequestException(j?.error?.message || `Facebook publish failed (${res.status})`);

    await this.prisma.draft.update({ where: { id }, data: { status: 'SENT' as any } });

    await this.prisma.auditLog.create({
      data: {
        actorType: 'user',
        action: 'draft.facebook_send',
        resourceType: 'draft',
        resourceId: draft.id,
      },
    });

    return { ok: true, externalPostId: j?.externalPostId || null };
  }

  async queueApprovedSend(id: string, actorRole: string, actorId?: string) {
    if (actorRole !== 'admin') throw new BadRequestException('Admin only action');

    const draft = await this.prisma.draft.findUnique({ where: { id } });
    if (!draft) throw new NotFoundException('Draft not found');
    if (draft.status !== DraftStatus.APPROVED) throw new BadRequestException('Draft must be approved before queueing');

    const existingQueued = await this.prisma.outboundQueue.findFirst({
      where: {
        draftId: id,
        status: { in: ['DRAFT', 'APPROVED', 'QUEUED', 'SENDING'] as any },
      } as any,
      orderBy: { createdAt: 'desc' },
    });
    if (existingQueued) {
      throw new BadRequestException('Draft already has an active queue job');
    }

    const version = await this.prisma.draftVersion.findFirst({ where: { draftId: draft.id, versionNumber: draft.currentVersion } });
    const payload = {
      content: version?.content || (draft as any).content || '',
      subject: (draft as any).subject || null,
      draftType: draft.draftType,
      leadId: draft.leadId,
    };

    const queued = await this.prisma.outboundQueue.create({
      data: {
        channel: draft.channel as any,
        draftId: draft.id,
        leadId: draft.leadId,
        campaignId: draft.campaignId,
        status: 'QUEUED',
        approvedAt: new Date(),
        approvedBy: actorId || null,
        payload: payload as any,
        metadata: { queuedFrom: 'drafts.queueApprovedSend' } as any,
      } as any,
    });

    await this.prisma.auditLog.create({
      data: {
        actorType: 'user',
        actorId: actorId || null,
        action: 'draft.queued_for_send',
        resourceType: 'draft',
        resourceId: draft.id,
        metadata: { queueId: queued.id, channel: draft.channel } as any,
      },
    });

    await this.events.publish({
      eventType: 'draft.queued_for_send',
      campaignId: draft.campaignId,
      payload: { draftId: draft.id, queueId: queued.id, channel: draft.channel },
    });

    return { ok: true, queueId: queued.id, status: queued.status };
  }

  async processQueuedOutbound(limit = 10, channel?: 'EMAIL' | 'LINKEDIN' | 'FACEBOOK') {
    const max = Math.min(Math.max(Number(limit) || 10, 1), 50);
    const rows = await this.prisma.outboundQueue.findMany({
      where: {
        status: 'QUEUED' as any,
        OR: [{ sendAfter: null }, { sendAfter: { lte: new Date() } }],
        ...(channel ? { channel: channel as any } : { channel: { in: ['EMAIL', 'LINKEDIN', 'FACEBOOK'] as any } }),
      } as any,
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      take: max,
    });

    const classifyFailure = (msg: string) => {
      const m = String(msg || '').toLowerCase();
      if (m.includes('expired') || m.includes('missing') || m.includes('not connected') || m.includes('auth')) return 'AUTH_OR_TOKEN';
      if (m.includes('daily cap') || m.includes('limit') || m.includes('kill-switch')) return 'POLICY_LIMIT';
      if (m.includes('timeout') || m.includes('temporary') || m.includes('transient')) return 'TRANSIENT';
      if (m.includes('unsupported') || m.includes('missing draft')) return 'CONFIG';
      return 'PROVIDER_OR_UNKNOWN';
    };

    const results: any[] = [];
    for (const q of rows as any[]) {
      await this.prisma.outboundQueue.update({ where: { id: q.id }, data: { status: 'SENDING', workerLockedAt: new Date() } as any });
      try {
        if (!q.draftId) throw new Error('Missing draftId in queue payload');
        if (String(q.channel) === 'EMAIL') {
          await this.sendApprovedEmail(q.draftId, 'admin');
        } else if (String(q.channel) === 'LINKEDIN') {
          await this.sendApprovedLinkedin(q.draftId, 'admin');
        } else if (String(q.channel) === 'FACEBOOK') {
          await this.sendApprovedFacebook(q.draftId, 'admin');
        } else {
          throw new Error(`Unsupported queued channel: ${q.channel}`);
        }

        await this.prisma.outboundQueue.update({
          where: { id: q.id },
          data: {
            status: 'SENT',
            attemptCount: { increment: 1 },
            failureReason: null,
            metadata: { ...(q.metadata as any), lastResult: 'SENT', lastProcessedAt: new Date().toISOString() } as any,
            updatedAt: new Date(),
          } as any,
        });
        results.push({ queueId: q.id, status: 'sent' });
      } catch (e: any) {
        const err = String(e?.message || 'Queue execution failed');
        const nextAttempts = Number(q.attemptCount || 0) + 1;
        const maxAttempts = Number(q.maxAttempts || 3);
        const failureCode = classifyFailure(err);
        const retryable = failureCode === 'TRANSIENT' && nextAttempts < maxAttempts;

        await this.prisma.outboundQueue.update({
          where: { id: q.id },
          data: {
            status: retryable ? 'QUEUED' : 'FAILED',
            attemptCount: { increment: 1 },
            sendAfter: retryable ? new Date(Date.now() + 60 * 1000 * nextAttempts) : q.sendAfter,
            failureReason: `${failureCode}: ${err}`,
            metadata: {
              ...(q.metadata as any),
              lastResult: retryable ? 'REQUEUED' : 'FAILED',
              failureCode,
              retryable,
              lastProcessedAt: new Date().toISOString(),
            } as any,
            updatedAt: new Date(),
          } as any,
        });
        results.push({ queueId: q.id, status: retryable ? 'requeued' : 'failed', error: err, failureCode });
      }
    }

    await this.events.publish({ eventType: 'outbound.queue.processed', payload: { count: results.length, channel: channel || 'ALL' } });
    return { ok: true, processed: results.length, results };
  }

  async queueOverview() {
    const rows = await this.prisma.outboundQueue.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const byStatus = rows.reduce((acc: any, r: any) => {
      const s = String(r.status || 'UNKNOWN');
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      counts: {
        queued: byStatus.QUEUED || 0,
        sending: byStatus.SENDING || 0,
        sent: byStatus.SENT || 0,
        failed: byStatus.FAILED || 0,
      },
      recent: rows.slice(0, 20),
    };
  }

  async retryFailedQueueJob(id: string) {
    const row = await this.prisma.outboundQueue.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Queue job not found');
    if (String(row.status) !== 'FAILED') throw new BadRequestException('Only FAILED jobs can be retried');

    const reset = await this.prisma.outboundQueue.update({
      where: { id },
      data: {
        status: 'QUEUED',
        sendAfter: null,
        failureReason: null,
        metadata: { ...(row.metadata as any), manualRetryAt: new Date().toISOString() } as any,
      } as any,
    });

    await this.events.publish({ eventType: 'outbound.queue.retry_requested', payload: { queueId: id } });
    return { ok: true, queueId: reset.id, status: reset.status };
  }

  async listSendHistory(limit = 100) {
    const emailHistory = await this.listEmailSendHistory(limit);
    const li = await this.prisma.linkedinMessage.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
    const linkedinHistory = li.map((m) => ({
      id: m.id,
      draftId: m.draftId,
      recipient: null,
      provider: 'LINKEDIN',
      status: m.status,
      timestamp: m.sentAt || m.createdAt,
      externalMessageId: m.externalThreadId || null,
      failureClassification: m.status === 'sent' ? null : m.status,
      replyStatus: m.replyReceivedAt ? 'Yes' : (m.status === 'sent' ? 'No' : 'Pending'),
    }));

    const merged = [...emailHistory.map((e: any) => ({ ...e, replyStatus: 'Pending' })), ...linkedinHistory]
      .sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
      .slice(0, limit);
    return merged;
  }

  async markSentManual(id: string, actorRole: string) {
    if (actorRole !== 'admin') throw new BadRequestException('Admin only action');

    await this.settings.assertOutboundAllowed('linkedin');

    const draft = await this.prisma.draft.findUnique({ where: { id } });
    if (!draft) throw new NotFoundException('Draft not found');
    if (draft.channel !== 'LINKEDIN') throw new BadRequestException('Manual mark sent is only enabled for LinkedIn drafts');
    if (draft.status !== DraftStatus.APPROVED) throw new BadRequestException('Draft must be approved before manual sent mark');

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedDraft = await tx.draft.update({ where: { id }, data: { status: 'SENT' as any } });
      let updatedLead: any = null;
      if (draft.leadId) {
        updatedLead = await tx.lead.update({ where: { id: draft.leadId }, data: { status: 'CONTACTED', lastActionAt: new Date() } });
      }
      await tx.auditLog.create({
        data: {
          actorType: 'user',
          action: 'draft.marked_sent',
          resourceType: 'draft',
          resourceId: draft.id,
          beforeState: { status: draft.status },
          afterState: { status: updatedDraft.status, leadStatus: updatedLead?.status },
          metadata: { manual: true, channel: 'LINKEDIN', dryRun: false },
        },
      });
      return { updatedDraft, updatedLead };
    });

    await this.events.publish({
      eventType: 'draft.marked_sent',
      campaignId: draft.campaignId,
      payload: { draftId: draft.id, leadId: draft.leadId, manual: true },
    });

    return result;
  }
}
