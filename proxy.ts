import { NextRequest, NextResponse } from 'next/server';

/**
 * Verificação otimista: se não existe o cookie-marcador de sessão,
 * nem renderiza a área protegida e manda direto para o login.
 * Os tokens ficam no localStorage, então a validação real acontece
 * no cliente (AppShell + interceptor) e na API.
 */
export function proxy(req: NextRequest) {
  if (!req.cookies.get('has_session')?.value) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
