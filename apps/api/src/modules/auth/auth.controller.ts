import { Body, Controller, Get, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('bootstrap')
  bootstrap() {
    return this.auth.bootstrapAdmin();
  }

  @Post('login')
  async login(@Req() req: any, @Res({ passthrough: true }) res: any, @Body() body: any) {
    const out = await this.auth.login(body?.email, body?.password, req.ip, req.headers['user-agent']);
    res.setHeader('Set-Cookie', this.auth.cookieHeader(out.token, out.expiresAt));
    return { ok: true, user: out.user, expiresAt: out.expiresAt };
  }

  @Post('logout')
  async logout(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const rawCookie = String(req.headers?.cookie || '');
    const cookieValue = rawCookie
      .split(';')
      .map((p: string) => p.trim())
      .find((p: string) => p.startsWith(`${this.auth.sessionCookieName()}=`))
      ?.split('=')?.[1];
    const session = this.auth.decodeSession(cookieValue || null);
    await this.auth.logout(session?.sid);
    res.setHeader('Set-Cookie', this.auth.clearCookieHeader());
    return { ok: true };
  }

  @Get('me')
  async me(@Req() req: any) {
    const rawCookie = String(req.headers?.cookie || '');
    const cookieValue = rawCookie
      .split(';')
      .map((p: string) => p.trim())
      .find((p: string) => p.startsWith(`${this.auth.sessionCookieName()}=`))
      ?.split('=')?.[1];

    const parsed = this.auth.decodeSession(cookieValue || null);
    const user = await this.auth.me(parsed);
    if (!user) throw new UnauthorizedException('Not authenticated');
    return { ok: true, user };
  }
}
