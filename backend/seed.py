from datetime import date, timedelta
import json as _json
from sqlalchemy.orm import Session
from models import Developer, Contact, PropertyUnit, LeaseContract, UnitIssue, CommunicationLog, RentalPayment, AppUser


def seed_database(db: Session):
    if db.query(Developer).count() > 0:
        return

    today = date.today()

    # 1. Developers
    dev1 = Developer(
        company_name="Sansiri Public Co., Ltd.",
        contact_person="Khun Nattapong (After-Sales & Defect Team)",
        phone="+66 2 201 3999",
        email="homecare@sansiri.com",
        line_id="@sansirihomecare",
        address="59 Soi Rim Khlong Phra Khanong, Watthana, Bangkok 10110",
        warranty_policy="2-Year Building & System Warranty, 5-Year Structural Warranty from handover date.",
        defect_contact_info="Submit via Home Service App or call Defect Desk Ext. 402. SLA: 48 hrs inspection.",
        notes="Very responsive on structural & pipe leak claims within warranty period."
    )
    dev2 = Developer(
        company_name="AP Thailand PCL",
        contact_person="Khun Siriporn (Smart Care Coordinator)",
        phone="+66 2 261 2518",
        email="smartcare@apthai.com",
        line_id="@apthaicare",
        address="170/57 Ocean Tower 1, Ratchadaphisek Rd, Khlong Toei, Bangkok",
        warranty_policy="1-Year Interior & MEP Warranty, 5-Year Structural Warranty.",
        defect_contact_info="Coordinate with Juristic Office on G Floor before scheduling developer technician.",
        notes="Requires landlord signed authorization form if agent files defect claim on owner's behalf."
    )
    dev3 = Developer(
        company_name="Origin Property PCL",
        contact_person="Khun Worawut (Origin Care)",
        phone="+66 2 030 0000",
        email="care@origin.co.th",
        line_id="@origincare",
        address="496 Moo 9, Samrong Nuea, Mueang Samut Prakan",
        warranty_policy="2-Year Unit Defect Warranty (Smart Automation included for 1 year).",
        defect_contact_info="Line Official @origincare with Unit Code & defect photos.",
        notes="Specializes in duplex/loft units; digital door lock vendor is Yale Thailand."
    )
    db.add_all([dev1, dev2, dev3])
    db.flush()

    # 2. Contacts (Landlords & Tenants)
    ll1 = Contact(
        role="LANDLORD",
        full_name="Somchai Charoenpong",
        phone="+66 81 442 9910",
        email="somchai.invest@gmail.com",
        line_or_whatsapp="somchai_bkk",
        nationality="Thai",
        id_or_passport="1-1004-00892-12-9",
        bank_account_info="Kasikorn Bank (KBank) | Acc: 045-2-99182-4 | Name: Somchai Charoenpong",
        emergency_contact="Wipa Charoenpong (+66 81 442 9911)",
        preferred_language="Thai / English",
        rating=5,
        notes="Portfolio investor owning 3 units. Approves repairs under 3,000 THB automatically without prior quote."
    )
    ll2 = Contact(
        role="LANDLORD",
        full_name="Marcus Vance",
        phone="+65 9182 3340",
        email="marcus.vance@sgcapital.com",
        line_or_whatsapp="WhatsApp: +65 9182 3340",
        nationality="Singaporean",
        id_or_passport="E8829104C",
        bank_account_info="Bangkok Bank | Acc: 101-9-44821-0 | Name: Marcus Vance",
        emergency_contact="Elena Vance (+65 9182 3399)",
        preferred_language="English",
        rating=5,
        notes="Overseas landlord based in Singapore. Needs monthly photo inspection report when unit is vacant and written quotes for all repairs."
    )
    ll3 = Contact(
        role="BOTH",
        full_name="Lin Mei-Ling",
        phone="+66 89 771 2300",
        email="meiling.lin@outlook.com",
        line_or_whatsapp="meiling_88",
        nationality="Taiwanese",
        id_or_passport="309918271",
        bank_account_info="SCB (Siam Commercial Bank) | Acc: 408-1-22910-7 | Name: Lin Mei-Ling",
        emergency_contact="David Lin (+886 912 345 678)",
        preferred_language="Mandarin / English",
        rating=4,
        notes="Rents out her Thonglor 1BR unit while leasing a larger 3BR penthouse for her family."
    )

    tn1 = Contact(
        role="TENANT",
        full_name="Alexander Wright",
        phone="+66 62 310 8841",
        email="alex.wright@techglobal.io",
        line_or_whatsapp="alexwright_uk",
        nationality="British",
        id_or_passport="549201829",
        bank_account_info="HSBC / KBank for Deposit Refund: 092-8-11204-1",
        emergency_contact="HR Dept TechGlobal (+66 2 118 9000)",
        preferred_language="English",
        rating=5,
        notes="Corporate expat lease. Always pays rent 3 days early. Very neat tenant."
    )
    tn2 = Contact(
        role="TENANT",
        full_name="Kenji Takahashi",
        phone="+66 95 882 1044",
        email="k.takahashi@mitsui-auto.co.jp",
        line_or_whatsapp="kenji_bkk",
        nationality="Japanese",
        id_or_passport="TK9928172",
        bank_account_info="MUFG / Krungsri Bank: 772-1-09281-3",
        emergency_contact="J-Desk Relocation (+66 2 259 0011)",
        preferred_language="Japanese / English",
        rating=5,
        notes="Company-sponsored lease expiring soon. Interested in 1-year renewal if AC overhaul is completed."
    )
    tn3 = Contact(
        role="TENANT",
        full_name="Chloé Laurent",
        phone="+66 84 119 5520",
        email="chloe.laurent@designstudio.fr",
        line_or_whatsapp="chloelaurent",
        nationality="French",
        id_or_passport="21FR88410",
        bank_account_info="Bangkok Bank: 204-0-88192-5",
        emergency_contact="Pierre Laurent (+33 6 12 34 56 78)",
        preferred_language="English / French",
        rating=4,
        notes="Has 1 small cat (approved in special lease addendum with extra pet deposit)."
    )

    db.add_all([ll1, ll2, ll3, tn1, tn2, tn3])
    db.flush()

    # 3. Property Units
    u1 = PropertyUnit(
        unit_code="XT-A1804",
        project_name="XT Ekkamai",
        city="Bangkok",
        property_category="Residential",
        property_type="Condominium",
        building="Tower A",
        floor="18",
        bedrooms=1,
        bathrooms=1,
        size_sqm=38.5,
        furnishing="Fully Furnished",
        status="Occupied",
        listing_type="For Rent",
        target_rent_price=26000,
        target_sale_price=6200000,
        address="Sukhumvit Soi 63 (Ekkamai), Watthana, Bangkok",
        key_card_and_access_info="2 Keycards (#104, #105), Yale PIN: *8821#, Mailbox Key #1804",
        meter_electric_no="MEA-8829104",
        meter_water_no="JUR-1804A",
        warranty_expiry_date=(today + timedelta(days=240)).isoformat(),
        image_url="https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80",
        notes="Unblocked city view, Bosch washer-dryer installed Dec last year.",
        developer_id=dev1.id,
        landlord_id=ll1.id
    )
    u2 = PropertyUnit(
        unit_code="LIFE-B2409",
        project_name="Life Asoke Hype",
        city="Bangkok",
        property_category="Residential",
        property_type="Condominium",
        building="Building B",
        floor="24",
        bedrooms=2,
        bathrooms=2,
        size_sqm=55.0,
        furnishing="Fully Furnished",
        status="Occupied",
        listing_type="Rent & Sale",
        target_rent_price=35000,
        target_sale_price=8400000,
        address="Asoke-Din Daeng Rd, Makkasan, Ratchathewi, Bangkok",
        key_card_and_access_info="2 Keycards, FaceScan registered with Juristic, Digital Lock",
        meter_electric_no="MEA-4410298",
        meter_water_no="JUR-2409B",
        warranty_expiry_date=(today - timedelta(days=60)).isoformat(),
        image_url="https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80",
        notes="Corner unit. Developer warranty recently expired; landlord covers standard wear & tear.",
        developer_id=dev2.id,
        landlord_id=ll2.id
    )
    u3 = PropertyUnit(
        unit_code="PARK-C3102",
        project_name="Park Origin Thonglor",
        city="Bangkok",
        property_category="Residential",
        property_type="Condominium",
        building="Tower C",
        floor="31",
        bedrooms=2,
        bathrooms=2,
        size_sqm=64.0,
        furnishing="Fully Furnished",
        status="Occupied",
        listing_type="For Rent",
        target_rent_price=58000,
        target_sale_price=16500000,
        address="Thonglor Soi 10, Sukhumvit 55, Watthana, Bangkok",
        key_card_and_access_info="3 Keycards, Home Automation Tablet on wall",
        meter_electric_no="MEA-9930112",
        meter_water_no="JUR-3102C",
        warranty_expiry_date=(today + timedelta(days=410)).isoformat(),
        image_url="https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80",
        notes="High-floor luxury duo-space unit. Still under Origin 2-year structural & MEP warranty.",
        developer_id=dev3.id,
        landlord_id=ll1.id
    )
    u4 = PropertyUnit(
        unit_code="MONI-A0912",
        project_name="The Monument Thonglor",
        city="Bangkok",
        property_category="Residential",
        property_type="Condominium",
        building="Main Tower",
        floor="9",
        bedrooms=3,
        bathrooms=4,
        size_sqm=124.5,
        furnishing="Fully Furnished",
        status="Under Maintenance",
        listing_type="Rent & Sale",
        target_rent_price=110000,
        target_sale_price=34900000,
        address="998 Sukhumvit 55 (Thonglor), Khlong Tan Nuea, Watthana, Bangkok",
        key_card_and_access_info="Private Lift Keycards x3 held at Agent Office Vault #12",
        meter_electric_no="MEA-7721900",
        meter_water_no="JUR-0912",
        warranty_expiry_date=(today + timedelta(days=95)).isoformat(),
        image_url="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80",
        notes="Private lift lobby. Undergoing parquet floor polishing & developer warranty window seal fix before next tenant.",
        developer_id=dev1.id,
        landlord_id=ll3.id
    )
    u5 = PropertyUnit(
        unit_code="RHY-1508",
        project_name="Rhythm Phrom Phong",
        city="Bangkok",
        property_category="Residential",
        property_type="Condominium",
        building="North Wing",
        floor="15",
        bedrooms=1,
        bathrooms=1,
        size_sqm=42.0,
        furnishing="Fully Furnished",
        status="Available",
        listing_type="Rent & Sale",
        target_rent_price=29000,
        target_sale_price=7100000,
        address="Sukhumvit Soi 39, Khlong Tan Nuea, Watthana, Bangkok",
        key_card_and_access_info="Agent Lockbox at Juristic Lobby (#0491)",
        meter_electric_no="MEA-5519201",
        meter_water_no="JUR-1508",
        warranty_expiry_date=(today - timedelta(days=300)).isoformat(),
        image_url="https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=80",
        notes="Deep-cleaned and staged. Ready for immediate move-in or viewing.",
        developer_id=dev2.id,
        landlord_id=ll2.id
    )

    db.add_all([u1, u2, u3, u4, u5])
    db.flush()

    # 4. Lease Contracts
    lc1 = LeaseContract(
        contract_no="LC-2026-001",
        unit_id=u1.id,
        landlord_id=ll1.id,
        tenant_id=tn1.id,
        start_date=(today - timedelta(days=180)).isoformat(),
        end_date=(today + timedelta(days=185)).isoformat(),
        monthly_rent=26000,
        security_deposit=52000,
        advance_rent=26000,
        payment_due_day=5,
        agent_commission=26000,
        status="Active",
        inventory_checklist_signed="Yes",
        special_terms="Includes 1 parking slot sticker and quarterly AC cleaning covered by landlord.",
        document_url="https://example.com/contracts/LC-2026-001.pdf"
    )
    lc2 = LeaseContract(
        contract_no="LC-2025-089",
        unit_id=u2.id,
        landlord_id=ll2.id,
        tenant_id=tn2.id,
        start_date=(today - timedelta(days=335)).isoformat(),
        end_date=(today + timedelta(days=30)).isoformat(),  # Expiring in 30 days!
        monthly_rent=35000,
        security_deposit=70000,
        advance_rent=35000,
        payment_due_day=1,
        agent_commission=35000,
        status="Expiring Soon",
        inventory_checklist_signed="Yes",
        special_terms="Corporate lease with Mitsui Auto Thailand. 30-day renewal notice required.",
        document_url="https://example.com/contracts/LC-2025-089.pdf"
    )
    lc3 = LeaseContract(
        contract_no="LC-2026-014",
        unit_id=u3.id,
        landlord_id=ll1.id,
        tenant_id=tn3.id,
        start_date=(today - timedelta(days=90)).isoformat(),
        end_date=(today + timedelta(days=275)).isoformat(),
        monthly_rent=58000,
        security_deposit=116000,
        advance_rent=58000,
        payment_due_day=5,
        agent_commission=58000,
        status="Active",
        inventory_checklist_signed="Yes",
        special_terms="Pet addendum signed (1 indoor cat permitted; tenant liable for sofa fabric professional steam clean at checkout).",
        document_url="https://example.com/contracts/LC-2026-014.pdf"
    )

    db.add_all([lc1, lc2, lc3])
    db.flush()

    # 5. Unit Issues (Rich CRM History across units, landlords, tenants, and developer defects)
    iss1 = UnitIssue(
        ticket_no="ISS-1001",
        unit_id=u3.id,
        lease_id=lc3.id,
        title="Master Bathroom Rain Shower Concealed Pipe Seepage",
        category="Structural/Defect",
        priority="High",
        status="Waiting Developer/Parts",
        reported_by="Tenant",
        responsible_party="Developer Warranty",
        vendor_or_contractor="Origin Care Defect Engineering Team",
        description="Moisture buildup and minor water seepage behind master bathroom marble tile wall when rain shower is used.",
        resolution_notes="Origin Care inspected on Tuesday. Covered 100% under 2-year MEP defect warranty. Replacement valve & tile seal scheduled for Friday 10:00 AM.",
        estimated_cost=8500,
        actual_cost=0,
        reported_date=(today - timedelta(days=5)).isoformat(),
        resolved_date=None
    )
    iss2 = UnitIssue(
        ticket_no="ISS-1002",
        unit_id=u2.id,
        lease_id=lc2.id,
        title="Living Room Daikin Inverter AC Error Code U4 & Low Cooling",
        category="Air Conditioning",
        priority="Urgent",
        status="In Progress",
        reported_by="Tenant",
        responsible_party="Landlord",
        vendor_or_contractor="CoolBKK Air Conditioning Service",
        description="Tenant reported living room AC blinking green light (Error U4) and blowing warm air. Needs fix prior to lease renewal signing.",
        resolution_notes="Technician diagnosed faulty control board & refrigerant top-up needed. Landlord Marcus approved 3,800 THB quote via WhatsApp.",
        estimated_cost=3800,
        actual_cost=3800,
        reported_date=(today - timedelta(days=2)).isoformat(),
        resolved_date=None
    )
    iss3 = UnitIssue(
        ticket_no="ISS-1003",
        unit_id=u4.id,
        lease_id=None,
        title="Balcony Double-Glazed Sliding Door Acoustic Seal Gap",
        category="Structural/Defect",
        priority="Medium",
        status="Open",
        reported_by="Agent Inspection",
        responsible_party="Developer Warranty",
        vendor_or_contractor="Sansiri HomeCare Team",
        description="During pre-marketing inspection, noticed wind whistling noise through the rubber gasket on the main balcony sliding door.",
        resolution_notes="Logged ticket #SS-99218 on Sansiri Home Service App before warranty expires in 95 days.",
        estimated_cost=4500,
        actual_cost=0,
        reported_date=(today - timedelta(days=3)).isoformat(),
        resolved_date=None
    )
    iss4 = UnitIssue(
        ticket_no="ISS-0994",
        unit_id=u1.id,
        lease_id=lc1.id,
        title="Kitchen Under-Sink P-Trap Replacement & Drain Clearing",
        category="Plumbing",
        priority="Medium",
        status="Resolved",
        reported_by="Tenant",
        responsible_party="Landlord",
        vendor_or_contractor="Juristic Building Technician",
        description="Slow drainage and minor drip under kitchen sink cabinet.",
        resolution_notes="Replaced worn silicone gasket and P-trap. Auto-approved under Landlord Somchai's <3,000 THB policy.",
        estimated_cost=1200,
        actual_cost=1150,
        reported_date=(today - timedelta(days=28)).isoformat(),
        resolved_date=(today - timedelta(days=27)).isoformat()
    )
    iss5 = UnitIssue(
        ticket_no="ISS-0988",
        unit_id=u3.id,
        lease_id=lc3.id,
        title="Wine Fridge Thermostat Sensor Replacement",
        category="Appliance",
        priority="Low",
        status="Resolved",
        reported_by="Tenant",
        responsible_party="Tenant",
        vendor_or_contractor="Electrolux Official Service",
        description="Door left ajar over weekend causing ice buildup and sensor fault.",
        resolution_notes="Tenant covered service call fee of 1,500 THB directly.",
        estimated_cost=1500,
        actual_cost=1500,
        reported_date=(today - timedelta(days=45)).isoformat(),
        resolved_date=(today - timedelta(days=42)).isoformat()
    )

    db.add_all([iss1, iss2, iss3, iss4, iss5])
    db.flush()

    # 6. CRM Communication Logs
    logs = [
        CommunicationLog(
            channel="LINE",
            direction="Outbound",
            subject="Defect Warranty Inspection Scheduled for PARK-C3102",
            content="Sent inspection photos and Origin Care confirmation (Friday 10:00 AM) to Landlord Khun Somchai and Tenant Chloé. Zero cost to landlord as covered by developer warranty.",
            logged_by="Nadia (Property Manager)",
            contact_id=ll1.id,
            developer_id=dev3.id,
            unit_id=u3.id,
            issue_id=iss1.id
        ),
        CommunicationLog(
            channel="WhatsApp",
            direction="Inbound",
            subject="Approval for AC Control Board Repair & Lease Renewal Terms",
            content="Landlord Marcus Vance approved the 3,800 THB AC repair quote for LIFE-B2409 and confirmed he is happy to keep rent at 35,000 THB/month if Tenant Kenji renews for another 12 months.",
            logged_by="Alex (Senior Leasing Agent)",
            contact_id=ll2.id,
            unit_id=u2.id,
            issue_id=iss2.id
        ),
        CommunicationLog(
            channel="Phone Call",
            direction="Outbound",
            subject="1-Year Lease Renewal Discussion with Tenant Kenji",
            content="Spoke with Kenji and Mitsui HR coordinator. They want to extend LC-2025-089 for 1 year starting next month once the living room AC repair is verified tomorrow.",
            logged_by="Alex (Senior Leasing Agent)",
            contact_id=tn2.id,
            unit_id=u2.id
        ),
        CommunicationLog(
            channel="Inspection Note",
            direction="Internal Note",
            subject="Pre-Listing Defect Audit for MONI-A0912",
            content="Completed 40-point inspection with Developer Sansiri HomeCare engineer. Balcony acoustic seal claim accepted under developer warranty.",
            logged_by="Nadia (Property Manager)",
            contact_id=ll3.id,
            developer_id=dev1.id,
            unit_id=u4.id,
            issue_id=iss3.id
        )
    ]
    db.add_all(logs)
    db.commit()


def ensure_taxonomy_migration(db: Session):
    """Upgrades existing SQLite schema and seeds sample Gated Home & Commercial units if not present."""
    from sqlalchemy import text
    today = date.today()

    try:
        db.execute(text("ALTER TABLE property_units ADD COLUMN city VARCHAR(80) DEFAULT 'Bangkok'"))
        db.commit()
    except Exception:
        db.rollback()

    try:
        db.execute(text("ALTER TABLE property_units ADD COLUMN property_category VARCHAR(40) DEFAULT 'Residential'"))
        db.commit()
    except Exception:
        db.rollback()

    try:
        db.execute(text("ALTER TABLE contacts ADD COLUMN bank_name VARCHAR(120)"))
        db.commit()
    except Exception:
        db.rollback()

    try:
        db.execute(text("ALTER TABLE contacts ADD COLUMN bank_account_no VARCHAR(100)"))
        db.commit()
    except Exception:
        db.rollback()

    try:
        db.execute(text("ALTER TABLE property_units ADD COLUMN gallery_images TEXT"))
        db.commit()
    except Exception:
        db.rollback()

    try:
        db.execute(text("ALTER TABLE lease_contracts ADD COLUMN documents TEXT"))
        db.commit()
    except Exception:
        db.rollback()

    for alter_sql in [
        "ALTER TABLE lease_contracts ADD COLUMN has_rent_spread INTEGER DEFAULT 0",
        "ALTER TABLE lease_contracts ADD COLUMN landlord_monthly_rent FLOAT",
        "ALTER TABLE lease_contracts ADD COLUMN landlord_security_deposit FLOAT",
        "ALTER TABLE lease_contracts ADD COLUMN management_fee_percent FLOAT DEFAULT 5.0",
        "ALTER TABLE lease_contracts ADD COLUMN commission_deducted_upfront INTEGER DEFAULT 1",
        "ALTER TABLE lease_contracts ADD COLUMN deposit_forfeited INTEGER DEFAULT 0",
        "ALTER TABLE lease_contracts ADD COLUMN early_termination_date VARCHAR(20)",
        "ALTER TABLE lease_contracts ADD COLUMN early_termination_note TEXT",
        "ALTER TABLE rental_payments ADD COLUMN landlord_base_rent FLOAT DEFAULT 0.0",
        "ALTER TABLE rental_payments ADD COLUMN rent_spread_agency FLOAT DEFAULT 0.0",
        "ALTER TABLE unit_issues ADD COLUMN issue_images TEXT",
        "ALTER TABLE unit_issues ADD COLUMN issue_documents TEXT",
        "ALTER TABLE contacts ADD COLUMN entity_type VARCHAR(30) DEFAULT 'Individual'",
        "ALTER TABLE contacts ADD COLUMN company_name VARCHAR(180)",
        "ALTER TABLE contacts ADD COLUMN tax_id VARCHAR(60)",
        "ALTER TABLE contacts ADD COLUMN service_category VARCHAR(100)",
        "ALTER TABLE contacts ADD COLUMN corporate_employees TEXT",
        "ALTER TABLE developers ADD COLUMN tax_id VARCHAR(60)",
        "ALTER TABLE developers ADD COLUMN corporate_employees TEXT",
    ]:
        try:
            db.execute(text(alter_sql))
            db.commit()
        except Exception:
            db.rollback()

    # Normalize legacy 'Condo' to 'Condominium' and fill null city/category
    units = db.query(PropertyUnit).all()
    for u in units:
        if not u.city:
            u.city = "Bangkok"
        if not u.property_category:
            u.property_category = "Residential"
        if u.property_type == "Condo":
            u.property_type = "Condominium"
    db.commit()

    # Add sample Single Home (Gated), Townhouse (Gated), Shophouse, and Warehouse if not yet seeded
    if not db.query(PropertyUnit).filter(PropertyUnit.unit_code == "BUR-H08").first():
        dev1 = db.query(Developer).first()
        dev2 = db.query(Developer).offset(1).first()
        ll1 = db.query(Contact).filter(Contact.role.in_(["LANDLORD", "BOTH"])).first()
        ll2 = db.query(Contact).filter(Contact.role.in_(["LANDLORD", "BOTH"])).offset(1).first()

        extra_units = [
            PropertyUnit(
                unit_code="BUR-H08",
                project_name="Burasiri Phuket Koh Kaew",
                city="Phuket",
                property_category="Residential",
                property_type="Single Home (Gated)",
                building="Phase 1 (Gated Zone)",
                floor="2 Storeys",
                bedrooms=4,
                bathrooms=5,
                size_sqm=310.0,
                furnishing="Fully Furnished",
                status="Available",
                listing_type="Rent & Sale",
                target_rent_price=145000,
                target_sale_price=28500000,
                address="Koh Kaew, Mueang Phuket, Phuket 83000",
                key_card_and_access_info="24/7 Gated Security, EasyPass Sticker x2, Digital Gate Remote",
                meter_electric_no="PEA-8839201",
                meter_water_no="PWA-0082",
                warranty_expiry_date=(today + timedelta(days=520)).isoformat(),
                image_url="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
                notes="Private salt-chlorinator pool villa inside gated community near British International School.",
                developer_id=dev1.id if dev1 else None,
                landlord_id=ll1.id if ll1 else None,
            ),
            PropertyUnit(
                unit_code="DEMI-T14",
                project_name="Demi Sukhumvit 31",
                city="Bangkok",
                property_category="Residential",
                property_type="Townhouse (Gated)",
                building="Gated Cluster B",
                floor="3.5 Storeys",
                bedrooms=3,
                bathrooms=4,
                size_sqm=245.0,
                furnishing="Partly Furnished",
                status="Available",
                listing_type="For Rent",
                target_rent_price=95000,
                target_sale_price=29900000,
                address="Sukhumvit Soi 31, Watthana, Bangkok",
                key_card_and_access_info="Gated License Plate Recognition, Home Lift Key, Yale Lock",
                meter_electric_no="MEA-3391024",
                meter_water_no="MWA-3114",
                warranty_expiry_date=(today + timedelta(days=310)).isoformat(),
                image_url="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80",
                notes="Luxury 3.5-storey gated townhome with private Schindler home elevator and EV charger.",
                developer_id=dev1.id if dev1 else None,
                landlord_id=ll2.id if ll2 else None,
            ),
            PropertyUnit(
                unit_code="WH-BN04",
                project_name="Bangna Logistics Park KM.19",
                city="Samut Prakan",
                property_category="Commercial",
                property_type="Warehouse",
                building="Zone C Heavy Load",
                floor="10m Clear Height",
                bedrooms=0,
                bathrooms=2,
                size_sqm=1200.0,
                furnishing="Unfurnished",
                status="Available",
                listing_type="For Rent",
                target_rent_price=192000,
                target_sale_price=42000000,
                address="Bangna-Trad Rd KM.19, Bang Chalong, Bang Phli, Samut Prakan",
                key_card_and_access_info="Industrial Security Gate Pass, Roller Shutter Master Keys x3",
                meter_electric_no="MEA-3PHASE-901",
                meter_water_no="IND-04C",
                warranty_expiry_date=(today + timedelta(days=180)).isoformat(),
                image_url="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80",
                notes="3 tons/sqm floor loading, 2 raised loading docks with levelers, 2-storey mezzanine office included.",
                developer_id=dev2.id if dev2 else None,
                landlord_id=ll1.id if ll1 else None,
            ),
            PropertyUnit(
                unit_code="SH-SILOM09",
                project_name="Silom-Naradhiwas Shophouse Strip",
                city="Bangkok",
                property_category="Commercial",
                property_type="Shophouse",
                building="Street Frontage (Non-Gated)",
                floor="4 Storeys",
                bedrooms=2,
                bathrooms=3,
                size_sqm=280.0,
                furnishing="Unfurnished",
                status="Occupied",
                listing_type="For Rent",
                target_rent_price=85000,
                target_sale_price=24000000,
                address="Naradhiwas Rajanagarindra Rd, Silom, Bang Rak, Bangkok",
                key_card_and_access_info="Motorized Front Shutter Remote x2 + Glass Door Key",
                meter_electric_no="MEA-7740192",
                meter_water_no="MWA-0911",
                warranty_expiry_date=None,
                image_url="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
                notes="High foot-traffic commercial shophouse suitable for flagship café, clinic, or showroom.",
                developer_id=None,
                landlord_id=ll2.id if ll2 else None,
            ),
        ]
        db.add_all(extra_units)
        db.commit()

    # Seed additional Condominium units per building so Building Directory shows rich Available for Rent & Sale counts
    if not db.query(PropertyUnit).filter(PropertyUnit.unit_code == "XT-B2201").first():
        dev1 = db.query(Developer).first()
        dev2 = db.query(Developer).offset(1).first()
        dev3 = db.query(Developer).offset(2).first()
        ll1 = db.query(Contact).filter(Contact.role.in_(["LANDLORD", "BOTH"])).first()
        ll2 = db.query(Contact).filter(Contact.role.in_(["LANDLORD", "BOTH"])).offset(1).first()
        ll3 = db.query(Contact).filter(Contact.role.in_(["LANDLORD", "BOTH"])).offset(2).first()

        more_condos = [
            PropertyUnit(
                unit_code="XT-B2201",
                project_name="XT Ekkamai",
                city="Bangkok",
                property_category="Residential",
                property_type="Condominium",
                building="Tower A",
                floor="22",
                bedrooms=2,
                bathrooms=2,
                size_sqm=56.5,
                furnishing="Fully Furnished",
                status="Available",
                listing_type="Rent & Sale",
                target_rent_price=38000,
                target_sale_price=9200000,
                address="Sukhumvit Soi 63 (Ekkamai), Watthana, Bangkok",
                key_card_and_access_info="Agent Keybox #2201 at Juristic",
                meter_electric_no="MEA-8829551",
                meter_water_no="JUR-2201A",
                warranty_expiry_date=(today + timedelta(days=240)).isoformat(),
                image_url="https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80",
                notes="Corner 2BR unit, available immediately for both rent and sale.",
                developer_id=dev1.id if dev1 else None,
                landlord_id=ll1.id if ll1 else None,
            ),
            PropertyUnit(
                unit_code="XT-A0915",
                project_name="XT Ekkamai",
                city="Bangkok",
                property_category="Residential",
                property_type="Condominium",
                building="Tower A",
                floor="9",
                bedrooms=1,
                bathrooms=1,
                size_sqm=31.0,
                furnishing="Fully Furnished",
                status="Available",
                listing_type="For Rent",
                target_rent_price=22000,
                target_sale_price=0,
                address="Sukhumvit Soi 63 (Ekkamai), Watthana, Bangkok",
                key_card_and_access_info="2 Keycards at Office",
                meter_electric_no="MEA-8829015",
                meter_water_no="JUR-0915A",
                warranty_expiry_date=(today + timedelta(days=240)).isoformat(),
                image_url="https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80",
                notes="Pool facing 1BR, landlord prefers 1-year expat rental.",
                developer_id=dev1.id if dev1 else None,
                landlord_id=ll3.id if ll3 else None,
            ),
            PropertyUnit(
                unit_code="PARK-A1405",
                project_name="Park Origin Thonglor",
                city="Bangkok",
                property_category="Residential",
                property_type="Condominium",
                building="Tower A",
                floor="14",
                bedrooms=1,
                bathrooms=1,
                size_sqm=34.5,
                furnishing="Fully Furnished",
                status="Available",
                listing_type="For Sale",
                target_rent_price=36000,
                target_sale_price=10900000,
                address="Thonglor Soi 10, Sukhumvit 55, Watthana, Bangkok",
                key_card_and_access_info="Digital Lock PIN #4409*, Keycard x2",
                meter_electric_no="MEA-9930405",
                meter_water_no="JUR-1405A",
                warranty_expiry_date=(today + timedelta(days=410)).isoformat(),
                image_url="https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80",
                notes="Foreign Quota unit available for sale with full designer furniture package.",
                developer_id=dev3.id if dev3 else None,
                landlord_id=ll2.id if ll2 else None,
            ),
            PropertyUnit(
                unit_code="PARK-B2808",
                project_name="Park Origin Thonglor",
                city="Bangkok",
                property_category="Residential",
                property_type="Condominium",
                building="Tower B",
                floor="28",
                bedrooms=2,
                bathrooms=2,
                size_sqm=58.0,
                furnishing="Fully Furnished",
                status="Available",
                listing_type="Rent & Sale",
                target_rent_price=55000,
                target_sale_price=15800000,
                address="Thonglor Soi 10, Sukhumvit 55, Watthana, Bangkok",
                key_card_and_access_info="Smart Mirror Tablet, Keycard x3",
                meter_electric_no="MEA-9930808",
                meter_water_no="JUR-2808B",
                warranty_expiry_date=(today + timedelta(days=410)).isoformat(),
                image_url="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80",
                notes="Panoramic Thonglor skyline view, vacant and ready to view.",
                developer_id=dev3.id if dev3 else None,
                landlord_id=ll1.id if ll1 else None,
            ),
            PropertyUnit(
                unit_code="LIFE-A1210",
                project_name="Life Asoke Hype",
                city="Bangkok",
                property_category="Residential",
                property_type="Condominium",
                building="Building A",
                floor="12",
                bedrooms=1,
                bathrooms=1,
                size_sqm=32.0,
                furnishing="Fully Furnished",
                status="Available",
                listing_type="Rent & Sale",
                target_rent_price=21000,
                target_sale_price=4950000,
                address="Asoke-Din Daeng Rd, Makkasan, Ratchathewi, Bangkok",
                key_card_and_access_info="Lockbox #1210",
                meter_electric_no="MEA-4410110",
                meter_water_no="JUR-1210A",
                warranty_expiry_date=(today - timedelta(days=60)).isoformat(),
                image_url="https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=80",
                notes="High-yield investment unit near MRT Phra Ram 9, available for rent & sale.",
                developer_id=dev2.id if dev2 else None,
                landlord_id=ll2.id if ll2 else None,
            ),
        ]
        db.add_all(more_condos)
        db.commit()

    # Add bank_name and bank_account_no to contacts, and gallery_images to property_units
    try:
        db.execute(text("ALTER TABLE contacts ADD COLUMN bank_name VARCHAR(120)"))
        db.commit()
    except Exception:
        db.rollback()

    try:
        db.execute(text("ALTER TABLE contacts ADD COLUMN bank_account_no VARCHAR(100)"))
        db.commit()
    except Exception:
        db.rollback()

    try:
        db.execute(text("ALTER TABLE property_units ADD COLUMN gallery_images TEXT"))
        db.commit()
    except Exception:
        db.rollback()

    try:
        db.execute(text("ALTER TABLE lease_contracts ADD COLUMN documents TEXT"))
        db.commit()
    except Exception:
        db.rollback()

    for alter_sql in [
        "ALTER TABLE lease_contracts ADD COLUMN has_rent_spread INTEGER DEFAULT 0",
        "ALTER TABLE lease_contracts ADD COLUMN landlord_monthly_rent FLOAT",
        "ALTER TABLE lease_contracts ADD COLUMN landlord_security_deposit FLOAT",
        "ALTER TABLE lease_contracts ADD COLUMN management_fee_percent FLOAT DEFAULT 5.0",
        "ALTER TABLE lease_contracts ADD COLUMN commission_deducted_upfront INTEGER DEFAULT 1",
        "ALTER TABLE lease_contracts ADD COLUMN deposit_forfeited INTEGER DEFAULT 0",
        "ALTER TABLE lease_contracts ADD COLUMN early_termination_date VARCHAR(20)",
        "ALTER TABLE lease_contracts ADD COLUMN early_termination_note TEXT",
        "ALTER TABLE rental_payments ADD COLUMN landlord_base_rent FLOAT DEFAULT 0.0",
        "ALTER TABLE rental_payments ADD COLUMN rent_spread_agency FLOAT DEFAULT 0.0",
        "ALTER TABLE unit_issues ADD COLUMN issue_images TEXT",
        "ALTER TABLE unit_issues ADD COLUMN issue_documents TEXT",
        "ALTER TABLE contacts ADD COLUMN entity_type VARCHAR(30) DEFAULT 'Individual'",
        "ALTER TABLE contacts ADD COLUMN company_name VARCHAR(180)",
        "ALTER TABLE contacts ADD COLUMN tax_id VARCHAR(60)",
        "ALTER TABLE contacts ADD COLUMN service_category VARCHAR(100)",
        "ALTER TABLE contacts ADD COLUMN corporate_employees TEXT",
        "ALTER TABLE developers ADD COLUMN tax_id VARCHAR(60)",
        "ALTER TABLE developers ADD COLUMN corporate_employees TEXT",
    ]:
        try:
            db.execute(text(alter_sql))
            db.commit()
        except Exception:
            db.rollback()

    # Backfill bank_name & bank_account_no from bank_account_info if empty
    import json
    contacts_all = db.query(Contact).all()
    for c in contacts_all:
        if not c.bank_name and c.bank_account_info:
            if "|" in c.bank_account_info:
                parts = [p.strip() for p in c.bank_account_info.split("|")]
                c.bank_name = parts[0]
                if len(parts) > 1:
                    c.bank_account_no = parts[1].replace("Acc:", "").strip()
            elif ":" in c.bank_account_info:
                parts = [p.strip() for p in c.bank_account_info.split(":")]
                c.bank_name = parts[0].replace("for Deposit Refund", "").strip()
                c.bank_account_no = parts[1]
            else:
                c.bank_name = c.bank_account_info

    # Backfill gallery_images on PropertyUnit so every unit has high-res gallery photos
    sample_extra_photos = [
        "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1600&q=85",
        "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1600&q=85",
        "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1600&q=85",
    ]
    all_units = db.query(PropertyUnit).all()
    for idx, u in enumerate(all_units):
        if not u.gallery_images:
            imgs = []
            if u.image_url:
                imgs.append(u.image_url)
            imgs.append(sample_extra_photos[idx % len(sample_extra_photos)])
            imgs.append(sample_extra_photos[(idx + 1) % len(sample_extra_photos)])
            u.gallery_images = json.dumps(imgs)
    db.commit()

    # Backfill sample LeaseContract documents & Dual-Rate / Rent Difference settings if empty
    all_leases = db.query(LeaseContract).all()
    for l in all_leases:
        if not l.documents:
            sample_docs = [
                {
                    "url": l.document_url or f"/uploads/sample_{l.contract_no}_Signed_Lease.pdf",
                    "name": f"{l.contract_no}_Signed_Lease_Agreement.pdf",
                    "doc_type": "Signed Contract",
                    "size_bytes": 1450200,
                    "uploaded_at": l.start_date,
                },
                {
                    "url": f"/uploads/sample_{l.contract_no}_Inventory_Checklist.pdf",
                    "name": f"{l.contract_no}_Signed_Inventory_&_Handover.pdf",
                    "doc_type": "Inventory & Handover",
                    "size_bytes": 890400,
                    "uploaded_at": l.start_date,
                },
            ]
            l.documents = json.dumps(sample_docs)

        # Configure sample rent spread on LC-2026-001 and LC-2025-089, and no spread on LC-2026-014
        if l.landlord_monthly_rent is None:
            if l.contract_no == "LC-2026-001":
                l.has_rent_spread = 1
                l.landlord_monthly_rent = 24000.0  # Tenant pays 26,000; Landlord notified 24,000 (+2,000/mo agency spread)
                l.landlord_security_deposit = 48000.0  # 2 months @ 24,000
                l.agent_commission = 24000.0  # Based on 24,000
                l.management_fee_percent = 5.0
                l.commission_deducted_upfront = 1
            elif l.contract_no == "LC-2025-089":
                l.has_rent_spread = 1
                l.landlord_monthly_rent = 32000.0  # Tenant pays 35,000; Landlord notified 32,000 (+3,000/mo agency spread)
                l.landlord_security_deposit = 64000.0  # 2 months @ 32,000
                l.agent_commission = 32000.0  # Based on 32,000
                l.management_fee_percent = 5.0
                l.commission_deducted_upfront = 1
            else:
                l.has_rent_spread = 0
                l.landlord_monthly_rent = l.monthly_rent
                l.landlord_security_deposit = l.security_deposit
                l.management_fee_percent = 5.0
                l.commission_deducted_upfront = 1
    db.commit()

    # Seed RentalPayment records tied to LeaseContract, Tenant, Landlord & Repair Expenses
    if db.query(RentalPayment).count() == 0:
        lc1 = db.query(LeaseContract).filter(LeaseContract.contract_no == "LC-2026-001").first()
        lc2 = db.query(LeaseContract).filter(LeaseContract.contract_no == "LC-2025-089").first()
        lc3 = db.query(LeaseContract).filter(LeaseContract.contract_no == "LC-2026-014").first()

        sample_payments = []
        if lc1:
            sample_payments.extend([
                RentalPayment(
                    receipt_no="RCP-2026-0801",
                    lease_id=lc1.id,
                    unit_id=lc1.unit_id,
                    landlord_id=lc1.landlord_id,
                    tenant_id=lc1.tenant_id,
                    billing_month="2026-08",
                    due_date="2026-08-05",
                    paid_date="2026-08-03",
                    status="Paid & Settled",
                    base_rent=26000,
                    tenant_extra_charges=0,
                    tenant_charges_note="",
                    amount_collected_from_tenant=26000,
                    landlord_repair_deduction=0,
                    other_landlord_expenses=1300,
                    expense_breakdown_note="5% Monthly Property Management Fee (฿1,300)",
                    net_payout_to_landlord=24700,
                    payment_method="Bank Transfer",
                ),
                RentalPayment(
                    receipt_no="RCP-2026-0901",
                    lease_id=lc1.id,
                    unit_id=lc1.unit_id,
                    landlord_id=lc1.landlord_id,
                    tenant_id=lc1.tenant_id,
                    billing_month="2026-09",
                    due_date="2026-09-05",
                    paid_date="2026-09-02",
                    status="Paid & Settled",
                    base_rent=26000,
                    tenant_extra_charges=0,
                    tenant_charges_note="",
                    amount_collected_from_tenant=26000,
                    landlord_repair_deduction=1150,
                    other_landlord_expenses=1300,
                    expense_breakdown_note="ISS-0994: Kitchen Under-Sink P-Trap Replacement (฿1,150) + 5% Mgmt Fee (฿1,300)",
                    net_payout_to_landlord=23550,
                    payment_method="Bank Transfer",
                ),
                RentalPayment(
                    receipt_no="RCP-2026-1001",
                    lease_id=lc1.id,
                    unit_id=lc1.unit_id,
                    landlord_id=lc1.landlord_id,
                    tenant_id=lc1.tenant_id,
                    billing_month="2026-10",
                    due_date="2026-10-05",
                    paid_date="2026-10-03",
                    status="Paid & Settled",
                    base_rent=26000,
                    tenant_extra_charges=0,
                    tenant_charges_note="",
                    amount_collected_from_tenant=26000,
                    landlord_repair_deduction=0,
                    other_landlord_expenses=1300,
                    expense_breakdown_note="5% Monthly Property Management Fee (฿1,300)",
                    net_payout_to_landlord=24700,
                    payment_method="Bank Transfer",
                ),
            ])

        if lc2:
            sample_payments.extend([
                RentalPayment(
                    receipt_no="RCP-2026-0902",
                    lease_id=lc2.id,
                    unit_id=lc2.unit_id,
                    landlord_id=lc2.landlord_id,
                    tenant_id=lc2.tenant_id,
                    billing_month="2026-09",
                    due_date="2026-09-01",
                    paid_date="2026-09-01",
                    status="Paid & Settled",
                    base_rent=35000,
                    tenant_extra_charges=0,
                    tenant_charges_note="",
                    amount_collected_from_tenant=35000,
                    landlord_repair_deduction=0,
                    other_landlord_expenses=1750,
                    expense_breakdown_note="5% Overseas Landlord Management Fee (฿1,750)",
                    net_payout_to_landlord=33250,
                    payment_method="Corporate Wire",
                ),
                RentalPayment(
                    receipt_no="RCP-2026-1002",
                    lease_id=lc2.id,
                    unit_id=lc2.unit_id,
                    landlord_id=lc2.landlord_id,
                    tenant_id=lc2.tenant_id,
                    billing_month="2026-10",
                    due_date="2026-10-01",
                    paid_date="2026-10-01",
                    status="Paid & Settled",
                    base_rent=35000,
                    tenant_extra_charges=0,
                    tenant_charges_note="",
                    amount_collected_from_tenant=35000,
                    landlord_repair_deduction=3800,
                    other_landlord_expenses=1750,
                    expense_breakdown_note="ISS-1002: Living Room Daikin Inverter AC Control Board & Refrigerant Repair (฿3,800) + 5% Mgmt Fee (฿1,750)",
                    net_payout_to_landlord=29450,
                    payment_method="Corporate Wire",
                ),
            ])

        if lc3:
            sample_payments.extend([
                RentalPayment(
                    receipt_no="RCP-2026-0903",
                    lease_id=lc3.id,
                    unit_id=lc3.unit_id,
                    landlord_id=lc3.landlord_id,
                    tenant_id=lc3.tenant_id,
                    billing_month="2026-09",
                    due_date="2026-09-05",
                    paid_date="2026-09-04",
                    status="Paid & Settled",
                    base_rent=58000,
                    tenant_extra_charges=1500,
                    tenant_charges_note="ISS-0988: Wine Fridge Thermostat Sensor Replacement (Tenant Responsibility: ฿1,500)",
                    amount_collected_from_tenant=59500,
                    landlord_repair_deduction=0,
                    other_landlord_expenses=2900,
                    expense_breakdown_note="5% Monthly Management Fee (฿2,900) • Tenant paid ฿1,500 Wine Fridge repair directly",
                    net_payout_to_landlord=55100,
                    payment_method="QR PromptPay",
                ),
                RentalPayment(
                    receipt_no="RCP-2026-1003",
                    lease_id=lc3.id,
                    unit_id=lc3.unit_id,
                    landlord_id=lc3.landlord_id,
                    tenant_id=lc3.tenant_id,
                    billing_month="2026-10",
                    due_date="2026-10-05",
                    paid_date="2026-10-05",
                    status="Paid & Settled",
                    base_rent=58000,
                    tenant_extra_charges=0,
                    tenant_charges_note="",
                    amount_collected_from_tenant=58000,
                    landlord_repair_deduction=0,
                    other_landlord_expenses=2900,
                    expense_breakdown_note="ISS-1001 Rain Shower Pipe Seepage covered 100% by Origin Developer Warranty (฿0 to Landlord) + 5% Mgmt Fee (฿2,900)",
                    net_payout_to_landlord=55100,
                    payment_method="QR PromptPay",
                ),
            ])

        db.add_all(sample_payments)
        db.commit()

    # Ensure all RentalPayment rows have landlord_base_rent and rent_spread_agency aligned with their LeaseContract
    all_payments = db.query(RentalPayment).all()
    for p in all_payments:
        if p.lease:
            ll_rent = float(p.lease.landlord_monthly_rent or p.lease.monthly_rent or p.base_rent)
            tn_rent = float(p.base_rent or p.lease.monthly_rent or 0.0)
            mgmt_pct = float(p.lease.management_fee_percent if p.lease.management_fee_percent is not None else 5.0)
            if not p.landlord_base_rent or p.landlord_base_rent == p.base_rent:
                p.landlord_base_rent = ll_rent
                p.rent_spread_agency = max(0.0, tn_rent - ll_rent)
                # Recalculate management fee based on landlord_base_rent if it was previously based on tenant rent
                expected_mgmt = round(ll_rent * (mgmt_pct / 100.0))
                if p.other_landlord_expenses == round(tn_rent * 0.05) and ll_rent != tn_rent:
                    p.other_landlord_expenses = expected_mgmt
                    if p.expense_breakdown_note:
                        p.expense_breakdown_note = p.expense_breakdown_note.replace(
                            f"฿{round(tn_rent * 0.05):,}", f"฿{expected_mgmt:,}"
                        )
                p.net_payout_to_landlord = (
                    p.landlord_base_rent
                    - float(p.landlord_repair_deduction or 0.0)
                    - float(p.other_landlord_expenses or 0.0)
                )
    db.commit()

    # Seed sample high-res issue photos and quotation/warranty documents on existing tickets if not yet set
    import json as _json
    iss_1002 = db.query(UnitIssue).filter(UnitIssue.ticket_no == "ISS-1002").first()
    if iss_1002 and not iss_1002.issue_images:
        iss_1002.issue_images = _json.dumps([
            "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1600&q=85",
            "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1600&q=85",
        ])
        iss_1002.issue_documents = _json.dumps([
            {
                "url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
                "name": "CoolBKK_Daikin_Inverter_U4_Board_Quotation_3800THB.pdf",
                "doc_type": "Quotation",
                "size_bytes": 428500,
                "uploaded_at": today.isoformat(),
            }
        ])
    iss_1001 = db.query(UnitIssue).filter(UnitIssue.ticket_no == "ISS-1001").first()
    if iss_1001 and not iss_1001.issue_images:
        iss_1001.issue_images = _json.dumps([
            "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1600&q=85",
        ])
        iss_1001.issue_documents = _json.dumps([
            {
                "url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
                "name": "OriginCare_Warranty_Claim_Form_MEP_PARK_C3102.pdf",
                "doc_type": "Warranty Claim",
                "size_bytes": 612000,
                "uploaded_at": today.isoformat(),
            }
        ])
    iss_1003 = db.query(UnitIssue).filter(UnitIssue.ticket_no == "ISS-1003").first()
    if iss_1003 and not iss_1003.issue_images:
        iss_1003.issue_images = _json.dumps([
            "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1600&q=85",
        ])

    # Seed Corporate Landlords, Corporate Tenants, Developer Representatives & Vendors if not yet populated
    marcus = db.query(Contact).filter(Contact.full_name == "Marcus Vance").first()
    if marcus and not marcus.corporate_employees:
        marcus.entity_type = "Corporate"
        marcus.company_name = "Vance Pacific Asset Holdings Ltd."
        marcus.tax_id = "HK-88291044-C"
        marcus.corporate_employees = _json.dumps([
            {
                "name": "Marcus Vance",
                "title_or_department": "Managing Director (Beneficial Owner)",
                "phone": "+65 9123 4567",
                "email": "marcus.vance@globalinvest.sg",
                "line_or_whatsapp": "WhatsApp: +6591234567",
                "is_primary": True,
                "notes": "Approves major capex/repairs > 3,000 THB and annual lease terms.",
            },
            {
                "name": "ratree.s (Khun Ratree S.)",
                "title_or_department": "Thailand Corporate Asset & Lease Coordinator",
                "phone": "089-442-1980",
                "email": "ratree.s@vancepacific.co.th",
                "line_or_whatsapp": "@ratree_vp",
                "is_primary": False,
                "notes": "Handles contract signing, POA documents, withholding tax certificates & monthly SOA.",
            },
        ])

    kenji = db.query(Contact).filter(Contact.full_name == "Kenji Takahashi").first()
    if kenji and not kenji.corporate_employees:
        kenji.entity_type = "Corporate"
        kenji.company_name = "Mitsui & Co. (Thailand) Ltd."
        kenji.tax_id = "0105512009841"
        kenji.corporate_employees = _json.dumps([
            {
                "name": "Supaporn K. (Khun Nok)",
                "title_or_department": "HR & Expat Mobility Manager",
                "phone": "02-344-2000 ext. 412",
                "email": "supaporn.k@mitsui-th.com",
                "line_or_whatsapp": "@mitsui_hr_bkk",
                "is_primary": True,
                "notes": "Deals with corporate lease contracts, renewals, company stamp & monthly rent transfer.",
            },
            {
                "name": "Kenji Takahashi",
                "title_or_department": "VP Regional Operations (Occupant)",
                "phone": "092-881-3344",
                "email": "k.takahashi@mitsui-th.com",
                "line_or_whatsapp": "LINE: kenji_t_bkk",
                "is_primary": False,
                "notes": "Occupant in unit LIFE-B2409; contact for unit access & maintenance scheduling.",
            },
        ])

    dev_sansiri = db.query(Developer).filter(Developer.company_name.like("%Sansiri%")).first()
    if dev_sansiri and not dev_sansiri.corporate_employees:
        dev_sansiri.tax_id = "0107537002150"
        dev_sansiri.corporate_employees = _json.dumps([
            {
                "name": "Khun Noppadol V.",
                "title_or_department": "Senior HomeCare Defect Engineer",
                "phone": "02-201-3999",
                "email": "noppadol.v@sansiri.com",
                "line_or_whatsapp": "@sansirihomecare",
                "is_primary": True,
                "notes": "Handles structural & MEP warranty inspections for XT Ekkamai & The Monument Thonglor.",
            },
            {
                "name": "Khun Ploypailin T.",
                "title_or_department": "Juristic & Handover Contract Officer",
                "phone": "081-772-9012",
                "email": "ploypailin.t@plus.co.th",
                "line_or_whatsapp": "LINE: ploy_plusprop",
                "is_primary": False,
                "notes": "Coordinates title deed handover, warranty extensions & contractor access permits.",
            },
        ])

    dev_origin = db.query(Developer).filter(Developer.company_name.like("%Origin%")).first()
    if dev_origin and not dev_origin.corporate_employees:
        dev_origin.tax_id = "0107558000112"
        dev_origin.corporate_employees = _json.dumps([
            {
                "name": "Khun Kittisak P.",
                "title_or_department": "Origin Care Warranty Claim Lead",
                "phone": "02-030-0000",
                "email": "kittisak.p@origin.co.th",
                "line_or_whatsapp": "@origincare",
                "is_primary": True,
                "notes": "Approves defect repair claims and dispatches MEP technicians for Park Origin Thonglor.",
            }
        ])

    # Seed Vendors in Contacts if none exist
    if not db.query(Contact).filter(Contact.role == "VENDOR").first():
        vendors = [
            Contact(
                role="VENDOR",
                entity_type="Corporate",
                company_name="CoolBKK Air Conditioning Service Co., Ltd.",
                tax_id="0105561049281",
                service_category="Air Conditioning & HVAC",
                full_name="CoolBKK Air Conditioning Service",
                phone="02-714-8890",
                email="dispatch@coolbkkservice.co.th",
                line_or_whatsapp="@coolbkk_ac",
                nationality="Thai",
                id_or_passport="0105561049281",
                bank_name="Kasikorn Bank (KBank)",
                bank_account_no="048-3-99210-7",
                bank_account_info="Kasikorn Bank (KBank) | Acc: 048-3-99210-7",
                preferred_language="Thai / English",
                rating=5,
                notes="Authorized Daikin & Mitsubishi inverter specialist. Same-day emergency dispatch in Sukhumvit & Asoke.",
                corporate_employees=_json.dumps([
                    {
                        "name": "Khun Wichai (Chief Technician)",
                        "title_or_department": "Lead HVAC Field Engineer",
                        "phone": "081-909-4412",
                        "email": "wichai@coolbkkservice.co.th",
                        "line_or_whatsapp": "LINE: wichai_coolbkk",
                        "is_primary": True,
                        "notes": "On-site diagnostics, control board replacement & refrigerant servicing.",
                    },
                    {
                        "name": "Khun Porntip S.",
                        "title_or_department": "Quotation & Billing Coordinator",
                        "phone": "086-331-2209",
                        "email": "billing@coolbkkservice.co.th",
                        "line_or_whatsapp": "@coolbkk_ac",
                        "is_primary": False,
                        "notes": "Issues official quotations, tax invoices & 90-day repair warranty certificates.",
                    },
                ]),
            ),
            Contact(
                role="VENDOR",
                entity_type="Corporate",
                company_name="Siam Pro Plumbing, Electrical & Handyman Co., Ltd.",
                tax_id="0105559011824",
                service_category="Plumbing & Electrical",
                full_name="Juristic Building Technician",
                phone="02-662-4410",
                email="service@siamprohandyman.com",
                line_or_whatsapp="@siampro_fix",
                nationality="Thai",
                id_or_passport="0105559011824",
                bank_name="SCB (Siam Commercial Bank)",
                bank_account_no="114-2-88301-5",
                bank_account_info="SCB | Acc: 114-2-88301-5",
                preferred_language="Thai / English",
                rating=5,
                notes="Preferred plumbing, P-trap, concealed pipe seepage & electrical contractor for Thonglor/Ekkamai condos.",
                corporate_employees=_json.dumps([
                    {
                        "name": "Khun Prasert M.",
                        "title_or_department": "Operations & Quotation Manager",
                        "phone": "089-771-5520",
                        "email": "prasert@siamprohandyman.com",
                        "line_or_whatsapp": "LINE: prasert_siampro",
                        "is_primary": True,
                        "notes": "Approves repair quotes and schedules technician teams.",
                    }
                ]),
            ),
            Contact(
                role="VENDOR",
                entity_type="Corporate",
                company_name="Electrolux Official Corporate Service Center",
                tax_id="0105520001928",
                service_category="Appliance & White Goods Repair",
                full_name="Electrolux Official Service",
                phone="02-725-9000",
                email="corporateservice@electrolux.co.th",
                line_or_whatsapp="@electroluxth",
                nationality="Corporate",
                id_or_passport="0105520001928",
                bank_name="Bangkok Bank (BBL)",
                bank_account_no="101-3-44920-1",
                bank_account_info="Bangkok Bank (BBL) | Acc: 101-3-44920-1",
                preferred_language="Thai / English",
                rating=5,
                notes="OEM spare parts & repairs for built-in wine fridges, ovens, washer-dryers & hobs.",
                corporate_employees=_json.dumps([
                    {
                        "name": "Khun Darika L.",
                        "title_or_department": "Key Account Service Coordinator",
                        "phone": "02-725-9000 ext. 108",
                        "email": "darika.l@electrolux.com",
                        "line_or_whatsapp": "@electroluxth",
                        "is_primary": True,
                        "notes": "Handles corporate property management work orders and part replacements.",
                    }
                ]),
            ),
        ]
        db.add_all(vendors)

    db.commit()

    seed_initial_users(db)


DEFAULT_ROLE_PERMISSIONS = {
    "Super Admin": {
        "dashboard": {"view": True, "view_financials": True, "export_data": True},
        "units": {"view": True, "create": True, "edit": True, "delete": True, "view_pricing": True},
        "crm": {"view": True, "create": True, "edit": True, "delete": True, "view_contacts": True},
        "leases": {
            "view": True,
            "create": True,
            "edit": True,
            "delete": True,
            "view_confidential_spread": True,
            "view_statements": True,
            "mark_paid": True,
            "upload_slips": True,
            "terminate_lease": True,
        },
        "issues": {"view": True, "create": True, "edit": True, "delete": True, "resolve": True},
        "calculator": {"view": True, "export_reports": True},
        "financial_settings": {"view": True, "edit": True},
        "user_management": {"view": True, "edit": True},
    },
    "Branch Manager": {
        "dashboard": {"view": True, "view_financials": True, "export_data": True},
        "units": {"view": True, "create": True, "edit": True, "delete": False, "view_pricing": True},
        "crm": {"view": True, "create": True, "edit": True, "delete": False, "view_contacts": True},
        "leases": {
            "view": True,
            "create": True,
            "edit": True,
            "delete": False,
            "view_confidential_spread": True,
            "view_statements": True,
            "mark_paid": True,
            "upload_slips": True,
            "terminate_lease": True,
        },
        "issues": {"view": True, "create": True, "edit": True, "delete": False, "resolve": True},
        "calculator": {"view": True, "export_reports": True},
        "financial_settings": {"view": True, "edit": False},
        "user_management": {"view": True, "edit": False},
    },
    "Senior Leasing Agent": {
        "dashboard": {"view": True, "view_financials": False, "export_data": False},
        "units": {"view": True, "create": True, "edit": True, "delete": False, "view_pricing": True},
        "crm": {"view": True, "create": True, "edit": True, "delete": False, "view_contacts": True},
        "leases": {
            "view": True,
            "create": True,
            "edit": True,
            "delete": False,
            "view_confidential_spread": False,
            "view_statements": True,
            "mark_paid": True,
            "upload_slips": True,
            "terminate_lease": False,
        },
        "issues": {"view": True, "create": True, "edit": True, "delete": False, "resolve": False},
        "calculator": {"view": True, "export_reports": True},
        "financial_settings": {"view": False, "edit": False},
        "user_management": {"view": False, "edit": False},
    },
    "Junior Agent": {
        "dashboard": {"view": True, "view_financials": False, "export_data": False},
        "units": {"view": True, "create": False, "edit": False, "delete": False, "view_pricing": True},
        "crm": {"view": True, "create": False, "edit": False, "delete": False, "view_contacts": True},
        "leases": {
            "view": True,
            "create": False,
            "edit": False,
            "delete": False,
            "view_confidential_spread": False,
            "view_statements": False,
            "mark_paid": False,
            "upload_slips": False,
            "terminate_lease": False,
        },
        "issues": {"view": True, "create": True, "edit": False, "delete": False, "resolve": False},
        "calculator": {"view": True, "export_reports": False},
        "financial_settings": {"view": False, "edit": False},
        "user_management": {"view": False, "edit": False},
    },
    "Property Inspector": {
        "dashboard": {"view": False, "view_financials": False, "export_data": False},
        "units": {"view": True, "create": False, "edit": False, "delete": False, "view_pricing": False},
        "crm": {"view": False, "create": False, "edit": False, "delete": False, "view_contacts": False},
        "leases": {
            "view": False,
            "create": False,
            "edit": False,
            "delete": False,
            "view_confidential_spread": False,
            "view_statements": False,
            "mark_paid": False,
            "upload_slips": False,
            "terminate_lease": False,
        },
        "issues": {"view": True, "create": True, "edit": True, "delete": False, "resolve": True},
        "calculator": {"view": False, "export_reports": False},
        "financial_settings": {"view": False, "edit": False},
        "user_management": {"view": False, "edit": False},
    },
    "Accountant": {
        "dashboard": {"view": True, "view_financials": True, "export_data": True},
        "units": {"view": True, "create": False, "edit": False, "delete": False, "view_pricing": True},
        "crm": {"view": True, "create": False, "edit": False, "delete": False, "view_contacts": True},
        "leases": {
            "view": True,
            "create": False,
            "edit": False,
            "delete": False,
            "view_confidential_spread": True,
            "view_statements": True,
            "mark_paid": True,
            "upload_slips": True,
            "terminate_lease": False,
        },
        "issues": {"view": False, "create": False, "edit": False, "delete": False, "resolve": False},
        "calculator": {"view": True, "export_reports": True},
        "financial_settings": {"view": True, "edit": False},
        "user_management": {"view": False, "edit": False},
    },
}


def seed_initial_users(db: Session):
    try:
        from database import Base, engine
        Base.metadata.create_all(bind=engine)
    except Exception:
        pass

    if db.query(AppUser).count() > 0:
        return

    users = [
        AppUser(
            full_name="Sarah Chen",
            email="sarah.chen@proppulse.com",
            role="Super Admin",
            department="Executive Management",
            phone="+66 81 992 0001",
            status="Active",
            avatar_url="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80",
            last_login="Today, 09:15 AM",
            permissions=_json.dumps(DEFAULT_ROLE_PERMISSIONS["Super Admin"]),
        ),
        AppUser(
            full_name="Alex Wong",
            email="alex.wong@proppulse.com",
            role="Branch Manager",
            department="Operations & Sales",
            phone="+66 82 445 1102",
            status="Active",
            avatar_url="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=256&q=80",
            last_login="Today, 10:40 AM",
            permissions=_json.dumps(DEFAULT_ROLE_PERMISSIONS["Branch Manager"]),
        ),
        AppUser(
            full_name="Nadia Boonmee",
            email="nadia.b@proppulse.com",
            role="Senior Leasing Agent",
            department="Leasing & Sales",
            phone="+66 89 771 2203",
            status="Active",
            avatar_url="https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=256&q=80",
            last_login="Yesterday, 04:20 PM",
            permissions=_json.dumps(DEFAULT_ROLE_PERMISSIONS["Senior Leasing Agent"]),
        ),
        AppUser(
            full_name="Kenji Takahashi",
            email="kenji.t@proppulse.com",
            role="Junior Agent",
            department="Leasing & Sales",
            phone="+66 95 882 1044",
            status="Active",
            avatar_url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80",
            last_login="3 days ago",
            permissions=_json.dumps(DEFAULT_ROLE_PERMISSIONS["Junior Agent"]),
        ),
        AppUser(
            full_name="Somchai Prasert",
            email="somchai.p@proppulse.com",
            role="Property Inspector",
            department="Defect & Maintenance",
            phone="+66 81 442 9910",
            status="Active",
            avatar_url="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80",
            last_login="Today, 08:00 AM",
            permissions=_json.dumps(DEFAULT_ROLE_PERMISSIONS["Property Inspector"]),
        ),
        AppUser(
            full_name="Ploypailin Sukhumvit",
            email="ploypailin.s@proppulse.com",
            role="Accountant",
            department="Finance & Accounts",
            phone="+66 84 119 5520",
            status="Active",
            avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80",
            last_login="Today, 11:15 AM",
            permissions=_json.dumps(DEFAULT_ROLE_PERMISSIONS["Accountant"]),
        ),
    ]
    db.add_all(users)
    db.commit()



