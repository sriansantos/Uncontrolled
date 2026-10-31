import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUser, SESSION_COOKIE } from "@/lib/auth";

// Sentinela global (proxy): valida a sessão (cookie → banco) em toda
// requisição. Roda em Node por padrão no Next 16.
// - Páginas sem sessão → redirect para /login
// - APIs sem sessão → 401 JSON
// Exceções: tela de login, rotas de autenticação e o bot do WhatsApp
// (que se autentica por x-bot-token dentro da própria rota).

const PUBLIC_PAGES = new Set(["/login"]);
const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/whatsapp/"];

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PAGES.has(pathname)) return NextResponse.next();
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const user = await getAuthenticatedUser(req.cookies.get(SESSION_COOKIE)?.value);
  if (user) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // tudo, exceto assets estáticos
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|ico|webp|txt|xml)$).*)",
  ],
};
