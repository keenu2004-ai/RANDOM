/**
 * THEIAKSHI ENTERPRISE - Complete REST API Routes
 */

import { Router, Response } from 'express';
import { query } from './db/client.js';

import { attendanceRealGpsGeofencingRouter } from './routes/attendance-real-gps-geofencing.routes';
import { auditLogsReportsSettingsRouter } from './routes/audit-logs-reports-settings.routes';
import { authenticationRoutesRouter } from './routes/authentication-routes.routes';
import { dashboardStatsRouter } from './routes/dashboard-stats.routes';
import { documentsManagementSecureStorageAuthorizationRouter } from './routes/documents-management-secure-storage-authorization-.routes';
import { expensesRouter } from './routes/expenses.routes';
import { helpdeskRouter } from './routes/helpdesk.routes';
import { holidaysShiftsRouter } from './routes/holidays-shifts.routes';
import { leaveManagementRouter } from './routes/leave-management.routes';
import { notificationsAnnouncementsRouter } from './routes/notifications-announcements.routes';
import { organizationMetaEmployeeManagementRouter } from './routes/organization-meta-employee-management.routes';
import { payrollSalaryStructureManagementRouter } from './routes/payroll-salary-structure-management.routes';
import { projectsTimesheetsRouter } from './routes/projects-timesheets.routes';
import { statutoryComplianceRouter } from './routes/statutory-compliance.routes';
import devicesRouter from './routes/devices.routes';
export const apiRouter = Router();

apiRouter.use('/', attendanceRealGpsGeofencingRouter);
apiRouter.use('/', auditLogsReportsSettingsRouter);
apiRouter.use('/', authenticationRoutesRouter);
apiRouter.use('/', dashboardStatsRouter);
apiRouter.use('/', documentsManagementSecureStorageAuthorizationRouter);
apiRouter.use('/', expensesRouter);
apiRouter.use('/', helpdeskRouter);
apiRouter.use('/', holidaysShiftsRouter);
apiRouter.use('/', leaveManagementRouter);
apiRouter.use('/', notificationsAnnouncementsRouter);
apiRouter.use('/', organizationMetaEmployeeManagementRouter);
apiRouter.use('/', payrollSalaryStructureManagementRouter);
apiRouter.use('/', projectsTimesheetsRouter);
apiRouter.use('/', statutoryComplianceRouter);
apiRouter.use('/devices', devicesRouter);
// ==========================================
// 0. HEALTH CHECK & DATABASE CONNECTIVITY
// ==========================================

const APP_VERSION = process.env.npm_package_version || '1.0.0';
const startTime = Date.now();

apiRouter.get('/health', async (req, res) => {
  try {
    const pgResult = await query('SELECT 1 as connected, NOW() as current_time');
    const isConnected = pgResult && pgResult.length > 0 && pgResult[0].connected === 1;
    return res.json({
      status: isConnected ? 'HEALTHY' : 'DEGRADED',
      version: APP_VERSION,
      environment: process.env.NODE_ENV || 'development',
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      services: {
        database: {
          engine: 'PostgreSQL',
          status: isConnected ? 'UP' : 'DOWN',
          serverTime: pgResult[0]?.current_time
        }
      }
    });
  } catch (_err) {
    // Do not expose internal DB connection error details
    return res.status(503).json({
      status: 'UNHEALTHY',
      timestamp: new Date().toISOString(),
      services: { database: { status: 'DOWN' } }
    });
  }
});
