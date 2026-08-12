/**
 * THEIAKSHI ENTERPRISE — Security Header Tests
 * Verifies HTTP security headers from Helmet and CORS configuration.
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/test-app';

process.env.NODE_ENV = 'test';
process.env.DATABASE_PROVIDER = 'pglite';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-purposes-only-not-production';

const app = createTestApp();

describe('Security Headers — Helmet', () => {
  it('should include X-Content-Type-Options: nosniff', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('should include X-Frame-Options: DENY', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  it('should NOT expose X-Powered-By: Express', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('should include X-DNS-Prefetch-Control: off', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
  });
});

describe('Security Headers — CORS', () => {
  it('should allow requests from allowed origins', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:3000');

    // In test, CORS is open (origin: '*')
    expect([200, 503]).toContain(res.status);
  });

  it('should include CORS header for allowed origin', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:3000');

    // Test app has CORS open
    expect(res.headers['access-control-allow-origin']).toBeTruthy();
  });

  it('should respond to OPTIONS preflight request', async () => {
    const res = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type, Authorization');

    expect([200, 204]).toContain(res.status);
  });
});

describe('API Error Contract', () => {
  it('should return JSON for 404 on unknown API routes', async () => {
    const res = await request(app)
      .get('/api/this-endpoint-does-not-exist-at-all-12345');

    // Should be 404 with JSON body (not HTML)
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toHaveProperty('error');
  });

  it('should return JSON for malformed JSON body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ this is: not valid json }');

    expect([400, 500]).toContain(res.status);
    // Should still be JSON, not HTML error page
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('should not expose stack traces in 404 responses', async () => {
    const res = await request(app)
      .get('/api/nonexistent-route');

    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toMatch(/at Object\./);
    expect(bodyStr).not.toMatch(/at Function\./);
    expect(bodyStr).not.toMatch(/node_modules/);
  });

  it('should not expose stack traces in 401 responses', async () => {
    const res = await request(app)
      .get('/api/auth/me');

    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toMatch(/at Object\./);
    expect(bodyStr).not.toMatch(/node_modules/);
  });
});

describe('Rate Limiting Headers', () => {
  it('should include rate limit headers on auth endpoints', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'pass' });

    // Rate limit headers present (RateLimit-Limit, RateLimit-Remaining)
    // These headers are added by express-rate-limit with standardHeaders: true
    expect(
      res.headers['ratelimit-limit'] || res.headers['x-ratelimit-limit']
    ).toBeTruthy();
  });
});
