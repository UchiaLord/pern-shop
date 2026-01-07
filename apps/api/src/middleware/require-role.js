/**
 * RBAC-Middleware: erzwingt eine oder mehrere Rollen.
 *
 * Verhalten:
 * - 401, wenn nicht eingeloggt
 * - 403, wenn eingeloggt, aber Rolle nicht erlaubt
 *
 * @param {...string} roles erlaubte Rollen (z. B. 'admin', 'user')
 * @returns {import('express').RequestHandler}
 */
export function requireRole(...roles) {
  return function requireRoleMiddleware(req, res, next) {
    const user = req.session?.user;

    if (!user) {
      return res.status(401).json({
        error: { code: 'UNAUTHENTICATED', message: 'Nicht eingeloggt.' },
      });
    }

    if (!roles.includes(user.role)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Keine Berechtigung.' },
      });
    }

    next();
  };
}
