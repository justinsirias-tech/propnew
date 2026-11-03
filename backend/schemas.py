from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


# --- Communication Logs ---
class CommunicationLogBase(BaseModel):
    channel: str = "Phone Call"
    direction: str = "Outbound"
    subject: str
    content: str
    logged_by: str = "Senior Agent"
    contact_id: Optional[int] = None
    developer_id: Optional[int] = None
    unit_id: Optional[int] = None
    issue_id: Optional[int] = None


class CommunicationLogCreate(CommunicationLogBase):
    pass


class CommunicationLogOut(CommunicationLogBase):
    id: int
    created_at: datetime
    contact_name: Optional[str] = None
    developer_name: Optional[str] = None
    unit_code: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# --- Corporate Employee / Representative ---
class CorporateEmployee(BaseModel):
    name: str
    title_or_department: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    line_or_whatsapp: Optional[str] = None
    is_primary: Optional[bool] = False
    notes: Optional[str] = None


# --- Developers ---
class DeveloperBase(BaseModel):
    company_name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    line_id: Optional[str] = None
    address: Optional[str] = None
    warranty_policy: Optional[str] = None
    defect_contact_info: Optional[str] = None
    tax_id: Optional[str] = None
    corporate_employees: Optional[List[CorporateEmployee]] = []
    notes: Optional[str] = None


class DeveloperCreate(DeveloperBase):
    pass


class DeveloperUpdate(DeveloperBase):
    pass


class DeveloperOut(DeveloperBase):
    id: int
    created_at: datetime
    unit_count: int = 0
    open_warranty_issues: int = 0

    model_config = ConfigDict(from_attributes=True)


# --- Contacts (Landlords, Tenants & Vendors) ---
class ContactBase(BaseModel):
    role: str  # LANDLORD, TENANT, BOTH, VENDOR
    entity_type: Optional[str] = "Individual"  # Individual, Corporate
    company_name: Optional[str] = None
    tax_id: Optional[str] = None
    service_category: Optional[str] = None
    corporate_employees: Optional[List[CorporateEmployee]] = []
    full_name: str
    phone: str
    email: Optional[str] = None
    line_or_whatsapp: Optional[str] = None
    nationality: Optional[str] = None
    id_or_passport: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_account_info: Optional[str] = None
    emergency_contact: Optional[str] = None
    preferred_language: Optional[str] = "English"
    rating: Optional[int] = 5
    notes: Optional[str] = None


class ContactCreate(ContactBase):
    pass


class ContactUpdate(ContactBase):
    pass


class ContactOut(ContactBase):
    id: int
    created_at: datetime
    owned_units_count: int = 0
    active_leases_count: int = 0
    vendor_jobs_count: int = 0

    model_config = ConfigDict(from_attributes=True)


# --- Property Units ---
class PropertyUnitBase(BaseModel):
    unit_code: str
    project_name: str
    city: str = "Bangkok"
    property_category: str = "Residential"
    property_type: str = "Condominium"
    building: Optional[str] = None
    floor: Optional[str] = None
    bedrooms: int = 1
    bathrooms: int = 1
    size_sqm: float = 35.0
    furnishing: str = "Fully Furnished"
    status: str = "Available"
    listing_type: str = "Rent & Sale"
    target_rent_price: float = 0.0
    target_sale_price: float = 0.0
    address: Optional[str] = None
    key_card_and_access_info: Optional[str] = None
    meter_electric_no: Optional[str] = None
    meter_water_no: Optional[str] = None
    warranty_expiry_date: Optional[str] = None
    image_url: Optional[str] = None
    gallery_images: Optional[List[str]] = []
    notes: Optional[str] = None
    developer_id: Optional[int] = None
    landlord_id: Optional[int] = None


class PropertyUnitCreate(PropertyUnitBase):
    pass


class PropertyUnitUpdate(PropertyUnitBase):
    pass


class PropertyUnitOut(PropertyUnitBase):
    id: int
    created_at: datetime
    rent_per_sqm: float = 0.0
    sale_per_sqm: float = 0.0
    developer_name: Optional[str] = None
    landlord_name: Optional[str] = None
    landlord_phone: Optional[str] = None
    current_tenant_name: Optional[str] = None
    current_lease_id: Optional[int] = None
    current_lease_end: Optional[str] = None
    open_issues_count: int = 0
    total_issues_count: int = 0

    model_config = ConfigDict(from_attributes=True)


# --- Lease Contracts ---
class LeaseDocument(BaseModel):
    url: str
    name: str
    doc_type: Optional[str] = "Signed Contract"
    size_bytes: Optional[int] = 0
    uploaded_at: Optional[str] = None


class LeaseContractBase(BaseModel):
    contract_no: str
    unit_id: int
    landlord_id: int
    tenant_id: int
    start_date: str
    end_date: str
    monthly_rent: float
    has_rent_spread: Optional[int] = 0
    landlord_monthly_rent: Optional[float] = None
    security_deposit: float = 0.0
    landlord_security_deposit: Optional[float] = None
    advance_rent: float = 0.0
    payment_due_day: int = 5
    agent_commission: float = 0.0
    management_fee_percent: Optional[float] = 5.0
    commission_deducted_upfront: Optional[int] = 1
    deposit_forfeited: Optional[int] = 0
    early_termination_date: Optional[str] = None
    early_termination_note: Optional[str] = None
    status: str = "Active"
    inventory_checklist_signed: str = "Yes"
    special_terms: Optional[str] = None
    document_url: Optional[str] = None
    documents: Optional[List[LeaseDocument]] = []


class LeaseContractCreate(LeaseContractBase):
    pass


class LeaseContractUpdate(LeaseContractBase):
    pass


class LeaseTermsQuickUpdate(BaseModel):
    start_date: str
    end_date: str
    monthly_rent: float
    has_rent_spread: Optional[int] = 0
    landlord_monthly_rent: Optional[float] = None
    security_deposit: float
    landlord_security_deposit: Optional[float] = None
    agent_commission: Optional[float] = None
    management_fee_percent: Optional[float] = 5.0
    payment_due_day: Optional[int] = 5
    status: Optional[str] = None


class EarlyTerminationPayload(BaseModel):
    early_termination_date: str
    early_termination_note: Optional[str] = None
    forfeit_deposit: bool = True


class LeaseContractOut(LeaseContractBase):
    id: int
    created_at: datetime
    unit_code: Optional[str] = None
    project_name: Optional[str] = None
    landlord_name: Optional[str] = None
    landlord_phone: Optional[str] = None
    landlord_bank_name: Optional[str] = None
    landlord_bank_account_no: Optional[str] = None
    tenant_name: Optional[str] = None
    tenant_phone: Optional[str] = None
    days_remaining: Optional[int] = None
    payments_count: int = 0
    paid_months_count: int = 0
    written_off_months_count: int = 0
    monthly_rent_spread: float = 0.0
    total_collected_from_tenant: float = 0.0
    total_landlord_expenses: float = 0.0
    total_net_landlord_profit: float = 0.0
    total_agency_profit: float = 0.0

    model_config = ConfigDict(from_attributes=True)


# --- Rental Payments & Statement of Account ---
class RentalPaymentBase(BaseModel):
    receipt_no: str
    lease_id: int
    unit_id: int
    landlord_id: int
    tenant_id: int
    billing_month: str
    due_date: str
    paid_date: Optional[str] = None
    status: str = "Paid & Settled"
    base_rent: float = 0.0
    landlord_base_rent: Optional[float] = 0.0
    rent_spread_agency: Optional[float] = 0.0
    tenant_extra_charges: float = 0.0
    tenant_charges_note: Optional[str] = None
    amount_collected_from_tenant: float = 0.0
    landlord_repair_deduction: float = 0.0
    other_landlord_expenses: float = 0.0
    expense_breakdown_note: Optional[str] = None
    net_payout_to_landlord: float = 0.0
    withholding_tax_5_percent: Optional[float] = 0.0
    landlord_withholding_tax_5_percent: Optional[float] = 0.0
    payment_method: str = "Bank Transfer"
    proof_document_url: Optional[str] = None


class RentalPaymentCreate(RentalPaymentBase):
    pass


class RentalPaymentUpdate(RentalPaymentBase):
    pass


class RentalPaymentQuickUpdate(BaseModel):
    status: Optional[str] = None
    paid_date: Optional[str] = None
    proof_document_url: Optional[str] = None
    payment_method: Optional[str] = None
    base_rent: Optional[float] = None
    landlord_base_rent: Optional[float] = None
    rent_spread_agency: Optional[float] = None
    tenant_extra_charges: Optional[float] = None
    tenant_charges_note: Optional[str] = None
    landlord_repair_deduction: Optional[float] = None
    other_landlord_expenses: Optional[float] = None
    expense_breakdown_note: Optional[str] = None


class RentalPaymentOut(RentalPaymentBase):
    id: int
    created_at: datetime
    contract_no: Optional[str] = None
    unit_code: Optional[str] = None
    project_name: Optional[str] = None
    landlord_name: Optional[str] = None
    tenant_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# --- Unit Issues ---
class IssueDocument(BaseModel):
    url: str
    name: str
    doc_type: Optional[str] = "Quotation"  # Quotation, Invoice / Receipt, Warranty Claim, Inspection Report, Other
    size_bytes: Optional[int] = 0
    uploaded_at: Optional[str] = None


class UnitIssueBase(BaseModel):
    ticket_no: str
    unit_id: int
    lease_id: Optional[int] = None
    title: str
    category: str = "Plumbing"
    priority: str = "Medium"
    status: str = "Open"
    reported_by: str = "Tenant"
    responsible_party: str = "Landlord"
    vendor_or_contractor: Optional[str] = None
    description: Optional[str] = None
    resolution_notes: Optional[str] = None
    estimated_cost: float = 0.0
    actual_cost: float = 0.0
    reported_date: str
    resolved_date: Optional[str] = None
    issue_images: Optional[List[str]] = []
    issue_documents: Optional[List[IssueDocument]] = []


class UnitIssueCreate(UnitIssueBase):
    pass


class UnitIssueUpdate(UnitIssueBase):
    pass


class UnitIssueOut(UnitIssueBase):
    id: int
    created_at: datetime
    unit_code: Optional[str] = None
    project_name: Optional[str] = None
    developer_name: Optional[str] = None
    landlord_name: Optional[str] = None
    tenant_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# --- User & Feature Permission RBAC ---
class AppUserBase(BaseModel):
    full_name: str
    email: str
    role: str = "Senior Leasing Agent"
    department: str = "Leasing & Sales"
    phone: Optional[str] = None
    status: str = "Active"
    avatar_url: Optional[str] = None


class AppUserCreate(AppUserBase):
    permissions: Optional[Dict[str, Any]] = None


class AppUserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    avatar_url: Optional[str] = None
    permissions: Optional[Dict[str, Any]] = None


class AppUserPermissionsUpdate(BaseModel):
    permissions: Dict[str, Any]


class AppUserOut(AppUserBase):
    id: int
    last_login: Optional[str] = None
    created_at: datetime
    permissions: Dict[str, Any] = {}

    model_config = ConfigDict(from_attributes=True)

