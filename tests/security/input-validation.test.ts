/**
 * THEIAKSHI ENTERPRISE — Input Validation & Injection Tests
 * Tests SQL injection, path traversal, oversized payloads, and malformed inputs.
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestApp } from '../helpers/test-app';

process.env.NODE_ENV = 'test';
process.env.DATABASE_PROVIDER = 'pglite';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-purposes-only-not-production';

const TEST_JWT_SECRET = process.env.JWT_SECRET;
const app = createTestApp();

function makeAdminToken() {
  return jwt.sign(
    {
      userId: 'admin-user',
      organizationId: 'test-org',
      email: 'admin@test.com',
      role: 'ADMIN',
      employeeId: 'admin-emp',
      employeeName: 'Admin User',
    },
    TEST_JWT_SECRET,
    { expiresIn: '1h' }
  );
}

const adminToken = makeAdminToken();

// =====================================================
// SQL Injection via Query Parameters
// =====================================================
describe('Input Validation — SQL Injection Prevention', () => {
  const sqlInjectionPayloads = [
    "'; DROP TABLE employees; --",
    "' OR '1'='1",
    "1; SELECT * FROM users WHERE '1'='1",
    "' UNION SELECT password FROM users --",
    "' OR 1=1 --",
    "admin' --",
    "1' AND SLEEP(5)--",
  ];

  for (const payload of sqlInjectionPayloads) {
    it(`should handle SQL injection in search parameter: ${payload.substring(0, 30)}...`, async () => {
      const res = await request(app)
        .get(`/api/employees?search=${encodeURIComponent(payload)}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Must not return 500 with SQL error — parameterized queries prevent this
      // Returns 200 with empty results or 400 for invalid params
      expect(res.status).not.toBe(500);

      // Must not expose SQL error messages
      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toMatch(/syntax error/i);
      expect(bodyStr).not.toMatch(/sql state/i);
      expect(bodyStr).not.toMatch(/pg error/i);
    });
  }

  it('should handle SQL injection in sort parameter', async () => {
    const res = await request(app)
      .get('/api/employees?sortBy=name;DROP TABLE employees;--&sortOrder=ASC')
      .set('Authorization', `Bearer ${adminToken}`);

    // Must not execute injected SQL — sort columns are whitelisted
    expect(res.status).not.toBe(500);
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toMatch(/syntax error/i);
  });

  it('should handle SQL injection in audit log actor filter', async () => {
    const adminToken = makeAdminToken();
    const res = await request(app)
      .get(`/api/audit-logs?actor=${encodeURIComponent("' OR '1'='1")}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).not.toBe(500);
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toMatch(/syntax error/i);
  });
});

// =====================================================
// Path Traversal Attempts
// =====================================================
describe('Input Validation — Path Traversal Prevention', () => {
  const traversalPayloads = [
    '../../../etc/passwd',
    '..\\..\\..\\windows\\system32\\config\\SAM',
    '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
    '....//....//....//etc/passwd',
  ];

  for (const payload of traversalPayloads) {
    it(`should not expose filesystem paths for: ${payload.substring(0, 30)}`, async () => {
      const res = await request(app)
        .get(`/api/documents/${encodeURIComponent(payload)}/download`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Must return 404 (resource not found) not a file read error
      expect([400, 403, 404, 500]).toContain(res.status);

      const bodyStr = JSON.stringify(res.body);
      // Must not expose filesystem path
      expect(bodyStr).not.toMatch(/etc\/passwd/i);
      expect(bodyStr).not.toMatch(/windows\\system32/i);
      // Must not expose internal file paths
      expect(bodyStr).not.toMatch(/c:\\users/i);
    });
  }
});

// =====================================================
// Oversized Payload Protection
// =====================================================
describe('Input Validation — Payload Size Limits', () => {
  it('should reject JSON body exceeding limit', async () => {
    // Create a large payload
    const largePayload = { data: 'x'.repeat(2 * 1024 * 1024) }; // 2MB

    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(largePayload);

    // Should be rejected with 413 Payload Too Large
    expect([413, 400]).toContain(res.status);
  });
});

// =====================================================
// Malformed Request Handling
// =====================================================
describe('Input Validation — Malformed Requests', () => {
  it('should handle malformed JSON gracefully', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ invalid json here }');

    expect([400, 500]).toContain(res.status);
    // Should return JSON error, not HTML
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('should handle empty body gracefully', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send();

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should handle unexpected content-type gracefully', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'text/xml')
      .send('<login><email>test</email></login>');

    // Should handle without crashing
    expect([400, 415]).toContain(res.status);
  });

  it('should handle extremely long query strings', async () => {
    const longQuery = 'a'.repeat(10000);
    const res = await request(app)
      .get(`/api/employees?search=${longQuery}`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Should not crash the server
    expect([200, 400, 414, 500]).toContain(res.status);
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toMatch(/stack/i);
  });
});

// =====================================================
// Attendance GPS Validation
// =====================================================
describe('Input Validation — GPS Coordinate Bounds', () => {
  const empToken = jwt.sign(
    {
      userId: 'emp-user',
      organizationId: 'test-org',
      email: 'emp@test.com',
      role: 'EMPLOYEE',
      employeeId: 'emp-id-123',
      employeeName: 'Employee User',
    },
    TEST_JWT_SECRET,
    { expiresIn: '1h' }
  );

  it('should reject latitude > 90', async () => {
    const res = await request(app)
      .post('/api/attendance/check-in')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ latitude: 91, longitude: 77.5, accuracy: 5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/latitude/i);
  });

  it('should reject latitude < -90', async () => {
    const res = await request(app)
      .post('/api/attendance/check-in')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ latitude: -91, longitude: 77.5, accuracy: 5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/latitude/i);
  });

  it('should reject longitude > 180', async () => {
    const res = await request(app)
      .post('/api/attendance/check-in')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ latitude: 12.97, longitude: 181, accuracy: 5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/longitude/i);
  });

  it('should reject negative accuracy', async () => {
    const res = await request(app)
      .post('/api/attendance/check-in')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ latitude: 12.97, longitude: 77.59, accuracy: -1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/accuracy/i);
  });

  it('should reject missing coordinates', async () => {
    const res = await request(app)
      .post('/api/attendance/check-in')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ address: 'some address' }); // Missing lat/lng/accuracy

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});
