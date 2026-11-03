import React, { useState, useMemo } from 'react';
import {
  Building2,
  Plus,
  Search,
  BedDouble,
  Bath,
  Maximize2,
  Wrench,
  ShieldCheck,
  User,
  Edit3,
  X,
  MapPin,
  Home,
  Store,
  Layers,
  LayoutGrid,
  List,
  Lock,
  Unlock,
  RotateCcw,
  ArrowLeft,
  ChevronRight,
  Tag,
  KeyRound,
  CheckCircle2,
  Calculator,
  Coins,
  Scale,
} from 'lucide-react';
import { api } from '../api';
import { PropertyUnit, Developer, Contact } from '../types';
import { HighResImageUploader } from './HighResImageUploader';
import { PropertyFinancialReports } from './PropertyFinancialReports';
import { useEscapeKey } from '../utils/clipboardAndEsc';
import { FormattedNumberInput, formatSysNumber } from './FormattedNumberInput';

interface UnitsInventoryViewProps {
  units: PropertyUnit[];
  developers: Developer[];
  contacts: Contact[];
  onRefresh: () => void;
  onSelectUnit: (unitId: number) => void;
  onOpenCalculatorForUnit?: (unit: PropertyUnit) => void;
}

export const PROPERTY_TYPES_BY_CATEGORY: Record<string, string[]> = {
  Residential: [
    'Condominium',
    'Townhouse (Gated)',
    'Townhouse (Non-Gated)',
    'Single Home (Gated)',
    'Single Home (Non-Gated)',
    'Land (Gated)',
    'Land (Non-Gated)',
  ],
  Commercial: [
    'Shophouse',
    'Retail',
    'Warehouse',
    'Factory',
    'Land (Gated)',
    'Land (Non-Gated)',
  ],
};

export const ALL_PROPERTY_TYPES = [
  'Condominium',
  'Townhouse (Gated)',
  'Townhouse (Non-Gated)',
  'Single Home (Gated)',
  'Single Home (Non-Gated)',
  'Land (Gated)',
  'Land (Non-Gated)',
  'Shophouse',
  'Retail',
  'Warehouse',
  'Factory',
];

export const POPULAR_CITIES = [
  'Bangkok',
  'Phuket',
  'Samut Prakan',
  'Chonburi / Pattaya',
  'Chiang Mai',
  'Nonthaburi',
  'Pathum Thani',
  'Rayong',
  'Hua Hin / Prachuap',
];

interface CondoBuildingSummary {
  buildingName: string;
  city: string;
  address: string;
  developerName: string;
  developerId?: number | null;
  coverImage: string;
  towers: string[];
  units: PropertyUnit[];
  totalUnits: number;
  availableUnits: number;
  availableForRent: number;
  availableForSale: number;
  totalForRentListings: number;
  totalForSaleListings: number;
  occupiedUnits: number;
  maintenanceUnits: number;
  openIssuesCount: number;
  minRent: number | null;
  maxRent: number | null;
  minSale: number | null;
  maxSale: number | null;
}

export const UnitsInventoryView: React.FC<UnitsInventoryViewProps> = ({
  units,
  developers,
  contacts,
  onRefresh,
  onSelectUnit,
  onOpenCalculatorForUnit,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [cityFilter, setCityFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [listingOfferFilter, setListingOfferFilter] = useState<'ALL' | 'RENT' | 'SALE'>('ALL');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Condominium Building Drill-Down State
  const [selectedCondoBuilding, setSelectedCondoBuilding] = useState<string | null>(null);
  const [condoDisplayMode, setCondoDisplayMode] = useState<'buildings' | 'all_units'>('buildings');

  const [showModal, setShowModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<PropertyUnit | null>(null);
  const [financialReportUnit, setFinancialReportUnit] = useState<PropertyUnit | null>(null);

  // Close Add/Edit Property Unit Modal on ESC
  useEscapeKey(() => {
    if (financialReportUnit) {
      setFinancialReportUnit(null);
    } else if (showModal) {
      setShowModal(false);
    }
  }, showModal || Boolean(financialReportUnit));

  const landlords = contacts.filter((c) => c.role === 'LANDLORD' || c.role === 'BOTH');

  const [form, setForm] = useState({
    unit_code: '',
    project_name: '',
    city: 'Bangkok',
    property_category: 'Residential',
    property_type: 'Condominium',
    building: '',
    floor: '',
    bedrooms: 1,
    bathrooms: 1,
    size_sqm: 30,
    furnishing: 'Fully Furnished',
    status: 'Available',
    listing_type: 'Rent & Sale',
    target_rent_price: 15000,
    target_sale_price: 3000000,
    address: '',
    key_card_and_access_info: '',
    meter_electric_no: '',
    meter_water_no: '',
    warranty_expiry_date: '',
    image_url: '',
    gallery_images: [] as string[],
    notes: '',
    developer_id: '' as string | number,
    landlord_id: '' as string | number,
  });

  // Dynamically available cities from existing units + standard list
  const availableCities = useMemo(() => {
    const set = new Set<string>(POPULAR_CITIES);
    units.forEach((u) => {
      if (u.city) set.add(u.city);
    });
    return Array.from(set);
  }, [units]);

  // Available property types for the current category filter
  const filterablePropertyTypes = useMemo(() => {
    if (categoryFilter === 'Residential') return PROPERTY_TYPES_BY_CATEGORY.Residential;
    if (categoryFilter === 'Commercial') return PROPERTY_TYPES_BY_CATEGORY.Commercial;
    return ALL_PROPERTY_TYPES;
  }, [categoryFilter]);

  // Base filtered units
  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      const uCat = u.property_category || 'Residential';
      const uCity = u.city || 'Bangkok';
      const matchCategory = categoryFilter === 'ALL' || uCat === categoryFilter;
      const matchCity = cityFilter === 'ALL' || uCity === cityFilter;
      const matchType = typeFilter === 'ALL' || u.property_type === typeFilter;
      const matchStatus = statusFilter === 'ALL' || u.status === statusFilter;
      const matchBuilding =
        !selectedCondoBuilding || u.project_name === selectedCondoBuilding;

      let matchOffer = true;
      if (listingOfferFilter === 'RENT') {
        matchOffer =
          u.status === 'Available' &&
          (u.listing_type === 'For Rent' || u.listing_type === 'Rent & Sale');
      } else if (listingOfferFilter === 'SALE') {
        matchOffer =
          u.status === 'Available' &&
          (u.listing_type === 'For Sale' || u.listing_type === 'Rent & Sale');
      }

      const q = search.toLowerCase();
      const matchText =
        !q ||
        u.unit_code.toLowerCase().includes(q) ||
        u.project_name.toLowerCase().includes(q) ||
        uCity.toLowerCase().includes(q) ||
        u.property_type.toLowerCase().includes(q) ||
        (u.landlord_name || '').toLowerCase().includes(q) ||
        (u.developer_name || '').toLowerCase().includes(q);

      return (
        matchCategory &&
        matchCity &&
        matchType &&
        matchStatus &&
        matchBuilding &&
        matchOffer &&
        matchText
      );
    });
  }, [
    units,
    categoryFilter,
    cityFilter,
    typeFilter,
    statusFilter,
    selectedCondoBuilding,
    listingOfferFilter,
    search,
  ]);

  // Aggregate Condominium Buildings when Property Type === 'Condominium'
  const condoBuildings = useMemo<CondoBuildingSummary[]>(() => {
    const condoUnits = units.filter((u) => {
      const isCondo = u.property_type === 'Condominium' || u.property_type === 'Condo';
      if (!isCondo) return false;
      const uCity = u.city || 'Bangkok';
      if (cityFilter !== 'ALL' && uCity !== cityFilter) return false;
      const q = search.toLowerCase();
      if (
        q &&
        !u.project_name.toLowerCase().includes(q) &&
        !u.unit_code.toLowerCase().includes(q) &&
        !(u.developer_name || '').toLowerCase().includes(q) &&
        !uCity.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    const map = new Map<string, PropertyUnit[]>();
    condoUnits.forEach((u) => {
      const list = map.get(u.project_name) || [];
      list.push(u);
      map.set(u.project_name, list);
    });

    const summaries: CondoBuildingSummary[] = [];
    map.forEach((bUnits, buildingName) => {
      const first = bUnits[0];
      const towersSet = new Set<string>();
      bUnits.forEach((x) => {
        if (x.building) towersSet.add(x.building);
      });

      const availableUnits = bUnits.filter((x) => x.status === 'Available').length;
      const availableForRent = bUnits.filter(
        (x) =>
          x.status === 'Available' &&
          (x.listing_type === 'For Rent' || x.listing_type === 'Rent & Sale')
      ).length;
      const availableForSale = bUnits.filter(
        (x) =>
          x.status === 'Available' &&
          (x.listing_type === 'For Sale' || x.listing_type === 'Rent & Sale')
      ).length;

      const totalForRentListings = bUnits.filter(
        (x) => x.listing_type === 'For Rent' || x.listing_type === 'Rent & Sale'
      ).length;
      const totalForSaleListings = bUnits.filter(
        (x) => x.listing_type === 'For Sale' || x.listing_type === 'Rent & Sale'
      ).length;

      const occupiedUnits = bUnits.filter((x) => x.status === 'Occupied').length;
      const maintenanceUnits = bUnits.filter((x) => x.status === 'Under Maintenance').length;
      const openIssuesCount = bUnits.reduce((acc, x) => acc + (x.open_issues_count || 0), 0);

      const rents = bUnits.map((x) => x.target_rent_price).filter((r) => r > 0);
      const sales = bUnits.map((x) => x.target_sale_price).filter((s) => s > 0);

      summaries.push({
        buildingName,
        city: first.city || 'Bangkok',
        address: first.address || first.city || 'Bangkok',
        developerName: first.developer_name || 'Independent Developer',
        developerId: first.developer_id,
        coverImage:
          first.image_url ||
          'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
        towers: Array.from(towersSet),
        units: bUnits,
        totalUnits: bUnits.length,
        availableUnits,
        availableForRent,
        availableForSale,
        totalForRentListings,
        totalForSaleListings,
        occupiedUnits,
        maintenanceUnits,
        openIssuesCount,
        minRent: rents.length ? Math.min(...rents) : null,
        maxRent: rents.length ? Math.max(...rents) : null,
        minSale: sales.length ? Math.min(...sales) : null,
        maxSale: sales.length ? Math.max(...sales) : null,
      });
    });

    return summaries.sort((a, b) => b.totalUnits - a.totalUnits);
  }, [units, cityFilter, search]);

  const activeBuildingSummary = useMemo(() => {
    if (!selectedCondoBuilding) return null;
    return condoBuildings.find((b) => b.buildingName === selectedCondoBuilding) || null;
  }, [condoBuildings, selectedCondoBuilding]);

  const residentialCount = units.filter(
    (u) => (u.property_category || 'Residential') === 'Residential'
  ).length;
  const commercialCount = units.filter((u) => u.property_category === 'Commercial').length;

  const hasActiveFilters =
    categoryFilter !== 'ALL' ||
    cityFilter !== 'ALL' ||
    typeFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    listingOfferFilter !== 'ALL' ||
    selectedCondoBuilding !== null ||
    search.trim() !== '';

  const resetFilters = () => {
    setCategoryFilter('ALL');
    setCityFilter('ALL');
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    setListingOfferFilter('ALL');
    setSelectedCondoBuilding(null);
    setSearch('');
  };

  const openNewUnit = (prefillBuilding?: CondoBuildingSummary) => {
    setEditingUnit(null);
    setForm({
      unit_code: '',
      project_name: prefillBuilding ? prefillBuilding.buildingName : selectedCondoBuilding || '',
      city: prefillBuilding
        ? prefillBuilding.city
        : cityFilter !== 'ALL'
        ? cityFilter
        : 'Bangkok',
      property_category: prefillBuilding
        ? 'Residential'
        : categoryFilter !== 'ALL'
        ? categoryFilter
        : 'Residential',
      property_type: prefillBuilding
        ? 'Condominium'
        : typeFilter !== 'ALL'
        ? typeFilter
        : categoryFilter === 'Commercial'
        ? 'Shophouse'
        : 'Condominium',
      building: prefillBuilding?.towers[0] || '',
      floor: '',
      bedrooms: 1,
      bathrooms: 1,
      size_sqm: 30,
      furnishing: 'Fully Furnished',
      status: 'Available',
      listing_type: 'Rent & Sale',
      target_rent_price: 15000,
      target_sale_price: 3000000,
      address: prefillBuilding?.address || '',
      key_card_and_access_info: '',
      meter_electric_no: '',
      meter_water_no: '',
      warranty_expiry_date: '',
      image_url: prefillBuilding?.coverImage || '',
      gallery_images: prefillBuilding?.coverImage ? [prefillBuilding.coverImage] : [],
      notes: '',
      developer_id: prefillBuilding?.developerId || developers[0]?.id || '',
      landlord_id: landlords[0]?.id || '',
    });
    setShowModal(true);
  };

  const openEditUnit = (e: React.MouseEvent, u: PropertyUnit) => {
    e.stopPropagation();
    setEditingUnit(u);
    const initialGallery =
      u.gallery_images && u.gallery_images.length > 0
        ? u.gallery_images
        : u.image_url
        ? [u.image_url]
        : [];
    setForm({
      unit_code: u.unit_code,
      project_name: u.project_name,
      city: u.city || 'Bangkok',
      property_category: u.property_category || 'Residential',
      property_type: u.property_type || 'Condominium',
      building: u.building || '',
      floor: u.floor || '',
      bedrooms: u.bedrooms,
      bathrooms: u.bathrooms,
      size_sqm: u.size_sqm,
      furnishing: u.furnishing,
      status: u.status,
      listing_type: u.listing_type,
      target_rent_price: u.target_rent_price,
      target_sale_price: u.target_sale_price,
      address: u.address || '',
      key_card_and_access_info: u.key_card_and_access_info || '',
      meter_electric_no: u.meter_electric_no || '',
      meter_water_no: u.meter_water_no || '',
      warranty_expiry_date: u.warranty_expiry_date || '',
      image_url: u.image_url || initialGallery[0] || '',
      gallery_images: initialGallery,
      notes: u.notes || '',
      developer_id: u.developer_id || '',
      landlord_id: u.landlord_id || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      bedrooms: Number(form.bedrooms),
      bathrooms: Number(form.bathrooms),
      size_sqm: Number(form.size_sqm),
      target_rent_price: Number(form.target_rent_price),
      target_sale_price: Number(form.target_sale_price),
      developer_id: form.developer_id ? Number(form.developer_id) : null,
      landlord_id: form.landlord_id ? Number(form.landlord_id) : null,
    };
    if (editingUnit) {
      await api.updateUnit(editingUnit.id, payload);
    } else {
      await api.createUnit(payload);
    }
    setShowModal(false);
    onRefresh();
  };

  const renderGatedBadge = (propType: string) => {
    if (propType.includes('(Gated)')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[11px] font-semibold">
          <Lock className="w-3 h-3" /> Gated
        </span>
      );
    }
    if (propType.includes('(Non-Gated)')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium">
          <Unlock className="w-3 h-3" /> Non-Gated
        </span>
      );
    }
    return null;
  };

  const isCondoSelected = typeFilter === 'Condominium';

  return (
    <div className="space-y-5">
      {/* Multi-Dimensional Filter & Control Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
        {/* Row 1: Property Category Tabs (Residential vs Commercial) + Search + Add Unit */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Category Segmented Control */}
          <div className="inline-flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100 border border-slate-200/60">
            <button
              onClick={() => {
                setCategoryFilter('ALL');
                setTypeFilter('ALL');
                setSelectedCondoBuilding(null);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                categoryFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              All Categories
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  categoryFilter === 'ALL'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {units.length}
              </span>
            </button>

            <button
              onClick={() => {
                setCategoryFilter('Residential');
                setTypeFilter('ALL');
                setSelectedCondoBuilding(null);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                categoryFilter === 'Residential'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              Residential
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  categoryFilter === 'Residential'
                    ? 'bg-white/20 text-white'
                    : 'bg-indigo-50 text-indigo-700'
                }`}
              >
                {residentialCount}
              </span>
            </button>

            <button
              onClick={() => {
                setCategoryFilter('Commercial');
                setTypeFilter('ALL');
                setSelectedCondoBuilding(null);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                categoryFilter === 'Commercial'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              Commercial
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  categoryFilter === 'Commercial'
                    ? 'bg-white/20 text-white'
                    : 'bg-amber-50 text-amber-800'
                }`}
              >
                {commercialCount}
              </span>
            </button>
          </div>

          {/* Search, View Mode & Add Button */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search building, unit code, city, landlord..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>

            {(!isCondoSelected || selectedCondoBuilding || condoDisplayMode === 'all_units') && (
              <div className="inline-flex rounded-xl border border-slate-200 p-1 bg-slate-50">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition ${
                    viewMode === 'grid'
                      ? 'bg-white text-indigo-600 shadow-2xs'
                      : 'text-slate-400 hover:text-slate-700'
                  }`}
                  title="Card Grid View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg transition ${
                    viewMode === 'table'
                      ? 'bg-white text-indigo-600 shadow-2xs'
                      : 'text-slate-400 hover:text-slate-700'
                  }`}
                  title="Compact Table View"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              onClick={() => openNewUnit(activeBuildingSummary || undefined)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition shadow-xs"
            >
              <Plus className="w-4 h-4" />
              {selectedCondoBuilding ? `Add Unit to ${selectedCondoBuilding}` : 'Add Property Unit'}
            </button>
          </div>
        </div>

        {/* Row 2: City Selector, Property Type Selector & Quick Type Pills */}
        <div className="pt-3.5 border-t border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* 1. City Dropdown */}
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                City:
              </span>
              <select
                value={cityFilter}
                onChange={(e) => {
                  setCityFilter(e.target.value);
                  setSelectedCondoBuilding(null);
                }}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer pr-1"
              >
                <option value="ALL">All Cities ({units.length})</option>
                {availableCities.map((city) => {
                  const count = units.filter((u) => (u.city || 'Bangkok') === city).length;
                  return (
                    <option key={city} value={city}>
                      {city} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* 2. Property Type Dropdown */}
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Property Type:
              </span>
              <select
                value={typeFilter}
                onChange={(e) => {
                  const nextType = e.target.value;
                  setTypeFilter(nextType);
                  setSelectedCondoBuilding(null);
                  setListingOfferFilter('ALL');
                  if (nextType === 'Condominium') {
                    setCondoDisplayMode('buildings');
                  }
                }}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer pr-1"
              >
                <option value="ALL">All Property Types</option>
                {filterablePropertyTypes.map((pt) => {
                  const count = units.filter((u) => u.property_type === pt).length;
                  return (
                    <option key={pt} value={pt}>
                      {pt} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Quick Property Type Pills (especially Condominium!) */}
            <div className="flex flex-wrap items-center gap-1.5">
              {filterablePropertyTypes.slice(0, 6).map((pt) => (
                <button
                  key={pt}
                  onClick={() => {
                    if (typeFilter === pt) {
                      setTypeFilter('ALL');
                      setSelectedCondoBuilding(null);
                    } else {
                      setTypeFilter(pt);
                      setSelectedCondoBuilding(null);
                      if (pt === 'Condominium') {
                        setCondoDisplayMode('buildings');
                      }
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                    typeFilter === pt
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {pt === 'Condominium' && <Building2 className="w-3.5 h-3.5" />}
                  {pt}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Status Pills & Reset */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(!isCondoSelected || selectedCondoBuilding || condoDisplayMode === 'all_units') &&
              ['ALL', 'Available', 'Occupied', 'Under Maintenance'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    statusFilter === st
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st === 'ALL' ? 'All Status' : st}
                </button>
              ))}

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="ml-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 transition inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* CONDOMINIUM MODE: 1) BUILDING DIRECTORY LIST vs 2) BUILDING DRILL-DOWN */}
      {/* ===================================================================== */}
      {isCondoSelected && !selectedCondoBuilding && condoDisplayMode === 'buildings' ? (
        <div className="space-y-4">
          {/* Sub-header for Condominium Buildings Directory */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-indigo-950 text-white px-5 py-4 rounded-2xl shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold">
                  Condominium Buildings Directory ({condoBuildings.length} Buildings)
                </h3>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5">
                Select any condominium building below to inspect all managed units, availability for
                rent & sale, and unit status.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCondoDisplayMode('buildings')}
                className="px-3 py-1.5 rounded-xl bg-white text-indigo-950 text-xs font-bold shadow-xs"
              >
                Group by Building ({condoBuildings.length})
              </button>
              <button
                onClick={() => setCondoDisplayMode('all_units')}
                className="px-3 py-1.5 rounded-xl bg-indigo-900/80 text-indigo-200 hover:text-white text-xs font-semibold"
              >
                All Condo Units ({filteredUnits.length})
              </button>
            </div>
          </div>

          {/* Condominium Building Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {condoBuildings.map((b) => (
              <div
                key={b.buildingName}
                onClick={() => {
                  setSelectedCondoBuilding(b.buildingName);
                  setStatusFilter('ALL');
                  setListingOfferFilter('ALL');
                }}
                className="group cursor-pointer bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-indigo-500 hover:shadow-xl transition-all duration-200 flex flex-col"
              >
                {/* Building Cover Image */}
                <div className="relative h-48 bg-slate-200 overflow-hidden">
                  <img
                    src={b.coverImage}
                    alt={b.buildingName}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/25 to-transparent" />

                  {/* Top Badges: City & Total Units */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/95 text-slate-900 text-xs font-bold shadow-xs">
                      <MapPin className="w-3.5 h-3.5 text-rose-500" />
                      {b.city}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-600/95 text-white text-xs font-bold shadow-xs">
                      Condominium
                    </span>
                  </div>

                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-slate-900/90 text-white text-xs font-bold">
                    {b.totalUnits} {b.totalUnits === 1 ? 'Unit' : 'Units'}
                  </div>

                  {/* Building Title on Image Bottom */}
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <h3 className="text-lg font-extrabold leading-tight group-hover:text-indigo-200 transition">
                      {b.buildingName}
                    </h3>
                    <p className="text-xs text-slate-200 truncate mt-0.5">{b.address}</p>
                  </div>
                </div>

                {/* Building Availability Summary Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-4">
                    {/* Prominent Available for Rent & Available for Sale Counters */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-emerald-50/90 border border-emerald-200/80">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                            Avail. For Rent
                          </span>
                          <KeyRound className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div className="text-2xl font-extrabold text-emerald-700 mt-1">
                          {b.availableForRent}{' '}
                          <span className="text-xs font-semibold text-emerald-600">
                            {b.availableForRent === 1 ? 'unit' : 'units'}
                          </span>
                        </div>
                        <div className="text-[11px] text-emerald-700/80 mt-0.5">
                          {b.minRent
                            ? `From ฿${b.minRent.toLocaleString()}/mo`
                            : 'No rent listings'}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-indigo-50/90 border border-indigo-200/80">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">
                            Avail. For Sale
                          </span>
                          <Tag className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div className="text-2xl font-extrabold text-indigo-700 mt-1">
                          {b.availableForSale}{' '}
                          <span className="text-xs font-semibold text-indigo-600">
                            {b.availableForSale === 1 ? 'unit' : 'units'}
                          </span>
                        </div>
                        <div className="text-[11px] text-indigo-700/80 mt-0.5">
                          {b.minSale
                            ? `From ฿${b.minSale.toLocaleString()}`
                            : 'No sale listings'}
                        </div>
                      </div>
                    </div>

                    {/* Status Breakdown Pills */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 font-semibold">
                        {b.availableUnits} Vacant / Available
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold">
                        {b.occupiedUnits} Occupied
                      </span>
                      {b.maintenanceUnits > 0 && (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 font-semibold">
                          {b.maintenanceUnits} Maintenance
                        </span>
                      )}
                      {b.openIssuesCount > 0 && (
                        <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 font-semibold flex items-center gap-1">
                          <Wrench className="w-3 h-3" /> {b.openIssuesCount} Issue(s)
                        </span>
                      )}
                    </div>

                    {/* Developer & Towers Info */}
                    <div className="pt-2 border-t border-slate-100 space-y-1 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Developer:
                        </span>
                        <span className="font-semibold text-slate-800 truncate max-w-[180px]">
                          {b.developerName}
                        </span>
                      </div>
                      {b.towers.length > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Towers / Wings:</span>
                          <span className="font-medium text-slate-700">{b.towers.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">
                      Click to inspect all {b.totalUnits} units
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition">
                      View Units <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ===================================================================== */
        /* BUILDING DRILL-DOWN VIEW OR STANDARD UNITS INVENTORY                  */
        /* ===================================================================== */
        <div className="space-y-4">
          {/* If drilled into a specific Condominium Building, show the Building Header Banner */}
          {selectedCondoBuilding && activeBuildingSummary && (
            <div className="bg-white rounded-2xl border-2 border-indigo-500/80 shadow-md overflow-hidden">
              <div className="bg-slate-900 text-white px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedCondoBuilding(null);
                        setListingOfferFilter('ALL');
                        setStatusFilter('ALL');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white text-xs font-semibold transition"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      All Condominium Buildings
                    </button>
                    <span className="text-slate-500">/</span>
                    <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-xs font-semibold">
                      {activeBuildingSummary.city}
                    </span>
                  </div>
                  <h2 className="text-xl font-extrabold tracking-tight pt-1">
                    {activeBuildingSummary.buildingName} — Units Inventory
                  </h2>
                  <p className="text-xs text-slate-400">
                    {activeBuildingSummary.address} • Developer:{' '}
                    <strong className="text-slate-200">
                      {activeBuildingSummary.developerName}
                    </strong>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => openNewUnit(activeBuildingSummary)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    Add Unit in {activeBuildingSummary.buildingName}
                  </button>
                </div>
              </div>

              {/* Interactive Building Availability Filter Strip */}
              <div className="p-4 bg-indigo-50/40 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      setListingOfferFilter('ALL');
                      setStatusFilter('ALL');
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                      listingOfferFilter === 'ALL' && statusFilter === 'ALL'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    All Units in Building ({activeBuildingSummary.totalUnits})
                  </button>

                  <button
                    onClick={() => {
                      setListingOfferFilter('RENT');
                      setStatusFilter('Available');
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                      listingOfferFilter === 'RENT'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Available for Rent ({activeBuildingSummary.availableForRent})
                  </button>

                  <button
                    onClick={() => {
                      setListingOfferFilter('SALE');
                      setStatusFilter('Available');
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                      listingOfferFilter === 'SALE'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100'
                    }`}
                  >
                    <Tag className="w-3.5 h-3.5" />
                    Available for Sale ({activeBuildingSummary.availableForSale})
                  </button>

                  <button
                    onClick={() => {
                      setListingOfferFilter('ALL');
                      setStatusFilter('Occupied');
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                      statusFilter === 'Occupied'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Occupied ({activeBuildingSummary.occupiedUnits})
                  </button>

                  {activeBuildingSummary.maintenanceUnits > 0 && (
                    <button
                      onClick={() => {
                        setListingOfferFilter('ALL');
                        setStatusFilter('Under Maintenance');
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                        statusFilter === 'Under Maintenance'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                      }`}
                    >
                      Under Maintenance ({activeBuildingSummary.maintenanceUnits})
                    </button>
                  )}
                </div>

                <span className="text-xs text-slate-500">
                  Click any unit below to inspect 360° details, tenant, landlord & issue history
                </span>
              </div>
            </div>
          )}

          {/* If Condominium is selected and user is in 'all_units' flat mode, allow switching back to Building Directory */}
          {isCondoSelected && !selectedCondoBuilding && condoDisplayMode === 'all_units' && (
            <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 px-4 py-3 rounded-2xl text-xs">
              <span className="font-semibold text-indigo-950">
                Showing all individual Condominium units ({filteredUnits.length})
              </span>
              <button
                onClick={() => setCondoDisplayMode('buildings')}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition"
              >
                ← Switch to Condominium Buildings Directory ({condoBuildings.length} Buildings)
              </button>
            </div>
          )}

          {/* Results Summary Bar */}
          {!selectedCondoBuilding && (
            <div className="flex items-center justify-between px-1 text-xs text-slate-500">
              <div>
                Showing <strong className="text-slate-900">{filteredUnits.length}</strong> of{' '}
                <strong>{units.length}</strong> properties
                {categoryFilter !== 'ALL' && (
                  <span>
                    {' '}
                    in <strong className="text-indigo-600">{categoryFilter}</strong>
                  </span>
                )}
                {cityFilter !== 'ALL' && (
                  <span>
                    {' '}
                    • City: <strong className="text-rose-600">{cityFilter}</strong>
                  </span>
                )}
                {typeFilter !== 'ALL' && (
                  <span>
                    {' '}
                    • Type: <strong className="text-slate-800">{typeFilter}</strong>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Empty State */}
          {filteredUnits.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
              <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="text-sm font-bold text-slate-800">
                No units match your selected filters
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Try clearing your status or offer filters, or add a new unit to this building.
              </p>
              <button
                onClick={() => {
                  setStatusFilter('ALL');
                  setListingOfferFilter('ALL');
                }}
                className="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100"
              >
                Show All Units
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            /* GRID CARDS VIEW */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredUnits.map((u) => {
                const isCommercial = u.property_category === 'Commercial';
                const baseTypeLabel = u.property_type
                  .replace(' (Gated)', '')
                  .replace(' (Non-Gated)', '');

                const isAvailRent =
                  u.status === 'Available' &&
                  (u.listing_type === 'For Rent' || u.listing_type === 'Rent & Sale');
                const isAvailSale =
                  u.status === 'Available' &&
                  (u.listing_type === 'For Sale' || u.listing_type === 'Rent & Sale');

                return (
                  <div
                    key={u.id}
                    onClick={() => onSelectUnit(u.id)}
                    className="group cursor-pointer bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-indigo-400 hover:shadow-xl transition-all duration-200 flex flex-col"
                  >
                    {/* Image Header */}
                    <div className="relative h-48 bg-slate-200 overflow-hidden">
                      {u.image_url ? (
                        <img
                          src={u.image_url}
                          alt={u.unit_code}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <Building2 className="w-10 h-10" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-slate-950/30 pointer-events-none" />

                      {/* Top Left: Unit Code & Status */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-900/90 backdrop-blur-xs text-white text-xs font-bold tracking-wide">
                          {u.unit_code}
                        </span>
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold shadow-xs ${
                            u.status === 'Occupied'
                              ? 'bg-emerald-500 text-white'
                              : u.status === 'Available'
                              ? 'bg-sky-500 text-white'
                              : u.status === 'Under Maintenance'
                              ? 'bg-amber-500 text-white'
                              : 'bg-purple-600 text-white'
                          }`}
                        >
                          {u.status}
                        </span>
                      </div>

                      {/* Top Right: Edit Button */}
                      <button
                        onClick={(e) => openEditUnit(e, u)}
                        className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/90 text-slate-700 hover:bg-white shadow-xs transition"
                        title="Edit Property Unit"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* Bottom Left on Image: City Badge & Category Badge */}
                      <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/95 backdrop-blur-xs text-slate-900 text-[11px] font-bold shadow-xs">
                          <MapPin className="w-3 h-3 text-rose-500" />
                          {u.city || 'Bangkok'}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-xs backdrop-blur-xs ${
                            isCommercial
                              ? 'bg-amber-500/95 text-white'
                              : 'bg-indigo-600/95 text-white'
                          }`}
                        >
                          {isCommercial ? (
                            <Store className="w-3 h-3" />
                          ) : (
                            <Home className="w-3 h-3" />
                          )}
                          {u.property_category || 'Residential'}
                        </span>
                      </div>

                      {/* Bottom Right on Image: Open Issues Alert */}
                      {u.open_issues_count > 0 && (
                        <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-semibold flex items-center gap-1 shadow-xs">
                          <Wrench className="w-3 h-3" />
                          {u.open_issues_count} Issue{u.open_issues_count > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>

                    {/* Card Body */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div>
                        {/* Property Type Pill + Gated/Non-Gated Badge + Rent/Sale Availability Badges */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 text-xs font-bold">
                              {baseTypeLabel}
                            </span>
                            {renderGatedBadge(u.property_type)}
                          </div>
                          <div className="flex items-center gap-1">
                            {isAvailRent && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase">
                                Avail. Rent
                              </span>
                            )}
                            {isAvailSale && (
                              <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold uppercase">
                                Avail. Sale
                              </span>
                            )}
                            {!isAvailRent && !isAvailSale && (
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                {u.listing_type}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Project Name & Building/Floor */}
                        <h3 className="text-base font-bold text-slate-900 mt-2 group-hover:text-indigo-600 transition line-clamp-1">
                          {u.project_name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {u.building ? `${u.building}` : 'Main Zone'}
                          {u.floor
                            ? ` • ${
                                u.floor.includes('Storey') || u.floor.includes('Height')
                                  ? u.floor
                                  : `Floor ${u.floor}`
                              }`
                            : ''}
                        </p>

                        {/* Key Specs Bar */}
                        <div className="flex items-center gap-4 mt-3 py-2 px-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700">
                          {!u.property_type.startsWith('Land') &&
                            u.property_type !== 'Warehouse' &&
                            u.property_type !== 'Factory' && (
                              <>
                                <span className="flex items-center gap-1 font-medium">
                                  <BedDouble className="w-3.5 h-3.5 text-slate-400" /> {u.bedrooms}{' '}
                                  Bed
                                </span>
                                <span className="flex items-center gap-1 font-medium">
                                  <Bath className="w-3.5 h-3.5 text-slate-400" /> {u.bathrooms}{' '}
                                  Bath
                                </span>
                              </>
                            )}
                          {(u.property_type === 'Warehouse' || u.property_type === 'Factory') && (
                            <span className="flex items-center gap-1 font-medium text-amber-800">
                              <Bath className="w-3.5 h-3.5 text-amber-600" /> {u.bathrooms}{' '}
                              Restrooms
                            </span>
                          )}
                          <span className="flex items-center gap-1 font-bold text-slate-900">
                            <Maximize2 className="w-3.5 h-3.5 text-indigo-500" />{' '}
                            {u.size_sqm.toLocaleString()} sqm
                          </span>
                        </div>

                        {/* CRM Links: Landlord, Developer, Tenant */}
                        <div className="mt-3.5 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-indigo-500" /> Landlord:
                            </span>
                            <span className="font-semibold text-slate-800">
                              {u.landlord_name || 'Unassigned'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Developer:
                            </span>
                            <span className="font-medium text-slate-700 truncate max-w-[175px]">
                              {u.developer_name || 'Independent / Private'}
                            </span>
                          </div>
                          {u.current_tenant_name && (
                            <div className="flex items-center justify-between text-emerald-700 font-semibold pt-0.5">
                              <span>Current Tenant:</span>
                              <span>{u.current_tenant_name}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Price & Action Footer */}
                      <div className="pt-3 border-t border-slate-100 flex items-end justify-between gap-2">
                        <div className="space-y-1">
                          {u.target_rent_price > 0 && (
                            <div>
                              <span className="text-base font-extrabold text-slate-900">
                                ฿{formatSysNumber(u.target_rent_price)}
                              </span>
                              <span className="text-xs text-slate-500"> / mo</span>
                              {u.size_sqm > 0 && (
                                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                                  ฿{formatSysNumber(u.target_rent_price / u.size_sqm, 2)}/sqm
                                </span>
                              )}
                            </div>
                          )}
                          {u.target_sale_price > 0 && (
                            <div className="text-[11px] text-indigo-700 font-semibold flex items-center gap-1.5">
                              <span>Sale: ฿{formatSysNumber(u.target_sale_price)}</span>
                              {u.size_sqm > 0 && (
                                <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                                  ฿{formatSysNumber(u.target_sale_price / u.size_sqm, 2)}/sqm
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFinancialReportUnit(u);
                            }}
                            className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold flex items-center gap-1 transition shadow-2xs"
                            title="View Rent & Sale Financial Report"
                          >
                            <Coins className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Deal Report</span>
                          </button>
                          {onOpenCalculatorForUnit && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenCalculatorForUnit(u);
                              }}
                              className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition"
                              title="Open Transaction Calculator (Taxes, Commission & Profit)"
                            >
                              <Calculator className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <span className="text-xs font-semibold text-indigo-600 group-hover:translate-x-0.5 transition">
                            Details ({u.total_issues_count}) →
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* COMPACT TABLE VIEW */
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                      <th className="py-3.5 px-4">Unit / Building</th>
                      <th className="py-3.5 px-4">Tower / Floor</th>
                      <th className="py-3.5 px-4">City & Type</th>
                      <th className="py-3.5 px-4">Size / Specs</th>
                      <th className="py-3.5 px-4">Status & Offer</th>
                      <th className="py-3.5 px-4">Landlord / Tenant</th>
                      <th className="py-3.5 px-4 text-right">Rent & Rent/Sqm</th>
                      <th className="py-3.5 px-4 text-right">Sale & Sale/Sqm</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUnits.map((u) => (
                      <tr
                        key={u.id}
                        onClick={() => onSelectUnit(u.id)}
                        className="hover:bg-indigo-50/40 cursor-pointer transition"
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-indigo-600">{u.unit_code}</div>
                          <div className="font-semibold text-slate-900">{u.project_name}</div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          <div className="font-medium">{u.building || 'Main'}</div>
                          <div className="text-slate-500">Floor {u.floor || '-'}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                            <MapPin className="w-3.5 h-3.5 text-rose-500" />
                            {u.city || 'Bangkok'}
                          </span>
                          <div className="text-slate-500 mt-0.5">{u.property_type}</div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          <strong>{formatSysNumber(u.size_sqm, 2)} sqm</strong>
                          <div>
                            {u.bedrooms} Bed • {u.bathrooms} Bath
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              u.status === 'Occupied'
                                ? 'bg-emerald-100 text-emerald-700'
                                : u.status === 'Available'
                                ? 'bg-sky-100 text-sky-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {u.status}
                          </span>
                          <div className="text-[11px] font-semibold text-indigo-600 mt-1">
                            {u.listing_type}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-slate-800 font-medium">
                            LL: {u.landlord_name || 'N/A'}
                          </div>
                          {u.current_tenant_name && (
                            <div className="text-emerald-700">TN: {u.current_tenant_name}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {u.target_rent_price > 0 ? (
                            <>
                              <div className="font-bold text-slate-900">
                                ฿{formatSysNumber(u.target_rent_price)}/mo
                              </div>
                              {u.size_sqm > 0 && (
                                <div className="text-[11px] text-emerald-700 font-semibold">
                                  ฿{formatSysNumber(u.target_rent_price / u.size_sqm, 2)} / sqm
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {u.target_sale_price > 0 ? (
                            <>
                              <div className="text-indigo-700 font-bold">
                                ฿{formatSysNumber(u.target_sale_price)}
                              </div>
                              {u.size_sqm > 0 && (
                                <div className="text-[11px] text-indigo-600 font-semibold">
                                  ฿{formatSysNumber(u.target_sale_price / u.size_sqm, 2)} / sqm
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFinancialReportUnit(u);
                              }}
                              className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold flex items-center gap-1 transition shadow-2xs"
                              title="View Rent & Sale Financial Report"
                            >
                              <Coins className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Deal Report</span>
                            </button>
                            {onOpenCalculatorForUnit && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenCalculatorForUnit(u);
                                }}
                                className="p-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700"
                                title="Calculate Taxes, Commission & Agency Profit"
                              >
                                <Calculator className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={(e) => openEditUnit(e, u)}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-white text-slate-600"
                              title="Edit Unit"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Unit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingUnit
                    ? `Edit Property Unit ${editingUnit.unit_code}`
                    : 'Add New Property Unit'}
                </h3>
                <p className="text-xs text-slate-500">
                  Configure City, Category (Residential / Commercial), Property Type, and Building
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              {/* Highlighted Taxonomy Section: City, Category, Property Type */}
              <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">1. City *</label>
                  <input
                    list="city-options"
                    type="text"
                    required
                    placeholder="Select or type city..."
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium"
                  />
                  <datalist id="city-options">
                    {POPULAR_CITIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">
                    2. Property Category *
                  </label>
                  <select
                    value={form.property_category}
                    onChange={(e) => {
                      const newCat = e.target.value;
                      const defaultType =
                        PROPERTY_TYPES_BY_CATEGORY[newCat]?.[0] || 'Condominium';
                      setForm({
                        ...form,
                        property_category: newCat,
                        property_type: defaultType,
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-indigo-900"
                  >
                    <option value="Residential">Residential</option>
                    <option value="Commercial">Commercial</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">3. Property Type *</label>
                  <select
                    value={form.property_type}
                    onChange={(e) => setForm({ ...form, property_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                  >
                    {(
                      PROPERTY_TYPES_BY_CATEGORY[form.property_category] || ALL_PROPERTY_TYPES
                    ).map((pt) => (
                      <option key={pt} value={pt}>
                        {pt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Unit Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. XT-A1804 or WH-BN04"
                    value={form.unit_code}
                    onChange={(e) => setForm({ ...form, unit_code: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="font-semibold text-slate-700 block mb-1">
                    Building / Project Name *
                  </label>
                  <input
                    list="condo-building-options"
                    type="text"
                    required
                    placeholder="e.g. XT Ekkamai, Park Origin Thonglor, Life Asoke Hype"
                    value={form.project_name}
                    onChange={(e) => setForm({ ...form, project_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                  <datalist id="condo-building-options">
                    {condoBuildings.map((b) => (
                      <option key={b.buildingName} value={b.buildingName} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  >
                    <option>Available</option>
                    <option>Occupied</option>
                    <option>Under Maintenance</option>
                    <option>Reserved</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Listing Offer</label>
                  <select
                    value={form.listing_type}
                    onChange={(e) => setForm({ ...form, listing_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  >
                    <option>Rent & Sale</option>
                    <option>For Rent</option>
                    <option>For Sale</option>
                    <option>Managed Only</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Tower / Wing / Zone
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Tower A / North Wing"
                    value={form.building}
                    onChange={(e) => setForm({ ...form, building: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Floor / Storeys
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 18 or 2 Storeys"
                    value={form.floor}
                    onChange={(e) => setForm({ ...form, floor: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Size (sqm)
                  </label>
                  <FormattedNumberInput
                    value={form.size_sqm}
                    maxDecimals={2}
                    onValueChange={(val) => setForm({ ...form, size_sqm: val })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Bedrooms / Rooms
                  </label>
                  <FormattedNumberInput
                    value={form.bedrooms}
                    maxDecimals={0}
                    onValueChange={(val) => setForm({ ...form, bedrooms: val })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Bathrooms
                  </label>
                  <FormattedNumberInput
                    value={form.bathrooms}
                    maxDecimals={0}
                    onValueChange={(val) => setForm({ ...form, bathrooms: val })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Furnishing</label>
                  <select
                    value={form.furnishing}
                    onChange={(e) => setForm({ ...form, furnishing: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  >
                    <option>Fully Furnished</option>
                    <option>Partly Furnished</option>
                    <option>Unfurnished</option>
                  </select>
                </div>
              </div>

              {/* Pricing & Auto-Generated Price per Sqm (Rent/Sqm & Sale/Sqm) */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-indigo-600" />
                    <span>
                      Rent & Sale Pricing + Auto Price-per-Sqm ({formatSysNumber(form.size_sqm, 2)}{' '}
                      sqm)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {form.target_sale_price > 0 && form.target_rent_price > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                        Gross Yield:{' '}
                        {formatSysNumber(
                          ((form.target_rent_price * 12) / form.target_sale_price) * 100,
                          2,
                          2
                        )}
                        % p.a.
                      </span>
                    )}
                    {onOpenCalculatorForUnit && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowModal(false);
                          onOpenCalculatorForUnit({
                            id: editingUnit?.id || 0,
                            unit_code: form.unit_code || 'NEW-UNIT',
                            project_name: form.project_name || 'Property Unit',
                            city: form.city,
                            property_category: form.property_category,
                            property_type: form.property_type,
                            bedrooms: form.bedrooms,
                            bathrooms: form.bathrooms,
                            size_sqm: Number(form.size_sqm) || 45,
                            furnishing: form.furnishing,
                            status: form.status,
                            listing_type: form.listing_type,
                            target_rent_price: Number(form.target_rent_price) || 0,
                            target_sale_price: Number(form.target_sale_price) || 0,
                            created_at: new Date().toISOString(),
                            open_issues_count: 0,
                            total_issues_count: 0,
                          });
                        }}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-2xs transition cursor-pointer"
                      >
                        <Calculator className="w-3 h-3" />
                        <span>Calculate Taxes, Comm & Agency Profit →</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Rent (THB/mo)
                    </label>
                    <FormattedNumberInput
                      value={form.target_rent_price}
                      maxDecimals={2}
                      onValueChange={(val) =>
                        setForm({ ...form, target_rent_price: val })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-emerald-800 block mb-1">
                      Auto Rent / Sqm (THB/sqm)
                    </label>
                    <div className="relative">
                      <FormattedNumberInput
                        value={
                          Number(form.size_sqm) > 0
                            ? Math.round(
                                (Number(form.target_rent_price) / Number(form.size_sqm)) * 100
                              ) / 100
                            : 0
                        }
                        maxDecimals={2}
                        onValueChange={(rPerSqm) => {
                          setForm({
                            ...form,
                            target_rent_price: Math.round(rPerSqm * (Number(form.size_sqm) || 1)),
                          });
                        }}
                        className="w-full px-3 py-2 pr-14 rounded-lg border border-emerald-300 bg-emerald-50/70 font-extrabold text-emerald-900"
                        title="Auto-generated from Rent ÷ Size (sqm). You can also type here to reverse-calculate Total Rent."
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-700 pointer-events-none">
                        /sqm/mo
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Sale Price (THB)
                    </label>
                    <FormattedNumberInput
                      value={form.target_sale_price}
                      maxDecimals={2}
                      onValueChange={(val) =>
                        setForm({ ...form, target_sale_price: val })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-900"
                    />
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Presets:</span>
                      {[
                        { label: '฿1.5M', val: 1500000 },
                        { label: '฿3.0M (Standard)', val: 3000000 },
                        { label: '฿5.0M', val: 5000000 },
                        { label: '฿10.0M', val: 10000000 },
                      ].map((p) => (
                        <button
                          key={p.val}
                          type="button"
                          onClick={() => setForm({ ...form, target_sale_price: p.val })}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                            Number(form.target_sale_price) === p.val
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-indigo-800 block mb-1">
                      Auto Sale / Sqm (THB/sqm)
                    </label>
                    <div className="relative">
                      <FormattedNumberInput
                        value={
                          Number(form.size_sqm) > 0
                            ? Math.round(
                                (Number(form.target_sale_price) / Number(form.size_sqm)) * 100
                              ) / 100
                            : 0
                        }
                        maxDecimals={2}
                        onValueChange={(sPerSqm) => {
                          setForm({
                            ...form,
                            target_sale_price: Math.round(sPerSqm * (Number(form.size_sqm) || 1)),
                          });
                        }}
                        className="w-full px-3 py-2 pr-11 rounded-lg border border-indigo-300 bg-indigo-50/70 font-extrabold text-indigo-900"
                        title="Auto-generated from Sale Price ÷ Size (sqm). You can also type here to reverse-calculate Total Sale Price."
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-indigo-700 pointer-events-none">
                        /sqm
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Landlord (Owner)
                  </label>
                  <select
                    value={form.landlord_id}
                    onChange={(e) => setForm({ ...form, landlord_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  >
                    <option value="">-- Select Landlord --</option>
                    {landlords.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Developer</label>
                  <select
                    value={form.developer_id}
                    onChange={(e) => setForm({ ...form, developer_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  >
                    <option value="">-- Select Developer --</option>
                    {developers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.company_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Developer Warranty Expiry
                  </label>
                  <input
                    type="date"
                    value={form.warranty_expiry_date}
                    onChange={(e) => setForm({ ...form, warranty_expiry_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Keycard, Gate Pass & Lockbox
                  </label>
                  <input
                    type="text"
                    value={form.key_card_and_access_info}
                    onChange={(e) => setForm({ ...form, key_card_and_access_info: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Electric Meter No.
                  </label>
                  <input
                    type="text"
                    value={form.meter_electric_no}
                    onChange={(e) => setForm({ ...form, meter_electric_no: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Water Meter No.</label>
                  <input
                    type="text"
                    value={form.meter_water_no}
                    onChange={(e) => setForm({ ...form, meter_water_no: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1.5">
                  High-Resolution Unit Pictures (Drag & Drop)
                </label>
                <HighResImageUploader
                  images={form.gallery_images}
                  coverImage={form.image_url}
                  onChange={(newImages, newCover) =>
                    setForm({
                      ...form,
                      gallery_images: newImages,
                      image_url: newCover,
                    })
                  }
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Unit Notes</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
                >
                  Save Property Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK RENT & SALE DEAL REPORT MODAL */}
      {financialReportUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-5xl bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black">
                  {financialReportUnit.unit_code}
                </span>
                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    {financialReportUnit.project_name} — Financial & Deal Reports
                  </h2>
                  <p className="text-xs text-slate-500">
                    {financialReportUnit.city} • {financialReportUnit.property_category} ({financialReportUnit.property_type}) • {financialReportUnit.size_sqm} sqm
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFinancialReportUnit(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <PropertyFinancialReports
              unit={financialReportUnit}
              defaultView="split"
              onOpenFullCalculator={(u) => {
                setFinancialReportUnit(null);
                if (onOpenCalculatorForUnit) onOpenCalculatorForUnit(u);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
