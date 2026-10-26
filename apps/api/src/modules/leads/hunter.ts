// -------- Hunter.io owner-email lookup --------
//
// Given a lead's website, asks Hunter's domain search for every email it
// knows at that domain and picks the one most likely to reach the owner /
// decision-maker. Local service businesses rarely label roles cleanly, so
// we rank on position text, seniority, personal-vs-generic, and Hunter's
// own confidence + verification, falling back to a usable generic inbox
// (info@, contact@) when no person is found.

export type HunterPick = {
  email: string;
  kind: 'owner' | 'personal' | 'generic';
  contactName: string | null;
  contactRole: string | null;
  linkedinUrl: string | null;
  confidence: number | null;
  verification: string | null;
};

// Websites that aren't the business's own domain — Hunter would return the
// platform's staff (e.g. Facebook employees), never the business owner.
const NON_BUSINESS_DOMAINS = [
  'facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'x.com', 'tiktok.com', 'youtube.com',
  'google.com', 'business.site', 'linktr.ee', 'yelp.com', 'yelp.ca',
  'wixsite.com', 'square.site', 'squarespace.com', 'godaddysites.com', 'weebly.com', 'wordpress.com',
  'booksy.com', 'vagaro.com', 'fresha.com', 'schedulicity.com', 'janeapp.com', 'mindbodyonline.com',
];

const OWNER_ROLE = /\b(owner|co-?owner|founder|co-?founder|president|ceo|chief executive|principal|proprietor|managing (partner|director)|partner|dentist|doctor|dr\.?|dds|dmd|chiropractor|clinic director|practice (owner|manager)|broker of record)\b/i;

// Generic inboxes nobody reads for sales mail, or that bounce/complain.
const DEAD_GENERIC = /^(no-?reply|do-?not-?reply|careers?|jobs|hr|recruit(ing|ment)?|privacy|abuse|webmaster|postmaster|billing|accounts?|invoices?|press|media|legal)@/i;

export function domainFromWebsite(website: string | null | undefined): string | null {
  const raw = String(website || '').trim();
  if (!raw) return null;
  let host: string;
  try {
    host = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.toLowerCase();
  } catch {
    return null;
  }
  host = host.replace(/^www\./, '');
  if (!host.includes('.')) return null;
  if (NON_BUSINESS_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) return null;
  return host;
}

export function isGenericEmail(email: string | null | undefined): boolean {
  return /^(info|contact|hello|hi|office|admin|reception|frontdesk|front\.desk|appointments?|bookings?|book|enquir(y|ies)|inquir(y|ies)|support|team|mail|general|sales|service)@/i.test(
    String(email || ''),
  );
}

function scoreEmail(e: any): number {
  const position = String(e?.position || '');
  let s = 0;
  if (OWNER_ROLE.test(position)) s += 100;
  if (e?.seniority === 'executive') s += 40;
  if (e?.type === 'personal') s += 20;
  if (e?.verification?.status === 'valid') s += 10;
  s += Math.min(100, Number(e?.confidence || 0)) / 10;
  return s;
}

export async function findOwnerEmailWithHunter(website: string | null | undefined): Promise<HunterPick | null> {
  const apiKey = String(process.env.HUNTER_API_KEY || '').trim();
  const domain = domainFromWebsite(website);
  if (!apiKey || !domain) return null;

  let emails: any[] = [];
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=10&api_key=${encodeURIComponent(apiKey)}`,
      { signal: ctrl.signal } as any,
    );
    clearTimeout(timer);
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn(`[hunter] ${domain}: HTTP ${res.status} ${JSON.stringify(json?.errors || '').slice(0, 200)}`);
      return null;
    }
    emails = Array.isArray(json?.data?.emails) ? json.data.emails : [];
  } catch (err: any) {
    console.warn(`[hunter] ${domain}: ${err?.message || err}`);
    return null;
  }

  const usable = emails.filter(
    (e) => e?.value && e?.verification?.status !== 'invalid' && !DEAD_GENERIC.test(String(e.value)),
  );
  if (!usable.length) return null;

  const best = usable.sort((a, b) => scoreEmail(b) - scoreEmail(a))[0];
  const position = best?.position ? String(best.position) : null;
  const isOwner = !!position && OWNER_ROLE.test(position);
  const isPersonal = best?.type === 'personal' && !isGenericEmail(best.value);
  return {
    email: String(best.value).toLowerCase(),
    kind: isOwner ? 'owner' : isPersonal ? 'personal' : 'generic',
    contactName: [best?.first_name, best?.last_name].filter(Boolean).join(' ') || null,
    contactRole: position,
    linkedinUrl: best?.linkedin || null,
    confidence: typeof best?.confidence === 'number' ? best.confidence : null,
    verification: best?.verification?.status || null,
  };
}
