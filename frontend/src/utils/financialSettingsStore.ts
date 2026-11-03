import { api } from '../api';

export interface CustomFeeItem {
  id: string;
  name: string;
  category:
    | 'Taxes & Government'
    | 'CAM & Juristic'
    | 'Commission & Brokerage'
    | 'Property Management'
    | 'Legal & Administrative'
    | 'Custom / Other';
  calc_type:
    | 'PERCENT_OF_SALE'
    | 'PERCENT_OF_RENT'
    | 'PER_SQM_MONTH'
    | 'PER_SQM_ONETIME'
    | 'FIXED';
  amount: number;
  borne_by: 'Seller / Landlord' | 'Buyer / Tenant' | '50/50 Split' | 'Agency Absorbed';
  applicable_to: 'Sale' | 'Rental' | 'Both';
  active: boolean;
  description?: string;
}

export interface TaxesSettings {
  transfer_fee_rate: number; // e.g. 2.0%
  default_transfer_split: '50_50' | 'SELLER_100' | 'BUYER_100';
  sbt_rate: number; // e.g. 3.3%
  stamp_duty_rate: number; // e.g. 0.5%
  wht_individual_rate: number; // e.g. 2.2%
  wht_corporate_rate: number; // e.g. 1.0%
  rental_wht_rate: number; // e.g. 5.0%
  land_and_building_tax_rate: number; // e.g. 0.3%
}

export type PropertyDirectoryType =
  | 'Condominium'
  | 'Townhome'
  | 'Single Home'
  | 'Commercial'
  | 'Other';

export interface ProjectCamDirectoryItem {
  id: string;
  projectName: string;
  propertyType: PropertyDirectoryType;
  city: string;
  district?: string;
  developerName?: string;
  camFeePerSqmMonth: number; // e.g. ฿85 / sqm / month
  sinkingFundPerSqm: number; // e.g. ฿800 / sqm one-time
  paymentCycle: 'Monthly' | 'Quarterly' | 'Semi-Annually' | 'Annually';
  juristicCompany?: string;
  juristicPhone?: string;
  juristicLineId?: string;
  juristicEmail?: string;
  notes?: string;
}

export interface CamFeesSettings {
  default_cam_per_sqm_month: number; // e.g. ฿55/sqm/mo
  sinking_fund_per_sqm: number; // e.g. ฿500/sqm
  sinking_fund_payer: 'BUYER' | 'SELLER' | 'SPLIT';
  juristic_meter_deposit: number; // e.g. ฿4,000
  juristic_annual_insurance: number; // e.g. ฿2,500
}

export interface CommissionsSettings {
  sale_commission_rate: number; // e.g. 3.0%
  sale_min_commission: number; // e.g. ฿50,000
  sale_co_broke_split_pct: number; // e.g. 50%
  sale_internal_agent_share_pct: number; // e.g. 25%
  rental_1yr_months: number; // e.g. 1.0 month
  rental_6mo_months: number; // e.g. 0.5 month
  rental_2yr_months: number; // e.g. 1.5 months
  rental_renewal_months: number; // e.g. 0.5 month
  rental_internal_agent_share_pct: number; // e.g. 25%
}

export interface ManagementFeesSettings {
  monthly_pm_fee_pct: number; // e.g. 8.0% of rent
  monthly_pm_fixed_fee: number; // e.g. ฿2,000
  use_fixed_pm_fee: boolean;
  turnover_inspection_fee: number; // e.g. ฿1,500
  annual_maintenance_escrow: number; // e.g. ฿3,000
  emergency_repair_threshold: number; // e.g. ฿5,000
}

export interface FinancialSettings {
  taxes: TaxesSettings;
  cam_fees: CamFeesSettings;
  commissions: CommissionsSettings;
  management_fees: ManagementFeesSettings;
  custom_items: CustomFeeItem[];
  project_cam_directory: ProjectCamDirectoryItem[];
}

export const DEFAULT_PROJECT_CAM_DIRECTORY: ProjectCamDirectoryItem[] = [
  {
    id: 'proj-park-origin-thonglor',
    projectName: 'Park Origin Thonglor',
    propertyType: 'Condominium',
    city: 'Bangkok',
    district: 'Thonglor / Watthana',
    developerName: 'Origin Property',
    camFeePerSqmMonth: 85.0,
    sinkingFundPerSqm: 800.0,
    paymentCycle: 'Annually',
    juristicCompany: 'Savills Property Management',
    juristicPhone: '+66 2 381 8800',
    juristicLineId: '@parkorigin_jur',
    juristicEmail: 'juristic.thonglor@parkorigin.co.th',
    notes: 'Luxury high-rise duo space. Includes 50m pool, rooftop garden, onsen, 1 assigned parking slot.',
  },
  {
    id: 'proj-the-monument-thonglor',
    projectName: 'The Monument Thonglor',
    propertyType: 'Condominium',
    city: 'Bangkok',
    district: 'Thonglor / Watthana',
    developerName: 'Sansiri',
    camFeePerSqmMonth: 95.0,
    sinkingFundPerSqm: 1000.0,
    paymentCycle: 'Annually',
    juristicCompany: 'Plus Property Concierge',
    juristicPhone: '+66 2 392 9901',
    juristicLineId: '@monument_jur',
    juristicEmail: 'monument.juristic@plus.co.th',
    notes: 'Ultra-luxury high rise. Private elevator access, 24/7 concierge, EV valet charging bays.',
  },
  {
    id: 'proj-xt-ekkamai',
    projectName: 'XT Ekkamai',
    propertyType: 'Condominium',
    city: 'Bangkok',
    district: 'Ekkamai / Watthana',
    developerName: 'Sansiri',
    camFeePerSqmMonth: 65.0,
    sinkingFundPerSqm: 500.0,
    paymentCycle: 'Annually',
    juristicCompany: 'Plus Property',
    juristicPhone: '+66 2 391 4455',
    juristicLineId: '@xtekkamai_jur',
    juristicEmail: 'xt.ekkamai@plus.co.th',
    notes: 'Co-sharing amenities across XT brands, sky lounge, virtual fitness room, smart parcel locker.',
  },
  {
    id: 'proj-life-asoke-hype',
    projectName: 'Life Asoke Hype',
    propertyType: 'Condominium',
    city: 'Bangkok',
    district: 'Makkasan / Ratchathewi',
    developerName: 'AP Thailand',
    camFeePerSqmMonth: 50.0,
    sinkingFundPerSqm: 500.0,
    paymentCycle: 'Semi-Annually',
    juristicCompany: 'SMART Service and Management',
    juristicPhone: '+66 2 245 1100',
    juristicLineId: '@lifeasokehype',
    juristicEmail: 'life.asoke@smartservice.co.th',
    notes: 'Next to MRT Rama 9 interchange. Mirage sky pool, co-working space, digital gym.',
  },
  {
    id: 'proj-rhythm-phrom-phong',
    projectName: 'Rhythm Phrom Phong',
    propertyType: 'Condominium',
    city: 'Bangkok',
    district: 'Phrom Phong / Watthana',
    developerName: 'AP Thailand',
    camFeePerSqmMonth: 60.0,
    sinkingFundPerSqm: 500.0,
    paymentCycle: 'Annually',
    juristicCompany: 'SMART Service and Management',
    juristicPhone: '+66 2 258 7700',
    juristicLineId: '@rhythmphromphong',
    juristicEmail: 'rhythm.sukhumvit@smartservice.co.th',
    notes: 'Walking distance to BTS Phrom Phong & EmQuartier. 360-degree infinity pool deck.',
  },
  {
    id: 'proj-demi-sukhumvit-31',
    projectName: 'Demi Sukhumvit 31',
    propertyType: 'Townhome',
    city: 'Bangkok',
    district: 'Sukhumvit 31 / Watthana',
    developerName: 'Sansiri',
    camFeePerSqmMonth: 45.0,
    sinkingFundPerSqm: 350.0,
    paymentCycle: 'Quarterly',
    juristicCompany: 'Plus Property Private Estate',
    juristicPhone: '+66 2 260 3100',
    juristicLineId: '@demi31_office',
    juristicEmail: 'demi31@plus.co.th',
    notes: 'Exclusive 3.5-storey gated townhome community. 24/7 guarded gate, private home elevator servicing.',
  },
  {
    id: 'proj-burasiri-phuket',
    projectName: 'Burasiri Phuket Koh Kaew',
    propertyType: 'Single Home',
    city: 'Phuket',
    district: 'Koh Kaew / Mueang Phuket',
    developerName: 'Sansiri',
    camFeePerSqmMonth: 35.0,
    sinkingFundPerSqm: 250.0,
    paymentCycle: 'Semi-Annually',
    juristicCompany: 'Plus Property Estate Management',
    juristicPhone: '+66 76 388 900',
    juristicLineId: '@burasiriphuket',
    juristicEmail: 'burasiri.phuket@plus.co.th',
    notes: 'Gated resort single detached housing estate. Clubhouse, security barriers, perimeter patrol, park landscaping.',
  },
  {
    id: 'proj-silom-shophouse',
    projectName: 'Silom-Naradhiwas Shophouse Strip',
    propertyType: 'Commercial',
    city: 'Bangkok',
    district: 'Silom / Bang Rak',
    developerName: 'Commercial Freehold',
    camFeePerSqmMonth: 15.0,
    sinkingFundPerSqm: 0.0,
    paymentCycle: 'Quarterly',
    juristicCompany: 'Silom Commercial Merchant Association',
    juristicPhone: '+66 2 234 5678',
    juristicLineId: '@silom_strip',
    juristicEmail: 'info@silomstrip.org',
    notes: 'Street commercial shophouses. Fee covers common alley lighting, CCTV monitoring, waste removal.',
  },
  {
    id: 'proj-bangna-logistics',
    projectName: 'Bangna Logistics Park KM.19',
    propertyType: 'Commercial',
    city: 'Samut Prakan',
    district: 'Bang Phli',
    developerName: 'WHA / Frasers',
    camFeePerSqmMonth: 12.0,
    sinkingFundPerSqm: 100.0,
    paymentCycle: 'Monthly',
    juristicCompany: 'Park Industrial Operations',
    juristicPhone: '+66 2 740 9900',
    juristicLineId: '@bangnalogistics',
    juristicEmail: 'ops@bangnalogistics.com',
    notes: 'Heavy vehicle road network maintenance, industrial fire main, 24/7 security gates.',
  },
];

export const DEFAULT_FINANCIAL_SETTINGS: FinancialSettings = {
  taxes: {
    transfer_fee_rate: 2.0,
    default_transfer_split: '50_50',
    sbt_rate: 3.3,
    stamp_duty_rate: 0.5,
    wht_individual_rate: 2.2,
    wht_corporate_rate: 1.0,
    rental_wht_rate: 5.0,
    land_and_building_tax_rate: 0.3,
  },
  cam_fees: {
    default_cam_per_sqm_month: 55.0,
    sinking_fund_per_sqm: 500.0,
    sinking_fund_payer: 'BUYER',
    juristic_meter_deposit: 4000.0,
    juristic_annual_insurance: 2500.0,
  },
  commissions: {
    sale_commission_rate: 3.0,
    sale_min_commission: 50000.0,
    sale_co_broke_split_pct: 50.0,
    sale_internal_agent_share_pct: 25.0,
    rental_1yr_months: 1.0,
    rental_6mo_months: 0.5,
    rental_2yr_months: 1.5,
    rental_renewal_months: 0.5,
    rental_internal_agent_share_pct: 25.0,
  },
  management_fees: {
    monthly_pm_fee_pct: 8.0,
    monthly_pm_fixed_fee: 0.0,
    use_fixed_pm_fee: false,
    turnover_inspection_fee: 1500.0,
    annual_maintenance_escrow: 3000.0,
    emergency_repair_threshold: 5000.0,
  },
  custom_items: [
    {
      id: 'cust-fet-foreign-quota',
      name: 'Foreign Quota FET Due Diligence & Bank Cert',
      category: 'Legal & Administrative',
      calc_type: 'FIXED',
      amount: 5000.0,
      borne_by: 'Buyer / Tenant',
      applicable_to: 'Sale',
      active: true,
      description: 'Handling of Foreign Exchange Transaction (FET) form with Thai commercial banks.',
    },
    {
      id: 'cust-sinking-fund',
      name: 'Condo Sinking Fund Reserve',
      category: 'CAM & Juristic',
      calc_type: 'PER_SQM_ONETIME',
      amount: 500.0,
      borne_by: 'Buyer / Tenant',
      applicable_to: 'Sale',
      active: true,
      description: 'One-time contribution to the building reserve sinking fund for major repairs.',
    },
    {
      id: 'cust-meter-transfer',
      name: 'MEA / PWA Meter Ownership Transfer',
      category: 'Taxes & Government',
      calc_type: 'FIXED',
      amount: 2500.0,
      borne_by: 'Buyer / Tenant',
      applicable_to: 'Sale',
      active: true,
      description: 'Government utility deposit transfer at MEA/PEA & MWA/PWA offices.',
    },
    {
      id: 'cust-turnover-cleaning',
      name: 'Pre-Move-In Deep Cleaning & AC Sanitization',
      category: 'Property Management',
      calc_type: 'FIXED',
      amount: 2200.0,
      borne_by: 'Seller / Landlord',
      applicable_to: 'Rental',
      active: true,
      description: 'Professional 2-stage chemical AC wash and turnover deep cleaning.',
    },
  ],
  project_cam_directory: DEFAULT_PROJECT_CAM_DIRECTORY,
};

const STORAGE_KEY = 'proppulse_financial_settings_v3';
const EVENT_NAME = 'proppulse_financial_settings_updated';

/**
 * Loads current settings from localStorage, or returns default
 */
export function getLocalFinancialSettings(): FinancialSettings {
  if (typeof window === 'undefined') return DEFAULT_FINANCIAL_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FINANCIAL_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      taxes: { ...DEFAULT_FINANCIAL_SETTINGS.taxes, ...parsed.taxes },
      cam_fees: { ...DEFAULT_FINANCIAL_SETTINGS.cam_fees, ...parsed.cam_fees },
      commissions: { ...DEFAULT_FINANCIAL_SETTINGS.commissions, ...parsed.commissions },
      management_fees: { ...DEFAULT_FINANCIAL_SETTINGS.management_fees, ...parsed.management_fees },
      custom_items: Array.isArray(parsed.custom_items)
        ? parsed.custom_items
        : DEFAULT_FINANCIAL_SETTINGS.custom_items,
      project_cam_directory:
        Array.isArray(parsed.project_cam_directory) && parsed.project_cam_directory.length > 0
          ? parsed.project_cam_directory
          : DEFAULT_FINANCIAL_SETTINGS.project_cam_directory,
    };
  } catch (e) {
    console.error('Failed to parse financial settings:', e);
    return DEFAULT_FINANCIAL_SETTINGS;
  }
}

/**
 * Saves settings to both localStorage and backend API
 */
export async function saveFinancialSettings(settings: FinancialSettings): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event(EVENT_NAME));
  }
  try {
    await api.saveFinancialSettings(settings);
  } catch (err) {
    console.warn('Backend settings sync failed (saved locally):', err);
  }
}

/**
 * Resets settings to default
 */
export async function resetFinancialSettings(): Promise<FinancialSettings> {
  await saveFinancialSettings(DEFAULT_FINANCIAL_SETTINGS);
  return DEFAULT_FINANCIAL_SETTINGS;
}

/**
 * Subscribes to settings change events
 */
export function subscribeFinancialSettings(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENT_NAME, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(EVENT_NAME, callback);
    window.removeEventListener('storage', callback);
  };
}

/**
 * Calculates custom fee amounts for a given property scenario
 */
export function computeCustomFeesBreakdown(
  customItems: CustomFeeItem[],
  params: {
    salePrice: number;
    monthlyRent: number;
    sizeSqm: number;
    dealType: 'Sale' | 'Rental' | 'Both';
  }
) {
  let sellerTotal = 0;
  let buyerTotal = 0;
  let agencyAbsorbedTotal = 0;
  let grossTotal = 0;

  const itemizedList: Array<{
    item: CustomFeeItem;
    totalAmount: number;
    sellerShare: number;
    buyerShare: number;
    agencyShare: number;
  }> = [];

  const activeItems = customItems.filter(
    (item) =>
      item.active &&
      (item.applicable_to === 'Both' ||
        params.dealType === 'Both' ||
        item.applicable_to === params.dealType)
  );

  for (const item of activeItems) {
    let amount = 0;
    switch (item.calc_type) {
      case 'PERCENT_OF_SALE':
        amount = Math.round(params.salePrice * (item.amount / 100));
        break;
      case 'PERCENT_OF_RENT':
        amount = Math.round(params.monthlyRent * (item.amount / 100));
        break;
      case 'PER_SQM_MONTH':
        amount = Math.round(params.sizeSqm * item.amount * 12);
        break;
      case 'PER_SQM_ONETIME':
        amount = Math.round(params.sizeSqm * item.amount);
        break;
      case 'FIXED':
      default:
        amount = Math.round(item.amount);
        break;
    }

    let sellerShare = 0;
    let buyerShare = 0;
    let agencyShare = 0;

    switch (item.borne_by) {
      case 'Seller / Landlord':
        sellerShare = amount;
        break;
      case 'Buyer / Tenant':
        buyerShare = amount;
        break;
      case '50/50 Split':
        sellerShare = Math.round(amount * 0.5);
        buyerShare = amount - sellerShare;
        break;
      case 'Agency Absorbed':
        agencyShare = amount;
        break;
    }

    grossTotal += amount;
    sellerTotal += sellerShare;
    buyerTotal += buyerShare;
    agencyAbsorbedTotal += agencyShare;

    itemizedList.push({
      item,
      totalAmount: amount,
      sellerShare,
      buyerShare,
      agencyShare,
    });
  }

  return {
    grossTotal,
    sellerTotal,
    buyerTotal,
    agencyAbsorbedTotal,
    itemizedList,
  };
}

/**
 * Looks up CAM & Sinking Fund rates for a specific project name and/or property type.
 * Prioritizes exact/partial match in Project CAM Directory,
 * then falls back to property-type specific baseline,
 * and finally to global default CAM fee.
 */
export function lookupProjectCamFee(
  directory: ProjectCamDirectoryItem[] = [],
  projectName?: string,
  propertyType?: string,
  defaultCamFallback: number = 55.0,
  defaultSinkingFallback: number = 500.0
): {
  matchedProfile?: ProjectCamDirectoryItem;
  camFeePerSqmMonth: number;
  sinkingFundPerSqm: number;
  paymentCycle: 'Monthly' | 'Quarterly' | 'Semi-Annually' | 'Annually';
  source: 'project' | 'property_type_default' | 'system_default';
  description: string;
} {
  const normProject = (projectName || '').trim().toLowerCase();
  const normType = (propertyType || '').trim().toLowerCase();

  // 1. Try exact or fuzzy match in directory by project name
  if (normProject && Array.isArray(directory)) {
    // Exact match
    const exact = directory.find(
      (p) => p.projectName.trim().toLowerCase() === normProject
    );
    if (exact) {
      return {
        matchedProfile: exact,
        camFeePerSqmMonth: exact.camFeePerSqmMonth,
        sinkingFundPerSqm: exact.sinkingFundPerSqm,
        paymentCycle: exact.paymentCycle,
        source: 'project',
        description: `${exact.projectName} (${exact.propertyType}) Directory Rate`,
      };
    }

    // Substring match
    const partial = directory.find((p) => {
      const pName = p.projectName.trim().toLowerCase();
      return pName.includes(normProject) || normProject.includes(pName);
    });
    if (partial) {
      return {
        matchedProfile: partial,
        camFeePerSqmMonth: partial.camFeePerSqmMonth,
        sinkingFundPerSqm: partial.sinkingFundPerSqm,
        paymentCycle: partial.paymentCycle,
        source: 'project',
        description: `${partial.projectName} (${partial.propertyType}) Directory Match`,
      };
    }
  }

  // 2. Property-Type market baseline fallback
  if (normType) {
    if (normType.includes('town')) {
      return {
        camFeePerSqmMonth: 45.0,
        sinkingFundPerSqm: 350.0,
        paymentCycle: 'Quarterly',
        source: 'property_type_default',
        description: 'Townhome Standard Market Baseline (฿45/sqm/mo)',
      };
    }
    if (normType.includes('single') || normType.includes('house') || normType.includes('villa')) {
      return {
        camFeePerSqmMonth: 35.0,
        sinkingFundPerSqm: 250.0,
        paymentCycle: 'Semi-Annually',
        source: 'property_type_default',
        description: 'Single Detached Home Baseline (฿35/sqm/mo)',
      };
    }
    if (normType.includes('commercial') || normType.includes('shop') || normType.includes('warehouse')) {
      return {
        camFeePerSqmMonth: 15.0,
        sinkingFundPerSqm: 100.0,
        paymentCycle: 'Quarterly',
        source: 'property_type_default',
        description: 'Commercial / Shophouse Baseline (฿15/sqm/mo)',
      };
    }
    if (normType.includes('condo')) {
      return {
        camFeePerSqmMonth: 55.0,
        sinkingFundPerSqm: 500.0,
        paymentCycle: 'Annually',
        source: 'property_type_default',
        description: 'Condominium Standard Baseline (฿55/sqm/mo)',
      };
    }
  }

  // 3. Fallback to system default
  return {
    camFeePerSqmMonth: defaultCamFallback,
    sinkingFundPerSqm: defaultSinkingFallback,
    paymentCycle: 'Annually',
    source: 'system_default',
    description: `System Standard CAM (฿${defaultCamFallback}/sqm/mo)`,
  };
}
