// EduNova Production Server - Phase 4 Persistence Verified v5
const http = require('http');




const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });


const requiredEnvironment = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'FRONTEND_URL'];
const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name]);
if (missingEnvironment.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnvironment.join(', ')}`);
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  const weakSecrets = ['your_jwt_secret_key_here', 'your_refresh_secret_key_here', 'change-me'];
  const weakEnvironment = requiredEnvironment.filter((name) => (
    name.startsWith('JWT_') && (
      process.env[name].length < 32 || weakSecrets.some((value) => process.env[name].includes(value))
    )
  ));
  if (weakEnvironment.length > 0) {
    console.error(`❌ Production secrets are weak or unchanged: ${weakEnvironment.join(', ')}`);
    process.exit(1);
  }
}

const prisma = require('./config/db');
const { initSocket } = require('./socket/socketServer');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);

// --------------- Socket.IO Setup ---------------
const io = initSocket(server);

// --------------- Middleware ---------------
app.disable('x-powered-by');
app.use(helmet({
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
}));
app.use(logger.requestLogger);
app.use(morgan('dev'));

const allowedOrigins = Array.from(
  new Set([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    process.env.FRONTEND_URL,
  ].filter(Boolean))
);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy does not allow access from ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-csrf-token', 'X-Request-Id'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --------------- Security Rate Limiting & Protection ---------------
const { apiLimiter, authLimiter, passwordResetLimiter, aiLimiter, uploadLimiter } = require('./middleware/rateLimiter');
const { csrfProtection } = require('./middleware/csrf');

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/google', authLimiter);
app.use('/api/auth/refresh', authLimiter);
app.use('/api/auth/password-reset', passwordResetLimiter);
app.use('/api/auth/verify-email', passwordResetLimiter);
app.use('/api/ai', aiLimiter);
app.use('/api/materials', uploadLimiter);

// CSRF Protection on state-changing API mutations authenticated via cookie
app.use('/api', csrfProtection);


// --------------- API Routes ---------------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/subjects', require('./routes/subjects'));
app.use('/api/progress', require('./routes/progress'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/skills', require('./routes/skills'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/gamification', require('./routes/gamification'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/parents', require('./routes/parents'));
app.use('/api/parent', require('./routes/parents'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/exchanges', require('./routes/exchanges'));
app.use('/api/quizzes', require('./routes/quizzes'));
app.use('/api/learners', require('./routes/learners'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/instructor', require('./routes/instructor'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/games', require('./routes/games'));
app.use('/api/labs', require('./routes/labs'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/materials', require('./routes/materials'));
app.use('/api/homework', require('./routes/homework'));
app.use('/api/community', require('./routes/community'));

// --------------- Health Check ---------------
app.get('/api/health', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (error) {
    dbStatus = 'disconnected';
  }

  res.status(200).json({
    success: true,
    status: 'ok',
    message: 'EduNova API is running',
    data: {
      status: 'healthy',
      database: dbStatus,
      timestamp: new Date().toISOString(),
    },
  });
});

// --------------- Consistent Error Handling ---------------
app.use((err, req, res, next) => {
  let statusCode = err.status || err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  let validationErrors = null;

  // Handle Zod Validation Errors
  if (err.name === 'ZodError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Validation failed';
    validationErrors = err.errors || err.issues;
  }
  // Handle Prisma Known Request Errors
  else if (err.code === 'P2002') {
    statusCode = 409;
    errorCode = 'UNIQUE_CONSTRAINT_VIOLATION';
    const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : err.meta?.target;
    message = `A record with this ${target || 'value'} already exists`;
  } else if (err.code === 'P2025') {
    statusCode = 404;
    errorCode = 'RECORD_NOT_FOUND';
    message = 'Requested record was not found';
  }

  logger.error(`API Error [${req.method} ${req.originalUrl || req.url}] - ${message}`, err, {
    statusCode,
    errorCode,
    requestId: req.id,
    userId: req.user?.id || null,
  });

  res.status(statusCode).json({
    success: false,
    message,
    code: errorCode,
    ...(validationErrors ? { errors: validationErrors } : {}),
    data: null,
  });
});

// --------------- Graceful Shutdown ---------------
const gracefulShutdown = async () => {
  console.log('\n🔌 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// --------------- Start Server ---------------
let PORT = parseInt(process.env.PORT, 10) || 5000;

async function startServer(portToTry) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ PostgreSQL connection verified');
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }

  server.removeAllListeners('error');

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      if (portToTry === 5000) {
        console.warn(`⚠️ Port 5000 is in use. Retrying on port 5001...`);
        startServer(5001);
      } else {
        console.error(`❌ Error: Port ${portToTry} is already in use by another process.`);
        process.exit(1);
      }
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });

  server.listen(portToTry, () => {
    console.log(`🚀 EduNova Backend running on port ${portToTry}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️  Database: PostgreSQL via Prisma`);
    console.log(`⚡ Socket.IO initialized for real-time messaging and peer exchange`);
  });
}

startServer(PORT);
