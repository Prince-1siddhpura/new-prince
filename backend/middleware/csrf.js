const crypto = require('crypto');

/**
 * CSRF Protection Middleware
 * 
 * Protects state-changing requests (POST, PUT, PATCH, DELETE) when authenticated via cookie.
 * In accordance with OWASP security recommendations:
 * 1. Checks Origin/Referer headers against trusted origins.
 * 2. Excludes Bearer-token-authenticated API requests (which are intrinsically CSRF-immune as browsers do not automatically send Authorization headers).
 * 3. Supports double-submit CSRF cookie validation for cookie-authenticated browser sessions.
 */

const getTrustedOrigins = () => {
  return [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    process.env.FRONTEND_URL,
  ].filter(Boolean);
};

const csrfProtection = (req, res, next) => {
  // Safe HTTP methods do not alter state
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // If request uses Bearer token, it is immune to cross-site browser form submissions
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }

  // Check if session cookie is present
  const hasCookieSession = req.cookies && (req.cookies.edunova_token || req.cookies.refresh_token);
  if (!hasCookieSession) {
    // No session cookie used, proceed
    return next();
  }

  // Origin / Referer Verification
  const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
  const trustedOrigins = getTrustedOrigins();

  if (origin && !trustedOrigins.includes(origin) && process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'Cross-Site Request Forgery (CSRF) check failed: Untrusted Origin.',
      code: 'CSRF_ORIGIN_INVALID',
    });
  }

  // Double Submit / Custom Header check: If x-csrf-token or x-requested-with is sent, or same-site check passed
  const clientCsrfToken = req.headers['x-csrf-token'] || req.headers['x-requested-with'];
  const cookieCsrfToken = req.cookies['edunova_csrf'];

  if (cookieCsrfToken && clientCsrfToken && cookieCsrfToken !== clientCsrfToken) {
    return res.status(403).json({
      success: false,
      message: 'CSRF token mismatch.',
      code: 'CSRF_TOKEN_MISMATCH',
    });
  }

  next();
};

/**
 * Route handler to generate or fetch a CSRF token
 */
const getCsrfToken = (req, res) => {
  let token = req.cookies?.edunova_csrf;
  if (!token) {
    token = crypto.randomBytes(24).toString('hex');
    res.cookie('edunova_csrf', token, {
      httpOnly: false, // Accessible by JavaScript client to include in headers
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });
  }
  res.json({ success: true, csrfToken: token });
};

module.exports = { csrfProtection, getCsrfToken };
