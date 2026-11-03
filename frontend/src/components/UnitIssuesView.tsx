import React, { useState, useEffect, useRef } from 'react';
import {
  Wrench,
  Plus,
  Search,
  CheckCircle2,
  Building2,
  Edit3,
  X,
  Kanban,
  LayoutList,
  Calendar,
  ExternalLink,
  Clock,
  FileText,
  Image as ImageIcon,
  UploadCloud,
  Trash2,
  Loader2,
  Paperclip,
  Smartphone,
  ClipboardPaste,
  Archive,
  RotateCcw,
} from 'lucide-react';
import { api } from '../api';
import { UnitIssue, PropertyUnit, LeaseContract, IssueDocument } from '../types';
import { HighResImageUploader } from './HighResImageUploader';
import {
  useEscapeKey,
  extractFilesFromClipboard,
  readClipboardFilesButton,
} from '../utils/clipboardAndEsc';
import { FormattedNumberInput } from './FormattedNumberInput';

interface UnitIssuesViewProps {
  issues: UnitIssue[];
  units: PropertyUnit[];
  leases: LeaseContract[];
  preselectedUnitForIssue: PropertyUnit | null;
  onClearPreselectedUnit: () => void;
  onRefresh: () => void;
  onSelectUnit: (unitId: number) => void;
}

const ACTIVE_KANBAN_COLUMNS = [
  {
    key: 'Open',
    label: 'Open / New',
    dotColor: 'bg-rose-500',
    headerBg: 'bg-rose-50/80 border-rose-200/80',
    badgeBg: 'bg-rose-100 text-rose-800',
    accentBorder: 'hover:border-rose-300',
  },
  {
    key: 'In Progress',
    label: 'In Progress',
    dotColor: 'bg-amber-500',
    headerBg: 'bg-amber-50/80 border-amber-200/80',
    badgeBg: 'bg-amber-100 text-amber-800',
    accentBorder: 'hover:border-amber-300',
  },
  {
    key: 'Waiting Developer/Parts',
    label: 'Waiting Developer / Parts',
    dotColor: 'bg-purple-500',
    headerBg: 'bg-purple-50/80 border-purple-200/80',
    badgeBg: 'bg-purple-100 text-purple-800',
    accentBorder: 'hover:border-purple-300',
  },
];

const ALL_STATUSES = ['Open', 'In Progress', 'Waiting Developer/Parts', 'Resolved', 'Closed'];

const DOC_TYPES = [
  'Quotation',
  'Invoice / Receipt',
  'Warranty Claim',
  'Inspection Report',
  'Other',
];

function isArchivedStatus(status: string): boolean {
  return status === 'Resolved' || status === 'Closed';
}

export const UnitIssuesView: React.FC<UnitIssuesViewProps> = ({
  issues,
  units,
  leases,
  preselectedUnitForIssue,
  onClearPreselectedUnit,
  onRefresh,
  onSelectUnit,
}) => {
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'archive'>('kanban');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [respFilter, setRespFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Recent Archive Banner Notification
  const [archiveNotice, setArchiveNotice] = useState<{
    ticketNo: string;
    status: string;
    issueId: number;
  } | null>(null);

  // Drag and Drop state for Kanban
  const [draggedIssueId, setDraggedIssueId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingIssue, setEditingIssue] = useState<UnitIssue | null>(null);

  // Close ticket modal on ESC key
  useEscapeKey(() => setShowModal(false), showModal);

  // Document upload states inside the modal
  const [docDragging, setDocDragging] = useState(false);
  const [docUploading, setDocUploading] = useState(false);
  const [defaultDocType, setDefaultDocType] = useState('Quotation');
  const docInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState({
    ticket_no: '',
    unit_id: '' as string | number,
    lease_id: '' as string | number,
    title: '',
    category: 'Plumbing',
    priority: 'Medium',
    status: 'Open',
    reported_by: 'Tenant',
    responsible_party: 'Landlord',
    vendor_or_contractor: '',
    description: '',
    resolution_notes: '',
    estimated_cost: 0,
    actual_cost: 0,
    reported_date: new Date().toISOString().split('T')[0],
    resolved_date: '',
    issue_images: [] as string[],
    issue_documents: [] as IssueDocument[],
  });

  useEffect(() => {
    if (preselectedUnitForIssue) {
      openNewIssue(preselectedUnitForIssue);
      onClearPreselectedUnit();
    }
  }, [preselectedUnitForIssue]);

  // Split issues into Active vs Archived (Resolved or Closed)
  const activeIssuesAll = issues.filter((i) => !isArchivedStatus(i.status));
  const archivedIssuesAll = issues.filter((i) => isArchivedStatus(i.status));

  const matchesSearchAndResp = (i: UnitIssue) => {
    const matchResp = respFilter === 'ALL' || i.responsible_party === respFilter;
    const q = search.toLowerCase();
    const matchText =
      i.ticket_no.toLowerCase().includes(q) ||
      i.title.toLowerCase().includes(q) ||
      (i.unit_code || '').toLowerCase().includes(q) ||
      (i.project_name || '').toLowerCase().includes(q) ||
      (i.developer_name || '').toLowerCase().includes(q) ||
      (i.landlord_name || '').toLowerCase().includes(q) ||
      (i.vendor_or_contractor || '').toLowerCase().includes(q);
    return matchResp && matchText;
  };

  const filteredActive = activeIssuesAll.filter((i) => {
    const matchStatus = statusFilter === 'ALL' || i.status === statusFilter;
    return matchStatus && matchesSearchAndResp(i);
  });

  const filteredArchived = archivedIssuesAll.filter((i) => {
    const matchStatus =
      statusFilter === 'ALL' ||
      !isArchivedStatus(statusFilter) ||
      i.status === statusFilter;
    return matchStatus && matchesSearchAndResp(i);
  });

  const openNewIssue = (unitObj?: PropertyUnit, initialStatus: string = 'Open') => {
    setEditingIssue(null);
    const targetUnit = unitObj || units[0];
    const activeLease = leases.find(
      (l) => l.unit_id === targetUnit?.id && (l.status === 'Active' || l.status === 'Expiring Soon')
    );
    setForm({
      ticket_no: `ISS-${1005 + issues.length}`,
      unit_id: targetUnit?.id || '',
      lease_id: activeLease?.id || '',
      title: '',
      category: 'Plumbing',
      priority: 'Medium',
      status: initialStatus,
      reported_by: 'Tenant',
      responsible_party: 'Landlord',
      vendor_or_contractor: '',
      description: '',
      resolution_notes: '',
      estimated_cost: 0,
      actual_cost: 0,
      reported_date: new Date().toISOString().split('T')[0],
      resolved_date: isArchivedStatus(initialStatus)
        ? new Date().toISOString().split('T')[0]
        : '',
      issue_images: [],
      issue_documents: [],
    });
    setShowModal(true);
  };

  const openEditIssue = (iss: UnitIssue) => {
    setEditingIssue(iss);
    setForm({
      ticket_no: iss.ticket_no,
      unit_id: iss.unit_id,
      lease_id: iss.lease_id || '',
      title: iss.title,
      category: iss.category,
      priority: iss.priority,
      status: iss.status,
      reported_by: iss.reported_by,
      responsible_party: iss.responsible_party,
      vendor_or_contractor: iss.vendor_or_contractor || '',
      description: iss.description || '',
      resolution_notes: iss.resolution_notes || '',
      estimated_cost: iss.estimated_cost,
      actual_cost: iss.actual_cost,
      reported_date: iss.reported_date,
      resolved_date: iss.resolved_date || '',
      issue_images: iss.issue_images || [],
      issue_documents: iss.issue_documents || [],
    });
    setShowModal(true);
  };

  const saveFormWithStatus = async (overrideStatus?: string) => {
    const targetStatus = overrideStatus || form.status;
    const todayStr = new Date().toISOString().split('T')[0];
    const resolvedDateVal =
      isArchivedStatus(targetStatus) && !form.resolved_date
        ? todayStr
        : !isArchivedStatus(targetStatus)
        ? null
        : form.resolved_date || todayStr;

    const payload = {
      ...form,
      status: targetStatus,
      unit_id: Number(form.unit_id),
      lease_id: form.lease_id ? Number(form.lease_id) : null,
      estimated_cost: Number(form.estimated_cost),
      actual_cost: Number(form.actual_cost),
      resolved_date: resolvedDateVal,
      issue_images: form.issue_images,
      issue_documents: form.issue_documents,
    };

    let saved: UnitIssue;
    if (editingIssue) {
      saved = await api.updateIssue(editingIssue.id, payload);
    } else {
      saved = await api.createIssue(payload);
    }
    setShowModal(false);
    if (isArchivedStatus(targetStatus)) {
      setArchiveNotice({
        ticketNo: saved.ticket_no,
        status: targetStatus,
        issueId: saved.id,
      });
    }
    onRefresh();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveFormWithStatus();
  };

  const handleQuickStatusChange = async (iss: UnitIssue, newStatus: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    await api.updateIssue(iss.id, {
      ...iss,
      status: newStatus,
      resolved_date: isArchivedStatus(newStatus)
        ? iss.resolved_date || todayStr
        : null,
    });
    if (isArchivedStatus(newStatus)) {
      setArchiveNotice({
        ticketNo: iss.ticket_no,
        status: newStatus,
        issueId: iss.id,
      });
    } else if (archiveNotice?.issueId === iss.id) {
      setArchiveNotice(null);
    }
    onRefresh();
  };

  const handleDropOnColumn = async (targetStatus: string) => {
    setDragOverColumn(null);
    if (draggedIssueId === null) return;
    const iss = issues.find((i) => i.id === draggedIssueId);
    setDraggedIssueId(null);
    if (!iss || iss.status === targetStatus) return;
    await handleQuickStatusChange(iss, targetStatus);
  };

  const appendTimestampNote = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const prefix = form.resolution_notes ? `${form.resolution_notes}\n` : '';
    setForm({
      ...form,
      resolution_notes: `${prefix}[${todayStr}] `,
    });
  };

  const handleUploadDocuments = async (fileList: FileList | File[]) => {
    const filesArr = Array.from(fileList);
    if (filesArr.length === 0) return;
    setDocUploading(true);
    try {
      const res = await api.uploadFiles(filesArr);
      const newDocs: IssueDocument[] = res.files.map((f) => ({
        url: f.url,
        name: f.name,
        doc_type: defaultDocType,
        size_bytes: f.size_bytes,
        uploaded_at: f.uploaded_at || new Date().toISOString().split('T')[0],
      }));
      setForm((prev) => ({
        ...prev,
        issue_documents: [...prev.issue_documents, ...newDocs],
      }));
    } catch (err) {
      console.error('Issue document upload failed:', err);
    } finally {
      setDocUploading(false);
    }
  };

  const handleUpdateDocType = (idx: number, newType: string) => {
    setForm((prev) => ({
      ...prev,
      issue_documents: prev.issue_documents.map((d, i) =>
        i === idx ? { ...d, doc_type: newType } : d
      ),
    }));
  };

  const handleRemoveDocument = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      issue_documents: prev.issue_documents.filter((_, i) => i !== idx),
    }));
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '';
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  };

  // Lookup full context for the currently selected unit/lease in the modal
  const selectedUnitObj = units.find((u) => u.id === Number(form.unit_id));
  const unitLeases = leases.filter((l) => l.unit_id === Number(form.unit_id));
  const selectedLeaseObj =
    leases.find((l) => l.id === Number(form.lease_id)) ||
    unitLeases.find((l) => l.status === 'Active' || l.status === 'Expiring Soon');

  const getPriorityBadgeClass = (priority: string) => {
    if (priority === 'Urgent') return 'bg-rose-600 text-white shadow-2xs';
    if (priority === 'High') return 'bg-orange-100 text-orange-800 border border-orange-200';
    if (priority === 'Medium') return 'bg-amber-50 text-amber-800 border border-amber-200';
    return 'bg-slate-100 text-slate-600';
  };

  const getRespBadgeClass = (resp: string) => {
    if (resp === 'Developer Warranty')
      return 'bg-purple-100 text-purple-800 border border-purple-200';
    if (resp === 'Landlord') return 'bg-blue-100 text-blue-800 border border-blue-200';
    if (resp === 'Tenant') return 'bg-amber-100 text-amber-800 border border-amber-200';
    return 'bg-teal-100 text-teal-800 border border-teal-200';
  };

  return (
    <div className="space-y-5">
      {/* Archived Notification Banner (when a ticket is marked Resolved or Closed) */}
      {archiveNotice && (
        <div className="bg-emerald-950 text-white px-5 py-3 rounded-2xl shadow-md flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <Archive className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-emerald-300">{archiveNotice.ticketNo}</span> marked as{' '}
              <strong className="underline">{archiveNotice.status}</strong> and automatically moved
              into <strong>Archive</strong>.
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setViewMode('archive');
                setStatusFilter('ALL');
              }}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition"
            >
              View Archive ({archivedIssuesAll.length})
            </button>
            <button
              type="button"
              onClick={async () => {
                const target = issues.find((i) => i.id === archiveNotice.issueId);
                if (target) {
                  await handleQuickStatusChange(target, 'In Progress');
                }
                setArchiveNotice(null);
              }}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-emerald-200 font-semibold inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Undo
            </button>
            <button
              type="button"
              onClick={() => setArchiveNotice(null)}
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Filter & View Switcher Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* View Switcher Toggle: Active Kanban | Active List | Archive */}
            <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl mr-2 border border-slate-200/80">
              <button
                type="button"
                onClick={() => {
                  setViewMode('kanban');
                  if (isArchivedStatus(statusFilter)) setStatusFilter('ALL');
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  viewMode === 'kanban'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Kanban className="w-3.5 h-3.5" />
                Active Kanban ({activeIssuesAll.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode('list');
                  if (isArchivedStatus(statusFilter)) setStatusFilter('ALL');
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  viewMode === 'list'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" />
                Active List ({activeIssuesAll.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode('archive');
                  setStatusFilter('ALL');
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  viewMode === 'archive'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                Archive ({archivedIssuesAll.length})
              </button>
            </div>

            {viewMode !== 'archive' ? (
              ['ALL', 'Open', 'In Progress', 'Waiting Developer/Parts'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    statusFilter === st
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st === 'ALL'
                    ? `All Active (${activeIssuesAll.length})`
                    : `${st} (${activeIssuesAll.filter((i) => i.status === st).length})`}
                </button>
              ))
            ) : (
              ['ALL', 'Resolved', 'Closed'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    statusFilter === st
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st === 'ALL'
                    ? `All Archived (${archivedIssuesAll.length})`
                    : `${st} (${archivedIssuesAll.filter((i) => i.status === st).length})`}
                </button>
              ))
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search ticket, unit, defect, vendor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={() => openNewIssue()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition shadow-xs whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Log Unit Issue
            </button>
          </div>
        </div>

        {/* Responsible Party Sub-filter & Helper Tip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 font-medium">Responsibility Filter:</span>
            {['ALL', 'Developer Warranty', 'Landlord', 'Tenant', 'Building Juristic'].map((rp) => (
              <button
                key={rp}
                onClick={() => setRespFilter(rp)}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  respFilter === rp
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {rp === 'ALL' ? 'All Parties' : rp}
              </button>
            ))}
          </div>

          <span className="text-[11px] text-slate-400 hidden sm:inline">
            {viewMode === 'archive'
              ? 'Archived tickets (Resolved & Closed). Click any ticket to inspect or reopen.'
              : 'Marking any ticket as Resolved or Closed automatically moves it into Archive.'}
          </span>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 1. ACTIVE KANBAN BOARD VIEW                                         */}
      {/* =================================================================== */}
      {viewMode === 'kanban' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            {ACTIVE_KANBAN_COLUMNS.map((col) => {
              const colIssues = filteredActive.filter((i) => i.status === col.key);
              const totalEst = colIssues.reduce((acc, i) => acc + (i.estimated_cost || 0), 0);
              const totalActual = colIssues.reduce((acc, i) => acc + (i.actual_cost || 0), 0);
              const isDragTarget = dragOverColumn === col.key;

              return (
                <div
                  key={col.key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverColumn !== col.key) setDragOverColumn(col.key);
                  }}
                  onDragLeave={() => {
                    if (dragOverColumn === col.key) setDragOverColumn(null);
                  }}
                  onDrop={() => handleDropOnColumn(col.key)}
                  className={`rounded-2xl border transition-all flex flex-col min-h-[500px] ${
                    isDragTarget
                      ? 'bg-indigo-50/60 border-indigo-400 ring-2 ring-indigo-300/60'
                      : 'bg-slate-100/70 border-slate-200/90'
                  }`}
                >
                  {/* Column Header */}
                  <div className={`p-3.5 rounded-t-2xl border-b ${col.headerBg}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                        <h3 className="text-xs font-extrabold text-slate-900 tracking-tight">
                          {col.label}
                        </h3>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${col.badgeBg}`}
                        >
                          {colIssues.length}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => openNewIssue(undefined, col.key)}
                        title={`Log new ticket in ${col.label}`}
                        className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white/70 transition"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5">
                      <span>Est: ฿{totalEst.toLocaleString()}</span>
                      <span className="font-semibold text-slate-700">
                        Actual: ฿{totalActual.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Column Cards */}
                  <div className="p-3 space-y-3 flex-1">
                    {colIssues.length === 0 ? (
                      <div className="h-44 rounded-xl border border-dashed border-slate-300/80 flex flex-col items-center justify-center text-center p-4 text-slate-400">
                        <Wrench className="w-5 h-5 mb-1.5 opacity-50" />
                        <p className="text-xs font-medium">No active tickets in {col.label}</p>
                        <p className="text-[11px] opacity-80 mt-0.5">
                          Drag a ticket here or click + above
                        </p>
                      </div>
                    ) : (
                      colIssues.map((iss) => {
                        const imgCount = iss.issue_images?.length || 0;
                        const docCount = iss.issue_documents?.length || 0;
                        return (
                          <div
                            key={iss.id}
                            draggable
                            onDragStart={() => setDraggedIssueId(iss.id)}
                            onDragEnd={() => {
                              setDraggedIssueId(null);
                              setDragOverColumn(null);
                            }}
                            onClick={() => openEditIssue(iss)}
                            className={`group bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs hover:shadow-md ${col.accentBorder} transition-all cursor-pointer flex flex-col justify-between gap-2.5 select-none`}
                          >
                            {/* Top row: Ticket No + Priority */}
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 group-hover:bg-indigo-600 group-hover:text-white transition">
                                  {iss.ticket_no}
                                </span>
                                <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                                  {iss.category}
                                </span>
                              </div>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${getPriorityBadgeClass(
                                  iss.priority
                                )}`}
                              >
                                {iss.priority}
                              </span>
                            </div>

                            {/* Unit Link Pill */}
                            <div className="flex items-center justify-between gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectUnit(iss.unit_id);
                                }}
                                className="text-[11px] font-bold px-2 py-1 rounded-lg bg-indigo-50/90 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1 truncate max-w-full"
                                title="Open 360° Unit Profile"
                              >
                                <Building2 className="w-3 h-3 shrink-0" />
                                <span className="truncate">
                                  {iss.unit_code} • {iss.project_name}
                                </span>
                              </button>
                            </div>

                            {/* Thumbnail Preview Strip if issue has photos */}
                            {imgCount > 0 && iss.issue_images && (
                              <div className="flex items-center gap-1.5 overflow-hidden pt-0.5">
                                {iss.issue_images.slice(0, 3).map((url, idx) => (
                                  <img
                                    key={`${url}-${idx}`}
                                    src={url}
                                    alt="Issue thumbnail"
                                    className="w-12 h-10 object-cover rounded-lg border border-slate-200 shrink-0"
                                  />
                                ))}
                                {imgCount > 3 && (
                                  <span className="text-[10px] font-bold text-slate-500 px-1.5">
                                    +{imgCount - 3}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Title & Description snippet */}
                            <div>
                              <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition line-clamp-2 leading-snug">
                                {iss.title}
                              </h4>
                              {iss.description && (
                                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                  {iss.description}
                                </p>
                              )}
                            </div>

                            {/* Resolution Note Snippet if present */}
                            {iss.resolution_notes && (
                              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/70 text-[11px] text-slate-600 line-clamp-2">
                                <span className="font-semibold text-slate-800">Log: </span>
                                {iss.resolution_notes}
                              </div>
                            )}

                            {/* Responsible Party & Attachments Badges */}
                            <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${getRespBadgeClass(
                                  iss.responsible_party
                                )}`}
                              >
                                Resp: {iss.responsible_party}
                              </span>

                              <div className="flex items-center gap-1.5">
                                {imgCount > 0 && (
                                  <span
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200/70"
                                    title={`${imgCount} High-Res Photo(s)`}
                                  >
                                    <ImageIcon className="w-3 h-3" />
                                    {imgCount}
                                  </span>
                                )}
                                {docCount > 0 && (
                                  <span
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/70"
                                    title={`${docCount} Quotation / Document(s)`}
                                  >
                                    <FileText className="w-3 h-3" />
                                    {docCount}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Footer: Date, Cost & Quick Resolve->Archive Button */}
                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] gap-2">
                              <div className="text-slate-500">
                                Est ฿{iss.estimated_cost.toLocaleString()} •{' '}
                                <strong className="text-slate-900">
                                  ฿{iss.actual_cost.toLocaleString()}
                                </strong>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickStatusChange(iss, 'Resolved');
                                }}
                                title="Mark as Resolved & Move to Archive"
                                className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 font-bold text-[10px] inline-flex items-center gap-1 transition"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Resolve
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Drag-and-Drop Resolve & Archive Bar at bottom of Kanban */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (dragOverColumn !== 'Resolved') setDragOverColumn('Resolved');
            }}
            onDragLeave={() => {
              if (dragOverColumn === 'Resolved') setDragOverColumn(null);
            }}
            onDrop={() => handleDropOnColumn('Resolved')}
            onClick={() => setViewMode('archive')}
            className={`cursor-pointer p-4 rounded-2xl border-2 border-dashed transition-all flex flex-col sm:flex-row items-center justify-between gap-3 ${
              dragOverColumn === 'Resolved'
                ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-300 scale-[1.005]'
                : 'border-slate-300 bg-white hover:border-emerald-400 hover:bg-emerald-50/30'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-slate-900">
                  Resolved & Closed Ticket Archive ({archivedIssuesAll.length} Archived Tickets)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Drag any ticket card here to mark it as <strong>Resolved</strong> and move it
                  into the Archive, or click here to open the Archive.
                </p>
              </div>
            </div>
            <span className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold whitespace-nowrap">
              Open Archive ({archivedIssuesAll.length}) →
            </span>
          </div>
        </div>
      ) : viewMode === 'list' ? (
        /* =================================================================== */
        /* 2. ACTIVE LIST VIEW                                                 */
        /* =================================================================== */
        <div className="space-y-3">
          {filteredActive.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900">All Active Issues Cleared!</h3>
              <p className="text-xs text-slate-500">
                Resolved and closed tickets are stored in the Archive ({archivedIssuesAll.length}{' '}
                archived).
              </p>
              <button
                type="button"
                onClick={() => setViewMode('archive')}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
              >
                <Archive className="w-3.5 h-3.5" /> View Archived Tickets ({archivedIssuesAll.length})
              </button>
            </div>
          ) : (
            filteredActive.map((iss) => {
              const imgCount = iss.issue_images?.length || 0;
              const docCount = iss.issue_documents?.length || 0;
              return (
                <div
                  key={iss.id}
                  onClick={() => openEditIssue(iss)}
                  className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-indigo-400 hover:shadow-md transition cursor-pointer shadow-2xs flex flex-col lg:flex-row lg:items-start justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800">
                        {iss.ticket_no}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectUnit(iss.unit_id);
                        }}
                        className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1"
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        {iss.unit_code} ({iss.project_name})
                      </button>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-md font-semibold ${getPriorityBadgeClass(
                          iss.priority
                        )}`}
                      >
                        {iss.priority} Priority
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                        {iss.category}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-md font-semibold ${getRespBadgeClass(
                          iss.responsible_party
                        )}`}
                      >
                        Resp: {iss.responsible_party}
                      </span>
                      {imgCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200">
                          <ImageIcon className="w-3.5 h-3.5" />
                          {imgCount} Photo{imgCount > 1 ? 's' : ''}
                        </span>
                      )}
                      {docCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                          <FileText className="w-3.5 h-3.5" />
                          {docCount} Doc{docCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900">{iss.title}</h3>
                    {iss.description && <p className="text-xs text-slate-600">{iss.description}</p>}

                    {iss.resolution_notes && (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700">
                        <strong className="text-slate-900">Resolution / Technician Log: </strong>
                        {iss.resolution_notes}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                      <span>
                        Reported: <strong className="text-slate-700">{iss.reported_date}</strong>{' '}
                        (by {iss.reported_by})
                      </span>
                      <span>
                        Landlord:{' '}
                        <strong className="text-slate-700">{iss.landlord_name || 'N/A'}</strong>
                      </span>
                      {iss.developer_name && (
                        <span>
                          Developer:{' '}
                          <strong className="text-slate-700">{iss.developer_name}</strong>
                        </span>
                      )}
                      <span>
                        Vendor/Team:{' '}
                        <strong className="text-slate-700">
                          {iss.vendor_or_contractor || 'TBD'}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex sm:flex-row lg:flex-col items-end justify-between gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 min-w-[220px]"
                  >
                    <div className="text-right">
                      <select
                        value={iss.status}
                        onChange={(e) => handleQuickStatusChange(iss, e.target.value)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-xl border cursor-pointer ${
                          iss.status === 'In Progress'
                            ? 'bg-amber-50 border-amber-200 text-amber-800'
                            : iss.status === 'Waiting Developer/Parts'
                            ? 'bg-purple-50 border-purple-200 text-purple-800'
                            : 'bg-rose-50 border-rose-200 text-rose-700'
                        }`}
                      >
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Waiting Developer/Parts">Waiting Developer/Parts</option>
                        <option value="Resolved">Resolved (Move to Archive)</option>
                        <option value="Closed">Closed (Move to Archive)</option>
                      </select>
                      <div className="text-xs text-slate-600 mt-2">
                        Est: <strong>฿{iss.estimated_cost.toLocaleString()}</strong> • Actual:{' '}
                        <strong className="text-slate-900">
                          ฿{iss.actual_cost.toLocaleString()}
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleQuickStatusChange(iss, 'Resolved')}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 text-xs font-bold flex items-center gap-1 transition"
                        title="Mark Resolved & Move to Archive"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditIssue(iss)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Open
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* =================================================================== */
        /* 3. ARCHIVE VIEW (RESOLVED & CLOSED TICKETS)                         */
        /* =================================================================== */
        <div className="space-y-4">
          <div className="bg-slate-900 text-white px-5 py-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold">
                  Archived Issue & Defect Tickets ({filteredArchived.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Completed maintenance, landlord repairs, and developer warranty claims marked as
                  Resolved or Closed.
                </p>
              </div>
            </div>
            <div className="text-right text-xs">
              <span className="text-slate-400 block">Total Archived Actual Cost</span>
              <span className="text-base font-extrabold text-emerald-400">
                ฿
                {filteredArchived
                  .reduce((acc, i) => acc + (i.actual_cost || 0), 0)
                  .toLocaleString()}
              </span>
            </div>
          </div>

          {filteredArchived.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 text-xs">
              No archived tickets match your current filter.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredArchived.map((iss) => {
                const imgCount = iss.issue_images?.length || 0;
                const docCount = iss.issue_documents?.length || 0;
                return (
                  <div
                    key={iss.id}
                    onClick={() => openEditIssue(iss)}
                    className="bg-white/90 rounded-2xl border border-slate-200 p-5 hover:border-indigo-400 hover:shadow-md transition cursor-pointer shadow-2xs flex flex-col lg:flex-row lg:items-start justify-between gap-4"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-slate-200 text-slate-800">
                          {iss.ticket_no}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                          <Archive className="w-3 h-3" />
                          Archived ({iss.status})
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectUnit(iss.unit_id);
                          }}
                          className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1"
                        >
                          <Building2 className="w-3.5 h-3.5" />
                          {iss.unit_code} ({iss.project_name})
                        </button>
                        <span className="text-xs px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                          {iss.category}
                        </span>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-md font-semibold ${getRespBadgeClass(
                            iss.responsible_party
                          )}`}
                        >
                          Resp: {iss.responsible_party}
                        </span>
                        {imgCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200">
                            <ImageIcon className="w-3.5 h-3.5" />
                            {imgCount} Photo{imgCount > 1 ? 's' : ''}
                          </span>
                        )}
                        {docCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                            <FileText className="w-3.5 h-3.5" />
                            {docCount} Doc{docCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-slate-900">{iss.title}</h3>
                      {iss.description && (
                        <p className="text-xs text-slate-600">{iss.description}</p>
                      )}

                      {iss.resolution_notes && (
                        <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80 text-xs text-slate-700">
                          <strong className="text-emerald-950">
                            Final Resolution / Technician Log:{' '}
                          </strong>
                          {iss.resolution_notes}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                        <span>
                          Reported: <strong className="text-slate-700">{iss.reported_date}</strong>
                        </span>
                        <span>
                          Resolved:{' '}
                          <strong className="text-emerald-700">
                            {iss.resolved_date || 'Completed'}
                          </strong>
                        </span>
                        <span>
                          Landlord:{' '}
                          <strong className="text-slate-700">{iss.landlord_name || 'N/A'}</strong>
                        </span>
                        <span>
                          Vendor/Team:{' '}
                          <strong className="text-slate-700">
                            {iss.vendor_or_contractor || 'N/A'}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex sm:flex-row lg:flex-col items-end justify-between gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 min-w-[210px]"
                    >
                      <div className="text-right">
                        <div className="text-xs text-slate-600">
                          Est: <strong>฿{iss.estimated_cost.toLocaleString()}</strong> • Actual:{' '}
                          <strong className="text-slate-900">
                            ฿{iss.actual_cost.toLocaleString()}
                          </strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleQuickStatusChange(iss, 'In Progress')}
                          className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-semibold flex items-center gap-1"
                          title="Reopen ticket and move back to Active board"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Reopen
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditIssue(iss)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Inspect
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* EXPANDED ISSUE TICKET DETAIL & UPDATE MODAL / DRAWER */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 max-h-[92vh] flex flex-col"
          >
            {/* Top Ticket Banner */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-indigo-500 text-white">
                    {form.ticket_no || 'NEW TICKET'}
                  </span>
                  {isArchivedStatus(form.status) && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      <Archive className="w-3.5 h-3.5" /> Archived ({form.status})
                    </span>
                  )}
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-md font-bold ${getPriorityBadgeClass(
                      form.priority
                    )}`}
                  >
                    {form.priority} Priority
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-200 font-medium">
                    {form.category}
                  </span>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-md font-semibold ${getRespBadgeClass(
                      form.responsible_party
                    )}`}
                  >
                    Resp: {form.responsible_party}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white pt-1">
                  {editingIssue
                    ? form.title || `Issue Ticket ${editingIssue.ticket_no}`
                    : 'Log New Unit Issue / Defect Claim'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Close (ESC)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Interactive Workflow Status Pipeline Bar */}
            <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                  Stage:
                </span>
                {ALL_STATUSES.map((st) => {
                  const active = form.status === st;
                  const willArchive = isArchivedStatus(st);
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={async () => {
                        if (editingIssue && willArchive) {
                          // Immediately save & archive when clicking Resolved or Closed on an existing ticket
                          await saveFormWithStatus(st);
                        } else {
                          const todayStr = new Date().toISOString().split('T')[0];
                          setForm({
                            ...form,
                            status: st,
                            resolved_date:
                              willArchive && !form.resolved_date ? todayStr : form.resolved_date,
                          });
                        }
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        active
                          ? willArchive
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : st === 'In Progress'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : st === 'Waiting Developer/Parts'
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'bg-rose-600 text-white shadow-xs'
                          : willArchive
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                      title={
                        willArchive
                          ? `Mark ticket as ${st} and move into Archive`
                          : `Set stage to ${st}`
                      }
                    >
                      {active ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : willArchive ? (
                        <Archive className="w-3 h-3 opacity-75" />
                      ) : null}
                      {willArchive ? `${st} (Archive)` : st}
                    </button>
                  );
                })}
              </div>

              {selectedUnitObj && (
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    onSelectUnit(selectedUnitObj.id);
                  }}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  Inspect Unit {selectedUnitObj.unit_code}
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Scrollable Body */}
            <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto text-xs flex-1">
              {/* Context Summary Card (Unit, Landlord, Developer, Active Tenant) */}
              {selectedUnitObj && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Unit & Building
                    </span>
                    <span className="font-bold text-slate-900 block mt-0.5">
                      {selectedUnitObj.unit_code}
                    </span>
                    <span className="text-[11px] text-slate-600">
                      {selectedUnitObj.project_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Landlord (Owner)
                    </span>
                    <span className="font-bold text-slate-900 block mt-0.5">
                      {selectedUnitObj.landlord_name || editingIssue?.landlord_name || 'N/A'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {selectedUnitObj.property_type} • Fl. {selectedUnitObj.floor}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Developer / Warranty
                    </span>
                    <span className="font-bold text-slate-900 block mt-0.5">
                      {selectedUnitObj.developer_name || editingIssue?.developer_name || 'N/A'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {selectedUnitObj.warranty_expiry_date
                        ? `Exp: ${selectedUnitObj.warranty_expiry_date}`
                        : 'Standard coverage'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Linked Lease / Tenant
                    </span>
                    <span className="font-bold text-slate-900 block mt-0.5">
                      {selectedLeaseObj ? selectedLeaseObj.tenant_name : 'No Active Lease'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {selectedLeaseObj ? selectedLeaseObj.contract_no : 'Vacant / Pre-lease'}
                    </span>
                  </div>
                </div>
              )}

              {/* Row 1: Ticket No, Property Unit, Linked Lease */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Ticket No. *</label>
                  <input
                    type="text"
                    required
                    value={form.ticket_no}
                    onChange={(e) => setForm({ ...form, ticket_no: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Property Unit *</label>
                  <select
                    required
                    value={form.unit_id}
                    onChange={(e) => {
                      const newUnitId = Number(e.target.value);
                      const matchingLease = leases.find(
                        (l) =>
                          l.unit_id === newUnitId &&
                          (l.status === 'Active' || l.status === 'Expiring Soon')
                      );
                      setForm({
                        ...form,
                        unit_id: newUnitId,
                        lease_id: matchingLease?.id || '',
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.unit_code} — {u.project_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Linked Lease Contract
                  </label>
                  <select
                    value={form.lease_id}
                    onChange={(e) =>
                      setForm({ ...form, lease_id: e.target.value ? Number(e.target.value) : '' })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  >
                    <option value="">— None / General Unit Issue —</option>
                    {unitLeases.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.contract_no} ({l.tenant_name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Issue Title */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Issue Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Master Bedroom AC Water Leak / Balcony Door Seal Defect"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-medium text-slate-900"
                />
              </div>

              {/* Category, Priority, Status, Reported By */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  >
                    <option>Plumbing</option>
                    <option>Air Conditioning</option>
                    <option>Electrical</option>
                    <option>Structural/Defect</option>
                    <option>Appliance</option>
                    <option>Furniture</option>
                    <option>Pest Control</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Waiting Developer/Parts">Waiting Developer/Parts</option>
                    <option value="Resolved">Resolved (Archive)</option>
                    <option value="Closed">Closed (Archive)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Reported By</label>
                  <select
                    value={form.reported_by}
                    onChange={(e) => setForm({ ...form, reported_by: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  >
                    <option>Tenant</option>
                    <option>Landlord</option>
                    <option>Agent Inspection</option>
                    <option>Juristic</option>
                  </select>
                </div>
              </div>

              {/* Responsibility & Vendor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Responsible Party (Cost & Action)
                  </label>
                  <select
                    value={form.responsible_party}
                    onChange={(e) => setForm({ ...form, responsible_party: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  >
                    <option>Landlord</option>
                    <option>Developer Warranty</option>
                    <option>Tenant</option>
                    <option>Building Juristic</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Vendor / Contractor / Defect Team
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sansiri HomeCare / CoolBKK Service"
                    value={form.vendor_or_contractor}
                    onChange={(e) => setForm({ ...form, vendor_or_contractor: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              {/* Costs & Dates */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Est. Cost (THB)</label>
                  <FormattedNumberInput
                    value={form.estimated_cost}
                    maxDecimals={2}
                    onValueChange={(val) => setForm({ ...form, estimated_cost: val })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 font-semibold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Actual Cost (THB)
                  </label>
                  <FormattedNumberInput
                    value={form.actual_cost}
                    maxDecimals={2}
                    onValueChange={(val) => setForm({ ...form, actual_cost: val })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 font-bold text-indigo-700"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Reported Date</label>
                  <input
                    type="date"
                    value={form.reported_date}
                    onChange={(e) => setForm({ ...form, reported_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Resolved Date</label>
                  <input
                    type="date"
                    value={form.resolved_date}
                    onChange={(e) => setForm({ ...form, resolved_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300"
                  />
                </div>
              </div>

              {/* Problem Description */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Problem Description & Inspection Details
                </label>
                <textarea
                  rows={3}
                  placeholder="Detailed description of the issue, symptoms, or defect location..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 leading-relaxed"
                />
              </div>

              {/* Resolution Notes / Technician Log */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">
                    Resolution / Technician Log & Follow-up Progress
                  </label>
                  <button
                    type="button"
                    onClick={appendTimestampNote}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                  >
                    <Clock className="w-3 h-3" />+ Insert Today&apos;s Date Stamp
                  </button>
                </div>
                <textarea
                  rows={3}
                  placeholder="Record technician findings, landlord approval, quotation details, or warranty claim status..."
                  value={form.resolution_notes}
                  onChange={(e) => setForm({ ...form, resolution_notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-amber-50/30 leading-relaxed"
                />
              </div>

              {/* HIGH-RES MOBILE / CAMERA ISSUE PHOTOS & QUOTATION DOCUMENTS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                {/* Left Column: High-Res Issue Photos */}
                <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">
                          Issue & Defect Photos ({form.issue_images.length})
                        </h4>
                        <p className="text-[10px] text-slate-500">
                          Uncompressed High-Res Mobile Camera (48MP/200MP, HEIC, ProRAW, 4K JPG/PNG)
                        </p>
                      </div>
                    </div>
                  </div>

                  <HighResImageUploader
                    images={form.issue_images}
                    onChange={(newImages) => setForm({ ...form, issue_images: newImages })}
                    title="Drag & Drop or Copy & Paste High-Res Issue Photos"
                    subtitle="Supports latest mobile phone high-res photos (HEIC, ProRAW, 4K JPG, PNG, WEBP)"
                    hideCoverBadge
                  />
                </div>

                {/* Right Column: Quotations, Invoices, Warranty Claims & Reports */}
                <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-3 flex flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">
                          Quotations, Invoices & Warranty Docs ({form.issue_documents.length})
                        </h4>
                        <p className="text-[10px] text-slate-500">
                          Upload contractor quotes, repair receipts, or warranty claim PDFs/scans
                        </p>
                      </div>
                    </div>

                    <select
                      value={defaultDocType}
                      onChange={(e) => setDefaultDocType(e.target.value)}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-[11px] font-semibold text-slate-700"
                      title="Default category for new uploads"
                    >
                      {DOC_TYPES.map((dt) => (
                        <option key={dt} value={dt}>
                          As: {dt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Document Dropzone (Drag & Drop + Copy & Paste) */}
                  <div
                    tabIndex={0}
                    onPaste={(e) => {
                      const files = extractFilesFromClipboard(e.clipboardData, false);
                      if (files.length > 0) {
                        (e.nativeEvent as any).__handledByUploader = true;
                        e.preventDefault();
                        e.stopPropagation();
                        handleUploadDocuments(files);
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDocDragging(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDocDragging(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDocDragging(false);
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        handleUploadDocuments(e.dataTransfer.files);
                      }
                    }}
                    onClick={() => docInputRef.current?.click()}
                    className={`cursor-pointer rounded-2xl border-2 border-dashed transition-all p-4 text-center flex flex-col items-center justify-center focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      docDragging
                        ? 'border-amber-500 bg-amber-50/80 scale-[1.01]'
                        : 'border-slate-300 bg-white hover:border-amber-400 hover:bg-amber-50/30'
                    }`}
                  >
                    <input
                      ref={docInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,image/*,.heic,.heif"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleUploadDocuments(e.target.files);
                          e.target.value = '';
                        }
                      }}
                    />
                    {docUploading ? (
                      <div className="flex flex-col items-center gap-2 py-2">
                        <Loader2 className="w-6 h-6 text-amber-600 animate-spin" />
                        <span className="text-xs font-semibold text-amber-800">
                          Uploading document(s)...
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-1.5">
                          <UploadCloud className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-bold text-slate-800">
                          Drag & Drop or Copy & Paste Quotation / Document Here
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Supports PDF, Word, Excel, or High-Res Photo Scans
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-amber-800 text-[11px] font-bold hover:bg-amber-50">
                            Browse Files
                          </span>
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const files = await readClipboardFilesButton();
                                if (files.length > 0) {
                                  await handleUploadDocuments(files);
                                }
                              } catch {
                                // User can press Ctrl+V directly
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold hover:bg-amber-100 transition"
                            title="Paste copied quotation or scan from clipboard"
                          >
                            <ClipboardPaste className="w-3.5 h-3.5" />
                            Paste Quotation (Ctrl+V)
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Uploaded Documents List */}
                  {form.issue_documents.length > 0 && (
                    <div className="space-y-2 pt-1 max-h-48 overflow-y-auto">
                      {form.issue_documents.map((doc, idx) => (
                        <div
                          key={`${doc.url}-${idx}`}
                          className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Paperclip className="w-4 h-4 text-amber-600 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-bold text-indigo-700 hover:underline truncate block"
                                title={doc.name}
                              >
                                {doc.name}
                              </a>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                {doc.size_bytes ? (
                                  <span>{formatFileSize(doc.size_bytes)}</span>
                                ) : null}
                                {doc.uploaded_at && <span>• {doc.uploaded_at}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <select
                              value={doc.doc_type || 'Quotation'}
                              onChange={(e) => handleUpdateDocType(idx, e.target.value)}
                              className="px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-700"
                            >
                              {DOC_TYPES.map((dt) => (
                                <option key={dt} value={dt}>
                                  {dt}
                                </option>
                              ))}
                            </select>

                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                              title="Open / Download Document"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>

                            <button
                              type="button"
                              onClick={() => handleRemoveDocument(idx)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              title="Remove Document"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Actions Footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
                <div className="flex flex-wrap items-center gap-2">
                  {editingIssue && !isArchivedStatus(form.status) && (
                    <>
                      <button
                        type="button"
                        onClick={() => saveFormWithStatus('Resolved')}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition inline-flex items-center gap-1.5 shadow-xs"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Resolve & Move to Archive
                      </button>
                      <button
                        type="button"
                        onClick={() => saveFormWithStatus('Closed')}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 text-white font-bold hover:bg-slate-900 transition inline-flex items-center gap-1.5"
                      >
                        <Archive className="w-4 h-4" />
                        Close & Move to Archive
                      </button>
                    </>
                  )}
                  {editingIssue && isArchivedStatus(form.status) && (
                    <button
                      type="button"
                      onClick={() => saveFormWithStatus('In Progress')}
                      className="px-3.5 py-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-300 font-bold hover:bg-amber-100 transition inline-flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reopen Ticket (Move Back to Active)
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                  >
                    Cancel (ESC)
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 shadow-xs transition"
                  >
                    {editingIssue ? 'Save & Update Ticket' : 'Create Issue Ticket'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
