import { query, queryOne } from '../db/client';
import { User, Role } from '../../types/hrms';

export interface UserRow {
  id: string;
  organization_id: string;
  email: string;
  password_hash: string;
  is_active: boolean;
  role: Role;
  employee_id: string | null;
  created_at: string;
}

export class UserRepository {
  private mapRowToUser(row: UserRow): User {
    return {
      id: row.id,
      organizationId: row.organization_id,
      email: row.email,
      passwordHash: row.password_hash,
      isActive: row.is_active,
      role: row.role,
      employeeId: row.employee_id || undefined,
      createdAt: row.created_at,
      updatedAt: ''
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await queryOne<UserRow>(
      `SELECT * FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );
    return row ? this.mapRowToUser(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const row = await queryOne<UserRow>(
      `SELECT * FROM users WHERE id = $1`,
      [id]
    );
    return row ? this.mapRowToUser(row) : null;
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, id]);
  }

  async updateResetToken(id: string, tokenHash: string | null, expiresAt: string | null): Promise<void> {
    await query(`UPDATE users SET reset_token_hash = $1, reset_token_expires_at = $2 WHERE id = $3`, [tokenHash, expiresAt, id]);
  }

  async findUserByResetTokenInfo(email: string): Promise<{ id: string, organizationId: string, reset_token_hash: string | null, reset_token_expires_at: string | null } | null> {
    const row = await queryOne<{ id: string, organizationId: string, reset_token_hash: string | null, reset_token_expires_at: string | null }>(
      `SELECT id, organization_id, reset_token_hash, reset_token_expires_at FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );
    return row ? { id: row.id, organizationId: row.organizationId, reset_token_hash: row.reset_token_hash, reset_token_expires_at: row.reset_token_expires_at } : null;
  }

  async findEmployeeById(id: string): Promise<any | null> {
    const row = await queryOne<any>(`SELECT * FROM employees WHERE id = $1`, [id]);
    if (!row) return null;
    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      employeeCode: row.employee_code,
      departmentId: row.department_id,
      status: row.status
    };
  }
}

export const userRepository = new UserRepository();
