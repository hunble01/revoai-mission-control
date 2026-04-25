import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import Anthropic from '@anthropic-ai/sdk';

// AI image generation for social posts.
//
// Default provider: OpenAI DALL-E 3 (cleanest API, ~$0.04/1024×1024 standard)
// Stub mode default — IMAGES_STUB_MODE=1 — returns a deterministic placeholder
// URL so the UI can be tested before the user provisions OPENAI_API_KEY.
//
// Other providers can be added later (Stable Diffusion via Replicate, fal.ai)
// by adding new `source` values and dispatching in `generate`.

type Size = '1024x1024' | '1024x1792' | '1792x1024';

@Injectable()
export class ImagesService {
  private readonly log = new Logger('ImagesService');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Use Claude to expand a short post body into a vivid image-generation
   * prompt that's brand-aligned. Falls back to a passthrough if no API key.
   */
  async refinePromptForPost(postBody: string, platform?: string): Promise<string> {
    const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
    const trimmed = String(postBody || '').trim();
    if (!trimmed) return '';
    if (!apiKey) return trimmed.slice(0, 300);

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const model = (process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001').trim();

    const systemPrompt = `Turn a short social post into a vivid image-generation prompt for DALL-E 3. Output a single sentence describing the visual: subject, composition, lighting, mood, style. RevoAI brand cues: warm, professional, calm, botanical/organic — not aggressive SaaS bro. Avoid stock-photo cliches. No text in the image. No people's faces unless the post explicitly references one. Platform: ${platform || 'social'}. Return only the prompt sentence — no preamble, no quotes.`;

    try {
      const client = new Anthropic({ apiKey });
      const resp = await client.messages.create({
        model,
        max_tokens: 200,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Post body:\n${trimmed.slice(0, 1500)}\n\nReturn the image prompt now.` }],
      });
      const text = (resp.content || [])
        .map((b: any) => (b.type === 'text' ? b.text : ''))
        .join('')
        .trim()
        .replace(/^["'`]+|["'`]+$/g, '');
      return text || trimmed.slice(0, 300);
    } catch (err: any) {
      this.log.warn(`refinePromptForPost failed: ${err?.message || err}`);
      return trimmed.slice(0, 300);
    }
  }

  /**
   * Generate one image. Returns a saved MediaAsset row so the caller has
   * a persistent URL to pin to a SocialPost.mediaUrl.
   *
   * In stub mode: returns a deterministic placeholder.image URL. Lets the
   * UI flow be tested end-to-end without paying OpenAI.
   */
  async generate(opts: { prompt: string; size?: Size; platform?: string; actorId?: string }) {
    const prompt = String(opts.prompt || '').trim();
    if (!prompt) throw new BadRequestException('prompt required');
    const size: Size = (opts.size as Size) || '1024x1024';

    const stub = String(process.env.IMAGES_STUB_MODE || (process.env.OPENAI_API_KEY ? '0' : '1')) !== '0';

    let url: string;
    let source: string;
    let costCents: number | null = null;
    let width = 1024;
    let height = 1024;
    if (size === '1024x1792') { width = 1024; height = 1792; }
    if (size === '1792x1024') { width = 1792; height = 1024; }

    if (stub) {
      source = 'stub';
      const seed = encodeURIComponent(prompt.slice(0, 60));
      // picsum.photos returns a free seeded placeholder image, no key needed
      url = `https://picsum.photos/seed/${seed}/${width}/${height}`;
    } else {
      source = 'dalle3';
      const apiKey = process.env.OPENAI_API_KEY || '';
      if (!apiKey) throw new BadRequestException('OPENAI_API_KEY not configured');
      const endpoint = process.env.OPENAI_IMAGE_URL || 'https://api.openai.com/v1/images/generations';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: prompt.slice(0, 4000),
          n: 1,
          size,
          quality: process.env.OPENAI_IMAGE_QUALITY || 'standard',
        }),
      });
      const j: any = await res.json().catch(() => ({}));
      if (!res.ok || !j?.data?.[0]?.url) {
        throw new BadRequestException(j?.error?.message || `Image generation failed (${res.status})`);
      }
      url = j.data[0].url;
      // DALL-E 3 standard 1024x1024 is $0.04, 1024x1792/1792x1024 is $0.08, hd is 2x
      costCents = size === '1024x1024' ? 4 : 8;
      if ((process.env.OPENAI_IMAGE_QUALITY || 'standard') === 'hd') costCents *= 2;
    }

    const saved = await (this.prisma as any).mediaAsset.create({
      data: {
        kind: 'image',
        source,
        prompt: prompt.slice(0, 4000),
        url,
        width,
        height,
        costCents,
        metadata: { platform: opts.platform || null, size } as any,
        createdBy: opts.actorId || null,
      },
    });

    return { ok: true, asset: saved };
  }

  async list(limit = 30) {
    return (this.prisma as any).mediaAsset.findMany({
      where: { kind: 'image' },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit) || 30, 100),
    });
  }
}
