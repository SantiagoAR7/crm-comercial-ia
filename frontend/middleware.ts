import { NextRequest, NextResponse } from 'next/server';

const cookieName = 'crm_session';
const biCookieName = 'bi_session';

export function middleware(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(cookieName)?.value);
  const hasBiSession = Boolean(request.cookies.get(biCookieName)?.value);
  const isLogin = request.nextUrl.pathname === '/login';
  const isBiLogin = request.nextUrl.pathname === '/bi-login';
  const isBi = request.nextUrl.pathname === '/bi' || request.nextUrl.pathname.startsWith('/bi/');

  if (isBi || isBiLogin) {
    if (!hasBiSession && !isBiLogin) {
      return NextResponse.redirect(new URL('/bi-login', request.url));
    }

    if (hasBiSession && isBiLogin) {
      return NextResponse.redirect(new URL('/bi', request.url));
    }

    return NextResponse.next();
  }

  if (!hasSession && !isLogin) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (hasSession && isLogin) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|icon.png|favicon.ico).*)'],
};
