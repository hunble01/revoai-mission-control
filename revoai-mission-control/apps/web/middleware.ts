import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_ROUTES = new Set(['/login']);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // static assets + Next internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') // .ico, .png, etc.
  ) {
    return NextResponse.next();
  }

  const hasSession = !!req.cookies.get('mc_session')?.value;

  if (!hasSession && !PUBLIC_ROUTES.has(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (hasSession && pathname === '/login') {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
