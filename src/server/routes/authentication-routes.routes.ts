import { Router, Request, Response, NextFunction } from 'express';
import { generateId } from '../utils';
import { query } from '../db/client.js';
import { authenticateToken, requireRoles, AuthenticatedRequest, isManagerOrAdmin, isHRorAdmin } from '../auth';
import { userRepository } from '../repositories/user.repository';
import * as bcrypt from 'bcryptjs';
import { generateToken } from '../auth';
import { logAudit } from '../utils';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';

export const authenticationRoutesRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});

authenticationRoutesRouter.post('/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await userRepository.findByEmail(email);

  if (!user || !user.isActive || !bcrypt.compareSync(password, user.passwordHash)) {
    // Audit failed login
    if (user) {
      logAudit(user.organizationId, user.id, user.email, 'User', 'LOGIN_FAILED', 'AUTH', user.id, 'Invalid credentials');
    }
    return res.status(401).json({ error: 'Invalid email credentials or password' });
  }

  let employee = null;
  if (user.employeeId) {
    employee = await userRepository.findEmployeeById(user.employeeId);
  }
  const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : 'System Admin';

  const token = generateToken({
    userId: user.id,
    organizationId: user.organizationId,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId,
    employeeCode: employee?.employeeCode,
    employeeName
  });

  logAudit(user.organizationId, user.id, user.email, employeeName, 'USER_LOGIN', 'USER', user.id, 'User logged in successfully');

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
      employeeCode: employee?.employeeCode,
      employeeName,
      employee
    }
  });
});

authenticationRoutesRouter.get('/auth/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const user = await userRepository.findById(req.user!.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  let employee = null;
  if (user.employeeId) {
    employee = await userRepository.findEmployeeById(user.employeeId);
  }
  const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : 'System Admin';

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
      employeeCode: employee?.employeeCode,
      employeeName,
      employee
    }
  });
});

authenticationRoutesRouter.post('/auth/forgot-password', authLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email address is required' });
  }

  const user = await userRepository.findByEmail(email);
  if (user) {
    // Generate a cryptographically secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    // Expires in 15 minutes
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    
    await userRepository.updateResetToken(user.id, resetTokenHash, expiresAt);

    logAudit(user.organizationId, user.id, user.email, 'User', 'PASSWORD_RESET_REQUESTED', 'AUTH', user.id, 'Password reset requested');

    // In a real application, send an email here with the raw `resetToken`
    // e.g., sendEmail(email, `https://.../reset-password?token=${resetToken}&email=${email}`)
    
    const responseData: any = {
      message: 'If the account exists, password reset instructions have been sent.'
    };
    
    // Only return the raw token in test environments
    if (process.env.NODE_ENV === 'test') {
      responseData._testOnlyToken = resetToken;
    }
    
    return res.json(responseData);
  }

  return res.json({
    message: 'If the account exists, password reset instructions have been sent.'
  });
});

authenticationRoutesRouter.post('/auth/reset-password', authLimiter, async (req, res) => {
  const { email, token, newPassword } = req.body;
  
  if (!email || !token || !newPassword) {
    return res.status(400).json({ error: 'Email, token, and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  const user = await userRepository.findUserByResetTokenInfo(email);
  if (!user || !user.reset_token_hash || !user.reset_token_expires_at) {
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }

  const providedTokenHash = crypto.createHash('sha256').update(token).digest('hex');
  if (providedTokenHash !== user.reset_token_hash) {
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }

  if (new Date(user.reset_token_expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: 'Reset token has expired' });
  }

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  await userRepository.updatePassword(user.id, passwordHash);
  await userRepository.updateResetToken(user.id, null, null); // Invalidate token

  logAudit(user.organizationId, user.id, email, 'User', 'PASSWORD_RESET_COMPLETED', 'AUTH', user.id, 'Password reset successfully');

  return res.json({
    message: 'Password reset successfully. You can now log in with your new password.'
  });
});

authenticationRoutesRouter.post('/auth/change-password', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  const user = await userRepository.findById(req.user!.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (!bcrypt.compareSync(currentPassword, user.passwordHash)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  await userRepository.updatePassword(user.id, passwordHash);

  logAudit(user.organizationId, user.id, user.email, req.user!.employeeName, 'PASSWORD_CHANGED', 'AUTH', user.id, 'Password changed from user settings');

  return res.json({
    message: 'Password updated successfully'
  });
});

authenticationRoutesRouter.post('/auth/logout', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  logAudit(req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.employeeName, 'USER_LOGOUT', 'AUTH', req.user!.userId, 'User signed out');
  return res.json({ message: 'Signed out successfully' });
});

