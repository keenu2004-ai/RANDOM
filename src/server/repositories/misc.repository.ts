import { query, queryOne } from '../db/client';

export class MiscRepository {
  async getOrganization(id: string) {
    return queryOne('SELECT * FROM organizations WHERE id = $1', [id]);
  }

  async getBranches(orgId: string) {
    return query('SELECT * FROM branches WHERE organization_id = $1', [orgId]);
  }

  async getDepartments(orgId: string) {
    return query('SELECT * FROM departments WHERE organization_id = $1', [orgId]);
  }

  async getDesignations(orgId: string) {
    return query('SELECT * FROM designations WHERE organization_id = $1', [orgId]);
  }

  async getTeams(orgId: string) {
    return query('SELECT * FROM teams WHERE organization_id = $1', [orgId]);
  }

  async getRoles(orgId: string) {
    return query('SELECT * FROM roles WHERE organization_id = $1', [orgId]);
  }
}

export const miscRepository = new MiscRepository();
