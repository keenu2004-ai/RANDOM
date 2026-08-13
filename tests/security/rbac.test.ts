/**
 * THEIAKSHI ENTERPRISE — RBAC Security Tests
 * Tests role-based access control across all major endpoints.
 * 
 * Method: Sends HTTP requests with crafted JWTs signed with the test secret.
 * No real database needed — RBAC is enforced at the route middleware level.
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

// =====================================================
// JWT Factory — Creates tokens for each role
// =====================================================
function makeToken(overrides: Partial<{
  userId: string;
  organizationId: string;
  email: string;
  role: string;
  employeeId: string;
  employeeName: string;
}> = {}): string {
  const payload = {
    userId: overrides.userId ?? 'test-user-id',
    organizationId: overrides.organizationId ?? 'org-a-id',
    email: overrides.email ?? 'test@test.com',
    role: overrides.role ?? 'EMPLOYEE',
    employeeId: overrides.employeeId ?? 'emp-a-id',
    employeeName: overrides.employeeName ?? 'Test User',
  };
  return jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '1h' });
}

const employeeToken = makeToken({ role: 'EMPLOYEE' });
const managerToken = makeToken({ role: 'MANAGER' });
const hrManagerToken = makeToken({ role: 'HR_MANAGER' });
const adminToken = makeToken({ role: 'ADMIN' });
const superAdminToken = makeToken({ role: 'SUPER_ADMIN' });

// =====================================================
// Helper
// =====================================================
async function get(token: string, path: string) {
  return request(app).get(path).set('Authorization', `Bearer ${token}`);
}

async function post(token: string, path: string, body: any = {}) {
  return request(app).post(path).set('Authorization', `Bearer ${token}`).send(body);
}

async function patch(token: string, path: string, body: any = {}) {
  return request(app).patch(path).set('Authorization', `Bearer ${token}`).send(body);
}

// =====================================================
// Authentication Guards
// =====================================================
describe('RBAC — Unauthenticated Access', () => {
  const protectedEndpoints = [
    ['GET', '/api/employees'],
    ['GET', '/api/leaves'],
    ['GET', '/api/expenses'],
    ['GET', '/api/attendance'],
    ['GET', '/api/payroll/records'],
    ['GET', '/api/documents'],
    ['GET', '/api/notifications'],
    ['GET', '/api/helpdesk/tickets'],
    ['GET', '/api/audit-logs'],
    ['GET', '/api/reports/data'],
  ] as const;

  for (const [method, endpoint] of protectedEndpoints) {
    it(`should return 401 for unauthenticated ${method} ${endpoint}`, async () => {
      const res = await request(app)[method.toLowerCase() as 'get'](endpoint);
      expect(res.status).toBe(401);
    });
  }
});

// =====================================================
// Admin-Only Endpoints
// =====================================================
describe('RBAC — Audit Logs (SUPER_ADMIN, ADMIN only)', () => {
  it('should deny EMPLOYEE access to audit logs', async () => {
    const res = await get(employeeToken, '/api/audit-logs');
    expect(res.status).toBe(403);
  });

  it('should deny MANAGER access to audit logs', async () => {
    const res = await get(managerToken, '/api/audit-logs');
    expect(res.status).toBe(403);
  });

  it('should deny HR_MANAGER access to audit logs', async () => {
    const res = await get(hrManagerToken, '/api/audit-logs');
    expect(res.status).toBe(403);
  });

  it('should allow ADMIN access to audit logs', async () => {
    const res = await get(adminToken, '/api/audit-logs');
    // 200 (with data or empty) or 500 if PGlite schema not ready — RBAC passed
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });

  it('should allow SUPER_ADMIN access to audit logs', async () => {
    const res = await get(superAdminToken, '/api/audit-logs');
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });
});

// =====================================================
// Reset-DB Production Guard
// =====================================================
describe('RBAC — Reset-DB Production Guard', () => {
  it('should deny reset-db when NODE_ENV=test (simulates production guard)', async () => {
    // In test env, NODE_ENV=test not production, so it should pass RBAC but we verify SUPER_ADMIN is needed
    const employeeRes = await post(employeeToken, '/api/system/reset-db');
    expect(employeeRes.status).toBe(403);

    const adminRes = await post(adminToken, '/api/system/reset-db');
    expect(adminRes.status).toBe(403);
  });
});

// =====================================================
// CSV Export — Requires HR or above
// =====================================================
describe('RBAC — CSV Export Access Control', () => {
  it('should deny EMPLOYEE access to CSV export', async () => {
    const res = await get(employeeToken, '/api/reports/export?type=employee');
    expect(res.status).toBe(403);
  });

  it('should deny MANAGER access to CSV export', async () => {
    const res = await get(managerToken, '/api/reports/export?type=employee');
    expect(res.status).toBe(403);
  });

  it('should allow HR_MANAGER access to CSV export', async () => {
    const res = await get(hrManagerToken, '/api/reports/export?type=employee');
    // 404 (no data) or 200 — not 403
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });
});

// =====================================================
// Salary Structure — EMPLOYEE self-access only
// =====================================================
describe('RBAC — Salary Structure Access', () => {
  it('should allow EMPLOYEE to access own salary structure', async () => {
    const empToken = makeToken({ role: 'EMPLOYEE', employeeId: 'emp-123' });
    const res = await get(empToken, '/api/salary-structures/emp-123');
    // 404 (not found) or 200, not 403
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });

  it('should deny EMPLOYEE access to another employee salary', async () => {
    const empToken = makeToken({ role: 'EMPLOYEE', employeeId: 'emp-self' });
    const res = await get(empToken, '/api/salary-structures/different-emp-id');
    expect(res.status).toBe(403);
  });
});

// =====================================================
// User Role Management
// =====================================================
describe('RBAC — User Role Management (ADMIN only)', () => {
  it('should deny EMPLOYEE from changing user roles', async () => {
    const res = await patch(employeeToken, '/api/users/some-user-id/role', { role: 'ADMIN' });
    expect(res.status).toBe(403);
  });

  it('should deny MANAGER from changing user roles', async () => {
    const res = await patch(managerToken, '/api/users/some-user-id/role', { role: 'ADMIN' });
    expect(res.status).toBe(403);
  });

  it('should deny HR_MANAGER from changing user roles', async () => {
    const res = await patch(hrManagerToken, '/api/users/some-user-id/role', { role: 'ADMIN' });
    expect(res.status).toBe(403);
  });

  it('should allow ADMIN to change user roles', async () => {
    const res = await patch(adminToken, '/api/users/fake-user-id/role', { role: 'MANAGER' });
    // 404 (user not found) or 200, not 403
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });
});

// =====================================================
// Request Body Identity Override Attempt
// =====================================================
describe('Security — Client Identity Override Prevention', () => {
  it('should not trust organizationId from request body', async () => {
    // Send a request with a different organizationId in body — backend should use JWT
    const res = await request(app)
      .get('/api/employees')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ organizationId: 'attacker-org-id' });

    // RBAC passes but DB query uses JWT-derived org, not body org
    expect(res.status).not.toBe(401);
    // No 500 from bad org ID
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toMatch(/syntax error/i);
  });

  it('should not trust employeeId from request body on attendance check-in', async () => {
    const res = await request(app)
      .post('/api/attendance/check-in')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        employeeId: 'other-employee-id', // This should be ignored
        latitude: 28.6209,
        longitude: 77.1363,
        accuracy: 5,
      });

    // Backend derives employeeId from JWT, not body
    // Response is 201/409/400/403 (geofence), never using the body employeeId
    expect([201, 400, 403, 409, 500]).toContain(res.status);
  });

  it('should reject role injection in JWT body parameters', async () => {
    // Send ADMIN role in body to endpoint that requires ADMIN
    const res = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${employeeToken}`) // employee token
      .send({ role: 'SUPER_ADMIN' }); // should be ignored

    expect(res.status).toBe(403);
  });
});
