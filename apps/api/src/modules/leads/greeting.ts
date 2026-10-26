// Names as they should appear in outreach copy.

// "Dr. Rachel Ruppel" → "Dr. Ruppel"; "Monica Plewes" → "Monica"; "" → ""
export function greetingNameFor(contactName: string | null | undefined): string {
  const parts = String(contactName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (/^dr\.?$/i.test(parts[0])) return parts.length > 1 ? `Dr. ${parts[parts.length - 1]}` : '';
  if (/^(mr|mrs|ms|mx|prof|rev|sir|dame|madam)\.?$/i.test(parts[0])) return parts[1] || '';
  // Initials-only first names ("R.A") read oddly as a greeting
  if (/^([a-z]\.?){1,3}$/i.test(parts[0])) return '';
  return parts[0];
}

// Google Maps listing names carry SEO tails:
// "Rachel Ruppel, MD - Laser Hair Removal Specialist" → "Rachel Ruppel, MD"
export function shortBusinessName(name: string | null | undefined): string {
  const raw = String(name || '').trim();
  const head = raw.split(/\s+[-–—|:]\s+|\s*\|\s*/)[0].trim();
  return head || raw;
}

// Cut at a word boundary instead of mid-word.
export function clipAtWord(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : s.slice(0, max)).replace(/[\s,.;:–—-]+$/, '');
}
