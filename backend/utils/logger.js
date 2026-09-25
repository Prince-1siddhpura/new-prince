/**
 * Structured Backend Logger (backend/utils/logger.js)
 * 
 * Provides JSON-structured logging with timestamps, log levels,
 * request tracing, error stack normalization, and contextual metadata.
 */

const formatTimestamp = () => new Date().toISOString();

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'refreshtoken',
  'jwt_secret',
  'secret',
  'authorization',
  'cookie',
  'set-cookie',
  'otpcode',
]);

const redactSensitive = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redactSensitive);
  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      clean[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      clean[k] = redactSensitive(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
};

const formatMeta = (meta = {}) => {
  if (meta instanceof Error) {
    return {
      errorName: meta.name,
      errorMessage: meta.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : meta.stack,
    };
  }
  return redactSensitive(meta);
};

const logger = {
  info: (message, meta = {}) => {
    const logEntry = {
      level: 'INFO',
      timestamp: formatTimestamp(),
      message,
      ...formatMeta(meta),
    };
    console.log(JSON.stringify(logEntry));
  },

  warn: (message, meta = {}) => {
    const logEntry = {
      level: 'WARN',
      timestamp: formatTimestamp(),
      message,
      ...formatMeta(meta),
    };
    console.warn(JSON.stringify(logEntry));
  },

  error: (message, error = null, meta = {}) => {
    const logEntry = {
      level: 'ERROR',
      timestamp: formatTimestamp(),
      message,
      ...(error ? formatMeta(error) : {}),
      ...formatMeta(meta),
    };
    console.error(JSON.stringify(logEntry));
  },

  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true') {
      const logEntry = {
        level: 'DEBUG',
        timestamp: formatTimestamp(),
        message,
        ...formatMeta(meta),
      };
      console.log(JSON.stringify(logEntry));
    }
  },

  /**
   * Express HTTP Request Logging Middleware
   * Emits structured log entries for every incoming request upon completion
   */
  requestLogger: (req, res, next) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    req.id = requestId;
    res.setHeader('X-Request-Id', requestId);

    res.on('finish', () => {
      const durationMs = Date.now() - startTime;
      const logPayload = {
        level: res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO',
        timestamp: formatTimestamp(),
        requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs,
        ip: req.ip || req.connection?.remoteAddress,
        userId: req.user?.id || null,
        userAgent: req.headers['user-agent'] || null,
      };

      if (res.statusCode >= 500) {
        console.error(JSON.stringify(logPayload));
      } else if (res.statusCode >= 400) {
        console.warn(JSON.stringify(logPayload));
      } else {
        console.log(JSON.stringify(logPayload));
      }
    });

    next();
  },
};

module.exports = logger;
