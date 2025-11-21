import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const basicAuth = req.headers.get("authorization");
  const username = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD;

  if (basicAuth && username && password) {
    const [scheme, encoded] = basicAuth.split(" ");

    if (scheme === "Basic" && encoded) {
      const decoded = atob(encoded); // "user:pass"
      const [user, pass] = decoded.split(":");

      if (user === username && pass === password) {
        // OK -> on laisse passer vers la page demandée
        return NextResponse.next();
      }
    }
  }

  // Si pas d'auth ou mauvais login/mot de passe -> on demande l'auth
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="CV Dashboard"',
    },
  });
}

// Indique quelles routes sont protégées
export const config = {
  matcher: [
    // protège tout, sauf les fichiers statiques Next
    "/((?!_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
};