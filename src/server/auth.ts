/**
 * THEIAKSHI ENTERPRISE - Authentication & RBAC Middleware
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role, User, Employee } from '../types/hrms';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required. Shutting down.');
  process.exit(1);
}

const JWT_SECRET_KEY = JWT_SECRET;

export interface AuthPayload {
  userId: string;
  organizationId: string;
  email: string;
  role: Role;
  employeeId?: string;
  employeeCode?: string;
  employeeName?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET_KEY, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET_KEY) as AuthPayload;
  } catch (err) {
    return null;
  }
}

import { userRepository } from './repositories/user.repository';

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }

  const user = await userRepository.findById(payload.userId);
  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'Account is inactive or has been deleted' });
  }

  req.user = {
    ...payload,
    organizationId: user.organizationId,
    role: user.role
  };
  next();
}

export function requireRoles(...allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (allowedRoles.includes(req.user.role) || req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    return res.status(403).json({
      error: `Access Denied: Role '${req.user.role}' lacks permission for this action. Required: ${allowedRoles.join(', ')}`
    });
  };
}

// Role Hierarchy Check
export function isManagerOrAdmin(role: Role): boolean {
  return ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(role);
}

export function isHRorAdmin(role: Role): boolean {
  return ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(role);
}

export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const role = req.user.role;
    if (role === 'SUPER_ADMIN') {
      return next();
    }
    // Hardcoded simple static mapping based on user role for Phase 2
    if (role === 'ADMIN') {
      return next(); // Admins have all permissions within org
    }
    if (role === 'HR_MANAGER') {
      // HR Managers have most permissions except system settings
      if (!permission.startsWith('system.')) {
         return next();
      }
    }
    if (role === 'MANAGER') {
      // Managers can read/update most employee data (scoping is done at resource level)
      if (permission.startsWith('employee.') || permission.startsWith('leave.') || permission.startsWith('attendance.') || permission.startsWith('timesheet.') || permission.startsWith('expense.')) {
        return next();
      }
    }
    if (role === 'EMPLOYEE') {
      // Employees have basic self permissions (scoping is done at resource level)
      if (permission.includes('read') || permission.includes('create') || permission.includes('update')) {
        return next();
      }
    }

    // Default deny if it didn't match
    return res.status(403).json({
      error: `Access Denied: Role '${role}' lacks permission '${permission}'.`
    });
  };
}
