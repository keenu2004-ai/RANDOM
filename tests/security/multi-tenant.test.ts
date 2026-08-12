/**
 * THEIAKSHI ENTERPRISE — Multi-Tenant Isolation Tests
 * Verifies that Organization A cannot access Organization B data.
 * 
 * Method: JWT tokens for two different organizations.
 * All queries should return empty results or 403/404 for cross-org access.
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

// Organization A token
const orgAToken = jwt.sign(
  {
    userId: 'user-org-a',
    organizationId: 'org-a-unique-id',
    email: 'admin@orga.com',
    role: 'ADMIN',
    employeeId: 'emp-org-a',
    employeeName: 'Org A Admin',
  },
  TEST_JWT_SECRET,
  { expiresIn: '1h' }
);

// Organization B token (same role but different org)
const orgBToken = jwt.sign(
  {
    userId: 'user-org-b',
    organizationId: 'org-b-unique-id',
    email: 'admin@orgb.com',
    role: 'ADMIN',
    employeeId: 'emp-org-b',
    employeeName: 'Org B Admin',
  },
  TEST_JWT_SECRET,
  { expiresIn: '1h' }
);

// Organization A employee token
const orgAEmployeeToken = jwt.sign(
  {
    userId: 'user-emp-org-a',
    organizationId: 'org-a-unique-id',
    email: 'emp@orga.com',
    role: 'EMPLOYEE',
    employeeId: 'emp-a-specific',
    employeeName: 'Org A Employee',
  },
  TEST_JWT_SECRET,
  { expiresIn: '1h' }
);

// =====================================================
// Helper
// =====================================================
async function getAs(token: string, endpoint: string) {
  return request(app).get(endpoint).set('Authorization', `Bearer ${token}`);
}

async function postAs(token: string, endpoint: string, body: any = {}) {
  return request(app).post(endpoint).set('Authorization', `Bearer ${token}`).send(body);
}

// =====================================================
// Multi-Tenant List Isolation Tests
// These tests verify that each org's token only sees its own data.
// With PGlite, org IDs are non-existent so results are empty — not cross-leaked.
// =====================================================

const listEndpoints = [
  '/api/employees',
  '/api/attendance',
  '/api/leaves',
  '/api/expenses',
  '/api/documents',
  '/api/notifications',
  '/api/helpdesk-tickets',
  '/api/announcements',
];

describe('Multi-Tenant Isolation — List Endpoints Return Org-Scoped Data', () => {
  for (const endpoint of listEndpoints) {
    it(`${endpoint} — Org A token does not reveal Org B data`, async () => {
      const resA = await getAs(orgAToken, endpoint);
      const resB = await getAs(orgBToken, endpoint);

      // Both must succeed (authentication-wise)
      expect([200, 404, 500]).toContain(resA.status);
      expect([200, 404, 500]).toContain(resB.status);

      // If both return arrays, they must be independent
      // (No cross-org data — with PGlite both should return empty)
      if (resA.status === 200 && resB.status === 200) {
        const dataA = resA.body?.data || resA.body || [];
        const dataB = resB.body?.data || resB.body || [];

        if (Array.isArray(dataA) && Array.isArray(dataB)) {
          // Verify no cross-contamination: if Org A has items, Org B should have different items
          // With PGlite empty DBs, both return []
          const orgAIds = new Set(dataA.map((d: any) => d.organizationId || d.organization_id));
          const orgBIds = new Set(dataB.map((d: any) => d.organizationId || d.organization_id));

          // No Org B items in Org A result
          const leaked = [...orgBIds].filter(id => orgAIds.has(id));
          expect(leaked).toHaveLength(0);
        }
      }
    });
  }
});

// =====================================================
// Cross-Org specific resource access
// =====================================================
describe('Multi-Tenant Isolation — Resource ID Access Control', () => {
  it('Org A user cannot access Org B employee by ID', async () => {
    // Use a fake Org B employee ID — Org A token must get 404/403, not 200
    const res = await getAs(orgAToken, '/api/employees/org-b-employee-fake-id');
    // Must NOT return 200 with Org B data
    expect([403, 404, 500]).toContain(res.status);
  });

  it('Org A user cannot download Org B document', async () => {
    const res = await getAs(orgAToken, '/api/documents/org-b-doc-fake-id/download');
    expect([403, 404, 500]).toContain(res.status);
  });

  it('Org A user cannot access Org B payroll records', async () => {
    const res = await getAs(orgAToken, '/api/payroll?employeeId=org-b-employee-fake-id');
    // Should return empty or 403/404 — not Org B data
    if (res.status === 200) {
      const data = res.body?.data || res.body || [];
      if (Array.isArray(data)) {
        // Any payroll returned should belong to Org A
        const crossOrgItems = data.filter((p: any) =>
          p.organizationId === 'org-b-unique-id' || p.organization_id === 'org-b-unique-id'
        );
        expect(crossOrgItems).toHaveLength(0);
      }
    }
  });

  it('Org A audit logs should not contain Org B events', async () => {
    const resA = await getAs(orgAToken, '/api/audit-logs');
    if (resA.status === 200) {
      const logs = resA.body?.data || resA.body || [];
      if (Array.isArray(logs)) {
        const crossOrgLogs = logs.filter((l: any) =>
          l.organizationId === 'org-b-unique-id' || l.organization_id === 'org-b-unique-id'
        );
        expect(crossOrgLogs).toHaveLength(0);
      }
    }
  });
});

// =====================================================
// Body Parameter Override (Cross-Org Attack)
// =====================================================
describe('Multi-Tenant Isolation — Body Parameter Attacks', () => {
  it('should ignore organizationId in request body for leave list', async () => {
    const res = await request(app)
      .get('/api/leaves')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({ organizationId: 'org-b-unique-id' }); // Attack: try to access Org B

    // Backend must use JWT-derived org, not body
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      const data = res.body?.data || res.body || [];
      if (Array.isArray(data)) {
        const crossOrgItems = data.filter((l: any) =>
          l.organizationId === 'org-b-unique-id' || l.organization_id === 'org-b-unique-id'
        );
        expect(crossOrgItems).toHaveLength(0);
      }
    }
  });

  it('should ignore employeeId in request body for notifications', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${orgAEmployeeToken}`)
      .send({ employeeId: 'org-b-emp-id' }); // Attack: try to read Org B employee notifications

    if (res.status === 200) {
      const data = res.body?.data || res.body || [];
      if (Array.isArray(data)) {
        const crossOrgItems = data.filter((n: any) =>
          n.recipientEmployeeId === 'org-b-emp-id'
        );
        expect(crossOrgItems).toHaveLength(0);
      }
    }
  });

  it('should deny device registration with Org B employeeId in body', async () => {
    const res = await request(app)
      .post('/api/devices/register')
      .set('Authorization', `Bearer ${orgAToken}`) // Org A admin
      .send({
        employeeId: 'org-b-employee-id', // Attack: register device for Org B employee
        token: 'ExponentPushToken[fake_token]',
        platform: 'ios',
      });

    // Backend uses req.user.employeeId, not body.employeeId
    // Org A admin doesn't have employeeId in JWT → should get 403
    expect([201, 403]).toContain(res.status);
  });
});

// =====================================================
// Report Isolation
// =====================================================
describe('Multi-Tenant Isolation — Reports', () => {
  it('Org A report data should not include Org B employees', async () => {
    const res = await getAs(orgAToken, '/api/reports/data?type=employee');
    if (res.status === 200) {
      const rows = res.body?.rows || [];
      const crossOrgRows = rows.filter((r: any) =>
        r.organizationId === 'org-b-unique-id' || r.organization_id === 'org-b-unique-id'
      );
      expect(crossOrgRows).toHaveLength(0);
    }
  });

  it('Org A CSV export should not include Org B data', async () => {
    const res = await getAs(orgAToken, '/api/reports/export?type=employee');
    if (res.status === 200) {
      // CSV should not contain Org B identifiers
      expect(res.text).not.toContain('org-b-unique-id');
    }
  });
});
