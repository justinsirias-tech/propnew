import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import { db, initDatabase } from './db';
import { seedInitialData as seedDatabase, DEFAULT_ROLE_PERMISSIONS } from './seed';
import { calculateLeaseStatement, syncLeaseMonthlySchedule, generateLeaseMonths } from './statement';
import {
  Developer,
  Contact,
  PropertyUnit,
  LeaseContract,
  RentalPayment,
  UnitIssue,
  CommunicationLog,
  AppUser,
} from './types';

// Ensure tables exist and default data is seeded
initDatabase();
seedDatabase();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const UPLOAD_DIR = path.resolve(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Serve uploaded media statically
app.use('/uploads', express.static(UPLOAD_DIR));

// Configure Multer for file storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueHex = crypto.randomBytes(6).toString('hex');
    cb(null, `${uniqueHex}_${safeName}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// --- Upload Endpoints ---
app.post('/api/upload-images', upload.array('files'), (req: Request, res: Response) => {
  const files = (req.files as Express.Multer.File[]) || [];
  const uploadedUrls: string[] = [];
  const uploadedMeta: any[] = [];

  for (const f of files) {
    const url = `/uploads/${f.filename}`;
    uploadedUrls.push(url);
    uploadedMeta.push({
      url,
      name: f.originalname,
      size_bytes: f.size,
    });
  }

  res.json({ urls: uploadedUrls, files: uploadedMeta });
});

app.post('/api/upload-files', upload.array('files'), (req: Request, res: Response) => {
  const files = (req.files as Express.Multer.File[]) || [];
  const uploadedFiles: any[] = [];
  const todayStr = new Date().toISOString().split('T')[0];

  for (const f of files) {
    const url = `/uploads/${f.filename}`;
    uploadedFiles.push({
      url,
      name: f.originalname,
      doc_type: 'Signed Contract',
      size_bytes: f.size,
      uploaded_at: todayStr,
    });
  }

  res.json({ files: uploadedFiles });
});

// --- Helper Functions & Serializers ---
function calcDaysRemaining(endDateStr: string | null | undefined): number | null {
  if (!endDateStr) return null;
  const end = new Date(endDateStr);
  const now = new Date();
  if (isNaN(end.getTime())) return null;
  const diffTime = end.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function parseJsonArray<T = any>(raw: string | T[] | null | undefined, fallback: T[] = []): T[] {
  if (!raw) return fallback;
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function parseGallery(rawGallery?: string | string[] | null, fallbackCover?: string | null): string[] {
  let imgs: string[] = [];
  if (Array.isArray(rawGallery)) {
    imgs = [...rawGallery];
  } else {
    imgs = parseJsonArray<string>(rawGallery, []);
  }
  if (fallbackCover && !imgs.includes(fallbackCover)) {
    imgs.unshift(fallbackCover);
  }
  return imgs;
}

function parseLeaseDocs(rawDocs?: string | null, fallbackUrl?: string | null): any[] {
  const docs: any[] = parseJsonArray<any>(rawDocs, []).filter((d) => d && typeof d === 'object' && d.url);
  if (fallbackUrl && !docs.some((d) => d.url === fallbackUrl)) {
    docs.unshift({
      url: fallbackUrl,
      name: path.basename(fallbackUrl) || 'Lease_Document.pdf',
      doc_type: 'Signed Contract',
      size_bytes: 0,
      uploaded_at: new Date().toISOString().split('T')[0],
    });
  }
  return docs;
}

function serializeUnit(u: PropertyUnit): any {
  const activeLease = db
    .prepare("SELECT * FROM lease_contracts WHERE unit_id = ? AND status IN ('Active', 'Expiring Soon') LIMIT 1")
    .get(u.id) as LeaseContract | undefined;

  let tenantName: string | null = null;
  if (activeLease?.tenant_id) {
    const tenant = db.prepare('SELECT full_name FROM contacts WHERE id = ?').get(activeLease.tenant_id) as any;
    tenantName = tenant?.full_name || null;
  }

  const developer = u.developer_id
    ? (db.prepare('SELECT company_name FROM developers WHERE id = ?').get(u.developer_id) as any)
    : null;
  const landlord = u.landlord_id
    ? (db.prepare('SELECT full_name, phone FROM contacts WHERE id = ?').get(u.landlord_id) as any)
    : null;

  const openIssuesCount = (
    db
      .prepare("SELECT COUNT(*) as count FROM unit_issues WHERE unit_id = ? AND status NOT IN ('Resolved', 'Closed')")
      .get(u.id) as any
  ).count;

  const totalIssuesCount = (
    db.prepare('SELECT COUNT(*) as count FROM unit_issues WHERE unit_id = ?').get(u.id) as any
  ).count;

  const galleryList = parseGallery(u.gallery_images, u.image_url);
  const coverUrl = u.image_url || (galleryList.length > 0 ? galleryList[0] : null);

  const sizeVal = Number(u.size_sqm) || 0;
  const rentVal = Number(u.target_rent_price) || 0;
  const saleVal = Number(u.target_sale_price) || 0;

  return {
    ...u,
    image_url: coverUrl,
    gallery_images: galleryList,
    rent_per_sqm: sizeVal > 0 ? Math.round((rentVal / sizeVal) * 100) / 100 : 0.0,
    sale_per_sqm: sizeVal > 0 ? Math.round((saleVal / sizeVal) * 100) / 100 : 0.0,
    developer_name: developer?.company_name || null,
    landlord_name: landlord?.full_name || null,
    landlord_phone: landlord?.phone || null,
    current_tenant_name: tenantName,
    current_lease_id: activeLease?.id || null,
    current_lease_end: activeLease?.end_date || null,
    open_issues_count: openIssuesCount,
    total_issues_count: totalIssuesCount,
  };
}

function serializeLease(l: LeaseContract): any {
  const unit = db.prepare('SELECT * FROM property_units WHERE id = ?').get(l.unit_id) as PropertyUnit | undefined;
  const landlord = db.prepare('SELECT * FROM contacts WHERE id = ?').get(l.landlord_id) as Contact | undefined;
  const tenant = db.prepare('SELECT * FROM contacts WHERE id = ?').get(l.tenant_id) as Contact | undefined;

  const payments = db
    .prepare('SELECT * FROM rental_payments WHERE lease_id = ?')
    .all(l.id) as RentalPayment[];

  const paidPayments = payments.filter((p) =>
    ['Paid & Settled', 'Collected (Pending Payout)', 'Paid'].includes(p.status)
  );
  const writtenOffPayments = payments.filter((p) => p.status === 'Written Off');

  const tnRent = Number(l.monthly_rent) || 0;
  const hasSpread = Number(l.has_rent_spread) === 1;
  const llRent = hasSpread && l.landlord_monthly_rent ? Number(l.landlord_monthly_rent) : tnRent;
  const llDep = l.landlord_security_deposit != null ? Number(l.landlord_security_deposit) : Number(l.security_deposit || 0);
  const monthlySpread = Math.max(0, tnRent - llRent);

  const totalCollected = paidPayments.reduce((acc, p) => acc + (p.amount_collected_from_tenant || 0), 0);
  const totalLLExpenses =
    paidPayments.reduce((acc, p) => acc + (p.landlord_repair_deduction || 0) + (p.other_landlord_expenses || 0), 0) +
    (Number(l.agent_commission) || 0);

  const forfeitedLLDep = l.deposit_forfeited ? llDep : 0.0;
  const totalNetProfit =
    paidPayments.reduce((acc, p) => acc + (p.net_payout_to_landlord || 0), 0) -
    (Number(l.agent_commission) || 0) +
    forfeitedLLDep;

  const paidSpread = paidPayments.reduce((acc, p) => acc + (Number(p.rent_spread_agency) || 0), 0);
  const paidMgmt = paidPayments.reduce((acc, p) => acc + (Number(p.other_landlord_expenses) || 0), 0);
  const forfeitedDepSpread = l.deposit_forfeited ? Math.max(0, Number(l.security_deposit || 0) - llDep) : 0.0;
  const totalAgencyProfit = (Number(l.agent_commission) || 0) + paidSpread + paidMgmt + forfeitedDepSpread;

  const docsList = parseLeaseDocs(l.documents, l.document_url);

  return {
    ...l,
    has_rent_spread: l.has_rent_spread || 0,
    landlord_monthly_rent: llRent,
    landlord_security_deposit: llDep,
    management_fee_percent: l.management_fee_percent != null ? l.management_fee_percent : 5.0,
    commission_deducted_upfront: l.commission_deducted_upfront != null ? l.commission_deducted_upfront : 1,
    deposit_forfeited: l.deposit_forfeited || 0,
    document_url: l.document_url || (docsList.length > 0 ? docsList[0].url : null),
    documents: docsList,
    unit_code: unit?.unit_code || null,
    project_name: unit?.project_name || null,
    landlord_name: landlord?.full_name || null,
    landlord_phone: landlord?.phone || null,
    landlord_bank_name: landlord?.bank_name || null,
    landlord_bank_account_no: landlord?.bank_account_no || null,
    tenant_name: tenant?.full_name || null,
    tenant_phone: tenant?.phone || null,
    days_remaining: calcDaysRemaining(l.end_date),
    payments_count: payments.length,
    paid_months_count: paidPayments.length,
    written_off_months_count: writtenOffPayments.length,
    monthly_rent_spread: monthlySpread,
    total_collected_from_tenant: totalCollected,
    total_landlord_expenses: totalLLExpenses,
    total_net_landlord_profit: totalNetProfit,
    total_agency_profit: totalAgencyProfit,
  };
}

function serializePayment(p: RentalPayment): any {
  const lease = db.prepare('SELECT contract_no FROM lease_contracts WHERE id = ?').get(p.lease_id) as any;
  const unit = db.prepare('SELECT unit_code, project_name FROM property_units WHERE id = ?').get(p.unit_id) as any;
  const landlord = db.prepare('SELECT full_name FROM contacts WHERE id = ?').get(p.landlord_id) as any;
  const tenant = db.prepare('SELECT full_name FROM contacts WHERE id = ?').get(p.tenant_id) as any;

  const base = Number(p.base_rent) || 0;
  const llBase = p.landlord_base_rent != null ? Number(p.landlord_base_rent) : base;

  return {
    ...p,
    contract_no: lease?.contract_no || null,
    unit_code: unit?.unit_code || null,
    project_name: unit?.project_name || null,
    landlord_name: landlord?.full_name || null,
    tenant_name: tenant?.full_name || null,
    withholding_tax_5_percent: Math.round(base * 0.05 * 100) / 100,
    landlord_withholding_tax_5_percent: Math.round(llBase * 0.05 * 100) / 100,
  };
}

function serializeIssue(i: UnitIssue): any {
  const unit = db.prepare('SELECT * FROM property_units WHERE id = ?').get(i.unit_id) as PropertyUnit | undefined;
  let devName: string | null = null;
  let llName: string | null = null;

  if (unit?.developer_id) {
    const d = db.prepare('SELECT company_name FROM developers WHERE id = ?').get(unit.developer_id) as any;
    devName = d?.company_name || null;
  }
  if (unit?.landlord_id) {
    const c = db.prepare('SELECT full_name FROM contacts WHERE id = ?').get(unit.landlord_id) as any;
    llName = c?.full_name || null;
  }

  let tenantName: string | null = null;
  if (i.lease_id) {
    const lease = db.prepare('SELECT tenant_id FROM lease_contracts WHERE id = ?').get(i.lease_id) as any;
    if (lease?.tenant_id) {
      const t = db.prepare('SELECT full_name FROM contacts WHERE id = ?').get(lease.tenant_id) as any;
      tenantName = t?.full_name || null;
    }
  }

  return {
    ...i,
    unit_code: unit?.unit_code || null,
    project_name: unit?.project_name || null,
    developer_name: devName,
    landlord_name: llName,
    tenant_name: tenantName,
    issue_images: parseJsonArray<string>(i.issue_images, []),
    issue_documents: parseJsonArray<any>(i.issue_documents, []),
  };
}

function serializeDeveloper(d: Developer): any {
  const units = db.prepare('SELECT id FROM property_units WHERE developer_id = ?').all(d.id) as { id: number }[];
  let warrantyOpen = 0;
  for (const u of units) {
    const c = db
      .prepare(
        "SELECT COUNT(*) as count FROM unit_issues WHERE unit_id = ? AND responsible_party = 'Developer Warranty' AND status NOT IN ('Resolved', 'Closed')"
      )
      .get(u.id) as any;
    warrantyOpen += c.count;
  }

  return {
    ...d,
    corporate_employees: parseJsonArray(d.corporate_employees, []),
    unit_count: units.length,
    open_warranty_issues: warrantyOpen,
  };
}

function matchVendorIssues(contact: Contact, allIssues: UnitIssue[]): UnitIssue[] {
  const terms = [
    (contact.full_name || '').trim().toLowerCase(),
    (contact.company_name || '').trim().toLowerCase(),
  ].filter((t) => t.length >= 3);

  if (terms.length === 0) return [];
  return allIssues.filter((iss) => {
    const v = (iss.vendor_or_contractor || '').trim().toLowerCase();
    if (!v) return false;
    return terms.some((t) => v.includes(t) || t.includes(v));
  });
}

function serializeContact(c: Contact, allIssues?: UnitIssue[]): any {
  const ownedUnits = db.prepare('SELECT id FROM property_units WHERE landlord_id = ?').all(c.id);
  const activeLL = (
    db
      .prepare(
        "SELECT COUNT(*) as count FROM lease_contracts WHERE landlord_id = ? AND status IN ('Active', 'Expiring Soon')"
      )
      .get(c.id) as any
  ).count;
  const activeTN = (
    db
      .prepare(
        "SELECT COUNT(*) as count FROM lease_contracts WHERE tenant_id = ? AND status IN ('Active', 'Expiring Soon')"
      )
      .get(c.id) as any
  ).count;

  let vendorJobs = 0;
  if (allIssues && c.role === 'VENDOR') {
    vendorJobs = matchVendorIssues(c, allIssues).length;
  }

  return {
    ...c,
    entity_type: c.entity_type || 'Individual',
    preferred_language: c.preferred_language || 'English',
    rating: c.rating ?? 5,
    corporate_employees: parseJsonArray(c.corporate_employees, []),
    owned_units_count: ownedUnits.length,
    active_leases_count: activeLL + activeTN,
    vendor_jobs_count: vendorJobs,
  };
}

function serializeComm(c: CommunicationLog): any {
  const contact = c.contact_id ? (db.prepare('SELECT full_name FROM contacts WHERE id = ?').get(c.contact_id) as any) : null;
  const developer = c.developer_id ? (db.prepare('SELECT company_name FROM developers WHERE id = ?').get(c.developer_id) as any) : null;
  const unit = c.unit_id ? (db.prepare('SELECT unit_code FROM property_units WHERE id = ?').get(c.unit_id) as any) : null;

  return {
    ...c,
    contact_name: contact?.full_name || null,
    developer_name: developer?.company_name || null,
    unit_code: unit?.unit_code || null,
  };
}

function serializeUser(u: AppUser): any {
  let perms = {};
  if (u.permissions) {
    if (typeof u.permissions === 'string') {
      try {
        perms = JSON.parse(u.permissions);
      } catch {
        perms = {};
      }
    } else {
      perms = u.permissions;
    }
  }

  return {
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    role: u.role,
    department: u.department,
    phone: u.phone,
    status: u.status,
    avatar_url: u.avatar_url,
    last_login: u.last_login || 'Never',
    created_at: u.created_at,
    permissions: perms,
  };
}

// ==========================================
// API ROUTE HANDLERS
// ==========================================

// --- Dashboard ---
app.get('/api/dashboard', (_req: Request, res: Response) => {
  const units = db.prepare('SELECT * FROM property_units').all() as PropertyUnit[];
  const leases = db.prepare('SELECT * FROM lease_contracts').all() as LeaseContract[];
  const issues = db.prepare('SELECT * FROM unit_issues ORDER BY id DESC').all() as UnitIssue[];
  const contacts = db.prepare('SELECT * FROM contacts').all() as Contact[];
  const developers = db.prepare('SELECT * FROM developers').all() as Developer[];
  const comms = db.prepare('SELECT * FROM communication_logs ORDER BY created_at DESC LIMIT 8').all() as CommunicationLog[];

  const totalUnits = units.length;
  const occupiedUnits = units.filter((u) => u.status === 'Occupied').length;
  const availableUnits = units.filter((u) => u.status === 'Available').length;
  const maintenanceUnits = units.filter((u) => u.status === 'Under Maintenance').length;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 1000) / 10 : 0.0;

  const activeLeases = leases.filter((l) => ['Active', 'Expiring Soon'].includes(l.status));
  const monthlyRentVolume = activeLeases.reduce((acc, l) => acc + (Number(l.monthly_rent) || 0), 0);

  const expiringLeases = activeLeases
    .filter((l) => {
      const days = calcDaysRemaining(l.end_date);
      return days !== null && days <= 60;
    })
    .map(serializeLease);

  const openIssues = issues.filter((i) => !['Resolved', 'Closed'].includes(i.status));
  const warrantyIssues = openIssues.filter((i) => i.responsible_party === 'Developer Warranty');

  res.json({
    metrics: {
      total_units: totalUnits,
      occupied_units: occupiedUnits,
      available_units: availableUnits,
      maintenance_units: maintenanceUnits,
      occupancy_rate: occupancyRate,
      active_leases_count: activeLeases.length,
      monthly_rent_volume: monthlyRentVolume,
      expiring_leases_count: expiringLeases.length,
      open_issues_count: openIssues.length,
      open_warranty_issues_count: warrantyIssues.length,
      landlords_count: contacts.filter((c) => ['LANDLORD', 'BOTH'].includes(c.role)).length,
      tenants_count: contacts.filter((c) => ['TENANT', 'BOTH'].includes(c.role)).length,
      developers_count: developers.length,
    },
    expiring_leases: expiringLeases,
    open_issues: openIssues.slice(0, 6).map(serializeIssue),
    recent_communications: comms.map(serializeComm),
  });
});

// --- Developers ---
app.get('/api/developers', (_req: Request, res: Response) => {
  const devs = db.prepare('SELECT * FROM developers ORDER BY company_name ASC').all() as Developer[];
  res.json(devs.map(serializeDeveloper));
});

app.get('/api/developers/:id/details', (req: Request, res: Response) => {
  const devId = Number(req.params.id);
  const dev = db.prepare('SELECT * FROM developers WHERE id = ?').get(devId) as Developer | undefined;
  if (!dev) return res.status(404).json({ detail: 'Developer not found' });

  const units = db.prepare('SELECT * FROM property_units WHERE developer_id = ?').all(devId) as PropertyUnit[];
  const unitIds = units.map((u) => u.id);

  let issues: UnitIssue[] = [];
  if (unitIds.length > 0) {
    const placeholders = unitIds.map(() => '?').join(',');
    issues = db.prepare(`SELECT * FROM unit_issues WHERE unit_id IN (${placeholders})`).all(...unitIds) as UnitIssue[];
  }

  const comms = db
    .prepare('SELECT * FROM communication_logs WHERE developer_id = ? ORDER BY created_at DESC')
    .all(devId) as CommunicationLog[];

  res.json({
    developer: serializeDeveloper(dev),
    units: units.map(serializeUnit),
    issues: issues.map(serializeIssue),
    communications: comms.map(serializeComm),
  });
});

app.post('/api/developers', (req: Request, res: Response) => {
  const body = req.body;
  const corporateEmployees = JSON.stringify(body.corporate_employees || []);

  const info = db
    .prepare(`
      INSERT INTO developers (
        company_name, contact_person, phone, email, line_id,
        address, warranty_policy, defect_contact_info, notes, corporate_employees
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      body.company_name,
      body.contact_person,
      body.phone,
      body.email,
      body.line_id,
      body.address,
      body.warranty_policy,
      body.defect_contact_info,
      body.notes,
      corporateEmployees
    );

  const dev = db.prepare('SELECT * FROM developers WHERE id = ?').get(info.lastInsertRowid) as Developer;
  res.json(serializeDeveloper(dev));
});

app.put('/api/developers/:id', (req: Request, res: Response) => {
  const devId = Number(req.params.id);
  const dev = db.prepare('SELECT * FROM developers WHERE id = ?').get(devId) as Developer | undefined;
  if (!dev) return res.status(404).json({ detail: 'Developer not found' });

  const body = req.body;
  const corporateEmployees =
    body.corporate_employees !== undefined ? JSON.stringify(body.corporate_employees) : dev.corporate_employees;

  db.prepare(`
    UPDATE developers SET
      company_name = ?, contact_person = ?, phone = ?, email = ?, line_id = ?,
      address = ?, warranty_policy = ?, defect_contact_info = ?, notes = ?, corporate_employees = ?
    WHERE id = ?
  `).run(
    body.company_name !== undefined ? body.company_name : dev.company_name,
    body.contact_person !== undefined ? body.contact_person : dev.contact_person,
    body.phone !== undefined ? body.phone : dev.phone,
    body.email !== undefined ? body.email : dev.email,
    body.line_id !== undefined ? body.line_id : dev.line_id,
    body.address !== undefined ? body.address : dev.address,
    body.warranty_policy !== undefined ? body.warranty_policy : dev.warranty_policy,
    body.defect_contact_info !== undefined ? body.defect_contact_info : dev.defect_contact_info,
    body.notes !== undefined ? body.notes : dev.notes,
    corporateEmployees,
    devId
  );

  const updated = db.prepare('SELECT * FROM developers WHERE id = ?').get(devId) as Developer;
  res.json(serializeDeveloper(updated));
});

app.delete('/api/developers/:id', (req: Request, res: Response) => {
  const devId = Number(req.params.id);
  db.prepare('DELETE FROM developers WHERE id = ?').run(devId);
  res.json({ ok: true });
});

// --- Contacts ---
app.get('/api/contacts', (req: Request, res: Response) => {
  const role = req.query.role as string | undefined;
  let query = 'SELECT * FROM contacts';
  const params: any[] = [];

  if (role === 'LANDLORD') {
    query += " WHERE role IN ('LANDLORD', 'BOTH')";
  } else if (role === 'TENANT') {
    query += " WHERE role IN ('TENANT', 'BOTH')";
  } else if (role === 'VENDOR') {
    query += " WHERE role = 'VENDOR'";
  }
  query += ' ORDER BY full_name ASC';

  const contacts = db.prepare(query).all(...params) as Contact[];
  const allIssues = db.prepare('SELECT * FROM unit_issues').all() as UnitIssue[];
  res.json(contacts.map((c) => serializeContact(c, allIssues)));
});

app.get('/api/contacts/:id/details', (req: Request, res: Response) => {
  const contactId = Number(req.params.id);
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contactId) as Contact | undefined;
  if (!contact) return res.status(404).json({ detail: 'Contact not found' });

  const allIssues = db.prepare('SELECT * FROM unit_issues ORDER BY reported_date DESC').all() as UnitIssue[];
  const ownedUnits = db.prepare('SELECT * FROM property_units WHERE landlord_id = ?').all(contactId) as PropertyUnit[];
  const leases = db
    .prepare('SELECT * FROM lease_contracts WHERE landlord_id = ? OR tenant_id = ?')
    .all(contactId, contactId) as LeaseContract[];

  const comms = db
    .prepare('SELECT * FROM communication_logs WHERE contact_id = ? ORDER BY created_at DESC')
    .all(contactId) as CommunicationLog[];

  // Related issues (from owned units or active leases)
  const unitIds = ownedUnits.map((u) => u.id);
  const leaseIds = leases.map((l) => l.id);
  const relatedIssues: UnitIssue[] = [];
  const seenIssueIds = new Set<number>();

  for (const iss of allIssues) {
    if (
      (unitIds.includes(iss.unit_id) || (iss.lease_id && leaseIds.includes(iss.lease_id))) &&
      !seenIssueIds.has(iss.id)
    ) {
      seenIssueIds.add(iss.id);
      relatedIssues.push(iss);
    }
  }

  if (contact.role === 'VENDOR') {
    for (const vIss of matchVendorIssues(contact, allIssues)) {
      if (!seenIssueIds.has(vIss.id)) {
        seenIssueIds.add(vIss.id);
        relatedIssues.push(vIss);
      }
    }
  }

  res.json({
    contact: serializeContact(contact, allIssues),
    owned_units: ownedUnits.map(serializeUnit),
    leases: leases.map(serializeLease),
    issues: relatedIssues.map(serializeIssue),
    communications: comms.map(serializeComm),
  });
});

app.post('/api/contacts', (req: Request, res: Response) => {
  const body = req.body;
  const corporateEmployees = JSON.stringify(body.corporate_employees || []);

  const info = db
    .prepare(`
      INSERT INTO contacts (
        role, entity_type, full_name, company_name, tax_id,
        service_category, phone, email, line_or_whatsapp, nationality,
        id_or_passport, bank_name, bank_account_no, bank_account_info,
        preferred_language, rating, notes, corporate_employees
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      body.role,
      body.entity_type || 'Individual',
      body.full_name,
      body.company_name,
      body.tax_id,
      body.service_category,
      body.phone,
      body.email,
      body.line_or_whatsapp,
      body.nationality,
      body.id_or_passport,
      body.bank_name,
      body.bank_account_no,
      body.bank_account_info,
      body.preferred_language || 'English',
      body.rating !== undefined ? body.rating : 5,
      body.notes,
      corporateEmployees
    );

  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(info.lastInsertRowid) as Contact;
  const allIssues = db.prepare('SELECT * FROM unit_issues').all() as UnitIssue[];
  res.json(serializeContact(contact, allIssues));
});

app.put('/api/contacts/:id', (req: Request, res: Response) => {
  const contactId = Number(req.params.id);
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contactId) as Contact | undefined;
  if (!contact) return res.status(404).json({ detail: 'Contact not found' });

  const body = req.body;
  const corporateEmployees =
    body.corporate_employees !== undefined ? JSON.stringify(body.corporate_employees) : contact.corporate_employees;

  db.prepare(`
    UPDATE contacts SET
      role = ?, entity_type = ?, full_name = ?, company_name = ?, tax_id = ?,
      service_category = ?, phone = ?, email = ?, line_or_whatsapp = ?, nationality = ?,
      id_or_passport = ?, bank_name = ?, bank_account_no = ?, bank_account_info = ?,
      preferred_language = ?, rating = ?, notes = ?, corporate_employees = ?
    WHERE id = ?
  `).run(
    body.role !== undefined ? body.role : contact.role,
    body.entity_type !== undefined ? body.entity_type : contact.entity_type,
    body.full_name !== undefined ? body.full_name : contact.full_name,
    body.company_name !== undefined ? body.company_name : contact.company_name,
    body.tax_id !== undefined ? body.tax_id : contact.tax_id,
    body.service_category !== undefined ? body.service_category : contact.service_category,
    body.phone !== undefined ? body.phone : contact.phone,
    body.email !== undefined ? body.email : contact.email,
    body.line_or_whatsapp !== undefined ? body.line_or_whatsapp : contact.line_or_whatsapp,
    body.nationality !== undefined ? body.nationality : contact.nationality,
    body.id_or_passport !== undefined ? body.id_or_passport : contact.id_or_passport,
    body.bank_name !== undefined ? body.bank_name : contact.bank_name,
    body.bank_account_no !== undefined ? body.bank_account_no : contact.bank_account_no,
    body.bank_account_info !== undefined ? body.bank_account_info : contact.bank_account_info,
    body.preferred_language !== undefined ? body.preferred_language : contact.preferred_language,
    body.rating !== undefined ? body.rating : contact.rating,
    body.notes !== undefined ? body.notes : contact.notes,
    corporateEmployees,
    contactId
  );

  const updated = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contactId) as Contact;
  const allIssues = db.prepare('SELECT * FROM unit_issues').all() as UnitIssue[];
  res.json(serializeContact(updated, allIssues));
});

app.delete('/api/contacts/:id', (req: Request, res: Response) => {
  const contactId = Number(req.params.id);
  db.prepare('DELETE FROM contacts WHERE id = ?').run(contactId);
  res.json({ ok: true });
});

// --- Property Units ---
app.get('/api/units', (_req: Request, res: Response) => {
  const units = db.prepare('SELECT * FROM property_units ORDER BY unit_code ASC').all() as PropertyUnit[];
  res.json(units.map(serializeUnit));
});

app.get('/api/units/:id/details', (req: Request, res: Response) => {
  const unitId = Number(req.params.id);
  const unit = db.prepare('SELECT * FROM property_units WHERE id = ?').get(unitId) as PropertyUnit | undefined;
  if (!unit) return res.status(404).json({ detail: 'Property unit not found' });

  const developer = unit.developer_id
    ? (db.prepare('SELECT * FROM developers WHERE id = ?').get(unit.developer_id) as Developer)
    : null;
  const landlord = unit.landlord_id
    ? (db.prepare('SELECT * FROM contacts WHERE id = ?').get(unit.landlord_id) as Contact)
    : null;

  const leases = db
    .prepare('SELECT * FROM lease_contracts WHERE unit_id = ? ORDER BY start_date DESC')
    .all(unitId) as LeaseContract[];
  const issues = db
    .prepare('SELECT * FROM unit_issues WHERE unit_id = ? ORDER BY reported_date DESC')
    .all(unitId) as UnitIssue[];
  const comms = db
    .prepare('SELECT * FROM communication_logs WHERE unit_id = ? ORDER BY created_at DESC')
    .all(unitId) as CommunicationLog[];

  res.json({
    unit: serializeUnit(unit),
    developer: developer ? serializeDeveloper(developer) : null,
    landlord: landlord ? serializeContact(landlord) : null,
    leases: leases.map(serializeLease),
    issues: issues.map(serializeIssue),
    communications: comms.map(serializeComm),
  });
});

app.post('/api/units', (req: Request, res: Response) => {
  const body = req.body;
  const gallery = parseGallery(JSON.stringify(body.gallery_images || []), body.image_url);
  const coverUrl = body.image_url || (gallery.length > 0 ? gallery[0] : null);

  const info = db
    .prepare(`
      INSERT INTO property_units (
        unit_code, project_name, city, property_category, property_type,
        building, floor, bedrooms, bathrooms, size_sqm,
        furnishing, status, listing_type, target_rent_price, target_sale_price,
        developer_id, landlord_id, handover_date, defect_warranty_expiry,
        electric_meter_no, water_meter_no, keycard_inventory, parking_slot,
        listing_headline, description_summary, amenities_highlights,
        co_broke_terms, agent_internal_notes, juristic_cam_fee_sqm,
        juristic_annual_estimate, juristic_office_contact, image_url, gallery_images
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?
      )
    `)
    .run(
      body.unit_code,
      body.project_name,
      body.city || 'Bangkok',
      body.property_category || 'Residential',
      body.property_type || 'Condominium',
      body.building,
      body.floor,
      body.bedrooms ?? 1,
      body.bathrooms ?? 1,
      body.size_sqm,
      body.furnishing || 'Fully Furnished',
      body.status || 'Available',
      body.listing_type || 'Rent & Sale',
      body.target_rent_price || 0.0,
      body.target_sale_price || 0.0,
      body.developer_id || null,
      body.landlord_id || null,
      body.handover_date,
      body.defect_warranty_expiry,
      body.electric_meter_no,
      body.water_meter_no,
      body.keycard_inventory,
      body.parking_slot,
      body.listing_headline,
      body.description_summary,
      body.amenities_highlights,
      body.co_broke_terms,
      body.agent_internal_notes,
      body.juristic_cam_fee_sqm || 0.0,
      body.juristic_annual_estimate || 0.0,
      body.juristic_office_contact,
      coverUrl,
      JSON.stringify(gallery)
    );

  const unit = db.prepare('SELECT * FROM property_units WHERE id = ?').get(info.lastInsertRowid) as PropertyUnit;
  res.json(serializeUnit(unit));
});

app.put('/api/units/:id', (req: Request, res: Response) => {
  const unitId = Number(req.params.id);
  const unit = db.prepare('SELECT * FROM property_units WHERE id = ?').get(unitId) as PropertyUnit | undefined;
  if (!unit) return res.status(404).json({ detail: 'Unit not found' });

  const body = req.body;
  let gallery = unit.gallery_images ? parseJsonArray<string>(unit.gallery_images, []) : [];
  if (body.gallery_images !== undefined) {
    gallery = parseGallery(JSON.stringify(body.gallery_images), body.image_url || unit.image_url);
  }
  const coverUrl = body.image_url !== undefined ? body.image_url : unit.image_url;

  db.prepare(`
    UPDATE property_units SET
      unit_code = ?, project_name = ?, city = ?, property_category = ?, property_type = ?,
      building = ?, floor = ?, bedrooms = ?, bathrooms = ?, size_sqm = ?,
      furnishing = ?, status = ?, listing_type = ?, target_rent_price = ?, target_sale_price = ?,
      developer_id = ?, landlord_id = ?, handover_date = ?, defect_warranty_expiry = ?,
      electric_meter_no = ?, water_meter_no = ?, keycard_inventory = ?, parking_slot = ?,
      listing_headline = ?, description_summary = ?, amenities_highlights = ?,
      co_broke_terms = ?, agent_internal_notes = ?, juristic_cam_fee_sqm = ?,
      juristic_annual_estimate = ?, juristic_office_contact = ?, image_url = ?, gallery_images = ?
    WHERE id = ?
  `).run(
    body.unit_code !== undefined ? body.unit_code : unit.unit_code,
    body.project_name !== undefined ? body.project_name : unit.project_name,
    body.city !== undefined ? body.city : unit.city,
    body.property_category !== undefined ? body.property_category : unit.property_category,
    body.property_type !== undefined ? body.property_type : unit.property_type,
    body.building !== undefined ? body.building : unit.building,
    body.floor !== undefined ? body.floor : unit.floor,
    body.bedrooms !== undefined ? body.bedrooms : unit.bedrooms,
    body.bathrooms !== undefined ? body.bathrooms : unit.bathrooms,
    body.size_sqm !== undefined ? body.size_sqm : unit.size_sqm,
    body.furnishing !== undefined ? body.furnishing : unit.furnishing,
    body.status !== undefined ? body.status : unit.status,
    body.listing_type !== undefined ? body.listing_type : unit.listing_type,
    body.target_rent_price !== undefined ? body.target_rent_price : unit.target_rent_price,
    body.target_sale_price !== undefined ? body.target_sale_price : unit.target_sale_price,
    body.developer_id !== undefined ? body.developer_id : unit.developer_id,
    body.landlord_id !== undefined ? body.landlord_id : unit.landlord_id,
    body.handover_date !== undefined ? body.handover_date : unit.handover_date,
    body.defect_warranty_expiry !== undefined ? body.defect_warranty_expiry : unit.defect_warranty_expiry,
    body.electric_meter_no !== undefined ? body.electric_meter_no : unit.electric_meter_no,
    body.water_meter_no !== undefined ? body.water_meter_no : unit.water_meter_no,
    body.keycard_inventory !== undefined ? body.keycard_inventory : unit.keycard_inventory,
    body.parking_slot !== undefined ? body.parking_slot : unit.parking_slot,
    body.listing_headline !== undefined ? body.listing_headline : unit.listing_headline,
    body.description_summary !== undefined ? body.description_summary : unit.description_summary,
    body.amenities_highlights !== undefined ? body.amenities_highlights : unit.amenities_highlights,
    body.co_broke_terms !== undefined ? body.co_broke_terms : unit.co_broke_terms,
    body.agent_internal_notes !== undefined ? body.agent_internal_notes : unit.agent_internal_notes,
    body.juristic_cam_fee_sqm !== undefined ? body.juristic_cam_fee_sqm : unit.juristic_cam_fee_sqm,
    body.juristic_annual_estimate !== undefined ? body.juristic_annual_estimate : unit.juristic_annual_estimate,
    body.juristic_office_contact !== undefined ? body.juristic_office_contact : unit.juristic_office_contact,
    coverUrl,
    JSON.stringify(gallery),
    unitId
  );

  const updated = db.prepare('SELECT * FROM property_units WHERE id = ?').get(unitId) as PropertyUnit;
  res.json(serializeUnit(updated));
});

app.delete('/api/units/:id', (req: Request, res: Response) => {
  const unitId = Number(req.params.id);
  db.prepare('DELETE FROM property_units WHERE id = ?').run(unitId);
  res.json({ ok: true });
});

// --- Lease Contracts ---
app.get('/api/leases', (_req: Request, res: Response) => {
  const leases = db.prepare('SELECT * FROM lease_contracts ORDER BY end_date ASC').all() as LeaseContract[];
  for (const l of leases) {
    syncLeaseMonthlySchedule(l);
  }
  res.json(leases.map(serializeLease));
});

app.post('/api/leases', (req: Request, res: Response) => {
  const body = req.body;
  const docs = parseLeaseDocs(JSON.stringify(body.documents || []), body.document_url);
  const docUrl = body.document_url || (docs.length > 0 ? docs[0].url : null);

  const tnRent = Number(body.monthly_rent) || 0;
  const hasSpread = Number(body.has_rent_spread) === 1;
  const llRent = hasSpread && body.landlord_monthly_rent ? Number(body.landlord_monthly_rent) : tnRent;
  const llDep = body.landlord_security_deposit != null ? Number(body.landlord_security_deposit) : Number(body.security_deposit || 0);

  const info = db
    .prepare(`
      INSERT INTO lease_contracts (
        contract_no, unit_id, landlord_id, tenant_id, start_date, end_date,
        monthly_rent, has_rent_spread, landlord_monthly_rent,
        security_deposit, landlord_security_deposit, advance_rent, payment_due_day,
        agent_commission, management_fee_percent, commission_deducted_upfront,
        deposit_forfeited, status, inventory_checklist_signed, special_terms,
        document_url, documents
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?
      )
    `)
    .run(
      body.contract_no,
      body.unit_id,
      body.landlord_id,
      body.tenant_id,
      body.start_date,
      body.end_date,
      tnRent,
      hasSpread ? 1 : 0,
      llRent,
      body.security_deposit,
      llDep,
      body.advance_rent || 0.0,
      body.payment_due_day || 5,
      body.agent_commission || 0.0,
      body.management_fee_percent != null ? body.management_fee_percent : 5.0,
      body.commission_deducted_upfront != null ? body.commission_deducted_upfront : 1,
      0,
      body.status || 'Active',
      body.inventory_checklist_signed || 'Pending',
      body.special_terms,
      docUrl,
      JSON.stringify(docs)
    );

  const leaseId = Number(info.lastInsertRowid);
  const lease = db.prepare('SELECT * FROM lease_contracts WHERE id = ?').get(leaseId) as LeaseContract;

  if (['Active', 'Expiring Soon'].includes(lease.status)) {
    db.prepare("UPDATE property_units SET status = 'Occupied' WHERE id = ?").run(lease.unit_id);
  }

  syncLeaseMonthlySchedule(lease);
  res.json(serializeLease(lease));
});

app.put('/api/leases/:id', (req: Request, res: Response) => {
  const leaseId = Number(req.params.id);
  const lease = db.prepare('SELECT * FROM lease_contracts WHERE id = ?').get(leaseId) as LeaseContract | undefined;
  if (!lease) return res.status(404).json({ detail: 'Lease contract not found' });

  const body = req.body;
  let docs: any[] = lease.documents ? parseJsonArray(lease.documents, []) : [];
  if (body.documents !== undefined) {
    docs = parseLeaseDocs(JSON.stringify(body.documents), body.document_url || lease.document_url);
  }
  const docUrl = body.document_url !== undefined ? body.document_url : lease.document_url;

  const tnRent = body.monthly_rent !== undefined ? Number(body.monthly_rent) : Number(lease.monthly_rent);
  const hasSpread =
    body.has_rent_spread !== undefined ? (Number(body.has_rent_spread) === 1 ? 1 : 0) : lease.has_rent_spread;
  const llRent =
    hasSpread === 1 && body.landlord_monthly_rent !== undefined
      ? Number(body.landlord_monthly_rent)
      : hasSpread === 1 && lease.landlord_monthly_rent
      ? Number(lease.landlord_monthly_rent)
      : tnRent;

  db.prepare(`
    UPDATE lease_contracts SET
      contract_no = ?, unit_id = ?, landlord_id = ?, tenant_id = ?, start_date = ?, end_date = ?,
      monthly_rent = ?, has_rent_spread = ?, landlord_monthly_rent = ?,
      security_deposit = ?, landlord_security_deposit = ?, advance_rent = ?, payment_due_day = ?,
      agent_commission = ?, management_fee_percent = ?, commission_deducted_upfront = ?,
      deposit_forfeited = ?, status = ?, inventory_checklist_signed = ?, special_terms = ?,
      document_url = ?, documents = ?
    WHERE id = ?
  `).run(
    body.contract_no !== undefined ? body.contract_no : lease.contract_no,
    body.unit_id !== undefined ? body.unit_id : lease.unit_id,
    body.landlord_id !== undefined ? body.landlord_id : lease.landlord_id,
    body.tenant_id !== undefined ? body.tenant_id : lease.tenant_id,
    body.start_date !== undefined ? body.start_date : lease.start_date,
    body.end_date !== undefined ? body.end_date : lease.end_date,
    tnRent,
    hasSpread,
    llRent,
    body.security_deposit !== undefined ? body.security_deposit : lease.security_deposit,
    body.landlord_security_deposit !== undefined ? body.landlord_security_deposit : lease.landlord_security_deposit,
    body.advance_rent !== undefined ? body.advance_rent : lease.advance_rent,
    body.payment_due_day !== undefined ? body.payment_due_day : lease.payment_due_day,
    body.agent_commission !== undefined ? body.agent_commission : lease.agent_commission,
    body.management_fee_percent !== undefined ? body.management_fee_percent : lease.management_fee_percent,
    body.commission_deducted_upfront !== undefined
      ? body.commission_deducted_upfront
      : lease.commission_deducted_upfront,
    body.deposit_forfeited !== undefined ? body.deposit_forfeited : lease.deposit_forfeited,
    body.status !== undefined ? body.status : lease.status,
    body.inventory_checklist_signed !== undefined
      ? body.inventory_checklist_signed
      : lease.inventory_checklist_signed,
    body.special_terms !== undefined ? body.special_terms : lease.special_terms,
    docUrl,
    JSON.stringify(docs),
    leaseId
  );

  const updated = db.prepare('SELECT * FROM lease_contracts WHERE id = ?').get(leaseId) as LeaseContract;
  syncLeaseMonthlySchedule(updated);
  res.json(serializeLease(updated));
});

app.patch('/api/leases/:id/terms', (req: Request, res: Response) => {
  const leaseId = Number(req.params.id);
  const lease = db.prepare('SELECT * FROM lease_contracts WHERE id = ?').get(leaseId) as LeaseContract | undefined;
  if (!lease) return res.status(404).json({ detail: 'Lease contract not found' });

  const body = req.body;
  const tnRent = body.monthly_rent !== undefined ? Number(body.monthly_rent) : Number(lease.monthly_rent);
  const hasSpread =
    body.has_rent_spread !== undefined ? (Number(body.has_rent_spread) === 1 ? 1 : 0) : lease.has_rent_spread;
  const llRent =
    hasSpread === 1 && body.landlord_monthly_rent !== undefined
      ? Number(body.landlord_monthly_rent)
      : hasSpread === 1 && lease.landlord_monthly_rent
      ? Number(lease.landlord_monthly_rent)
      : tnRent;

  db.prepare(`
    UPDATE lease_contracts SET
      start_date = ?, end_date = ?, monthly_rent = ?, security_deposit = ?,
      has_rent_spread = ?, landlord_monthly_rent = ?, landlord_security_deposit = ?,
      agent_commission = ?, management_fee_percent = ?, payment_due_day = ?, status = ?
    WHERE id = ?
  `).run(
    body.start_date || lease.start_date,
    body.end_date || lease.end_date,
    tnRent,
    body.security_deposit !== undefined ? body.security_deposit : lease.security_deposit,
    hasSpread,
    llRent,
    body.landlord_security_deposit !== undefined ? body.landlord_security_deposit : lease.landlord_security_deposit,
    body.agent_commission !== undefined ? body.agent_commission : lease.agent_commission,
    body.management_fee_percent !== undefined ? body.management_fee_percent : lease.management_fee_percent,
    body.payment_due_day !== undefined ? body.payment_due_day : lease.payment_due_day,
    body.status || lease.status,
    leaseId
  );

  const updated = db.prepare('SELECT * FROM lease_contracts WHERE id = ?').get(leaseId) as LeaseContract;
  syncLeaseMonthlySchedule(updated);
  res.json(serializeLease(updated));
});

app.post('/api/leases/:id/early-terminate', (req: Request, res: Response) => {
  const leaseId = Number(req.params.id);
  const lease = db.prepare('SELECT * FROM lease_contracts WHERE id = ?').get(leaseId) as LeaseContract | undefined;
  if (!lease) return res.status(404).json({ detail: 'Lease contract not found' });

  const body = req.body;
  const forfeit = body.forfeit_deposit ? 1 : 0;
  const note = body.early_termination_note || 'Early termination — remaining pending rent written off and deposit forfeited.';

  db.prepare(`
    UPDATE lease_contracts SET
      status = 'Terminated',
      early_termination_date = ?,
      early_termination_note = ?,
      deposit_forfeited = ?
    WHERE id = ?
  `).run(body.early_termination_date, note, forfeit, leaseId);

  // Write off all remaining Pending / Overdue months
  db.prepare(`
    UPDATE rental_payments SET
      status = 'Written Off',
      paid_date = NULL,
      amount_collected_from_tenant = 0.0,
      net_payout_to_landlord = 0.0,
      other_landlord_expenses = 0.0,
      expense_breakdown_note = ?
    WHERE lease_id = ? AND status IN ('Pending', 'Overdue')
  `).run(`Written off due to Early Termination (${body.early_termination_date})`, leaseId);

  // Make property unit Available
  db.prepare("UPDATE property_units SET status = 'Available' WHERE id = ? AND status = 'Occupied'").run(lease.unit_id);

  const updated = db.prepare('SELECT * FROM lease_contracts WHERE id = ?').get(leaseId) as LeaseContract;
  res.json(serializeLease(updated));
});

app.post('/api/leases/:id/restore-terminated', (req: Request, res: Response) => {
  const leaseId = Number(req.params.id);
  const lease = db.prepare('SELECT * FROM lease_contracts WHERE id = ?').get(leaseId) as LeaseContract | undefined;
  if (!lease) return res.status(404).json({ detail: 'Lease contract not found' });

  db.prepare(`
    UPDATE lease_contracts SET
      status = 'Active',
      deposit_forfeited = 0,
      early_termination_date = NULL,
      early_termination_note = NULL
    WHERE id = ?
  `).run(leaseId);

  const llRent = Number(lease.landlord_monthly_rent || lease.monthly_rent || 0);
  const tnRent = Number(lease.monthly_rent || 0);
  const mgmtPct = Number(lease.management_fee_percent != null ? lease.management_fee_percent : 5.0);
  const mgmtFee = Math.round((llRent * mgmtPct) / 100);

  db.prepare(`
    UPDATE rental_payments SET
      status = 'Pending',
      base_rent = ?,
      landlord_base_rent = ?,
      rent_spread_agency = ?,
      amount_collected_from_tenant = ?,
      other_landlord_expenses = ?,
      net_payout_to_landlord = ?,
      expense_breakdown_note = ?
    WHERE lease_id = ? AND status = 'Written Off'
  `).run(
    tnRent,
    llRent,
    Math.max(0, tnRent - llRent),
    tnRent,
    mgmtFee,
    Math.max(0, llRent - mgmtFee),
    `${mgmtPct}% Monthly Management Fee on ฿${llRent.toLocaleString()}`,
    leaseId
  );

  const updated = db.prepare('SELECT * FROM lease_contracts WHERE id = ?').get(leaseId) as LeaseContract;
  res.json(serializeLease(updated));
});

app.delete('/api/leases/:id', (req: Request, res: Response) => {
  const leaseId = Number(req.params.id);
  db.prepare('DELETE FROM lease_contracts WHERE id = ?').run(leaseId);
  res.json({ ok: true });
});

// --- Lease Statement of Account (SOA) ---
app.get('/api/leases/:id/statement', (req: Request, res: Response) => {
  try {
    const leaseId = Number(req.params.id);
    const statement = calculateLeaseStatement(leaseId);
    res.json(statement);
  } catch (err: any) {
    res.status(404).json({ detail: err.message || 'Lease contract not found' });
  }
});

// --- Payments ---
app.get('/api/payments', (req: Request, res: Response) => {
  const { lease_id, landlord_id, tenant_id } = req.query;
  let query = 'SELECT * FROM rental_payments WHERE 1=1';
  const params: (string | number)[] = [];

  if (lease_id) {
    query += ' AND lease_id = ?';
    params.push(Number(lease_id));
  }
  if (landlord_id) {
    query += ' AND landlord_id = ?';
    params.push(Number(landlord_id));
  }
  if (tenant_id) {
    query += ' AND tenant_id = ?';
    params.push(Number(tenant_id));
  }
  query += ' ORDER BY billing_month ASC';

  const rows = db.prepare(query).all(...(params as any)) as RentalPayment[];
  res.json(rows.map(serializePayment));
});

app.post('/api/payments', (req: Request, res: Response) => {
  const body = req.body;
  const info = db
    .prepare(`
      INSERT INTO rental_payments (
        receipt_no, lease_id, unit_id, landlord_id, tenant_id,
        billing_month, due_date, paid_date, status,
        base_rent, landlord_base_rent, rent_spread_agency,
        tenant_extra_charges, tenant_charges_note,
        amount_collected_from_tenant, landlord_repair_deduction,
        other_landlord_expenses, expense_breakdown_note,
        net_payout_to_landlord, payment_method, proof_document_url
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?
      )
    `)
    .run(
      body.receipt_no,
      body.lease_id,
      body.unit_id,
      body.landlord_id,
      body.tenant_id,
      body.billing_month,
      body.due_date,
      body.paid_date,
      body.status || 'Pending',
      body.base_rent || 0.0,
      body.landlord_base_rent || 0.0,
      body.rent_spread_agency || 0.0,
      body.tenant_extra_charges || 0.0,
      body.tenant_charges_note,
      body.amount_collected_from_tenant || 0.0,
      body.landlord_repair_deduction || 0.0,
      body.other_landlord_expenses || 0.0,
      body.expense_breakdown_note,
      body.net_payout_to_landlord || 0.0,
      body.payment_method || 'Bank Transfer',
      body.proof_document_url
    );

  const payment = db.prepare('SELECT * FROM rental_payments WHERE id = ?').get(info.lastInsertRowid) as RentalPayment;
  res.json(serializePayment(payment));
});

app.put('/api/payments/:id', (req: Request, res: Response) => {
  const paymentId = Number(req.params.id);
  const p = db.prepare('SELECT * FROM rental_payments WHERE id = ?').get(paymentId) as RentalPayment | undefined;
  if (!p) return res.status(404).json({ detail: 'Payment record not found' });

  const body = req.body;
  let receiptNo = body.receipt_no !== undefined ? body.receipt_no : p.receipt_no;
  let paidDate = body.paid_date !== undefined ? body.paid_date : p.paid_date;

  if (['Paid & Settled', 'Collected (Pending Payout)', 'Paid'].includes(body.status)) {
    if (!paidDate) paidDate = new Date().toISOString().split('T')[0];
    if (receiptNo.startsWith('SCH-')) {
      receiptNo = 'RCP-' + receiptNo.substring(4);
    }
  }

  const baseRent = body.base_rent !== undefined ? Number(body.base_rent) : Number(p.base_rent);
  const llBaseRent = body.landlord_base_rent !== undefined ? Number(body.landlord_base_rent) : Number(p.landlord_base_rent);
  const spread = Math.max(0, baseRent - llBaseRent);

  db.prepare(`
    UPDATE rental_payments SET
      receipt_no = ?, due_date = ?, paid_date = ?, status = ?,
      base_rent = ?, landlord_base_rent = ?, rent_spread_agency = ?,
      tenant_extra_charges = ?, tenant_charges_note = ?,
      amount_collected_from_tenant = ?, landlord_repair_deduction = ?,
      other_landlord_expenses = ?, expense_breakdown_note = ?,
      net_payout_to_landlord = ?, payment_method = ?, proof_document_url = ?
    WHERE id = ?
  `).run(
    receiptNo,
    body.due_date !== undefined ? body.due_date : p.due_date,
    paidDate,
    body.status !== undefined ? body.status : p.status,
    baseRent,
    llBaseRent,
    spread,
    body.tenant_extra_charges !== undefined ? body.tenant_extra_charges : p.tenant_extra_charges,
    body.tenant_charges_note !== undefined ? body.tenant_charges_note : p.tenant_charges_note,
    body.amount_collected_from_tenant !== undefined ? body.amount_collected_from_tenant : p.amount_collected_from_tenant,
    body.landlord_repair_deduction !== undefined ? body.landlord_repair_deduction : p.landlord_repair_deduction,
    body.other_landlord_expenses !== undefined ? body.other_landlord_expenses : p.other_landlord_expenses,
    body.expense_breakdown_note !== undefined ? body.expense_breakdown_note : p.expense_breakdown_note,
    body.net_payout_to_landlord !== undefined ? body.net_payout_to_landlord : p.net_payout_to_landlord,
    body.payment_method !== undefined ? body.payment_method : p.payment_method,
    body.proof_document_url !== undefined ? body.proof_document_url : p.proof_document_url,
    paymentId
  );

  const updated = db.prepare('SELECT * FROM rental_payments WHERE id = ?').get(paymentId) as RentalPayment;
  res.json(serializePayment(updated));
});

app.patch('/api/payments/:id/quick-update', (req: Request, res: Response) => {
  const paymentId = Number(req.params.id);
  const p = db.prepare('SELECT * FROM rental_payments WHERE id = ?').get(paymentId) as RentalPayment | undefined;
  if (!p) return res.status(404).json({ detail: 'Payment record not found' });

  const body = req.body;
  const status = body.status !== undefined ? body.status : p.status;
  let paidDate = body.paid_date !== undefined ? body.paid_date : p.paid_date;
  let receiptNo = p.receipt_no;

  const baseRent = body.base_rent !== undefined ? Number(body.base_rent) : Number(p.base_rent || 0);
  const llBaseRent = body.landlord_base_rent !== undefined ? Number(body.landlord_base_rent) : Number(p.landlord_base_rent || baseRent);
  const spread = Math.max(0, baseRent - llBaseRent);

  const extra = body.tenant_extra_charges !== undefined ? Number(body.tenant_extra_charges) : Number(p.tenant_extra_charges || 0);
  const repair = body.landlord_repair_deduction !== undefined ? Number(body.landlord_repair_deduction) : Number(p.landlord_repair_deduction || 0);
  const other = body.other_landlord_expenses !== undefined ? Number(body.other_landlord_expenses) : Number(p.other_landlord_expenses || 0);

  let amountCollected = 0.0;
  let netPayout = 0.0;

  if (status === 'Written Off') {
    amountCollected = 0.0;
    netPayout = 0.0;
    paidDate = null;
  } else {
    amountCollected = baseRent + extra;
    netPayout = llBaseRent - repair - other;
  }

  if (['Paid & Settled', 'Collected (Pending Payout)', 'Paid'].includes(status)) {
    if (!paidDate) paidDate = new Date().toISOString().split('T')[0];
    if (receiptNo.startsWith('SCH-')) receiptNo = 'RCP-' + receiptNo.substring(4);
  } else if (status === 'Pending') {
    paidDate = null;
  }

  db.prepare(`
    UPDATE rental_payments SET
      status = ?, paid_date = ?, receipt_no = ?,
      base_rent = ?, landlord_base_rent = ?, rent_spread_agency = ?,
      tenant_extra_charges = ?, tenant_charges_note = ?,
      amount_collected_from_tenant = ?, landlord_repair_deduction = ?,
      other_landlord_expenses = ?, expense_breakdown_note = ?,
      net_payout_to_landlord = ?, payment_method = ?, proof_document_url = ?
    WHERE id = ?
  `).run(
    status,
    paidDate,
    receiptNo,
    baseRent,
    llBaseRent,
    spread,
    extra,
    body.tenant_charges_note !== undefined ? body.tenant_charges_note : p.tenant_charges_note,
    amountCollected,
    repair,
    other,
    body.expense_breakdown_note !== undefined ? body.expense_breakdown_note : p.expense_breakdown_note,
    netPayout,
    body.payment_method !== undefined ? body.payment_method : p.payment_method,
    body.proof_document_url !== undefined ? body.proof_document_url : p.proof_document_url,
    paymentId
  );

  const updated = db.prepare('SELECT * FROM rental_payments WHERE id = ?').get(paymentId) as RentalPayment;
  res.json(serializePayment(updated));
});

app.delete('/api/payments/:id', (req: Request, res: Response) => {
  const paymentId = Number(req.params.id);
  db.prepare('DELETE FROM rental_payments WHERE id = ?').run(paymentId);
  res.json({ ok: true });
});

// --- Issues ---
app.get('/api/issues', (_req: Request, res: Response) => {
  const issues = db.prepare('SELECT * FROM unit_issues ORDER BY reported_date DESC').all() as UnitIssue[];
  res.json(issues.map(serializeIssue));
});

app.post('/api/issues', (req: Request, res: Response) => {
  const body = req.body;
  const imgs = JSON.stringify(body.issue_images || []);
  const docs = JSON.stringify(body.issue_documents || []);

  const info = db
    .prepare(`
      INSERT INTO unit_issues (
        ticket_no, unit_id, lease_id, title, category,
        priority, status, reported_by, responsible_party, vendor_or_contractor,
        description, resolution_notes, estimated_cost, actual_cost,
        reported_date, resolved_date, issue_images, issue_documents
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `)
    .run(
      body.ticket_no,
      body.unit_id,
      body.lease_id || null,
      body.title,
      body.category || 'Plumbing',
      body.priority || 'Medium',
      body.status || 'Open',
      body.reported_by || 'Tenant',
      body.responsible_party || 'Landlord',
      body.vendor_or_contractor,
      body.description,
      body.resolution_notes,
      body.estimated_cost || 0.0,
      body.actual_cost || 0.0,
      body.reported_date,
      body.resolved_date,
      imgs,
      docs
    );

  const issue = db.prepare('SELECT * FROM unit_issues WHERE id = ?').get(info.lastInsertRowid) as UnitIssue;
  res.json(serializeIssue(issue));
});

app.put('/api/issues/:id', (req: Request, res: Response) => {
  const issueId = Number(req.params.id);
  const iss = db.prepare('SELECT * FROM unit_issues WHERE id = ?').get(issueId) as UnitIssue | undefined;
  if (!iss) return res.status(404).json({ detail: 'Issue not found' });

  const body = req.body;
  const imgs = body.issue_images !== undefined ? JSON.stringify(body.issue_images) : iss.issue_images;
  const docs = body.issue_documents !== undefined ? JSON.stringify(body.issue_documents) : iss.issue_documents;

  db.prepare(`
    UPDATE unit_issues SET
      ticket_no = ?, unit_id = ?, lease_id = ?, title = ?, category = ?,
      priority = ?, status = ?, reported_by = ?, responsible_party = ?, vendor_or_contractor = ?,
      description = ?, resolution_notes = ?, estimated_cost = ?, actual_cost = ?,
      reported_date = ?, resolved_date = ?, issue_images = ?, issue_documents = ?
    WHERE id = ?
  `).run(
    body.ticket_no !== undefined ? body.ticket_no : iss.ticket_no,
    body.unit_id !== undefined ? body.unit_id : iss.unit_id,
    body.lease_id !== undefined ? body.lease_id : iss.lease_id,
    body.title !== undefined ? body.title : iss.title,
    body.category !== undefined ? body.category : iss.category,
    body.priority !== undefined ? body.priority : iss.priority,
    body.status !== undefined ? body.status : iss.status,
    body.reported_by !== undefined ? body.reported_by : iss.reported_by,
    body.responsible_party !== undefined ? body.responsible_party : iss.responsible_party,
    body.vendor_or_contractor !== undefined ? body.vendor_or_contractor : iss.vendor_or_contractor,
    body.description !== undefined ? body.description : iss.description,
    body.resolution_notes !== undefined ? body.resolution_notes : iss.resolution_notes,
    body.estimated_cost !== undefined ? body.estimated_cost : iss.estimated_cost,
    body.actual_cost !== undefined ? body.actual_cost : iss.actual_cost,
    body.reported_date !== undefined ? body.reported_date : iss.reported_date,
    body.resolved_date !== undefined ? body.resolved_date : iss.resolved_date,
    imgs,
    docs,
    issueId
  );

  const updated = db.prepare('SELECT * FROM unit_issues WHERE id = ?').get(issueId) as UnitIssue;
  res.json(serializeIssue(updated));
});

app.delete('/api/issues/:id', (req: Request, res: Response) => {
  const issueId = Number(req.params.id);
  db.prepare('DELETE FROM unit_issues WHERE id = ?').run(issueId);
  res.json({ ok: true });
});

// --- Communications ---
app.get('/api/communications', (_req: Request, res: Response) => {
  const comms = db.prepare('SELECT * FROM communication_logs ORDER BY created_at DESC').all() as CommunicationLog[];
  res.json(comms.map(serializeComm));
});

app.post('/api/communications', (req: Request, res: Response) => {
  const body = req.body;
  const info = db
    .prepare(`
      INSERT INTO communication_logs (
        channel, direction, subject, content, logged_by,
        contact_id, developer_id, unit_id, issue_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      body.channel,
      body.direction,
      body.subject,
      body.content,
      body.logged_by,
      body.contact_id || null,
      body.developer_id || null,
      body.unit_id || null,
      body.issue_id || null
    );

  const comm = db.prepare('SELECT * FROM communication_logs WHERE id = ?').get(info.lastInsertRowid) as CommunicationLog;
  res.json(serializeComm(comm));
});

app.delete('/api/communications/:id', (req: Request, res: Response) => {
  const commId = Number(req.params.id);
  db.prepare('DELETE FROM communication_logs WHERE id = ?').run(commId);
  res.json({ ok: true });
});

// --- Financial Settings ---
const SETTINGS_FILE = path.resolve(__dirname, '..', 'financial_settings.json');

app.get('/api/financial-settings', (_req: Request, res: Response) => {
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
      return res.json(data);
    } catch {
      // Fallback
    }
  }
  res.json({});
});

app.put('/api/financial-settings', (req: Request, res: Response) => {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(req.body, null, 2), 'utf-8');
    res.json({ ok: true, settings: req.body });
  } catch (err: any) {
    res.status(500).json({ detail: `Failed to save settings: ${err.message}` });
  }
});

// --- User Management & Granular Feature RBAC ---
app.get('/api/users', (_req: Request, res: Response) => {
  const users = db.prepare('SELECT * FROM app_users ORDER BY id ASC').all() as AppUser[];
  res.json(users.map(serializeUser));
});

app.get('/api/users/roles-matrix', (_req: Request, res: Response) => {
  res.json({
    roles: [
      {
        name: 'Super Admin',
        department: 'Executive Management',
        badge: 'Full Access',
        color: 'indigo',
        description:
          'Full unconstrained administrative authority across financial settings, audit logs, dual-rate spread, contract terminations, and user access permissions.',
      },
      {
        name: 'Branch Manager',
        department: 'Operations & Sales',
        badge: 'Managerial',
        color: 'sky',
        description:
          'Branch-level supervisor with access to property transactions, team oversight, approval of contracts, statements, and repair disputes.',
      },
      {
        name: 'Senior Leasing Agent',
        department: 'Leasing & Sales',
        badge: 'Standard Agent',
        color: 'emerald',
        description:
          'Full access to inventory listings, client CRM records, standard lease generation, and uploading transfer slips; confidential profit spread hidden.',
      },
      {
        name: 'Junior Agent',
        department: 'Leasing & Sales',
        badge: 'Restricted',
        color: 'amber',
        description:
          'Read-only access to available properties and clients; can log initial defect issues but cannot alter active lease terms or see landlord rates.',
      },
      {
        name: 'Property Inspector',
        department: 'Defect & Maintenance',
        badge: 'Field Ops',
        color: 'purple',
        description:
          'Specialized field role for unit defect inspections, uploading photo evidence, and logging developer warranty claims without financial or lease clutter.',
      },
      {
        name: 'Accountant',
        department: 'Finance & Accounts',
        badge: 'Finance & Tax',
        color: 'rose',
        description:
          'Access to Statements of Account, monthly rental collection ledger, 5% Withholding Tax calculations, and Property Transaction Tax Calculator.',
      },
    ],
    default_permissions: DEFAULT_ROLE_PERMISSIONS,
  });
});

app.post('/api/users', (req: Request, res: Response) => {
  const body = req.body;
  const existing = db.prepare('SELECT id FROM app_users WHERE email = ?').get(body.email);
  if (existing) {
    return res.status(400).json({ detail: 'User with this email already exists' });
  }

  const perms =
    body.permissions ||
    (DEFAULT_ROLE_PERMISSIONS as any)[body.role] ||
    DEFAULT_ROLE_PERMISSIONS['Senior Leasing Agent'];

  const avatar = body.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(body.full_name)}`;

  const info = db
    .prepare(`
      INSERT INTO app_users (
        full_name, email, role, department, phone,
        status, avatar_url, last_login, permissions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      body.full_name,
      body.email,
      body.role,
      body.department,
      body.phone,
      body.status || 'Active',
      avatar,
      'Never',
      JSON.stringify(perms)
    );

  const user = db.prepare('SELECT * FROM app_users WHERE id = ?').get(info.lastInsertRowid) as AppUser;
  res.json(serializeUser(user));
});

app.get('/api/users/:id', (req: Request, res: Response) => {
  const userId = Number(req.params.id);
  const user = db.prepare('SELECT * FROM app_users WHERE id = ?').get(userId) as AppUser | undefined;
  if (!user) return res.status(404).json({ detail: 'User not found' });
  res.json(serializeUser(user));
});

app.put('/api/users/:id', (req: Request, res: Response) => {
  const userId = Number(req.params.id);
  const user = db.prepare('SELECT * FROM app_users WHERE id = ?').get(userId) as AppUser | undefined;
  if (!user) return res.status(404).json({ detail: 'User not found' });

  const body = req.body;
  const perms = body.permissions !== undefined ? JSON.stringify(body.permissions) : user.permissions;

  db.prepare(`
    UPDATE app_users SET
      full_name = ?, email = ?, role = ?, department = ?,
      phone = ?, status = ?, avatar_url = ?, permissions = ?
    WHERE id = ?
  `).run(
    body.full_name !== undefined ? body.full_name : user.full_name,
    body.email !== undefined ? body.email : user.email,
    body.role !== undefined ? body.role : user.role,
    body.department !== undefined ? body.department : user.department,
    body.phone !== undefined ? body.phone : user.phone,
    body.status !== undefined ? body.status : user.status,
    body.avatar_url !== undefined ? body.avatar_url : user.avatar_url,
    perms,
    userId
  );

  const updated = db.prepare('SELECT * FROM app_users WHERE id = ?').get(userId) as AppUser;
  res.json(serializeUser(updated));
});

app.put('/api/users/:id/permissions', (req: Request, res: Response) => {
  const userId = Number(req.params.id);
  const user = db.prepare('SELECT * FROM app_users WHERE id = ?').get(userId) as AppUser | undefined;
  if (!user) return res.status(404).json({ detail: 'User not found' });

  db.prepare('UPDATE app_users SET permissions = ? WHERE id = ?').run(JSON.stringify(req.body.permissions), userId);

  const updated = db.prepare('SELECT * FROM app_users WHERE id = ?').get(userId) as AppUser;
  res.json(serializeUser(updated));
});

app.post('/api/users/:id/reset-permissions', (req: Request, res: Response) => {
  const userId = Number(req.params.id);
  const user = db.prepare('SELECT * FROM app_users WHERE id = ?').get(userId) as AppUser | undefined;
  if (!user) return res.status(404).json({ detail: 'User not found' });

  const roleTemplate =
    (DEFAULT_ROLE_PERMISSIONS as any)[user.role] || DEFAULT_ROLE_PERMISSIONS['Senior Leasing Agent'];
  db.prepare('UPDATE app_users SET permissions = ? WHERE id = ?').run(JSON.stringify(roleTemplate), userId);

  const updated = db.prepare('SELECT * FROM app_users WHERE id = ?').get(userId) as AppUser;
  res.json(serializeUser(updated));
});

app.delete('/api/users/:id', (req: Request, res: Response) => {
  const userId = Number(req.params.id);
  const user = db.prepare('SELECT * FROM app_users WHERE id = ?').get(userId) as AppUser | undefined;
  if (!user) return res.status(404).json({ detail: 'User not found' });

  if (user.role === 'Super Admin') {
    const adminCount = (
      db.prepare("SELECT COUNT(*) as count FROM app_users WHERE role = 'Super Admin'").get() as any
    ).count;
    if (adminCount <= 1) {
      return res.status(400).json({ detail: 'Cannot delete the only Super Admin in the system' });
    }
  }

  db.prepare('DELETE FROM app_users WHERE id = ?').run(userId);
  res.json({ ok: true });
});

// --- Static Frontend SPA Production Serving (Cloud Deployment) ---
const FRONTEND_DIST = path.resolve(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(FRONTEND_DIST)) {
  const assetsDir = path.join(FRONTEND_DIST, 'assets');
  if (fs.existsSync(assetsDir)) {
    app.use('/assets', express.static(assetsDir));
  }

  app.get('*', (req: Request, res: Response) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return res.status(404).json({ detail: 'API route not found' });
    }
    const filePath = path.join(FRONTEND_DIST, req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return res.sendFile(filePath);
    }
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

// Start Server
app.listen(PORT, () => {
  console.log(`PropPulse CRM TypeScript Server running on port ${PORT}`);
});
