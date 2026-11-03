import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  Wrench,
  ShieldCheck,
  AlertCircle,
  TrendingUp,
  MessageSquare,
  Clock,
  ArrowUpRight,
  CheckCircle2,
  Calculator,
  Sliders,
} from 'lucide-react';
import { api } from './api';
import {
  DashboardData,
  PropertyUnit,
  Contact,
  Developer,
  LeaseContract,
  UnitIssue,
} from './types';
import { UnitsInventoryView } from './components/UnitsInventoryView';
import { CRMDirectoryView } from './components/CRMDirectoryView';
import { LeaseContractsView } from './components/LeaseContractsView';
import { UnitIssuesView } from './components/UnitIssuesView';
import { UnitDetailDrawer } from './components/UnitDetailDrawer';
import { TransactionCalculatorView } from './components/TransactionCalculatorView';
import { FinancialSettingsView } from './components/FinancialSettingsView';
import { UserManagementView } from './components/UserManagementView';
import { AppUser } from './types';

type NavTab =
  | 'dashboard'
  | 'units'
  | 'crm'
  | 'leases'
  | 'issues'
  | 'calculator'
  | 'settings'
  | 'users';

export function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [units, setUnits] = useState<PropertyUnit[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [leases, setLeases] = useState<LeaseContract[]>([]);
  const [issues, setIssues] = useState<UnitIssue[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Global 360° Unit Drawer state
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [preselectedUnitForIssue, setPreselectedUnitForIssue] = useState<PropertyUnit | null>(null);
  const [calculatorUnit, setCalculatorUnit] = useState<PropertyUnit | null>(null);

  const loadAllData = useCallback(async () => {
    try {
      const [
        dashData,
        unitsData,
        contactsData,
        devsData,
        leasesData,
        issuesData,
        usersData,
      ] = await Promise.all([
        api.getDashboard(),
        api.getUnits(),
        api.getContacts(),
        api.getDevelopers(),
        api.getLeases(),
        api.getIssues(),
        api.getUsers(),
      ]);
      setDashboard(dashData);
      setUnits(unitsData);
      setContacts(contactsData);
      setDevelopers(devsData);
      setLeases(leasesData);
      setIssues(issuesData);
      setUsers(usersData);
      setCurrentUser((prev) => prev || (usersData.length > 0 ? usersData[0] : null));
    } catch (err) {
      console.error('Failed to load CRM data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleOpenNewIssueFromDrawer = (unitObj: PropertyUnit) => {
    setSelectedUnitId(null);
    setPreselectedUnitForIssue(unitObj);
    setActiveTab('issues');
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 text-slate-900">
      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-64 bg-slate-900 text-white flex flex-col justify-between shrink-0">
        <div>
          <div className="p-5 flex items-center gap-3 border-b border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight">PropPulse CRM</h1>
              <p className="text-[11px] text-slate-400">Real Estate & Defect Management</p>
            </div>
          </div>

          <nav className="p-3 space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <LayoutDashboard className="w-4 h-4" />
                Agency Overview
              </span>
            </button>

            <button
              onClick={() => setActiveTab('units')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'units'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Building2 className="w-4 h-4" />
                Properties & Units
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px]">
                {units.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('crm')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'crm'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Users className="w-4 h-4" />
                CRM Hub (LL / Tenant / Dev)
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px]">
                {contacts.length + developers.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('leases')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'leases'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <FileText className="w-4 h-4" />
                Lease Contracts
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px]">
                {leases.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('issues')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'issues'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Wrench className="w-4 h-4" />
                Unit Issues & Defects
              </span>
              {dashboard && dashboard.metrics.open_issues_count > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                  {dashboard.metrics.open_issues_count}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('calculator')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'calculator'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Calculator className="w-4 h-4" />
                Tax, Comm & Profit Calc
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                Report
              </span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'settings'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Sliders className="w-4 h-4" />
                Financial & Fee Settings
              </span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold">
                Rates
              </span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'users'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Admin & User Permissions
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                Admin
              </span>
            </button>
          </nav>
        </div>

        {/* Bottom Current User & Agency Profile */}
        <div className="p-3.5 m-3 rounded-2xl bg-slate-800/80 border border-slate-700/60 text-xs space-y-2">
          {currentUser && (
            <div
              onClick={() => setActiveTab('users')}
              className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-700/60 transition cursor-pointer"
              title="Click to manage staff profiles & permissions"
            >
              <img
                src={
                  currentUser.avatar_url ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${currentUser.full_name}`
                }
                alt={currentUser.full_name}
                className="w-8 h-8 rounded-full object-cover border border-slate-600 bg-slate-900 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-white truncate text-xs">
                  {currentUser.full_name}
                </div>
                <div className="text-[10px] text-emerald-400 font-bold truncate">
                  {currentUser.role}
                </div>
              </div>
            </div>
          )}
          <div className="border-t border-slate-700/60 pt-2 text-[11px] text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1 font-semibold text-slate-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Agency Workspace
            </span>
            <span className="text-[10px] font-mono text-slate-500">v2.4 RBAC</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {activeTab === 'dashboard' && 'Executive Agency & CRM Dashboard'}
              {activeTab === 'units' && 'Property Listings & Units Inventory'}
              {activeTab === 'crm' && '360° CRM Directory — Landlords, Tenants & Developers'}
              {activeTab === 'leases' && 'Lease Contracts & Renewal Management'}
              {activeTab === 'issues' && 'Unit Issues, Maintenance & Developer Defect Tracker'}
              {activeTab === 'calculator' &&
                'Property Transaction Calculator & Executive Agency Profit Report'}
              {activeTab === 'settings' &&
                'Financial Architecture & Fee Configuration Engine'}
              {activeTab === 'users' &&
                'Admin Staff Management & Feature Access Permissions (RBAC)'}
            </h2>
            <p className="text-xs text-slate-500">
              {activeTab === 'dashboard' &&
                'Real-time occupancy, expiring contracts, developer warranty claims, and CRM activity.'}
              {activeTab === 'units' &&
                'Manage condo/house listings, auto price-per-sqm, keycard access, meters, and warranty dates.'}
              {activeTab === 'crm' &&
                'Track owners, corporate/expat tenants, vendors, and developer after-sales defect teams.'}
              {activeTab === 'leases' &&
                'Monitor active tenancies, security deposits, rent collection, and upcoming renewals.'}
              {activeTab === 'issues' &&
                'Full unit issue history categorized by Developer Warranty, Landlord, Tenant, or Juristic.'}
              {activeTab === 'calculator' &&
                'Calculate transfer taxes (Transfer Fee, SBT, Stamp Duty, WHT), legal fees, commissions, and agency net profit reports.'}
              {activeTab === 'settings' &&
                'Configure Land Department taxes, juristic CAM fees, sale & rental commissions, property management fees, and flexible custom items.'}
              {activeTab === 'users' &&
                'Manage internal team accounts, assign operational roles, and configure granular permissions controlling what each user can see, create, edit, delete, or calculate.'}
            </p>
          </div>

          {dashboard && (
            <div className="flex items-center gap-3 text-xs">
              <div className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-medium">
                Occupancy: <strong className="text-indigo-600">{dashboard.metrics.occupancy_rate}%</strong>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 font-medium">
                Active Rent Roll:{' '}
                <strong>฿{dashboard.metrics.monthly_rent_volume.toLocaleString()}/mo</strong>
              </div>
            </div>
          )}
        </header>

        {/* Page Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              Loading PropPulse CRM Workspace...
            </div>
          ) : (
            <>
              {/* DASHBOARD VIEW */}
              {activeTab === 'dashboard' && dashboard && (
                <div className="space-y-6">
                  {/* KPI Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div
                      onClick={() => setActiveTab('units')}
                      className="cursor-pointer bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-400 transition shadow-2xs"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                        <span>PORTFOLIO UNITS</span>
                        <Building2 className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div className="text-2xl font-bold text-slate-900 mt-2">
                        {dashboard.metrics.total_units} Units
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        <span className="text-emerald-600 font-semibold">
                          {dashboard.metrics.occupied_units} Occupied
                        </span>{' '}
                        • {dashboard.metrics.available_units} Available •{' '}
                        {dashboard.metrics.maintenance_units} Maintenance
                      </p>
                    </div>

                    <div
                      onClick={() => setActiveTab('leases')}
                      className="cursor-pointer bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-400 transition shadow-2xs"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                        <span>ACTIVE LEASES & RENEWALS</span>
                        <FileText className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="text-2xl font-bold text-slate-900 mt-2">
                        {dashboard.metrics.active_leases_count} Active
                      </div>
                      <p className="text-xs text-amber-700 font-medium mt-1">
                        {dashboard.metrics.expiring_leases_count} Expiring within 60 days
                      </p>
                    </div>

                    <div
                      onClick={() => setActiveTab('issues')}
                      className="cursor-pointer bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-400 transition shadow-2xs"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                        <span>OPEN UNIT ISSUES</span>
                        <Wrench className="w-4 h-4 text-rose-600" />
                      </div>
                      <div className="text-2xl font-bold text-slate-900 mt-2">
                        {dashboard.metrics.open_issues_count} Open Tickets
                      </div>
                      <p className="text-xs text-purple-700 font-medium mt-1">
                        {dashboard.metrics.open_warranty_issues_count} Under Developer Defect Warranty
                      </p>
                    </div>

                    <div
                      onClick={() => setActiveTab('crm')}
                      className="cursor-pointer bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-400 transition shadow-2xs"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                        <span>CRM DIRECTORY</span>
                        <Users className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div className="text-2xl font-bold text-slate-900 mt-2">
                        {dashboard.metrics.landlords_count +
                          dashboard.metrics.tenants_count +
                          dashboard.metrics.developers_count}{' '}
                        Profiles
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {dashboard.metrics.landlords_count} Landlords •{' '}
                        {dashboard.metrics.tenants_count} Tenants •{' '}
                        {dashboard.metrics.developers_count} Developers
                      </p>
                    </div>
                  </div>

                  {/* Two-column Operational Panels */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Open Unit Issues & Developer Defects */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <Wrench className="w-4 h-4 text-rose-600" />
                            Active Unit Issues & Defect Claims
                          </h3>
                          <p className="text-xs text-slate-500">
                            Click any unit to view full repair & warranty history
                          </p>
                        </div>
                        <button
                          onClick={() => setActiveTab('issues')}
                          className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          All Issues <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        {dashboard.open_issues.map((iss) => (
                          <div
                            key={iss.id}
                            onClick={() => setSelectedUnitId(iss.unit_id)}
                            className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 cursor-pointer transition space-y-1.5"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-indigo-600">
                                  {iss.unit_code}
                                </span>
                                <span className="text-slate-500">{iss.project_name}</span>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                                  iss.responsible_party === 'Developer Warranty'
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {iss.responsible_party}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-slate-900">{iss.title}</p>
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span>
                                Status: <strong className="text-slate-700">{iss.status}</strong> •{' '}
                                Priority: <strong>{iss.priority}</strong>
                              </span>
                              <span>Vendor: {iss.vendor_or_contractor || 'Pending'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Expiring Leases + Recent CRM Activity */}
                    <div className="space-y-6">
                      {/* Expiring Leases Alert */}
                      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-600" />
                            Leases Expiring Within 60 Days
                          </h3>
                          <button
                            onClick={() => setActiveTab('leases')}
                            className="text-xs font-semibold text-indigo-600 hover:underline"
                          >
                            Manage Contracts →
                          </button>
                        </div>

                        {dashboard.expiring_leases.length === 0 ? (
                          <p className="text-xs text-slate-400 py-4 text-center">
                            No leases expiring in the next 60 days.
                          </p>
                        ) : (
                          <div className="space-y-2.5">
                            {dashboard.expiring_leases.map((l) => (
                              <div
                                key={l.id}
                                onClick={() => setSelectedUnitId(l.unit_id)}
                                className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 cursor-pointer hover:border-amber-400 transition flex items-center justify-between text-xs"
                              >
                                <div>
                                  <span className="font-bold text-slate-900">
                                    {l.unit_code} ({l.project_name})
                                  </span>
                                  <p className="text-slate-600 mt-0.5">
                                    Tenant: <strong>{l.tenant_name}</strong> • Landlord:{' '}
                                    {l.landlord_name}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className="px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 font-bold">
                                    {l.days_remaining} days left
                                  </span>
                                  <p className="text-slate-500 mt-1">Ends {l.end_date}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Recent CRM Communications */}
                      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-indigo-600" />
                            Recent CRM Communication Timeline
                          </h3>
                          <button
                            onClick={() => setActiveTab('crm')}
                            className="text-xs font-semibold text-indigo-600 hover:underline"
                          >
                            Open CRM →
                          </button>
                        </div>

                        <div className="space-y-2.5">
                          {dashboard.recent_communications.slice(0, 4).map((cm) => (
                            <div
                              key={cm.id}
                              className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-indigo-600">
                                  [{cm.channel}] {cm.subject}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  {cm.unit_code && `Unit ${cm.unit_code}`}
                                </span>
                              </div>
                              <p className="text-slate-600 line-clamp-2">{cm.content}</p>
                              <div className="text-[11px] text-slate-400">
                                Contacts: {cm.contact_name || cm.developer_name || 'General'} • By{' '}
                                {cm.logged_by}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* UNITS INVENTORY VIEW */}
              {activeTab === 'units' && (
                <UnitsInventoryView
                  units={units}
                  developers={developers}
                  contacts={contacts}
                  onRefresh={loadAllData}
                  onSelectUnit={(id) => setSelectedUnitId(id)}
                  onOpenCalculatorForUnit={(u) => {
                    setCalculatorUnit(u);
                    setActiveTab('calculator');
                  }}
                />
              )}

              {/* CRM DIRECTORY VIEW */}
              {activeTab === 'crm' && (
                <CRMDirectoryView
                  contacts={contacts}
                  developers={developers}
                  onRefresh={loadAllData}
                  onSelectUnit={(id) => setSelectedUnitId(id)}
                />
              )}

              {/* LEASE CONTRACTS VIEW */}
              {activeTab === 'leases' && (
                <LeaseContractsView
                  leases={leases}
                  units={units}
                  contacts={contacts}
                  onRefresh={loadAllData}
                  onSelectUnit={(id) => setSelectedUnitId(id)}
                />
              )}

              {/* UNIT ISSUES & DEFECTS VIEW */}
              {activeTab === 'issues' && (
                <UnitIssuesView
                  issues={issues}
                  units={units}
                  leases={leases}
                  preselectedUnitForIssue={preselectedUnitForIssue}
                  onClearPreselectedUnit={() => setPreselectedUnitForIssue(null)}
                  onRefresh={loadAllData}
                  onSelectUnit={(id) => setSelectedUnitId(id)}
                />
              )}

              {/* PROPERTY TRANSACTION CALCULATOR & AGENCY PROFIT REPORT VIEW */}
              {activeTab === 'calculator' && (
                <TransactionCalculatorView
                  units={units}
                  leases={leases}
                  initialUnit={calculatorUnit}
                  onSelectUnit={(id) => setSelectedUnitId(id)}
                />
              )}

              {/* FINANCIAL & FEE ARCHITECTURE SETTINGS VIEW */}
              {activeTab === 'settings' && <FinancialSettingsView />}

              {/* ADMIN USER & FEATURE ACCESS PERMISSION MANAGEMENT VIEW */}
              {activeTab === 'users' && (
                <UserManagementView
                  currentUser={currentUser}
                  onSwitchSimulatedUser={(u) => setCurrentUser(u)}
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* Global 360° Unit Detail Drawer */}
      <UnitDetailDrawer
        unitId={selectedUnitId}
        onClose={() => setSelectedUnitId(null)}
        onRefreshGlobal={loadAllData}
        onOpenNewIssueForUnit={handleOpenNewIssueFromDrawer}
        onOpenCalculatorForUnit={(u) => {
          setSelectedUnitId(null);
          setCalculatorUnit(u);
          setActiveTab('calculator');
        }}
      />
    </div>
  );
}
export default App;
