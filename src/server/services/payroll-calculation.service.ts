import { query, queryOne } from '../db/client';
import { getWorkingDays } from './calendar.service';

export interface SalaryStructure {
  basicSalary: number;
  hra: number;
  specialAllowance: number;
  medicalAllowance: number;
  conveyanceAllowance: number;
  otherAllowances: number;
  bonus: number;
  incentives: number;
  otherDeductions: number;
}

export interface StatutoryRules {
  pfRatePercentage: number;  // e.g. 12.0
  pfMaxBasis: number;        // e.g. 15000 (PF only on up to 15000 basic)
  pfCap: number;             // e.g. 1800 (max employee PF = 1800/month)
  esiRatePercentage: number; // e.g. 0.75
  esiThreshold: number;      // e.g. 21000 (ESI only if gross <= 21000)
  ptFixedAmount: number;     // e.g. 200
  ptThreshold: number;       // e.g. 25000 (PT only if gross >= 25000)
  tdsRatePercentage: number; // e.g. 10.0
  tdsThreshold: number;      // e.g. 100000 (TDS only if gross >= 100000)
}

export interface PayrollCalculationResult {
  workingDays: number;
  payableDays: number;
  lossOfPayDays: number;
  paidLeaveDays: number;
  basicSalary: number;
  hra: number;
  allowances: number;
  bonus: number;
  incentives: number;
  grossEarnings: number;
  pfDeduction: number;
  esiDeduction: number;
  ptDeduction: number;
  tdsDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  calculationBreakdown: object;
}

export class PayrollConfigurationError extends Error {
  statusCode = 422;
  code = 'PAYROLL_CONFIGURATION_MISSING';
  constructor(msg: string) {
    super(msg);
    this.name = 'PayrollConfigurationError';
  }
}

export async function loadStatutoryRules(orgId: string): Promise<StatutoryRules> {
  const rules = await query(`SELECT * FROM statutory_rules WHERE organization_id = $1 AND active = TRUE`, [orgId]);
  const find = (cat: string) => rules.find((r: any) => r.category === cat);
  const pfRule = find('PF');
  const esiRule = find('ESI');
  const ptRule = find('PROFESSIONAL_TAX');
  const tdsRule = find('TDS');

  // CRITICAL: Do NOT invent statutory rates. The organisation must configure them.
  // If zero rules exist, the calling payroll engine must not produce a payroll.
  if (!pfRule && !esiRule && !ptRule && !tdsRule) {
    throw new PayrollConfigurationError(
      'Required statutory payroll configuration is missing for this organization. ' +
      'Please configure PF, ESI, PT, and TDS rules under Statutory Settings before processing payroll.'
    );
  }

  return {
    pfRatePercentage: pfRule ? parseFloat(pfRule.rate_percentage) : 0,
    pfMaxBasis: pfRule ? parseFloat(pfRule.threshold_amount || '15000') : 0,
    pfCap: pfRule ? parseFloat(pfRule.fixed_amount || '1800') : 0,
    esiRatePercentage: esiRule ? parseFloat(esiRule.rate_percentage) : 0,
    esiThreshold: esiRule ? parseFloat(esiRule.threshold_amount || '21000') : 0,
    ptFixedAmount: ptRule ? parseFloat(ptRule.fixed_amount || '0') : 0,
    ptThreshold: ptRule ? parseFloat(ptRule.threshold_amount || '25000') : 0,
    tdsRatePercentage: tdsRule ? parseFloat(tdsRule.rate_percentage) : 0,
    tdsThreshold: tdsRule ? parseFloat(tdsRule.threshold_amount || '100000') : 0,
  };
}

export async function getMonthWorkingDays(orgId: string, employeeId: string, year: number, month: number): Promise<string[]> {
  const monthStr = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  const startDate = `${year}-${monthStr}-01`;
  const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
  return getWorkingDays(orgId, employeeId, startDate, endDate);
}

export async function getLopDays(orgId: string, employeeId: string, year: number, month: number): Promise<{ lopDays: number; paidLeaveDays: number }> {
  const monthStr = String(month).padStart(2, '0');
  const startPattern = `${year}-${monthStr}`;
  const leaves = await query(`
    SELECT lr.days_count, lt.code FROM leave_requests lr
    JOIN leave_types lt ON lr.leave_type_id = lt.id
    WHERE lr.organization_id = $1 AND lr.employee_id = $2
      AND lr.status = 'APPROVED'
      AND (lr.start_date::text LIKE $3 OR lr.end_date::text LIKE $3)
  `, [orgId, employeeId, `${startPattern}%`]);
  let lopDays = 0;
  let paidLeaveDays = 0;
  for (const l of leaves) {
    const days = parseFloat(l.days_count) || 0;
    if (l.code === 'UNPAID' || l.code === 'LOP') {
      lopDays += days;
    } else {
      paidLeaveDays += days;
    }
  }
  return { lopDays, paidLeaveDays };
}

export function calculatePayroll(
  sal: SalaryStructure,
  workingDays: number,
  payableDays: number,
  lossOfPayDays: number,
  paidLeaveDays: number,
  rules: StatutoryRules
): PayrollCalculationResult {
  if (workingDays <= 0) workingDays = 1; // safety guard
  const lopFactor = payableDays / workingDays;

  // Apply proration using lopFactor (DECIMAL precision via rounding to 2dp)
  const basicSalary = Math.round(sal.basicSalary * lopFactor * 100) / 100;
  const hra = Math.round(sal.hra * lopFactor * 100) / 100;
  const allowances = Math.round((sal.specialAllowance + sal.medicalAllowance + sal.conveyanceAllowance + sal.otherAllowances) * lopFactor * 100) / 100;
  const bonus = Math.round(sal.bonus * 100) / 100;  // bonus/incentives not pro-rated
  const incentives = Math.round(sal.incentives * 100) / 100;

  const grossEarnings = Math.round((basicSalary + hra + allowances + bonus + incentives) * 100) / 100;

  // PF: on basic only, up to pfCap
  const pfBasis = Math.min(basicSalary, rules.pfMaxBasis);
  const pfDeduction = Math.min(rules.pfCap, Math.round(pfBasis * (rules.pfRatePercentage / 100) * 100) / 100);

  // ESI: on gross if gross <= threshold
  const esiDeduction = grossEarnings <= rules.esiThreshold
    ? Math.round(grossEarnings * (rules.esiRatePercentage / 100) * 100) / 100
    : 0;

  // PT: fixed amount if gross >= threshold
  const ptDeduction = grossEarnings >= rules.ptThreshold ? rules.ptFixedAmount : 0;

  // TDS: on gross if gross >= threshold
  const tdsDeduction = grossEarnings >= rules.tdsThreshold
    ? Math.round(grossEarnings * (rules.tdsRatePercentage / 100) * 100) / 100
    : 0;

  const otherDeductions = Math.round(sal.otherDeductions * 100) / 100;
  const totalDeductions = Math.round((pfDeduction + esiDeduction + ptDeduction + tdsDeduction + otherDeductions) * 100) / 100;
  const netSalary = Math.max(0, Math.round((grossEarnings - totalDeductions) * 100) / 100);

  const calculationBreakdown = {
    workingDays,
    payableDays,
    lossOfPayDays,
    paidLeaveDays,
    lopFactor: Math.round(lopFactor * 10000) / 10000,
    statutoryRatesApplied: {
      pfRatePercentage: rules.pfRatePercentage,
      pfCap: rules.pfCap,
      esiRatePercentage: rules.esiRatePercentage,
      esiThreshold: rules.esiThreshold,
      ptFixedAmount: rules.ptFixedAmount,
      ptThreshold: rules.ptThreshold,
      tdsRatePercentage: rules.tdsRatePercentage,
      tdsThreshold: rules.tdsThreshold,
    },
    earningsBreakdown: [
      { name: 'Basic Salary', amount: basicSalary },
      { name: 'House Rent Allowance (HRA)', amount: hra },
      { name: 'Special & Other Allowances', amount: allowances },
      { name: 'Performance Bonus', amount: bonus },
      { name: 'Sales Incentives', amount: incentives },
    ].filter(e => e.amount > 0),
    deductionsBreakdown: [
      { name: 'Employees Provident Fund (EPF)', amount: pfDeduction },
      { name: 'Employees State Insurance (ESI)', amount: esiDeduction },
      { name: 'Professional Tax (PT)', amount: ptDeduction },
      { name: 'Tax Deducted at Source (TDS)', amount: tdsDeduction },
      { name: 'Other Deductions / Advances', amount: otherDeductions },
    ].filter(d => d.amount > 0),
    notes: lossOfPayDays > 0 ? `Pro-rated for ${lossOfPayDays} Loss of Pay (LOP) days.` : 'Full monthly attendance.',
  };

  return {
    workingDays, payableDays, lossOfPayDays, paidLeaveDays,
    basicSalary, hra, allowances, bonus, incentives,
    grossEarnings, pfDeduction, esiDeduction, ptDeduction,
    tdsDeduction, otherDeductions, totalDeductions, netSalary,
    calculationBreakdown,
  };
}
