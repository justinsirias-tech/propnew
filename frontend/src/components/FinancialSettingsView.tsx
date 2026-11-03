import React, { useState, useEffect } from 'react';
import {
  Landmark,
  Building,
  Percent,
  Briefcase,
  Plus,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Save,
  Download,
  Upload,
  Info,
  Sliders,
  DollarSign,
  Scale,
  Sparkles,
  ChevronRight,
  Eye,
  Edit2,
  X,
  FileText,
  Key,
  Tag,
  ShieldCheck,
  Home,
  Building2,
  Warehouse,
  Search,
  Filter,
  MapPin,
  Phone,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { api } from '../api';
import {
  FinancialSettings,
  CustomFeeItem,
  ProjectCamDirectoryItem,
  PropertyDirectoryType,
  getLocalFinancialSettings,
  saveFinancialSettings,
  resetFinancialSettings,
  DEFAULT_FINANCIAL_SETTINGS,
  DEFAULT_PROJECT_CAM_DIRECTORY,
  computeCustomFeesBreakdown,
} from '../utils/financialSettingsStore';
import { FormattedNumberInput, formatSysNumber } from './FormattedNumberInput';

type SettingsTab = 'taxes' | 'cam' | 'commissions' | 'management' | 'custom_items' | 'simulator';

export const FinancialSettingsView: React.FC = () => {
  const [settings, setSettings] = useState<FinancialSettings>(getLocalFinancialSettings);
  const [activeTab, setActiveTab] = useState<SettingsTab>('taxes');
  const [savedBanner, setSavedBanner] = useState(false);
  const [saving, setSaving] = useState(false);

  // New Custom Item Form Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [customForm, setCustomForm] = useState<Omit<CustomFeeItem, 'id'>>({
    name: '',
    category: 'Custom / Other',
    calc_type: 'FIXED',
    amount: 1000,
    borne_by: 'Buyer / Tenant',
    applicable_to: 'Both',
    active: true,
    description: '',
  });

  // Project CAM Directory States
  const [camSearchQuery, setCamSearchQuery] = useState('');
  const [camTypeFilter, setCamTypeFilter] = useState<'ALL' | PropertyDirectoryType>('ALL');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [syncingInventory, setSyncingInventory] = useState(false);
  const [projectForm, setProjectForm] = useState<Omit<ProjectCamDirectoryItem, 'id'>>({
    projectName: '',
    propertyType: 'Condominium',
    city: 'Bangkok',
    district: '',
    developerName: '',
    camFeePerSqmMonth: 55,
    sinkingFundPerSqm: 500,
    paymentCycle: 'Annually',
    juristicCompany: '',
    juristicPhone: '',
    juristicLineId: '',
    juristicEmail: '',
    notes: '',
  });

  // Simulator Test Property Values
  const [simSalePrice, setSimSalePrice] = useState<number>(3000000);
  const [simRent, setSimRent] = useState<number>(15000);
  const [simSizeSqm, setSimSizeSqm] = useState<number>(30);

  // Auto-save or Manual save
  const handleSave = async (updatedSettings?: FinancialSettings) => {
    const toSave = updatedSettings || settings;
    setSaving(true);
    await saveFinancialSettings(toSave);
    setSaving(false);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 3000);
  };

  const handleResetDefaults = async () => {
    if (window.confirm('Reset all financial rates, commissions, and fees to standard Thailand market defaults?')) {
      const def = await resetFinancialSettings();
      setSettings(def);
      setSavedBanner(true);
      setTimeout(() => setSavedBanner(false), 3000);
    }
  };

  // Custom Item Management
  const handleOpenAddModal = (item?: CustomFeeItem) => {
    if (item) {
      setEditingItemId(item.id);
      setCustomForm({
        name: item.name,
        category: item.category,
        calc_type: item.calc_type,
        amount: item.amount,
        borne_by: item.borne_by,
        applicable_to: item.applicable_to,
        active: item.active,
        description: item.description || '',
      });
    } else {
      setEditingItemId(null);
      setCustomForm({
        name: '',
        category: 'Legal & Administrative',
        calc_type: 'FIXED',
        amount: 2500,
        borne_by: 'Buyer / Tenant',
        applicable_to: 'Sale',
        active: true,
        description: '',
      });
    }
    setShowAddModal(true);
  };

  const handleSaveCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customForm.name.trim()) return;

    let updatedList: CustomFeeItem[];
    if (editingItemId) {
      updatedList = settings.custom_items.map((it) =>
        it.id === editingItemId ? { ...customForm, id: editingItemId } : it
      );
    } else {
      const newItem: CustomFeeItem = {
        ...customForm,
        id: `cust-${Date.now()}`,
      };
      updatedList = [...settings.custom_items, newItem];
    }

    const updated = { ...settings, custom_items: updatedList };
    setSettings(updated);
    handleSave(updated);
    setShowAddModal(false);
  };

  const handleDeleteCustomItem = (id: string) => {
    const updatedList = settings.custom_items.filter((it) => it.id !== id);
    const updated = { ...settings, custom_items: updatedList };
    setSettings(updated);
    handleSave(updated);
  };

  const handleToggleItemActive = (id: string) => {
    const updatedList = settings.custom_items.map((it) =>
      it.id === id ? { ...it, active: !it.active } : it
    );
    const updated = { ...settings, custom_items: updatedList };
    setSettings(updated);
    handleSave(updated);
  };

  // =========================================================================
  // Project CAM Directory Handlers
  // =========================================================================
  const handleOpenProjectModal = (project?: ProjectCamDirectoryItem) => {
    if (project) {
      setEditingProjectId(project.id);
      setProjectForm({
        projectName: project.projectName,
        propertyType: project.propertyType,
        city: project.city,
        district: project.district || '',
        developerName: project.developerName || '',
        camFeePerSqmMonth: project.camFeePerSqmMonth,
        sinkingFundPerSqm: project.sinkingFundPerSqm,
        paymentCycle: project.paymentCycle,
        juristicCompany: project.juristicCompany || '',
        juristicPhone: project.juristicPhone || '',
        juristicLineId: project.juristicLineId || '',
        juristicEmail: project.juristicEmail || '',
        notes: project.notes || '',
      });
    } else {
      setEditingProjectId(null);
      setProjectForm({
        projectName: '',
        propertyType: 'Condominium',
        city: 'Bangkok',
        district: '',
        developerName: '',
        camFeePerSqmMonth: 60,
        sinkingFundPerSqm: 500,
        paymentCycle: 'Annually',
        juristicCompany: '',
        juristicPhone: '',
        juristicLineId: '',
        juristicEmail: '',
        notes: '',
      });
    }
    setShowProjectModal(true);
  };

  const handleSaveProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectForm.projectName.trim()) return;

    const currentDir = settings.project_cam_directory || DEFAULT_PROJECT_CAM_DIRECTORY;
    let updatedDir: ProjectCamDirectoryItem[];

    if (editingProjectId) {
      updatedDir = currentDir.map((p) =>
        p.id === editingProjectId ? { ...projectForm, id: editingProjectId } : p
      );
    } else {
      const newProj: ProjectCamDirectoryItem = {
        ...projectForm,
        id: `proj-${Date.now()}-${projectForm.projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      };
      updatedDir = [newProj, ...currentDir];
    }

    const updated = { ...settings, project_cam_directory: updatedDir };
    setSettings(updated);
    handleSave(updated);
    setShowProjectModal(false);
  };

  const handleDeleteProject = (id: string, name: string) => {
    if (window.confirm(`Delete "${name}" from the CAM Directory?`)) {
      const currentDir = settings.project_cam_directory || DEFAULT_PROJECT_CAM_DIRECTORY;
      const updatedDir = currentDir.filter((p) => p.id !== id);
      const updated = { ...settings, project_cam_directory: updatedDir };
      setSettings(updated);
      handleSave(updated);
    }
  };

  const handleQuickUpdateCamRate = (id: string, newRate: number) => {
    const currentDir = settings.project_cam_directory || DEFAULT_PROJECT_CAM_DIRECTORY;
    const updatedDir = currentDir.map((p) =>
      p.id === id ? { ...p, camFeePerSqmMonth: newRate } : p
    );
    const updated = { ...settings, project_cam_directory: updatedDir };
    setSettings(updated);
    handleSave(updated);
  };

  const handleSyncProjectsFromInventory = async () => {
    try {
      setSyncingInventory(true);
      const units = await api.getUnits();
      const currentDir = settings.project_cam_directory || DEFAULT_PROJECT_CAM_DIRECTORY;
      const existingNames = new Set(currentDir.map((p) => p.projectName.trim().toLowerCase()));

      const newlyAdded: ProjectCamDirectoryItem[] = [];
      const distinctProjects = new Map<string, { type: string; city: string; developer?: string }>();

      units.forEach((u) => {
        const name = (u.project_name || '').trim();
        if (name && !existingNames.has(name.toLowerCase()) && !distinctProjects.has(name.toLowerCase())) {
          distinctProjects.set(name.toLowerCase(), {
            type: u.property_type,
            city: u.city || 'Bangkok',
            developer: u.developer_name,
          });
        }
      });

      distinctProjects.forEach((meta, key) => {
        const rawType = (meta.type || '').toLowerCase();
        let propType: PropertyDirectoryType = 'Condominium';
        let defaultCam = 55;
        let defaultSinking = 500;
        let cycle: 'Monthly' | 'Quarterly' | 'Semi-Annually' | 'Annually' = 'Annually';

        if (rawType.includes('town')) {
          propType = 'Townhome';
          defaultCam = 45;
          defaultSinking = 350;
          cycle = 'Quarterly';
        } else if (rawType.includes('single') || rawType.includes('house') || rawType.includes('villa')) {
          propType = 'Single Home';
          defaultCam = 35;
          defaultSinking = 250;
          cycle = 'Semi-Annually';
        } else if (rawType.includes('commercial') || rawType.includes('shop') || rawType.includes('warehouse')) {
          propType = 'Commercial';
          defaultCam = 15;
          defaultSinking = 100;
          cycle = 'Quarterly';
        }

        // Capitalize words properly
        const originalProject = units.find(
          (u) => (u.project_name || '').trim().toLowerCase() === key
        )?.project_name || key;

        newlyAdded.push({
          id: `proj-synced-${Date.now()}-${key.replace(/[^a-z0-9]/g, '-')}`,
          projectName: originalProject,
          propertyType: propType,
          city: meta.city,
          developerName: meta.developer || '',
          camFeePerSqmMonth: defaultCam,
          sinkingFundPerSqm: defaultSinking,
          paymentCycle: cycle,
          notes: `Auto-synced from active properties inventory (${propType}).`,
        });
      });

      if (newlyAdded.length > 0) {
        const updatedDir = [...currentDir, ...newlyAdded];
        const updated = { ...settings, project_cam_directory: updatedDir };
        setSettings(updated);
        await handleSave(updated);
        alert(`Successfully imported ${newlyAdded.length} new project(s) from inventory into CAM Directory!`);
      } else {
        alert('All projects in inventory are already registered in the CAM Directory!');
      }
    } catch (err) {
      console.error('Failed to sync projects from inventory:', err);
      alert('Failed to sync projects from inventory.');
    } finally {
      setSyncingInventory(false);
    }
  };

  // Export / Import JSON
  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proppulse-financial-settings-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.taxes && parsed.cam_fees && parsed.commissions) {
          setSettings(parsed);
          handleSave(parsed);
        }
      } catch (err) {
        alert('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
  };

  // Compute Simulator Results
  const simSaleCustom = computeCustomFeesBreakdown(settings.custom_items, {
    salePrice: simSalePrice,
    monthlyRent: simRent,
    sizeSqm: simSizeSqm,
    dealType: 'Sale',
  });

  const simRentCustom = computeCustomFeesBreakdown(settings.custom_items, {
    salePrice: simSalePrice,
    monthlyRent: simRent,
    sizeSqm: simSizeSqm,
    dealType: 'Rental',
  });

  // Simulator Taxes
  const simTransferFee = Math.round(simSalePrice * (settings.taxes.transfer_fee_rate / 100));
  const simSbt = Math.round(simSalePrice * (settings.taxes.sbt_rate / 100));
  const simWht = Math.round(simSalePrice * (settings.taxes.wht_individual_rate / 100));
  const simSaleComm = Math.round(simSalePrice * (settings.commissions.sale_commission_rate / 100));
  const simCamAnnual = Math.round(simSizeSqm * settings.cam_fees.default_cam_per_sqm_month * 12);
  const simRentalComm = Math.round(simRent * settings.commissions.rental_1yr_months);
  const simPmAnnual = settings.management_fees.use_fixed_pm_fee
    ? settings.management_fees.monthly_pm_fixed_fee * 12
    : Math.round(simRent * 12 * (settings.management_fees.monthly_pm_fee_pct / 100));

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Controls */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-600 mb-1">
            <Sliders className="w-4 h-4" />
            <span>Financial Architecture & Fee Engine</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Financial, Tax & Commission Settings
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Configure Land Department transfer taxes, juristic CAM fees, sale & rental broker commissions,
            and property management fees. Add custom fee items dynamically with flexible rules.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={handleExportJSON}
            className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span>Export</span>
          </button>

          <label className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-1.5 transition cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-indigo-600" />
            <span>Import</span>
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>

          <button
            type="button"
            onClick={() => handleSave()}
            disabled={saving}
            className="px-5 py-2 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center gap-2 transition shadow-sm cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      {savedBanner && (
        <div className="bg-emerald-950 text-white px-5 py-3 rounded-2xl flex items-center gap-2.5 text-xs shadow-md animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong>Settings Saved & Synced:</strong> All updated taxes, CAM fees, commissions, and custom items
            are immediately applied across the Transaction Calculator, Deal Reports, and Property Listings.
          </span>
        </div>
      )}

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('taxes')}
          className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'taxes'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Landmark className="w-4 h-4 text-amber-400" />
          <span>Taxes & Land Dept</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cam')}
          className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'cam'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Building className="w-4 h-4 text-sky-400" />
          <span>CAM & Condo Directory</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300">
            {(settings.project_cam_directory || DEFAULT_PROJECT_CAM_DIRECTORY).length} Projects
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('commissions')}
          className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'commissions'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Percent className="w-4 h-4 text-indigo-400" />
          <span>Brokerage Commissions (Rent & Sale)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('management')}
          className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'management'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Briefcase className="w-4 h-4 text-purple-400" />
          <span>Property Management</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('custom_items')}
          className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'custom_items'
              ? 'bg-indigo-600 text-white shadow-2xs'
              : 'text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Flexible Custom Items ({settings.custom_items.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('simulator')}
          className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'simulator'
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>Live Simulator Preview</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: TAXES & LAND DEPARTMENT FEES */}
      {/* ========================================================================= */}
      {activeTab === 'taxes' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Landmark className="w-5 h-5 text-amber-600" />
                Land Department Transfer Taxes & Government Levies
              </h2>
              <p className="text-xs text-slate-500">
                Configure standard transfer fee rates, Specific Business Tax (SBT), Stamp Duty, and Withholding Tax.
              </p>
            </div>
            <span className="px-3 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 font-extrabold text-xs">
              Thailand Legal Framework
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
            {/* Transfer Fee Rate */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <label className="font-extrabold text-slate-900 block">
                Transfer Fee Rate (%)
              </label>
              <div className="flex items-center gap-2">
                <FormattedNumberInput
                  value={settings.taxes.transfer_fee_rate}
                  onValueChange={(val) =>
                    setSettings({
                      ...settings,
                      taxes: { ...settings.taxes, transfer_fee_rate: val },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-extrabold text-slate-900"
                />
                <span className="font-bold text-slate-500">%</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Official Land Department transfer fee on appraised value (standard 2.0%).
              </p>
            </div>

            {/* Default Transfer Split */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <label className="font-extrabold text-slate-900 block">
                Default Transfer Fee Allocation
              </label>
              <select
                value={settings.taxes.default_transfer_split}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    taxes: {
                      ...settings.taxes,
                      default_transfer_split: e.target.value as any,
                    },
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-900"
              >
                <option value="50_50">50% Seller / 50% Buyer (Market Standard)</option>
                <option value="SELLER_100">100% Seller</option>
                <option value="BUYER_100">100% Buyer</option>
              </select>
              <p className="text-[11px] text-slate-500">
                Market convention usually splits the 2% transfer fee 50/50.
              </p>
            </div>

            {/* Specific Business Tax (SBT) */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <label className="font-extrabold text-slate-900 block">
                Specific Business Tax (SBT) (%)
              </label>
              <div className="flex items-center gap-2">
                <FormattedNumberInput
                  value={settings.taxes.sbt_rate}
                  onValueChange={(val) =>
                    setSettings({
                      ...settings,
                      taxes: { ...settings.taxes, sbt_rate: val },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-extrabold text-slate-900"
                />
                <span className="font-bold text-slate-500">%</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Applies if owned &lt; 5 years or corporate seller (3.3% includes municipal tax).
              </p>
            </div>

            {/* Stamp Duty */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <label className="font-extrabold text-slate-900 block">
                Stamp Duty (%) (Held &ge; 5 yrs)
              </label>
              <div className="flex items-center gap-2">
                <FormattedNumberInput
                  value={settings.taxes.stamp_duty_rate}
                  onValueChange={(val) =>
                    setSettings({
                      ...settings,
                      taxes: { ...settings.taxes, stamp_duty_rate: val },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-extrabold text-slate-900"
                />
                <span className="font-bold text-slate-500">%</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Exempt if SBT applies. Otherwise 0.5% of declared sale price or appraised value.
              </p>
            </div>

            {/* WHT Individual */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <label className="font-extrabold text-slate-900 block">
                Effective WHT Individual (%)
              </label>
              <div className="flex items-center gap-2">
                <FormattedNumberInput
                  value={settings.taxes.wht_individual_rate}
                  onValueChange={(val) =>
                    setSettings({
                      ...settings,
                      taxes: { ...settings.taxes, wht_individual_rate: val },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-extrabold text-slate-900"
                />
                <span className="font-bold text-slate-500">%</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Progressive personal income withholding tax at Land Dept (~2.0% - 2.5%).
              </p>
            </div>

            {/* Rental Withholding Tax */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <label className="font-extrabold text-slate-900 block">
                Rental Withholding Tax (%)
              </label>
              <div className="flex items-center gap-2">
                <FormattedNumberInput
                  value={settings.taxes.rental_wht_rate}
                  onValueChange={(val) =>
                    setSettings({
                      ...settings,
                      taxes: { ...settings.taxes, rental_wht_rate: val },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-extrabold text-slate-900"
                />
                <span className="font-bold text-slate-500">%</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Standard 5.0% WHT withheld by corporate tenants or Land & Building tax.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CAM & CONDO DIRECTORY (CONDO, TOWNHOME, SINGLE HOME, COMMERCIAL) */}
      {/* ========================================================================= */}
      {activeTab === 'cam' && (() => {
        const directory = settings.project_cam_directory || DEFAULT_PROJECT_CAM_DIRECTORY;
        const condoList = directory.filter((p) => p.propertyType === 'Condominium');
        const townList = directory.filter((p) => p.propertyType === 'Townhome');
        const singleList = directory.filter((p) => p.propertyType === 'Single Home');
        const commList = directory.filter((p) => p.propertyType === 'Commercial');

        const avgCondo = condoList.length
          ? Math.round(condoList.reduce((acc, p) => acc + p.camFeePerSqmMonth, 0) / condoList.length)
          : 55;
        const avgTown = townList.length
          ? Math.round(townList.reduce((acc, p) => acc + p.camFeePerSqmMonth, 0) / townList.length)
          : 45;
        const avgSingle = singleList.length
          ? Math.round(singleList.reduce((acc, p) => acc + p.camFeePerSqmMonth, 0) / singleList.length)
          : 35;

        const filteredProjects = directory.filter((p) => {
          if (camTypeFilter !== 'ALL' && p.propertyType !== camTypeFilter) return false;
          if (!camSearchQuery.trim()) return true;
          const q = camSearchQuery.toLowerCase();
          return (
            p.projectName.toLowerCase().includes(q) ||
            (p.developerName && p.developerName.toLowerCase().includes(q)) ||
            (p.city && p.city.toLowerCase().includes(q)) ||
            (p.district && p.district.toLowerCase().includes(q)) ||
            (p.juristicCompany && p.juristicCompany.toLowerCase().includes(q))
          );
        });

        return (
          <div className="space-y-6">
            {/* Top Directory Header & Controls */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-100 text-sky-800">
                      Estate & Building Registry
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs font-semibold text-slate-500">
                      Auto-linked to Transaction Calculator & Deal Reports
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900 flex items-center gap-2.5 mt-1.5">
                    <Building className="w-6 h-6 text-sky-600" />
                    Condo, Townhome & Single Home CAM Directory
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                    Maintain distinct Common Area Maintenance (CAM) fee rates per sqm/month, one-time sinking fund contributions,
                    billing cycles, and juristic office contacts for each individual condominium, gated townhome, and housing development.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handleSyncProjectsFromInventory}
                    disabled={syncingInventory}
                    className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                    title="Automatically scan active inventory and import missing project names"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-sky-600 ${syncingInventory ? 'animate-spin' : ''}`} />
                    <span>{syncingInventory ? 'Scanning...' : 'Sync from Inventory'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenProjectModal()}
                    className="px-4 py-2 text-xs font-extrabold text-white bg-sky-600 hover:bg-sky-700 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Add Building Profile</span>
                  </button>
                </div>
              </div>

              {/* Statistics Overview Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-100">
                  <div className="text-[11px] font-bold text-sky-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5" />
                    <span>Total Registered</span>
                  </div>
                  <div className="text-xl font-black text-sky-950 mt-1">
                    {directory.length} <span className="text-xs font-medium text-sky-700">Projects</span>
                  </div>
                  <div className="text-[10px] text-sky-600/80 mt-0.5">
                    {condoList.length} Condos · {townList.length} Towns · {singleList.length} Homes
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100">
                  <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Condominiums</span>
                  </div>
                  <div className="text-xl font-black text-indigo-950 mt-1">
                    ฿{avgCondo} <span className="text-xs font-semibold text-indigo-700">/sqm/mo</span>
                  </div>
                  <div className="text-[10px] text-indigo-600/80 mt-0.5">
                    Typical Bangkok range: ฿50 – ฿95+
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100">
                  <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Home className="w-3.5 h-3.5" />
                    <span>Gated Townhomes</span>
                  </div>
                  <div className="text-xl font-black text-amber-950 mt-1">
                    ฿{avgTown} <span className="text-xs font-semibold text-amber-700">/sqm/mo</span>
                  </div>
                  <div className="text-[10px] text-amber-600/80 mt-0.5">
                    Townhome cluster baseline: ฿45
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                  <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Single Detached</span>
                  </div>
                  <div className="text-xl font-black text-emerald-950 mt-1">
                    ฿{avgSingle} <span className="text-xs font-semibold text-emerald-700">/sqm/mo</span>
                  </div>
                  <div className="text-[10px] text-emerald-600/80 mt-0.5">
                    Estate security baseline: ฿35
                  </div>
                </div>
              </div>

              {/* Filter Pills & Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setCamTypeFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
                      camTypeFilter === 'ALL'
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All Types ({directory.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setCamTypeFilter('Condominium')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                      camTypeFilter === 'Condominium'
                        ? 'bg-sky-600 text-white shadow-2xs'
                        : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                    }`}
                  >
                    <Building2 className="w-3 h-3" />
                    Condos ({condoList.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setCamTypeFilter('Townhome')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                      camTypeFilter === 'Townhome'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    <Home className="w-3 h-3" />
                    Townhomes ({townList.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setCamTypeFilter('Single Home')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                      camTypeFilter === 'Single Home'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    Single Homes ({singleList.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setCamTypeFilter('Commercial')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                      camTypeFilter === 'Commercial'
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                    }`}
                  >
                    <Warehouse className="w-3 h-3" />
                    Commercial ({commList.length})
                  </button>
                </div>

                <div className="relative min-w-[240px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search condo, developer, district..."
                    value={camSearchQuery}
                    onChange={(e) => setCamSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-sky-500 transition"
                  />
                  {camSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setCamSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Projects Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Building / Project</th>
                      <th className="py-3 px-3">Type</th>
                      <th className="py-3 px-3">Location</th>
                      <th className="py-3 px-4">CAM Rate (฿/sqm/mo)</th>
                      <th className="py-3 px-3">Sinking Fund</th>
                      <th className="py-3 px-3">Billing Cycle</th>
                      <th className="py-3 px-3">Juristic Office</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredProjects.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          <Building className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                          No buildings found matching your filter or search query.
                        </td>
                      </tr>
                    ) : (
                      filteredProjects.map((p) => {
                        const isCondo = p.propertyType === 'Condominium';
                        const isTown = p.propertyType === 'Townhome';
                        const isSingle = p.propertyType === 'Single Home';
                        const isComm = p.propertyType === 'Commercial';

                        return (
                          <tr key={p.id} className="hover:bg-sky-50/30 transition group">
                            {/* Project Name & Developer */}
                            <td className="py-3 px-4 font-semibold text-slate-900">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                    isCondo
                                      ? 'bg-sky-100 text-sky-700'
                                      : isTown
                                      ? 'bg-amber-100 text-amber-700'
                                      : isSingle
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-purple-100 text-purple-700'
                                  }`}
                                >
                                  {isCondo && <Building2 className="w-3.5 h-3.5" />}
                                  {isTown && <Home className="w-3.5 h-3.5" />}
                                  {isSingle && <Sparkles className="w-3.5 h-3.5" />}
                                  {isComm && <Warehouse className="w-3.5 h-3.5" />}
                                </div>
                                <div>
                                  <div className="font-extrabold text-slate-900 group-hover:text-sky-600 transition">
                                    {p.projectName}
                                  </div>
                                  {p.developerName && (
                                    <div className="text-[11px] text-slate-400 font-normal">
                                      {p.developerName}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Property Type Badge */}
                            <td className="py-3 px-3">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-tight ${
                                  isCondo
                                    ? 'bg-sky-100 text-sky-800 border border-sky-200'
                                    : isTown
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : isSingle
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-purple-100 text-purple-800 border border-purple-200'
                                }`}
                              >
                                {p.propertyType}
                              </span>
                            </td>

                            {/* City / District */}
                            <td className="py-3 px-3">
                              <div className="text-[11px] font-bold text-slate-800">{p.city}</div>
                              {p.district && (
                                <div className="text-[10px] text-slate-400">{p.district}</div>
                              )}
                            </td>

                            {/* CAM Fee Inline Editable */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5">
                                <FormattedNumberInput
                                  value={p.camFeePerSqmMonth}
                                  onValueChange={(val) => handleQuickUpdateCamRate(p.id, val)}
                                  className="w-20 px-2 py-1 rounded-lg border border-slate-300 bg-white font-black text-slate-900 text-xs focus:border-sky-500"
                                />
                                <span className="font-semibold text-[11px] text-slate-500">฿/sqm/mo</span>
                              </div>
                            </td>

                            {/* Sinking Fund */}
                            <td className="py-3 px-3">
                              <div className="font-extrabold text-slate-900">
                                ฿{formatSysNumber(p.sinkingFundPerSqm)}
                              </div>
                              <div className="text-[10px] text-slate-400">one-time reserve</div>
                            </td>

                            {/* Payment Cycle */}
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700">
                                {p.paymentCycle}
                              </span>
                            </td>

                            {/* Juristic Company / Contacts */}
                            <td className="py-3 px-3">
                              {p.juristicCompany ? (
                                <div className="space-y-0.5">
                                  <div className="font-bold text-slate-800 text-[11px] truncate max-w-[150px]">
                                    {p.juristicCompany}
                                  </div>
                                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                    {p.juristicPhone && (
                                      <span title={p.juristicPhone}>📞 {p.juristicPhone}</span>
                                    )}
                                    {p.juristicLineId && (
                                      <span title={p.juristicLineId} className="text-emerald-600 font-semibold">
                                        Line: {p.juristicLineId}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">Self-managed</span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenProjectModal(p)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition cursor-pointer"
                                  title="Edit Project Profile"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProject(p.id, p.projectName)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                  title="Delete Profile"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Standard Juristic & Global Baseline Fallbacks */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-sky-600" />
                    Standard Juristic & Global Baseline Fallbacks
                  </h3>
                  <p className="text-xs text-slate-500">
                    These baseline rates apply if a property unit does not match any entry in the Condo Directory above.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-700 font-bold text-[11px]">
                  Default Fallback
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
                {/* Default CAM per Sqm Month */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="font-extrabold text-slate-900 block">
                    Default CAM Fee (THB / sqm / month)
                  </label>
                  <div className="flex items-center gap-2">
                    <FormattedNumberInput
                      value={settings.cam_fees.default_cam_per_sqm_month}
                      onValueChange={(val) =>
                        setSettings({
                          ...settings,
                          cam_fees: {
                            ...settings.cam_fees,
                            default_cam_per_sqm_month: val,
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-extrabold text-slate-900"
                    />
                    <span className="font-bold text-slate-500">฿/sqm/mo</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Applied when a unit has no matching project name in the directory.
                  </p>
                </div>

                {/* Sinking Fund per Sqm */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="font-extrabold text-slate-900 block">
                    Default Sinking Fund (THB / sqm one-time)
                  </label>
                  <div className="flex items-center gap-2">
                    <FormattedNumberInput
                      value={settings.cam_fees.sinking_fund_per_sqm}
                      onValueChange={(val) =>
                        setSettings({
                          ...settings,
                          cam_fees: {
                            ...settings.cam_fees,
                            sinking_fund_per_sqm: val,
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-extrabold text-slate-900"
                    />
                    <span className="font-bold text-slate-500">฿/sqm</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Standard building capital reserve contribution.
                  </p>
                </div>

                {/* Sinking Fund Payer */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="font-extrabold text-slate-900 block">
                    Sinking Fund Responsibility
                  </label>
                  <select
                    value={settings.cam_fees.sinking_fund_payer}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        cam_fees: {
                          ...settings.cam_fees,
                          sinking_fund_payer: e.target.value as any,
                        },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-900"
                  >
                    <option value="BUYER">Buyer (Standard on Developer Handover)</option>
                    <option value="SELLER">Seller / Landlord</option>
                    <option value="SPLIT">50/50 Split</option>
                  </select>
                  <p className="text-[11px] text-slate-500">
                    Typically paid by buyer on initial transfer or negotiated on resale.
                  </p>
                </div>

                {/* Juristic Meter Deposit */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="font-extrabold text-slate-900 block">
                    Juristic Electricity/Water Meter Deposit (THB)
                  </label>
                  <FormattedNumberInput
                    value={settings.cam_fees.juristic_meter_deposit}
                    onValueChange={(val) =>
                      setSettings({
                        ...settings,
                        cam_fees: {
                          ...settings.cam_fees,
                          juristic_meter_deposit: val,
                        },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-extrabold text-slate-900"
                  />
                  <p className="text-[11px] text-slate-500">
                    Security deposit held by juristic person for sub-meters (usually ฿2,000 - ฿5,000).
                  </p>
                </div>

                {/* Annual Insurance */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="font-extrabold text-slate-900 block">
                    Juristic Building Structure Insurance (THB / year)
                  </label>
                  <FormattedNumberInput
                    value={settings.cam_fees.juristic_annual_insurance}
                    onValueChange={(val) =>
                      setSettings({
                        ...settings,
                        cam_fees: {
                          ...settings.cam_fees,
                          juristic_annual_insurance: val,
                        },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-extrabold text-slate-900"
                  />
                  <p className="text-[11px] text-slate-500">
                    Annual common property master fire & structural insurance share.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* TAB 3: COMMISSIONS FOR RENTAL & SALE */}
      {/* ========================================================================= */}
      {activeTab === 'commissions' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Percent className="w-5 h-5 text-indigo-600" />
                Brokerage Commission Rates (Rental & Sale)
              </h2>
              <p className="text-xs text-slate-500">
                Configure standard 3% sale commission, co-broke splits, agent payouts, and lease term commissions.
              </p>
            </div>
            <span className="px-3 py-1 rounded-xl bg-indigo-50 text-indigo-900 border border-indigo-200 font-extrabold text-xs">
              TREBA & Industry Benchmark
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
            {/* Sale Commission Rate */}
            <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200 space-y-2">
              <label className="font-extrabold text-indigo-950 block">
                Sale Commission Rate (%)
              </label>
              <div className="flex items-center gap-2">
                <FormattedNumberInput
                  value={settings.commissions.sale_commission_rate}
                  onValueChange={(val) =>
                    setSettings({
                      ...settings,
                      commissions: {
                        ...settings.commissions,
                        sale_commission_rate: val,
                      },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-indigo-300 bg-white font-extrabold text-indigo-950"
                />
                <span className="font-bold text-indigo-700">%</span>
              </div>
              <p className="text-[11px] text-indigo-600">
                Thailand real estate standard: 3.0% of closed contract sale price.
              </p>
            </div>

            {/* Sale Min Commission */}
            <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200 space-y-2">
              <label className="font-extrabold text-indigo-950 block">
                Minimum Sale Commission Floor (THB)
              </label>
              <FormattedNumberInput
                value={settings.commissions.sale_min_commission}
                onValueChange={(val) =>
                  setSettings({
                    ...settings,
                    commissions: {
                      ...settings.commissions,
                      sale_min_commission: val,
                    },
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-indigo-300 bg-white font-extrabold text-indigo-950"
              />
              <p className="text-[11px] text-indigo-600">
                Minimum fee charged regardless of lower property valuation (e.g. ฿50,000).
              </p>
            </div>

            {/* Co-Broke Partner Split */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <label className="font-extrabold text-slate-900 block">
                Co-Broke Partner Split (%)
              </label>
              <div className="flex items-center gap-2">
                <FormattedNumberInput
                  value={settings.commissions.sale_co_broke_split_pct}
                  onValueChange={(val) =>
                    setSettings({
                      ...settings,
                      commissions: {
                        ...settings.commissions,
                        sale_co_broke_split_pct: val,
                      },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-extrabold text-slate-900"
                />
                <span className="font-bold text-slate-500">%</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Share given to external co-broker representing buyer/tenant (usually 50%).
              </p>
            </div>

            {/* 1-Year Rental Commission */}
            <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-2">
              <label className="font-extrabold text-emerald-950 block">
                1-Year Rental Commission (Months)
              </label>
              <div className="flex items-center gap-2">
                <FormattedNumberInput
                  value={settings.commissions.rental_1yr_months}
                  onValueChange={(val) =>
                    setSettings({
                      ...settings,
                      commissions: {
                        ...settings.commissions,
                        rental_1yr_months: val,
                      },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-emerald-300 bg-white font-extrabold text-emerald-950"
                />
                <span className="font-bold text-emerald-700">mo</span>
              </div>
              <p className="text-[11px] text-emerald-700">
                Standard in Thailand: 1.0 month rent for a 12-month lease agreement.
              </p>
            </div>

            {/* 6-Month Rental Commission */}
            <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-2">
              <label className="font-extrabold text-emerald-950 block">
                6-Month Rental Commission (Months)
              </label>
              <div className="flex items-center gap-2">
                <FormattedNumberInput
                  value={settings.commissions.rental_6mo_months}
                  onValueChange={(val) =>
                    setSettings({
                      ...settings,
                      commissions: {
                        ...settings.commissions,
                        rental_6mo_months: val,
                      },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-emerald-300 bg-white font-extrabold text-emerald-950"
                />
                <span className="font-bold text-emerald-700">mo</span>
              </div>
              <p className="text-[11px] text-emerald-700">
                Standard: 0.5 month rent for a 6-month short-term tenancy.
              </p>
            </div>

            {/* Internal Closing Agent Share */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <label className="font-extrabold text-slate-900 block">
                Internal Agent Share (%)
              </label>
              <div className="flex items-center gap-2">
                <FormattedNumberInput
                  value={settings.commissions.sale_internal_agent_share_pct}
                  onValueChange={(val) =>
                    setSettings({
                      ...settings,
                      commissions: {
                        ...settings.commissions,
                        sale_internal_agent_share_pct: val,
                      },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-extrabold text-slate-900"
                />
                <span className="font-bold text-slate-500">%</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Commission split paid to the internal agency agent (standard 20% - 30%).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PROPERTY MANAGEMENT FEES */}
      {/* ========================================================================= */}
      {activeTab === 'management' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-purple-600" />
                Property Management & Operations Fees
              </h2>
              <p className="text-xs text-slate-500">
                Configure ongoing monthly management fee, turnover inspection fees, and maintenance escrow thresholds.
              </p>
            </div>
            <span className="px-3 py-1 rounded-xl bg-purple-50 text-purple-900 border border-purple-200 font-extrabold text-xs">
              Full-Service Property Management
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
            {/* Monthly PM Fee Percentage */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-extrabold text-slate-900">
                  Monthly Management Fee (% of Rent)
                </label>
                <input
                  type="checkbox"
                  checked={!settings.management_fees.use_fixed_pm_fee}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      management_fees: {
                        ...settings.management_fees,
                        use_fixed_pm_fee: !e.target.checked,
                      },
                    })
                  }
                  className="rounded text-indigo-600"
                  title="Enable percentage of rent calculation"
                />
              </div>
              <div className="flex items-center gap-2">
                <FormattedNumberInput
                  disabled={settings.management_fees.use_fixed_pm_fee}
                  value={settings.management_fees.monthly_pm_fee_pct}
                  onValueChange={(val) =>
                    setSettings({
                      ...settings,
                      management_fees: {
                        ...settings.management_fees,
                        monthly_pm_fee_pct: val,
                      },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-extrabold text-slate-900 disabled:bg-slate-100"
                />
                <span className="font-bold text-slate-500">%</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Industry standard: 8% to 10% of monthly collected rent for full management.
              </p>
            </div>

            {/* Monthly PM Fixed Fee Alternative */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-extrabold text-slate-900">
                  Or Flat Monthly Management Fee (THB)
                </label>
                <input
                  type="checkbox"
                  checked={settings.management_fees.use_fixed_pm_fee}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      management_fees: {
                        ...settings.management_fees,
                        use_fixed_pm_fee: e.target.checked,
                      },
                    })
                  }
                  className="rounded text-indigo-600"
                  title="Enable fixed monthly management fee"
                />
              </div>
              <FormattedNumberInput
                disabled={!settings.management_fees.use_fixed_pm_fee}
                value={settings.management_fees.monthly_pm_fixed_fee}
                onValueChange={(val) =>
                  setSettings({
                    ...settings,
                    management_fees: {
                      ...settings.management_fees,
                      monthly_pm_fixed_fee: val,
                    },
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-extrabold text-slate-900 disabled:bg-slate-100"
              />
              <p className="text-[11px] text-slate-500">
                Flat fee alternative (e.g. ฿2,000 / month flat for standard condos).
              </p>
            </div>

            {/* Turnover Inspection Fee */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <label className="font-extrabold text-slate-900 block">
                Turnover & Move-In Inspection (THB)
              </label>
              <FormattedNumberInput
                value={settings.management_fees.turnover_inspection_fee}
                onValueChange={(val) =>
                  setSettings({
                    ...settings,
                    management_fees: {
                      ...settings.management_fees,
                      turnover_inspection_fee: val,
                    },
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-extrabold text-slate-900"
              />
              <p className="text-[11px] text-slate-500">
                Detailed 50-point photo inventory & key turnover handling per lease.
              </p>
            </div>

            {/* Annual Maintenance Escrow */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <label className="font-extrabold text-slate-900 block">
                Annual Maintenance Reserve Escrow (THB)
              </label>
              <FormattedNumberInput
                value={settings.management_fees.annual_maintenance_escrow}
                onValueChange={(val) =>
                  setSettings({
                    ...settings,
                    management_fees: {
                      ...settings.management_fees,
                      annual_maintenance_escrow: val,
                    },
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-extrabold text-slate-900"
              />
              <p className="text-[11px] text-slate-500">
                Escrow held for routine plumbing, AC filter replacement, and repairs.
              </p>
            </div>

            {/* Emergency Repair Threshold */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <label className="font-extrabold text-slate-900 block">
                Emergency Repair Discretionary Limit (THB)
              </label>
              <FormattedNumberInput
                value={settings.management_fees.emergency_repair_threshold}
                onValueChange={(val) =>
                  setSettings({
                    ...settings,
                    management_fees: {
                      ...settings.management_fees,
                      emergency_repair_threshold: val,
                    },
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-extrabold text-slate-900"
              />
              <p className="text-[11px] text-slate-500">
                Maximum repair expenditure authorized without requiring landlord approval.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: FLEXIBLE CUSTOM ITEMS MANAGER */}
      {/* ========================================================================= */}
      {activeTab === 'custom_items' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                Custom Fee, Tax & Surcharge Manager
              </h2>
              <p className="text-xs text-slate-500">
                Add flexible custom fees manually (e.g. Sinking Fund, FET Certificate, TM30 Expat Filing, Deep Cleaning, Juristic Deposits).
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              className="px-4 py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center gap-2 transition shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Custom Fee Item</span>
            </button>
          </div>

          {settings.custom_items.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 space-y-2">
              <Plus className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-600">No custom fee items added yet</p>
              <p className="text-xs text-slate-400">
                Click "+ Add Custom Fee Item" to add flexible taxes, juristic contributions, or administrative charges.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {settings.custom_items.map((item) => (
                <div
                  key={item.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    item.active
                      ? 'bg-white border-slate-200 shadow-2xs'
                      : 'bg-slate-50/70 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[10px] uppercase tracking-wider">
                          {item.category}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[10px]">
                          Applies to: {item.applicable_to}
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-slate-900 mt-2">{item.name}</h4>
                      {item.description && (
                        <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleItemActive(item.id)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer ${
                          item.active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {item.active ? 'ACTIVE' : 'DISABLED'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenAddModal(item)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                        title="Edit Item"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomItem(item.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Delete Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        Rate / Calculation
                      </span>
                      <span className="font-extrabold text-slate-900">
                        {item.calc_type === 'PERCENT_OF_SALE' && `${item.amount}% of Sale Price`}
                        {item.calc_type === 'PERCENT_OF_RENT' && `${item.amount}% of Monthly Rent`}
                        {item.calc_type === 'PER_SQM_MONTH' && `฿${item.amount}/sqm/mo (Annualized)`}
                        {item.calc_type === 'PER_SQM_ONETIME' && `฿${item.amount}/sqm One-Time`}
                        {item.calc_type === 'FIXED' && `฿${formatSysNumber(item.amount)} Fixed`}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        Borne By
                      </span>
                      <span className="font-extrabold text-indigo-700">{item.borne_by}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: LIVE SIMULATOR PREVIEW */}
      {/* ========================================================================= */}
      {activeTab === 'simulator' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Eye className="w-5 h-5 text-emerald-600" />
                Live Fee & Tax Engine Simulator
              </h2>
              <p className="text-xs text-slate-500">
                Test how your current rates, juristic CAM fees, commissions, and custom items calculate in real time.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-600">Sample Property:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSimSalePrice(3000000);
                    setSimRent(15000);
                    setSimSizeSqm(30);
                  }}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
                >
                  Standard ฿3.0M / 30 sqm
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSimSalePrice(10000000);
                    setSimRent(45000);
                    setSimSizeSqm(65);
                  }}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100"
                >
                  Luxury ฿10M / 65 sqm
                </button>
              </div>
            </div>
          </div>

          {/* Simulator Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Sale Price (THB)</label>
              <FormattedNumberInput
                value={simSalePrice}
                onValueChange={(val) => setSimSalePrice(val)}
                className="w-full px-3 py-2 rounded-xl border border-indigo-300 bg-white font-extrabold text-slate-900"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Monthly Rent (THB/mo)</label>
              <FormattedNumberInput
                value={simRent}
                onValueChange={(val) => setSimRent(val)}
                className="w-full px-3 py-2 rounded-xl border border-emerald-300 bg-white font-extrabold text-slate-900"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Unit Size (Sqm)</label>
              <FormattedNumberInput
                value={simSizeSqm}
                onValueChange={(val) => setSimSizeSqm(Math.max(1, val))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-extrabold text-slate-900"
              />
            </div>
          </div>

          {/* Simulator Side-by-Side Live Results */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sale Scenario Results */}
            <div className="p-5 rounded-2xl bg-indigo-50/40 border border-indigo-200 space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-indigo-200 pb-2">
                <span className="font-extrabold text-sm text-indigo-950 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-indigo-600" />
                  Sale Transaction Output
                </span>
                <span className="font-black text-indigo-900">
                  ฿{formatSysNumber(simSalePrice / simSizeSqm, 2)} / sqm
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between py-1 px-2 rounded bg-white">
                  <span>Transfer Fee ({settings.taxes.transfer_fee_rate}%):</span>
                  <span className="font-bold text-slate-900">฿{formatSysNumber(simTransferFee)}</span>
                </div>
                <div className="flex justify-between py-1 px-2 rounded bg-white">
                  <span>SBT ({settings.taxes.sbt_rate}%) or Stamp Duty:</span>
                  <span className="font-bold text-slate-900">฿{formatSysNumber(simSbt)}</span>
                </div>
                <div className="flex justify-between py-1 px-2 rounded bg-white">
                  <span>Withholding Tax (~{settings.taxes.wht_individual_rate}%):</span>
                  <span className="font-bold text-slate-900">฿{formatSysNumber(simWht)}</span>
                </div>
                <div className="flex justify-between py-1 px-2 rounded bg-white">
                  <span>Sale Commission ({settings.commissions.sale_commission_rate}%):</span>
                  <span className="font-bold text-indigo-700">฿{formatSysNumber(simSaleComm)}</span>
                </div>
                <div className="flex justify-between py-1 px-2 rounded bg-white">
                  <span>Active Custom Sale Fees ({simSaleCustom.itemizedList.length} items):</span>
                  <span className="font-bold text-purple-700">฿{formatSysNumber(simSaleCustom.grossTotal)}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-indigo-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">
                    Seller Net Proceeds (Est.)
                  </span>
                  <span className="text-base font-black text-emerald-800">
                    ฿{formatSysNumber(simSalePrice - (simTransferFee * 0.5) - simSbt - simWht - simSaleComm - simSaleCustom.sellerTotal)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">
                    Buyer Total Outlay (Est.)
                  </span>
                  <span className="text-base font-black text-indigo-900">
                    ฿{formatSysNumber(simSalePrice + (simTransferFee * 0.5) + simSaleCustom.buyerTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Rental Scenario Results */}
            <div className="p-5 rounded-2xl bg-emerald-50/40 border border-emerald-200 space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                <span className="font-extrabold text-sm text-emerald-950 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-emerald-600" />
                  Rental & Yield Output
                </span>
                <span className="font-black text-emerald-900">
                  {((simRent * 12 / simSalePrice) * 100).toFixed(2)}% Gross Yield
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between py-1 px-2 rounded bg-white">
                  <span>1-Year Gross Rent:</span>
                  <span className="font-bold text-slate-900">฿{formatSysNumber(simRent * 12)}</span>
                </div>
                <div className="flex justify-between py-1 px-2 rounded bg-white">
                  <span>Rental Agency Comm ({settings.commissions.rental_1yr_months} mo):</span>
                  <span className="font-bold text-rose-600">-฿{formatSysNumber(simRentalComm)}</span>
                </div>
                <div className="flex justify-between py-1 px-2 rounded bg-white">
                  <span>Annual CAM Fee (฿{settings.cam_fees.default_cam_per_sqm_month}/sqm/mo):</span>
                  <span className="font-bold text-slate-900">฿{formatSysNumber(simCamAnnual)}</span>
                </div>
                <div className="flex justify-between py-1 px-2 rounded bg-white">
                  <span>Annual Property Mgmt Fee:</span>
                  <span className="font-bold text-purple-700">฿{formatSysNumber(simPmAnnual)}</span>
                </div>
                <div className="flex justify-between py-1 px-2 rounded bg-white">
                  <span>Active Custom Rental Fees ({simRentCustom.itemizedList.length} items):</span>
                  <span className="font-bold text-teal-700">฿{formatSysNumber(simRentCustom.grossTotal)}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">
                    Landlord Net Annual Income
                  </span>
                  <span className="text-base font-black text-emerald-900">
                    ฿{formatSysNumber(simRent * 12 - simRentalComm - simCamAnnual - simPmAnnual - simRentCustom.sellerTotal)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">
                    Tenant Move-In Cashflow
                  </span>
                  <span className="text-base font-black text-teal-900">
                    ฿{formatSysNumber(simRent * 3 + simRentCustom.buyerTotal)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT CUSTOM FEE ITEM */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-black text-slate-900">
                {editingItemId ? 'Edit Custom Fee Item' : 'Add Custom Fee / Tax Item'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomItem} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-800 block mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sinking Fund Contribution, Foreign Quota Bank Cert, TM30 Expat Fee..."
                  value={customForm.name}
                  onChange={(e) => setCustomForm({ ...customForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Category</label>
                  <select
                    value={customForm.category}
                    onChange={(e) =>
                      setCustomForm({ ...customForm, category: e.target.value as any })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                  >
                    <option value="Taxes & Government">Taxes & Government</option>
                    <option value="CAM & Juristic">CAM & Juristic</option>
                    <option value="Commission & Brokerage">Commission & Brokerage</option>
                    <option value="Property Management">Property Management</option>
                    <option value="Legal & Administrative">Legal & Administrative</option>
                    <option value="Custom / Other">Custom / Other</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Applies To</label>
                  <select
                    value={customForm.applicable_to}
                    onChange={(e) =>
                      setCustomForm({ ...customForm, applicable_to: e.target.value as any })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                  >
                    <option value="Sale">Sale Only</option>
                    <option value="Rental">Rental Only</option>
                    <option value="Both">Both Sale & Rental</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Calculation Rule</label>
                  <select
                    value={customForm.calc_type}
                    onChange={(e) =>
                      setCustomForm({ ...customForm, calc_type: e.target.value as any })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                  >
                    <option value="FIXED">Fixed Amount (THB)</option>
                    <option value="PERCENT_OF_SALE">% of Sale Price</option>
                    <option value="PERCENT_OF_RENT">% of Monthly Rent</option>
                    <option value="PER_SQM_MONTH">฿/sqm/mo (Annualized)</option>
                    <option value="PER_SQM_ONETIME">฿/sqm (One-time)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Amount / Rate ({customForm.calc_type.includes('PERCENT') ? '%' : 'THB'})
                  </label>
                  <FormattedNumberInput
                    value={customForm.amount}
                    onValueChange={(val) => setCustomForm({ ...customForm, amount: val })}
                    className="w-full px-3 py-2 rounded-xl border border-indigo-300 bg-white font-extrabold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Payer Allocation</label>
                <select
                  value={customForm.borne_by}
                  onChange={(e) =>
                    setCustomForm({ ...customForm, borne_by: e.target.value as any })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                >
                  <option value="Buyer / Tenant">Buyer / Tenant</option>
                  <option value="Seller / Landlord">Seller / Landlord</option>
                  <option value="50/50 Split">50% Seller / 50% Buyer Split</option>
                  <option value="Agency Absorbed">Agency Absorbed (Internal Cost)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description / Memo</label>
                <input
                  type="text"
                  placeholder="Optional explanatory note for client breakdown statement"
                  value={customForm.description}
                  onChange={(e) => setCustomForm({ ...customForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold shadow-sm transition"
                >
                  {editingItemId ? 'Update Custom Item' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add or Edit Project CAM Profile */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Building className="w-5 h-5 text-sky-600" />
                  {editingProjectId ? 'Edit Project CAM Profile' : 'Add Project CAM Profile'}
                </h3>
                <p className="text-xs text-slate-500">
                  Configure specific building maintenance fees, sinking fund, and juristic details.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowProjectModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="space-y-4 text-xs">
              {/* Project Name & Property Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Building / Project Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Park Origin Thonglor"
                    value={projectForm.projectName}
                    onChange={(e) => setProjectForm({ ...projectForm, projectName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Property Type</label>
                  <select
                    value={projectForm.propertyType}
                    onChange={(e) =>
                      setProjectForm({
                        ...projectForm,
                        propertyType: e.target.value as PropertyDirectoryType,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                  >
                    <option value="Condominium">Condominium</option>
                    <option value="Townhome">Townhome</option>
                    <option value="Single Home">Single Home / Villa</option>
                    <option value="Commercial">Commercial / Shophouse / Warehouse</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Developer & Location */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Developer / Brand</label>
                  <input
                    type="text"
                    placeholder="e.g. Sansiri, Origin, AP"
                    value={projectForm.developerName}
                    onChange={(e) => setProjectForm({ ...projectForm, developerName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">City / Province</label>
                  <input
                    type="text"
                    placeholder="e.g. Bangkok, Phuket"
                    value={projectForm.city}
                    onChange={(e) => setProjectForm({ ...projectForm, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">District / Zone</label>
                  <input
                    type="text"
                    placeholder="e.g. Thonglor / Watthana"
                    value={projectForm.district}
                    onChange={(e) => setProjectForm({ ...projectForm, district: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              {/* Rates & Cycles */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-2xl bg-sky-50/50 border border-sky-100">
                <div>
                  <label className="font-bold text-sky-950 block mb-1">
                    CAM Rate (฿/sqm/mo) <span className="text-rose-500">*</span>
                  </label>
                  <FormattedNumberInput
                    value={projectForm.camFeePerSqmMonth}
                    onValueChange={(val) => setProjectForm({ ...projectForm, camFeePerSqmMonth: val })}
                    className="w-full px-3 py-2 rounded-xl border border-sky-300 bg-white font-black text-slate-900"
                  />
                  <span className="text-[10px] text-sky-700 mt-0.5 block">Standard condo ฿50-฿85</span>
                </div>

                <div>
                  <label className="font-bold text-sky-950 block mb-1">
                    Sinking Fund (฿/sqm)
                  </label>
                  <FormattedNumberInput
                    value={projectForm.sinkingFundPerSqm}
                    onValueChange={(val) => setProjectForm({ ...projectForm, sinkingFundPerSqm: val })}
                    className="w-full px-3 py-2 rounded-xl border border-sky-300 bg-white font-black text-slate-900"
                  />
                  <span className="text-[10px] text-sky-700 mt-0.5 block">One-time reserve</span>
                </div>

                <div>
                  <label className="font-bold text-sky-950 block mb-1">Billing Cycle</label>
                  <select
                    value={projectForm.paymentCycle}
                    onChange={(e) =>
                      setProjectForm({
                        ...projectForm,
                        paymentCycle: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-sky-300 bg-white font-bold"
                  >
                    <option value="Annually">Annually (Standard)</option>
                    <option value="Semi-Annually">Semi-Annually</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Monthly">Monthly</option>
                  </select>
                  <span className="text-[10px] text-sky-700 mt-0.5 block">Juristic billing schedule</span>
                </div>
              </div>

              {/* Juristic Office Contact */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <span className="font-bold text-slate-700 block">Juristic Person Office Contacts</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-0.5">Management Firm</label>
                    <input
                      type="text"
                      placeholder="e.g. Plus Property, Savills, SMART"
                      value={projectForm.juristicCompany}
                      onChange={(e) => setProjectForm({ ...projectForm, juristicCompany: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-500 block mb-0.5">Juristic Phone</label>
                    <input
                      type="text"
                      placeholder="e.g. +66 2 391 4455"
                      value={projectForm.juristicPhone}
                      onChange={(e) => setProjectForm({ ...projectForm, juristicPhone: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-500 block mb-0.5">Juristic Line ID</label>
                    <input
                      type="text"
                      placeholder="e.g. @xtekkamai_jur"
                      value={projectForm.juristicLineId}
                      onChange={(e) => setProjectForm({ ...projectForm, juristicLineId: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-500 block mb-0.5">Juristic Email</label>
                    <input
                      type="email"
                      placeholder="e.g. juristic@project.com"
                      value={projectForm.juristicEmail}
                      onChange={(e) => setProjectForm({ ...projectForm, juristicEmail: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Notes / Amenities Coverage</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Includes 1 parking sticker, gym, pool, shuttle bus to BTS"
                  value={projectForm.notes}
                  onChange={(e) => setProjectForm({ ...projectForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowProjectModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold shadow-sm transition"
                >
                  {editingProjectId ? 'Update Project Profile' : 'Save Project Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
