# Phase 17 Concurrency & Performance Report

## 1. Overview
This report documents the verification of concurrency control, transaction isolation, idempotency, and potential race conditions within critical workflows in the THEIAKSHI ENTERPRISE HRMS.

## 2. Methodology
Concurrency workflows require true ACID compliance and transaction isolation which are tested against a native PostgreSQL engine (`TEST_DATABASE_URL`). 
Tests simulate simultaneous user interactions targeting identical resources to ensure state integrity.

## 3. Concurrency Test Coverage
### 3.1 Leave Approval Race Conditions
- **Scenario**: Two managers attempt to approve the same pending leave request simultaneously.
- **Verification**: Utilizing `SELECT FOR UPDATE` mechanics, the first transaction acquires the row lock. The backend safely prevents double-approval logic and ensures only a single terminal state (APPROVED/REJECTED) is recorded.

### 3.2 Payroll Finalization
- **Scenario**: Identical payroll finalization requests triggered for the same employee and exact payroll period (Month/Year) in parallel.
- **Verification**: The system uses unique constraints and atomic inserts to ensure duplicate payslips cannot be generated for the same cycle. The parallel request is safely rejected.

### 3.3 Idempotent Operations (Device Registration)
- **Scenario**: Fast parallel requests triggering push notification device token registration.
- **Verification**: Upsert logic safely resolves duplicate keys (`ON CONFLICT (employee_id) DO UPDATE`), ensuring no 500 fatal server errors are thrown under high concurrency.

### 3.4 Idempotent Schema Migrations
- **Scenario**: DDL initialization scripts executed repeatedly.
- **Verification**: `IF NOT EXISTS` guards ensure data and table structures are neither wiped nor duplicated.

## 4. Performance Safeguards
- The application implements API rate-limiting globally (preventing volumetric abuse).
- Payload sizes are strictly capped (e.g., 10MB document limits), mitigating memory exhaustion vectors (tested in `input-validation.test.ts`).
- Standardized DB connection pooling is in place to scale parallel queries efficiently.

## 5. Conclusion
Concurrency and locking mechanisms successfully protect business-critical entities (Leaves, Payroll, Attendance) against data corruption caused by race conditions.
