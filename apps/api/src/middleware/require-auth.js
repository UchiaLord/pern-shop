/**
 * Auth-Middleware: erzwingt einen eingeloggten Benutzer.
 * Erwartung: session.js setzt req.session, und bei Login/Register wird req.session.user gesetzt.
 */
export function requireAuth(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Nicht eingeloggt.' },
    });
  }

  next();
}
