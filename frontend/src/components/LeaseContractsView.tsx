import React, { useState, useRef, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  Calendar,
  Clock,
  Edit3,
  X,
  Building2,
  UploadCloud,
  Paperclip,
  ExternalLink,
  Trash2,
  Receipt,
  Landmark,
  Wallet,
  Loader2,
  CheckCircle2,
  ClipboardPaste,
  TrendingUp,
  Users,
  ShieldCheck,
  LayoutList,
  LayoutGrid,
  Table as TableIcon,
  Phone,
  ArrowUpRight,
  Sparkles,
  AlertTriangle,
  Percent,
  Layers,
} from 'lucide-react';
import { api } from '../api';
import { LeaseContract, LeaseDocument, PropertyUnit, Contact } from '../types';
import { LeaseStatementDrawer } from './LeaseStatementDrawer';
import {
  useEscapeKey,
  extractFilesFromClipboard,
  readClipboardFilesButton,
} from '../utils/clipboardAndEsc';
import { FormattedNumberInput } from './FormattedNumberInput';

interface LeaseContractsViewProps {
  leases: LeaseContract[];
  units: PropertyUnit[];
  contacts: Contact[];
  onRefresh: () => void;
  onSelectUnit: (unitId: number) => void;
}

export const LeaseContractsView: React.FC<LeaseContractsViewProps> = ({
  leases,
  units,
  contacts,
  onRefresh,
  onSelectUnit,
}) => {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [spreadOnly, setSpreadOnly] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'executive' | 'grid' | 'table'>('executive');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingLease, setEditingLease] = useState<LeaseContract | null>(null);
  const [selectedStatementLeaseId, setSelectedStatementLeaseId] = useState<number | null>(null);
  const [selectedStatementTab, setSelectedStatementTab] = useState<
    'ledger' | 'agency_soa' | 'landlord_soa' | 'tenant_soa'
  >('ledger');

  const openStatementDrawer = (
    leaseId: number,
    tab: 'ledger' | 'agency_soa' | 'landlord_soa' | 'tenant_soa' = 'ledger'
  ) => {
    setSelectedStatementTab(tab);
    setSelectedStatementLeaseId(leaseId);
  };

  // Close lease modal on ESC key
  useEscapeKey(() => setShowModal(false), showModal);

  // Document Upload State inside Modal
  const [isDraggingDoc, setIsDraggingDoc] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docTypeSelection, setDocTypeSelection] = useState('Signed Contract');
  const docFileInputRef = useRef<HTMLInputElement | null>(null);

  const landlords = contacts.filter((c) => c.role === 'LANDLORD' || c.role === 'BOTH');
  const tenants = contacts.filter((c) => c.role === 'TENANT' || c.role === 'BOTH');

  const [form, setForm] = useState({
    contract_no: '',
    unit_id: '' as string | number,
    landlord_id: '' as string | number,
    tenant_id: '' as string | number,
    start_date: '',
    end_date: '',
    monthly_rent: 30000,
    has_rent_spread: 0,
    landlord_monthly_rent: 30000,
    security_deposit: 60000,
    landlord_security_deposit: 60000,
    advance_rent: 30000,
    payment_due_day: 5,
    agent_commission: 30000,
    management_fee_percent: 5.0,
    commission_deducted_upfront: 1,
    status: 'Active',
    inventory_checklist_signed: 'Yes',
    special_terms: '',
    documents: [] as LeaseDocument[],
  });

  // Portfolio-level KPI calculations
  const portfolioStats = useMemo(() => {
    const activeLeases = leases.filter(
      (l) => l.status === 'Active' || l.status === 'Expiring Soon'
    );
    const expiringCount = leases.filter(
      (l) => l.status === 'Expiring Soon' || (l.days_remaining !== null && l.days_remaining !== undefined && l.days_remaining <= 60 && l.days_remaining > 0)
    ).length;
    const spreadContractsCount = leases.filter((l) => Boolean(l.has_rent_spread)).length;

    const monthlyTenantRentRoll = activeLeases.reduce((acc, l) => acc + (l.monthly_rent || 0), 0);
    const monthlyLandlordBaseRoll = activeLeases.reduce(
      (acc, l) => acc + (l.landlord_monthly_rent ?? l.monthly_rent ?? 0),
      0
    );
    const monthlyRentSpread = activeLeases.reduce(
      (acc, l) => acc + (l.monthly_rent_spread || 0),
      0
    );

    const totalTenantCollected = leases.reduce(
      (acc, l) => acc + (l.total_collected_from_tenant || 0),
      0
    );
    const totalLandlordNet = leases.reduce(
      (acc, l) => acc + (l.total_net_landlord_profit || 0),
      0
    );
    const totalAgencyProfit = leases.reduce(
      (acc, l) => acc + (l.total_agency_profit || 0),
      0
    );

    const totalPaidMonths = leases.reduce((acc, l) => acc + (l.paid_months_count || 0), 0);
    const totalScheduledMonths = leases.reduce((acc, l) => acc + (l.payments_count || 0), 0);

    return {
      activeCount: activeLeases.length,
      expiringCount,
      spreadContractsCount,
      monthlyTenantRentRoll,
      monthlyLandlordBaseRoll,
      monthlyRentSpread,
      totalTenantCollected,
      totalLandlordNet,
      totalAgencyProfit,
      totalPaidMonths,
      totalScheduledMonths,
    };
  }, [leases]);

  const filtered = leases.filter((l) => {
    const matchStatus = statusFilter === 'ALL' || l.status === statusFilter;
    const matchSpread = !spreadOnly || Boolean(l.has_rent_spread);
    const q = search.toLowerCase();
    const matchText =
      l.contract_no.toLowerCase().includes(q) ||
      (l.unit_code || '').toLowerCase().includes(q) ||
      (l.project_name || '').toLowerCase().includes(q) ||
      (l.tenant_name || '').toLowerCase().includes(q) ||
      (l.landlord_name || '').toLowerCase().includes(q);
    return matchStatus && matchSpread && matchText;
  });

  const openNewLease = () => {
    setEditingLease(null);
    const today = new Date();
    const nextYear = new Date();
    nextYear.setFullYear(today.getFullYear() + 1);
    const firstUnit = units[0];
    const baseRent = firstUnit?.target_rent_price || 30000;
    setForm({
      contract_no: `LC-2026-0${leases.length + 20}`,
      unit_id: firstUnit?.id || '',
      landlord_id: firstUnit?.landlord_id || landlords[0]?.id || '',
      tenant_id: tenants[0]?.id || '',
      start_date: today.toISOString().split('T')[0],
      end_date: nextYear.toISOString().split('T')[0],
      monthly_rent: baseRent,
      has_rent_spread: 0,
      landlord_monthly_rent: baseRent,
      security_deposit: baseRent * 2,
      landlord_security_deposit: baseRent * 2,
      advance_rent: baseRent,
      payment_due_day: 5,
      agent_commission: baseRent,
      management_fee_percent: 5.0,
      commission_deducted_upfront: 1,
      status: 'Active',
      inventory_checklist_signed: 'Yes',
      special_terms: '',
      documents: [],
    });
    setShowModal(true);
  };

  const openEditLease = (l: LeaseContract) => {
    setEditingLease(l);
    const llRent = l.landlord_monthly_rent ?? l.monthly_rent;
    const llDep = l.landlord_security_deposit ?? l.security_deposit;
    setForm({
      contract_no: l.contract_no,
      unit_id: l.unit_id,
      landlord_id: l.landlord_id,
      tenant_id: l.tenant_id,
      start_date: l.start_date,
      end_date: l.end_date,
      monthly_rent: l.monthly_rent,
      has_rent_spread: l.has_rent_spread ?? (llRent < l.monthly_rent ? 1 : 0),
      landlord_monthly_rent: llRent,
      security_deposit: l.security_deposit,
      landlord_security_deposit: llDep,
      advance_rent: l.advance_rent,
      payment_due_day: l.payment_due_day,
      agent_commission: l.agent_commission,
      management_fee_percent: l.management_fee_percent ?? 5.0,
      commission_deducted_upfront: l.commission_deducted_upfront ?? 1,
      status: l.status,
      inventory_checklist_signed: l.inventory_checklist_signed,
      special_terms: l.special_terms || '',
      documents: l.documents || [],
    });
    setShowModal(true);
  };

  const handleUploadLeaseFiles = async (fileList: FileList | File[]) => {
    if (!fileList || fileList.length === 0) return;
    setUploadingDoc(true);
    try {
      const res = await api.uploadFiles(fileList);
      const tagged = res.files.map((f) => ({
        ...f,
        doc_type: docTypeSelection,
      }));
      setForm((prev) => ({
        ...prev,
        documents: [...prev.documents, ...tagged],
      }));
    } catch (err) {
      console.error('Failed to upload lease documents:', err);
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleRemoveDoc = (url: string) => {
    setForm((prev) => ({
      ...prev,
      documents: prev.documents.filter((d) => d.url !== url),
    }));
  };

  const saveContract = async (openScheduleAfter: boolean) => {
    const tnRent = Number(form.monthly_rent);
    const hasSpread = Number(form.has_rent_spread) === 1 ? 1 : 0;
    const llRent = hasSpread ? Number(form.landlord_monthly_rent) : tnRent;
    const tnDep = Number(form.security_deposit);
    const llDep = hasSpread ? Number(form.landlord_security_deposit) : tnDep;

    const payload = {
      ...form,
      unit_id: Number(form.unit_id),
      landlord_id: Number(form.landlord_id),
      tenant_id: Number(form.tenant_id),
      monthly_rent: tnRent,
      has_rent_spread: hasSpread,
      landlord_monthly_rent: llRent,
      security_deposit: tnDep,
      landlord_security_deposit: llDep,
      advance_rent: Number(form.advance_rent),
      payment_due_day: Number(form.payment_due_day),
      agent_commission: Number(form.agent_commission),
      management_fee_percent: Number(form.management_fee_percent),
      commission_deducted_upfront: Number(form.commission_deducted_upfront),
      document_url: form.documents[0]?.url || undefined,
    };
    let saved: LeaseContract;
    if (editingLease) {
      saved = await api.updateLease(editingLease.id, payload);
    } else {
      saved = await api.createLease(payload);
    }
    setShowModal(false);
    onRefresh();
    if (openScheduleAfter && saved?.id) {
      openStatementDrawer(saved.id, 'ledger');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveContract(false);
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Expiring Soon':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'Terminated':
      case 'Expired':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getLeftAccentColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'border-l-emerald-500';
      case 'Expiring Soon':
        return 'border-l-amber-500';
      case 'Terminated':
      case 'Expired':
        return 'border-l-rose-500';
      default:
        return 'border-l-slate-400';
    }
  };

  return (
    <div className="space-y-5">
      {/* Executive Portfolio & Dual-Rate Financial KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Monthly Rent Roll & Landlord Base */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Active Monthly Rent Roll
              </span>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">
                ฿{portfolioStats.monthlyTenantRentRoll.toLocaleString()}
                <span className="text-xs font-medium text-slate-400 ml-1">/mo</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Landlord Notified Base:</span>
            <span className="font-bold text-slate-700">
              ฿{portfolioStats.monthlyLandlordBaseRoll.toLocaleString()}/mo
            </span>
          </div>
        </div>

        {/* Card 2: Agency Total Profit & Monthly Rent Spread */}
        <div className="bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 rounded-2xl p-4 shadow-sm text-white flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Agency Total Profit
              </span>
              <div className="text-2xl font-extrabold text-white mt-1">
                ฿{portfolioStats.totalAgencyProfit.toLocaleString()}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-indigo-200 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-xs">
            <span className="text-indigo-200">
              Rent Spread ({portfolioStats.spreadContractsCount} contracts):
            </span>
            <span className="font-bold text-emerald-300">
              +฿{portfolioStats.monthlyRentSpread.toLocaleString()}/mo
            </span>
          </div>
        </div>

        {/* Card 3: Tenant Collected vs Landlord Net Account */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Total Collected (Tenants)
              </span>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">
                ฿{portfolioStats.totalTenantCollected.toLocaleString()}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Landlord Net Account:</span>
            <span
              className={`font-bold ${
                portfolioStats.totalLandlordNet >= 0 ? 'text-emerald-700' : 'text-rose-600'
              }`}
            >
              ฿{portfolioStats.totalLandlordNet.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Card 4: Schedule Settlement & Renewal Watch */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Installments Settled
              </span>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">
                {portfolioStats.totalPaidMonths}
                <span className="text-sm font-semibold text-slate-400">
                  {' '}
                  / {portfolioStats.totalScheduledMonths} Months
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Renewal Watch (≤60d):</span>
            <span
              className={`font-bold px-2 py-0.5 rounded-full ${
                portfolioStats.expiringCount > 0
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {portfolioStats.expiringCount} Expiring Soon
            </span>
          </div>
        </div>
      </div>

      {/* Filter, Search & Layout Control Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {['ALL', 'Active', 'Expiring Soon', 'Expired', 'Terminated', 'Draft'].map((st) => {
            const count =
              st === 'ALL' ? leases.length : leases.filter((l) => l.status === st).length;
            if (st !== 'ALL' && st !== 'Active' && st !== 'Expiring Soon' && count === 0) {
              return null;
            }
            return (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                <span>{st === 'ALL' ? 'All Contracts' : st}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                    statusFilter === st
                      ? 'bg-white/20 text-white'
                      : 'bg-white text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}

          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

          <button
            onClick={() => setSpreadOnly(!spreadOnly)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
              spreadOnly
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Filter contracts with confidential monthly rent spread between Tenant & Landlord"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>Dual-Rate Spread Only</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search contract, unit, tenant, landlord..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          {/* Layout View Switcher */}
          <div className="inline-flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200/80">
            <button
              onClick={() => setLayoutMode('executive')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                layoutMode === 'executive'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Structured Executive Row Layout"
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Cards</span>
            </button>
            <button
              onClick={() => setLayoutMode('grid')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                layoutMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="2-Column Compact Grid Layout"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Grid</span>
            </button>
            <button
              onClick={() => setLayoutMode('table')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                layoutMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="High-Density Financial Table View"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Table</span>
            </button>
          </div>

          <button
            onClick={openNewLease}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            New Lease Contract
          </button>
        </div>
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <div className="text-sm font-bold text-slate-800">No matching lease contracts found</div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Try adjusting your search query, status filter, or create a new lease contract.
          </p>
        </div>
      )}

      {/* VIEW MODE 1 & 2: EXECUTIVE STRUCTURED CARDS / 2-COLUMN GRID */}
      {layoutMode !== 'table' && filtered.length > 0 && (
        <div
          className={
            layoutMode === 'grid'
              ? 'grid grid-cols-1 xl:grid-cols-2 gap-4'
              : 'space-y-4'
          }
        >
          {filtered.map((l) => {
            const paidCount = l.paid_months_count ?? 0;
            const totalMonths = l.payments_count || 12;
            const paidPct = totalMonths > 0 ? Math.min(100, Math.round((paidCount / totalMonths) * 100)) : 0;
            const llRent = l.landlord_monthly_rent ?? l.monthly_rent;
            const llDep = l.landlord_security_deposit ?? l.security_deposit;
            const spreadAmt = l.monthly_rent_spread || 0;
            const landlordNet = l.total_net_landlord_profit || 0;

            return (
              <div
                key={l.id}
                className={`bg-white rounded-2xl border border-slate-200/95 border-l-4 ${getLeftAccentColor(
                  l.status
                )} hover:border-indigo-300 transition shadow-2xs overflow-hidden flex flex-col justify-between`}
              >
                {/* Card Header Bar */}
                <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg bg-indigo-600 text-white shadow-2xs">
                      {l.contract_no}
                    </span>

                    <button
                      onClick={() => onSelectUnit(l.unit_id)}
                      className="text-sm font-extrabold text-slate-900 hover:text-indigo-600 flex items-center gap-1.5 transition group"
                    >
                      <Building2 className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition" />
                      <span>{l.unit_code}</span>
                      <span className="text-slate-300 font-normal">|</span>
                      <span className="text-slate-700 group-hover:text-indigo-600">
                        {l.project_name}
                      </span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition" />
                    </button>

                    <span
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${getStatusBadgeStyle(
                        l.status
                      )}`}
                    >
                      {l.status}
                    </span>

                    {l.days_remaining !== null && l.days_remaining !== undefined && (
                      <span
                        className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1 ${
                          l.days_remaining <= 45
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-white text-slate-600 border border-slate-200'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        {l.days_remaining > 0
                          ? `${l.days_remaining} days left`
                          : `Expired (${Math.abs(l.days_remaining)}d ago)`}
                      </span>
                    )}

                    {Boolean(l.has_rent_spread) && (
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-indigo-600" />
                        Confidential Spread: +฿{spreadAmt.toLocaleString()}/mo
                      </span>
                    )}
                  </div>

                  {/* Primary Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => openStatementDrawer(l.id, 'ledger')}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Schedule & 3 Statements</span>
                      <span className="px-1.5 py-0.2 rounded-md bg-emerald-800/60 text-[10px] font-extrabold">
                        {paidCount}/{totalMonths} Paid
                      </span>
                    </button>

                    <button
                      onClick={() => openEditLease(l)}
                      className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1 transition cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>

                {/* Main Structured Grid Inside Card */}
                <div
                  className={`p-5 grid grid-cols-1 ${
                    layoutMode === 'grid'
                      ? 'md:grid-cols-2 gap-4'
                      : 'md:grid-cols-2 xl:grid-cols-12 gap-4'
                  } items-stretch`}
                >
                  {/* PANEL 1: Stakeholders (Tenant & Landlord) */}
                  <div
                    className={`${
                      layoutMode === 'grid' ? '' : 'xl:col-span-3'
                    } bg-slate-50/70 rounded-xl border border-slate-200/80 p-3.5 flex flex-col justify-between gap-2.5`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Users className="w-3 h-3 text-slate-400" /> Contract Parties
                    </div>

                    {/* Tenant Box */}
                    <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-lg border border-slate-200/70">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0">
                          {(l.tenant_name || 'T').charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Tenant
                            </span>
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {l.tenant_name}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Phone className="w-2.5 h-2.5 text-slate-400" />
                            <span>{l.tenant_phone || '—'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Landlord Box */}
                    <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-lg border border-slate-200/70">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-800 font-bold text-xs flex items-center justify-center shrink-0">
                          {(l.landlord_name || 'L').charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Landlord
                            </span>
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {l.landlord_name}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Phone className="w-2.5 h-2.5 text-slate-400" />
                            <span>{l.landlord_phone || '—'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* PANEL 2: Lease Term, Due Day & Visual Schedule Progress */}
                  <div
                    className={`${
                      layoutMode === 'grid' ? '' : 'xl:col-span-3'
                    } bg-slate-50/70 rounded-xl border border-slate-200/80 p-3.5 flex flex-col justify-between gap-2.5`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" /> Term & Schedule
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                        Due Day {l.payment_due_day}
                      </span>
                    </div>

                    {/* Start -> End Date Box */}
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200/70 flex items-center justify-between text-xs">
                      <div>
                        <div className="text-[10px] text-slate-400 font-medium">Start Date</div>
                        <div className="font-bold text-slate-800">{l.start_date}</div>
                      </div>
                      <div className="text-slate-300 font-bold">→</div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 font-medium">End Date</div>
                        <div className="font-bold text-slate-800">{l.end_date}</div>
                      </div>
                    </div>

                    {/* Interactive Monthly Payment Progress Bar */}
                    <div
                      onClick={() => openStatementDrawer(l.id, 'ledger')}
                      className="bg-white p-2.5 rounded-lg border border-slate-200/70 hover:border-emerald-300 transition cursor-pointer space-y-1.5"
                      title="Click to open Monthly Rental Schedule & Payment Slips"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Rent Collection
                        </span>
                        <span className="font-extrabold text-emerald-700">
                          {paidCount} / {totalMonths} Paid ({paidPct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${paidPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* PANEL 3: Rate Architecture (Tenant vs Landlord Split & Deposits) */}
                  <div
                    className={`${
                      layoutMode === 'grid' ? '' : 'xl:col-span-3'
                    } bg-slate-50/70 rounded-xl border border-slate-200/80 p-3.5 flex flex-col justify-between gap-2`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <Percent className="w-3 h-3 text-slate-400" /> Rate & Deposit Structure
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {l.management_fee_percent ?? 5}% Mgmt
                      </span>
                    </div>

                    <div className="bg-white rounded-lg border border-slate-200/70 p-2.5 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Tenant Contract Rent:</span>
                        <span className="font-extrabold text-slate-900 text-sm">
                          ฿{l.monthly_rent.toLocaleString()}/mo
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Landlord Notified Rate:</span>
                        <span className="font-bold text-indigo-700">
                          ฿{llRent.toLocaleString()}/mo
                        </span>
                      </div>

                      <div className="pt-1 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">Monthly Rent Spread:</span>
                        {l.has_rent_spread ? (
                          <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            +฿{spreadAmt.toLocaleString()}/mo
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">
                            ฿0 (Direct Pass-Through)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/70">
                        <span className="text-slate-400 block text-[10px]">Security Deposit</span>
                        <span className="font-bold text-slate-800">
                          ฿{l.security_deposit.toLocaleString()}
                        </span>
                        {Boolean(l.has_rent_spread) && (
                          <span className="text-[10px] text-indigo-600 block">
                            LL: ฿{llDep.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/70">
                        <span className="text-slate-400 block text-[10px]">Upfront Comm.</span>
                        <span className="font-bold text-slate-800">
                          ฿{l.agent_commission.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-emerald-700 font-bold block">
                          Paid M1 Advance • Comm Retained
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* PANEL 4: Live 3-Account Statement Breakdown (Clickable Tiles) */}
                  <div
                    className={`${
                      layoutMode === 'grid' ? '' : 'xl:col-span-3'
                    } bg-indigo-50/40 rounded-xl border border-indigo-100 p-3.5 flex flex-col justify-between gap-2`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1">
                        <Landmark className="w-3 h-3 text-indigo-600" /> Live 3-Party Statements
                      </span>
                      <button
                        onClick={() => openStatementDrawer(l.id, 'agency_soa')}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
                      >
                        Open SOA <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Tile A: Tenant Collected */}
                    <div
                      onClick={() => openStatementDrawer(l.id, 'tenant_soa')}
                      className="bg-white hover:bg-emerald-50/50 px-3 py-2 rounded-lg border border-slate-200/80 hover:border-emerald-300 transition cursor-pointer flex items-center justify-between"
                      title="Click to view Tenant Statement of Account"
                    >
                      <div>
                        <div className="text-[10px] font-semibold text-slate-400">
                          1. Tenant Collected
                        </div>
                        <div className="text-xs font-extrabold text-slate-900">
                          ฿{(l.total_collected_from_tenant || 0).toLocaleString()}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        Tenant SOA →
                      </span>
                    </div>

                    {/* Tile B: Landlord Net Account */}
                    <div
                      onClick={() => openStatementDrawer(l.id, 'landlord_soa')}
                      className="bg-white hover:bg-indigo-50/50 px-3 py-2 rounded-lg border border-slate-200/80 hover:border-indigo-300 transition cursor-pointer flex items-center justify-between"
                      title="Click to view Confidential Landlord Statement of Account"
                    >
                      <div>
                        <div className="text-[10px] font-semibold text-slate-400">
                          2. Landlord Net Account
                        </div>
                        <div
                          className={`text-xs font-extrabold ${
                            landlordNet >= 0 ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          ฿{landlordNet.toLocaleString()}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                        Landlord SOA →
                      </span>
                    </div>

                    {/* Tile C: Agency Profit */}
                    <div
                      onClick={() => openStatementDrawer(l.id, 'agency_soa')}
                      className="bg-indigo-900 hover:bg-indigo-800 text-white px-3 py-2 rounded-lg transition cursor-pointer flex items-center justify-between shadow-2xs"
                      title="Click to view Agency Profit Statement (Spread + Comm + Mgmt)"
                    >
                      <div>
                        <div className="text-[10px] font-semibold text-indigo-200">
                          3. Agency Total Profit
                        </div>
                        <div className="text-sm font-extrabold text-white">
                          ฿{(l.total_agency_profit || 0).toLocaleString()}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-indigo-950 bg-indigo-200 px-2 py-0.5 rounded">
                        Profit SOA →
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Special Terms & Signed Document Chips */}
                {(l.special_terms || (l.documents && l.documents.length > 0)) && (
                  <div className="px-5 py-2.5 bg-slate-50/90 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 text-xs">
                    {l.special_terms ? (
                      <div className="text-slate-600 flex items-start sm:items-center gap-1.5 min-w-0">
                        <span className="px-2 py-0.5 rounded bg-amber-100/80 text-amber-900 font-bold text-[10px] shrink-0">
                          Special Terms
                        </span>
                        <span className="truncate text-slate-600" title={l.special_terms}>
                          {l.special_terms}
                        </span>
                      </div>
                    ) : (
                      <div />
                    )}

                    {l.documents && l.documents.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mr-1">
                          <Paperclip className="w-3 h-3" /> Files:
                        </span>
                        {l.documents.map((doc, idx) => (
                          <a
                            key={`${doc.url}-${idx}`}
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-[11px] font-medium border border-slate-200 transition shadow-2xs"
                          >
                            <FileText className="w-3 h-3 text-indigo-600 shrink-0" />
                            <span className="font-bold text-indigo-950">
                              {doc.doc_type || 'Contract'}:
                            </span>
                            <span className="truncate max-w-[140px]">{doc.name}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60 shrink-0" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW MODE 3: HIGH-DENSITY FINANCIAL TABLE VIEW */}
      {layoutMode === 'table' && filtered.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4">Contract & Unit</th>
                  <th className="py-3.5 px-4">Tenant & Landlord</th>
                  <th className="py-3.5 px-4">Term & Progress</th>
                  <th className="py-3.5 px-4 text-right">Tenant Rent</th>
                  <th className="py-3.5 px-4 text-right">Landlord Rate</th>
                  <th className="py-3.5 px-4 text-right">Collected</th>
                  <th className="py-3.5 px-4 text-right">Landlord Net</th>
                  <th className="py-3.5 px-4 text-right">Agency Profit</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((l) => {
                  const paidCount = l.paid_months_count ?? 0;
                  const totalMonths = l.payments_count || 12;
                  const llRent = l.landlord_monthly_rent ?? l.monthly_rent;
                  const spreadAmt = l.monthly_rent_spread || 0;
                  const landlordNet = l.total_net_landlord_profit || 0;

                  return (
                    <tr key={l.id} className="hover:bg-slate-50/90 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                            {l.contract_no}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${getStatusBadgeStyle(
                              l.status
                            )}`}
                          >
                            {l.status}
                          </span>
                        </div>
                        <button
                          onClick={() => onSelectUnit(l.unit_id)}
                          className="font-bold text-slate-900 hover:text-indigo-600 mt-1 block"
                        >
                          {l.unit_code} — {l.project_name}
                        </button>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">
                          <span className="text-emerald-700 text-[10px] uppercase mr-1">T:</span>
                          {l.tenant_name}
                        </div>
                        <div className="text-slate-500 mt-0.5">
                          <span className="text-indigo-700 text-[10px] font-bold uppercase mr-1">
                            L:
                          </span>
                          {l.landlord_name}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">
                          {l.start_date} → {l.end_date}
                        </div>
                        <div className="text-[11px] text-emerald-700 font-bold mt-0.5">
                          {paidCount}/{totalMonths} Months Paid • Due Day {l.payment_due_day}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-extrabold text-slate-900">
                        ฿{l.monthly_rent.toLocaleString()}
                        <div className="text-[10px] font-normal text-slate-400">
                          Dep: ฿{l.security_deposit.toLocaleString()}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="font-bold text-indigo-700">
                          ฿{llRent.toLocaleString()}
                        </div>
                        {l.has_rent_spread ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                            Spread +฿{spreadAmt.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">No Spread</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-slate-800">
                        ฿{(l.total_collected_from_tenant || 0).toLocaleString()}
                      </td>

                      <td
                        className={`py-3.5 px-4 text-right font-bold ${
                          landlordNet >= 0 ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        ฿{landlordNet.toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span className="font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                          ฿{(l.total_agency_profit || 0).toLocaleString()}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => openStatementDrawer(l.id, 'ledger')}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
                          >
                            Schedule & SOA
                          </button>
                          <button
                            onClick={() => openEditLease(l)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                            title="Edit Contract"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Statement of Account (SOA) & Rental Payment Ledger Drawer */}
      <LeaseStatementDrawer
        leaseId={selectedStatementLeaseId}
        initialTab={selectedStatementTab}
        onClose={() => setSelectedStatementLeaseId(null)}
        onRefreshGlobal={onRefresh}
      />

      {/* Create / Edit Lease Modal (with Signed Contract File Upload) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingLease
                  ? `Edit Contract ${editingLease.contract_no}`
                  : 'Create Lease Contract'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Contract No. *</label>
                  <input
                    type="text"
                    required
                    value={form.contract_no}
                    onChange={(e) => setForm({ ...form, contract_no: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  >
                    <option>Active</option>
                    <option>Expiring Soon</option>
                    <option>Expired</option>
                    <option>Terminated</option>
                    <option>Draft</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Property Unit *</label>
                  <select
                    required
                    value={form.unit_id}
                    onChange={(e) => {
                      const uid = Number(e.target.value);
                      const u = units.find((x) => x.id === uid);
                      setForm({
                        ...form,
                        unit_id: uid,
                        landlord_id: u?.landlord_id || form.landlord_id,
                        monthly_rent: u?.target_rent_price || form.monthly_rent,
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.unit_code} ({u.project_name})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Landlord *</label>
                  <select
                    required
                    value={form.landlord_id}
                    onChange={(e) => setForm({ ...form, landlord_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  >
                    {landlords.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Tenant *</label>
                  <select
                    required
                    value={form.tenant_id}
                    onChange={(e) => setForm({ ...form, tenant_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  >
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              {/* Lease Signing Policy Banner: Month 1 Advance Rent = Agency Commission */}
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-extrabold text-emerald-950">
                    Signing Rule: 1st Month Rent = Paid Advance Rent & Agency Commission
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    When this lease is signed, the tenant&apos;s 1st month rent (<strong>฿{Number(form.monthly_rent || 0).toLocaleString()}</strong>) is automatically registered as <strong>Paid Advance Rent</strong>. 100% of this 1st month rent is retained by the agency as broker commission (Month 1 Net Landlord Payout: <strong>฿0.00</strong>). Monthly landlord payouts begin in Month 2.
                  </p>
                </div>
              </div>

              {/* Dual-Rate Rent Spread & Landlord Account Configuration (Clauses 1, 3, 4) */}
              <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-indigo-950 text-xs">
                      Rent Difference (Agency Spread) & Confidential Dual-Rate Settings
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Configure if Tenant pays a higher rent than the Landlord&apos;s notified rate.
                      Commission, Mgmt Fee & Landlord Deposit are calculated on the Landlord Rate.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-indigo-200 font-bold text-indigo-700 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={Number(form.has_rent_spread) === 1}
                      onChange={(e) => {
                        const enabled = e.target.checked ? 1 : 0;
                        const tnRent = Number(form.monthly_rent) || 0;
                        const nextLlRent = enabled ? Math.round(tnRent * 0.9) : tnRent;
                        const depMonths =
                          tnRent > 0 ? Number(form.security_deposit) / tnRent : 2;
                        setForm({
                          ...form,
                          has_rent_spread: enabled,
                          landlord_monthly_rent: nextLlRent,
                          landlord_security_deposit: Math.round(depMonths * nextLlRent),
                          agent_commission: nextLlRent,
                        });
                      }}
                      className="rounded text-indigo-600"
                    />
                    Enable Monthly Rent Difference
                  </label>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold text-emerald-800 block mb-1">
                      Tenant Monthly Rent (THB) *
                    </label>
                    <FormattedNumberInput
                      value={form.monthly_rent}
                      maxDecimals={2}
                      onValueChange={(tnRent) => {
                        const hasSp = Number(form.has_rent_spread) === 1;
                        const llRent = hasSp ? Number(form.landlord_monthly_rent) : tnRent;
                        setForm({
                          ...form,
                          monthly_rent: tnRent,
                          security_deposit: tnRent * 2,
                          landlord_monthly_rent: llRent,
                          landlord_security_deposit: hasSp
                            ? Number(form.landlord_security_deposit)
                            : tnRent * 2,
                          agent_commission: hasSp ? Number(form.agent_commission) : tnRent,
                        });
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-emerald-300 bg-white font-bold text-emerald-900"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-indigo-800 block mb-1">
                      Landlord Notified Rent (THB)
                    </label>
                    <FormattedNumberInput
                      disabled={Number(form.has_rent_spread) === 0}
                      value={
                        Number(form.has_rent_spread) === 1
                          ? form.landlord_monthly_rent
                          : form.monthly_rent
                      }
                      maxDecimals={2}
                      onValueChange={(llRent) => {
                        const depMonths =
                          Number(form.monthly_rent) > 0
                            ? Number(form.security_deposit) / Number(form.monthly_rent)
                            : 2;
                        setForm({
                          ...form,
                          landlord_monthly_rent: llRent,
                          landlord_security_deposit: Math.round(depMonths * llRent),
                          agent_commission: llRent,
                        });
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-indigo-300 bg-white font-bold text-indigo-900 disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Agency Rent Difference / Mo
                    </label>
                    <div className="px-3 py-2 rounded-lg bg-indigo-900 text-white font-extrabold">
                      + ฿
                      {Math.max(
                        0,
                        Number(form.monthly_rent) -
                          (Number(form.has_rent_spread) === 1
                            ? Number(form.landlord_monthly_rent)
                            : Number(form.monthly_rent))
                      ).toLocaleString()}{' '}
                      / mo
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Tenant Deposit
                    </label>
                    <FormattedNumberInput
                      value={form.security_deposit}
                      maxDecimals={2}
                      onValueChange={(tnDep) => {
                        const hasSp = Number(form.has_rent_spread) === 1;
                        const ratio =
                          Number(form.monthly_rent) > 0
                            ? Number(form.landlord_monthly_rent) / Number(form.monthly_rent)
                            : 1;
                        setForm({
                          ...form,
                          security_deposit: tnDep,
                          landlord_security_deposit: hasSp ? Math.round(tnDep * ratio) : tnDep,
                        });
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-indigo-800 block mb-1">
                      Landlord Deposit
                    </label>
                    <FormattedNumberInput
                      disabled={Number(form.has_rent_spread) === 0}
                      value={
                        Number(form.has_rent_spread) === 1
                          ? form.landlord_security_deposit
                          : form.security_deposit
                      }
                      maxDecimals={2}
                      onValueChange={(val) =>
                        setForm({ ...form, landlord_security_deposit: val })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-indigo-200 bg-white disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Upfront Comm (on LL)
                    </label>
                    <FormattedNumberInput
                      value={form.agent_commission}
                      maxDecimals={2}
                      onValueChange={(val) =>
                        setForm({ ...form, agent_commission: val })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Mgmt Fee % / Due Day
                    </label>
                    <div className="flex gap-1.5">
                      <FormattedNumberInput
                        value={form.management_fee_percent}
                        maxDecimals={2}
                        onValueChange={(val) =>
                          setForm({ ...form, management_fee_percent: val })
                        }
                        className="w-1/2 px-2 py-2 rounded-lg border border-slate-300 bg-white"
                        title="Monthly Management Fee % (Charged on Landlord Rent)"
                      />
                      <FormattedNumberInput
                        value={form.payment_due_day}
                        maxDecimals={0}
                        onValueChange={(val) =>
                          setForm({ ...form, payment_due_day: Math.min(28, Math.max(1, val)) })
                        }
                        className="w-1/2 px-2 py-2 rounded-lg border border-slate-300 bg-white"
                        title="Payment Due Day (1-28)"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Special Terms / Addendums
                </label>
                <textarea
                  rows={2}
                  value={form.special_terms}
                  onChange={(e) => setForm({ ...form, special_terms: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              {/* Upload Signed Contract & Lease Related Documents Section */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                      Signed Contract & Lease Documents
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Upload PDF, DOCX, or scanned images of signed contract, inventory checklist, or
                      ID
                    </p>
                  </div>
                  <select
                    value={docTypeSelection}
                    onChange={(e) => setDocTypeSelection(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-indigo-700"
                  >
                    <option value="Signed Contract">Signed Contract</option>
                    <option value="Inventory & Handover">Inventory & Handover</option>
                    <option value="Tenant ID / Passport">Tenant ID / Passport</option>
                    <option value="Deposit Receipt">Deposit Receipt</option>
                    <option value="Addendum / Other">Addendum / Other</option>
                  </select>
                </div>

                {/* Drag & Drop + Copy & Paste File Upload Zone */}
                <div
                  tabIndex={0}
                  onPaste={(e) => {
                    const files = extractFilesFromClipboard(e.clipboardData, false);
                    if (files.length > 0) {
                      e.preventDefault();
                      e.stopPropagation();
                      handleUploadLeaseFiles(files);
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingDoc(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDraggingDoc(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingDoc(false);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      handleUploadLeaseFiles(e.dataTransfer.files);
                    }
                  }}
                  onClick={() => docFileInputRef.current?.click()}
                  className={`cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    isDraggingDoc
                      ? 'border-indigo-600 bg-indigo-50/80'
                      : 'border-slate-300 bg-white hover:border-indigo-400'
                  }`}
                >
                  <input
                    ref={docFileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleUploadLeaseFiles(e.target.files);
                        e.target.value = '';
                      }
                    }}
                  />
                  {uploadingDoc ? (
                    <div className="flex items-center justify-center gap-2 text-indigo-600 font-semibold py-1">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading lease document(s)...
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <UploadCloud className="w-5 h-5 text-indigo-600" />
                      <span className="font-semibold text-slate-800">
                        Drag & drop or Copy & Paste (Ctrl+V) signed contract files here, or{' '}
                        <span className="text-indigo-600 underline">browse</span>
                      </span>
                      <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                        <span className="text-[11px] text-slate-400">
                          Will be tagged as &quot;{docTypeSelection}&quot;
                        </span>
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const files = await readClipboardFilesButton();
                              if (files.length > 0) {
                                await handleUploadLeaseFiles(files);
                              }
                            } catch {
                              // User can press Ctrl+V directly
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-bold hover:bg-indigo-100"
                        >
                          <ClipboardPaste className="w-3 h-3" />
                          Paste from Clipboard (Ctrl+V)
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* List of Attached Files */}
                {form.documents.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {form.documents.map((doc, idx) => (
                      <div
                        key={`${doc.url}-${idx}`}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-slate-200"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-semibold text-[10px] shrink-0">
                            {doc.doc_type || 'Signed Contract'}
                          </span>
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-slate-800 hover:text-indigo-600 truncate"
                          >
                            {doc.name}
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveDoc(doc.url)}
                          className="p-1 text-slate-400 hover:text-rose-600"
                          title="Remove Document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => saveContract(true)}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 flex items-center gap-1.5"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  Save & Open Monthly Schedule
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
                >
                  Save Lease Contract
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
