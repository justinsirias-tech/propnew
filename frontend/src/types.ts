export interface CorporateEmployee {
  name: string;
  title_or_department?: string;
  phone?: string;
  email?: string;
  line_or_whatsapp?: string;
  is_primary?: boolean;
  notes?: string;
}

export interface Developer {
  id: number;
  company_name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  line_id?: string;
  address?: string;
  warranty_policy?: string;
  defect_contact_info?: string;
  tax_id?: string;
  corporate_employees?: CorporateEmployee[];
  notes?: string;
  created_at: string;
  unit_count: number;
  open_warranty_issues: number;
}

export interface Contact {
  id: number;
  role: 'LANDLORD' | 'TENANT' | 'BOTH' | 'VENDOR' | string;
  entity_type?: 'Individual' | 'Corporate' | string;
  company_name?: string;
  tax_id?: string;
  service_category?: string;
  corporate_employees?: CorporateEmployee[];
  full_name: string;
  phone: string;
  email?: string;
  line_or_whatsapp?: string;
  nationality?: string;
  id_or_passport?: string;
  bank_name?: string;
  bank_account_no?: string;
  bank_account_info?: string;
  emergency_contact?: string;
  preferred_language?: string;
  rating?: number;
  notes?: string;
  created_at: string;
  owned_units_count: number;
  active_leases_count: number;
  vendor_jobs_count?: number;
}

export interface PropertyUnit {
  id: number;
  unit_code: string;
  project_name: string;
  city: string;
  property_category: 'Residential' | 'Commercial' | string;
  property_type: string;
  building?: string;
  floor?: string;
  bedrooms: number;
  bathrooms: number;
  size_sqm: number;
  furnishing: string;
  status: 'Available' | 'Occupied' | 'Under Maintenance' | 'Reserved' | string;
  listing_type: string;
  target_rent_price: number;
  target_sale_price: number;
  rent_per_sqm?: number;
  sale_per_sqm?: number;
  address?: string;
  key_card_and_access_info?: string;
  meter_electric_no?: string;
  meter_water_no?: string;
  warranty_expiry_date?: string;
  image_url?: string;
  gallery_images?: string[];
  notes?: string;
  developer_id?: number | null;
  landlord_id?: number | null;
  created_at: string;
  developer_name?: string;
  landlord_name?: string;
  landlord_phone?: string;
  current_tenant_name?: string;
  current_lease_id?: number;
  current_lease_end?: string;
  open_issues_count: number;
  total_issues_count: number;
}

export interface LeaseDocument {
  url: string;
  name: string;
  doc_type?: string;
  size_bytes?: number;
  uploaded_at?: string;
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
  has_rent_spread?: number;
  landlord_monthly_rent?: number;
  security_deposit: number;
  landlord_security_deposit?: number;
  advance_rent: number;
  payment_due_day: number;
  agent_commission: number;
  management_fee_percent?: number;
  commission_deducted_upfront?: number;
  deposit_forfeited?: number;
  early_termination_date?: string | null;
  early_termination_note?: string | null;
  status: 'Active' | 'Expiring Soon' | 'Expired' | 'Terminated' | 'Draft' | string;
  inventory_checklist_signed: string;
  special_terms?: string;
  document_url?: string;
  documents?: LeaseDocument[];
  created_at: string;
  unit_code?: string;
  project_name?: string;
  landlord_name?: string;
  landlord_phone?: string;
  landlord_bank_name?: string;
  landlord_bank_account_no?: string;
  tenant_name?: string;
  tenant_phone?: string;
  days_remaining?: number | null;
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
  landlord_base_rent?: number;
  rent_spread_agency?: number;
  tenant_extra_charges: number;
  tenant_charges_note?: string;
  amount_collected_from_tenant: number;
  landlord_repair_deduction: number;
  other_landlord_expenses: number;
  expense_breakdown_note?: string;
  net_payout_to_landlord: number;
  withholding_tax_5_percent?: number;
  landlord_withholding_tax_5_percent?: number;
  payment_method: string;
  proof_document_url?: string | null;
  created_at: string;
  contract_no?: string;
  unit_code?: string;
  project_name?: string;
  landlord_name?: string;
  tenant_name?: string;
}

export interface LeaseStatementData {
  lease: LeaseContract;
  unit: PropertyUnit | null;
  landlord: Contact | null;
  tenant: Contact | null;
  payments: RentalPayment[];
  unit_issues: UnitIssue[];
  summary: {
    months_recorded: number;
    contract_total_months?: number;
    landlord_payout_months_count?: number;
    landlord_11_months_gross_rent?: number;
    paid_months_count: number;
    pending_months_count: number;
    written_off_months_count: number;
    scheduled_contract_total: number;
    written_off_tenant_rent: number;
    written_off_landlord_rent: number;
    rental_wht_rate?: number;
    monthly_rental_wht_tenant?: number;
    monthly_rental_wht_landlord?: number;
    total_paid_rental_wht_tenant?: number;
    total_paid_rental_wht_landlord?: number;
    projected_contract_rental_wht?: number;
    landlord_11_months_wht?: number;
    total_base_rent: number;
    total_tenant_extra_charges: number;
    total_collected_from_tenant: number;
    security_deposit_held: number;
    landlord_monthly_rent: number;
    landlord_security_deposit: number;
    total_landlord_gross_rent: number;
    upfront_commission_deducted: number;
    total_landlord_repair_deductions: number;
    total_other_landlord_expenses: number;
    total_landlord_expenses: number;
    total_monthly_net_payouts: number;
    forfeited_deposit_payable_to_landlord: number;
    total_net_payout_to_landlord: number;
    monthly_rent_spread: number;
    agency_upfront_commission: number;
    agency_rent_spread_earned: number;
    agency_management_fees_earned: number;
    agency_repair_charges_billed: number;
    agency_forfeited_deposit_spread: number;
    agency_total_profit_earned: number;
    agency_projected_full_profit: number;
  };
}

export interface IssueDocument {
  url: string;
  name: string;
  doc_type?: 'Quotation' | 'Invoice / Receipt' | 'Warranty Claim' | 'Inspection Report' | 'Other' | string;
  size_bytes?: number;
  uploaded_at?: string;
}

export interface UnitIssue {
  id: number;
  ticket_no: string;
  unit_id: number;
  lease_id?: number | null;
  title: string;
  category: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent' | string;
  status: 'Open' | 'In Progress' | 'Waiting Developer/Parts' | 'Resolved' | 'Closed' | string;
  reported_by: string;
  responsible_party: 'Developer Warranty' | 'Landlord' | 'Tenant' | 'Building Juristic' | string;
  vendor_or_contractor?: string;
  description?: string;
  resolution_notes?: string;
  estimated_cost: number;
  actual_cost: number;
  reported_date: string;
  resolved_date?: string | null;
  issue_images?: string[];
  issue_documents?: IssueDocument[];
  created_at: string;
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
  created_at: string;
  contact_name?: string;
  developer_name?: string;
  unit_code?: string;
}

export interface DashboardData {
  metrics: {
    total_units: number;
    occupied_units: number;
    available_units: number;
    maintenance_units: number;
    occupancy_rate: number;
    active_leases_count: number;
    monthly_rent_volume: number;
    expiring_leases_count: number;
    open_issues_count: number;
    open_warranty_issues_count: number;
    landlords_count: number;
    tenants_count: number;
    developers_count: number;
  };
  expiring_leases: LeaseContract[];
  open_issues: UnitIssue[];
  recent_communications: CommunicationLog[];
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
  status: 'Active' | 'Suspended' | 'Inactive' | string;
  avatar_url?: string | null;
  last_login?: string;
  created_at?: string;
  permissions: FeaturePermissions;
}

export interface RoleMeta {
  name: string;
  department: string;
  badge: string;
  color: string;
  description: string;
}

export interface RolesMatrixData {
  roles: RoleMeta[];
  default_permissions: Record<string, FeaturePermissions>;
}

