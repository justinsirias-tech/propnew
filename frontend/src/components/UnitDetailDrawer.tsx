import React, { useEffect, useState } from 'react';
import {
  X,
  Building2,
  User,
  ShieldCheck,
  Wrench,
  FileText,
  MessageSquare,
  Key,
  Zap,
  Droplets,
  Plus,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Image as ImageIcon,
  Coins,
  Scale,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { api } from '../api';
import {
  PropertyUnit,
  Developer,
  Contact,
  LeaseContract,
  UnitIssue,
  CommunicationLog,
} from '../types';
import { HighResImageUploader } from './HighResImageUploader';
import { PropertyFinancialReports } from './PropertyFinancialReports';
import { useEscapeKey } from '../utils/clipboardAndEsc';

interface UnitDetailDrawerProps {
  unitId: number | null;
  onClose: () => void;
  onRefreshGlobal: () => void;
  onOpenNewIssueForUnit: (unit: PropertyUnit) => void;
  onOpenCalculatorForUnit?: (unit: PropertyUnit) => void;
}

export const UnitDetailDrawer: React.FC<UnitDetailDrawerProps> = ({
  unitId,
  onClose,
  onRefreshGlobal,
  onOpenNewIssueForUnit,
  onOpenCalculatorForUnit,
}) => {
  const [loading, setLoading] = useState(false);
  const [unit, setUnit] = useState<PropertyUnit | null>(null);
  const [developer, setDeveloper] = useState<Developer | null>(null);
  const [landlord, setLandlord] = useState<Contact | null>(null);
  const [leases, setLeases] = useState<LeaseContract[]>([]);
  const [issues, setIssues] = useState<UnitIssue[]>([]);
  const [comms, setComms] = useState<CommunicationLog[]>([]);
  const [activeTab, setActiveTab] = useState<'financials' | 'issues' | 'photos' | 'leases' | 'comms' | 'specs'>('financials');

  // New note state
  const [noteChannel, setNoteChannel] = useState('LINE');
  const [noteSubject, setNoteSubject] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);

  const fetchDetails = async (id: number) => {
    setLoading(true);
    try {
      const data = await api.getUnitDetails(id);
      setUnit(data.unit);
      setDeveloper(data.developer);
      setLandlord(data.landlord);
      setLeases(data.leases);
      setIssues(data.issues);
      setComms(data.communications);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (unitId) {
      fetchDetails(unitId);
    }
  }, [unitId]);

  // Close Unit 360 Drawer on ESC key
  useEscapeKey(() => onClose(), Boolean(unitId));

  if (!unitId) return null;

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteSubject.trim() || !noteContent.trim() || !unit) return;
    await api.createCommunication({
      channel: noteChannel,
      direction: 'Outbound',
      subject: noteSubject,
      content: noteContent,
      logged_by: 'Agent',
      unit_id: unit.id,
      contact_id: unit.landlord_id || undefined,
      developer_id: unit.developer_id || undefined,
    });
    setNoteSubject('');
    setNoteContent('');
    fetchDetails(unit.id);
    onRefreshGlobal();
  };

  const handleQuickResolveIssue = async (issue: UnitIssue) => {
    const todayStr = new Date().toISOString().split('T')[0];
    await api.updateIssue(issue.id, {
      ...issue,
      status: 'Resolved',
      resolved_date: todayStr,
    });
    if (unit) fetchDetails(unit.id);
    onRefreshGlobal();
  };

  const handleUpdateUnitPhotos = async (newImages: string[], newCover: string) => {
    if (!unit) return;
    const updated = await api.updateUnit(unit.id, {
      ...unit,
      gallery_images: newImages,
      image_url: newCover,
    });
    setUnit(updated);
    onRefreshGlobal();
  };

  return (
    <div
      className={`fixed inset-0 z-50 ${
        isFullScreen ? 'flex' : 'flex justify-end'
      } bg-slate-900/50 backdrop-blur-xs transition-all`}
    >
      <div
        className={`relative ${
          isFullScreen ? 'w-full max-w-none' : 'w-full max-w-3xl xl:max-w-4xl'
        } bg-white h-full shadow-2xl flex flex-col overflow-hidden transition-all duration-150`}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-semibold">
                {unit?.unit_code || 'Loading...'}
              </span>
              <h2 className="text-lg font-bold">{unit?.project_name}</h2>
              {unit && (
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                    unit.status === 'Occupied'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : unit.status === 'Available'
                      ? 'bg-sky-500/20 text-sky-300'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {unit.status}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {unit?.city || 'Bangkok'} • {unit?.property_category || 'Residential'} ({unit?.property_type}) •{' '}
              {unit?.building} • {unit?.floor} • {unit?.bedrooms} Bed / {unit?.bathrooms} Bath •{' '}
              {unit?.size_sqm} sqm
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title={isFullScreen ? "Drawer Mode" : "Fit Full Screen"}
            >
              {isFullScreen ? (
                <Minimize2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <Maximize2 className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading || !unit ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
            Loading 360° Unit CRM History...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Stakeholder Cards: Landlord, Developer, Current Tenant */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Landlord Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  Landlord (Owner)
                </div>
                {landlord ? (
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{landlord.full_name}</p>
                    <p className="text-xs text-slate-600 flex items-center gap-1 mt-1">
                      <Phone className="w-3 h-3" /> {landlord.phone}
                    </p>
                    {landlord.line_or_whatsapp && (
                      <p className="text-xs text-indigo-600 mt-0.5">{landlord.line_or_whatsapp}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No landlord linked</p>
                )}
              </div>

              {/* Developer & Warranty Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Developer & Warranty
                </div>
                {developer ? (
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{developer.company_name}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Warranty Ends:{' '}
                      <span className="font-medium text-slate-800">
                        {unit.warranty_expiry_date || 'N/A'}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {developer.contact_person}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No developer linked</p>
                )}
              </div>

              {/* Active Lease / Pricing & Auto Sqm Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  <FileText className="w-3.5 h-3.5 text-amber-600" />
                  Tenancy & Price/Sqm
                </div>
                {unit.current_tenant_name ? (
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{unit.current_tenant_name}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Ends: <span className="font-medium">{unit.current_lease_end}</span>
                    </p>
                  </div>
                ) : (
                  <p className="text-xs font-medium text-sky-700">Vacant / Available</p>
                )}
                <div className="mt-1.5 space-y-0.5 text-xs">
                  {unit.target_rent_price > 0 && (
                    <p className="text-emerald-700 font-bold">
                      Rent: ฿{unit.target_rent_price.toLocaleString('en-US')}/mo{' '}
                      {unit.size_sqm > 0 && (
                        <span className="text-[11px] font-semibold text-slate-500">
                          (฿
                          {(unit.target_rent_price / unit.size_sqm).toLocaleString('en-US', {
                            maximumFractionDigits: 2,
                          })}
                          /sqm)
                        </span>
                      )}
                    </p>
                  )}
                  {unit.target_sale_price > 0 && (
                    <p className="text-indigo-700 font-bold">
                      Sale: ฿{unit.target_sale_price.toLocaleString('en-US')}{' '}
                      {unit.size_sqm > 0 && (
                        <span className="text-[11px] font-semibold text-slate-500">
                          (฿
                          {(unit.target_sale_price / unit.size_sqm).toLocaleString('en-US', {
                            maximumFractionDigits: 2,
                          })}
                          /sqm)
                        </span>
                      )}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('financials')}
                  className="mt-2.5 w-full py-1.5 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-extrabold text-[11px] flex items-center justify-center gap-1.5 transition shadow-2xs"
                >
                  <Coins className="w-3.5 h-3.5 text-emerald-600" />
                  <span>View Rent & Sale Financial Reports</span>
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200 flex items-center justify-between overflow-x-auto">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveTab('financials')}
                  className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'financials'
                      ? 'border-emerald-600 text-emerald-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Coins className="w-4 h-4 text-emerald-600" />
                  Rent & Sale Reports
                </button>
                <button
                  onClick={() => setActiveTab('issues')}
                  className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'issues'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Wrench className="w-4 h-4" />
                  Unit Issues ({issues.length})
                </button>
                <button
                  onClick={() => setActiveTab('photos')}
                  className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'photos'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <ImageIcon className="w-4 h-4" />
                  Unit Pictures ({unit.gallery_images?.length || (unit.image_url ? 1 : 0)})
                </button>
                <button
                  onClick={() => setActiveTab('leases')}
                  className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'leases'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Lease Contracts ({leases.length})
                </button>
                <button
                  onClick={() => setActiveTab('comms')}
                  className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'comms'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  CRM Log ({comms.length})
                </button>
                <button
                  onClick={() => setActiveTab('specs')}
                  className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'specs'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Key className="w-4 h-4" />
                  Access & Meters
                </button>
              </div>
            </div>

            {/* Tab Content: Rent & Sale Financial Reports */}
            {activeTab === 'financials' && (
              <PropertyFinancialReports
                unit={unit}
                onOpenFullCalculator={onOpenCalculatorForUnit}
              />
            )}

            {/* Tab Content: High-Res Unit Pictures & Drag-and-Drop */}
            {activeTab === 'photos' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      High-Resolution Unit Gallery — {unit.unit_code}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Drag and drop high-res photos below. Click any photo to view full resolution or
                      set as cover image.
                    </p>
                  </div>
                </div>
                <HighResImageUploader
                  images={
                    unit.gallery_images && unit.gallery_images.length > 0
                      ? unit.gallery_images
                      : unit.image_url
                      ? [unit.image_url]
                      : []
                  }
                  coverImage={unit.image_url}
                  onChange={handleUpdateUnitPhotos}
                />
              </div>
            )}

            {/* Tab Content: Unit Issues History */}
            {activeTab === 'issues' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">
                    Complete Maintenance & Defect Log for {unit.unit_code}
                  </h3>
                  <button
                    onClick={() => onOpenNewIssueForUnit(unit)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Log Unit Issue
                  </button>
                </div>

                {issues.length === 0 ? (
                  <div className="p-8 text-center rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm">
                    No issues recorded for this unit yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {issues.map((iss) => (
                      <div
                        key={iss.id}
                        className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-semibold text-slate-500">
                                {iss.ticket_no}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                                {iss.category}
                              </span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                                  iss.responsible_party === 'Developer Warranty'
                                    ? 'bg-purple-100 text-purple-800'
                                    : iss.responsible_party === 'Landlord'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                Resp: {iss.responsible_party}
                              </span>
                            </div>
                            <h4 className="font-semibold text-slate-900 text-sm mt-1">
                              {iss.title}
                            </h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                                iss.status === 'Resolved' || iss.status === 'Closed'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : iss.status === 'In Progress'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-700'
                              }`}
                            >
                              {iss.status}
                            </span>
                            {iss.status !== 'Resolved' && iss.status !== 'Closed' && (
                              <button
                                onClick={() => handleQuickResolveIssue(iss)}
                                title="Mark Resolved"
                                className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 text-xs font-medium flex items-center gap-1 border border-emerald-200"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                              </button>
                            )}
                          </div>
                        </div>
                        {iss.description && (
                          <p className="text-xs text-slate-600 leading-relaxed">{iss.description}</p>
                        )}
                        {iss.resolution_notes && (
                          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-700">
                            <span className="font-semibold text-slate-900">Progress / Resolution: </span>
                            {iss.resolution_notes}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                          <span>
                            Reported: <strong>{iss.reported_date}</strong> by {iss.reported_by}
                          </span>
                          <span>Vendor: {iss.vendor_or_contractor || 'TBD'}</span>
                          <span>
                            Est: ฿{iss.estimated_cost.toLocaleString()} | Actual: ฿
                            {iss.actual_cost.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab Content: Lease Contracts */}
            {activeTab === 'leases' && (
              <div className="space-y-3">
                {leases.length === 0 ? (
                  <div className="p-8 text-center rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm">
                    No lease contracts recorded for this unit.
                  </div>
                ) : (
                  leases.map((l) => (
                    <div
                      key={l.id}
                      className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-indigo-600">
                            {l.contract_no}
                          </span>
                          <span className="text-sm font-semibold text-slate-900">
                            Tenant: {l.tenant_name}
                          </span>
                        </div>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                            l.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-700'
                              : l.status === 'Expiring Soon'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {l.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-slate-600 mt-1">
                        <div>
                          Period: <strong>{l.start_date}</strong> to <strong>{l.end_date}</strong>
                        </div>
                        <div>
                          Rent: <strong>฿{l.monthly_rent.toLocaleString()}/mo</strong>
                        </div>
                        <div>
                          Deposit: <strong>฿{l.security_deposit.toLocaleString()}</strong>
                        </div>
                      </div>
                      {l.special_terms && (
                        <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">
                          Terms: {l.special_terms}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab Content: CRM Activity Log */}
            {activeTab === 'comms' && (
              <div className="space-y-4">
                <form
                  onSubmit={handleAddNote}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                >
                  <div className="text-xs font-semibold text-slate-700">
                    Log CRM Update for {unit.unit_code}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      value={noteChannel}
                      onChange={(e) => setNoteChannel(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                    >
                      <option>LINE</option>
                      <option>WhatsApp</option>
                      <option>Phone Call</option>
                      <option>Email</option>
                      <option>Inspection Note</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Subject (e.g. Sent AC quote to landlord)"
                      value={noteSubject}
                      onChange={(e) => setNoteSubject(e.target.value)}
                      className="sm:col-span-2 px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                      required
                    />
                  </div>
                  <textarea
                    placeholder="Details of communication or unit note..."
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                    required
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
                    >
                      Add to Timeline
                    </button>
                  </div>
                </form>

                <div className="space-y-3">
                  {comms.map((c) => (
                    <div key={c.id} className="p-3.5 rounded-xl border border-slate-200 bg-white">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-indigo-600">
                          [{c.channel}] {c.subject}
                        </span>
                        <span className="text-slate-400">
                          {new Date(c.created_at).toLocaleDateString()} • {c.logged_by}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1.5">{c.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab Content: Access & Meters */}
            {activeTab === 'specs' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
                    <Key className="w-4 h-4 text-amber-600" />
                    Keycards, Lockbox & PIN Info
                  </div>
                  <p className="text-sm text-slate-800 font-medium">
                    {unit.key_card_and_access_info || 'Not specified'}
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
                    <Zap className="w-4 h-4 text-yellow-600" />
                    Electricity & Water Meters
                  </div>
                  <p className="text-sm text-slate-800">
                    Electric: <strong>{unit.meter_electric_no || 'N/A'}</strong>
                  </p>
                  <p className="text-sm text-slate-800">
                    Water: <strong>{unit.meter_water_no || 'N/A'}</strong>
                  </p>
                </div>
                <div className="sm:col-span-2 p-4 rounded-xl border border-slate-200 bg-white">
                  <div className="text-xs font-semibold text-slate-500 mb-1">Unit Notes & Remarks</div>
                  <p className="text-sm text-slate-700">{unit.notes || 'No extra notes.'}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
