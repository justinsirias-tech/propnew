import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Receipt,
  UserCheck,
  Landmark,
  Wrench,
  Plus,
  Printer,
  CheckCircle2,
  Trash2,
  Edit3,
  ArrowDownRight,
  ArrowUpRight,
  Wallet,
  Sparkles,
  Calendar,
  UploadCloud,
  Image as ImageIcon,
  Eye,
  Clock,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Briefcase,
  Lock,
  Ban,
  RotateCcw,
  ClipboardPaste,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { api } from '../api';
import { LeaseStatementData, RentalPayment, UnitIssue } from '../types';
import {
  useEscapeKey,
  extractFilesFromClipboard,
  readClipboardFilesButton,
} from '../utils/clipboardAndEsc';
import { FormattedNumberInput } from './FormattedNumberInput';

interface LeaseStatementDrawerProps {
  leaseId: number | null;
  initialTab?: 'ledger' | 'agency_soa' | 'landlord_soa' | 'tenant_soa';
  onClose: () => void;
  onRefreshGlobal: () => void;
}

function formatMonthLabel(ym: string): string {
  if (!ym || !ym.includes('-')) return ym;
  const [y, m] = ym.split('-');
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const mIdx = parseInt(m, 10) - 1;
  return `${monthNames[mIdx] || m} ${y}`;
}

export const LeaseStatementDrawer: React.FC<LeaseStatementDrawerProps> = ({
  leaseId,
  initialTab = 'ledger',
  onClose,
  onRefreshGlobal,
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LeaseStatementData | null>(null);
  const [activeTab, setActiveTab] = useState<
    'ledger' | 'agency_soa' | 'landlord_soa' | 'tenant_soa'
  >(initialTab);
  const [isFullScreen, setIsFullScreen] = useState(true);

  // Contract Terms & Dual-Rate Quick-Setup State
  const [termsForm, setTermsForm] = useState({
    start_date: '',
    end_date: '',
    monthly_rent: 0,
    has_rent_spread: 0,
    landlord_monthly_rent: 0,
    security_deposit: 0,
    landlord_security_deposit: 0,
    agent_commission: 0,
    management_fee_percent: 5.0,
    payment_due_day: 5,
  });
  const [savingTerms, setSavingTerms] = useState(false);
  const [termsSavedBadge, setTermsSavedBadge] = useState(false);

  // Early Termination Modal State (Clause 5)
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [terminationDate, setTerminationDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [terminationNote, setTerminationNote] = useState(
    'Early termination by tenant — remaining pending months written off and security deposit forfeited.'
  );
  const [processingTermination, setProcessingTermination] = useState(false);

  // Quick Status / Row Slip Upload State
  const [updatingRowId, setUpdatingRowId] = useState<number | null>(null);
  const [uploadingSlipRowId, setUploadingSlipRowId] = useState<number | null>(null);
  const rowSlipInputRef = useRef<HTMLInputElement | null>(null);
  const [targetSlipPayment, setTargetSlipPayment] = useState<RentalPayment | null>(null);

  // Fullscreen Slip Lightbox Preview
  const [previewSlipPayment, setPreviewSlipPayment] = useState<RentalPayment | null>(null);

  // Particular Month Edit / Deduction & Extra Charge Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<RentalPayment | null>(null);
  const [editingMonthNumber, setEditingMonthNumber] = useState<number | null>(null);
  const [uploadingModalSlip, setUploadingModalSlip] = useState(false);
  const [isDraggingSlip, setIsDraggingSlip] = useState(false);
  const modalSlipInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState({
    receipt_no: '',
    billing_month: '2026-11',
    due_date: '2026-11-05',
    paid_date: '2026-11-04',
    status: 'Paid & Settled',
    base_rent: 0,
    landlord_base_rent: 0,
    rent_spread_agency: 0,
    tenant_extra_charges: 0,
    tenant_charges_note: '',
    amount_collected_from_tenant: 0,
    landlord_repair_deduction: 0,
    other_landlord_expenses: 0,
    expense_breakdown_note: '',
    net_payout_to_landlord: 0,
    payment_method: 'Bank Transfer',
    proof_document_url: '' as string | null,
  });

  const fetchStatement = async (id: number) => {
    setLoading(true);
    try {
      const res = await api.getLeaseStatement(id);
      setData(res);
      const llRent = res.lease.landlord_monthly_rent ?? res.lease.monthly_rent;
      const llDep = res.lease.landlord_security_deposit ?? res.lease.security_deposit;
      setTermsForm({
        start_date: res.lease.start_date,
        end_date: res.lease.end_date,
        monthly_rent: res.lease.monthly_rent,
        has_rent_spread: res.lease.has_rent_spread ?? (llRent < res.lease.monthly_rent ? 1 : 0),
        landlord_monthly_rent: llRent,
        security_deposit: res.lease.security_deposit,
        landlord_security_deposit: llDep,
        agent_commission: res.lease.agent_commission,
        management_fee_percent: res.lease.management_fee_percent ?? 5.0,
        payment_due_day: res.lease.payment_due_day || 5,
      });
    } catch (err) {
      console.error('Failed to load statement:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (leaseId) {
      setActiveTab(initialTab);
      fetchStatement(leaseId);
    } else {
      setData(null);
    }
  }, [leaseId, initialTab]);

  // Strictly chronological top-to-bottom payments list (never bottom-up)
  const sortedPayments = useMemo<RentalPayment[]>(() => {
    if (!data?.payments) return [];
    return [...data.payments].sort((a, b) => a.billing_month.localeCompare(b.billing_month));
  }, [data?.payments]);

  // Stack-aware ESC key handlers: close topmost modal/lightbox first, then main drawer
  useEscapeKey(() => onClose(), Boolean(leaseId));
  useEscapeKey(() => setShowTerminateModal(false), showTerminateModal);
  useEscapeKey(() => setShowPaymentModal(false), showPaymentModal);
  useEscapeKey(() => setPreviewSlipPayment(null), Boolean(previewSlipPayment));

  // Global Ctrl+V paste for Payment Slip when Month Payment Modal is open
  useEffect(() => {
    if (!showPaymentModal) return;
    const onPasteSlip = (e: ClipboardEvent) => {
      const files = extractFilesFromClipboard(e.clipboardData, true);
      if (files.length > 0) {
        e.preventDefault();
        handleModalSlipUpload(files);
      }
    };
    window.addEventListener('paste', onPasteSlip);
    return () => window.removeEventListener('paste', onPasteSlip);
  }, [showPaymentModal]);

  if (!leaseId) return null;

  // Save updated Contract Start/End Date, Dual-Rate Rent Spread, Security Deposit & Commission
  const handleSaveContractTerms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setSavingTerms(true);
    try {
      const hasSp = Number(termsForm.has_rent_spread) === 1 ? 1 : 0;
      const tnRent = Number(termsForm.monthly_rent);
      const llRent = hasSp ? Number(termsForm.landlord_monthly_rent) : tnRent;
      const tnDep = Number(termsForm.security_deposit);
      const llDep = hasSp ? Number(termsForm.landlord_security_deposit) : tnDep;

      await api.updateLeaseTerms(data.lease.id, {
        start_date: termsForm.start_date,
        end_date: termsForm.end_date,
        monthly_rent: tnRent,
        has_rent_spread: hasSp,
        landlord_monthly_rent: llRent,
        security_deposit: tnDep,
        landlord_security_deposit: llDep,
        agent_commission: Number(termsForm.agent_commission),
        management_fee_percent: Number(termsForm.management_fee_percent),
        payment_due_day: Number(termsForm.payment_due_day),
      });
      await fetchStatement(data.lease.id);
      onRefreshGlobal();
      setTermsSavedBadge(true);
      setTimeout(() => setTermsSavedBadge(false), 2500);
    } catch (err) {
      console.error('Failed to update contract terms:', err);
    } finally {
      setSavingTerms(false);
    }
  };

  // Early Termination & Write-Off Remaining Pending Rent + Forfeit Deposit (Clause 5)
  const handleConfirmEarlyTermination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setProcessingTermination(true);
    try {
      await api.earlyTerminateLease(data.lease.id, {
        early_termination_date: terminationDate,
        early_termination_note: terminationNote,
        forfeit_deposit: true,
      });
      setShowTerminateModal(false);
      await fetchStatement(data.lease.id);
      onRefreshGlobal();
    } catch (err) {
      console.error('Failed to terminate lease early:', err);
    } finally {
      setProcessingTermination(false);
    }
  };

  const handleRestoreTerminated = async () => {
    if (!data) return;
    setProcessingTermination(true);
    try {
      await api.restoreTerminatedLease(data.lease.id);
      await fetchStatement(data.lease.id);
      onRefreshGlobal();
    } catch (err) {
      console.error('Failed to restore terminated lease:', err);
    } finally {
      setProcessingTermination(false);
    }
  };

  // 1-Click Toggle / Change Payment Status directly on the Monthly Rental Schedule
  const handleQuickToggleStatus = async (p: RentalPayment, nextStatus?: string) => {
    if (!data) return;
    setUpdatingRowId(p.id);
    try {
      const targetStatus =
        nextStatus ||
        (p.status === 'Paid & Settled' ? 'Pending' : 'Paid & Settled');
      const todayStr = new Date().toISOString().split('T')[0];
      await api.quickUpdatePayment(p.id, {
        status: targetStatus,
        paid_date: targetStatus === 'Paid & Settled' ? p.paid_date || todayStr : null,
      });
      await fetchStatement(data.lease.id);
      onRefreshGlobal();
    } catch (err) {
      console.error('Failed to toggle payment status:', err);
    } finally {
      setUpdatingRowId(null);
    }
  };

  // 1-Click Upload Payment Slip (Image) directly for a specific month row
  const handleRowSlipFileChange = async (files: FileList | null) => {
    if (!files || files.length === 0 || !targetSlipPayment || !data) return;
    setUploadingSlipRowId(targetSlipPayment.id);
    try {
      const uploadRes = await api.uploadImages(files);
      const slipUrl = uploadRes.urls[0];
      if (slipUrl) {
        const todayStr = new Date().toISOString().split('T')[0];
        await api.quickUpdatePayment(targetSlipPayment.id, {
          proof_document_url: slipUrl,
          status:
            targetSlipPayment.status === 'Pending'
              ? 'Paid & Settled'
              : targetSlipPayment.status,
          paid_date: targetSlipPayment.paid_date || todayStr,
        });
        await fetchStatement(data.lease.id);
        onRefreshGlobal();
      }
    } catch (err) {
      console.error('Failed to upload payment slip:', err);
    } finally {
      setUploadingSlipRowId(null);
      setTargetSlipPayment(null);
    }
  };

  // Upload Payment Slip inside the Month Adjustment Modal
  const handleModalSlipUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setUploadingModalSlip(true);
    try {
      const uploadRes = await api.uploadImages(files);
      const slipUrl = uploadRes.urls[0];
      if (slipUrl) {
        const todayStr = new Date().toISOString().split('T')[0];
        setForm((prev) => ({
          ...prev,
          proof_document_url: slipUrl,
          status: prev.status === 'Pending' ? 'Paid & Settled' : prev.status,
          paid_date: prev.paid_date || todayStr,
        }));
      }
    } catch (err) {
      console.error('Failed to upload slip in modal:', err);
    } finally {
      setUploadingModalSlip(false);
    }
  };

  const openNewPayment = () => {
    if (!data) return;
    setEditingPayment(null);
    setEditingMonthNumber(null);
    const tnRent = data.lease.monthly_rent || 0;
    const llRent = data.lease.landlord_monthly_rent ?? tnRent;
    const mgmtPct = data.lease.management_fee_percent ?? 5.0;
    const mgmtFee = Math.round(llRent * (mgmtPct / 100.0));
    const nextIdx = (data.payments.length || 0) + 1;
    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonth = todayStr.slice(0, 7);

    setForm({
      receipt_no: `RCP-2026-110${nextIdx}`,
      billing_month: currentMonth,
      due_date: `${currentMonth}-0${Math.min(data.lease.payment_due_day || 5, 9)}`,
      paid_date: todayStr,
      status: 'Paid & Settled',
      base_rent: tnRent,
      landlord_base_rent: llRent,
      rent_spread_agency: Math.max(0, tnRent - llRent),
      tenant_extra_charges: 0,
      tenant_charges_note: '',
      amount_collected_from_tenant: tnRent,
      landlord_repair_deduction: 0,
      other_landlord_expenses: mgmtFee,
      expense_breakdown_note: `${mgmtPct}% Monthly Management Fee on ฿${llRent.toLocaleString()} (฿${mgmtFee.toLocaleString()})`,
      net_payout_to_landlord: llRent - mgmtFee,
      payment_method: 'Bank Transfer',
      proof_document_url: null,
    });
    setShowPaymentModal(true);
  };

  const openEditPayment = (p: RentalPayment, monthNum?: number) => {
    setEditingPayment(p);
    setEditingMonthNumber(monthNum || null);
    const llRent =
      p.landlord_base_rent ?? data?.lease.landlord_monthly_rent ?? p.base_rent;
    setForm({
      receipt_no: p.receipt_no,
      billing_month: p.billing_month,
      due_date: p.due_date,
      paid_date: p.paid_date || new Date().toISOString().split('T')[0],
      status: p.status,
      base_rent: p.base_rent,
      landlord_base_rent: llRent,
      rent_spread_agency: Math.max(0, p.base_rent - llRent),
      tenant_extra_charges: p.tenant_extra_charges,
      tenant_charges_note: p.tenant_charges_note || '',
      amount_collected_from_tenant: p.amount_collected_from_tenant,
      landlord_repair_deduction: p.landlord_repair_deduction,
      other_landlord_expenses: p.other_landlord_expenses,
      expense_breakdown_note: p.expense_breakdown_note || '',
      net_payout_to_landlord: p.net_payout_to_landlord,
      payment_method: p.payment_method,
      proof_document_url: p.proof_document_url || null,
    });
    setShowPaymentModal(true);
  };

  // Auto-recalculate totals when user changes numbers in the modal (using landlord_base_rent for Landlord Payout!)
  const updateFinancialField = (
    field:
      | 'base_rent'
      | 'landlord_base_rent'
      | 'tenant_extra_charges'
      | 'landlord_repair_deduction'
      | 'other_landlord_expenses',
    value: number
  ) => {
    const next = { ...form, [field]: value };
    next.rent_spread_agency = Math.max(
      0,
      Number(next.base_rent) - Number(next.landlord_base_rent)
    );
    next.amount_collected_from_tenant =
      Number(next.base_rent) + Number(next.tenant_extra_charges);
    next.net_payout_to_landlord =
      Number(next.landlord_base_rent) -
      Number(next.landlord_repair_deduction) -
      Number(next.other_landlord_expenses);
    setForm(next);
  };

  const applyIssueRepairCharge = (iss: UnitIssue) => {
    const cost = iss.actual_cost > 0 ? iss.actual_cost : iss.estimated_cost;
    if (iss.responsible_party === 'Tenant') {
      const nextExtra = Number(form.tenant_extra_charges) + cost;
      const nextNote = form.tenant_charges_note
        ? `${form.tenant_charges_note} + ${iss.ticket_no}: ${iss.title} (฿${cost.toLocaleString()})`
        : `${iss.ticket_no}: ${iss.title} (฿${cost.toLocaleString()})`;
      setForm({
        ...form,
        tenant_extra_charges: nextExtra,
        tenant_charges_note: nextNote,
        amount_collected_from_tenant: Number(form.base_rent) + nextExtra,
      });
    } else {
      const nextRepair = Number(form.landlord_repair_deduction) + cost;
      const nextNote = form.expense_breakdown_note
        ? `${iss.ticket_no}: ${iss.title} (฿${cost.toLocaleString()}) + ${form.expense_breakdown_note}`
        : `${iss.ticket_no}: ${iss.title} (฿${cost.toLocaleString()})`;
      setForm({
        ...form,
        landlord_repair_deduction: nextRepair,
        expense_breakdown_note: nextNote,
        net_payout_to_landlord:
          Number(form.landlord_base_rent) -
          nextRepair -
          Number(form.other_landlord_expenses),
      });
    }
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    const payload = {
      ...form,
      lease_id: data.lease.id,
      unit_id: data.lease.unit_id,
      landlord_id: data.lease.landlord_id,
      tenant_id: data.lease.tenant_id,
      base_rent: Number(form.base_rent),
      landlord_base_rent: Number(form.landlord_base_rent),
      rent_spread_agency: Math.max(
        0,
        Number(form.base_rent) - Number(form.landlord_base_rent)
      ),
      tenant_extra_charges: Number(form.tenant_extra_charges),
      amount_collected_from_tenant: Number(form.amount_collected_from_tenant),
      landlord_repair_deduction: Number(form.landlord_repair_deduction),
      other_landlord_expenses: Number(form.other_landlord_expenses),
      net_payout_to_landlord: Number(form.net_payout_to_landlord),
      paid_date:
        form.status === 'Pending' || form.status === 'Written Off'
          ? null
          : form.paid_date || null,
      proof_document_url: form.proof_document_url || null,
    };
    if (editingPayment) {
      await api.updatePayment(editingPayment.id, payload);
    } else {
      await api.createPayment(payload);
    }
    setShowPaymentModal(false);
    fetchStatement(data.lease.id);
    onRefreshGlobal();
  };

  const handleDeletePayment = async (id: number) => {
    if (!data) return;
    await api.deletePayment(id);
    fetchStatement(data.lease.id);
    onRefreshGlobal();
  };

  return (
    <div
      className={`fixed inset-0 z-50 ${
        isFullScreen ? 'flex' : 'flex justify-end'
      } bg-slate-900/60 backdrop-blur-xs transition-all`}
    >
      {/* Hidden File Input for 1-Click Row Slip Upload */}
      <input
        ref={rowSlipInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleRowSlipFileChange(e.target.files);
          e.target.value = '';
        }}
      />

      <div
        className={`relative ${
          isFullScreen ? 'w-full max-w-none' : 'w-full max-w-6xl'
        } bg-white h-full shadow-2xl flex flex-col overflow-hidden transition-all duration-150`}
      >
        {/* Top Header */}
        <div className="px-6 py-5 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="px-3.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-sm sm:text-base font-mono font-black whitespace-nowrap shrink-0 shadow-xs">
                {data?.lease.contract_no || 'Loading...'}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Monthly Rental Schedule & Confidential Statements
              </h2>
            </div>
            {data && (
              <p className="text-sm sm:text-base text-slate-300 mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span>Unit: <strong className="text-white font-bold">{data.lease.unit_code}</strong> ({data.lease.project_name})</span>
                <span className="text-slate-500 font-bold">•</span>
                <span>Landlord: <strong className="text-indigo-300 font-bold">{data.lease.landlord_name}</strong></span>
                <span className="text-slate-500 font-bold">•</span>
                <span>Tenant: <strong className="text-emerald-300 font-bold">{data.lease.tenant_name}</strong></span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {data && data.lease.status !== 'Terminated' && (
              <button
                type="button"
                onClick={() => setShowTerminateModal(true)}
                className="px-3.5 py-2 rounded-xl bg-rose-600/20 border border-rose-500/40 hover:bg-rose-600 text-rose-200 hover:text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 transition"
              >
                <Ban className="w-4 h-4" />
                Early Termination & Forfeit Deposit
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition"
              title={isFullScreen ? "Switch to Side Drawer" : "Fit Full Screen"}
            >
              {isFullScreen ? (
                <>
                  <Minimize2 className="w-4 h-4 text-emerald-400" />
                  <span>Drawer Mode</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4 text-indigo-300" />
                  <span>Fit Full Screen</span>
                </>
              )}
            </button>
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition"
            >
              <Printer className="w-4 h-4" />
              Print View
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close Drawer (ESC)"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {loading || !data ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
            Loading Monthly Rental Schedule & Confidential Statements of Account...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Early Termination Banner if Contract is Terminated */}
            {Boolean(data.lease.deposit_forfeited || data.lease.status === 'Terminated') && (
              <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-rose-900 font-extrabold text-sm">
                    <Ban className="w-4 h-4 text-rose-600" />
                    Early Termination Executed ({data.lease.early_termination_date || 'Terminated'})
                    — {data.summary.written_off_months_count} Pending Months Written Off
                  </div>
                  <p className="text-xs text-rose-800">
                    {data.lease.early_termination_note} • Tenant Deposit Forfeited:{' '}
                    <strong>฿{data.summary.security_deposit_held.toLocaleString()}</strong> •
                    Payable to Landlord (at Landlord Rate ฿
                    {data.summary.landlord_monthly_rent.toLocaleString()}/mo):{' '}
                    <strong>
                      ฿{data.summary.forfeited_deposit_payable_to_landlord.toLocaleString()}
                    </strong>
                    {data.summary.agency_forfeited_deposit_spread > 0 && (
                      <span>
                        {' '}
                        • Agency Deposit Spread:{' '}
                        <strong>
                          +฿{data.summary.agency_forfeited_deposit_spread.toLocaleString()}
                        </strong>
                      </span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={processingTermination}
                  onClick={handleRestoreTerminated}
                  className="px-3.5 py-2 rounded-xl bg-white border border-rose-300 text-rose-700 hover:bg-rose-100 text-xs font-bold flex items-center gap-1.5 shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restore Active Schedule
                </button>
              </div>
            )}

            {/* ================================================================= */}
            {/* SIGNED CONTRACT & DUAL-RATE RENT DIFFERENCE SETUP BAR             */}
            {/* ================================================================= */}
            <form
              onSubmit={handleSaveContractTerms}
              className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider">
                    Contract Term, Dual-Rate Rent Difference & Security Deposit Settings
                  </span>
                  <label className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white border border-indigo-300 text-indigo-800 text-[11px] font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Number(termsForm.has_rent_spread) === 1}
                      onChange={(e) => {
                        const enabled = e.target.checked ? 1 : 0;
                        const tnRent = Number(termsForm.monthly_rent) || 0;
                        const nextLlRent = enabled ? Math.round(tnRent * 0.9) : tnRent;
                        const depMonths =
                          tnRent > 0 ? Number(termsForm.security_deposit) / tnRent : 2;
                        setTermsForm({
                          ...termsForm,
                          has_rent_spread: enabled,
                          landlord_monthly_rent: nextLlRent,
                          landlord_security_deposit: Math.round(depMonths * nextLlRent),
                          agent_commission: nextLlRent,
                        });
                      }}
                      className="rounded text-indigo-600"
                    />
                    Enable Rent Difference (Agency Spread)
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  {termsSavedBadge && (
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Updated & Synced!
                    </span>
                  )}
                  <button
                    type="submit"
                    disabled={savingTerms}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${savingTerms ? 'animate-spin' : ''}`} />
                    {savingTerms ? 'Syncing...' : 'Save Settings & Sync Schedule'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={termsForm.start_date}
                    onChange={(e) => setTermsForm({ ...termsForm, start_date: e.target.value })}
                    className="w-full px-2 py-1.5 rounded-lg border border-indigo-200 bg-white font-semibold text-slate-900"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={termsForm.end_date}
                    onChange={(e) => setTermsForm({ ...termsForm, end_date: e.target.value })}
                    className="w-full px-2 py-1.5 rounded-lg border border-indigo-200 bg-white font-semibold text-slate-900"
                  />
                </div>
                <div>
                  <label className="font-semibold text-emerald-800 block mb-1">
                    Tenant Rent/Mo
                  </label>
                  <FormattedNumberInput
                    required
                    value={termsForm.monthly_rent}
                    maxDecimals={2}
                    onValueChange={(tnRent) => {
                      const hasSp = Number(termsForm.has_rent_spread) === 1;
                      const llRent = hasSp ? Number(termsForm.landlord_monthly_rent) : tnRent;
                      setTermsForm({
                        ...termsForm,
                        monthly_rent: tnRent,
                        landlord_monthly_rent: llRent,
                        security_deposit: tnRent * 2,
                        landlord_security_deposit: hasSp
                          ? Number(termsForm.landlord_security_deposit)
                          : tnRent * 2,
                        agent_commission: hasSp ? Number(termsForm.agent_commission) : tnRent,
                      });
                    }}
                    className="w-full px-2 py-1.5 rounded-lg border border-emerald-300 bg-white font-bold text-emerald-900"
                  />
                </div>
                <div>
                  <label className="font-semibold text-indigo-800 block mb-1">
                    Landlord Rent/Mo
                  </label>
                  <FormattedNumberInput
                    disabled={Number(termsForm.has_rent_spread) === 0}
                    value={
                      Number(termsForm.has_rent_spread) === 1
                        ? termsForm.landlord_monthly_rent
                        : termsForm.monthly_rent
                    }
                    maxDecimals={2}
                    onValueChange={(llRent) => {
                      const depMonths =
                        Number(termsForm.monthly_rent) > 0
                          ? Number(termsForm.security_deposit) / Number(termsForm.monthly_rent)
                          : 2;
                      setTermsForm({
                        ...termsForm,
                        landlord_monthly_rent: llRent,
                        landlord_security_deposit: Math.round(depMonths * llRent),
                        agent_commission: llRent,
                      });
                    }}
                    className="w-full px-2 py-1.5 rounded-lg border border-indigo-300 bg-white font-bold text-indigo-900 disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Tenant Deposit
                  </label>
                  <FormattedNumberInput
                    value={termsForm.security_deposit}
                    maxDecimals={2}
                    onValueChange={(val) =>
                      setTermsForm({ ...termsForm, security_deposit: val })
                    }
                    className="w-full px-2 py-1.5 rounded-lg border border-indigo-200 bg-white font-semibold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-indigo-800 block mb-1">
                    Landlord Deposit
                  </label>
                  <FormattedNumberInput
                    disabled={Number(termsForm.has_rent_spread) === 0}
                    value={
                      Number(termsForm.has_rent_spread) === 1
                        ? termsForm.landlord_security_deposit
                        : termsForm.security_deposit
                    }
                    maxDecimals={2}
                    onValueChange={(val) =>
                      setTermsForm({
                        ...termsForm,
                        landlord_security_deposit: val,
                      })
                    }
                    className="w-full px-2 py-1.5 rounded-lg border border-indigo-200 bg-white font-semibold text-indigo-900 disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Upfront Comm (LL)
                  </label>
                  <FormattedNumberInput
                    value={termsForm.agent_commission}
                    maxDecimals={2}
                    onValueChange={(val) =>
                      setTermsForm({ ...termsForm, agent_commission: val })
                    }
                    className="w-full px-2 py-1.5 rounded-lg border border-indigo-200 bg-white font-semibold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Mgmt % (on LL)
                  </label>
                  <FormattedNumberInput
                    value={termsForm.management_fee_percent}
                    maxDecimals={2}
                    onValueChange={(val) =>
                      setTermsForm({
                        ...termsForm,
                        management_fee_percent: val,
                      })
                    }
                    className="w-full px-2 py-1.5 rounded-lg border border-indigo-200 bg-white font-semibold"
                  />
                </div>
              </div>
            </form>

            {/* Top Executive Financial KPI Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <span>1. Tenant Collected (Actual)</span>
                  <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-xl font-extrabold text-slate-900 mt-1">
                  ฿{data.summary.total_collected_from_tenant.toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Rate: ฿{data.lease.monthly_rent.toLocaleString()}/mo • Dep: ฿
                  {data.summary.security_deposit_held.toLocaleString()}
                </p>
                <div className="mt-1 pt-1 border-t border-slate-200 text-[11px] text-amber-800 font-extrabold flex items-center justify-between">
                  <span>5% WHT from Rental:</span>
                  <span>-฿{(data.summary.total_paid_rental_wht_tenant ?? (data.summary.total_base_rent * 0.05)).toLocaleString()}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-indigo-950 text-white shadow-sm">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                  <span>2. Agency Profit Earned</span>
                  <Briefcase className="w-4 h-4 text-indigo-300" />
                </div>
                <div className="text-xl font-extrabold text-white mt-1">
                  ฿{data.summary.agency_total_profit_earned.toLocaleString()}
                </div>
                <p className="text-[11px] text-indigo-200 mt-0.5">
                  Spread: +฿{data.summary.monthly_rent_spread.toLocaleString()}/mo • Comm: ฿
                  {data.summary.agency_upfront_commission.toLocaleString()}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-rose-800">
                  <span>3. Landlord Deductions</span>
                  <ArrowDownRight className="w-4 h-4 text-rose-600" />
                </div>
                <div className="text-xl font-extrabold text-rose-700 mt-1">
                  - ฿{data.summary.total_landlord_expenses.toLocaleString()}
                </div>
                <p className="text-[11px] text-rose-700/80 mt-0.5">
                  Upfront Comm: ฿{data.summary.upfront_commission_deducted.toLocaleString()} + Mgmt
                  & Repairs
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-600 text-white shadow-sm">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-emerald-100">
                  <span>4. Landlord Net Balance</span>
                  <Wallet className="w-4 h-4 text-white" />
                </div>
                <div className="text-xl font-extrabold mt-1">
                  ฿{data.summary.total_net_payout_to_landlord.toLocaleString()}
                </div>
                <p className="text-[11px] text-emerald-100 mt-0.5">
                  Based on Landlord Rate ฿{data.summary.landlord_monthly_rent.toLocaleString()}/mo
                </p>
              </div>
            </div>

            {/* Sub-navigation Tabs (4 Tabs: Schedule, Agency Profit SOA, Landlord SOA, Tenant SOA) */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="inline-flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveTab('ledger')}
                  className={`px-4 py-2.5 rounded-xl text-sm font-extrabold transition flex items-center gap-2 ${
                    activeTab === 'ledger'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Receipt className="w-4.5 h-4.5" />
                  1. Monthly Schedule & Slips ({sortedPayments.length} Mos • 11 Rent Mos)
                </button>
                <button
                  onClick={() => setActiveTab('agency_soa')}
                  className={`px-4 py-2.5 rounded-xl text-sm font-extrabold transition flex items-center gap-2 ${
                    activeTab === 'agency_soa'
                      ? 'bg-indigo-950 text-white shadow-xs'
                      : 'bg-indigo-50 text-indigo-950 hover:bg-indigo-100 border border-indigo-200'
                  }`}
                >
                  <Briefcase className="w-4.5 h-4.5" />
                  2. Agency Profit Statement (Spread, Comm & Fees)
                </button>
                <button
                  onClick={() => setActiveTab('landlord_soa')}
                  className={`px-4 py-2.5 rounded-xl text-sm font-extrabold transition flex items-center gap-2 ${
                    activeTab === 'landlord_soa'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
                  }`}
                >
                  <Landmark className="w-4.5 h-4.5" />
                  3. Landlord SOA (11 Mos Rent @ ฿{data.summary.landlord_monthly_rent.toLocaleString()}
                  /mo)
                </button>
                <button
                  onClick={() => setActiveTab('tenant_soa')}
                  className={`px-4 py-2.5 rounded-xl text-sm font-extrabold transition flex items-center gap-2 ${
                    activeTab === 'tenant_soa'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  <UserCheck className="w-4.5 h-4.5" />
                  4. Tenant SOA (Based on ฿{data.lease.monthly_rent.toLocaleString()}/mo)
                </button>
              </div>

              <button
                onClick={openNewPayment}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-sm font-bold hover:bg-indigo-100 transition shrink-0"
              >
                <Plus className="w-4.5 h-4.5" />
                Add Custom Billing Entry
              </button>
            </div>

            {/* ================================================================= */}
            {/* TAB 1: INTERACTIVE MONTHLY RENTAL SCHEDULE, SLIP UPLOAD & DEDUCTIONS */}
            {/* ================================================================= */}
            {activeTab === 'ledger' && (
              <div className="space-y-5">
                {/* 12-Month Lease Term & M1 Commission Notice Banner */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-md border border-indigo-900/50">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="px-2.5 py-1 rounded-md bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 font-black text-xs tracking-wide uppercase">
                          Standard 12-Month Lease Structure
                        </span>
                        <span className="text-xs sm:text-sm text-emerald-400 font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> Strictly 12 Months (No M13)
                        </span>
                      </div>
                      <div className="text-base sm:text-lg font-black text-white">
                        Month 1 Advance Retained as Commission • Regular Rent Payments Start M2 Onwards
                      </div>
                      <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                        When signed, <strong className="text-indigo-300">Month 1 (M1)</strong> is paid in advance by the tenant and retained 100% as the Agency Broker Commission (Landlord Payout: ฿0.00). Regular monthly rent collections and payouts start from <strong className="text-emerald-300">M2 onwards</strong> (total of <strong className="text-emerald-300">11 months of rent</strong> to the landlord).
                      </p>
                    </div>

                    <div className="bg-white/10 px-5 py-3 rounded-xl border border-white/10 backdrop-blur-xs shrink-0 text-right">
                      <div className="text-xs uppercase font-bold text-slate-300">Landlord 11-Month Gross Rent</div>
                      <div className="text-xl sm:text-2xl font-black text-emerald-300 mt-0.5">
                        ฿{((data.summary.landlord_11_months_gross_rent || ((sortedPayments.length > 1 ? sortedPayments.length - 1 : 11) * (data.summary.landlord_monthly_rent || 0)))).toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-300 font-medium">
                        11 Mos @ ฿{(data.summary.landlord_monthly_rent || 0).toLocaleString()}/mo
                      </div>
                    </div>
                  </div>
                </div>

                {/* Interactive Visual Month Grid Strip */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-extrabold text-slate-900 text-sm">
                      Chronological Monthly Progress — Click any month to toggle{' '}
                      <span className="text-emerald-700">Paid</span> /{' '}
                      <span className="text-amber-700">Pending</span>, upload transfer slip, or edit
                      deductions:
                    </span>
                    <span className="text-xs font-bold text-slate-600">
                      Ordered Top-to-Bottom / Start to End ({sortedPayments.length} Months Total)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-12 gap-2.5">
                    {sortedPayments.map((p, idx) => {
                      const isPaid =
                        p.status === 'Paid & Settled' ||
                        p.status === 'Collected (Pending Payout)' ||
                        p.status === 'Paid';
                      const isWrittenOff = p.status === 'Written Off';
                      const hasDeductionOrExtra =
                        p.landlord_repair_deduction > 0 || p.tenant_extra_charges > 0;
                      return (
                        <div
                          key={p.id}
                          className={`rounded-xl border p-3 text-sm transition flex flex-col justify-between gap-2 ${
                            isWrittenOff
                              ? 'bg-slate-100 border-slate-300 opacity-65'
                              : isPaid
                              ? 'bg-emerald-50/90 border-emerald-300'
                              : p.status === 'Overdue'
                              ? 'bg-rose-50 border-rose-300'
                              : 'bg-white border-slate-200 hover:border-indigo-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-black text-slate-900 text-xs sm:text-[13px]">
                              {idx === 0 ? (
                                <span className="text-indigo-700 font-black">M1 • Advance Comm</span>
                              ) : (
                                `M${idx + 1} (Rent ${idx}/11)`
                              )}
                            </span>
                            <div className="flex items-center gap-1">
                              {p.proof_document_url && (
                                <span
                                  title="Payment Slip Uploaded"
                                  className="text-emerald-700 bg-emerald-100 p-1 rounded"
                                >
                                  <ImageIcon className="w-3.5 h-3.5" />
                                </span>
                              )}
                              {hasDeductionOrExtra && (
                                <span
                                  title="Has Repair Deduction or Extra Charge"
                                  className="text-amber-700 bg-amber-100 p-1 rounded"
                                >
                                  <Wrench className="w-3.5 h-3.5" />
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-xs text-slate-700 space-y-0.5">
                            <div className="font-bold text-slate-900">
                              {formatMonthLabel(p.billing_month)}
                            </div>
                            <div>
                              Tenant: <strong>฿{p.base_rent.toLocaleString()}</strong>
                            </div>
                            <div className="text-amber-800 font-bold text-[11px]">
                              5% WHT: <strong>-฿{((p.withholding_tax_5_percent ?? (p.base_rent * 0.05))).toLocaleString()}</strong>
                            </div>
                            <div className={idx === 0 ? "text-indigo-800 font-bold" : "text-emerald-800 font-bold"}>
                              {idx === 0 ? (
                                <span>LL Payout: <strong>฿0</strong> (Comm)</span>
                              ) : (
                                <span>LL Rate: <strong>฿{(p.landlord_base_rent || p.base_rent).toLocaleString()}</strong></span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 pt-1">
                            <button
                              type="button"
                              disabled={updatingRowId === p.id || isWrittenOff}
                              onClick={() => handleQuickToggleStatus(p)}
                              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-black text-center transition cursor-pointer ${
                                isWrittenOff
                                  ? 'bg-slate-300 text-slate-700 cursor-not-allowed'
                                  : isPaid
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                  : p.status === 'Overdue'
                                  ? 'bg-rose-600 text-white hover:bg-rose-700'
                                  : 'bg-slate-200 text-slate-700 hover:bg-emerald-600 hover:text-white'
                              }`}
                            >
                              {updatingRowId === p.id
                                ? '...'
                                : isWrittenOff
                                ? 'Written Off'
                                : isPaid
                                ? '✓ Paid'
                                : 'Mark Paid'}
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditPayment(p, idx + 1)}
                              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300"
                              title="Edit Deductions, Extra Charges & Slip for this month"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Detailed Monthly Rental Schedule Table */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-extrabold text-xs sm:text-[13px]">
                          <th className="py-4 px-3.5">Month / Due</th>
                          <th className="py-4 px-3.5">Status (Click)</th>
                          <th className="py-4 px-3.5">Payment Slip</th>
                          <th className="py-4 px-3.5 text-right">Tenant Paid</th>
                          <th className="py-4 px-3.5 text-right">
                            <div className="flex flex-col items-end">
                              <span className="text-amber-900">5% WHT (Tax)</span>
                              <span className="text-[10px] text-amber-700 normal-case font-bold">from collection</span>
                            </div>
                          </th>
                          <th className="py-4 px-3.5 text-right">Agency Spread</th>
                          <th className="py-4 px-3.5 text-right">Landlord Rate</th>
                          <th className="py-4 px-3.5 text-right">Deductions (LL)</th>
                          <th className="py-4 px-3.5 text-right">Net to Landlord</th>
                          <th className="py-4 px-3.5">Month Notes</th>
                          <th className="py-4 px-3.5 text-right">Adjust</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {sortedPayments.map((p, idx) => {
                          const isPaid =
                            p.status === 'Paid & Settled' ||
                            p.status === 'Collected (Pending Payout)' ||
                            p.status === 'Paid';
                          const isWrittenOff = p.status === 'Written Off';
                          const llBase = p.landlord_base_rent ?? p.base_rent;
                          const spread = p.rent_spread_agency ?? Math.max(0, p.base_rent - llBase);
                          const totalDeductions =
                            (p.landlord_repair_deduction || 0) + (p.other_landlord_expenses || 0);

                          const isM1 = idx === 0;
                          const isFirstRecurringMonth = idx === 1;

                          return (
                            <React.Fragment key={p.id}>
                              {isM1 && (
                                <tr className="bg-indigo-50/80 border-y border-indigo-200">
                                  <td colSpan={11} className="py-3 px-4 text-xs sm:text-sm font-black text-indigo-950 uppercase tracking-wider">
                                    <div className="flex items-center justify-between">
                                      <span className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-indigo-700" />
                                        Lease Signing & Upfront Commission Settlement (Month 1 Advance Rent Retained)
                                      </span>
                                      <span className="text-xs text-indigo-800 font-black">
                                        Landlord Payout: ฿0.00 • 100% Commission Retained
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              )}

                              {isFirstRecurringMonth && (
                                <tr className="bg-slate-100 border-y border-slate-300">
                                  <td colSpan={11} className="py-3 px-4 text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider">
                                    <div className="flex items-center justify-between">
                                      <span className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-emerald-700" />
                                        Ongoing Monthly Rent Payments (Starting from M2 Onwards — 11 Months of Landlord Rent)
                                      </span>
                                      <span className="text-xs text-slate-600 font-extrabold">
                                        11 Months (M2 through M12) • Top-to-Bottom Schedule
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              )}

                              <tr
                                className={`transition ${
                                  isWrittenOff
                                    ? 'bg-slate-100/80 text-slate-400'
                                    : isM1
                                    ? 'bg-indigo-50/20 hover:bg-indigo-50/40'
                                    : isPaid
                                    ? 'bg-emerald-50/20 hover:bg-emerald-50/40'
                                    : 'hover:bg-slate-50/80'
                                }`}
                              >
                                <td className="py-4 px-3.5">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`px-2 py-0.5 rounded font-black text-xs ${
                                        isM1
                                          ? 'bg-indigo-700 text-white'
                                          : 'bg-slate-900 text-white'
                                      }`}
                                    >
                                      {isM1 ? 'M1 • Advance' : `M${idx + 1}`}
                                    </span>
                                    <span className="font-black text-slate-900 text-sm sm:text-base">
                                      {formatMonthLabel(p.billing_month)}
                                    </span>
                                    {!isM1 && (
                                      <span className="text-xs text-slate-500 font-bold">
                                        (Rent {idx}/11)
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-500 font-medium mt-1">
                                    {isM1 ? 'Paid upon Lease Signing' : `Due: ${p.due_date}`}
                                  </div>
                                </td>

                                <td className="py-4 px-3.5">
                                  <div className="flex flex-col gap-1.5 items-start">
                                    <button
                                      type="button"
                                      disabled={updatingRowId === p.id || isWrittenOff}
                                      onClick={() => handleQuickToggleStatus(p)}
                                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-[13px] font-black transition cursor-pointer ${
                                        isWrittenOff
                                          ? 'bg-slate-300 text-slate-700'
                                          : isPaid
                                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                          : p.status === 'Overdue'
                                          ? 'bg-rose-600 text-white hover:bg-rose-700'
                                          : 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-emerald-600 hover:text-white'
                                      }`}
                                    >
                                      {updatingRowId === p.id ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : isPaid ? (
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                      ) : (
                                        <Clock className="w-3.5 h-3.5" />
                                      )}
                                      {isWrittenOff
                                        ? 'Written Off'
                                        : isPaid
                                        ? 'Paid & Settled'
                                        : 'Click to Pay'}
                                    </button>
                                    <select
                                      value={p.status}
                                      onChange={(e) => handleQuickToggleStatus(p, e.target.value)}
                                      className="px-2 py-1 rounded border border-slate-200 bg-white text-slate-700 text-xs font-bold"
                                    >
                                      <option value="Pending">Pending</option>
                                      <option value="Paid & Settled">Paid & Settled</option>
                                      <option value="Collected (Pending Payout)">
                                        Collected (Pending Payout)
                                      </option>
                                      <option value="Overdue">Overdue</option>
                                      <option value="Written Off">Written Off</option>
                                    </select>
                                  </div>
                                </td>

                                <td className="py-4 px-3.5">
                                  {p.proof_document_url ? (
                                    <div className="flex items-center gap-2.5">
                                      <button
                                        type="button"
                                        onClick={() => setPreviewSlipPayment(p)}
                                        className="relative group w-11 h-11 rounded-lg overflow-hidden border-2 border-emerald-400 shrink-0 bg-slate-100"
                                      >
                                        <img
                                          src={p.proof_document_url}
                                          alt="Slip"
                                          className="w-full h-full object-cover"
                                        />
                                      </button>
                                      <div className="flex flex-col">
                                        <button
                                          type="button"
                                          onClick={() => setPreviewSlipPayment(p)}
                                          className="text-xs sm:text-sm font-extrabold text-emerald-700 hover:underline text-left"
                                        >
                                          View Slip
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setTargetSlipPayment(p);
                                            rowSlipInputRef.current?.click();
                                          }}
                                          className="text-xs text-slate-500 hover:text-indigo-600 text-left font-medium"
                                        >
                                          Replace
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={uploadingSlipRowId === p.id || isWrittenOff}
                                      onClick={() => {
                                        setTargetSlipPayment(p);
                                        rowSlipInputRef.current?.click();
                                      }}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-700 text-xs sm:text-sm font-bold transition cursor-pointer disabled:opacity-40"
                                    >
                                      <UploadCloud className="w-3.5 h-3.5" />
                                      Upload Slip
                                    </button>
                                  )}
                                </td>

                                <td className="py-4 px-3.5 text-right">
                                  <div className="font-black text-slate-900 text-sm sm:text-base">
                                    ฿{p.amount_collected_from_tenant.toLocaleString()}
                                  </div>
                                  {p.tenant_extra_charges > 0 && (
                                    <div className="text-xs text-amber-700 font-bold mt-0.5">
                                      +฿{p.tenant_extra_charges.toLocaleString()} Extra
                                    </div>
                                  )}
                                </td>

                                <td className="py-4 px-3.5 text-right">
                                  <div className="font-extrabold text-amber-800 text-sm sm:text-base">
                                    -฿{((p.withholding_tax_5_percent ?? (p.base_rent * 0.05))).toLocaleString()}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                    5% WHT (50 Tawi)
                                  </div>
                                </td>

                                <td className="py-4 px-3.5 text-right">
                                  {spread > 0 && !isWrittenOff ? (
                                    <span className="px-2.5 py-1 rounded bg-indigo-100 text-indigo-900 font-extrabold text-xs sm:text-sm">
                                      +฿{spread.toLocaleString()}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-medium">฿0</span>
                                  )}
                                </td>

                                <td className="py-4 px-3.5 text-right font-black text-indigo-950 text-sm sm:text-base">
                                  {isWrittenOff ? '฿0' : `฿${llBase.toLocaleString()}`}
                                </td>

                                <td className="py-4 px-3.5 text-right">
                                  {totalDeductions > 0 && !isWrittenOff ? (
                                    <div>
                                      <div className="font-black text-rose-600 text-sm sm:text-base">
                                        -฿{totalDeductions.toLocaleString()}
                                      </div>
                                      <div className="text-xs text-slate-500 font-medium mt-0.5">
                                        {isM1 ? (
                                          <span className="text-indigo-700 font-black">100% Agency Comm</span>
                                        ) : (
                                          <>
                                            {p.landlord_repair_deduction > 0 &&
                                              `Rep: ฿${p.landlord_repair_deduction.toLocaleString()} `}
                                            {p.other_landlord_expenses > 0 &&
                                              `Mgmt: ฿${p.other_landlord_expenses.toLocaleString()}`}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 font-medium">฿0</span>
                                  )}
                                </td>

                                <td className="py-4 px-3.5 text-right">
                                  <span
                                    className={`px-3 py-1.5 rounded-lg font-black text-sm sm:text-base border ${
                                      isWrittenOff
                                        ? 'bg-slate-100 text-slate-400 border-slate-200'
                                        : isM1
                                        ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                        : isPaid
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                        : 'bg-slate-50 text-slate-800 border-slate-200'
                                    }`}
                                  >
                                    ฿{p.net_payout_to_landlord.toLocaleString()}
                                  </span>
                                  {isM1 && (
                                    <span className="text-[11px] text-indigo-700 block mt-1 font-black">
                                      Comm Settled
                                    </span>
                                  )}
                                </td>

                                <td className="py-4 px-3.5 max-w-[220px]">
                                  <p className="text-slate-700 text-xs sm:text-sm font-medium truncate">
                                    {p.expense_breakdown_note || 'Standard schedule'}
                                  </p>
                                  {p.tenant_charges_note && (
                                    <p className="text-amber-800 text-xs font-semibold mt-0.5 truncate">
                                      Tenant: {p.tenant_charges_note}
                                    </p>
                                  )}
                                </td>

                                <td className="py-4 px-3.5 text-right">
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => openEditPayment(p, idx + 1)}
                                      className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs sm:text-sm flex items-center gap-1"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                      Adjust
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeletePayment(p.id)}
                                      className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                                      title="Delete Billing Entry"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-900 text-sm">
                          <td className="py-4 px-3.5">
                            <div className="text-slate-900 text-sm sm:text-base font-black">Total: {sortedPayments.length} Months</div>
                            <div className="text-xs text-emerald-800 font-extrabold">Strictly 12 Months (No M13)</div>
                          </td>
                          <td className="py-4 px-3.5">
                            <span className="text-xs sm:text-sm font-black text-indigo-900">M1 Comm + 11 Rent Mos</span>
                          </td>
                          <td className="py-4 px-3.5"></td>
                          <td className="py-4 px-3.5 text-right font-black text-slate-900 text-sm sm:text-base">
                            ฿{sortedPayments.reduce((acc: number, p: RentalPayment) => acc + (p.amount_collected_from_tenant || 0), 0).toLocaleString()}
                          </td>
                          <td className="py-4 px-3.5 text-right font-black text-amber-800 text-sm sm:text-base">
                            -฿{sortedPayments.reduce((acc: number, p: RentalPayment) => acc + (p.withholding_tax_5_percent ?? (p.base_rent * 0.05)), 0).toLocaleString()}
                            <span className="block text-[10px] text-slate-500 font-bold">Total 5% WHT</span>
                          </td>
                          <td className="py-4 px-3.5 text-right text-indigo-700 font-black text-sm sm:text-base">
                            +฿{sortedPayments.reduce((acc: number, p: RentalPayment) => acc + (p.rent_spread_agency || 0), 0).toLocaleString()}
                          </td>
                          <td className="py-4 px-3.5 text-right text-indigo-950 font-black text-sm sm:text-base">
                            ฿{((data.summary.landlord_11_months_gross_rent || ((sortedPayments.length > 1 ? sortedPayments.length - 1 : 11) * (data.summary.landlord_monthly_rent || 0)))).toLocaleString()}
                          </td>
                          <td className="py-4 px-3.5 text-right text-rose-600 font-black text-sm sm:text-base">
                            -฿{sortedPayments.reduce((acc: number, p: RentalPayment) => acc + (p.landlord_repair_deduction || 0) + (p.other_landlord_expenses || 0), 0).toLocaleString()}
                          </td>
                          <td className="py-4 px-3.5 text-right text-emerald-700 font-black text-sm sm:text-base">
                            ฿{sortedPayments.reduce((acc: number, p: RentalPayment) => acc + (p.net_payout_to_landlord || 0), 0).toLocaleString()}
                          </td>
                          <td colSpan={2} className="py-4 px-3.5 text-xs sm:text-sm text-slate-600 font-bold">
                            11 Months Net Rent Payouts to Landlord
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* TAB 2: AGENCY PROFIT & REVENUE STATEMENT (CLAUSE 2 — INTERNAL)    */}
            {/* ================================================================= */}
            {activeTab === 'agency_soa' && (
              <div className="bg-white rounded-2xl border-2 border-indigo-900/20 p-6 shadow-xs space-y-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-200 pb-5">
                  <div>
                    <span className="px-2.5 py-1 rounded-md bg-indigo-950 text-indigo-200 text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5">
                      <Lock className="w-3 h-3" /> Internal Confidential — Agency Revenue & Profit
                      Statement
                    </span>
                    <h3 className="text-xl font-extrabold text-slate-900 mt-2">
                      Agency Contract Earnings: Rent Difference, Commission, Mgmt Fees & Repairs
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Contract: <strong>{data.lease.contract_no}</strong> • Unit:{' '}
                      <strong>
                        {data.lease.unit_code} ({data.lease.project_name})
                      </strong>{' '}
                      • Tenant Pays: <strong>฿{data.lease.monthly_rent.toLocaleString()}/mo</strong>{' '}
                      vs Landlord Notified:{' '}
                      <strong>฿{data.summary.landlord_monthly_rent.toLocaleString()}/mo</strong>
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs space-y-1 min-w-[270px]">
                    <div className="font-bold text-indigo-950">
                      Dual-Rate Contract Spread Configuration
                    </div>
                    <div className="text-slate-700">
                      Monthly Rent Difference:{' '}
                      <strong className="text-indigo-700">
                        + ฿{data.summary.monthly_rent_spread.toLocaleString()} / month
                      </strong>
                    </div>
                    <div className="text-slate-700">
                      Commission & Mgmt Fee Basis:{' '}
                      <strong>
                        ฿{data.summary.landlord_monthly_rent.toLocaleString()}/mo (Landlord Rate)
                      </strong>
                    </div>
                    <div className="text-slate-700">
                      Projected Full-Term Agency Profit:{' '}
                      <strong className="text-emerald-700">
                        ฿{data.summary.agency_projected_full_profit.toLocaleString()}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Agency Profit Breakdown Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 bg-slate-900 text-white p-6 rounded-2xl shadow-md">
                  <div>
                    <div className="text-xs sm:text-sm text-slate-300 uppercase font-black tracking-wider">
                      1. Upfront Commission
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-white mt-1">
                      + ฿{data.summary.agency_upfront_commission.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-300 font-medium mt-1">
                      Deducted in advance at signing
                    </div>
                  </div>

                  <div>
                    <div className="text-xs sm:text-sm text-indigo-300 uppercase font-black tracking-wider">
                      2. Rent Difference Earned
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-indigo-300 mt-1">
                      + ฿{data.summary.agency_rent_spread_earned.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-300 font-medium mt-1">
                      ฿{data.summary.monthly_rent_spread.toLocaleString()}/mo ×{' '}
                      {data.summary.paid_months_count} paid mos
                    </div>
                  </div>

                  <div>
                    <div className="text-xs sm:text-sm text-amber-300 uppercase font-black tracking-wider">
                      3. Mgmt Fees Earned
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-amber-300 mt-1">
                      + ฿{data.summary.agency_management_fees_earned.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-300 font-medium mt-1">
                      {data.lease.management_fee_percent ?? 5}% on ฿
                      {data.summary.landlord_monthly_rent.toLocaleString()}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs sm:text-sm text-rose-300 uppercase font-black tracking-wider">
                      4. Repairs & Deposit Spread
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-rose-300 mt-1">
                      ฿
                      {(
                        data.summary.agency_repair_charges_billed +
                        data.summary.agency_forfeited_deposit_spread
                      ).toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-300 font-medium mt-1">
                      Repairs: ฿{data.summary.agency_repair_charges_billed.toLocaleString()} • Dep
                      Spread: ฿{data.summary.agency_forfeited_deposit_spread.toLocaleString()}
                    </div>
                  </div>

                  <div className="lg:border-l lg:border-slate-700 lg:pl-5">
                    <div className="text-xs sm:text-sm text-emerald-300 uppercase font-black tracking-wider">
                      Total Agency Profit (Realized)
                    </div>
                    <div className="text-3xl sm:text-4xl font-black text-emerald-400 mt-1">
                      ฿{data.summary.agency_total_profit_earned.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-300 font-medium mt-1">
                      Full Contract Target: ฿
                      {data.summary.agency_projected_full_profit.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Month-by-Month Agency Earnings Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-200 text-slate-600 uppercase font-extrabold text-xs sm:text-[13px]">
                        <th className="py-4 px-3.5">Billing Month</th>
                        <th className="py-4 px-3.5">Status</th>
                        <th className="py-4 px-3.5 text-right">Collected from Tenant</th>
                        <th className="py-4 px-3.5 text-right">Landlord Base Rent</th>
                        <th className="py-4 px-3.5 text-right">Agency Rent Difference</th>
                        <th className="py-4 px-3.5 text-right">Agency Mgmt Fee</th>
                        <th className="py-4 px-3.5 text-right">Repair Charges Handled</th>
                        <th className="py-4 px-3.5 text-right">Monthly Agency Earnings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {sortedPayments.map((p, idx) => {
                        const isPaid =
                          p.status === 'Paid & Settled' ||
                          p.status === 'Collected (Pending Payout)' ||
                          p.status === 'Paid';
                        const isWrittenOff = p.status === 'Written Off';
                        const llBase = p.landlord_base_rent ?? p.base_rent;
                        const spread = isWrittenOff
                          ? 0
                          : p.rent_spread_agency ?? Math.max(0, p.base_rent - llBase);
                        const isM1 = idx === 0;
                        const comm = isM1 ? data.summary.agency_upfront_commission : 0;
                        const mgmt = isM1
                          ? 0
                          : isWrittenOff
                          ? 0
                          : p.other_landlord_expenses;
                        const repairs = isWrittenOff
                          ? 0
                          : p.landlord_repair_deduction + p.tenant_extra_charges;
                        const monthlyAgency = spread + comm + mgmt;

                        return (
                          <tr
                            key={p.id}
                            className={
                              isM1
                                ? 'bg-indigo-50/40 font-medium'
                                : isPaid
                                ? ''
                                : 'opacity-60 bg-slate-50/60'
                            }
                          >
                            <td className="py-3 px-3 font-bold text-slate-900">
                              {isM1 ? (
                                <div>
                                  <span className="px-1.5 py-0.5 rounded bg-indigo-700 text-white font-bold text-[10px] mr-1.5">
                                    M1 • Advance Rent
                                  </span>
                                  <span>{formatMonthLabel(p.billing_month)}</span>
                                </div>
                              ) : (
                                `M${idx + 1} • ${formatMonthLabel(p.billing_month)}`
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isM1
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : isPaid
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : isWrittenOff
                                    ? 'bg-slate-300 text-slate-700'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {isM1 ? '✓ Paid & Settled (Advance)' : p.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-medium">
                              ฿{p.amount_collected_from_tenant.toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-right text-slate-600">
                              {isWrittenOff ? '฿0' : `฿${llBase.toLocaleString()}`}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-indigo-700">
                              + ฿{spread.toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-right font-semibold">
                              {isM1 ? (
                                <span className="text-indigo-800 font-extrabold">
                                  + ฿{comm.toLocaleString()} (Commission)
                                </span>
                              ) : (
                                <span className="text-amber-700">
                                  + ฿{mgmt.toLocaleString()} (Mgmt Fee)
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right text-rose-600">
                              ฿{repairs.toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-right font-extrabold text-emerald-700">
                              + ฿{monthlyAgency.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}

                      {Boolean(data.lease.deposit_forfeited) && (
                        <tr className="bg-rose-50/70 font-bold">
                          <td className="py-3 px-3 text-rose-900">
                            Early Termination Deposit Forfeiture
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 text-[10px]">
                              Deposit Forfeited
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            ฿{data.summary.security_deposit_held.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right">
                            ฿{data.summary.forfeited_deposit_payable_to_landlord.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right text-indigo-700">
                            + ฿{data.summary.agency_forfeited_deposit_spread.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right">฿0</td>
                          <td className="py-3 px-3 text-right">฿0</td>
                          <td className="py-3 px-3 text-right text-emerald-700">
                            + ฿{data.summary.agency_forfeited_deposit_spread.toLocaleString()}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* TAB 3: LANDLORD STATEMENT OF ACCOUNT (CLAUSES 1, 3, 4, 5)         */}
            {/* STRICTLY ISOLATED: ONLY SHOWS LANDLORD RATE (e.g. 9,000/mo)       */}
            {/* ================================================================= */}
            {activeTab === 'landlord_soa' && (
              <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-xs space-y-6">
                {/* Statement Header */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-200 pb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-bold uppercase tracking-wider">
                        Official Landlord Statement of Account (SOA)
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                        Confidential Landlord Copy — Tenant Actual Rent Hidden
                      </span>
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-900 mt-2">
                      Landlord Rental Account, Upfront Commission & Monthly Deductions
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Contract: <strong>{data.lease.contract_no}</strong> • Unit:{' '}
                      <strong>
                        {data.lease.unit_code} ({data.lease.project_name})
                      </strong>{' '}
                      • Contracted Monthly Rent:{' '}
                      <strong>฿{data.summary.landlord_monthly_rent.toLocaleString()}/mo</strong> •
                      Security Deposit (Based on ฿
                      {data.summary.landlord_monthly_rent.toLocaleString()}/mo):{' '}
                      <strong>฿{data.summary.landlord_security_deposit.toLocaleString()}</strong>
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1 min-w-[260px]">
                    <div className="font-bold text-slate-800">
                      Landlord: {data.landlord?.full_name || data.lease.landlord_name}
                    </div>
                    <div className="text-slate-600">
                      Bank Name:{' '}
                      <strong>
                        {data.landlord?.bank_name ||
                          data.lease.landlord_bank_name ||
                          data.landlord?.bank_account_info ||
                          'N/A'}
                      </strong>
                    </div>
                    <div className="text-slate-600">
                      Account No.:{' '}
                      <strong className="font-mono text-indigo-700">
                        {data.landlord?.bank_account_no ||
                          data.lease.landlord_bank_account_no ||
                          'N/A'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Landlord P&L Summary Box (Strictly based on Landlord Rate e.g. 9,000/mo) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 bg-slate-900 text-white p-6 rounded-2xl shadow-md">
                  <div>
                    <div className="text-xs sm:text-sm text-slate-300 uppercase font-black tracking-wider">
                      11 Mos Rent Payout (M2–M12)
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-white mt-1">
                      ฿{((data.summary.landlord_11_months_gross_rent || ((sortedPayments.length > 1 ? sortedPayments.length - 1 : 11) * data.summary.landlord_monthly_rent))).toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-300 font-medium mt-1">
                      11 Mos @ ฿{data.summary.landlord_monthly_rent.toLocaleString()} • No M13
                    </div>
                  </div>

                  <div>
                    <div className="text-xs sm:text-sm text-amber-300 uppercase font-black tracking-wider">
                      5% Rental WHT (Tax)
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-amber-300 mt-1">
                      ฿{((data.summary.landlord_11_months_wht ?? (data.summary.paid_months_count * data.summary.landlord_monthly_rent * 0.05))).toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-300 font-medium mt-1">
                      5% Withheld (Form 50 Tawi)
                    </div>
                  </div>

                  <div>
                    <div className="text-xs sm:text-sm text-rose-300 uppercase font-black tracking-wider">
                      Less: M1 Broker Comm
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-rose-400 mt-1">
                      - ฿{data.summary.upfront_commission_deducted.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-300 font-medium mt-1">
                      100% Retained Advance Rent at Signing
                    </div>
                  </div>

                  <div>
                    <div className="text-xs sm:text-sm text-amber-300 uppercase font-black tracking-wider">
                      Less: Monthly Mgmt Fees
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-amber-300 mt-1">
                      - ฿{data.summary.total_other_landlord_expenses.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-300 font-medium mt-1">
                      Based on ฿{data.summary.landlord_monthly_rent.toLocaleString()}/mo
                    </div>
                  </div>

                  <div>
                    <div className="text-xs sm:text-sm text-rose-300 uppercase font-black tracking-wider">
                      Less: Repair Deductions
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-rose-400 mt-1">
                      - ฿{data.summary.total_landlord_repair_deductions.toLocaleString()}
                    </div>
                    {data.summary.forfeited_deposit_payable_to_landlord > 0 && (
                      <div className="text-xs text-emerald-300 font-bold mt-1">
                        + Forfeited Dep: ฿
                        {data.summary.forfeited_deposit_payable_to_landlord.toLocaleString()}
                      </div>
                    )}
                  </div>

                  <div className="lg:border-l lg:border-slate-700 lg:pl-5">
                    <div className="text-xs sm:text-sm text-emerald-300 uppercase font-black tracking-wider">
                      Net Landlord Profit Left
                    </div>
                    <div className="text-3xl sm:text-4xl font-black text-emerald-400 mt-1">
                      ฿{data.summary.total_net_payout_to_landlord.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-300 font-medium mt-1">
                      Landlord receives 11 mos of rent net
                    </div>
                  </div>
                </div>

                {/* Chronological Landlord Statement Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-200 text-slate-600 uppercase font-extrabold text-xs sm:text-[13px]">
                        <th className="py-4 px-3.5">Period / Event</th>
                        <th className="py-4 px-3.5">Status</th>
                        <th className="py-4 px-3.5">Deduction & Repair Particulars</th>
                        <th className="py-4 px-3.5 text-right">Monthly Rent</th>
                        <th className="py-4 px-3.5 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-amber-900">5% WHT (Tax)</span>
                            <span className="text-[10px] text-amber-700 normal-case font-bold">50 Tawi</span>
                          </div>
                        </th>
                        <th className="py-4 px-3.5 text-right">Upfront Comm / Mgmt</th>
                        <th className="py-4 px-3.5 text-right">Repair Charges</th>
                        <th className="py-4 px-3.5 text-right">Net to Landlord</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {sortedPayments.map((p, idx) => {
                        const isPaid =
                          p.status === 'Paid & Settled' ||
                          p.status === 'Collected (Pending Payout)' ||
                          p.status === 'Paid';
                        const isWrittenOff = p.status === 'Written Off';
                        const llRent = isWrittenOff
                          ? 0
                          : p.landlord_base_rent ?? data.summary.landlord_monthly_rent;
                        const isM1 = idx === 0;
                        const isFirstRecurringMonth = idx === 1;

                        return (
                          <React.Fragment key={p.id}>
                            {isM1 && (
                              <tr className="bg-indigo-50/70 border-y border-indigo-200">
                                <td colSpan={8} className="py-2 px-3 text-[11px] font-black text-indigo-950 uppercase tracking-wider">
                                  <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-700" />
                                      Lease Signing Advance Rent & Broker Commission (Month 1 Settled)
                                    </span>
                                    <span className="text-[10px] text-indigo-700 font-bold">
                                      Landlord Payout: ฿0.00 • Commission Retained
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            )}

                            {isFirstRecurringMonth && (
                              <tr className="bg-slate-100 border-y border-slate-300">
                                <td colSpan={8} className="py-2.5 px-3 text-[11px] font-black text-slate-800 uppercase tracking-wider">
                                  <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                      <Clock className="w-3.5 h-3.5 text-emerald-700" />
                                      Ongoing Monthly Rent Payments (Starting from M2 Onwards — 11 Months of Landlord Rent)
                                    </span>
                                    <span className="text-[10px] text-slate-600 font-bold">
                                      11 Months (M2 through M12) • Chronological Top-to-Bottom
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            )}

                            <tr
                              className={
                                isM1
                                  ? 'bg-indigo-50/30 font-medium'
                                  : isPaid
                                  ? ''
                                  : 'opacity-60 bg-slate-50/50'
                              }
                            >
                              <td className="py-3 px-3 font-bold text-slate-900">
                                {isM1 ? (
                                  <div>
                                    <span className="px-1.5 py-0.5 rounded bg-indigo-700 text-white font-bold text-[10px] mr-1.5">
                                      M1 • Advance Rent
                                    </span>
                                    <span>{formatMonthLabel(p.billing_month)}</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white font-bold text-[10px]">
                                      M{idx + 1}
                                    </span>
                                    <span>{formatMonthLabel(p.billing_month)}</span>
                                    <span className="text-[10px] text-slate-500 font-semibold">
                                      (Rent {idx}/11)
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isM1
                                      ? 'bg-indigo-100 text-indigo-800'
                                      : isPaid
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : isWrittenOff
                                      ? 'bg-slate-300 text-slate-700'
                                      : 'bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  {isM1 ? '✓ Paid (Advance Rent)' : p.status}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-slate-600">
                                {isM1
                                  ? '1st Month Rent retained as Agency Broker Commission upon lease signing'
                                  : p.expense_breakdown_note || 'Standard monthly settlement'}
                              </td>
                              <td className="py-3 px-3 text-right font-semibold text-slate-900">
                                ฿{llRent.toLocaleString()}
                              </td>
                              <td className="py-3 px-3 text-right font-bold text-amber-800">
                                {isWrittenOff ? '฿0' : `- ฿${((p.landlord_withholding_tax_5_percent ?? (llRent * 0.05))).toLocaleString()}`}
                                <span className="block text-[9px] text-slate-500 font-semibold">50 Tawi</span>
                              </td>
                              <td className="py-3 px-3 text-right font-bold text-rose-600">
                                {isM1 ? (
                                  `- ฿${(p.other_landlord_expenses || llRent).toLocaleString()}`
                                ) : p.other_landlord_expenses > 0 && !isWrittenOff ? (
                                  `- ฿${p.other_landlord_expenses.toLocaleString()}`
                                ) : (
                                  '฿0'
                                )}
                              </td>
                              <td className="py-3 px-3 text-right font-semibold text-rose-600">
                                {p.landlord_repair_deduction > 0 && !isWrittenOff
                                  ? `- ฿${p.landlord_repair_deduction.toLocaleString()}`
                                  : '฿0'}
                              </td>
                              <td className="py-3 px-3 text-right font-extrabold text-slate-900">
                                {isM1 ? (
                                  <div>
                                    <span className="text-slate-500">฿0</span>
                                    <span className="text-[10px] text-indigo-700 font-bold block">
                                      Comm Settled
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-emerald-700">
                                    ฿{p.net_payout_to_landlord.toLocaleString()}
                                  </span>
                                )}
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      })}

                      {/* Clause 5: Forfeited Security Deposit Payable to Landlord based on Landlord Rent */}
                      {Boolean(data.lease.deposit_forfeited) && (
                        <tr className="bg-emerald-50/80 font-bold">
                          <td className="py-3 px-3 text-emerald-950">
                            Early Termination Deposit Forfeiture (
                            {data.lease.early_termination_date})
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 text-[10px]">
                              Forfeited to Landlord
                            </span>
                          </td>
                          <td className="py-3 px-3 text-emerald-900">
                            Forfeited Security Deposit payable to Landlord (calculated on Landlord
                            Rate ฿{data.summary.landlord_monthly_rent.toLocaleString()}/mo)
                          </td>
                          <td className="py-3 px-3 text-right text-emerald-800">
                            + ฿
                            {data.summary.forfeited_deposit_payable_to_landlord.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right text-slate-400">฿0</td>
                          <td className="py-3 px-3 text-right">฿0</td>
                          <td className="py-3 px-3 text-right">฿0</td>
                          <td className="py-3 px-3 text-right font-extrabold text-emerald-700">
                            + ฿
                            {data.summary.forfeited_deposit_payable_to_landlord.toLocaleString()}
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-900 bg-slate-50 font-extrabold text-slate-900 text-xs">
                        <td colSpan={3} className="py-3.5 px-3 uppercase">
                          Total Settled Landlord Account ({data.summary.paid_months_count} Paid
                          Months)
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          ฿
                          {(
                            data.summary.total_landlord_gross_rent +
                            data.summary.forfeited_deposit_payable_to_landlord
                          ).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-3 text-right text-amber-800 font-bold">
                          - ฿{((data.summary.total_paid_rental_wht_landlord ?? (data.summary.total_landlord_gross_rent * 0.05))).toLocaleString()}
                          <span className="block text-[9px] text-slate-500 font-semibold">Total WHT</span>
                        </td>
                        <td className="py-3.5 px-3 text-right text-amber-700">
                          - ฿
                          {(
                            data.summary.upfront_commission_deducted +
                            data.summary.total_other_landlord_expenses
                          ).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-3 text-right text-rose-600">
                          - ฿{data.summary.total_landlord_repair_deductions.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-3 text-right text-emerald-700 text-sm">
                          ฿{data.summary.total_net_payout_to_landlord.toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* TAB 4: TENANT STATEMENT OF ACCOUNT (CLAUSES 1, 4, 5)              */}
            {/* STRICTLY ISOLATED: ONLY SHOWS TENANT RATE (e.g. 10,000/mo)        */}
            {/* ================================================================= */}
            {activeTab === 'tenant_soa' && (
              <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-xs space-y-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-200 pb-5">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-3 py-1 rounded-md bg-emerald-50 text-emerald-800 text-xs font-bold uppercase tracking-wider border border-emerald-200">
                        Official Tenant Statement of Account (SOA)
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                        Confidential Tenant Copy — Landlord Payout Hidden
                      </span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                      Tenant Monthly Rental Schedule, Slips & Extra Charges Statement
                    </h3>
                    <p className="text-sm text-slate-600 mt-1">
                      Contract: <strong className="text-slate-900 font-bold">{data.lease.contract_no}</strong> • Unit:{' '}
                      <strong className="text-slate-900 font-bold">
                        {data.lease.unit_code} ({data.lease.project_name})
                      </strong>{' '}
                      • Monthly Rent: <strong className="text-emerald-800 font-black">฿{data.lease.monthly_rent.toLocaleString()}/mo</strong>
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm space-y-1.5 min-w-[260px]">
                    <div className="font-extrabold text-slate-900">
                      Tenant: {data.tenant?.full_name || data.lease.tenant_name}
                    </div>
                    <div className="text-slate-600">
                      Phone: <strong className="text-slate-900">{data.tenant?.phone || data.lease.tenant_phone}</strong>
                    </div>
                    <div className="text-slate-600">
                      Security Deposit:{' '}
                      <strong
                        className={
                          data.lease.deposit_forfeited ? 'text-rose-600 font-black' : 'text-emerald-700 font-black'
                        }
                      >
                        ฿{data.summary.security_deposit_held.toLocaleString()}{' '}
                        {data.lease.deposit_forfeited ? '(FORFEITED — Early Termination)' : '(Held)'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Tenant Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                  <div>
                    <div className="text-xs sm:text-sm text-slate-600 uppercase font-black tracking-wider">
                      Paid Base Rent ({data.summary.paid_months_count} Mos)
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                      ฿{data.summary.total_base_rent.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm text-amber-700 uppercase font-black tracking-wider">
                      5% WHT Withheld
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-amber-700 mt-1">
                      - ฿{((data.summary.total_paid_rental_wht_tenant ?? (data.summary.total_base_rent * 0.05))).toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500 font-medium mt-0.5">
                      5% Withholding Tax Certificate
                    </div>
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm text-amber-700 uppercase font-black tracking-wider">
                      Tenant Repair / Extra Charges
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-amber-700 mt-1">
                      + ฿{data.summary.total_tenant_extra_charges.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm text-emerald-800 uppercase font-black tracking-wider">
                      Total Paid by Tenant
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-emerald-700 mt-1">
                      ฿{data.summary.total_collected_from_tenant.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm text-slate-600 uppercase font-black tracking-wider">
                      Security Deposit Status
                    </div>
                    <div
                      className={`text-2xl sm:text-3xl font-black mt-1 ${
                        data.lease.deposit_forfeited ? 'text-rose-600' : 'text-indigo-700'
                      }`}
                    >
                      ฿{data.summary.security_deposit_held.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500 font-medium mt-0.5">
                      {data.lease.deposit_forfeited ? '(Forfeited)' : ''}
                    </div>
                  </div>
                </div>

                {/* Chronological Tenant Statement Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-200 text-slate-600 uppercase font-extrabold text-xs sm:text-[13px]">
                        <th className="py-4 px-3.5">Billing Month</th>
                        <th className="py-4 px-3.5">Status & Paid Date</th>
                        <th className="py-4 px-3.5">Transfer Slip</th>
                        <th className="py-4 px-3.5">Description & Extra Charges</th>
                        <th className="py-4 px-3.5 text-right">Base Rent</th>
                        <th className="py-4 px-3.5 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-amber-900">5% WHT (Tax)</span>
                            <span className="text-[10px] text-amber-700 normal-case font-bold">50 Tawi</span>
                          </div>
                        </th>
                        <th className="py-4 px-3.5 text-right">Extra Charges</th>
                        <th className="py-4 px-3.5 text-right">Total Billed / Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {sortedPayments.map((p, idx) => {
                        const isPaid =
                          p.status === 'Paid & Settled' ||
                          p.status === 'Collected (Pending Payout)' ||
                          p.status === 'Paid';
                        const isWrittenOff = p.status === 'Written Off';
                        return (
                          <tr
                            key={p.id}
                            className={isPaid ? '' : 'opacity-65 bg-slate-50/40'}
                          >
                            <td className="py-3 px-3 font-bold text-slate-900">
                              {idx === 0 ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-700 text-white font-bold text-[10px]">
                                    M1 • Advance
                                  </span>
                                  <span>{formatMonthLabel(p.billing_month)}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white font-bold text-[10px]">
                                    M{idx + 1}
                                  </span>
                                  <span>{formatMonthLabel(p.billing_month)}</span>
                                  <span className="text-[10px] text-slate-500 font-semibold">
                                    (Rent {idx}/11)
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3 text-slate-600">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mr-1.5 ${
                                  isPaid
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : isWrittenOff
                                    ? 'bg-slate-300 text-slate-700'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {p.status}
                              </span>
                              {p.paid_date ? `(${p.paid_date})` : `(Due ${p.due_date})`}
                            </td>
                            <td className="py-3 px-3">
                              {p.proof_document_url ? (
                                <button
                                  type="button"
                                  onClick={() => setPreviewSlipPayment(p)}
                                  className="text-indigo-600 font-bold underline flex items-center gap-1"
                                >
                                  <ImageIcon className="w-3.5 h-3.5" /> View Slip
                                </button>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-slate-600">
                              {isWrittenOff
                                ? 'Written off due to Early Lease Termination'
                                : `Monthly Rent (${data.lease.unit_code})`}
                              {p.tenant_charges_note && (
                                <div className="text-amber-800 font-medium mt-0.5">
                                  + {p.tenant_charges_note}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right font-medium text-slate-900">
                              {isWrittenOff ? '฿0' : `฿${p.base_rent.toLocaleString()}`}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-amber-800">
                              {isWrittenOff ? '฿0' : `- ฿${((p.withholding_tax_5_percent ?? (p.base_rent * 0.05))).toLocaleString()}`}
                            </td>
                            <td className="py-3 px-3 text-right font-medium text-amber-700">
                              {p.tenant_extra_charges > 0 && !isWrittenOff
                                ? `+ ฿${p.tenant_extra_charges.toLocaleString()}`
                                : '฿0'}
                            </td>
                            <td className="py-3 px-3 text-right font-extrabold text-emerald-700">
                              ฿{p.amount_collected_from_tenant.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-900 bg-slate-50 font-extrabold text-slate-900 text-xs">
                        <td colSpan={4} className="py-3.5 px-3 uppercase">
                          Total Paid by Tenant ({data.summary.paid_months_count} Paid Months)
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          ฿{data.summary.total_base_rent.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-3 text-right font-black text-amber-800">
                          - ฿{((data.summary.total_paid_rental_wht_tenant ?? (data.summary.total_base_rent * 0.05))).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-3 text-right text-amber-700">
                          + ฿{data.summary.total_tenant_extra_charges.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-3 text-right text-emerald-700 text-sm">
                          ฿{data.summary.total_collected_from_tenant.toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* EARLY TERMINATION & DEPOSIT FORFEITURE MODAL (CLAUSE 5)           */}
        {/* ================================================================= */}
        {showTerminateModal && data && (
          <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-rose-700 font-bold text-base">
                  <Ban className="w-5 h-5" />
                  Early Termination, Write-Off & Deposit Forfeiture
                </div>
                <button
                  onClick={() => setShowTerminateModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs space-y-2 text-rose-950">
                <div className="font-bold">
                  Summary of Early Termination Actions ({data.lease.contract_no}):
                </div>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    All <strong>{data.summary.pending_months_count} remaining pending months</strong>{' '}
                    will be marked as <strong>Written Off (฿0)</strong>.
                  </li>
                  <li>
                    Tenant Security Deposit of{' '}
                    <strong>฿{data.summary.security_deposit_held.toLocaleString()}</strong> is
                    forfeited.
                  </li>
                  <li>
                    Landlord receives forfeited deposit based on Landlord Rate (฿
                    {data.summary.landlord_monthly_rent.toLocaleString()}/mo):{' '}
                    <strong className="text-emerald-800">
                      ฿{data.summary.landlord_security_deposit.toLocaleString()}
                    </strong>
                    .
                  </li>
                  {data.summary.security_deposit_held > data.summary.landlord_security_deposit && (
                    <li>
                      Agency retains the deposit difference:{' '}
                      <strong className="text-indigo-800">
                        + ฿
                        {(
                          data.summary.security_deposit_held -
                          data.summary.landlord_security_deposit
                        ).toLocaleString()}
                      </strong>
                      .
                    </li>
                  )}
                </ul>
              </div>

              <form onSubmit={handleConfirmEarlyTermination} className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Early Termination Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={terminationDate}
                    onChange={(e) => setTerminationDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Termination & Forfeiture Note
                  </label>
                  <textarea
                    rows={2}
                    value={terminationNote}
                    onChange={(e) => setTerminationNote(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowTerminateModal(false)}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={processingTermination}
                    className="px-4 py-2 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700"
                  >
                    {processingTermination
                      ? 'Processing...'
                      : 'Confirm Write-Off & Forfeit Deposit'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* PARTICULAR MONTH MODAL: STATUS, SLIP UPLOAD, DEDUCTIONS & EXTRA CHARGES */}
        {/* ================================================================= */}
        {showPaymentModal && data && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    {editingMonthNumber && (
                      <span className="px-2.5 py-0.5 rounded-md bg-indigo-600 text-white text-xs font-extrabold">
                        Month {editingMonthNumber}
                      </span>
                    )}
                    <h3 className="text-base font-bold text-slate-900">
                      {editingPayment
                        ? `${formatMonthLabel(form.billing_month)} — Status, Payment Slip & Deductions`
                        : `Record Monthly Rent & Expenses (${data.lease.contract_no})`}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Unit {data.lease.unit_code} • Tenant: {data.lease.tenant_name} • Landlord:{' '}
                    {data.lease.landlord_name}
                  </p>
                </div>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 1-Click Auto-Import Repair Charges from Unit Issues */}
              {data.unit_issues.length > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 space-y-2 text-xs">
                  <div className="font-bold text-amber-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    Quick-Import Repair Charges from Unit Issue History ({data.lease.unit_code})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {data.unit_issues.map((iss) => {
                      const cost = iss.actual_cost > 0 ? iss.actual_cost : iss.estimated_cost;
                      return (
                        <button
                          key={iss.id}
                          type="button"
                          onClick={() => applyIssueRepairCharge(iss)}
                          className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 text-slate-800 border border-amber-300 text-[11px] font-semibold transition flex items-center gap-1 shadow-2xs"
                        >
                          <Wrench className="w-3 h-3 text-amber-600" />
                          + {iss.ticket_no}: {iss.title.slice(0, 28)}... (฿{cost.toLocaleString()}{' '}
                          • {iss.responsible_party})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <form onSubmit={handleSavePayment} className="space-y-4 text-xs">
                {/* Quick Status Selector Pills inside Modal */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="font-bold text-slate-800">1. Monthly Payment Status:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Paid & Settled',
                      'Pending',
                      'Overdue',
                      'Collected (Pending Payout)',
                      'Written Off',
                    ].map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            status: st,
                            paid_date:
                              st === 'Paid & Settled' && !form.paid_date
                                ? new Date().toISOString().split('T')[0]
                                : form.paid_date,
                          })
                        }
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                          form.status === st
                            ? st === 'Paid & Settled'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : st === 'Overdue'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment Slip (Image) Upload & Preview Section */}
                <div className="p-4 rounded-xl bg-emerald-50/40 border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-emerald-600" />
                        2. Upload Monthly Payment Slip (Image)
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Drag & drop or click to upload the bank transfer slip / receipt image for{' '}
                        {formatMonthLabel(form.billing_month)}
                      </p>
                    </div>
                    {form.proof_document_url && (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, proof_document_url: null })}
                        className="text-[11px] font-semibold text-rose-600 hover:underline"
                      >
                        Remove Slip
                      </button>
                    )}
                  </div>

                  {form.proof_document_url ? (
                    <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-emerald-200">
                      <img
                        src={form.proof_document_url}
                        alt="Uploaded Payment Slip"
                        className="w-20 h-20 object-cover rounded-lg border border-slate-200"
                      />
                      <div className="space-y-1.5 flex-1">
                        <div className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Payment Slip Image Attached
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={form.proof_document_url}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px]"
                          >
                            Open Full Image
                          </a>
                          <button
                            type="button"
                            onClick={() => modalSlipInputRef.current?.click()}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[11px]"
                          >
                            Replace Image
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      tabIndex={0}
                      onPaste={(e) => {
                        const files = extractFilesFromClipboard(e.clipboardData, true);
                        if (files.length > 0) {
                          e.preventDefault();
                          e.stopPropagation();
                          handleModalSlipUpload(files);
                        }
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingSlip(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        setIsDraggingSlip(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingSlip(false);
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          handleModalSlipUpload(e.dataTransfer.files);
                        }
                      }}
                      onClick={() => modalSlipInputRef.current?.click()}
                      className={`cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                        isDraggingSlip
                          ? 'border-emerald-600 bg-emerald-50'
                          : 'border-emerald-300 bg-white hover:border-emerald-500'
                      }`}
                    >
                      {uploadingModalSlip ? (
                        <div className="flex items-center justify-center gap-2 text-emerald-700 font-bold py-1">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Uploading transfer slip image...
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <UploadCloud className="w-5 h-5 text-emerald-600" />
                          <span className="font-bold text-slate-800">
                            Drag & drop or Copy & Paste (Ctrl+V) transfer slip image here, or{' '}
                            <span className="text-emerald-700 underline">browse</span>
                          </span>
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  const files = await readClipboardFilesButton();
                                  if (files.length > 0) {
                                    await handleModalSlipUpload(files);
                                  }
                                } catch {
                                  // User can press Ctrl+V directly
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold hover:bg-emerald-100"
                            >
                              <ClipboardPaste className="w-3.5 h-3.5" />
                              Paste Slip from Clipboard (Ctrl+V)
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <input
                    ref={modalSlipInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleModalSlipUpload(e.target.files);
                        e.target.value = '';
                      }
                    }}
                  />
                </div>

                {/* Tenant Collection & Extra Charge Block */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="font-bold text-slate-800">
                    3. Tenant Rent & Extra Charges ({data.lease.tenant_name})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Tenant Base Rent (THB)
                      </label>
                      <FormattedNumberInput
                        value={form.base_rent}
                        maxDecimals={2}
                        onValueChange={(val) => updateFinancialField('base_rent', val)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-amber-800 block mb-1">
                        Extra Charge (Tenant)
                      </label>
                      <FormattedNumberInput
                        value={form.tenant_extra_charges}
                        maxDecimals={2}
                        onValueChange={(val) =>
                          updateFinancialField('tenant_extra_charges', val)
                        }
                        className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white font-semibold text-amber-900"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-emerald-800 block mb-1">
                        Total Collected (Tenant)
                      </label>
                      <FormattedNumberInput
                        value={form.amount_collected_from_tenant}
                        maxDecimals={2}
                        onValueChange={(val) =>
                          setForm({
                            ...form,
                            amount_collected_from_tenant: val,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50 font-extrabold text-emerald-900"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">
                      Extra Charge Information / Note for this Month (if any)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Tenant-caused repair, utility fee..."
                      value={form.tenant_charges_note}
                      onChange={(e) => setForm({ ...form, tenant_charges_note: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>

                {/* Landlord Deductions, Expenses & Net Profit Block (Based on Landlord Rate!) */}
                <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-indigo-950">
                      4. Landlord Account & Deductions ({data.lease.landlord_name})
                    </div>
                    <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold text-[11px]">
                      Agency Rent Spread: +฿{form.rent_spread_agency.toLocaleString()}/mo
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="font-semibold text-indigo-800 block mb-1">
                        Landlord Rent Rate
                      </label>
                      <FormattedNumberInput
                        value={form.landlord_base_rent}
                        maxDecimals={2}
                        onValueChange={(val) =>
                          updateFinancialField('landlord_base_rent', val)
                        }
                        className="w-full px-3 py-2 rounded-lg border border-indigo-300 bg-white font-bold text-indigo-900"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-rose-700 block mb-1">
                        Repair Deduction
                      </label>
                      <FormattedNumberInput
                        value={form.landlord_repair_deduction}
                        maxDecimals={2}
                        onValueChange={(val) =>
                          updateFinancialField('landlord_repair_deduction', val)
                        }
                        className="w-full px-3 py-2 rounded-lg border border-rose-300 bg-white font-semibold text-rose-700"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-amber-800 block mb-1">
                        Mgmt Fee (on LL)
                      </label>
                      <FormattedNumberInput
                        value={form.other_landlord_expenses}
                        maxDecimals={2}
                        onValueChange={(val) =>
                          updateFinancialField('other_landlord_expenses', val)
                        }
                        className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white font-semibold text-amber-800"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-emerald-800 block mb-1">
                        Net to Landlord
                      </label>
                      <FormattedNumberInput
                        value={form.net_payout_to_landlord}
                        maxDecimals={2}
                        allowNegative
                        onValueChange={(val) =>
                          setForm({ ...form, net_payout_to_landlord: val })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-emerald-400 bg-white font-extrabold text-emerald-800"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Deduction & Repair Information for this Month (Appears on Landlord SOA)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ISS-1002 AC Repair (฿3,800) + Monthly Management Fee"
                      value={form.expense_breakdown_note}
                      onChange={(e) => setForm({ ...form, expense_breakdown_note: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700"
                  >
                    Save Month & Update Statements
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* FULLSCREEN SLIP IMAGE LIGHTBOX MODAL                              */}
        {/* ================================================================= */}
        {previewSlipPayment && previewSlipPayment.proof_document_url && (
          <div
            onClick={() => setPreviewSlipPayment(null)}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl"
            >
              <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold">
                    Payment Slip — {formatMonthLabel(previewSlipPayment.billing_month)}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Receipt: {previewSlipPayment.receipt_no} • Paid:{' '}
                    {previewSlipPayment.paid_date || 'N/A'}
                  </div>
                </div>
                <button
                  onClick={() => setPreviewSlipPayment(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 bg-slate-100 flex items-center justify-center max-h-[75vh] overflow-auto">
                <img
                  src={previewSlipPayment.proof_document_url}
                  alt="Payment Slip Full View"
                  className="max-h-[68vh] w-auto rounded-lg shadow-md"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
