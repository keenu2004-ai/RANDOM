import { query, queryOne, beginTransaction } from '../db/client';

export interface DeviceToken {
  id: string;
  organizationId: string;
  employeeId: string;
  token: string;
  platform: string;
  appVersion?: string;
  deviceId?: string;
  isActive: boolean;
}

export abstract class PushProvider {
  abstract sendPush(tokens: string[], title: string, body: string, data?: any): Promise<boolean>;
}

export class LogPushProvider extends PushProvider {
  constructor() {
    super();
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[PushNotificationService] WARNING: LogPushProvider is active in PRODUCTION. ' +
        'Push notifications will NOT be delivered. Set PUSH_PROVIDER=expo|fcm|apns in production.'
      );
    }
  }
  
  async sendPush(tokens: string[], title: string, body: string, _data?: any): Promise<boolean> {
    // Never log token values or any sensitive payload data
    console.log(`[LogPushProvider] Mock push: title="${title}" body="${body}" to ${tokens.length} device(s)`);
    return true;
  }
}

export class PushNotificationService {
  private provider: PushProvider;

  constructor(provider?: PushProvider) {
    // Default to Log provider for test/dev. In prod, inject APNs/FCM provider.
    this.provider = provider || new LogPushProvider();
  }

  async registerDevice(
    organizationId: string,
    employeeId: string,
    token: string,
    platform: string,
    appVersion?: string,
    deviceId?: string
  ): Promise<void> {
    const tx = await beginTransaction();
    try {
      // Upsert logic for unique_device_token constraint
      const existing = await tx.queryOne<DeviceToken>(
        `SELECT id FROM device_tokens WHERE employee_id = $1 AND token = $2`,
        [employeeId, token]
      );

      if (existing) {
        await tx.query(
          `UPDATE device_tokens 
           SET is_active = true, last_seen_at = CURRENT_TIMESTAMP, app_version = $1, platform = $2, device_id = $3
           WHERE id = $4`,
          [appVersion || null, platform, deviceId || null, existing.id]
        );
      } else {
        await tx.query(
          `INSERT INTO device_tokens (organization_id, employee_id, token, platform, app_version, device_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [organizationId, employeeId, token, platform, appVersion || null, deviceId || null]
        );
      }
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }

  async unregisterDevice(organizationId: string, employeeId: string, token: string): Promise<void> {
    await query(
      `DELETE FROM device_tokens WHERE organization_id = $1 AND employee_id = $2 AND token = $3`,
      [organizationId, employeeId, token]
    );
  }

  async sendToEmployee(organizationId: string, employeeId: string, title: string, body: string, data?: any): Promise<void> {
    try {
      // Resolve tokens
      const devices = await query<{token: string}>(
        `SELECT token FROM device_tokens WHERE organization_id = $1 AND employee_id = $2 AND is_active = true`,
        [organizationId, employeeId]
      );

      if (devices.length === 0) return; // No active devices

      const tokens = devices.map(d => d.token);
      
      // Send async using the provider abstraction. Do not throw on push provider failure.
      await this.provider.sendPush(tokens, title, body, data);
    } catch (e) {
      console.error(`[PushNotificationService] Failed to send push to employee ${employeeId}:`, e);
      // IMPORTANT: Swallowing error so business logic transaction is NOT rolled back
    }
  }
}

export const pushService = new PushNotificationService(new LogPushProvider());
