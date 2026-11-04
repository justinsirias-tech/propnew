from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from database import Base


class Developer(Base):
    __tablename__ = "developers"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(150), nullable=False, index=True)
    contact_person = Column(String(120), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(120), nullable=True)
    line_id = Column(String(80), nullable=True)
    address = Column(Text, nullable=True)
    warranty_policy = Column(Text, nullable=True)
    defect_contact_info = Column(Text, nullable=True)
    tax_id = Column(String(60), nullable=True)
    corporate_employees = Column(Text, nullable=True)  # JSON array of corporate employees/representatives
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    units = relationship("PropertyUnit", back_populates="developer")
    communications = relationship("CommunicationLog", back_populates="developer", cascade="all, delete-orphan")


class Contact(Base):
    """Represents a Landlord, Tenant, Both, or Vendor in the CRM (Individual or Corporate)."""
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String(30), nullable=False, index=True)  # LANDLORD, TENANT, BOTH, VENDOR
    entity_type = Column(String(30), default="Individual")  # Individual, Corporate
    company_name = Column(String(180), nullable=True)       # Corporate company name if Corporate / Vendor
    tax_id = Column(String(60), nullable=True)              # Corporate Tax ID / Registration No.
    service_category = Column(String(100), nullable=True)   # For VENDOR: Air Conditioning, Plumbing, Electrical, etc.
    corporate_employees = Column(Text, nullable=True)       # JSON array of employees dealing with contracts on behalf of company
    full_name = Column(String(150), nullable=False, index=True)
    phone = Column(String(50), nullable=False)
    email = Column(String(120), nullable=True)
    line_or_whatsapp = Column(String(80), nullable=True)
    nationality = Column(String(60), nullable=True)
    id_or_passport = Column(String(80), nullable=True)
    bank_name = Column(String(120), nullable=True)
    bank_account_no = Column(String(100), nullable=True)
    bank_account_info = Column(Text, nullable=True)  # Legacy / combined bank info
    emergency_contact = Column(String(150), nullable=True)
    preferred_language = Column(String(50), default="English")
    rating = Column(Integer, default=5)  # 1-5 internal CRM rating
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    owned_units = relationship("PropertyUnit", back_populates="landlord", foreign_keys="PropertyUnit.landlord_id")
    landlord_leases = relationship("LeaseContract", back_populates="landlord", foreign_keys="LeaseContract.landlord_id")
    tenant_leases = relationship("LeaseContract", back_populates="tenant", foreign_keys="LeaseContract.tenant_id")
    communications = relationship("CommunicationLog", back_populates="contact", cascade="all, delete-orphan")


class PropertyUnit(Base):
    __tablename__ = "property_units"

    id = Column(Integer, primary_key=True, index=True)
    unit_code = Column(String(60), nullable=False, unique=True, index=True)  # e.g., A-1204
    project_name = Column(String(150), nullable=False, index=True)  # e.g., The Park Residence Sukhumvit
    city = Column(String(80), default="Bangkok", index=True)  # e.g., Bangkok, Phuket, Chonburi, Chiang Mai, Samut Prakan
    property_category = Column(String(40), default="Residential", index=True)  # Residential, Commercial
    property_type = Column(String(60), default="Condominium", index=True)  # Condominium, Townhouse (Gated), Townhouse (Non-Gated), Single Home (Gated), Single Home (Non-Gated), Land, Shophouse, Retail, Warehouse, Factory
    building = Column(String(50), nullable=True)
    floor = Column(String(20), nullable=True)
    bedrooms = Column(Integer, default=1)
    bathrooms = Column(Integer, default=1)
    size_sqm = Column(Float, default=35.0)
    furnishing = Column(String(50), default="Fully Furnished")  # Fully Furnished, Partly Furnished, Unfurnished
    status = Column(String(40), default="Available", index=True)  # Available, Occupied, Under Maintenance, Reserved
    listing_type = Column(String(40), default="Rent & Sale")  # For Rent, For Sale, Rent & Sale, Managed Only
    target_rent_price = Column(Float, default=0.0)
    target_sale_price = Column(Float, default=0.0)
    address = Column(Text, nullable=True)
    key_card_and_access_info = Column(String(200), nullable=True)
    meter_electric_no = Column(String(80), nullable=True)
    meter_water_no = Column(String(80), nullable=True)
    warranty_expiry_date = Column(String(20), nullable=True)  # YYYY-MM-DD (Developer defect liability end)
    image_url = Column(Text, nullable=True)
    gallery_images = Column(Text, nullable=True)  # JSON array of high-res image URLs
    notes = Column(Text, nullable=True)

    developer_id = Column(Integer, ForeignKey("developers.id"), nullable=True)
    landlord_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    developer = relationship("Developer", back_populates="units")
    landlord = relationship("Contact", back_populates="owned_units", foreign_keys=[landlord_id])
    leases = relationship("LeaseContract", back_populates="unit", cascade="all, delete-orphan")
    issues = relationship("UnitIssue", back_populates="unit", cascade="all, delete-orphan")
    communications = relationship("CommunicationLog", back_populates="unit", cascade="all, delete-orphan")


class LeaseContract(Base):
    __tablename__ = "lease_contracts"

    id = Column(Integer, primary_key=True, index=True)
    contract_no = Column(String(60), nullable=False, unique=True, index=True)
    unit_id = Column(Integer, ForeignKey("property_units.id"), nullable=False)
    landlord_id = Column(Integer, ForeignKey("contacts.id"), nullable=False)
    tenant_id = Column(Integer, ForeignKey("contacts.id"), nullable=False)

    start_date = Column(String(20), nullable=False)  # YYYY-MM-DD
    end_date = Column(String(20), nullable=False)    # YYYY-MM-DD
    monthly_rent = Column(Float, nullable=False)     # Tenant Contract Rent (collected from Tenant)
    has_rent_spread = Column(Integer, default=0)     # 1 = Agency takes a monthly rent difference, 0 = No difference
    landlord_monthly_rent = Column(Float, nullable=True)     # Reported Rent to Landlord (basis for commission, mgmt fee & landlord deposit)
    security_deposit = Column(Float, default=0.0)            # Security Deposit collected from Tenant (based on monthly_rent)
    landlord_security_deposit = Column(Float, nullable=True) # Security Deposit payable/reported to Landlord (based on landlord_monthly_rent)
    advance_rent = Column(Float, default=0.0)
    payment_due_day = Column(Integer, default=5)  # Day of month (1-28)
    agent_commission = Column(Float, default=0.0) # Deducted in advance at signing (based on landlord_monthly_rent)
    management_fee_percent = Column(Float, default=5.0)  # Monthly management fee % charged on landlord_monthly_rent
    commission_deducted_upfront = Column(Integer, default=1)
    deposit_forfeited = Column(Integer, default=0)       # 1 = Early termination deposit forfeited
    early_termination_date = Column(String(20), nullable=True)
    early_termination_note = Column(Text, nullable=True)
    status = Column(String(40), default="Active", index=True)  # Active, Expiring Soon, Expired, Terminated, Draft
    inventory_checklist_signed = Column(String(20), default="Yes")
    special_terms = Column(Text, nullable=True)
    document_url = Column(Text, nullable=True)
    documents = Column(Text, nullable=True)  # JSON array of uploaded lease documents
    created_at = Column(DateTime, default=datetime.utcnow)

    unit = relationship("PropertyUnit", back_populates="leases")
    landlord = relationship("Contact", back_populates="landlord_leases", foreign_keys=[landlord_id])
    tenant = relationship("Contact", back_populates="tenant_leases", foreign_keys=[tenant_id])
    issues = relationship("UnitIssue", back_populates="lease")
    payments = relationship("RentalPayment", back_populates="lease", cascade="all, delete-orphan", order_by="RentalPayment.billing_month.asc()")


class UnitIssue(Base):
    __tablename__ = "unit_issues"

    id = Column(Integer, primary_key=True, index=True)
    ticket_no = Column(String(50), nullable=False, unique=True, index=True)
    unit_id = Column(Integer, ForeignKey("property_units.id"), nullable=False)
    lease_id = Column(Integer, ForeignKey("lease_contracts.id"), nullable=True)

    title = Column(String(200), nullable=False)
    category = Column(String(60), default="Plumbing")  # Plumbing, Electrical, Air Conditioning, Structural/Defect, Appliance, Furniture, Pest Control, Other
    priority = Column(String(30), default="Medium")    # Low, Medium, High, Urgent
    status = Column(String(40), default="Open", index=True)  # Open, In Progress, Waiting Developer/Parts, Resolved, Closed

    reported_by = Column(String(60), default="Tenant")  # Tenant, Landlord, Agent Inspection, Juristic
    responsible_party = Column(String(60), default="Landlord")  # Developer Warranty, Landlord, Tenant, Building Juristic
    vendor_or_contractor = Column(String(150), nullable=True)

    description = Column(Text, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    estimated_cost = Column(Float, default=0.0)
    actual_cost = Column(Float, default=0.0)
    reported_date = Column(String(20), nullable=False)  # YYYY-MM-DD
    resolved_date = Column(String(20), nullable=True)   # YYYY-MM-DD
    issue_images = Column(Text, nullable=True)          # JSON array of high-res mobile/camera issue photo URLs
    issue_documents = Column(Text, nullable=True)       # JSON array of quotation/invoice/warranty document objects
    created_at = Column(DateTime, default=datetime.utcnow)

    unit = relationship("PropertyUnit", back_populates="issues")
    lease = relationship("LeaseContract", back_populates="issues")


class CommunicationLog(Base):
    __tablename__ = "communication_logs"

    id = Column(Integer, primary_key=True, index=True)
    channel = Column(String(40), default="Phone Call")  # Phone Call, LINE, WhatsApp, Email, In-Person, Inspection Note
    direction = Column(String(30), default="Outbound")  # Inbound, Outbound, Internal Note
    subject = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    logged_by = Column(String(100), default="Senior Agent")
    created_at = Column(DateTime, default=datetime.utcnow)

    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    developer_id = Column(Integer, ForeignKey("developers.id"), nullable=True)
    unit_id = Column(Integer, ForeignKey("property_units.id"), nullable=True)
    issue_id = Column(Integer, ForeignKey("unit_issues.id"), nullable=True)

    contact = relationship("Contact", back_populates="communications")
    developer = relationship("Developer", back_populates="communications")
    unit = relationship("PropertyUnit", back_populates="communications")


class RentalPayment(Base):
    __tablename__ = "rental_payments"

    id = Column(Integer, primary_key=True, index=True)
    receipt_no = Column(String(60), nullable=False, unique=True, index=True)
    lease_id = Column(Integer, ForeignKey("lease_contracts.id"), nullable=False, index=True)
    unit_id = Column(Integer, ForeignKey("property_units.id"), nullable=False, index=True)
    landlord_id = Column(Integer, ForeignKey("contacts.id"), nullable=False, index=True)
    tenant_id = Column(Integer, ForeignKey("contacts.id"), nullable=False, index=True)

    billing_month = Column(String(20), nullable=False)  # e.g., 2026-10
    due_date = Column(String(20), nullable=False)       # YYYY-MM-DD
    paid_date = Column(String(20), nullable=True)       # YYYY-MM-DD
    status = Column(String(40), default="Paid & Settled")  # Paid & Settled, Collected (Pending Payout), Pending, Overdue, Written Off

    base_rent = Column(Float, default=0.0)                 # Tenant Base Rent (e.g. 10,000)
    landlord_base_rent = Column(Float, default=0.0)        # Landlord Reported Base Rent (e.g. 9,000)
    rent_spread_agency = Column(Float, default=0.0)        # Agency Rent Difference (e.g. 1,000)
    tenant_extra_charges = Column(Float, default=0.0)      # Repair charges / utilities billed to Tenant
    tenant_charges_note = Column(Text, nullable=True)
    amount_collected_from_tenant = Column(Float, default=0.0)

    landlord_repair_deduction = Column(Float, default=0.0)  # Repair expenses charged to Landlord
    other_landlord_expenses = Column(Float, default=0.0)    # Monthly Mgmt fee (based on landlord_base_rent)
    expense_breakdown_note = Column(Text, nullable=True)    # Itemized repair ticket(s) & expense notes
    net_payout_to_landlord = Column(Float, default=0.0)     # Actual Net Payout left to Landlord (based on landlord_base_rent)

    payment_method = Column(String(50), default="Bank Transfer")
    proof_document_url = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    lease = relationship("LeaseContract", back_populates="payments")
    unit = relationship("PropertyUnit")
    landlord = relationship("Contact", foreign_keys=[landlord_id])
    tenant = relationship("Contact", foreign_keys=[tenant_id])


class AppUser(Base):
    __tablename__ = "app_users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(120), nullable=False)
    email = Column(String(120), unique=True, nullable=False, index=True)
    role = Column(String(60), default="Senior Leasing Agent")  # Super Admin, Branch Manager, Senior Leasing Agent, Junior Agent, Property Inspector, Accountant
    department = Column(String(80), default="Leasing & Sales")
    phone = Column(String(40), nullable=True)
    status = Column(String(20), default="Active")  # Active, Suspended, Inactive
    avatar_url = Column(String(255), nullable=True)
    last_login = Column(String(40), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    # JSON-encoded granular feature permissions dictionary
    permissions = Column(Text, nullable=True)


