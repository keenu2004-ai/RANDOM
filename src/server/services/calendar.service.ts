import { query, queryOne } from '../db/client';

export interface ShiftInfo {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  gracePeriodMinutes: number;
  weekOffs: string[]; // E.g. ["SATURDAY", "SUNDAY"]
}

const DAY_MAP: Record<string, number> = {
  "SUNDAY": 0,
  "MONDAY": 1,
  "TUESDAY": 2,
  "WEDNESDAY": 3,
  "THURSDAY": 4,
  "FRIDAY": 5,
  "SATURDAY": 6
};

function parseWeekOffs(weekOffsData: any): string[] {
  if (!weekOffsData) return [];
  try {
    if (typeof weekOffsData === 'string') {
      const parsed = JSON.parse(weekOffsData);
      return Array.isArray(parsed) ? parsed : [];
    }
    return Array.isArray(weekOffsData) ? weekOffsData : [];
  } catch (e) {
    return [];
  }
}

export async function getEmployeeShift(orgId: string, employeeId: string): Promise<ShiftInfo | null> {
  const empShift = await queryOne(`
    SELECT s.id, s.name, s.start_time, s.end_time, s.grace_period_minutes, s.week_offs
    FROM shifts s
    JOIN employees e ON e.shift_id = s.id
    WHERE e.organization_id = $1 AND e.id = $2
  `, [orgId, employeeId]);

  if (empShift) {
    return {
      id: empShift.id,
      name: empShift.name,
      startTime: empShift.start_time,
      endTime: empShift.end_time,
      gracePeriodMinutes: empShift.grace_period_minutes,
      weekOffs: parseWeekOffs(empShift.week_offs)
    };
  }

  const defaultShift = await queryOne(`
    SELECT id, name, start_time, end_time, grace_period_minutes, week_offs
    FROM shifts
    WHERE organization_id = $1 AND active = TRUE
    ORDER BY created_at
    LIMIT 1
  `, [orgId]);

  if (defaultShift) {
    return {
      id: defaultShift.id,
      name: defaultShift.name,
      startTime: defaultShift.start_time,
      endTime: defaultShift.end_time,
      gracePeriodMinutes: defaultShift.grace_period_minutes,
      weekOffs: parseWeekOffs(defaultShift.week_offs)
    };
  }

  return null;
}

export async function getWorkingDays(orgId: string, employeeId: string, startDateStr: string, endDateStr: string): Promise<string[]> {
  const shift = await getEmployeeShift(orgId, employeeId);
  const weekOffs = shift ? shift.weekOffs : [];
  const weekOffDays = weekOffs.map(d => DAY_MAP[d.toUpperCase()]).filter(d => d !== undefined);

  const holidaysData = await query(`
    SELECT date FROM holidays
    WHERE organization_id = $1 AND date >= $2 AND date <= $3
  `, [orgId, startDateStr, endDateStr]);
  const holidays = new Set(holidaysData.map(h => h.date.toISOString().split('T')[0]));

  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const workingDays: string[] = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    const dateStr = d.toISOString().split('T')[0];

    if (!weekOffDays.includes(dayOfWeek) && !holidays.has(dateStr)) {
      workingDays.push(dateStr);
    }
  }

  return workingDays;
}

export async function isWorkingDay(orgId: string, employeeId: string, dateStr: string): Promise<boolean> {
  const days = await getWorkingDays(orgId, employeeId, dateStr, dateStr);
  return days.length > 0;
}
