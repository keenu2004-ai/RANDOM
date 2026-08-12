/**
 * THEIAKSHI ENTERPRISE — Test Application Factory
 * Creates a configured Express app instance for integration testing.
 * Does NOT start an HTTP server (test runner manages that via supertest).
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { apiRouter } from '../../src/server/api';
import { requestIdMiddleware, errorHandler, notFoundHandler } from '../../src/server/middleware/error-handler.middleware';
import rateLimit from 'express-rate-limit';

/**
 * Create the test Express application.
 * Rate limiting is disabled in tests to avoid flakiness.
 */
export function createTestApp() {
  const app = express();

  // Security headers (relaxed for tests — no CSP enforcement)
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(cors({ origin: '*', credentials: true }));
  app.use(requestIdMiddleware);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Mount API router
  app.use('/api', apiRouter);
  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
