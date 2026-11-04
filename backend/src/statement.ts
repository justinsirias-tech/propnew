import { db } from './db';
import { LeaseContract, RentalPayment, PropertyUnit, Contact, UnitIssue } from './types';

export function generateLeaseMonths(startDateStr: string, endDateStr: string): string[] {
  if (!startDateStr || !endDateStr) return [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return [];
  }

  // Calculate exact total calendar months
  const yearDiff = end.getFullYear() - start.getFullYear();
  const monthDiff = end.getMonth() - start.getMonth();
  const totalRawMonths = yearDiff * 12 + monthDiff;

  // For a standard 1-year lease (e.g. 2026-10-01 to 2027-10-01), exactly 12 months (never M13)
  const totalMonths = totalRawMonths >= 12 ? 12 : Math.max(1, totalRawMonths + 1);

  const months: string[] = [];
  let curYear = start.getFullYear();
  let curMonth = start.getMonth() + 1; // 1-12

  for (let i = 0; i < totalMonths; i++) {
    const ym = `${curYear}-${String(curMonth).padStart(2, '0')}`;
    months.push(ym);
    curMonth++;
    if (curMonth > 12) {
      curMonth = 1;
      curYear++;
    }
  }

  return months;
}

export function syncLeaseMonthlySchedule(lease: LeaseContract) {
  const expectedMonths = generateLeaseMonths(lease.start_date, lease.end_date);
  if (expectedMonths.length === 0) return;

  const firstMonth = expectedMonths[0];
  const existingPayments = db
    .prepare('SELECT * FROM rental_payments WHERE lease_id = ? ORDER BY billing_month ASC')
    .all(lease.id) as RentalPayment[];

  // Clean up any duplicate entries for the same billing month
  const seenMonths = new Set<string>();
  const toDeleteIds: number[] = [];
  for (const p of existingPayments) {
    if (seenMonths.has(p.billing_month)) {
      toDeleteIds.push(p.id);
    } else {
      seenMonths.add(p.billing_month);
    }
  }

  // Clean up any entries beyond the 12-month lease period (e.g. M13)
  const expectedSet = new Set(expectedMonths);
  for (const p of existingPayments) {
    if (!expectedSet.has(p.billing_month)) {
      toDeleteIds.push(p.id);
    }
  }

  if (toDeleteIds.length > 0) {
    const placeholders = toDeleteIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM rental_payments WHERE id IN (${placeholders})`).run(...toDeleteIds);
  }

  const existingMap = new Map<string, RentalPayment>();
  const currentPayments = db
    .prepare('SELECT * FROM rental_payments WHERE lease_id = ?')
    .all(lease.id) as RentalPayment[];
  for (const p of currentPayments) {
    existingMap.set(p.billing_month, p);
  }

  const tnRent = Number(lease.monthly_rent) || 0;
  const hasSpread = Number(lease.has_rent_spread) === 1;
  const llRent = hasSpread && lease.landlord_monthly_rent ? Number(lease.landlord_monthly_rent) : tnRent;
  const spread = Math.max(0, tnRent - llRent);
  const mgmtFee = Math.round((llRent * (Number(lease.management_fee_percent) || 5.0)) / 100);

  const insertStmt = db.prepare(`
    INSERT INTO rental_payments (
      receipt_no, lease_id, unit_id, landlord_id, tenant_id,
      billing_month, due_date, paid_date, status,
      base_rent, landlord_base_rent, rent_spread_agency,
      tenant_extra_charges, tenant_charges_note,
      amount_collected_from_tenant, landlord_repair_deduction,
      other_landlord_expenses, expense_breakdown_note,
      net_payout_to_landlord, payment_method
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?,
      ?, ?,
      ?, ?
    )
  `);

  for (let idx = 0; idx < expectedMonths.length; idx++) {
    const ym = expectedMonths[idx];
    const isFirstMonth = idx === 0;
    const day = String(lease.payment_due_day || 5).padStart(2, '0');
    const dueDate = `${ym}-${day}`;

    if (!existingMap.has(ym)) {
      const receiptNo = `REC-${lease.contract_no}-${ym.replace('-', '')}`;

      if (isFirstMonth) {
        // Month 1: 100% agency broker commission retention -> landlord payout = 0
        insertStmt.run(
          receiptNo,
          lease.id,
          lease.unit_id,
          lease.landlord_id,
          lease.tenant_id,
          ym,
          dueDate,
          `${ym}-01`,
          'Paid & Settled',
          tnRent,
          llRent,
          spread,
          0.0,
          null,
          tnRent,
          0.0,
          llRent,
          '1st Month Rent retained as Agency Broker Commission upon lease signing',
          0.0,
          'Bank Transfer'
        );
      } else {
        // Ongoing months (M2 to M12): Standard monthly rent schedule
        insertStmt.run(
          receiptNo,
          lease.id,
          lease.unit_id,
          lease.landlord_id,
          lease.tenant_id,
          ym,
          dueDate,
          null,
          'Pending',
          tnRent,
          llRent,
          spread,
          0.0,
          null,
          tnRent,
          0.0,
          mgmtFee,
          `Monthly Management Fee (5% on LL Rate ฿${llRent.toLocaleString()})`,
          Math.max(0, llRent - mgmtFee),
          'Bank Transfer'
        );
      }
    } else {
      // Ensure Month 1 has commission retained rule enforced
      const p = existingMap.get(ym)!;
      if (isFirstMonth && (p.net_payout_to_landlord !== 0 || p.other_landlord_expenses !== llRent)) {
        db.prepare(`
          UPDATE rental_payments
          SET net_payout_to_landlord = 0.0,
              other_landlord_expenses = ?,
              expense_breakdown_note = '1st Month Rent retained as Agency Broker Commission upon lease signing',
              status = 'Paid & Settled'
          WHERE id = ?
        `).run(llRent, p.id);
      }
    }
  }
}

export function calculateLeaseStatement(leaseId: number) {
  const lease = db.prepare('SELECT * FROM lease_contracts WHERE id = ?').get(leaseId) as LeaseContract | undefined;
  if (!lease) {
    throw new Error('Lease contract not found');
  }

  syncLeaseMonthlySchedule(lease);

  const unit = db.prepare('SELECT * FROM property_units WHERE id = ?').get(lease.unit_id) as PropertyUnit | undefined;
  const landlord = db.prepare('SELECT * FROM contacts WHERE id = ?').get(lease.landlord_id) as Contact | undefined;
  const tenant = db.prepare('SELECT * FROM contacts WHERE id = ?').get(lease.tenant_id) as Contact | undefined;

  const rawPayments = db
    .prepare('SELECT * FROM rental_payments WHERE lease_id = ? ORDER BY billing_month ASC')
    .all(leaseId) as RentalPayment[];

  const expectedMonths = generateLeaseMonths(lease.start_date, lease.end_date);
  const firstMonth = expectedMonths[0] || null;

  // Chronologically sort payments matching contract month sequence
  const monthOrder = new Map(expectedMonths.map((m, idx) => [m, idx]));
  rawPayments.sort((a, b) => (monthOrder.get(a.billing_month) ?? 999) - (monthOrder.get(b.billing_month) ?? 999));

  // Enrich with joined names and 5% Withholding Tax
  const payments = rawPayments.map((p) => {
    const base = Number(p.base_rent) || 0;
    const llBase = p.landlord_base_rent != null ? Number(p.landlord_base_rent) : base;
    return {
      ...p,
      contract_no: lease.contract_no,
      unit_code: unit?.unit_code,
      project_name: unit?.project_name,
      landlord_name: landlord?.full_name,
      tenant_name: tenant?.full_name,
      withholding_tax_5_percent: Math.round(base * 0.05 * 100) / 100,
      landlord_withholding_tax_5_percent: Math.round(llBase * 0.05 * 100) / 100,
    };
  });

  const unitIssues = db
    .prepare('SELECT * FROM unit_issues WHERE unit_id = ? ORDER BY reported_date DESC')
    .all(lease.unit_id) as UnitIssue[];

  const paidPayments = payments.filter((p) =>
    ['Paid & Settled', 'Collected (Pending Payout)', 'Paid'].includes(p.status)
  );
  const writtenOffPayments = payments.filter((p) => p.status === 'Written Off');
  const pendingPayments = payments.filter((p) => !paidPayments.includes(p) && !writtenOffPayments.includes(p));
  const activeSchedulePayments = payments.filter((p) => p.status !== 'Written Off');

  const tnRent = Number(lease.monthly_rent) || 0;
  const hasSpread = Number(lease.has_rent_spread) === 1;
  const llRent = hasSpread && lease.landlord_monthly_rent ? Number(lease.landlord_monthly_rent) : tnRent;
  const tnDeposit = Number(lease.security_deposit) || 0;
  const llDeposit = lease.landlord_security_deposit != null ? Number(lease.landlord_security_deposit) : tnDeposit;
  const upfrontCommission = Number(lease.agent_commission) || llRent;

  // Tenant Metrics
  const totalBaseRent = paidPayments.reduce((acc, p) => acc + (p.base_rent || 0), 0);
  const totalTenantExtra = paidPayments.reduce((acc, p) => acc + (p.tenant_extra_charges || 0), 0);
  const totalCollectedFromTenant = paidPayments.reduce((acc, p) => acc + (p.amount_collected_from_tenant || 0), 0);
  const scheduledContractTotal = activeSchedulePayments.reduce((acc, p) => acc + (p.base_rent || 0), 0);
  const writtenOffTenantRent = writtenOffPayments.reduce((acc, p) => acc + (p.base_rent || 0), 0);
  const writtenOffLandlordRent = writtenOffPayments.reduce(
    (acc, p) => acc + Number(p.landlord_base_rent || p.base_rent || 0),
    0
  );

  // Landlord Metrics (11 months of ongoing rent, M1 covers broker commission)
  const contractTotalMonths = expectedMonths.length;
  const landlordPayoutMonthsCount = Math.max(0, contractTotalMonths - 1);
  const landlord11MonthsGrossRent = landlordPayoutMonthsCount * llRent;

  const totalLandlordGrossRent = paidPayments.reduce(
    (acc, p) => acc + Number(p.landlord_base_rent || p.base_rent || 0),
    0
  );
  const totalLandlordRepairs = paidPayments.reduce((acc, p) => acc + (p.landlord_repair_deduction || 0), 0);

  const mgmtPaidPayments = paidPayments.filter((p) => p.billing_month !== firstMonth);
  const agencyManagementFeesEarned = mgmtPaidPayments.reduce((acc, p) => acc + (p.other_landlord_expenses || 0), 0);

  const totalMonthlyNetPayouts = paidPayments.reduce((acc, p) => acc + (p.net_payout_to_landlord || 0), 0);
  const forfeitedDepositPayableToLandlord = lease.deposit_forfeited ? llDeposit : 0.0;
  const totalNetPayoutToLandlord = totalMonthlyNetPayouts + forfeitedDepositPayableToLandlord;

  // Agency Profit & Revenue Metrics
  const agencyRentSpreadEarned = paidPayments.reduce((acc, p) => acc + (Number(p.rent_spread_agency) || 0), 0);
  const agencyRepairChargesBilled = totalLandlordRepairs + totalTenantExtra;
  const agencyForfeitedDepositSpread = lease.deposit_forfeited ? Math.max(0, tnDeposit - llDeposit) : 0.0;
  const agencyTotalProfitEarned =
    upfrontCommission + agencyRentSpreadEarned + agencyManagementFeesEarned + agencyForfeitedDepositSpread;

  const activeMgmtPayments = activeSchedulePayments.filter((p) => p.billing_month !== firstMonth);
  const agencyProjectedFullProfit =
    upfrontCommission +
    activeSchedulePayments.reduce((acc, p) => acc + (Number(p.rent_spread_agency) || 0), 0) +
    activeMgmtPayments.reduce((acc, p) => acc + (Number(p.other_landlord_expenses) || 0), 0) +
    agencyForfeitedDepositSpread;

  // 5% Withholding Tax (WHT)
  const rentalWhtRate = 5.0;
  const monthlyRentalWhtTenant = Math.round(tnRent * 0.05 * 100) / 100;
  const monthlyRentalWhtLandlord = Math.round(llRent * 0.05 * 100) / 100;
  const totalPaidRentalWhtTenant = paidPayments.reduce(
    (acc, p) => acc + Math.round((p.base_rent || 0) * 0.05 * 100) / 100,
    0
  );
  const totalPaidRentalWhtLandlord = paidPayments.reduce((acc, p) => {
    const b = Number(p.landlord_base_rent != null ? p.landlord_base_rent : p.base_rent) || 0;
    return acc + Math.round(b * 0.05 * 100) / 100;
  }, 0);
  const projectedContractRentalWht = Math.round(contractTotalMonths * monthlyRentalWhtTenant * 100) / 100;
  const landlord11MonthsWht = Math.round(landlordPayoutMonthsCount * monthlyRentalWhtLandlord * 100) / 100;

  return {
    lease: {
      ...lease,
      unit_code: unit?.unit_code,
      project_name: unit?.project_name,
      landlord_name: landlord?.full_name,
      landlord_phone: landlord?.phone,
      landlord_bank_name: landlord?.bank_name,
      landlord_bank_account_no: landlord?.bank_account_no,
      tenant_name: tenant?.full_name,
      tenant_phone: tenant?.phone,
    },
    unit,
    landlord,
    tenant,
    payments,
    unit_issues: unitIssues,
    summary: {
      months_recorded: payments.length,
      contract_total_months: contractTotalMonths,
      landlord_payout_months_count: landlordPayoutMonthsCount,
      landlord_11_months_gross_rent: landlord11MonthsGrossRent,
      paid_months_count: paidPayments.length,
      pending_months_count: pendingPayments.length,
      written_off_months_count: writtenOffPayments.length,
      scheduled_contract_total: scheduledContractTotal,
      written_off_tenant_rent: writtenOffTenantRent,
      written_off_landlord_rent: writtenOffLandlordRent,
      rental_wht_rate: rentalWhtRate,
      monthly_rental_wht_tenant: monthlyRentalWhtTenant,
      monthly_rental_wht_landlord: monthlyRentalWhtLandlord,
      total_paid_rental_wht_tenant: totalPaidRentalWhtTenant,
      total_paid_rental_wht_landlord: totalPaidRentalWhtLandlord,
      projected_contract_rental_wht: projectedContractRentalWht,
      landlord_11_months_wht: landlord11MonthsWht,
      total_base_rent: totalBaseRent,
      total_tenant_extra_charges: totalTenantExtra,
      total_collected_from_tenant: totalCollectedFromTenant,
      security_deposit_held: tnDeposit,
      landlord_monthly_rent: llRent,
      landlord_security_deposit: llDeposit,
      total_landlord_gross_rent: totalLandlordGrossRent,
      upfront_commission_deducted: upfrontCommission,
      total_landlord_repair_deductions: totalLandlordRepairs,
      total_other_landlord_expenses: agencyManagementFeesEarned,
      total_landlord_expenses: totalLandlordRepairs + agencyManagementFeesEarned + upfrontCommission,
      total_monthly_net_payouts: totalMonthlyNetPayouts,
      forfeited_deposit_payable_to_landlord: forfeitedDepositPayableToLandlord,
      total_net_payout_to_landlord: totalNetPayoutToLandlord,
      monthly_rent_spread: Math.max(0, tnRent - llRent),
      agency_upfront_commission: upfrontCommission,
      agency_rent_spread_earned: agencyRentSpreadEarned,
      agency_management_fees_earned: agencyManagementFeesEarned,
      agency_repair_charges_billed: agencyRepairChargesBilled,
      agency_forfeited_deposit_spread: agencyForfeitedDepositSpread,
      agency_total_profit_earned: agencyTotalProfitEarned,
      agency_projected_full_profit: agencyProjectedFullProfit,
    },
  };
}
