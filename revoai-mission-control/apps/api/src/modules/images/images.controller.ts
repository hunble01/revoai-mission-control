import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { assertAdminToken } from '../../common/auth.util';
import { ImagesService } from './images.service';

@Controller('images')
export class ImagesController {
  constructor(private readonly images: ImagesService) {}

  @Post('refine-prompt')
  async refine(@Req() req: any, @Body() body: any) {
    assertAdminToken(req);
    const refined = await this.images.refinePromptForPost(String(body?.body || ''), body?.platform ? String(body.platform) : undefined);
    return { ok: true, prompt: refined };
  }

  @Post('generate')
  generate(@Req() req: any, @Body() body: any) {
    assertAdminToken(req);
    const actorId = req?.headers?.['x-actor-id'] ? String(req.headers['x-actor-id']) : undefined;
    return this.images.generate({
      prompt: String(body?.prompt || ''),
      size: body?.size,
      platform: body?.platform ? String(body.platform) : undefined,
      actorId,
    });
  }

  @Get()
  list(@Req() req: any, @Query('limit') limit?: string) {
    assertAdminToken(req);
    return this.images.list(limit ? Number(limit) : 30);
  }
}
