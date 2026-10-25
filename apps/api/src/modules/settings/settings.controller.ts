import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSafetyDto } from './dto/settings.dto';
import { assertAdminRole, assertAdminToken, getActorRole } from '../../common/auth.util';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  getSettings(@Req() req: any) {
    assertAdminToken(req);
    return this.settings.getSafety();
  }

  @Get('safety')
  getSafety(@Req() req: any) {
    assertAdminToken(req);
    return this.settings.getSafety();
  }

  @Patch()
  patchSettings(@Req() req: any, @Body() body: any) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'settings patch');
    return this.settings.updateSafety(body);
  }

  @Get('brand')
  getBrand(@Req() req: any) {
    assertAdminToken(req);
    return this.settings.getBrand();
  }

  @Post('brand')
  saveBrand(@Req() req: any, @Body() body: any) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'settings brand save');
    return this.settings.saveBrand(body);
  }

  @Patch('safety')
  patchSafety(@Req() req: any, @Body() body: UpdateSafetyDto) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'settings safety patch');
    return this.settings.updateSafety(body);
  }

  @Post('safety/danger/clear-draft-queue')
  clearDraftQueue(@Req() req: any) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'clear draft queue');
    return this.settings.clearDraftQueue();
  }

  @Post('safety/danger/reset-agent-states')
  resetAgentStates(@Req() req: any) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'reset agent states');
    return this.settings.resetAgentStates();
  }

  @Get('integrations')
  integrations(@Req() req: any) {
    assertAdminToken(req);
    const envSet = (k: string) => {
      const v = String(process.env[k] || '').trim();
      return !!v && v !== 'change-me' && !v.startsWith('<');
    };
    const rows = [
      {
        key: 'email',
        label: 'Email (outbound)',
        unlocks: 'Send real cold emails via Resend',
        required: ['EMAIL_SMTP_HOST', 'EMAIL_SMTP_USER', 'EMAIL_SMTP_PASS', 'EMAIL_FROM'],
        status: envSet('EMAIL_SMTP_HOST') && envSet('EMAIL_SMTP_USER') && envSet('EMAIL_SMTP_PASS') && envSet('EMAIL_FROM') ? 'active' : 'missing',
      },
      {
        key: 'llm',
        label: 'AI-personalized drafts',
        unlocks: 'Replace template copy with true per-lead AI writing',
        required: ['ANTHROPIC_API_KEY'],
        status: envSet('ANTHROPIC_API_KEY') || envSet('OPENAI_API_KEY') ? 'active' : 'missing',
      },
      {
        key: 'gmaps',
        label: 'Google Maps lead discovery',
        unlocks: 'Automatic local-business research from map searches',
        required: ['GOOGLE_MAPS_API_KEY'],
        status: envSet('GOOGLE_MAPS_API_KEY') ? 'active' : 'missing',
      },
      {
        key: 'hunter',
        label: 'Hunter email finder',
        unlocks: 'Find emails from company domains',
        required: ['HUNTER_API_KEY'],
        status: envSet('HUNTER_API_KEY') ? 'active' : 'missing',
      },
      {
        key: 'apollo',
        label: 'Apollo B2B contacts',
        unlocks: 'Pull decision-maker contacts + enriched lead data',
        required: ['APOLLO_API_KEY'],
        status: envSet('APOLLO_API_KEY') ? 'active' : 'missing',
      },
      {
        key: 'linkedin',
        label: 'LinkedIn posts',
        unlocks: 'Publish approved posts to your LinkedIn page',
        required: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
        status: envSet('LINKEDIN_CLIENT_ID') && envSet('LINKEDIN_CLIENT_SECRET') && process.env.LINKEDIN_STUB_MODE === '0' ? 'active' : 'missing',
      },
      {
        key: 'linkedin_dm',
        label: 'LinkedIn DMs',
        unlocks: 'Send approval-gated LinkedIn DMs (20/day cap enforced)',
        required: ['UNIPILE_API_KEY', 'UNIPILE_DM_SEND_URL'],
        status: envSet('UNIPILE_API_KEY') && envSet('UNIPILE_DM_SEND_URL') && process.env.LINKEDIN_DM_STUB_MODE === '0' ? 'active' : 'missing',
      },
      {
        key: 'facebook',
        label: 'Facebook posts',
        unlocks: 'Publish to your Facebook page + pull insights',
        required: ['FACEBOOK_CLIENT_ID', 'FACEBOOK_CLIENT_SECRET', 'FACEBOOK_PAGE_ID'],
        status: envSet('FACEBOOK_CLIENT_ID') && envSet('FACEBOOK_CLIENT_SECRET') && envSet('FACEBOOK_PAGE_ID') && process.env.FACEBOOK_STUB_MODE === '0' ? 'active' : 'missing',
      },
      {
        key: 'demo_video',
        label: 'Demo video in emails',
        unlocks: 'Adds a "Watch the 90-second demo" card to every outbound email',
        required: ['DEMO_VIDEO_URL'],
        status: envSet('DEMO_VIDEO_URL') ? 'active' : 'missing',
      },
    ];
    return {
      rows,
      activeCount: rows.filter((r) => r.status === 'active').length,
      missingCount: rows.filter((r) => r.status === 'missing').length,
    };
  }
}
