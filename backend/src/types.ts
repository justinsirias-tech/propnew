export interface Developer {
  id: number;
  company_name: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  line_id?: string | null;
  address?: string | null;
  warranty_policy?: string | null;
  defect_contact_info?: string | null;
  tax_id?: string | null;
  corporate_employees?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface Contact {
  id: number;
  role: 'LANDLORD' | 'TENANT' | 'VENDOR' | 'DEVELOPER_REP' | 'BOTH' | string;
  entity_type: 'Individual' | 'Corporate' | string;
  full_name: string;
  company_name?: string | null;
  tax_id?: string | null;
  service_category?: string | null;
  phone?: string | null;
  email?: string | null;
  line_or_whatsapp?: string | null;
  nationality?: string | null;
  id_or_passport?: string | null;
  bank_name?: string | null;
  bank_account_no?: string | null;
  bank_account_info?: string | null;
  preferred_language?: string | null;
  rating?: number | null;
  notes?: string | null;
  corporate_employees?: string | null;
  created_at?: string;
}

export interface PropertyUnit {
  id: number;
  unit_code: string;
  project_name: string;
  city: string;
  property_category: string;
  property_type: string;
  building?: string | null;
  floor?: string | null;
  bedrooms: number;
  bathrooms: number;
  size_sqm: number;
  furnishing: string;
  status: string;
  listing_type: string;
  target_rent_price: number;
  target_sale_price: number;
  developer_id?: number | null;
  landlord_id?: number | null;
  handover_date?: string | null;
  defect_warranty_expiry?: string | null;
  electric_meter_no?: string | null;
  water_meter_no?: string | null;
  keycard_inventory?: string | null;
  parking_slot?: string | null;
  listing_headline?: string | null;
  description_summary?: string | null;
  amenities_highlights?: string | null;
  co_broke_terms?: string | null;
  agent_internal_notes?: string | null;
  juristic_cam_fee_sqm?: number | null;
  juristic_annual_estimate?: number | null;
  juristic_office_contact?: string | null;
  image_url?: string | null;
  gallery_images?: string | null;
  created_at?: string;

  // Virtual computed metrics
  price_per_sqm_sale?: number;
  target_net_yield?: number;
  developer?: Developer | null;
  landlord?: Contact | null;
}

export interface LeaseContract {
  id: number;
  contract_no: string;
  unit_id: number;
  landlord_id: number;
  tenant_id: number;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  has_rent_spread: number;
  landlord_monthly_rent?: number | null;
  security_deposit: number;
  landlord_security_deposit?: number | null;
  advance_rent: number;
  payment_due_day: number;
  agent_commission: number;
  management_fee_percent: number;
  commission_deducted_upfront: number;
  deposit_forfeited: number;
  early_termination_date?: string | null;
  early_termination_note?: string | null;
  status: string;
  inventory_checklist_signed: string;
  special_terms?: string | null;
  document_url?: string | null;
  documents?: string | null;
  created_at?: string;

  // Joined fields
  unit_code?: string;
  project_name?: string;
  landlord_name?: string;
  landlord_phone?: string;
  landlord_bank_name?: string;
  landlord_bank_account_no?: string;
  tenant_name?: string;
  tenant_phone?: string;
  days_remaining?: number;
  payments_count?: number;
  paid_months_count?: number;
  written_off_months_count?: number;
  monthly_rent_spread?: number;
  total_collected_from_tenant?: number;
  total_landlord_expenses?: number;
  total_net_landlord_profit?: number;
  total_agency_profit?: number;
}

export interface RentalPayment {
  id: number;
  receipt_no: string;
  lease_id: number;
  unit_id: number;
  landlord_id: number;
  tenant_id: number;
  billing_month: string;
  due_date: string;
  paid_date?: string | null;
  status: string;
  base_rent: number;
  landlord_base_rent?: number | null;
  rent_spread_agency?: number | null;
  tenant_extra_charges: number;
  tenant_charges_note?: string | null;
  amount_collected_from_tenant: number;
  landlord_repair_deduction: number;
  other_landlord_expenses: number;
  expense_breakdown_note?: string | null;
  net_payout_to_landlord: number;
  withholding_tax_5_percent?: number;
  landlord_withholding_tax_5_percent?: number;
  payment_method: string;
  proof_document_url?: string | null;
  created_at?: string;

  contract_no?: string;
  unit_code?: string;
  project_name?: string;
  landlord_name?: string;
  tenant_name?: string;
}

export interface UnitIssue {
  id: number;
  ticket_no: string;
  unit_id: number;
  lease_id?: number | null;
  title: string;
  category: string;
  priority: string;
  status: string;
  reported_by: string;
  responsible_party: string;
  vendor_or_contractor?: string | null;
  description?: string | null;
  resolution_notes?: string | null;
  estimated_cost: number;
  actual_cost: number;
  reported_date: string;
  resolved_date?: string | null;
  issue_images?: string | string[] | null;
  issue_documents?: string | null;
  created_at?: string;

  unit_code?: string;
  project_name?: string;
  developer_name?: string;
  landlord_name?: string;
  tenant_name?: string;
}

export interface CommunicationLog {
  id: number;
  channel: string;
  direction: string;
  subject: string;
  content: string;
  logged_by: string;
  contact_id?: number | null;
  developer_id?: number | null;
  unit_id?: number | null;
  issue_id?: number | null;
  created_at?: string;

  contact_name?: string;
  developer_name?: string;
  unit_code?: string;
}

export interface FeaturePermissions {
  dashboard?: { view?: boolean; view_financials?: boolean; export_data?: boolean };
  units?: { view?: boolean; create?: boolean; edit?: boolean; delete?: boolean; view_pricing?: boolean };
  crm?: { view?: boolean; create?: boolean; edit?: boolean; delete?: boolean; view_contacts?: boolean };
  leases?: {
    view?: boolean;
    create?: boolean;
    edit?: boolean;
    delete?: boolean;
    view_confidential_spread?: boolean;
    view_statements?: boolean;
    mark_paid?: boolean;
    upload_slips?: boolean;
    terminate_lease?: boolean;
  };
  issues?: { view?: boolean; create?: boolean; edit?: boolean; delete?: boolean; resolve?: boolean };
  calculator?: { view?: boolean; export_reports?: boolean };
  financial_settings?: { view?: boolean; edit?: boolean };
  user_management?: { view?: boolean; edit?: boolean };
  [key: string]: any;
}

export interface AppUser {
  id: number;
  full_name: string;
  email: string;
  role: string;
  department: string;
  phone?: string | null;
  status: string;
  avatar_url?: string | null;
  last_login?: string | null;
  created_at?: string;
  permissions: FeaturePermissions;
}
