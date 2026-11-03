import React, { useState, useEffect } from 'react';
import {
  Users,
  Building,
  Phone,
  Mail,
  MessageCircle,
  Plus,
  Search,
  Star,
  Landmark,
  Wrench,
  FileText,
  Home,
  X,
  Edit3,
  Trash2,
  Briefcase,
  UserCheck,
  HardHat,
  Building2,
} from 'lucide-react';
import { api } from '../api';
import {
  Contact,
  CorporateEmployee,
  Developer,
  PropertyUnit,
  LeaseContract,
  UnitIssue,
  CommunicationLog,
} from '../types';
import { useEscapeKey } from '../utils/clipboardAndEsc';

interface CRMDirectoryViewProps {
  contacts: Contact[];
  developers: Developer[];
  onRefresh: () => void;
  onSelectUnit: (unitId: number) => void;
}

const VENDOR_CATEGORIES = [
  'Air Conditioning & HVAC',
  'Plumbing & Electrical',
  'Appliance & White Goods Repair',
  'General Contractor & Renovation',
  'Structural & Waterproofing',
  'Pest Control',
  'Deep Cleaning & Handover',
  'Furniture & Curtains',
  'Legal / Accounting / Corporate Services',
  'Other Vendor Service',
];

export const CRMDirectoryView: React.FC<CRMDirectoryViewProps> = ({
  contacts,
  developers,
  onRefresh,
  onSelectUnit,
}) => {
  const [subTab, setSubTab] = useState<'LANDLORD' | 'TENANT' | 'VENDOR' | 'DEVELOPER'>('LANDLORD');
  const [search, setSearch] = useState('');

  // Selected CRM profile drawer state
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [contactDetail, setContactDetail] = useState<{
    contact: Contact;
    owned_units: PropertyUnit[];
    leases: LeaseContract[];
    issues: UnitIssue[];
    communications: CommunicationLog[];
  } | null>(null);

  const [selectedDevId, setSelectedDevId] = useState<number | null>(null);
  const [devDetail, setDevDetail] = useState<{
    developer: Developer;
    units: PropertyUnit[];
    issues: UnitIssue[];
    communications: CommunicationLog[];
  } | null>(null);

  // Communication form inside drawer
  const [commChannel, setCommChannel] = useState('LINE');
  const [commSubject, setCommSubject] = useState('');
  const [commContent, setCommContent] = useState('');

  // Contact Modal State
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactForm, setContactForm] = useState({
    role: 'LANDLORD',
    entity_type: 'Individual',
    company_name: '',
    tax_id: '',
    service_category: '',
    corporate_employees: [] as CorporateEmployee[],
    full_name: '',
    phone: '',
    email: '',
    line_or_whatsapp: '',
    nationality: 'Thai',
    id_or_passport: '',
    bank_name: '',
    bank_account_no: '',
    bank_account_info: '',
    emergency_contact: '',
    preferred_language: 'English',
    rating: 5,
    notes: '',
  });

  // Developer Modal State
  const [showDevModal, setShowDevModal] = useState(false);
  const [editingDev, setEditingDev] = useState<Developer | null>(null);
  const [devForm, setDevForm] = useState({
    company_name: '',
    contact_person: '',
    phone: '',
    email: '',
    line_id: '',
    address: '',
    warranty_policy: '',
    defect_contact_info: '',
    tax_id: '',
    corporate_employees: [] as CorporateEmployee[],
    notes: '',
  });

  // Stack-aware ESC key handlers: close topmost modal first, then open drawer
  useEscapeKey(() => setSelectedContactId(null), Boolean(selectedContactId));
  useEscapeKey(() => setSelectedDevId(null), Boolean(selectedDevId));
  useEscapeKey(() => setShowContactModal(false), showContactModal);
  useEscapeKey(() => setShowDevModal(false), showDevModal);

  useEffect(() => {
    if (selectedContactId) {
      api.getContactDetails(selectedContactId).then(setContactDetail).catch(console.error);
    } else {
      setContactDetail(null);
    }
  }, [selectedContactId]);

  useEffect(() => {
    if (selectedDevId) {
      api.getDeveloperDetails(selectedDevId).then(setDevDetail).catch(console.error);
    } else {
      setDevDetail(null);
    }
  }, [selectedDevId]);

  const filteredContacts = contacts.filter((c) => {
    const roleMatch =
      subTab === 'LANDLORD'
        ? c.role === 'LANDLORD' || c.role === 'BOTH'
        : subTab === 'TENANT'
        ? c.role === 'TENANT' || c.role === 'BOTH'
        : subTab === 'VENDOR'
        ? c.role === 'VENDOR'
        : false;
    const q = search.toLowerCase();
    const empMatch = (c.corporate_employees || []).some(
      (emp) =>
        emp.name.toLowerCase().includes(q) ||
        (emp.title_or_department || '').toLowerCase().includes(q) ||
        (emp.phone || '').toLowerCase().includes(q) ||
        (emp.email || '').toLowerCase().includes(q)
    );
    const textMatch =
      c.full_name.toLowerCase().includes(q) ||
      (c.company_name || '').toLowerCase().includes(q) ||
      (c.service_category || '').toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.line_or_whatsapp || '').toLowerCase().includes(q) ||
      empMatch;
    return roleMatch && textMatch;
  });

  const filteredDevs = developers.filter((d) => {
    const q = search.toLowerCase();
    const empMatch = (d.corporate_employees || []).some(
      (emp) =>
        emp.name.toLowerCase().includes(q) ||
        (emp.title_or_department || '').toLowerCase().includes(q) ||
        (emp.phone || '').toLowerCase().includes(q)
    );
    return (
      d.company_name.toLowerCase().includes(q) ||
      (d.contact_person || '').toLowerCase().includes(q) ||
      (d.phone || '').toLowerCase().includes(q) ||
      empMatch
    );
  });

  const openNewContact = (defaultRole: string) => {
    setEditingContact(null);
    const isVendor = defaultRole === 'VENDOR';
    setContactForm({
      role: defaultRole,
      entity_type: isVendor ? 'Corporate' : 'Individual',
      company_name: '',
      tax_id: '',
      service_category: isVendor ? 'Air Conditioning & HVAC' : '',
      corporate_employees: isVendor
        ? [
            {
              name: '',
              title_or_department: 'Service & Quotation Coordinator',
              phone: '',
              email: '',
              line_or_whatsapp: '',
              is_primary: true,
              notes: 'Deals with repair quotations, work orders & invoices on behalf of company',
            },
          ]
        : [],
      full_name: '',
      phone: '',
      email: '',
      line_or_whatsapp: '',
      nationality: 'Thai',
      id_or_passport: '',
      bank_name: '',
      bank_account_no: '',
      bank_account_info: '',
      emergency_contact: '',
      preferred_language: 'English',
      rating: 5,
      notes: '',
    });
    setShowContactModal(true);
  };

  const openEditContact = (c: Contact) => {
    setEditingContact(c);
    setContactForm({
      role: c.role,
      entity_type: c.entity_type || (c.company_name ? 'Corporate' : 'Individual'),
      company_name: c.company_name || '',
      tax_id: c.tax_id || '',
      service_category: c.service_category || '',
      corporate_employees: c.corporate_employees ? [...c.corporate_employees] : [],
      full_name: c.full_name,
      phone: c.phone,
      email: c.email || '',
      line_or_whatsapp: c.line_or_whatsapp || '',
      nationality: c.nationality || '',
      id_or_passport: c.id_or_passport || '',
      bank_name: c.bank_name || '',
      bank_account_no: c.bank_account_no || '',
      bank_account_info: c.bank_account_info || '',
      emergency_contact: c.emergency_contact || '',
      preferred_language: c.preferred_language || 'English',
      rating: c.rating || 5,
      notes: c.notes || '',
    });
    setShowContactModal(true);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    const combinedBank =
      contactForm.bank_name || contactForm.bank_account_no
        ? `${contactForm.bank_name || ''} | Acc: ${contactForm.bank_account_no || ''}`
        : contactForm.bank_account_info;
    const cleanedEmployees = (contactForm.corporate_employees || []).filter(
      (emp) => emp.name && emp.name.trim() !== ''
    );
    const payload = {
      ...contactForm,
      corporate_employees: cleanedEmployees,
      bank_account_info: combinedBank,
    };
    if (editingContact) {
      await api.updateContact(editingContact.id, payload);
      if (selectedContactId === editingContact.id) {
        const updated = await api.getContactDetails(editingContact.id);
        setContactDetail(updated);
      }
    } else {
      await api.createContact(payload);
    }
    setShowContactModal(false);
    onRefresh();
  };

  const openNewDev = () => {
    setEditingDev(null);
    setDevForm({
      company_name: '',
      contact_person: '',
      phone: '',
      email: '',
      line_id: '',
      address: '',
      warranty_policy: '',
      defect_contact_info: '',
      tax_id: '',
      corporate_employees: [
        {
          name: '',
          title_or_department: 'After-Sales & Warranty Claim Representative',
          phone: '',
          email: '',
          line_or_whatsapp: '',
          is_primary: true,
          notes: 'Handles defect inspections & warranty contracts on behalf of developer',
        },
      ],
      notes: '',
    });
    setShowDevModal(true);
  };

  const openEditDev = (d: Developer) => {
    setEditingDev(d);
    setDevForm({
      company_name: d.company_name,
      contact_person: d.contact_person || '',
      phone: d.phone || '',
      email: d.email || '',
      line_id: d.line_id || '',
      address: d.address || '',
      warranty_policy: d.warranty_policy || '',
      defect_contact_info: d.defect_contact_info || '',
      tax_id: d.tax_id || '',
      corporate_employees: d.corporate_employees ? [...d.corporate_employees] : [],
      notes: d.notes || '',
    });
    setShowDevModal(true);
  };

  const handleSaveDev = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedEmployees = (devForm.corporate_employees || []).filter(
      (emp) => emp.name && emp.name.trim() !== ''
    );
    const payload = {
      ...devForm,
      corporate_employees: cleanedEmployees,
    };
    if (editingDev) {
      await api.updateDeveloper(editingDev.id, payload);
      if (selectedDevId === editingDev.id) {
        const updated = await api.getDeveloperDetails(editingDev.id);
        setDevDetail(updated);
      }
    } else {
      await api.createDeveloper(payload);
    }
    setShowDevModal(false);
    onRefresh();
  };

  const handleAddContactComm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactId || !commSubject.trim() || !commContent.trim()) return;
    await api.createCommunication({
      channel: commChannel,
      direction: 'Outbound',
      subject: commSubject,
      content: commContent,
      logged_by: 'Senior Agent',
      contact_id: selectedContactId,
    });
    setCommSubject('');
    setCommContent('');
    const updated = await api.getContactDetails(selectedContactId);
    setContactDetail(updated);
    onRefresh();
  };

  const handleAddDevComm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevId || !commSubject.trim() || !commContent.trim()) return;
    await api.createCommunication({
      channel: commChannel,
      direction: 'Outbound',
      subject: commSubject,
      content: commContent,
      logged_by: 'Senior Agent',
      developer_id: selectedDevId,
    });
    setCommSubject('');
    setCommContent('');
    const updated = await api.getDeveloperDetails(selectedDevId);
    setDevDetail(updated);
    onRefresh();
  };

  // Helpers to manage corporate_employees array in ContactForm
  const addContactEmployee = () => {
    setContactForm((prev) => ({
      ...prev,
      entity_type: 'Corporate',
      corporate_employees: [
        ...prev.corporate_employees,
        {
          name: '',
          title_or_department: '',
          phone: '',
          email: '',
          line_or_whatsapp: '',
          is_primary: prev.corporate_employees.length === 0,
          notes: '',
        },
      ],
    }));
  };

  const updateContactEmployee = (
    idx: number,
    field: keyof CorporateEmployee,
    value: string | boolean
  ) => {
    setContactForm((prev) => ({
      ...prev,
      corporate_employees: prev.corporate_employees.map((emp, i) =>
        i === idx ? { ...emp, [field]: value } : emp
      ),
    }));
  };

  const removeContactEmployee = (idx: number) => {
    setContactForm((prev) => ({
      ...prev,
      corporate_employees: prev.corporate_employees.filter((_, i) => i !== idx),
    }));
  };

  // Helpers to manage corporate_employees array in DevForm
  const addDevEmployee = () => {
    setDevForm((prev) => ({
      ...prev,
      corporate_employees: [
        ...prev.corporate_employees,
        {
          name: '',
          title_or_department: '',
          phone: '',
          email: '',
          line_or_whatsapp: '',
          is_primary: prev.corporate_employees.length === 0,
          notes: '',
        },
      ],
    }));
  };

  const updateDevEmployee = (
    idx: number,
    field: keyof CorporateEmployee,
    value: string | boolean
  ) => {
    setDevForm((prev) => ({
      ...prev,
      corporate_employees: prev.corporate_employees.map((emp, i) =>
        i === idx ? { ...emp, [field]: value } : emp
      ),
    }));
  };

  const removeDevEmployee = (idx: number) => {
    setDevForm((prev) => ({
      ...prev,
      corporate_employees: prev.corporate_employees.filter((_, i) => i !== idx),
    }));
  };

  const landlordsCount = contacts.filter((c) => c.role === 'LANDLORD' || c.role === 'BOTH').length;
  const tenantsCount = contacts.filter((c) => c.role === 'TENANT' || c.role === 'BOTH').length;
  const vendorsCount = contacts.filter((c) => c.role === 'VENDOR').length;

  return (
    <div className="space-y-6">
      {/* Top Bar: Role Switcher (Landlords, Tenants, Vendors, Developers) + Search + Add Button */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1 gap-1">
          <button
            onClick={() => setSubTab('LANDLORD')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
              subTab === 'LANDLORD'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            Landlords ({landlordsCount})
          </button>
          <button
            onClick={() => setSubTab('TENANT')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
              subTab === 'TENANT'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            Tenants ({tenantsCount})
          </button>
          <button
            onClick={() => setSubTab('VENDOR')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
              subTab === 'VENDOR'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <HardHat className="w-4 h-4" />
            Vendors & Contractors ({vendorsCount})
          </button>
          <button
            onClick={() => setSubTab('DEVELOPER')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
              subTab === 'DEVELOPER'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building className="w-4 h-4" />
            Developers ({developers.length})
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Search ${subTab.toLowerCase()}s, company, employee...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {subTab === 'DEVELOPER' ? (
            <button
              onClick={openNewDev}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition shadow-xs whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add Developer
            </button>
          ) : (
            <button
              onClick={() => openNewContact(subTab)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition shadow-xs whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add{' '}
              {subTab === 'LANDLORD'
                ? 'Landlord'
                : subTab === 'TENANT'
                ? 'Tenant'
                : 'Vendor / Contractor'}
            </button>
          )}
        </div>
      </div>

      {/* Cards Grid for Landlords / Tenants / Vendors */}
      {subTab !== 'DEVELOPER' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContacts.map((c) => {
            const isCorporate = c.entity_type === 'Corporate' || Boolean(c.company_name);
            const emps = c.corporate_employees || [];
            return (
              <div
                key={c.id}
                onClick={() => setSelectedContactId(c.id)}
                className="group cursor-pointer bg-white rounded-2xl border border-slate-200 p-5 hover:border-indigo-400 hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            c.role === 'LANDLORD'
                              ? 'bg-indigo-50 text-indigo-700'
                              : c.role === 'TENANT'
                              ? 'bg-emerald-50 text-emerald-700'
                              : c.role === 'VENDOR'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-purple-50 text-purple-700'
                          }`}
                        >
                          {c.role === 'BOTH' ? 'Landlord & Tenant' : c.role}
                        </span>
                        {isCorporate ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-900 text-white">
                            <Briefcase className="w-2.5 h-2.5" />
                            Corporate
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            Individual
                          </span>
                        )}
                        {c.service_category && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200/70">
                            {c.service_category}
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-slate-900 pt-1 group-hover:text-indigo-600 transition">
                        {isCorporate && c.company_name ? c.company_name : c.full_name}
                      </h3>

                      {isCorporate && c.company_name && c.company_name !== c.full_name && (
                        <p className="text-xs font-semibold text-indigo-700">
                          Primary Account / Signatory: {c.full_name}
                        </p>
                      )}

                      <p className="text-xs text-slate-500">
                        {c.nationality || 'Thai'} • {c.preferred_language}
                        {c.tax_id ? ` • Tax ID: ${c.tax_id}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 text-amber-400 shrink-0">
                      {Array.from({ length: c.rating || 5 }).map((_, idx) => (
                        <Star key={idx} className="w-3.5 h-3.5 fill-amber-400" />
                      ))}
                    </div>
                  </div>

                  <div className="mt-3.5 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{c.phone}</span>
                    </div>
                    {c.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">{c.email}</span>
                      </div>
                    )}
                    {c.line_or_whatsapp && (
                      <div className="flex items-center gap-2 text-indigo-600 font-medium">
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>{c.line_or_whatsapp}</span>
                      </div>
                    )}
                  </div>

                  {/* Corporate Employees / Representatives Preview Box */}
                  {emps.length > 0 && (
                    <div className="mt-3 p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-indigo-800">
                        <span className="flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-indigo-600" />
                          Corporate Representatives ({emps.length})
                        </span>
                      </div>
                      {emps.slice(0, 2).map((emp, idx) => (
                        <div
                          key={`${emp.name}-${idx}`}
                          className="text-[11px] bg-white px-2.5 py-1.5 rounded-lg border border-indigo-100/80"
                        >
                          <div className="font-bold text-slate-900 flex items-center justify-between gap-1">
                            <span className="truncate">{emp.name}</span>
                            {emp.is_primary && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 font-bold shrink-0">
                                Primary Rep
                              </span>
                            )}
                          </div>
                          {emp.title_or_department && (
                            <div className="text-[10px] text-slate-500 truncate">
                              {emp.title_or_department}
                            </div>
                          )}
                          {(emp.phone || emp.line_or_whatsapp) && (
                            <div className="text-[10px] text-indigo-600 font-medium truncate">
                              {emp.phone}
                              {emp.phone && emp.line_or_whatsapp ? ' • ' : ''}
                              {emp.line_or_whatsapp}
                            </div>
                          )}
                        </div>
                      ))}
                      {emps.length > 2 && (
                        <div className="text-[10px] text-indigo-600 font-semibold pl-1">
                          + {emps.length - 2} more corporate employee(s)
                        </div>
                      )}
                    </div>
                  )}

                  {c.notes && (
                    <p className="mt-3 text-xs text-slate-500 line-clamp-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {c.notes}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex gap-3">
                    {c.role === 'VENDOR' ? (
                      <span className="font-semibold text-amber-800 flex items-center gap-1">
                        <Wrench className="w-3.5 h-3.5 text-amber-600" />
                        {c.vendor_jobs_count || 0} Assigned Repair Ticket(s)
                      </span>
                    ) : (
                      <>
                        {(c.role === 'LANDLORD' || c.role === 'BOTH') && (
                          <span className="font-semibold text-slate-700">
                            {c.owned_units_count} Units Owned
                          </span>
                        )}
                        <span className="font-semibold text-emerald-700">
                          {c.active_leases_count} Active Leases
                        </span>
                      </>
                    )}
                  </div>
                  <span className="text-indigo-600 font-semibold group-hover:translate-x-0.5 transition">
                    360° CRM →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Cards Grid for Developers */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevs.map((d) => {
            const emps = d.corporate_employees || [];
            return (
              <div
                key={d.id}
                onClick={() => setSelectedDevId(d.id)}
                className="group cursor-pointer bg-white rounded-2xl border border-slate-200 p-5 hover:border-indigo-400 hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-50 text-amber-800">
                        Developer / After-Sales
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-900 text-white">
                        <Briefcase className="w-2.5 h-2.5" />
                        Corporate
                      </span>
                    </div>
                    {d.open_warranty_issues > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-semibold">
                        {d.open_warranty_issues} Open Defect Claim(s)
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-2 group-hover:text-indigo-600 transition">
                    {d.company_name}
                  </h3>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">{d.contact_person}</p>

                  <div className="mt-3 space-y-1 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{d.phone}</span>
                    </div>
                    {d.line_id && (
                      <div className="flex items-center gap-2 text-emerald-700 font-medium">
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>LINE: {d.line_id}</span>
                      </div>
                    )}
                  </div>

                  {/* Developer Corporate Employees / Representatives */}
                  {emps.length > 0 && (
                    <div className="mt-3 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/70 space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1">
                        <UserCheck className="w-3 h-3 text-amber-700" />
                        Employees Dealing with Contracts / Claims ({emps.length})
                      </div>
                      {emps.slice(0, 2).map((emp, idx) => (
                        <div
                          key={`${emp.name}-${idx}`}
                          className="text-[11px] bg-white px-2.5 py-1.5 rounded-lg border border-amber-200/60"
                        >
                          <div className="font-bold text-slate-900">{emp.name}</div>
                          {emp.title_or_department && (
                            <div className="text-[10px] text-slate-500">
                              {emp.title_or_department}
                            </div>
                          )}
                          {(emp.phone || emp.line_or_whatsapp) && (
                            <div className="text-[10px] text-amber-800 font-medium">
                              {emp.phone} {emp.line_or_whatsapp ? `• ${emp.line_or_whatsapp}` : ''}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {d.warranty_policy && (
                    <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">Warranty Policy: </span>
                      {d.warranty_policy}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">
                    {d.unit_count} Managed Project Units
                  </span>
                  <span className="text-indigo-600 font-semibold">View Defect History →</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 360° Contact Detail Drawer (Landlord, Tenant, Vendor) */}
      {selectedContactId && contactDetail && (
        <div
          onClick={() => setSelectedContactId(null)}
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl bg-white h-full shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-500/30 text-indigo-200 font-semibold">
                    {contactDetail.contact.role}
                  </span>
                  {(contactDetail.contact.entity_type === 'Corporate' ||
                    contactDetail.contact.company_name) && (
                    <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-semibold flex items-center gap-1">
                      <Briefcase className="w-3 h-3" /> Corporate Entity
                    </span>
                  )}
                  {contactDetail.contact.service_category && (
                    <span className="text-xs px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 font-semibold">
                      {contactDetail.contact.service_category}
                    </span>
                  )}
                  <h2 className="text-lg font-bold">
                    {contactDetail.contact.company_name || contactDetail.contact.full_name}
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Primary Contact: {contactDetail.contact.full_name} • {contactDetail.contact.phone}{' '}
                  • {contactDetail.contact.email || 'No email'} •{' '}
                  {contactDetail.contact.line_or_whatsapp}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditContact(contactDetail.contact)}
                  className="p-2 rounded-lg bg-slate-800 text-slate-200 hover:text-white text-xs flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => setSelectedContactId(null)}
                  className="p-2 rounded-lg text-slate-400 hover:text-white"
                  title="Close (ESC)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Corporate Company & Employees Dealing with Contracts Section */}
              {(contactDetail.contact.entity_type === 'Corporate' ||
                contactDetail.contact.company_name ||
                (contactDetail.contact.corporate_employees &&
                  contactDetail.contact.corporate_employees.length > 0)) && (
                <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-extrabold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-indigo-600" />
                        Corporate Company & Employees Dealing with Contracts
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Company:{' '}
                        <strong className="text-slate-900">
                          {contactDetail.contact.company_name || contactDetail.contact.full_name}
                        </strong>
                        {contactDetail.contact.tax_id
                          ? ` • Tax ID / Reg: ${contactDetail.contact.tax_id}`
                          : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEditContact(contactDetail.contact)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-indigo-200 text-indigo-700 text-xs font-bold hover:bg-indigo-50 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Manage Representatives
                    </button>
                  </div>

                  {contactDetail.contact.corporate_employees &&
                  contactDetail.contact.corporate_employees.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {contactDetail.contact.corporate_employees.map((emp, idx) => (
                        <div
                          key={`${emp.name}-${idx}`}
                          className="p-3 rounded-xl bg-white border border-indigo-100 shadow-2xs space-y-1 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-900 text-sm">{emp.name}</span>
                            {emp.is_primary && (
                              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                                Primary Representative
                              </span>
                            )}
                          </div>
                          {emp.title_or_department && (
                            <p className="text-indigo-700 font-semibold text-xs">
                              {emp.title_or_department}
                            </p>
                          )}
                          <div className="text-slate-600 space-y-0.5 pt-1">
                            {emp.phone && <div>Tel: {emp.phone}</div>}
                            {emp.email && <div>Email: {emp.email}</div>}
                            {emp.line_or_whatsapp && (
                              <div className="text-indigo-600 font-medium">
                                {emp.line_or_whatsapp}
                              </div>
                            )}
                          </div>
                          {emp.notes && (
                            <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg mt-1">
                              {emp.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">
                      No additional corporate employees listed yet. Click &quot;Manage
                      Representatives&quot; to add employees dealing with contracts on behalf of this
                      company.
                    </p>
                  )}
                </div>
              )}

              {/* Key CRM Metadata: Bank Account & Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <div className="font-semibold text-slate-500 uppercase flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-indigo-600" />
                    Bank & Settlement Details
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200/80">
                      <span className="text-[10px] font-semibold uppercase text-slate-400 block">
                        Bank Name
                      </span>
                      <span className="text-slate-900 font-bold text-xs mt-0.5 block">
                        {contactDetail.contact.bank_name ||
                          contactDetail.contact.bank_account_info ||
                          'Not provided'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200/80">
                      <span className="text-[10px] font-semibold uppercase text-slate-400 block">
                        Account No.
                      </span>
                      <span className="font-mono text-indigo-700 font-bold text-xs mt-0.5 block">
                        {contactDetail.contact.bank_account_no || 'N/A'}
                      </span>
                    </div>
                  </div>
                  <p className="text-slate-500 pt-0.5">
                    ID / Passport / Tax Reg:{' '}
                    <strong>
                      {contactDetail.contact.tax_id ||
                        contactDetail.contact.id_or_passport ||
                        'N/A'}
                    </strong>
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                  <div className="font-semibold text-slate-500 uppercase mb-1">
                    Agent CRM Notes & Preferences
                  </div>
                  <p className="text-slate-800">{contactDetail.contact.notes || 'No notes.'}</p>
                  <p className="text-slate-500 pt-1">
                    Emergency / Secondary:{' '}
                    <strong>{contactDetail.contact.emergency_contact || 'N/A'}</strong>
                  </p>
                </div>
              </div>

              {/* Owned Units (if Landlord) */}
              {contactDetail.owned_units.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-2.5 flex items-center gap-2">
                    <Home className="w-4 h-4 text-indigo-600" />
                    Owned Property Units ({contactDetail.owned_units.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {contactDetail.owned_units.map((u) => (
                      <div
                        key={u.id}
                        onClick={() => {
                          setSelectedContactId(null);
                          onSelectUnit(u.id);
                        }}
                        className="group p-3 rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-sm cursor-pointer bg-white flex items-center gap-3.5 transition"
                      >
                        <div className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200/60">
                          {u.image_url ? (
                            <img
                              src={u.image_url}
                              alt={u.unit_code}
                              className="w-full h-full object-cover group-hover:scale-105 transition"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <Home className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-indigo-600">{u.unit_code}</span>
                            <span className="text-xs font-bold text-slate-900">
                              ฿{u.target_rent_price.toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {u.project_name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {u.status} • Tenant: {u.current_tenant_name || 'Vacant'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Leases (if Landlord or Tenant) */}
              {contactDetail.leases.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-2.5 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    Linked Lease Contracts ({contactDetail.leases.length})
                  </h3>
                  <div className="space-y-2">
                    {contactDetail.leases.map((l) => (
                      <div
                        key={l.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-mono font-bold text-indigo-600">
                            {l.contract_no}
                          </span>{' '}
                          • <strong>{l.unit_code}</strong> ({l.project_name})
                          <p className="text-slate-500 mt-0.5">
                            Landlord: {l.landlord_name} | Tenant: {l.tenant_name}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-900">
                            ฿{l.monthly_rent.toLocaleString()}/mo
                          </span>
                          <p className="text-slate-500">
                            {l.start_date} → {l.end_date}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Related Unit Issues & Vendor Work Orders History */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-2.5 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-600" />
                  {contactDetail.contact.role === 'VENDOR'
                    ? `Assigned Repair Tickets & Quotations (${contactDetail.issues.length})`
                    : `Unit Issues & Repair History (${contactDetail.issues.length})`}
                </h3>
                <div className="space-y-2">
                  {contactDetail.issues.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No linked issue tickets yet.</p>
                  ) : (
                    contactDetail.issues.map((iss) => (
                      <div
                        key={iss.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900">
                            {iss.ticket_no} • [{iss.unit_code}] {iss.title}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                            {iss.status} • Actual: ฿{iss.actual_cost.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-slate-500">{iss.resolution_notes || iss.description}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* CRM Communication Timeline */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900">
                  CRM Communication & Activity Log
                </h3>
                <form
                  onSubmit={handleAddContactComm}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5"
                >
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={commChannel}
                      onChange={(e) => setCommChannel(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                    >
                      <option>LINE</option>
                      <option>WhatsApp</option>
                      <option>Phone Call</option>
                      <option>Email</option>
                      <option>In-Person</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Subject..."
                      value={commSubject}
                      onChange={(e) => setCommSubject(e.target.value)}
                      className="col-span-2 px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                      required
                    />
                  </div>
                  <textarea
                    placeholder="Write call summary, LINE message confirmation, or corporate representative update..."
                    value={commContent}
                    onChange={(e) => setCommContent(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                    required
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
                    >
                      Log Communication
                    </button>
                  </div>
                </form>

                {contactDetail.communications.map((cm) => (
                  <div
                    key={cm.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white text-xs"
                  >
                    <div className="flex justify-between font-semibold text-indigo-600">
                      <span>
                        [{cm.channel}] {cm.subject}
                      </span>
                      <span className="text-slate-400 font-normal">
                        {new Date(cm.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-slate-600 mt-1">{cm.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 360° Developer Detail Drawer */}
      {selectedDevId && devDetail && (
        <div
          onClick={() => setSelectedDevId(null)}
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl bg-white h-full shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-semibold">
                  Developer Corporate CRM & Defect Desk
                </span>
                <h2 className="text-lg font-bold mt-1">{devDetail.developer.company_name}</h2>
                <p className="text-xs text-slate-400">
                  {devDetail.developer.contact_person} • {devDetail.developer.phone}
                  {devDetail.developer.tax_id ? ` • Tax ID: ${devDetail.developer.tax_id}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditDev(devDetail.developer)}
                  className="p-2 rounded-lg bg-slate-800 text-slate-200 hover:text-white text-xs flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => setSelectedDevId(null)}
                  className="p-2 rounded-lg text-slate-400 hover:text-white"
                  title="Close (ESC)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Developer Corporate Employees / Representatives */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-extrabold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-amber-700" />
                      Developer Corporate Employees & Warranty Representatives
                    </div>
                    <p className="text-amber-800 text-[11px]">
                      Employees dealing with defect claims, handovers, and project contracts on
                      behalf of {devDetail.developer.company_name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEditDev(devDetail.developer)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 font-bold hover:bg-amber-100 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Manage Employees
                  </button>
                </div>

                {devDetail.developer.corporate_employees &&
                devDetail.developer.corporate_employees.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {devDetail.developer.corporate_employees.map((emp, idx) => (
                      <div
                        key={`${emp.name}-${idx}`}
                        className="p-3 rounded-xl bg-white border border-amber-200/80 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-sm">{emp.name}</span>
                          {emp.is_primary && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                              Primary Contact
                            </span>
                          )}
                        </div>
                        {emp.title_or_department && (
                          <div className="font-semibold text-amber-800">
                            {emp.title_or_department}
                          </div>
                        )}
                        <div className="text-slate-600 space-y-0.5">
                          {emp.phone && <div>Tel: {emp.phone}</div>}
                          {emp.email && <div>Email: {emp.email}</div>}
                          {emp.line_or_whatsapp && (
                            <div className="text-emerald-700 font-medium">
                              {emp.line_or_whatsapp}
                            </div>
                          )}
                        </div>
                        {emp.notes && (
                          <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg mt-1">
                            {emp.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-amber-800 italic">
                    No individual corporate employees added yet.
                  </p>
                )}

                <div className="pt-2 border-t border-amber-200/70 space-y-1">
                  <div className="font-bold text-amber-900">Warranty Policy & Defect SLA</div>
                  <p className="text-amber-800">{devDetail.developer.warranty_policy}</p>
                  <div className="font-bold text-amber-900 pt-1">Defect Claim Procedure</div>
                  <p className="text-amber-800">{devDetail.developer.defect_contact_info}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">
                  Project Units Built by {devDetail.developer.company_name} ({devDetail.units.length}
                  )
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {devDetail.units.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => {
                        setSelectedDevId(null);
                        onSelectUnit(u.id);
                      }}
                      className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 cursor-pointer bg-white flex justify-between items-center text-xs"
                    >
                      <div>
                        <span className="font-bold text-indigo-600">{u.unit_code}</span> —{' '}
                        <span className="font-semibold">{u.project_name}</span>
                        <p className="text-slate-500 mt-0.5">
                          Warranty Expiry: <strong>{u.warranty_expiry_date || 'N/A'}</strong>
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {u.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">
                  Unit Defect & Issue Claims ({devDetail.issues.length})
                </h3>
                <div className="space-y-2">
                  {devDetail.issues.map((iss) => (
                    <div
                      key={iss.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white text-xs space-y-1"
                    >
                      <div className="flex justify-between">
                        <span className="font-bold text-slate-900">
                          {iss.ticket_no} • [{iss.unit_code}] {iss.title}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-semibold">
                          {iss.responsible_party} • {iss.status}
                        </span>
                      </div>
                      <p className="text-slate-600">{iss.resolution_notes || iss.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Developer Comms */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900">
                  Developer Defect Follow-up Log
                </h3>
                <form
                  onSubmit={handleAddDevComm}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5"
                >
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={commChannel}
                      onChange={(e) => setCommChannel(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                    >
                      <option>LINE</option>
                      <option>Phone Call</option>
                      <option>Email</option>
                      <option>Inspection Note</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Defect Ticket / Subject..."
                      value={commSubject}
                      onChange={(e) => setCommSubject(e.target.value)}
                      className="col-span-2 px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                      required
                    />
                  </div>
                  <textarea
                    placeholder="Record developer engineer visit or warranty claim update..."
                    value={commContent}
                    onChange={(e) => setCommContent(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                    required
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
                    >
                      Save Log
                    </button>
                  </div>
                </form>

                {devDetail.communications.map((cm) => (
                  <div
                    key={cm.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white text-xs"
                  >
                    <div className="flex justify-between font-semibold text-indigo-600">
                      <span>
                        [{cm.channel}] {cm.subject}
                      </span>
                      <span className="text-slate-400 font-normal">
                        {new Date(cm.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-slate-600 mt-1">{cm.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create/Edit Contact (Landlord, Tenant, Both, Vendor — Individual or Corporate) */}
      {showContactModal && (
        <div
          onClick={() => setShowContactModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingContact
                  ? `Edit CRM Contact — ${editingContact.company_name || editingContact.full_name}`
                  : 'New CRM Contact (Landlord / Tenant / Vendor)'}
              </h3>
              <button
                onClick={() => setShowContactModal(false)}
                className="text-slate-400 hover:text-slate-700"
                title="Close (ESC)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveContact} className="space-y-3.5 text-xs">
              {/* Role & Entity Type (Individual vs Corporate Company) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">CRM Role *</label>
                  <select
                    value={contactForm.role}
                    onChange={(e) => {
                      const nextRole = e.target.value;
                      setContactForm({
                        ...contactForm,
                        role: nextRole,
                        entity_type: nextRole === 'VENDOR' ? 'Corporate' : contactForm.entity_type,
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
                  >
                    <option value="LANDLORD">Landlord (Property Owner)</option>
                    <option value="TENANT">Tenant (Renter / Occupant)</option>
                    <option value="BOTH">Both Landlord & Tenant</option>
                    <option value="VENDOR">Vendor / Contractor / Service Team</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Contact Entity Type *
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 border border-slate-200">
                    {['Individual', 'Corporate'].map((et) => (
                      <button
                        key={et}
                        type="button"
                        onClick={() => setContactForm({ ...contactForm, entity_type: et })}
                        className={`py-1.5 rounded-lg font-bold transition flex items-center justify-center gap-1.5 ${
                          contactForm.entity_type === et
                            ? 'bg-white text-indigo-600 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {et === 'Corporate' && <Briefcase className="w-3.5 h-3.5" />}
                        {et === 'Corporate' ? 'Corporate Company' : 'Individual'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Corporate Company Details & Employees Dealing with Contracts */}
              {(contactForm.entity_type === 'Corporate' || contactForm.role === 'VENDOR') && (
                <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-3">
                  <div className="font-bold text-indigo-950 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    Corporate Company Details & Authorized Employees
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Corporate Company Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Mitsui & Co. (Thailand) Ltd. / CoolBKK Service Co., Ltd."
                        value={contactForm.company_name}
                        onChange={(e) =>
                          setContactForm({ ...contactForm, company_name: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Corporate Tax ID / Registration No.
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 0105561049281"
                        value={contactForm.tax_id}
                        onChange={(e) => setContactForm({ ...contactForm, tax_id: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono"
                      />
                    </div>
                  </div>

                  {contactForm.role === 'VENDOR' && (
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Vendor Service Category
                      </label>
                      <input
                        list="vendor-service-categories"
                        type="text"
                        placeholder="e.g. Air Conditioning & HVAC, Plumbing & Electrical..."
                        value={contactForm.service_category}
                        onChange={(e) =>
                          setContactForm({ ...contactForm, service_category: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                      />
                      <datalist id="vendor-service-categories">
                        {VENDOR_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat} />
                        ))}
                      </datalist>
                    </div>
                  )}

                  {/* Corporate Employees / Representatives List */}
                  <div className="space-y-2 pt-1 border-t border-indigo-200/70">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-indigo-950 block">
                          Employees Dealing with Contracts on Behalf of the Company (
                          {contactForm.corporate_employees.length})
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Add HR managers, legal/leasing coordinators, directors, or service
                          engineers
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={addContactEmployee}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Employee
                      </button>
                    </div>

                    {contactForm.corporate_employees.map((emp, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-white border border-indigo-200 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-indigo-700 text-[11px]">
                            Employee / Representative #{idx + 1}
                          </span>
                          <div className="flex items-center gap-3">
                            <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(emp.is_primary)}
                                onChange={(e) =>
                                  updateContactEmployee(idx, 'is_primary', e.target.checked)
                                }
                              />
                              Primary Contract Contact
                            </label>
                            <button
                              type="button"
                              onClick={() => removeContactEmployee(idx)}
                              className="text-rose-600 hover:text-rose-800 p-1"
                              title="Remove Employee"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Employee Full Name *"
                            value={emp.name}
                            onChange={(e) => updateContactEmployee(idx, 'name', e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300"
                          />
                          <input
                            type="text"
                            placeholder="Role / Department (e.g. HR Manager, Leasing Coord)"
                            value={emp.title_or_department || ''}
                            onChange={(e) =>
                              updateContactEmployee(idx, 'title_or_department', e.target.value)
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            placeholder="Direct Phone"
                            value={emp.phone || ''}
                            onChange={(e) => updateContactEmployee(idx, 'phone', e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300"
                          />
                          <input
                            type="email"
                            placeholder="Direct Email"
                            value={emp.email || ''}
                            onChange={(e) => updateContactEmployee(idx, 'email', e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300"
                          />
                          <input
                            type="text"
                            placeholder="LINE / WhatsApp"
                            value={emp.line_or_whatsapp || ''}
                            onChange={(e) =>
                              updateContactEmployee(idx, 'line_or_whatsapp', e.target.value)
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300"
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Responsibility note (e.g. Signs lease agreements & handles monthly SOA)"
                          value={emp.notes || ''}
                          onChange={(e) => updateContactEmployee(idx, 'notes', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    {contactForm.entity_type === 'Corporate'
                      ? 'Primary Signatory / Display Name *'
                      : 'Full Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={
                      contactForm.role === 'VENDOR'
                        ? 'e.g. CoolBKK Air Conditioning Service'
                        : 'e.g. Marcus Vance / Kenji Takahashi'
                    }
                    value={contactForm.full_name}
                    onChange={(e) => setContactForm({ ...contactForm, full_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Phone *</label>
                  <input
                    type="text"
                    required
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">LINE / WhatsApp</label>
                  <input
                    type="text"
                    value={contactForm.line_or_whatsapp}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, line_or_whatsapp: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Email</label>
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Nationality</label>
                  <input
                    type="text"
                    value={contactForm.nationality}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, nationality: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    ID / Passport No.
                  </label>
                  <input
                    type="text"
                    value={contactForm.id_or_passport}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, id_or_passport: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Preferred Language
                  </label>
                  <input
                    type="text"
                    value={contactForm.preferred_language}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, preferred_language: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-indigo-600" />
                  Bank Account Details (Two Columns: Bank Name & Account No.)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Bank Name</label>
                    <input
                      list="bank-name-options"
                      type="text"
                      placeholder="e.g. Kasikorn Bank (KBank)"
                      value={contactForm.bank_name}
                      onChange={(e) =>
                        setContactForm({ ...contactForm, bank_name: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                    />
                    <datalist id="bank-name-options">
                      <option value="Kasikorn Bank (KBank)" />
                      <option value="Bangkok Bank (BBL)" />
                      <option value="SCB (Siam Commercial Bank)" />
                      <option value="Krungsri Bank (BAY)" />
                      <option value="Krungthai Bank (KTB)" />
                      <option value="TTB (TMBThanachart Bank)" />
                      <option value="UOB Thailand" />
                      <option value="HSBC" />
                      <option value="Citibank" />
                    </datalist>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Account No.</label>
                    <input
                      type="text"
                      placeholder="e.g. 045-2-99182-4"
                      value={contactForm.bank_account_no}
                      onChange={(e) =>
                        setContactForm({ ...contactForm, bank_account_no: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">CRM Notes</label>
                <textarea
                  rows={2}
                  value={contactForm.notes}
                  onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowContactModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600"
                >
                  Cancel (ESC)
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create/Edit Developer (with Corporate Employees Dealing with Contracts/Warranty) */}
      {showDevModal && (
        <div
          onClick={() => setShowDevModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingDev ? 'Edit Developer & Corporate Representatives' : 'Add Real Estate Developer'}
              </h3>
              <button
                onClick={() => setShowDevModal(false)}
                className="text-slate-400 hover:text-slate-700"
                title="Close (ESC)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveDev} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="font-semibold text-slate-700 block mb-1">
                    Developer Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={devForm.company_name}
                    onChange={(e) => setDevForm({ ...devForm, company_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Corporate Tax ID
                  </label>
                  <input
                    type="text"
                    value={devForm.tax_id}
                    onChange={(e) => setDevForm({ ...devForm, tax_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    After-Sales / Defect Desk Lead
                  </label>
                  <input
                    type="text"
                    value={devForm.contact_person}
                    onChange={(e) => setDevForm({ ...devForm, contact_person: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Phone</label>
                  <input
                    type="text"
                    value={devForm.phone}
                    onChange={(e) => setDevForm({ ...devForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Email</label>
                  <input
                    type="email"
                    value={devForm.email}
                    onChange={(e) => setDevForm({ ...devForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">LINE Official ID</label>
                  <input
                    type="text"
                    value={devForm.line_id}
                    onChange={(e) => setDevForm({ ...devForm, line_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              {/* Developer Corporate Employees Dealing with Contracts & Warranty */}
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-amber-950 block">
                      Developer Employees Dealing with Contracts & Warranty Claims (
                      {devForm.corporate_employees.length})
                    </span>
                    <span className="text-[11px] text-amber-800">
                      Add defect engineers, juristic managers, or legal handover officers
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={addDevEmployee}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-600 text-white font-bold hover:bg-amber-700 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Employee
                  </button>
                </div>

                {devForm.corporate_employees.map((emp, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-white border border-amber-200 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-900 text-[11px]">
                        Developer Representative #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeDevEmployee(idx)}
                        className="text-rose-600 hover:text-rose-800 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Employee Name *"
                        value={emp.name}
                        onChange={(e) => updateDevEmployee(idx, 'name', e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300"
                      />
                      <input
                        type="text"
                        placeholder="Title / Department"
                        value={emp.title_or_department || ''}
                        onChange={(e) =>
                          updateDevEmployee(idx, 'title_or_department', e.target.value)
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Direct Phone"
                        value={emp.phone || ''}
                        onChange={(e) => updateDevEmployee(idx, 'phone', e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300"
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={emp.email || ''}
                        onChange={(e) => updateDevEmployee(idx, 'email', e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300"
                      />
                      <input
                        type="text"
                        placeholder="LINE / WhatsApp"
                        value={emp.line_or_whatsapp || ''}
                        onChange={(e) =>
                          updateDevEmployee(idx, 'line_or_whatsapp', e.target.value)
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Projects / Responsibility notes"
                      value={emp.notes || ''}
                      onChange={(e) => updateDevEmployee(idx, 'notes', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Warranty Policy</label>
                <textarea
                  rows={2}
                  value={devForm.warranty_policy}
                  onChange={(e) => setDevForm({ ...devForm, warranty_policy: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Defect Claim Procedure / Contact Notes
                </label>
                <textarea
                  rows={2}
                  value={devForm.defect_contact_info}
                  onChange={(e) => setDevForm({ ...devForm, defect_contact_info: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDevModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600"
                >
                  Cancel (ESC)
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
                >
                  Save Developer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
