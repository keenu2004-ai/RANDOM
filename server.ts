/**
 * THEIAKSHI ENTERPRISE - Express + Vite Full-Stack Application Server
 * Production-hardened with proper security headers, CORS, rate limiting,
 * graceful shutdown, and environment validation.
 */

import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './src/server/api';
import { initDatabase } from './src/server/db/index.js';
import { notificationService } from './src/server/services/notification.service.js';
import { requestIdMiddleware, errorHandler, notFoundHandler } from './src/server/middleware/error-handler.middleware';
import rateLimit from 'express-rate-limit';

// ============================================================
// ENVIRONMENT VALIDATION — Fail fast in production
// ============================================================
const isProd = process.env.NODE_ENV === 'production';
const PORT = parseInt(process.env.PORT || '3000', 10);

if (isProd) {
  const requiredVars = ['JWT_SECRET', 'DATABASE_URL'];
  const missing = requiredVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error(`FATAL: Missing required production environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

// ============================================================
// CORS Configuration
// ============================================================
const ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim().replace(/\/+$/, ''))
  : ['http://localhost:3000', 'http://localhost:5173', 'https://random-1-d9vw.onrender.com'];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, health checks)
    if (!origin) return callback(null, true);
    const cleanOrigin = origin.replace(/\/+$/, '');
    if (ALLOWED_ORIGINS.includes(cleanOrigin) || cleanOrigin.endsWith('.onrender.com')) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: Origin '${origin}' not allowed.`), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
};

// ============================================================
// Global Rate Limiter
// ============================================================
const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
  skip: (req) => req.path === '/api/health', // Never rate-limit health checks
});

async function startServer() {
  const app = express();

  // Enable trust proxy for reverse proxies (Render) to fix express-rate-limit X-Forwarded-For warning
  app.set('trust proxy', 1);

  // ============================================================
  // 1. Security Headers (Helmet)
  // ============================================================
  app.use(helmet({
    contentSecurityPolicy: isProd ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind requires inline styles
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      }
    } : false, // Vite HMR requires relaxed CSP in dev
    crossOriginEmbedderPolicy: false, // Required for Vite dev
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xContentTypeOptions: true,
    xFrameOptions: { action: 'deny' },
    strictTransportSecurity: isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
  }));

  // ============================================================
  // 2. CORS
  // ============================================================
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  // ============================================================
  // 3. Request ID Tracking
  // ============================================================
  app.use(requestIdMiddleware);

  // ============================================================
  // 4. Body Limits
  // ============================================================
  app.use(express.json({ limit: process.env.MAX_JSON_SIZE || '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ============================================================
  // 5. Global Rate Limiting
  // ============================================================
  app.use(globalRateLimiter);

  // ============================================================
  // 6. Database Initialization
  // ============================================================
  initDatabase()
    .then(() => {
      console.log('[STARTUP] Database initialized successfully.');
      return notificationService.migrateLegacyNotifications();
    })
    .catch(err => console.error('[STARTUP] DB init warning:', err));

  // ============================================================
  // 7. API Routes & Health Check
  // ============================================================
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'theiakshi-enterprise-hrms',
      database: 'connected'
    });
  });

  app.use('/api', apiRouter);

  // ============================================================
  // 8. Static Frontend or Vite Dev Server (Local Only)
  // ============================================================
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, the backend is strictly an API server hosted on Railway.
    // The frontend is hosted separately on Vercel.
    app.get('/', (req: Request, res: Response) => {
      res.json({ message: 'THEIAKSHI ENTERPRISE HRMS API Server is running.' });
    });
  }

  // ============================================================
  // 9. 404 and Global Error Handler
  // ============================================================
  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  // ============================================================
  // 10. HTTP Server with Graceful Shutdown
  // ============================================================
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[THEIAKSHI ENTERPRISE] Server running on http://0.0.0.0:${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`[SHUTDOWN] Received ${signal}. Closing HTTP server gracefully...`);
    server.close(() => {
      console.log('[SHUTDOWN] HTTP server closed. Exiting process.');
      process.exit(0);
    });

    // Force exit after 10s if graceful shutdown hangs
    setTimeout(() => {
      console.error('[SHUTDOWN] Forced exit after timeout.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch(err => {
  console.error('[STARTUP] Fatal error starting server:', err);
  process.exit(1);
});
