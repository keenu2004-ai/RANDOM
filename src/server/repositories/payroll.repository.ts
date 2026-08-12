import { query, queryOne, beginTransaction } from '../db/client';
import { notificationService } from '../services/notification.service';
import { loadStatutoryRules, getMonthWorkingDays, getLopDays, calculatePayroll } from '../services/payroll-calculation.service';

export class PayrollRepository {
  private async getEmployeeSnapshot(orgId: string, empId: string) {
    const emp = await queryOne(`
      SELECT e.*, d.name as department_name, ds.title as designation_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations ds ON e.designation_id = ds.id
      WHERE e.organization_id = $1 AND e.id = $2
    `, [orgId, empId]);

    return {
      employeeName: emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown Employee',
      employeeCode: emp?.employee_code || null,
      departmentName: emp?.department_name || null,
      designationName: emp?.designation_name || null,
      // Sensitive financial identity — only expose if the column exists in the DB
      // Never invent fake PAN, UAN, PF, ESI, bank details
      bankName: emp?.bank_name || null,
      accountNumber: emp?.bank_account_number || null,
      ifscCode: emp?.bank_ifsc || null,
      panNumber: emp?.pan_number || null,
      uanNumber: emp?.uan_number || null,
      pfNumber: emp?.pf_number || null,
      esiNumber: emp?.esi_number || null,
    };
  }

  async getSalaryStructures(orgId: string, employeeId?: string) {
    let sql = `SELECT * FROM salary_structures WHERE organization_id = $1`;
    const params: any[] = [orgId];
    if (employeeId) {
      sql += ` AND employee_id = $2`;
      params.push(employeeId);
    }
    const rows = await query(sql, params);
    
    return Promise.all(rows.map(async r => {
      const snap = await this.getEmployeeSnapshot(orgId, r.employee_id);
      return {
        id: r.id,
        employeeId: r.employee_id,
        basicSalary: r.basic_salary,
        hra: r.hra,
        specialAllowance: r.special_allowance,
        medicalAllowance: r.medical_allowance,
        conveyanceAllowance: r.conveyance_allowance,
        otherAllowances: r.other_allowances,
        bonus: r.bonus,
        incentives: r.incentives,
        pfEmployee: r.pf_employee,
        pfEmployer: r.pf_employer,
        esiEmployee: r.esi_employee,
        esiEmployer: r.esi_employer,
        professionalTax: r.professional_tax,
        tds: r.tds,
        otherDeductions: r.other_deductions,
        grossSalary: r.gross_salary,
        netSalary: r.net_salary,
        effectiveDate: r.effective_date,
        employeeName: snap.employeeName,
        employeeCode: snap.employeeCode,
        departmentName: snap.departmentName
      };
    }));
  }

  async getSalaryStructureForEmployee(orgId: string, employeeId: string) {
    const structs = await this.getSalaryStructures(orgId, employeeId);
    if (structs.length > 0) return structs[0];
    // No salary structure configured — return null, caller handles 404
    return null;
  }

  async saveSalaryStructure(orgId: string, data: any) {
    const client = await beginTransaction();
    try {
      const emp = await client.queryOne(`SELECT * FROM employees WHERE organization_id = $1 AND id = $2`, [orgId, data.employeeId]);
      if (!emp) throw new Error('Employee not found.');

      const grossSalary = data.basicSalary + data.hra + data.specialAllowance + data.medicalAllowance + data.conveyanceAllowance + data.otherAllowances + data.bonus + data.incentives;

      // Load statutory rules INSIDE transaction
      const rules = await client.query(`SELECT * FROM statutory_rules WHERE organization_id = $1 AND active = TRUE`, [orgId]);
      const findRule = (cat: string) => rules.find((r: any) => r.category === cat);
      const pfRule = findRule('PF');
      const esiRule = findRule('ESI');
      const ptRule = findRule('PROFESSIONAL_TAX');
      const tdsRule = findRule('TDS');

      // CRITICAL: Do NOT invent statutory rates. If no rules are configured, reject with a clear error.
      if (!pfRule && !esiRule && !ptRule && !tdsRule) {
        const err: any = new Error('PAYROLL_CONFIGURATION_MISSING: Required statutory payroll configuration is missing for this organization. Please configure PF, ESI, PT, and TDS rules under Statutory Settings before processing salary structures.');
        err.statusCode = 422;
        err.code = 'PAYROLL_CONFIGURATION_MISSING';
        await client.rollback();
        throw err;
      }

      const pfRate = pfRule ? parseFloat(pfRule.rate_percentage) / 100 : 0;
      const pfCap = pfRule ? parseFloat(pfRule.fixed_amount || 1800) : 0;
      const pfEmployee = pfRule ? Math.min(pfCap, Math.round(data.basicSalary * pfRate * 100) / 100) : 0;

      const esiRate = esiRule ? parseFloat(esiRule.rate_percentage) / 100 : 0;
      const esiThreshold = esiRule ? parseFloat(esiRule.threshold_amount || 21000) : 0;
      const esiEmployee = (esiRule && grossSalary <= esiThreshold) ? Math.round(grossSalary * esiRate * 100) / 100 : 0;

      const ptThreshold = ptRule ? parseFloat(ptRule.threshold_amount || 25000) : 0;
      const professionalTax = (ptRule && grossSalary >= ptThreshold) ? parseFloat(ptRule.fixed_amount || 0) : 0;

      const tdsRate = tdsRule ? parseFloat(tdsRule.rate_percentage) / 100 : 0;
      const tdsThreshold = tdsRule ? parseFloat(tdsRule.threshold_amount || 100000) : 0;
      const tds = (tdsRule && grossSalary >= tdsThreshold) ? Math.round(grossSalary * tdsRate * 100) / 100 : 0;

      const totalDeductions = Math.round((pfEmployee + esiEmployee + professionalTax + tds + data.otherDeductions) * 100) / 100;
      const netSalary = Math.round((grossSalary - totalDeductions) * 100) / 100;

      await client.queryOne(`UPDATE employees SET base_salary_inr = $1, hra = $2, allowances = $3 WHERE organization_id = $4 AND id = $5`, 
        [data.basicSalary, data.hra, data.specialAllowance + data.medicalAllowance + data.conveyanceAllowance + data.otherAllowances, orgId, data.employeeId]);

      const existing = await client.queryOne(`SELECT id FROM salary_structures WHERE organization_id = $1 AND employee_id = $2`, [orgId, data.employeeId]);
      let struct;

      if (existing) {
        struct = await client.queryOne(`
          UPDATE salary_structures SET
            basic_salary = $1, hra = $2, special_allowance = $3, medical_allowance = $4, conveyance_allowance = $5,
            other_allowances = $6, bonus = $7, incentives = $8, pf_employee = $9, pf_employer = $10, esi_employee = $11,
            esi_employer = $12, professional_tax = $13, tds = $14, other_deductions = $15, gross_salary = $16, net_salary = $17, effective_date = $18, updated_at = NOW()
          WHERE organization_id = $19 AND id = $20 RETURNING *
        `, [
          data.basicSalary, data.hra, data.specialAllowance, data.medicalAllowance, data.conveyanceAllowance, data.otherAllowances,
          data.bonus, data.incentives, pfEmployee, pfEmployee, esiEmployee, Math.round(grossSalary * 0.0325), professionalTax, tds,
          data.otherDeductions, grossSalary, netSalary, data.effectiveDate, orgId, existing.id
        ]);
      } else {
        struct = await client.queryOne(`
          INSERT INTO salary_structures (
            organization_id, employee_id, basic_salary, hra, special_allowance, medical_allowance, conveyance_allowance, other_allowances,
            bonus, incentives, pf_employee, pf_employer, esi_employee, esi_employer, professional_tax, tds, other_deductions,
            gross_salary, net_salary, effective_date
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING *
        `, [
          orgId, data.employeeId, data.basicSalary, data.hra, data.specialAllowance, data.medicalAllowance, data.conveyanceAllowance, data.otherAllowances,
          data.bonus, data.incentives, pfEmployee, pfEmployee, esiEmployee, Math.round(grossSalary * 0.0325), professionalTax, tds,
          data.otherDeductions, grossSalary, netSalary, data.effectiveDate
        ]);
      }

      // Write history snapshot
      await client.queryOne(`
        INSERT INTO salary_structure_history (organization_id, employee_id, salary_structure_id, snapshot, effective_from)
        VALUES ($1, $2, $3, $4, $5)
      `, [orgId, data.employeeId, struct.id, JSON.stringify({
        basicSalary: data.basicSalary, hra: data.hra, specialAllowance: data.specialAllowance,
        medicalAllowance: data.medicalAllowance, conveyanceAllowance: data.conveyanceAllowance,
        otherAllowances: data.otherAllowances, bonus: data.bonus, incentives: data.incentives,
        grossSalary: grossSalary, netSalary: netSalary, pfEmployee: pfEmployee, esiEmployee: esiEmployee,
        professionalTax: professionalTax, tds: tds, otherDeductions: data.otherDeductions
      }), data.effectiveDate]);

      await client.commit();
      return {
        id: struct.id,
        employeeId: struct.employee_id,
        basicSalary: struct.basic_salary,
        hra: struct.hra,
        specialAllowance: struct.special_allowance,
        medicalAllowance: struct.medical_allowance,
        conveyanceAllowance: struct.conveyance_allowance,
        otherAllowances: struct.other_allowances,
        bonus: struct.bonus,
        incentives: struct.incentives,
        pfEmployee: struct.pf_employee,
        pfEmployer: struct.pf_employer,
        esiEmployee: struct.esi_employee,
        esiEmployer: struct.esi_employer,
        professionalTax: struct.professional_tax,
        tds: struct.tds,
        otherDeductions: struct.other_deductions,
        grossSalary: struct.gross_salary,
        netSalary: struct.net_salary,
        effectiveDate: struct.effective_date
      };
    } catch (err) {
      await client.rollback();
      throw err;
    }
  }

  async getStatutoryRules(orgId: string) {
    const rows = await query(`SELECT * FROM statutory_rules WHERE organization_id = $1`, [orgId]);
    return rows.map(r => ({
      id: r.id,
      ruleName: r.rule_name,
      category: r.category,
      state: r.state,
      ratePercentage: r.rate_percentage,
      fixedAmount: r.fixed_amount,
      thresholdAmount: r.threshold_amount,
      effectiveDate: r.effective_date,
      active: r.active,
      description: r.description
    }));
  }

  async createStatutoryRule(orgId: string, data: any) {
    const res = await queryOne(`
      INSERT INTO statutory_rules (organization_id, rule_name, category, state, rate_percentage, fixed_amount, threshold_amount, effective_date, active, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
    `, [
      orgId, data.ruleName, data.category, data.state || 'All India', data.ratePercentage || 0, data.fixedAmount, data.thresholdAmount || 0,
      data.effectiveDate || new Date().toISOString().split('T')[0], data.active !== false, data.description || ''
    ]);
    return {
      id: res.id,
      ruleName: res.rule_name,
      category: res.category,
      state: res.state,
      ratePercentage: res.rate_percentage,
      fixedAmount: res.fixed_amount,
      thresholdAmount: res.threshold_amount,
      effectiveDate: res.effective_date,
      active: res.active,
      description: res.description
    };
  }

  async updateStatutoryRule(orgId: string, id: string, data: any) {
    const existing = await queryOne(`SELECT * FROM statutory_rules WHERE organization_id = $1 AND id = $2`, [orgId, id]);
    if (!existing) throw new Error('Statutory rule not found.');

    const res = await queryOne(`
      UPDATE statutory_rules SET
        rule_name = COALESCE($1, rule_name),
        rate_percentage = COALESCE($2, rate_percentage),
        fixed_amount = COALESCE($3, fixed_amount),
        threshold_amount = COALESCE($4, threshold_amount),
        active = COALESCE($5, active),
        description = COALESCE($6, description)
      WHERE organization_id = $7 AND id = $8 RETURNING *
    `, [data.ruleName, data.ratePercentage, data.fixedAmount, data.thresholdAmount, data.active, data.description, orgId, id]);

    return {
      id: res.id,
      ruleName: res.rule_name,
      category: res.category,
      state: res.state,
      ratePercentage: res.rate_percentage,
      fixedAmount: res.fixed_amount,
      thresholdAmount: res.threshold_amount,
      effectiveDate: res.effective_date,
      active: res.active,
      description: res.description
    };
  }

  async getPayrollPeriods(orgId: string) {
    const rows = await query(`SELECT * FROM payroll_periods WHERE organization_id = $1 ORDER BY year DESC, month DESC`, [orgId]);
    return rows.map(r => ({
      id: r.id,
      month: r.month,
      year: r.year,
      name: r.name,
      status: r.status,
      totalEmployees: r.total_employees,
      totalGrossPayout: r.total_gross_payout,
      totalNetPayout: r.total_net_payout
    }));
  }

  async createPayrollPeriod(orgId: string, data: any) {
    const existing = await queryOne(`SELECT id FROM payroll_periods WHERE organization_id = $1 AND month = $2 AND year = $3`, [orgId, data.month, data.year]);
    if (existing) throw new Error(`Payroll period already exists.`);

    const emps = await queryOne(`SELECT COUNT(*) as count FROM employees WHERE organization_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL`, [orgId]);
    const totalEmps = parseInt(emps.count);

    const res = await queryOne(`
      INSERT INTO payroll_periods (organization_id, month, year, name, status, total_employees)
      VALUES ($1, $2, $3, $4, 'DRAFT', $5) RETURNING *
    `, [orgId, data.month, data.year, data.name, totalEmps]);

    return {
      id: res.id,
      month: res.month,
      year: res.year,
      name: res.name,
      status: res.status,
      totalEmployees: res.total_employees,
      totalGrossPayout: res.total_gross_payout,
      totalNetPayout: res.total_net_payout
    };
  }

  async getPayrollRecords(orgId: string, filters: any, userRole?: string, employeeId?: string) {
    const SORT_WHITELIST: Record<string, string> = {
      employeeId: 'pr.employee_id',
      grossEarnings: 'pr.gross_earnings',
      netSalary: 'pr.net_salary',
      status: 'pr.status',
      createdAt: 'pr.created_at',
    };
    const sortCol = SORT_WHITELIST[filters.sortBy] || 'pr.created_at';
    const sortDir = filters.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    const page = Math.max(1, parseInt(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit) || 20));
    const offset = (page - 1) * limit;

    let where = 'WHERE pr.organization_id = $1';
    const params: any[] = [orgId];
    let idx = 2;

    if (userRole === 'EMPLOYEE' && employeeId) {
      where += ` AND pr.employee_id = $${idx++}`;
      params.push(employeeId);
    } else if (userRole === 'MANAGER' && employeeId) {
      where += ` AND pr.employee_id IN (SELECT id FROM employees WHERE organization_id = $1 AND (manager_id = $${idx} OR id = $${idx}))`;
      params.push(employeeId);
      idx++;
    }

    if (filters.employeeId && userRole !== 'EMPLOYEE') { where += ` AND pr.employee_id = $${idx++}`; params.push(filters.employeeId); }
    if (filters.periodId) { where += ` AND pr.payroll_period_id = $${idx++}`; params.push(filters.periodId); }
    if (filters.status) { where += ` AND pr.status = $${idx++}`; params.push(filters.status); }

    const countRes = await queryOne(`SELECT COUNT(*) as total FROM payroll_records pr ${where}`, params);
    const total = parseInt(countRes?.total || '0');

    const rows = await query(`
      SELECT pr.*, e.first_name, e.last_name, e.employee_code, d.name as department_name, ds.title as designation_name
      FROM payroll_records pr
      JOIN employees e ON pr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations ds ON e.designation_id = ds.id
      ${where}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT $${idx++} OFFSET $${idx++}
    `, [...params, limit, offset]);

    const data = rows.map(r => ({
      id: r.id,
      payrollPeriodId: r.payroll_period_id,
      employeeId: r.employee_id,
      workingDays: r.working_days,
      presentDays: r.present_days,
      paidLeaveDays: r.paid_leave_days,
      lossOfPayDays: r.loss_of_pay_days,
      basicSalary: parseFloat(r.basic_salary),
      hra: parseFloat(r.hra),
      allowances: parseFloat(r.allowances),
      bonus: parseFloat(r.bonus || 0),
      incentives: parseFloat(r.incentives || 0),
      grossEarnings: parseFloat(r.gross_earnings),
      pfDeduction: parseFloat(r.pf_deduction),
      esiDeduction: parseFloat(r.esi_deduction),
      ptDeduction: parseFloat(r.pt_deduction),
      tdsDeduction: parseFloat(r.tds_deduction),
      otherDeductions: parseFloat(r.other_deductions),
      totalDeductions: parseFloat(r.total_deductions),
      netSalary: parseFloat(r.net_salary),
      status: r.status,
      calculationBreakdown: r.calculation_breakdown,
      paidAt: r.paid_at,
      createdAt: r.created_at,
      employeeName: `${r.first_name} ${r.last_name}`,
      employeeCode: r.employee_code,
      departmentName: r.department_name,
      designationName: r.designation_name,
    }));

    return { data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getPayrollRecordById(orgId: string, id: string) {
    const r = await queryOne(`SELECT * FROM payroll_records WHERE organization_id = $1 AND id = $2`, [orgId, id]);
    if (!r) return null;
    const snap = await this.getEmployeeSnapshot(orgId, r.employee_id);
    return {
      id: r.id,
      payrollPeriodId: r.payroll_period_id,
      employeeId: r.employee_id,
      workingDays: r.working_days,
      presentDays: r.present_days,
      paidLeaveDays: r.paid_leave_days,
      lossOfPayDays: r.loss_of_pay_days,
      basicSalary: r.basic_salary,
      hra: r.hra,
      allowances: r.allowances,
      bonus: r.bonus,
      incentives: r.incentives,
      grossEarnings: r.gross_earnings,
      pfDeduction: r.pf_deduction,
      esiDeduction: r.esi_deduction,
      ptDeduction: r.pt_deduction,
      tdsDeduction: r.tds_deduction,
      otherDeductions: r.other_deductions,
      totalDeductions: r.total_deductions,
      netSalary: r.net_salary,
      status: r.status,
      calculationBreakdown: r.calculation_breakdown,
      ...snap
    };
  }

  async processPayroll(orgId: string, month: number, year: number, periodId?: string) {
    const client = await beginTransaction();
    try {
      // Lock and validate the period
      let targetPeriodId = periodId;
      let period: any;

      if (targetPeriodId) {
        period = await client.queryOne(`SELECT * FROM payroll_periods WHERE organization_id = $1 AND id = $2 FOR UPDATE`, [orgId, targetPeriodId]);
        if (!period) throw new Error('Payroll period not found.');
        if (['FINALIZED', 'LOCKED', 'PAID'].includes(period.status)) {
          await client.rollback();
          const err: any = new Error(`Payroll period is ${period.status} and cannot be reprocessed.`);
          err.statusCode = 409;
          throw err;
        }
        // Check if records already exist for this period
        const existingCount = await client.queryOne(`SELECT COUNT(*) as c FROM payroll_records WHERE payroll_period_id = $1`, [targetPeriodId]);
        if (parseInt(existingCount.c) > 0 && !['DRAFT', 'PROCESSING'].includes(period.status)) {
          await client.rollback();
          const err: any = new Error(`Payroll period already has ${existingCount.c} processed records. Use re-run only on DRAFT periods.`);
          err.statusCode = 409;
          throw err;
        }
      } else {
        // Check for existing period for this month/year
        const existing = await client.queryOne(`SELECT * FROM payroll_periods WHERE organization_id = $1 AND month = $2 AND year = $3 FOR UPDATE`, [orgId, month, year]);
        if (existing && ['FINALIZED', 'LOCKED', 'PAID'].includes(existing.status)) {
          await client.rollback();
          const err: any = new Error(`Payroll for ${month}/${year} is already ${existing.status}.`);
          err.statusCode = 409;
          throw err;
        }
        const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        if (existing) {
          period = existing;
          targetPeriodId = existing.id;
          // Delete existing DRAFT records to allow re-calculation
          await client.query(`DELETE FROM payroll_records WHERE payroll_period_id = $1`, [targetPeriodId]);
        } else {
          period = await client.queryOne(`
            INSERT INTO payroll_periods (organization_id, month, year, name, status)
            VALUES ($1, $2, $3, $4, 'PROCESSING') RETURNING *
          `, [orgId, month, year, `${monthNames[month - 1]} ${year}`]);
          targetPeriodId = period.id;
        }
      }

      // Mark as PROCESSING
      await client.query(`UPDATE payroll_periods SET status = 'PROCESSING' WHERE id = $1`, [targetPeriodId]);

      const activeEmps = await client.query(`SELECT * FROM employees WHERE organization_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL`, [orgId]);
      if (activeEmps.length === 0) throw new Error('No active employees found to process payroll.');

      const rules = await loadStatutoryRules(orgId);

      let totalGross = 0;
      let totalNet = 0;
      
      const skippedEmployeesDetails: { employeeId: string; reason: string }[] = [];
      let processedEmployees = 0;

      for (const emp of activeEmps) {
        const struct = await client.queryOne(`SELECT * FROM salary_structures WHERE organization_id = $1 AND employee_id = $2`, [orgId, emp.id]);
        if (!struct) {
          skippedEmployeesDetails.push({ employeeId: emp.id, reason: 'MISSING_SALARY_STRUCTURE' });
          continue; // Skip employees without salary structure configured
        }

        const sal = {
          basicSalary: parseFloat(struct.basic_salary),
          hra: parseFloat(struct.hra),
          specialAllowance: parseFloat(struct.special_allowance),
          medicalAllowance: parseFloat(struct.medical_allowance || 0),
          conveyanceAllowance: parseFloat(struct.conveyance_allowance || 0),
          otherAllowances: parseFloat(struct.other_allowances || 0),
          bonus: parseFloat(struct.bonus || 0),
          incentives: parseFloat(struct.incentives || 0),
          otherDeductions: parseFloat(struct.other_deductions || 0),
        };

        // Get working days from CalendarService (not hardcoded 22)
        const workingDaysList = await getMonthWorkingDays(orgId, emp.id, year, month);
        const workingDays = workingDaysList.length;

        const { lopDays, paidLeaveDays } = await getLopDays(orgId, emp.id, year, month);
        const payableDays = Math.max(0, workingDays - lopDays);

        const result = calculatePayroll(sal, workingDays, payableDays, lopDays, paidLeaveDays, rules);

        // Get attendance present days count
        const monthStr = String(month).padStart(2, '0');
        const attRows = await client.query(`SELECT COUNT(*) as cnt FROM attendance WHERE organization_id = $1 AND employee_id = $2 AND date::text LIKE $3`, [orgId, emp.id, `${year}-${monthStr}%`]);
        const presentDays = parseInt(attRows[0]?.cnt || '0');

        totalGross += result.grossEarnings;
        totalNet += result.netSalary;

        await client.queryOne(`
          INSERT INTO payroll_records (
            organization_id, payroll_period_id, employee_id, working_days, present_days, paid_leave_days, loss_of_pay_days,
            basic_salary, hra, allowances, bonus, incentives, gross_earnings, pf_deduction, esi_deduction, pt_deduction,
            tds_deduction, other_deductions, total_deductions, net_salary, status, calculation_breakdown
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 'PROCESSED', $21)
          ON CONFLICT DO NOTHING
        `, [
          orgId, targetPeriodId, emp.id, workingDays, presentDays,
          paidLeaveDays, lopDays,
          result.basicSalary, result.hra, result.allowances, result.bonus, result.incentives,
          result.grossEarnings, result.pfDeduction, result.esiDeduction, result.ptDeduction,
          result.tdsDeduction, result.otherDeductions, result.totalDeductions, result.netSalary,
          JSON.stringify(result.calculationBreakdown),
        ]);
        processedEmployees++;
      }


      const updatedPeriod = await client.queryOne(`
        UPDATE payroll_periods SET status = 'FINALIZED', total_employees = $1, total_gross_payout = $2, total_net_payout = $3, processed_at = NOW(), finalized_at = NOW()
        WHERE organization_id = $4 AND id = $5 RETURNING *
      `, [activeEmps.length, Math.round(totalGross * 100) / 100, Math.round(totalNet * 100) / 100, orgId, targetPeriodId]);

      await client.commit();
      return {
        period: {
          id: updatedPeriod.id, name: updatedPeriod.name, month: updatedPeriod.month, year: updatedPeriod.year,
          status: updatedPeriod.status, totalEmployees: updatedPeriod.total_employees,
          totalGrossPayout: updatedPeriod.total_gross_payout, totalNetPayout: updatedPeriod.total_net_payout,
        },
        recordsCount: activeEmps.length,
        processedEmployees,
        skippedEmployees: skippedEmployeesDetails.length,
        skippedEmployeesDetails
      };
    } catch (e) {
      await client.rollback();
      throw e;
    }
  }

  async markPayrollPaid(orgId: string, id: string, userId: string) {
    const client = await beginTransaction();
    try {
      // Check existing status first with FOR UPDATE to prevent concurrent modifications
      const existing = await client.queryOne(`SELECT status, employee_id FROM payroll_records WHERE organization_id = $1 AND id = $2 FOR UPDATE`, [orgId, id]);
      if (!existing) {
        await client.rollback();
        return null;
      }
      if (existing.status === 'PAID') {
        await client.rollback();
        const err: any = new Error('Payroll record is already marked as PAID.');
        err.statusCode = 409;
        throw err;
      }
      const record = await client.queryOne(`UPDATE payroll_records SET status = 'PAID', paid_at = NOW(), paid_by = $1 WHERE organization_id = $2 AND id = $3 RETURNING *`, [userId, orgId, id]);
      if (!record) {
        await client.rollback();
        return null;
      }

      await client.commit();

      const user = await queryOne(`SELECT id FROM users WHERE organization_id = $1 AND employee_id = $2`, [orgId, record.employee_id]);
      if (user) {
        await notificationService.createNotification({
          organizationId: orgId,
          recipientEmployeeId: record.employee_id,
          notificationType: 'PAYROLL_PAID',
          title: 'Salary Credited',
          message: 'Your payroll has been processed and paid.',
          entityType: 'PAYROLL',
          entityId: record.id,
          priority: 'HIGH'
        }, client);
      }
      
      const snap = await this.getEmployeeSnapshot(orgId, record.employee_id);
      return {
        id: record.id,
        netSalary: record.net_salary,
        ...snap
      };
    } catch (e) {
      await client.rollback();
      throw e;
    }
  }

  async reprocessPayrollRecord(orgId: string, id: string) {
    const existing = await queryOne(`SELECT status FROM payroll_records WHERE organization_id = $1 AND id = $2`, [orgId, id]);
    if (!existing) return null;
    if (existing.status === 'PAID' || existing.status === 'FINALIZED') {
      const err: any = new Error(`Cannot reprocess a ${existing.status} payroll record. Only PROCESSED records can be reprocessed.`);
      err.statusCode = 409;
      throw err;
    }
    const record = await queryOne(`UPDATE payroll_records SET status = 'PROCESSED' WHERE organization_id = $1 AND id = $2 RETURNING *`, [orgId, id]);
    if (!record) return null;
    const snap = await this.getEmployeeSnapshot(orgId, record.employee_id);
    return {
      id: record.id,
      netSalary: record.net_salary,
      ...snap
    };
  }

  async createAdjustment(orgId: string, payload: any, reqEmpId: string) {
    if (!payload.amount || parseFloat(payload.amount) === 0) {
      throw new Error('Amount cannot be zero');
    }

    const res = await queryOne(`
      INSERT INTO payroll_adjustments (
        organization_id, employee_id, payroll_period_id, type, amount, reason, status, requested_by, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7, NOW(), NOW())
      RETURNING *
    `, [
      orgId,
      payload.employeeId,
      payload.payrollPeriodId,
      payload.type,
      payload.amount,
      payload.reason,
      reqEmpId
    ]);

    return {
      id: res.id,
      employeeId: res.employee_id,
      payrollPeriodId: res.payroll_period_id,
      type: res.type,
      amount: parseFloat(res.amount),
      reason: res.reason,
      status: res.status,
      requestedBy: res.requested_by,
      createdAt: res.created_at
    };
  }

  async getAdjustments(orgId: string, filters: any, role: string, reqEmpId?: string) {
    const page = Math.max(1, parseInt(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit) || 20));
    const offset = (page - 1) * limit;

    let where = 'WHERE pa.organization_id = $1';
    const params: any[] = [orgId];
    let idx = 2;

    if (role === 'EMPLOYEE' && reqEmpId) {
      where += ` AND pa.employee_id = $${idx++}`;
      params.push(reqEmpId);
    } else if (role === 'MANAGER' && reqEmpId) {
      where += ` AND pa.employee_id IN (SELECT id FROM employees WHERE organization_id = $1 AND (manager_id = $${idx} OR id = $${idx}))`;
      params.push(reqEmpId);
      idx++;
    }

    if (filters.employeeId && role !== 'EMPLOYEE') {
      where += ` AND pa.employee_id = $${idx++}`;
      params.push(filters.employeeId);
    }
    if (filters.payrollPeriodId) {
      where += ` AND pa.payroll_period_id = $${idx++}`;
      params.push(filters.payrollPeriodId);
    }
    if (filters.status) {
      where += ` AND pa.status = $${idx++}`;
      params.push(filters.status);
    }

    const countRes = await queryOne(`SELECT COUNT(*) as total FROM payroll_adjustments pa ${where}`, params);
    const total = parseInt(countRes?.total || '0');

    const rows = await query(`
      SELECT pa.*, 
             e.first_name, e.last_name, e.employee_code,
             re.first_name as req_first, re.last_name as req_last,
             ae.first_name as app_first, ae.last_name as app_last
      FROM payroll_adjustments pa
      JOIN employees e ON pa.employee_id = e.id
      LEFT JOIN employees re ON pa.requested_by = re.id
      LEFT JOIN employees ae ON pa.approved_by = ae.id
      ${where}
      ORDER BY pa.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `, [...params, limit, offset]);

    const data = rows.map(r => ({
      id: r.id,
      employeeId: r.employee_id,
      payrollPeriodId: r.payroll_period_id,
      type: r.type,
      amount: parseFloat(r.amount),
      reason: r.reason,
      status: r.status,
      requestedBy: r.requested_by,
      approvedBy: r.approved_by,
      rejectionReason: r.rejection_reason,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      employeeName: `${r.first_name} ${r.last_name}`,
      employeeCode: r.employee_code,
      requesterName: r.req_first ? `${r.req_first} ${r.req_last}` : null,
      approverName: r.app_first ? `${r.app_first} ${r.app_last}` : null,
    }));

    return { data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async approveAdjustment(orgId: string, reqId: string, reviewerEmpId: string, role: string) {
    const client = await beginTransaction();
    try {
      const adj = await client.queryOne(`
        SELECT * FROM payroll_adjustments 
        WHERE organization_id = $1 AND id = $2 FOR UPDATE
      `, [orgId, reqId]);

      if (!adj) {
        await client.rollback();
        throw new Error('Adjustment not found');
      }

      if (adj.status !== 'PENDING') {
        await client.rollback();
        throw new Error(`Cannot approve adjustment with status ${adj.status}`);
      }

      if (adj.requested_by === reviewerEmpId || adj.employee_id === reviewerEmpId) {
        await client.rollback();
        throw new Error('Cannot self-approve adjustment');
      }

      if (role === 'MANAGER') {
        const team = await client.query(`SELECT id FROM employees WHERE organization_id = $1 AND manager_id = $2`, [orgId, reviewerEmpId]);
        const teamIds = team.map((t: any) => t.id);
        if (!teamIds.includes(adj.employee_id)) {
          await client.rollback();
          throw new Error('Access Denied: You can only approve adjustments for your direct subordinates.');
        }
      }

      const updated = await client.queryOne(`
        UPDATE payroll_adjustments 
        SET status = 'APPROVED', approved_by = $1, updated_at = NOW()
        WHERE id = $2 RETURNING *
      `, [reviewerEmpId, reqId]);

      await notificationService.createNotification({
        organizationId: orgId,
        recipientEmployeeId: adj.employee_id,
        notificationType: 'PAYROLL_ADJUSTMENT_APPROVED',
        title: 'Payroll Adjustment Approved',
        message: `Your payroll adjustment for ${adj.amount} has been approved.`,
        entityType: 'PAYROLL_ADJUSTMENT',
        entityId: updated.id,
        priority: 'NORMAL'
      }, client);

      await client.commit();
      
      return {
        id: updated.id,
        status: updated.status,
        approvedBy: updated.approved_by,
      };
    } catch (e) {
      await client.rollback();
      throw e;
    }
  }

  async rejectAdjustment(orgId: string, reqId: string, reviewerEmpId: string, reason: string, role: string) {
    const client = await beginTransaction();
    try {
      const adj = await client.queryOne(`
        SELECT * FROM payroll_adjustments 
        WHERE organization_id = $1 AND id = $2 FOR UPDATE
      `, [orgId, reqId]);

      if (!adj) {
        await client.rollback();
        throw new Error('Adjustment not found');
      }

      if (adj.status !== 'PENDING') {
        await client.rollback();
        throw new Error(`Cannot reject adjustment with status ${adj.status}`);
      }

      if (adj.requested_by === reviewerEmpId || adj.employee_id === reviewerEmpId) {
        await client.rollback();
        throw new Error('Cannot self-reject adjustment');
      }

      if (role === 'MANAGER') {
        const team = await client.query(`SELECT id FROM employees WHERE organization_id = $1 AND manager_id = $2`, [orgId, reviewerEmpId]);
        const teamIds = team.map((t: any) => t.id);
        if (!teamIds.includes(adj.employee_id)) {
          await client.rollback();
          throw new Error('Access Denied: You can only reject adjustments for your direct subordinates.');
        }
      }

      const updated = await client.queryOne(`
        UPDATE payroll_adjustments 
        SET status = 'REJECTED', approved_by = $1, rejection_reason = $2, updated_at = NOW()
        WHERE id = $3 RETURNING *
      `, [reviewerEmpId, reason, reqId]);

      await notificationService.createNotification({
        organizationId: orgId,
        recipientEmployeeId: adj.employee_id,
        notificationType: 'PAYROLL_ADJUSTMENT_REJECTED',
        title: 'Payroll Adjustment Rejected',
        message: `Your payroll adjustment for ${adj.amount} has been rejected. Reason: ${reason}`,
        entityType: 'PAYROLL_ADJUSTMENT',
        entityId: updated.id,
        priority: 'NORMAL'
      }, client);

      await client.commit();

      return {
        id: updated.id,
        status: updated.status,
        approvedBy: updated.approved_by,
        rejectionReason: updated.rejection_reason,
      };
    } catch (e) {
      await client.rollback();
      throw e;
    }
  }
}

export const payrollRepository = new PayrollRepository();
