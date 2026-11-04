import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

const DB_PATH = path.resolve(__dirname, '..', 'prop_crm.db');
export const db = new Database(DB_PATH);

// Enable foreign keys & WAL mode for high performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS developers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name VARCHAR(150) NOT NULL UNIQUE,
      contact_person VARCHAR(120),
      phone VARCHAR(50),
      email VARCHAR(100),
      line_id VARCHAR(50),
      address TEXT,
      warranty_policy TEXT,
      defect_contact_info TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role VARCHAR(50) NOT NULL,
      entity_type VARCHAR(50) DEFAULT 'Individual',
      full_name VARCHAR(120) NOT NULL,
      company_name VARCHAR(150),
      tax_id VARCHAR(60),
      service_category VARCHAR(100),
      phone VARCHAR(50),
      email VARCHAR(100),
      line_or_whatsapp VARCHAR(60),
      nationality VARCHAR(80),
      id_or_passport VARCHAR(80),
      bank_name VARCHAR(120),
      bank_account_no VARCHAR(100),
      bank_account_info TEXT,
      preferred_language VARCHAR(50) DEFAULT 'English',
      rating INTEGER DEFAULT 5,
      notes TEXT,
      corporate_employees TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS property_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_code VARCHAR(50) NOT NULL UNIQUE,
      project_name VARCHAR(120) NOT NULL,
      city VARCHAR(80) DEFAULT 'Bangkok',
      property_category VARCHAR(40) DEFAULT 'Residential',
      property_type VARCHAR(50) DEFAULT 'Condominium',
      building VARCHAR(50),
      floor VARCHAR(30),
      bedrooms INTEGER DEFAULT 1,
      bathrooms INTEGER DEFAULT 1,
      size_sqm FLOAT NOT NULL,
      furnishing VARCHAR(50) DEFAULT 'Fully Furnished',
      status VARCHAR(50) DEFAULT 'Available',
      listing_type VARCHAR(50) DEFAULT 'Rent & Sale',
      target_rent_price FLOAT DEFAULT 0.0,
      target_sale_price FLOAT DEFAULT 0.0,
      developer_id INTEGER REFERENCES developers(id),
      landlord_id INTEGER REFERENCES contacts(id),
      handover_date VARCHAR(20),
      defect_warranty_expiry VARCHAR(20),
      electric_meter_no VARCHAR(50),
      water_meter_no VARCHAR(50),
      keycard_inventory TEXT,
      parking_slot VARCHAR(50),
      listing_headline VARCHAR(200),
      description_summary TEXT,
      amenities_highlights TEXT,
      co_broke_terms TEXT,
      agent_internal_notes TEXT,
      juristic_cam_fee_sqm FLOAT DEFAULT 0.0,
      juristic_annual_estimate FLOAT DEFAULT 0.0,
      juristic_office_contact TEXT,
      image_url TEXT,
      gallery_images TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lease_contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_no VARCHAR(60) NOT NULL UNIQUE,
      unit_id INTEGER NOT NULL REFERENCES property_units(id),
      landlord_id INTEGER NOT NULL REFERENCES contacts(id),
      tenant_id INTEGER NOT NULL REFERENCES contacts(id),
      start_date VARCHAR(20) NOT NULL,
      end_date VARCHAR(20) NOT NULL,
      monthly_rent FLOAT NOT NULL,
      has_rent_spread INTEGER DEFAULT 0,
      landlord_monthly_rent FLOAT,
      security_deposit FLOAT NOT NULL,
      landlord_security_deposit FLOAT,
      advance_rent FLOAT DEFAULT 0.0,
      payment_due_day INTEGER DEFAULT 5,
      agent_commission FLOAT DEFAULT 0.0,
      management_fee_percent FLOAT DEFAULT 5.0,
      commission_deducted_upfront INTEGER DEFAULT 1,
      deposit_forfeited INTEGER DEFAULT 0,
      early_termination_date VARCHAR(20),
      early_termination_note TEXT,
      status VARCHAR(40) DEFAULT 'Active',
      inventory_checklist_signed VARCHAR(20) DEFAULT 'Pending',
      special_terms TEXT,
      document_url TEXT,
      documents TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS unit_issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_no VARCHAR(50) NOT NULL UNIQUE,
      unit_id INTEGER NOT NULL REFERENCES property_units(id),
      lease_id INTEGER REFERENCES lease_contracts(id),
      title VARCHAR(200) NOT NULL,
      category VARCHAR(60) DEFAULT 'Plumbing',
      priority VARCHAR(30) DEFAULT 'Medium',
      status VARCHAR(40) DEFAULT 'Open',
      reported_by VARCHAR(50) DEFAULT 'Tenant',
      responsible_party VARCHAR(50) DEFAULT 'Landlord',
      vendor_or_contractor VARCHAR(120),
      description TEXT,
      resolution_notes TEXT,
      estimated_cost FLOAT DEFAULT 0.0,
      actual_cost FLOAT DEFAULT 0.0,
      reported_date VARCHAR(20) NOT NULL,
      resolved_date VARCHAR(20),
      issue_images TEXT,
      issue_documents TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS communication_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel VARCHAR(40) NOT NULL,
      direction VARCHAR(30) NOT NULL,
      subject VARCHAR(200) NOT NULL,
      content TEXT NOT NULL,
      logged_by VARCHAR(80) NOT NULL,
      contact_id INTEGER REFERENCES contacts(id),
      developer_id INTEGER REFERENCES developers(id),
      unit_id INTEGER REFERENCES property_units(id),
      issue_id INTEGER REFERENCES unit_issues(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rental_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_no VARCHAR(60) NOT NULL UNIQUE,
      lease_id INTEGER NOT NULL REFERENCES lease_contracts(id),
      unit_id INTEGER NOT NULL REFERENCES property_units(id),
      landlord_id INTEGER NOT NULL REFERENCES contacts(id),
      tenant_id INTEGER NOT NULL REFERENCES contacts(id),
      billing_month VARCHAR(20) NOT NULL,
      due_date VARCHAR(20) NOT NULL,
      paid_date VARCHAR(20),
      status VARCHAR(40) DEFAULT 'Paid & Settled',
      base_rent FLOAT DEFAULT 0.0,
      landlord_base_rent FLOAT DEFAULT 0.0,
      rent_spread_agency FLOAT DEFAULT 0.0,
      tenant_extra_charges FLOAT DEFAULT 0.0,
      tenant_charges_note TEXT,
      amount_collected_from_tenant FLOAT DEFAULT 0.0,
      landlord_repair_deduction FLOAT DEFAULT 0.0,
      other_landlord_expenses FLOAT DEFAULT 0.0,
      expense_breakdown_note TEXT,
      net_payout_to_landlord FLOAT DEFAULT 0.0,
      payment_method VARCHAR(50) DEFAULT 'Bank Transfer',
      proof_document_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS app_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name VARCHAR(120) NOT NULL,
      email VARCHAR(120) NOT NULL UNIQUE,
      role VARCHAR(60) DEFAULT 'Senior Leasing Agent',
      department VARCHAR(80) DEFAULT 'Leasing & Sales',
      phone VARCHAR(40),
      status VARCHAR(20) DEFAULT 'Active',
      avatar_url VARCHAR(255),
      last_login VARCHAR(40),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      permissions TEXT
    );
  `);

  // Ensure any optional columns added across iterations exist
  const migrations = [
    "ALTER TABLE property_units ADD COLUMN city VARCHAR(80) DEFAULT 'Bangkok'",
    "ALTER TABLE property_units ADD COLUMN property_category VARCHAR(40) DEFAULT 'Residential'",
    "ALTER TABLE property_units ADD COLUMN gallery_images TEXT",
    "ALTER TABLE contacts ADD COLUMN bank_name VARCHAR(120)",
    "ALTER TABLE contacts ADD COLUMN bank_account_no VARCHAR(100)",
    "ALTER TABLE lease_contracts ADD COLUMN documents TEXT",
    "ALTER TABLE lease_contracts ADD COLUMN has_rent_spread INTEGER DEFAULT 0",
    "ALTER TABLE lease_contracts ADD COLUMN landlord_monthly_rent FLOAT",
    "ALTER TABLE lease_contracts ADD COLUMN landlord_security_deposit FLOAT",
    "ALTER TABLE lease_contracts ADD COLUMN management_fee_percent FLOAT DEFAULT 5.0",
    "ALTER TABLE lease_contracts ADD COLUMN commission_deducted_upfront INTEGER DEFAULT 1",
    "ALTER TABLE lease_contracts ADD COLUMN deposit_forfeited INTEGER DEFAULT 0",
    "ALTER TABLE lease_contracts ADD COLUMN early_termination_date VARCHAR(20)",
    "ALTER TABLE lease_contracts ADD COLUMN early_termination_note TEXT",
  ];

  for (const sql of migrations) {
    try {
      db.exec(sql);
    } catch {
      // Column already exists, ignore
    }
  }
}
