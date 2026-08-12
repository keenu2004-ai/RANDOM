import { Router } from 'express';
import { pushService } from '../services/PushNotificationService';
import { authenticateToken as authenticate } from '../auth';

const router = Router();

// Apply auth middleware to all device routes
router.use(authenticate);

router.post('/register', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || !user.employeeId) {
      return res.status(403).json({ error: 'Unauthorized: Employee identity required' });
    }

    const { token, platform, appVersion, deviceId } = req.body;

    if (!token || !platform) {
      return res.status(400).json({ error: 'Token and platform are required' });
    }

    // Always derive org/emp from req.user
    await pushService.registerDevice(
      user.organizationId,
      user.employeeId,
      token,
      platform,
      appVersion,
      deviceId
    );

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:token', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || !user.employeeId) {
      return res.status(403).json({ error: 'Unauthorized: Employee identity required' });
    }

    const token = req.params.token;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    await pushService.unregisterDevice(user.organizationId, user.employeeId, token);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error unregistering device:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
