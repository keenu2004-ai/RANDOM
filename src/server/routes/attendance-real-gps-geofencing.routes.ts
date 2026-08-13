import { Router, Request, Response } from 'express';
import { authenticateToken, requireRoles, AuthenticatedRequest } from '../auth';
import { attendanceRepository } from '../repositories/attendance.repository';

export const attendanceRealGpsGeofencingRouter = Router();

attendanceRealGpsGeofencingRouter.get('/attendance', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const list = await attendanceRepository.getAttendance(req.user!.organizationId, req.user!.role, req.user!.employeeId!, req.query);
    return res.json(list);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

attendanceRealGpsGeofencingRouter.get('/attendance/today', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const empId = req.user!.employeeId!;
    const record = await attendanceRepository.getAttendanceRecordForToday(req.user!.organizationId, empId);
    const shift = await attendanceRepository.getShift(empId);

    return res.json({ 
      date: record?.date || new Date().toISOString().split('T')[0], 
      record, 
      isCheckedIn: !!record && !!record.checkInTime, 
      isCheckedOut: !!record && !!record.checkOutTime, 
      onBreak: false, 
      shift 
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

attendanceRealGpsGeofencingRouter.get('/attendance/stats', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetDate = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const stats = await attendanceRepository.getStats(targetDate);
    return res.json(stats);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

attendanceRealGpsGeofencingRouter.post('/attendance/check-in', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const empId = req.user!.employeeId!;
    const { latitude, longitude, accuracy, address } = req.body;
    
    if (latitude == null || longitude == null || accuracy == null) {
      return res.status(400).json({ error: 'Latitude, longitude and accuracy are required' });
    }
    
    const lat = Number(latitude);
    const lng = Number(longitude);
    const acc = Number(accuracy);
    
    if (isNaN(lat) || lat < -90 || lat > 90) return res.status(400).json({ error: 'Invalid latitude bounds' });
    if (isNaN(lng) || lng < -180 || lng > 180) return res.status(400).json({ error: 'Invalid longitude bounds' });
    if (isNaN(acc) || acc < 0) return res.status(400).json({ error: 'Invalid accuracy bounds' });

    const record = await attendanceRepository.createAttendance(
      req.user!.organizationId, 
      { employeeId: empId, latitude: lat, longitude: lng, accuracy: acc, address },
      req.user!.userId,
      req.user!.email,
      req.user!.role
    );
    
    return res.status(201).json(record);
  } catch (error: any) {
    const msg = error.message || '';
    
    // Structured config errors requested by User
    if (msg.startsWith('SHIFT_NOT_ASSIGNED:')) return res.status(400).json({ code: 'SHIFT_NOT_ASSIGNED', message: msg.replace('SHIFT_NOT_ASSIGNED: ', '') });
    if (msg.startsWith('SHIFT_LOCATION_NOT_CONFIGURED:')) return res.status(400).json({ code: 'SHIFT_LOCATION_NOT_CONFIGURED', message: msg.replace('SHIFT_LOCATION_NOT_CONFIGURED: ', '') });
    if (msg.startsWith('ATTENDANCE_LOCATION_INACTIVE:')) return res.status(400).json({ code: 'ATTENDANCE_LOCATION_INACTIVE', message: msg.replace('ATTENDANCE_LOCATION_INACTIVE: ', '') });
    if (msg.startsWith('INVALID_ATTENDANCE_LOCATION_CONFIGURATION:')) return res.status(400).json({ code: 'INVALID_ATTENDANCE_LOCATION_CONFIGURATION', message: msg.replace('INVALID_ATTENDANCE_LOCATION_CONFIGURATION: ', '') });
    if (msg.startsWith('INVALID_GPS_COORDINATES:')) return res.status(400).json({ code: 'INVALID_GPS_COORDINATES', message: msg.replace('INVALID_GPS_COORDINATES: ', '') });
    if (msg.startsWith('ORGANIZATION_MISMATCH:')) return res.status(403).json({ code: 'ORGANIZATION_MISMATCH', message: msg.replace('ORGANIZATION_MISMATCH: ', '') });

    if (msg.includes('Duplicate check-in')) return res.status(409).json({ error: msg });
    if (msg.includes('Geofence error') || msg.includes('GPS accuracy')) return res.status(403).json({ error: msg });
    
    return res.status(400).json({ error: msg });
  }
});

attendanceRealGpsGeofencingRouter.post('/attendance/check-out', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const empId = req.user!.employeeId!;
    const record = await attendanceRepository.getAttendanceRecordForToday(req.user!.organizationId, empId);
    
    if (!record || !record.checkInTime) return res.status(400).json({ error: 'No active check-in record found for today' });
    if (record.checkOutTime) return res.status(400).json({ error: 'You have already checked out today' });

    const { latitude, longitude, accuracy, address } = req.body;
    
    if (latitude == null || longitude == null || accuracy == null) {
      return res.status(400).json({ error: 'Latitude, longitude and accuracy are required' });
    }
    
    const lat = Number(latitude);
    const lng = Number(longitude);
    const acc = Number(accuracy);
    
    if (isNaN(lat) || lat < -90 || lat > 90) return res.status(400).json({ error: 'Invalid latitude bounds' });
    if (isNaN(lng) || lng < -180 || lng > 180) return res.status(400).json({ error: 'Invalid longitude bounds' });
    if (isNaN(acc) || acc < 0) return res.status(400).json({ error: 'Invalid accuracy bounds' });

    const updated = await attendanceRepository.updateCheckOut(
      req.user!.organizationId, 
      record.id, 
      { latitude: lat, longitude: lng, accuracy: acc, address },
      req.user!.userId,
      req.user!.email,
      req.user!.role
    );
    
    return res.json(updated);
  } catch (error: any) {
    if (error.message.includes('GPS accuracy')) return res.status(403).json({ error: error.message });
    return res.status(400).json({ error: error.message });
  }
});

attendanceRealGpsGeofencingRouter.post('/attendance/break/start', authenticateToken, (req, res) => res.json({ message: 'Break started' }));
attendanceRealGpsGeofencingRouter.post('/attendance/break/end', authenticateToken, (req, res) => res.json({ message: 'Break ended' }));
attendanceRealGpsGeofencingRouter.post('/attendance/manual-correction', authenticateToken, requireRoles('SUPER_ADMIN'), (req, res) => res.json({}));

// Phase 14: Regularization Requests
attendanceRealGpsGeofencingRouter.post('/attendance/regularization', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payload = req.body;
    if (!payload.date || !payload.requestedStatus || !payload.reason) {
      return res.status(400).json({ error: 'date, requestedStatus, and reason are required' });
    }
    const record = await attendanceRepository.createRegularizationRequest(req.user!.organizationId, payload, req.user!.employeeId!);
    return res.status(201).json(record);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

attendanceRealGpsGeofencingRouter.get('/attendance/regularization', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await attendanceRepository.getRegularizationRequests(req.user!.organizationId, req.query, req.user!.role, req.user!.employeeId!);
    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

attendanceRealGpsGeofencingRouter.patch('/attendance/regularization/:id/approve', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const reviewerEmpId = req.user!.employeeId!;
    const reviewerRole = req.user!.role;
    const reqId = req.params.id;

    const updated = await attendanceRepository.approveRegularizationRequest(orgId, reqId, reviewerEmpId, reviewerRole);
    return res.json(updated);
  } catch (error: any) {
    if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
    if (error.message.includes('self-approve') || error.message.includes('authorized') || error.message.includes('isolation')) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message });
  }
});

attendanceRealGpsGeofencingRouter.patch('/attendance/regularization/:id/reject', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const reviewerEmpId = req.user!.employeeId!;
    const reviewerRole = req.user!.role;
    const reqId = req.params.id;
    const { reason } = req.body;

    if (!reason) return res.status(400).json({ error: 'Reason is required for rejection' });

    const updated = await attendanceRepository.rejectRegularizationRequest(orgId, reqId, reviewerEmpId, reviewerRole, reason);
    return res.json(updated);
  } catch (error: any) {
    if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
    if (error.message.includes('self-reject') || error.message.includes('authorized') || error.message.includes('isolation')) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message });
  }
});
attendanceRealGpsGeofencingRouter.get('/settings/attendance', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  return res.json(await attendanceRepository.getSettings(req.user!.organizationId));
});
attendanceRealGpsGeofencingRouter.patch('/settings/attendance', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  return res.json(await attendanceRepository.updateSettings(req.user!.organizationId, req.body));
});
