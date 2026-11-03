import os
import json
import uuid
import re
from datetime import date, datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

import models
import schemas
from database import engine, get_db, SessionLocal
from seed import seed_database, ensure_taxonomy_migration, DEFAULT_ROLE_PERMISSIONS

models.Base.metadata.create_all(bind=engine)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(title="PropPulse CRM & Property Management API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.on_event("startup")
def on_startup():
    db = SessionLocal()
    try:
        ensure_taxonomy_migration(db)
        seed_database(db)
    finally:
        db.close()


# --- High-Res Multi-Image Upload Endpoint ---
@app.post("/api/upload-images")
async def upload_images(files: List[UploadFile] = File(...)):
    uploaded_urls = []
    uploaded_meta = []
    for file in files:
        orig_name = file.filename or "photo.jpg"
        safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", orig_name)
        unique_filename = f"{uuid.uuid4().hex[:12]}_{safe_name}"
        dest_path = os.path.join(UPLOAD_DIR, unique_filename)

        size_bytes = 0
        with open(dest_path, "wb") as out_file:
            while True:
                chunk = await file.read(1024 * 1024)  # 1MB streaming chunks for high-res photos
                if not chunk:
                    break
                size_bytes += len(chunk)
                out_file.write(chunk)

        url = f"/uploads/{unique_filename}"
        uploaded_urls.append(url)
        uploaded_meta.append({
            "url": url,
            "name": orig_name,
            "size_bytes": size_bytes,
        })

    return {"urls": uploaded_urls, "files": uploaded_meta}


@app.post("/api/upload-files")
async def upload_files(files: List[UploadFile] = File(...)):
    uploaded_files = []
    today_str = date.today().isoformat()
    for file in files:
        orig_name = file.filename or "document.pdf"
        safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", orig_name)
        unique_filename = f"{uuid.uuid4().hex[:10]}_{safe_name}"
        dest_path = os.path.join(UPLOAD_DIR, unique_filename)

        size_bytes = 0
        with open(dest_path, "wb") as out_file:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size_bytes += len(chunk)
                out_file.write(chunk)

        url = f"/uploads/{unique_filename}"
        uploaded_files.append({
            "url": url,
            "name": orig_name,
            "doc_type": "Signed Contract",
            "size_bytes": size_bytes,
            "uploaded_at": today_str,
        })

    return {"files": uploaded_files}


# --- Helper Formatters ---
def calc_days_remaining(end_date_str: str) -> Optional[int]:
    try:
        end_d = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        return (end_d - date.today()).days
    except Exception:
        return None


def parse_gallery(raw_gallery: Optional[str], fallback_cover: Optional[str]) -> List[str]:
    imgs: List[str] = []
    if raw_gallery:
        try:
            parsed = json.loads(raw_gallery)
            if isinstance(parsed, list):
                imgs = [str(x) for x in parsed if x]
        except Exception:
            pass
    if fallback_cover and fallback_cover not in imgs:
        imgs.insert(0, fallback_cover)
    return imgs


def serialize_unit(u: models.PropertyUnit) -> schemas.PropertyUnitOut:
    active_lease = next(
        (l for l in u.leases if l.status in ("Active", "Expiring Soon")),
        None
    )
    open_issues = [i for i in u.issues if i.status not in ("Resolved", "Closed")]
    gallery_list = parse_gallery(u.gallery_images, u.image_url)
    cover_url = u.image_url or (gallery_list[0] if gallery_list else None)

    size_val = float(u.size_sqm or 0.0)
    rent_val = float(u.target_rent_price or 0.0)
    sale_val = float(u.target_sale_price or 0.0)
    rent_per_sqm = round(rent_val / size_val, 2) if size_val > 0 else 0.0
    sale_per_sqm = round(sale_val / size_val, 2) if size_val > 0 else 0.0

    data_dict = {
        "id": u.id,
        "unit_code": u.unit_code,
        "project_name": u.project_name,
        "city": u.city or "Bangkok",
        "property_category": u.property_category or "Residential",
        "property_type": u.property_type or "Condominium",
        "building": u.building,
        "floor": u.floor,
        "bedrooms": u.bedrooms,
        "bathrooms": u.bathrooms,
        "size_sqm": u.size_sqm,
        "furnishing": u.furnishing,
        "status": u.status,
        "listing_type": u.listing_type,
        "target_rent_price": u.target_rent_price,
        "target_sale_price": u.target_sale_price,
        "rent_per_sqm": rent_per_sqm,
        "sale_per_sqm": sale_per_sqm,
        "address": u.address,
        "key_card_and_access_info": u.key_card_and_access_info,
        "meter_electric_no": u.meter_electric_no,
        "meter_water_no": u.meter_water_no,
        "warranty_expiry_date": u.warranty_expiry_date,
        "image_url": cover_url,
        "gallery_images": gallery_list,
        "notes": u.notes,
        "developer_id": u.developer_id,
        "landlord_id": u.landlord_id,
        "created_at": u.created_at,
        "developer_name": u.developer.company_name if u.developer else None,
        "landlord_name": u.landlord.full_name if u.landlord else None,
        "landlord_phone": u.landlord.phone if u.landlord else None,
        "current_tenant_name": active_lease.tenant.full_name if (active_lease and active_lease.tenant) else None,
        "current_lease_id": active_lease.id if active_lease else None,
        "current_lease_end": active_lease.end_date if active_lease else None,
        "open_issues_count": len(open_issues),
        "total_issues_count": len(u.issues),
    }
    return schemas.PropertyUnitOut(**data_dict)


def parse_lease_docs(raw_docs: Optional[str], fallback_url: Optional[str]) -> List[dict]:
    docs: List[dict] = []
    if raw_docs:
        try:
            parsed = json.loads(raw_docs)
            if isinstance(parsed, list):
                docs = [x for x in parsed if isinstance(x, dict) and x.get("url")]
        except Exception:
            pass
    if fallback_url and not any(d.get("url") == fallback_url for d in docs):
        docs.insert(0, {
            "url": fallback_url,
            "name": fallback_url.split("/")[-1] or "Lease_Document.pdf",
            "doc_type": "Signed Contract",
            "size_bytes": 0,
            "uploaded_at": date.today().isoformat(),
        })
    return docs


def generate_lease_months(start_date_str: str, end_date_str: str) -> List[str]:
    """Generates YYYY-MM billing months covering the contract term from start_date to end_date.
    Guarantees strictly exact month count (e.g. exactly 12 months for 1-year contracts, no M13).
    """
    try:
        start_d = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        end_d = datetime.strptime(end_date_str, "%Y-%m-%d").date()
    except Exception:
        return [date.today().strftime("%Y-%m")]

    if end_d < start_d:
        return [start_d.strftime("%Y-%m")]

    diff_months = (end_d.year - start_d.year) * 12 + (end_d.month - start_d.month)
    # Standard leases (6, 12, 24, 36 months) e.g. 2025-11-22 to 2026-11-22 is strictly 12 months (M1 to M12)
    if diff_months in (6, 12, 24, 36):
        exact_count = diff_months
    elif diff_months > 0 and abs(end_d.day - start_d.day) <= 2:
        exact_count = diff_months
    else:
        total_days = (end_d - start_d).days + 1
        exact_count = max(1, round(total_days / 30.4375))

    months: List[str] = []
    y, m = start_d.year, start_d.month
    for _ in range(exact_count):
        months.append(f"{y:04d}-{m:02d}")
        m += 1
        if m > 12:
            m = 1
            y += 1

    if not months:
        months.append(start_d.strftime("%Y-%m"))
    return months


def normalize_lease_dual_rates(l: models.LeaseContract) -> None:
    """Ensures landlord_monthly_rent and landlord_security_deposit follow has_rent_spread rules."""
    tn_rent = float(l.monthly_rent or 0.0)
    tn_dep = float(l.security_deposit or 0.0)
    if not l.has_rent_spread:
        l.has_rent_spread = 0
        l.landlord_monthly_rent = tn_rent
        l.landlord_security_deposit = tn_dep
    else:
        l.has_rent_spread = 1
        if l.landlord_monthly_rent is None or l.landlord_monthly_rent <= 0:
            l.landlord_monthly_rent = tn_rent
        ll_rent = float(l.landlord_monthly_rent)
        if l.landlord_security_deposit is None or l.landlord_security_deposit <= 0:
            dep_months = (tn_dep / tn_rent) if tn_rent > 0 else 2.0
            l.landlord_security_deposit = round(dep_months * ll_rent)
    if l.management_fee_percent is None:
        l.management_fee_percent = 5.0
    if l.commission_deducted_upfront is None:
        l.commission_deducted_upfront = 1
    if l.deposit_forfeited is None:
        l.deposit_forfeited = 0


def sync_lease_monthly_schedule(l: models.LeaseContract, db: Session) -> None:
    """Ensures every billing month between start_date and end_date exists in rental_payments,
    removes duplicates and extraneous months (strictly 12 months, no M13), and enforces M1 Advance & Commission rules."""
    normalize_lease_dual_rates(l)
    expected_months = generate_lease_months(l.start_date, l.end_date)
    expected_set = set(expected_months)

    existing = (
        db.query(models.RentalPayment)
        .filter(models.RentalPayment.lease_id == l.id)
        .order_by(models.RentalPayment.billing_month.asc(), models.RentalPayment.id.asc())
        .all()
    )

    # Deduplicate existing payments by billing_month and purge any outside expected date range (e.g. M13)
    by_month = {}
    changed = False
    for p in existing:
        if p.billing_month not in expected_set:
            db.delete(p)
            changed = True
        elif p.billing_month not in by_month:
            by_month[p.billing_month] = p
        else:
            # Duplicate payment entry found in DB for the same billing_month — keep the first, delete duplicate
            db.delete(p)
            changed = True

    due_day = min(max(l.payment_due_day or 5, 1), 28)
    tn_rent = float(l.monthly_rent or 0.0)
    ll_rent = float(
        l.landlord_monthly_rent
        if (l.has_rent_spread and l.landlord_monthly_rent is not None)
        else tn_rent
    )
    spread = max(0.0, tn_rent - ll_rent)
    mgmt_pct = float(l.management_fee_percent if l.management_fee_percent is not None else 5.0)
    mgmt_fee = round(ll_rent * (mgmt_pct / 100.0))
    default_mgmt_note = (
        f"{mgmt_pct:g}% Monthly Management Fee on ฿{ll_rent:,.0f} (฿{mgmt_fee:,.0f})"
        if mgmt_fee > 0
        else ""
    )

    first_month = expected_months[0] if expected_months else None

    for ym in expected_months:
        is_first_month = (ym == first_month)
        if ym not in by_month:
            uniq_rcp = f"SCH-{l.id}-{ym.replace('-', '')}-{uuid.uuid4().hex[:4].upper()}"

            # Rule: When a tenant signs a lease, the 1st month (M1) is considered paid rental by tenant,
            # and the 1st month rent is deducted 100% as the agency broker commission (Landlord Payout: ฿0.00).
            # Regular rent payments & payouts to the landlord start from M2 onwards (11 months of rent for a 12-month lease).
            if is_first_month and not l.deposit_forfeited:
                p_status = "Paid & Settled"
                p_paid_date = l.start_date
                p_amount_collected = tn_rent
                p_other_expenses = ll_rent if l.commission_deducted_upfront else 0.0
                p_expense_note = "1st Month Rent retained as Agency Broker Commission" if l.commission_deducted_upfront else ""
                p_net_payout = 0.0 if l.commission_deducted_upfront else ll_rent
                p_payment_method = "Advance Rent at Signing"
            else:
                p_status = "Written Off" if l.deposit_forfeited else "Pending"
                p_paid_date = None
                p_amount_collected = 0.0 if l.deposit_forfeited else tn_rent
                p_other_expenses = 0.0 if l.deposit_forfeited else mgmt_fee
                p_expense_note = (
                    "Written off due to Early Termination"
                    if l.deposit_forfeited
                    else default_mgmt_note
                )
                p_net_payout = 0.0 if l.deposit_forfeited else (ll_rent - mgmt_fee)
                p_payment_method = "Bank Transfer"

            new_p = models.RentalPayment(
                receipt_no=uniq_rcp,
                lease_id=l.id,
                unit_id=l.unit_id,
                landlord_id=l.landlord_id,
                tenant_id=l.tenant_id,
                billing_month=ym,
                due_date=f"{ym}-{due_day:02d}",
                paid_date=p_paid_date,
                status=p_status,
                base_rent=tn_rent,
                landlord_base_rent=ll_rent,
                rent_spread_agency=spread,
                tenant_extra_charges=0.0,
                tenant_charges_note="",
                amount_collected_from_tenant=p_amount_collected,
                landlord_repair_deduction=0.0,
                other_landlord_expenses=p_other_expenses,
                expense_breakdown_note=p_expense_note,
                net_payout_to_landlord=p_net_payout,
                payment_method=p_payment_method,
                proof_document_url=None,
            )
            db.add(new_p)
            changed = True
        else:
            p = by_month[ym]
            expected_due = f"{ym}-{due_day:02d}"
            if p.status == "Pending" and p.due_date != expected_due:
                p.due_date = expected_due
                changed = True
            if p.status != "Written Off":
                if (
                    p.base_rent != tn_rent
                    or p.landlord_base_rent != ll_rent
                    or p.rent_spread_agency != spread
                ):
                    p.base_rent = tn_rent
                    p.landlord_base_rent = ll_rent
                    p.rent_spread_agency = spread
                    changed = True

                # Enforce First Month Rule: Paid Advance Rent & Commission Retained (Landlord Payout ฿0.00)
                if is_first_month:
                    if p.status == "Pending" or not p.paid_date:
                        p.status = "Paid & Settled"
                        p.paid_date = l.start_date
                        p.payment_method = "Advance Rent at Signing"
                        p.amount_collected_from_tenant = tn_rent + float(p.tenant_extra_charges or 0.0)
                        changed = True
                    if l.commission_deducted_upfront:
                        if p.other_landlord_expenses != ll_rent or p.net_payout_to_landlord != 0.0:
                            p.other_landlord_expenses = ll_rent
                            p.expense_breakdown_note = "1st Month Rent retained as Agency Broker Commission"
                            p.net_payout_to_landlord = 0.0
                            changed = True
                else:
                    if p.status == "Pending":
                        p.other_landlord_expenses = mgmt_fee
                        if not p.landlord_repair_deduction:
                            p.expense_breakdown_note = default_mgmt_note
                    p.amount_collected_from_tenant = tn_rent + float(p.tenant_extra_charges or 0.0)
                    p.net_payout_to_landlord = (
                        ll_rent
                        - float(p.landlord_repair_deduction or 0.0)
                        - float(p.other_landlord_expenses or 0.0)
                    )
                    changed = True

    if changed:
        db.commit()
        db.refresh(l)


def serialize_lease(l: models.LeaseContract) -> schemas.LeaseContractOut:
    normalize_lease_dual_rates(l)
    docs_list = parse_lease_docs(l.documents, l.document_url)
    payments = l.payments or []
    paid_payments = [
        p for p in payments if p.status in ("Paid & Settled", "Collected (Pending Payout)", "Paid")
    ]
    written_off_payments = [p for p in payments if p.status == "Written Off"]
    tn_rent = float(l.monthly_rent or 0.0)
    ll_rent = float(l.landlord_monthly_rent or tn_rent)
    ll_dep = float(l.landlord_security_deposit if l.landlord_security_deposit is not None else l.security_deposit)
    monthly_spread = max(0.0, tn_rent - ll_rent)

    total_collected = sum(p.amount_collected_from_tenant for p in paid_payments)
    total_ll_expenses = sum(
        (p.landlord_repair_deduction + p.other_landlord_expenses) for p in paid_payments
    ) + float(l.agent_commission or 0.0)
    forfeited_ll_dep = ll_dep if l.deposit_forfeited else 0.0
    total_net_profit = (
        sum(p.net_payout_to_landlord for p in paid_payments)
        - float(l.agent_commission or 0.0)
        + forfeited_ll_dep
    )

    # Agency Profit Calculation (Commission + Paid Rent Spread + Paid Mgmt Fees + Forfeited Deposit Spread)
    paid_spread = sum(float(p.rent_spread_agency or 0.0) for p in paid_payments)
    paid_mgmt = sum(float(p.other_landlord_expenses or 0.0) for p in paid_payments)
    forfeited_dep_spread = (
        max(0.0, float(l.security_deposit or 0.0) - ll_dep) if l.deposit_forfeited else 0.0
    )
    total_agency_profit = (
        float(l.agent_commission or 0.0) + paid_spread + paid_mgmt + forfeited_dep_spread
    )

    data_dict = {
        "id": l.id,
        "contract_no": l.contract_no,
        "unit_id": l.unit_id,
        "landlord_id": l.landlord_id,
        "tenant_id": l.tenant_id,
        "start_date": l.start_date,
        "end_date": l.end_date,
        "monthly_rent": tn_rent,
        "has_rent_spread": l.has_rent_spread or 0,
        "landlord_monthly_rent": ll_rent,
        "security_deposit": l.security_deposit,
        "landlord_security_deposit": ll_dep,
        "advance_rent": l.advance_rent,
        "payment_due_day": l.payment_due_day,
        "agent_commission": l.agent_commission,
        "management_fee_percent": l.management_fee_percent if l.management_fee_percent is not None else 5.0,
        "commission_deducted_upfront": l.commission_deducted_upfront if l.commission_deducted_upfront is not None else 1,
        "deposit_forfeited": l.deposit_forfeited or 0,
        "early_termination_date": l.early_termination_date,
        "early_termination_note": l.early_termination_note,
        "status": l.status,
        "inventory_checklist_signed": l.inventory_checklist_signed,
        "special_terms": l.special_terms,
        "document_url": l.document_url or (docs_list[0]["url"] if docs_list else None),
        "documents": docs_list,
        "created_at": l.created_at,
        "unit_code": l.unit.unit_code if l.unit else None,
        "project_name": l.unit.project_name if l.unit else None,
        "landlord_name": l.landlord.full_name if l.landlord else None,
        "landlord_phone": l.landlord.phone if l.landlord else None,
        "landlord_bank_name": l.landlord.bank_name if l.landlord else None,
        "landlord_bank_account_no": l.landlord.bank_account_no if l.landlord else None,
        "tenant_name": l.tenant.full_name if l.tenant else None,
        "tenant_phone": l.tenant.phone if l.tenant else None,
        "days_remaining": calc_days_remaining(l.end_date),
        "payments_count": len(payments),
        "paid_months_count": len(paid_payments),
        "written_off_months_count": len(written_off_payments),
        "monthly_rent_spread": monthly_spread,
        "total_collected_from_tenant": total_collected,
        "total_landlord_expenses": total_ll_expenses,
        "total_net_landlord_profit": total_net_profit,
        "total_agency_profit": total_agency_profit,
    }
    return schemas.LeaseContractOut(**data_dict)


def serialize_payment(p: models.RentalPayment) -> schemas.RentalPaymentOut:
    out = schemas.RentalPaymentOut.model_validate(p)
    out.contract_no = p.lease.contract_no if p.lease else None
    out.unit_code = p.unit.unit_code if p.unit else None
    out.project_name = p.unit.project_name if p.unit else None
    out.landlord_name = p.landlord.full_name if p.landlord else None
    out.tenant_name = p.tenant.full_name if p.tenant else None
    # 5% Withholding Tax (WHT) from Rental Collection (Por. 4 / Section 3 Trevis)
    base = float(p.base_rent or 0.0)
    ll_base = float(p.landlord_base_rent if p.landlord_base_rent is not None else base)
    out.withholding_tax_5_percent = round(base * 0.05, 2)
    out.landlord_withholding_tax_5_percent = round(ll_base * 0.05, 2)
    return out


def parse_issue_images(raw_imgs: Optional[str]) -> List[str]:
    if not raw_imgs:
        return []
    try:
        parsed = json.loads(raw_imgs)
        if isinstance(parsed, list):
            return [str(x) for x in parsed if x]
    except Exception:
        pass
    return []


def parse_issue_docs(raw_docs: Optional[str]) -> List[dict]:
    if not raw_docs:
        return []
    try:
        parsed = json.loads(raw_docs)
        if isinstance(parsed, list):
            return [x for x in parsed if isinstance(x, dict) and x.get("url")]
    except Exception:
        pass
    return []


def serialize_issue(i: models.UnitIssue) -> schemas.UnitIssueOut:
    unit_code = i.unit.unit_code if i.unit else None
    project_name = i.unit.project_name if i.unit else None
    developer_name = i.unit.developer.company_name if (i.unit and i.unit.developer) else None
    landlord_name = i.unit.landlord.full_name if (i.unit and i.unit.landlord) else None
    if i.lease and i.lease.tenant:
        tenant_name = i.lease.tenant.full_name
    else:
        active_l = next((l for l in (i.unit.leases if i.unit else []) if l.status in ("Active", "Expiring Soon")), None)
        tenant_name = active_l.tenant.full_name if (active_l and active_l.tenant) else None

    return schemas.UnitIssueOut(
        id=i.id,
        ticket_no=i.ticket_no,
        unit_id=i.unit_id,
        lease_id=i.lease_id,
        title=i.title,
        category=i.category,
        priority=i.priority,
        status=i.status,
        reported_by=i.reported_by,
        responsible_party=i.responsible_party,
        vendor_or_contractor=i.vendor_or_contractor,
        description=i.description,
        resolution_notes=i.resolution_notes,
        estimated_cost=i.estimated_cost or 0.0,
        actual_cost=i.actual_cost or 0.0,
        reported_date=i.reported_date,
        resolved_date=i.resolved_date,
        issue_images=parse_issue_images(getattr(i, "issue_images", None)),
        issue_documents=parse_issue_docs(getattr(i, "issue_documents", None)),
        created_at=i.created_at,
        unit_code=unit_code,
        project_name=project_name,
        developer_name=developer_name,
        landlord_name=landlord_name,
        tenant_name=tenant_name,
    )


def parse_corporate_employees(raw_emp: Optional[str]) -> List[dict]:
    if not raw_emp:
        return []
    try:
        parsed = json.loads(raw_emp)
        if isinstance(parsed, list):
            return [x for x in parsed if isinstance(x, dict) and x.get("name")]
    except Exception:
        pass
    return []


def serialize_developer(d: models.Developer) -> schemas.DeveloperOut:
    warranty_open = 0
    for u in d.units:
        warranty_open += sum(
            1 for i in u.issues
            if i.responsible_party == "Developer Warranty" and i.status not in ("Resolved", "Closed")
        )
    return schemas.DeveloperOut(
        id=d.id,
        company_name=d.company_name,
        contact_person=d.contact_person,
        phone=d.phone,
        email=d.email,
        line_id=d.line_id,
        address=d.address,
        warranty_policy=d.warranty_policy,
        defect_contact_info=d.defect_contact_info,
        tax_id=getattr(d, "tax_id", None),
        corporate_employees=parse_corporate_employees(getattr(d, "corporate_employees", None)),
        notes=d.notes,
        created_at=d.created_at,
        unit_count=len(d.units),
        open_warranty_issues=warranty_open,
    )


def match_vendor_issues(c: models.Contact, all_issues: List[models.UnitIssue]) -> List[models.UnitIssue]:
    terms = [
        (c.full_name or "").strip().lower(),
        (getattr(c, "company_name", None) or "").strip().lower(),
    ]
    terms = [t for t in terms if len(t) >= 3]
    if not terms:
        return []
    matched = []
    for iss in all_issues:
        v = (iss.vendor_or_contractor or "").strip().lower()
        if not v:
            continue
        if any(t in v or v in t for t in terms):
            matched.append(iss)
    return matched


def serialize_contact(c: models.Contact, all_issues: Optional[List[models.UnitIssue]] = None) -> schemas.ContactOut:
    active_ll = sum(1 for l in c.landlord_leases if l.status in ("Active", "Expiring Soon"))
    active_tn = sum(1 for l in c.tenant_leases if l.status in ("Active", "Expiring Soon"))
    vendor_jobs = len(match_vendor_issues(c, all_issues)) if (all_issues is not None and c.role == "VENDOR") else 0

    return schemas.ContactOut(
        id=c.id,
        role=c.role,
        entity_type=getattr(c, "entity_type", None) or "Individual",
        company_name=getattr(c, "company_name", None),
        tax_id=getattr(c, "tax_id", None),
        service_category=getattr(c, "service_category", None),
        corporate_employees=parse_corporate_employees(getattr(c, "corporate_employees", None)),
        full_name=c.full_name,
        phone=c.phone,
        email=c.email,
        line_or_whatsapp=c.line_or_whatsapp,
        nationality=c.nationality,
        id_or_passport=c.id_or_passport,
        bank_name=c.bank_name,
        bank_account_no=c.bank_account_no,
        bank_account_info=c.bank_account_info,
        emergency_contact=c.emergency_contact,
        preferred_language=c.preferred_language or "English",
        rating=c.rating if c.rating is not None else 5,
        notes=c.notes,
        created_at=c.created_at,
        owned_units_count=len(c.owned_units),
        active_leases_count=active_ll + active_tn,
        vendor_jobs_count=vendor_jobs,
    )


def serialize_comm(c: models.CommunicationLog) -> schemas.CommunicationLogOut:
    out = schemas.CommunicationLogOut.model_validate(c)
    out.contact_name = c.contact.full_name if c.contact else None
    out.developer_name = c.developer.company_name if c.developer else None
    out.unit_code = c.unit.unit_code if c.unit else None
    return out


# --- Dashboard Endpoint ---
@app.get("/api/dashboard")
def get_dashboard(db: Session = Depends(get_db)):
    units = db.query(models.PropertyUnit).all()
    leases = db.query(models.LeaseContract).all()
    issues = db.query(models.UnitIssue).order_by(models.UnitIssue.id.desc()).all()
    contacts = db.query(models.Contact).all()
    developers = db.query(models.Developer).all()
    comms = db.query(models.CommunicationLog).order_by(models.CommunicationLog.created_at.desc()).limit(8).all()

    total_units = len(units)
    occupied_units = sum(1 for u in units if u.status == "Occupied")
    available_units = sum(1 for u in units if u.status == "Available")
    maintenance_units = sum(1 for u in units if u.status == "Under Maintenance")
    occupancy_rate = round((occupied_units / total_units * 100), 1) if total_units > 0 else 0.0

    active_leases = [l for l in leases if l.status in ("Active", "Expiring Soon")]
    monthly_rent_volume = sum(l.monthly_rent for l in active_leases)
    expiring_leases = [
        serialize_lease(l) for l in active_leases
        if (calc_days_remaining(l.end_date) is not None and calc_days_remaining(l.end_date) <= 60)
    ]

    open_issues = [i for i in issues if i.status not in ("Resolved", "Closed")]
    warranty_issues = [i for i in open_issues if i.responsible_party == "Developer Warranty"]

    return {
        "metrics": {
            "total_units": total_units,
            "occupied_units": occupied_units,
            "available_units": available_units,
            "maintenance_units": maintenance_units,
            "occupancy_rate": occupancy_rate,
            "active_leases_count": len(active_leases),
            "monthly_rent_volume": monthly_rent_volume,
            "expiring_leases_count": len(expiring_leases),
            "open_issues_count": len(open_issues),
            "open_warranty_issues_count": len(warranty_issues),
            "landlords_count": sum(1 for c in contacts if c.role in ("LANDLORD", "BOTH")),
            "tenants_count": sum(1 for c in contacts if c.role in ("TENANT", "BOTH")),
            "developers_count": len(developers),
        },
        "expiring_leases": expiring_leases,
        "open_issues": [serialize_issue(i) for i in open_issues[:6]],
        "recent_communications": [serialize_comm(c) for c in comms],
    }


# --- Developers CRUD & CRM Details ---
@app.get("/api/developers", response_model=List[schemas.DeveloperOut])
def list_developers(db: Session = Depends(get_db)):
    devs = db.query(models.Developer).order_by(models.Developer.company_name).all()
    return [serialize_developer(d) for d in devs]


@app.get("/api/developers/{dev_id}/details")
def get_developer_details(dev_id: int, db: Session = Depends(get_db)):
    d = db.query(models.Developer).filter(models.Developer.id == dev_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Developer not found")
    dev_out = serialize_developer(d)
    dev_issues = []
    for u in d.units:
        for i in u.issues:
            dev_issues.append(serialize_issue(i))
    comms = (
        db.query(models.CommunicationLog)
        .filter(models.CommunicationLog.developer_id == dev_id)
        .order_by(models.CommunicationLog.created_at.desc())
        .all()
    )
    return {
        "developer": dev_out,
        "units": [serialize_unit(u) for u in d.units],
        "issues": dev_issues,
        "communications": [serialize_comm(c) for c in comms],
    }


@app.post("/api/developers", response_model=schemas.DeveloperOut)
def create_developer(payload: schemas.DeveloperCreate, db: Session = Depends(get_db)):
    dump = payload.model_dump()
    emps = dump.pop("corporate_employees", None) or []
    dump["corporate_employees"] = json.dumps(emps)
    dev = models.Developer(**dump)
    db.add(dev)
    db.commit()
    db.refresh(dev)
    return serialize_developer(dev)


@app.put("/api/developers/{dev_id}", response_model=schemas.DeveloperOut)
def update_developer(dev_id: int, payload: schemas.DeveloperUpdate, db: Session = Depends(get_db)):
    dev = db.query(models.Developer).filter(models.Developer.id == dev_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Developer not found")
    dump = payload.model_dump()
    emps = dump.pop("corporate_employees", None)
    for k, v in dump.items():
        setattr(dev, k, v)
    if emps is not None:
        dev.corporate_employees = json.dumps(emps)
    db.commit()
    db.refresh(dev)
    return serialize_developer(dev)


@app.delete("/api/developers/{dev_id}")
def delete_developer(dev_id: int, db: Session = Depends(get_db)):
    dev = db.query(models.Developer).filter(models.Developer.id == dev_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Developer not found")
    db.delete(dev)
    db.commit()
    return {"ok": True}


# --- Contacts (Landlords, Tenants & Vendors) CRUD & CRM Details ---
@app.get("/api/contacts", response_model=List[schemas.ContactOut])
def list_contacts(role: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(models.Contact)
    if role == "LANDLORD":
        q = q.filter(models.Contact.role.in_(["LANDLORD", "BOTH"]))
    elif role == "TENANT":
        q = q.filter(models.Contact.role.in_(["TENANT", "BOTH"]))
    elif role == "VENDOR":
        q = q.filter(models.Contact.role == "VENDOR")
    contacts = q.order_by(models.Contact.full_name).all()
    all_issues = db.query(models.UnitIssue).all()
    return [serialize_contact(c, all_issues) for c in contacts]


@app.get("/api/contacts/{contact_id}/details")
def get_contact_details(contact_id: int, db: Session = Depends(get_db)):
    c = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contact not found")
    all_issues = db.query(models.UnitIssue).order_by(models.UnitIssue.reported_date.desc()).all()
    c_out = serialize_contact(c, all_issues)
    all_leases = list({l.id: l for l in (c.landlord_leases + c.tenant_leases)}.values())

    related_issues = []
    seen_issue_ids = set()
    for u in c.owned_units:
        for i in u.issues:
            if i.id not in seen_issue_ids:
                seen_issue_ids.add(i.id)
                related_issues.append(serialize_issue(i))
    for l in c.tenant_leases:
        for i in l.issues:
            if i.id not in seen_issue_ids:
                seen_issue_ids.add(i.id)
                related_issues.append(serialize_issue(i))
    if c.role == "VENDOR":
        for i in match_vendor_issues(c, all_issues):
            if i.id not in seen_issue_ids:
                seen_issue_ids.add(i.id)
                related_issues.append(serialize_issue(i))

    comms = (
        db.query(models.CommunicationLog)
        .filter(models.CommunicationLog.contact_id == contact_id)
        .order_by(models.CommunicationLog.created_at.desc())
        .all()
    )
    return {
        "contact": c_out,
        "owned_units": [serialize_unit(u) for u in c.owned_units],
        "leases": [serialize_lease(l) for l in all_leases],
        "issues": related_issues,
        "communications": [serialize_comm(cm) for cm in comms],
    }


@app.post("/api/contacts", response_model=schemas.ContactOut)
def create_contact(payload: schemas.ContactCreate, db: Session = Depends(get_db)):
    dump = payload.model_dump()
    emps = dump.pop("corporate_employees", None) or []
    dump["corporate_employees"] = json.dumps(emps)
    c = models.Contact(**dump)
    db.add(c)
    db.commit()
    db.refresh(c)
    all_issues = db.query(models.UnitIssue).all()
    return serialize_contact(c, all_issues)


@app.put("/api/contacts/{contact_id}", response_model=schemas.ContactOut)
def update_contact(contact_id: int, payload: schemas.ContactUpdate, db: Session = Depends(get_db)):
    c = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contact not found")
    dump = payload.model_dump()
    emps = dump.pop("corporate_employees", None)
    for k, v in dump.items():
        setattr(c, k, v)
    if emps is not None:
        c.corporate_employees = json.dumps(emps)
    db.commit()
    db.refresh(c)
    all_issues = db.query(models.UnitIssue).all()
    return serialize_contact(c, all_issues)


@app.delete("/api/contacts/{contact_id}")
def delete_contact(contact_id: int, db: Session = Depends(get_db)):
    c = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contact not found")
    db.delete(c)
    db.commit()
    return {"ok": True}


# --- Property Units CRUD & Details ---
@app.get("/api/units", response_model=List[schemas.PropertyUnitOut])
def list_units(db: Session = Depends(get_db)):
    units = db.query(models.PropertyUnit).order_by(models.PropertyUnit.unit_code).all()
    return [serialize_unit(u) for u in units]


@app.get("/api/units/{unit_id}/details")
def get_unit_details(unit_id: int, db: Session = Depends(get_db)):
    u = db.query(models.PropertyUnit).filter(models.PropertyUnit.id == unit_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Property unit not found")
    comms = (
        db.query(models.CommunicationLog)
        .filter(models.CommunicationLog.unit_id == unit_id)
        .order_by(models.CommunicationLog.created_at.desc())
        .all()
    )
    return {
        "unit": serialize_unit(u),
        "developer": serialize_developer(u.developer) if u.developer else None,
        "landlord": serialize_contact(u.landlord) if u.landlord else None,
        "leases": [serialize_lease(l) for l in sorted(u.leases, key=lambda x: x.start_date, reverse=True)],
        "issues": [serialize_issue(i) for i in sorted(u.issues, key=lambda x: x.reported_date, reverse=True)],
        "communications": [serialize_comm(c) for c in comms],
    }


@app.post("/api/units", response_model=schemas.PropertyUnitOut)
def create_unit(payload: schemas.PropertyUnitCreate, db: Session = Depends(get_db)):
    dump = payload.model_dump()
    gallery = dump.pop("gallery_images", None) or []
    if dump.get("image_url") and dump["image_url"] not in gallery:
        gallery.insert(0, dump["image_url"])
    elif gallery and not dump.get("image_url"):
        dump["image_url"] = gallery[0]
    dump["gallery_images"] = json.dumps(gallery)
    u = models.PropertyUnit(**dump)
    db.add(u)
    db.commit()
    db.refresh(u)
    return serialize_unit(u)


@app.put("/api/units/{unit_id}", response_model=schemas.PropertyUnitOut)
def update_unit(unit_id: int, payload: schemas.PropertyUnitUpdate, db: Session = Depends(get_db)):
    u = db.query(models.PropertyUnit).filter(models.PropertyUnit.id == unit_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Unit not found")
    dump = payload.model_dump()
    gallery = dump.pop("gallery_images", None)
    if gallery is not None:
        if dump.get("image_url") and dump["image_url"] not in gallery:
            gallery.insert(0, dump["image_url"])
        elif gallery and not dump.get("image_url"):
            dump["image_url"] = gallery[0]
        u.gallery_images = json.dumps(gallery)
    for k, v in dump.items():
        setattr(u, k, v)
    db.commit()
    db.refresh(u)
    return serialize_unit(u)


@app.delete("/api/units/{unit_id}")
def delete_unit(unit_id: int, db: Session = Depends(get_db)):
    u = db.query(models.PropertyUnit).filter(models.PropertyUnit.id == unit_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Unit not found")
    db.delete(u)
    db.commit()
    return {"ok": True}


# --- Lease Contracts CRUD ---
@app.get("/api/leases", response_model=List[schemas.LeaseContractOut])
def list_leases(db: Session = Depends(get_db)):
    leases = db.query(models.LeaseContract).order_by(models.LeaseContract.end_date.asc()).all()
    for l in leases:
        sync_lease_monthly_schedule(l, db)
    return [serialize_lease(l) for l in leases]


@app.post("/api/leases", response_model=schemas.LeaseContractOut)
def create_lease(payload: schemas.LeaseContractCreate, db: Session = Depends(get_db)):
    dump = payload.model_dump()
    docs = dump.pop("documents", None) or []
    dump["documents"] = json.dumps(docs)
    if docs and not dump.get("document_url"):
        dump["document_url"] = docs[0].get("url")
    l = models.LeaseContract(**dump)
    normalize_lease_dual_rates(l)
    db.add(l)
    # Also mark unit as Occupied if lease is Active or Expiring Soon
    if l.status in ("Active", "Expiring Soon"):
        u = db.query(models.PropertyUnit).filter(models.PropertyUnit.id == l.unit_id).first()
        if u:
            u.status = "Occupied"
    db.commit()
    db.refresh(l)
    sync_lease_monthly_schedule(l, db)
    return serialize_lease(l)


@app.put("/api/leases/{lease_id}", response_model=schemas.LeaseContractOut)
def update_lease(lease_id: int, payload: schemas.LeaseContractUpdate, db: Session = Depends(get_db)):
    l = db.query(models.LeaseContract).filter(models.LeaseContract.id == lease_id).first()
    if not l:
        raise HTTPException(status_code=404, detail="Lease contract not found")
    dump = payload.model_dump()
    docs = dump.pop("documents", None)
    if docs is not None:
        l.documents = json.dumps(docs)
        if docs and not dump.get("document_url"):
            dump["document_url"] = docs[0].get("url")
    for k, v in dump.items():
        setattr(l, k, v)
    normalize_lease_dual_rates(l)
    db.commit()
    db.refresh(l)
    sync_lease_monthly_schedule(l, db)
    return serialize_lease(l)


@app.patch("/api/leases/{lease_id}/terms", response_model=schemas.LeaseContractOut)
def update_lease_terms(
    lease_id: int, payload: schemas.LeaseTermsQuickUpdate, db: Session = Depends(get_db)
):
    l = db.query(models.LeaseContract).filter(models.LeaseContract.id == lease_id).first()
    if not l:
        raise HTTPException(status_code=404, detail="Lease contract not found")
    l.start_date = payload.start_date
    l.end_date = payload.end_date
    l.monthly_rent = payload.monthly_rent
    l.security_deposit = payload.security_deposit
    if payload.has_rent_spread is not None:
        l.has_rent_spread = payload.has_rent_spread
    if payload.landlord_monthly_rent is not None:
        l.landlord_monthly_rent = payload.landlord_monthly_rent
    if payload.landlord_security_deposit is not None:
        l.landlord_security_deposit = payload.landlord_security_deposit
    if payload.agent_commission is not None:
        l.agent_commission = payload.agent_commission
    if payload.management_fee_percent is not None:
        l.management_fee_percent = payload.management_fee_percent
    if payload.payment_due_day is not None:
        l.payment_due_day = payload.payment_due_day
    if payload.status is not None:
        l.status = payload.status
    normalize_lease_dual_rates(l)
    db.commit()
    db.refresh(l)
    sync_lease_monthly_schedule(l, db)
    return serialize_lease(l)


@app.post("/api/leases/{lease_id}/early-terminate", response_model=schemas.LeaseContractOut)
def early_terminate_lease(
    lease_id: int, payload: schemas.EarlyTerminationPayload, db: Session = Depends(get_db)
):
    l = db.query(models.LeaseContract).filter(models.LeaseContract.id == lease_id).first()
    if not l:
        raise HTTPException(status_code=404, detail="Lease contract not found")

    normalize_lease_dual_rates(l)
    l.status = "Terminated"
    l.early_termination_date = payload.early_termination_date
    l.early_termination_note = (
        payload.early_termination_note
        or "Early termination — remaining pending rent written off and deposit forfeited."
    )
    l.deposit_forfeited = 1 if payload.forfeit_deposit else 0

    # Write off all remaining Pending / Overdue months
    pending_rows = (
        db.query(models.RentalPayment)
        .filter(
            models.RentalPayment.lease_id == lease_id,
            models.RentalPayment.status.in_(["Pending", "Overdue"]),
        )
        .all()
    )
    for p in pending_rows:
        p.status = "Written Off"
        p.paid_date = None
        p.amount_collected_from_tenant = 0.0
        p.net_payout_to_landlord = 0.0
        p.other_landlord_expenses = 0.0
        p.expense_breakdown_note = (
            f"Written off due to Early Termination ({payload.early_termination_date})"
        )

    # Mark property unit Available again
    u = db.query(models.PropertyUnit).filter(models.PropertyUnit.id == l.unit_id).first()
    if u and u.status == "Occupied":
        u.status = "Available"

    db.commit()
    db.refresh(l)
    return serialize_lease(l)


@app.post("/api/leases/{lease_id}/restore-terminated", response_model=schemas.LeaseContractOut)
def restore_terminated_lease(lease_id: int, db: Session = Depends(get_db)):
    l = db.query(models.LeaseContract).filter(models.LeaseContract.id == lease_id).first()
    if not l:
        raise HTTPException(status_code=404, detail="Lease contract not found")

    normalize_lease_dual_rates(l)
    l.status = "Active"
    l.deposit_forfeited = 0
    l.early_termination_date = None
    l.early_termination_note = None

    ll_rent = float(l.landlord_monthly_rent or l.monthly_rent or 0.0)
    tn_rent = float(l.monthly_rent or 0.0)
    mgmt_pct = float(l.management_fee_percent if l.management_fee_percent is not None else 5.0)
    mgmt_fee = round(ll_rent * (mgmt_pct / 100.0))

    written_off = (
        db.query(models.RentalPayment)
        .filter(
            models.RentalPayment.lease_id == lease_id,
            models.RentalPayment.status == "Written Off",
        )
        .all()
    )
    for p in written_off:
        p.status = "Pending"
        p.base_rent = tn_rent
        p.landlord_base_rent = ll_rent
        p.rent_spread_agency = max(0.0, tn_rent - ll_rent)
        p.amount_collected_from_tenant = tn_rent + float(p.tenant_extra_charges or 0.0)
        p.other_landlord_expenses = mgmt_fee
        p.net_payout_to_landlord = ll_rent - float(p.landlord_repair_deduction or 0.0) - mgmt_fee
        p.expense_breakdown_note = f"{mgmt_pct:g}% Monthly Management Fee on ฿{ll_rent:,.0f} (฿{mgmt_fee:,.0f})"

    db.commit()
    db.refresh(l)
    return serialize_lease(l)


@app.delete("/api/leases/{lease_id}")
def delete_lease(lease_id: int, db: Session = Depends(get_db)):
    l = db.query(models.LeaseContract).filter(models.LeaseContract.id == lease_id).first()
    if not l:
        raise HTTPException(status_code=404, detail="Lease contract not found")
    db.delete(l)
    db.commit()
    return {"ok": True}


# --- Lease Statement of Account (SOA) & Rental Payment Ledger ---
@app.get("/api/leases/{lease_id}/statement")
def get_lease_statement(lease_id: int, db: Session = Depends(get_db)):
    l = db.query(models.LeaseContract).filter(models.LeaseContract.id == lease_id).first()
    if not l:
        raise HTTPException(status_code=404, detail="Lease contract not found")

    sync_lease_monthly_schedule(l, db)

    payments = (
        db.query(models.RentalPayment)
        .filter(models.RentalPayment.lease_id == lease_id)
        .order_by(models.RentalPayment.billing_month.asc())
        .all()
    )
    unit_issues = (
        db.query(models.UnitIssue)
        .filter(models.UnitIssue.unit_id == l.unit_id)
        .order_by(models.UnitIssue.reported_date.desc())
        .all()
    )

    expected_months = generate_lease_months(l.start_date, l.end_date)
    first_month = expected_months[0] if expected_months else None

    # Ensure payments are strictly chronological matching contract month sequence (M1, M2, ... M12)
    month_order = {ym: idx for idx, ym in enumerate(expected_months)}
    payments.sort(key=lambda p: month_order.get(p.billing_month, 999))

    paid_payments = [
        p for p in payments if p.status in ("Paid & Settled", "Collected (Pending Payout)", "Paid")
    ]
    written_off_payments = [p for p in payments if p.status == "Written Off"]
    pending_payments = [
        p for p in payments if p not in paid_payments and p not in written_off_payments
    ]
    active_schedule_payments = [p for p in payments if p.status != "Written Off"]

    tn_rent = float(l.monthly_rent or 0.0)
    ll_rent = float(l.landlord_monthly_rent or tn_rent)
    tn_deposit = float(l.security_deposit or 0.0)
    ll_deposit = float(
        l.landlord_security_deposit if l.landlord_security_deposit is not None else tn_deposit
    )
    upfront_commission = float(l.agent_commission or 0.0)

    # Tenant Totals (Based on Tenant Rent, e.g. 10,000/mo)
    total_base_rent = sum(p.base_rent for p in paid_payments)
    total_tenant_extra = sum(p.tenant_extra_charges for p in paid_payments)
    total_collected_from_tenant = sum(p.amount_collected_from_tenant for p in paid_payments)
    scheduled_contract_total = sum(p.base_rent for p in active_schedule_payments)
    written_off_tenant_rent = sum(p.base_rent for p in written_off_payments)
    written_off_landlord_rent = sum(
        float(p.landlord_base_rent or p.base_rent) for p in written_off_payments
    )

    # Landlord Totals (Strictly based on Landlord Rent, e.g. 9,000/mo, with Upfront Commission deducted at signing)
    # Total contract months: e.g. strictly 12 months for 1 year (no M13)
    # Landlord gets 11 months of rent (M2 to M12) as M1 advance rent covers agency broker commission
    contract_total_months = len(expected_months)
    landlord_payout_months_count = max(0, contract_total_months - 1)
    landlord_11_months_gross_rent = landlord_payout_months_count * ll_rent

    total_landlord_gross_rent = sum(
        float(p.landlord_base_rent or p.base_rent) for p in paid_payments
    )
    total_landlord_repairs = sum(p.landlord_repair_deduction for p in paid_payments)

    # Separate Month 1 Upfront Commission from recurring monthly Management Fees
    mgmt_paid_payments = [p for p in paid_payments if p.billing_month != first_month]
    agency_management_fees_earned = sum(p.other_landlord_expenses for p in mgmt_paid_payments)
    total_other_expenses = agency_management_fees_earned

    total_monthly_net_payouts = sum(p.net_payout_to_landlord for p in paid_payments)
    forfeited_deposit_payable_to_landlord = ll_deposit if l.deposit_forfeited else 0.0
    # Month 1 net payout is already 0.0 (as 1st month rent covers broker commission),
    # so sum of net payouts directly equals total net received by landlord:
    total_net_payout_to_landlord = (
        total_monthly_net_payouts
        + forfeited_deposit_payable_to_landlord
    )

    total_landlord_expenses = (
        upfront_commission
        + total_landlord_repairs
        + agency_management_fees_earned
    )

    # Agency Profit & Revenue Statement (Clause 2: Upfront 1st Month Commission + Rent Difference + Mgmt Fees + Repair Charges + Deposit Spread)
    agency_rent_spread_earned = sum(float(p.rent_spread_agency or 0.0) for p in paid_payments)
    agency_repair_charges_billed = total_landlord_repairs + total_tenant_extra
    agency_forfeited_deposit_spread = (
        max(0.0, tn_deposit - ll_deposit) if l.deposit_forfeited else 0.0
    )
    agency_total_profit_earned = (
        upfront_commission
        + agency_rent_spread_earned
        + agency_management_fees_earned
        + agency_forfeited_deposit_spread
    )

    active_mgmt_payments = [p for p in active_schedule_payments if p.billing_month != first_month]
    agency_projected_full_profit = (
        upfront_commission
        + sum(float(p.rent_spread_agency or 0.0) for p in active_schedule_payments)
        + sum(float(p.other_landlord_expenses or 0.0) for p in active_mgmt_payments)
        + agency_forfeited_deposit_spread
    )

    # 5% Withholding Tax (WHT) from Rental Collection (Revenue Dept Section 3 Trevis / Por. 4)
    rental_wht_rate = 5.0
    monthly_rental_wht_tenant = round(tn_rent * 0.05, 2)
    monthly_rental_wht_landlord = round(ll_rent * 0.05, 2)
    total_paid_rental_wht_tenant = sum(round(p.base_rent * 0.05, 2) for p in paid_payments)
    total_paid_rental_wht_landlord = sum(
        round(float(p.landlord_base_rent if p.landlord_base_rent is not None else p.base_rent) * 0.05, 2)
        for p in paid_payments
    )
    projected_contract_rental_wht = round(contract_total_months * monthly_rental_wht_tenant, 2)
    landlord_11_months_wht = round(landlord_payout_months_count * monthly_rental_wht_landlord, 2)

    return {
        "lease": serialize_lease(l),
        "unit": serialize_unit(l.unit) if l.unit else None,
        "landlord": serialize_contact(l.landlord) if l.landlord else None,
        "tenant": serialize_contact(l.tenant) if l.tenant else None,
        "payments": [serialize_payment(p) for p in payments],
        "unit_issues": [serialize_issue(i) for i in unit_issues],
        "summary": {
            "months_recorded": len(payments),
            "contract_total_months": contract_total_months,
            "landlord_payout_months_count": landlord_payout_months_count,
            "landlord_11_months_gross_rent": landlord_11_months_gross_rent,
            "paid_months_count": len(paid_payments),
            "pending_months_count": len(pending_payments),
            "written_off_months_count": len(written_off_payments),
            "scheduled_contract_total": scheduled_contract_total,
            "written_off_tenant_rent": written_off_tenant_rent,
            "written_off_landlord_rent": written_off_landlord_rent,
            # 5% Withholding Tax from Rental Collection
            "rental_wht_rate": rental_wht_rate,
            "monthly_rental_wht_tenant": monthly_rental_wht_tenant,
            "monthly_rental_wht_landlord": monthly_rental_wht_landlord,
            "total_paid_rental_wht_tenant": total_paid_rental_wht_tenant,
            "total_paid_rental_wht_landlord": total_paid_rental_wht_landlord,
            "projected_contract_rental_wht": projected_contract_rental_wht,
            "landlord_11_months_wht": landlord_11_months_wht,
            # Tenant SOA Metrics
            "total_base_rent": total_base_rent,
            "total_tenant_extra_charges": total_tenant_extra,
            "total_collected_from_tenant": total_collected_from_tenant,
            "security_deposit_held": tn_deposit,
            # Landlord SOA Metrics (Based on Landlord Rate, e.g., 9,000/mo)
            "landlord_monthly_rent": ll_rent,
            "landlord_security_deposit": ll_deposit,
            "total_landlord_gross_rent": total_landlord_gross_rent,
            "upfront_commission_deducted": upfront_commission,
            "total_landlord_repair_deductions": total_landlord_repairs,
            "total_other_landlord_expenses": total_other_expenses,
            "total_landlord_expenses": total_landlord_repairs
            + total_other_expenses
            + upfront_commission,
            "total_monthly_net_payouts": total_monthly_net_payouts,
            "forfeited_deposit_payable_to_landlord": forfeited_deposit_payable_to_landlord,
            "total_net_payout_to_landlord": total_net_payout_to_landlord,
            # Agency Profit & Revenue Statement Metrics (Clause 2)
            "monthly_rent_spread": max(0.0, tn_rent - ll_rent),
            "agency_upfront_commission": upfront_commission,
            "agency_rent_spread_earned": agency_rent_spread_earned,
            "agency_management_fees_earned": agency_management_fees_earned,
            "agency_repair_charges_billed": agency_repair_charges_billed,
            "agency_forfeited_deposit_spread": agency_forfeited_deposit_spread,
            "agency_total_profit_earned": agency_total_profit_earned,
            "agency_projected_full_profit": agency_projected_full_profit,
        },
    }


@app.get("/api/payments", response_model=List[schemas.RentalPaymentOut])
def list_payments(
    lease_id: Optional[int] = None,
    landlord_id: Optional[int] = None,
    tenant_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(models.RentalPayment)
    if lease_id:
        q = q.filter(models.RentalPayment.lease_id == lease_id)
    if landlord_id:
        q = q.filter(models.RentalPayment.landlord_id == landlord_id)
    if tenant_id:
        q = q.filter(models.RentalPayment.tenant_id == tenant_id)
    rows = q.order_by(models.RentalPayment.billing_month.asc()).all()
    return [serialize_payment(p) for p in rows]


@app.post("/api/payments", response_model=schemas.RentalPaymentOut)
def create_payment(payload: schemas.RentalPaymentCreate, db: Session = Depends(get_db)):
    p = models.RentalPayment(**payload.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return serialize_payment(p)


@app.put("/api/payments/{payment_id}", response_model=schemas.RentalPaymentOut)
def update_payment(
    payment_id: int, payload: schemas.RentalPaymentUpdate, db: Session = Depends(get_db)
):
    p = db.query(models.RentalPayment).filter(models.RentalPayment.id == payment_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payment record not found")
    for k, v in payload.model_dump().items():
        setattr(p, k, v)
    if not p.landlord_base_rent and p.lease:
        p.landlord_base_rent = float(p.lease.landlord_monthly_rent or p.base_rent)
    p.rent_spread_agency = max(0.0, float(p.base_rent or 0.0) - float(p.landlord_base_rent or p.base_rent or 0.0))
    if p.status in ("Paid & Settled", "Collected (Pending Payout)", "Paid"):
        if not p.paid_date:
            p.paid_date = date.today().isoformat()
        if p.receipt_no.startswith("SCH-"):
            p.receipt_no = "RCP-" + p.receipt_no[4:]
    db.commit()
    db.refresh(p)
    return serialize_payment(p)


@app.patch("/api/payments/{payment_id}/quick-update", response_model=schemas.RentalPaymentOut)
def quick_update_payment(
    payment_id: int, payload: schemas.RentalPaymentQuickUpdate, db: Session = Depends(get_db)
):
    p = db.query(models.RentalPayment).filter(models.RentalPayment.id == payment_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payment record not found")

    dump = payload.model_dump(exclude_unset=True)
    for k, v in dump.items():
        setattr(p, k, v)

    base_rent = float(p.base_rent or 0.0)
    ll_base_rent = float(
        p.landlord_base_rent
        if (p.landlord_base_rent is not None and p.landlord_base_rent > 0)
        else (p.lease.landlord_monthly_rent if p.lease and p.lease.landlord_monthly_rent else base_rent)
    )
    p.landlord_base_rent = ll_base_rent
    p.rent_spread_agency = max(0.0, base_rent - ll_base_rent)

    extra = float(p.tenant_extra_charges or 0.0)
    repair = float(p.landlord_repair_deduction or 0.0)
    other = float(p.other_landlord_expenses or 0.0)

    if p.status == "Written Off":
        p.amount_collected_from_tenant = 0.0
        p.net_payout_to_landlord = 0.0
        p.paid_date = None
    else:
        p.amount_collected_from_tenant = base_rent + extra
        p.net_payout_to_landlord = ll_base_rent - repair - other

    if p.status in ("Paid & Settled", "Collected (Pending Payout)", "Paid"):
        if not p.paid_date:
            p.paid_date = date.today().isoformat()
        if p.receipt_no.startswith("SCH-"):
            p.receipt_no = "RCP-" + p.receipt_no[4:]
    elif p.status == "Pending":
        p.paid_date = None

    db.commit()
    db.refresh(p)
    return serialize_payment(p)


@app.delete("/api/payments/{payment_id}")
def delete_payment(payment_id: int, db: Session = Depends(get_db)):
    p = db.query(models.RentalPayment).filter(models.RentalPayment.id == payment_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payment record not found")
    db.delete(p)
    db.commit()
    return {"ok": True}


# --- Unit Issues CRUD ---
@app.get("/api/issues", response_model=List[schemas.UnitIssueOut])
def list_issues(db: Session = Depends(get_db)):
    issues = db.query(models.UnitIssue).order_by(models.UnitIssue.reported_date.desc()).all()
    return [serialize_issue(i) for i in issues]


@app.post("/api/issues", response_model=schemas.UnitIssueOut)
def create_issue(payload: schemas.UnitIssueCreate, db: Session = Depends(get_db)):
    dump = payload.model_dump()
    imgs = dump.pop("issue_images", None) or []
    docs = dump.pop("issue_documents", None) or []
    dump["issue_images"] = json.dumps(imgs)
    dump["issue_documents"] = json.dumps(docs)
    i = models.UnitIssue(**dump)
    db.add(i)
    db.commit()
    db.refresh(i)
    return serialize_issue(i)


@app.put("/api/issues/{issue_id}", response_model=schemas.UnitIssueOut)
def update_issue(issue_id: int, payload: schemas.UnitIssueUpdate, db: Session = Depends(get_db)):
    i = db.query(models.UnitIssue).filter(models.UnitIssue.id == issue_id).first()
    if not i:
        raise HTTPException(status_code=404, detail="Issue not found")
    dump = payload.model_dump()
    imgs = dump.pop("issue_images", None)
    docs = dump.pop("issue_documents", None)
    for k, v in dump.items():
        setattr(i, k, v)
    if imgs is not None:
        i.issue_images = json.dumps(imgs)
    if docs is not None:
        i.issue_documents = json.dumps(docs)
    db.commit()
    db.refresh(i)
    return serialize_issue(i)


@app.delete("/api/issues/{issue_id}")
def delete_issue(issue_id: int, db: Session = Depends(get_db)):
    i = db.query(models.UnitIssue).filter(models.UnitIssue.id == issue_id).first()
    if not i:
        raise HTTPException(status_code=404, detail="Issue not found")
    db.delete(i)
    db.commit()
    return {"ok": True}


# --- Financial & Fee Settings API ---
SETTINGS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "financial_settings.json")

DEFAULT_FINANCIAL_SETTINGS = {
    "taxes": {
        "transfer_fee_rate": 2.0,
        "default_transfer_split": "50_50",
        "sbt_rate": 3.3,
        "stamp_duty_rate": 0.5,
        "wht_individual_rate": 2.2,
        "wht_corporate_rate": 1.0,
        "rental_wht_rate": 5.0,
        "land_and_building_tax_rate": 0.3,
    },
    "cam_fees": {
        "default_cam_per_sqm_month": 55.0,
        "sinking_fund_per_sqm": 500.0,
        "sinking_fund_payer": "BUYER",
        "juristic_meter_deposit": 4000.0,
        "juristic_annual_insurance": 2500.0,
    },
    "commissions": {
        "sale_commission_rate": 3.0,
        "sale_min_commission": 50000.0,
        "sale_co_broke_split_pct": 50.0,
        "sale_internal_agent_share_pct": 25.0,
        "rental_1yr_months": 1.0,
        "rental_6mo_months": 0.5,
        "rental_2yr_months": 1.5,
        "rental_renewal_months": 0.5,
        "rental_internal_agent_share_pct": 25.0,
    },
    "management_fees": {
        "monthly_pm_fee_pct": 8.0,
        "monthly_pm_fixed_fee": 0.0,
        "use_fixed_pm_fee": False,
        "turnover_inspection_fee": 1500.0,
        "annual_maintenance_escrow": 3000.0,
        "emergency_repair_threshold": 5000.0,
    },
    "custom_items": [
        {
            "id": "cust-fet-foreign-quota",
            "name": "Foreign Quota FET Due Diligence & Bank Cert",
            "category": "Legal & Administrative",
            "calc_type": "FIXED",
            "amount": 5000.0,
            "borne_by": "Buyer / Tenant",
            "applicable_to": "Sale",
            "active": True,
            "description": "Handling of Foreign Exchange Transaction (FET) form with Thai commercial banks."
        },
        {
            "id": "cust-sinking-fund",
            "name": "Condo Sinking Fund Reserve",
            "category": "CAM & Juristic",
            "calc_type": "PER_SQM_ONETIME",
            "amount": 500.0,
            "borne_by": "Buyer / Tenant",
            "applicable_to": "Sale",
            "active": True,
            "description": "One-time contribution to the building reserve sinking fund for major repairs."
        },
        {
            "id": "cust-meter-transfer",
            "name": "MEA / PWA Meter Ownership Transfer",
            "category": "Taxes & Government",
            "calc_type": "FIXED",
            "amount": 2500.0,
            "borne_by": "Buyer / Tenant",
            "applicable_to": "Sale",
            "active": True,
            "description": "Government utility deposit transfer at MEA/PEA & MWA/PWA offices."
        },
        {
            "id": "cust-turnover-cleaning",
            "name": "Pre-Move-In Deep Cleaning & AC Sanitization",
            "category": "Property Management",
            "calc_type": "FIXED",
            "amount": 2200.0,
            "borne_by": "Seller / Landlord",
            "applicable_to": "Rental",
            "active": True,
            "description": "Professional 2-stage chemical AC wash and turnover deep cleaning."
        }
    ],
    "project_cam_directory": [
        {
            "id": "proj-park-origin-thonglor",
            "projectName": "Park Origin Thonglor",
            "propertyType": "Condominium",
            "city": "Bangkok",
            "district": "Thonglor / Watthana",
            "developerName": "Origin Property",
            "camFeePerSqmMonth": 85.0,
            "sinkingFundPerSqm": 800.0,
            "paymentCycle": "Annually",
            "juristicCompany": "Savills Property Management",
            "juristicPhone": "+66 2 381 8800",
            "juristicLineId": "@parkorigin_jur",
            "juristicEmail": "juristic.thonglor@parkorigin.co.th",
            "notes": "Luxury high-rise duo space. Includes 50m pool, rooftop garden, onsen, 1 assigned parking slot."
        },
        {
            "id": "proj-the-monument-thonglor",
            "projectName": "The Monument Thonglor",
            "propertyType": "Condominium",
            "city": "Bangkok",
            "district": "Thonglor / Watthana",
            "developerName": "Sansiri",
            "camFeePerSqmMonth": 95.0,
            "sinkingFundPerSqm": 1000.0,
            "paymentCycle": "Annually",
            "juristicCompany": "Plus Property Concierge",
            "juristicPhone": "+66 2 392 9901",
            "juristicLineId": "@monument_jur",
            "juristicEmail": "monument.juristic@plus.co.th",
            "notes": "Ultra-luxury high rise. Private elevator access, 24/7 concierge, EV valet charging bays."
        },
        {
            "id": "proj-xt-ekkamai",
            "projectName": "XT Ekkamai",
            "propertyType": "Condominium",
            "city": "Bangkok",
            "district": "Ekkamai / Watthana",
            "developerName": "Sansiri",
            "camFeePerSqmMonth": 65.0,
            "sinkingFundPerSqm": 500.0,
            "paymentCycle": "Annually",
            "juristicCompany": "Plus Property",
            "juristicPhone": "+66 2 391 4455",
            "juristicLineId": "@xtekkamai_jur",
            "juristicEmail": "xt.ekkamai@plus.co.th",
            "notes": "Co-sharing amenities across XT brands, sky lounge, virtual fitness room, smart parcel locker."
        },
        {
            "id": "proj-life-asoke-hype",
            "projectName": "Life Asoke Hype",
            "propertyType": "Condominium",
            "city": "Bangkok",
            "district": "Makkasan / Ratchathewi",
            "developerName": "AP Thailand",
            "camFeePerSqmMonth": 50.0,
            "sinkingFundPerSqm": 500.0,
            "paymentCycle": "Semi-Annually",
            "juristicCompany": "SMART Service and Management",
            "juristicPhone": "+66 2 245 1100",
            "juristicLineId": "@lifeasokehype",
            "juristicEmail": "life.asoke@smartservice.co.th",
            "notes": "Next to MRT Rama 9 interchange. Mirage sky pool, co-working space, digital gym."
        },
        {
            "id": "proj-rhythm-phrom-phong",
            "projectName": "Rhythm Phrom Phong",
            "propertyType": "Condominium",
            "city": "Bangkok",
            "district": "Phrom Phong / Watthana",
            "developerName": "AP Thailand",
            "camFeePerSqmMonth": 60.0,
            "sinkingFundPerSqm": 500.0,
            "paymentCycle": "Annually",
            "juristicCompany": "SMART Service and Management",
            "juristicPhone": "+66 2 258 7700",
            "juristicLineId": "@rhythmphromphong",
            "juristicEmail": "rhythm.sukhumvit@smartservice.co.th",
            "notes": "Walking distance to BTS Phrom Phong & EmQuartier. 360-degree infinity pool deck."
        },
        {
            "id": "proj-demi-sukhumvit-31",
            "projectName": "Demi Sukhumvit 31",
            "propertyType": "Townhome",
            "city": "Bangkok",
            "district": "Sukhumvit 31 / Watthana",
            "developerName": "Sansiri",
            "camFeePerSqmMonth": 45.0,
            "sinkingFundPerSqm": 350.0,
            "paymentCycle": "Quarterly",
            "juristicCompany": "Plus Property Private Estate",
            "juristicPhone": "+66 2 260 3100",
            "juristicLineId": "@demi31_office",
            "juristicEmail": "demi31@plus.co.th",
            "notes": "Exclusive 3.5-storey gated townhome community. 24/7 guarded gate, private home elevator servicing."
        },
        {
            "id": "proj-burasiri-phuket",
            "projectName": "Burasiri Phuket Koh Kaew",
            "propertyType": "Single Home",
            "city": "Phuket",
            "district": "Koh Kaew / Mueang Phuket",
            "developerName": "Sansiri",
            "camFeePerSqmMonth": 35.0,
            "sinkingFundPerSqm": 250.0,
            "paymentCycle": "Semi-Annually",
            "juristicCompany": "Plus Property Estate Management",
            "juristicPhone": "+66 76 388 900",
            "juristicLineId": "@burasiriphuket",
            "juristicEmail": "burasiri.phuket@plus.co.th",
            "notes": "Gated resort single detached housing estate. Clubhouse, security barriers, perimeter patrol, park landscaping."
        },
        {
            "id": "proj-silom-shophouse",
            "projectName": "Silom-Naradhiwas Shophouse Strip",
            "propertyType": "Commercial",
            "city": "Bangkok",
            "district": "Silom / Bang Rak",
            "developerName": "Commercial Freehold",
            "camFeePerSqmMonth": 15.0,
            "sinkingFundPerSqm": 0.0,
            "paymentCycle": "Quarterly",
            "juristicCompany": "Silom Commercial Merchant Association",
            "juristicPhone": "+66 2 234 5678",
            "juristicLineId": "@silom_strip",
            "juristicEmail": "info@silomstrip.org",
            "notes": "Street commercial shophouses. Fee covers common alley lighting, CCTV monitoring, waste removal."
        },
        {
            "id": "proj-bangna-logistics",
            "projectName": "Bangna Logistics Park KM.19",
            "propertyType": "Commercial",
            "city": "Samut Prakan",
            "district": "Bang Phli",
            "developerName": "WHA / Frasers",
            "camFeePerSqmMonth": 12.0,
            "sinkingFundPerSqm": 100.0,
            "paymentCycle": "Monthly",
            "juristicCompany": "Park Industrial Operations",
            "juristicPhone": "+66 2 740 9900",
            "juristicLineId": "@bangnalogistics",
            "juristicEmail": "ops@bangnalogistics.com",
            "notes": "Heavy vehicle road network maintenance, industrial fire main, 24/7 security gates."
        }
    ]
}


@app.get("/api/financial-settings")
def get_financial_settings():
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data
        except Exception:
            return DEFAULT_FINANCIAL_SETTINGS
    return DEFAULT_FINANCIAL_SETTINGS


@app.put("/api/financial-settings")
def save_financial_settings(payload: dict):
    try:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
        return {"ok": True, "settings": payload}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {str(e)}")

@app.get("/api/communications", response_model=List[schemas.CommunicationLogOut])
def list_communications(db: Session = Depends(get_db)):
    comms = db.query(models.CommunicationLog).order_by(models.CommunicationLog.created_at.desc()).all()
    return [serialize_comm(c) for c in comms]


@app.post("/api/communications", response_model=schemas.CommunicationLogOut)
def create_communication(payload: schemas.CommunicationLogCreate, db: Session = Depends(get_db)):
    c = models.CommunicationLog(**payload.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return serialize_comm(c)


@app.delete("/api/communications/{comm_id}")
def delete_communication(comm_id: int, db: Session = Depends(get_db)):
    c = db.query(models.CommunicationLog).filter(models.CommunicationLog.id == comm_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Communication log not found")
    db.delete(c)
    db.commit()
    return {"ok": True}


# --- User Management & Granular Feature RBAC Endpoints ---
def serialize_user(u: models.AppUser) -> dict:
    perms = {}
    if u.permissions:
        try:
            perms = json.loads(u.permissions)
        except Exception:
            perms = {}
    return {
        "id": u.id,
        "full_name": u.full_name,
        "email": u.email,
        "role": u.role,
        "department": u.department,
        "phone": u.phone,
        "status": u.status,
        "avatar_url": u.avatar_url,
        "last_login": u.last_login or "Never",
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "permissions": perms,
    }


@app.get("/api/users")
def list_app_users(db: Session = Depends(get_db)):
    users = db.query(models.AppUser).order_by(models.AppUser.id.asc()).all()
    return [serialize_user(u) for u in users]


@app.get("/api/users/roles-matrix")
def get_roles_matrix():
    return {
        "roles": [
            {
                "name": "Super Admin",
                "department": "Executive Management",
                "badge": "Full Access",
                "color": "indigo",
                "description": "Full unconstrained administrative authority across financial settings, audit logs, dual-rate spread, contract terminations, and user access permissions.",
            },
            {
                "name": "Branch Manager",
                "department": "Operations & Sales",
                "badge": "Managerial",
                "color": "sky",
                "description": "Branch-level supervisor with access to property transactions, team oversight, approval of contracts, statements, and repair disputes.",
            },
            {
                "name": "Senior Leasing Agent",
                "department": "Leasing & Sales",
                "badge": "Standard Agent",
                "color": "emerald",
                "description": "Full access to inventory listings, client CRM records, standard lease generation, and uploading transfer slips; confidential profit spread hidden.",
            },
            {
                "name": "Junior Agent",
                "department": "Leasing & Sales",
                "badge": "Restricted",
                "color": "amber",
                "description": "Read-only access to available properties and clients; can log initial defect issues but cannot alter active lease terms or see landlord rates.",
            },
            {
                "name": "Property Inspector",
                "department": "Defect & Maintenance",
                "badge": "Field Ops",
                "color": "purple",
                "description": "Specialized field role for unit defect inspections, uploading photo evidence, and logging developer warranty claims without financial or lease clutter.",
            },
            {
                "name": "Accountant",
                "department": "Finance & Accounts",
                "badge": "Finance & Tax",
                "color": "rose",
                "description": "Access to Statements of Account, monthly rental collection ledger, 5% Withholding Tax calculations, and Property Transaction Tax Calculator.",
            },
        ],
        "default_permissions": DEFAULT_ROLE_PERMISSIONS,
    }


@app.post("/api/users")
def create_app_user(payload: schemas.AppUserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.AppUser).filter(models.AppUser.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    perms = payload.permissions
    if not perms:
        perms = DEFAULT_ROLE_PERMISSIONS.get(payload.role, DEFAULT_ROLE_PERMISSIONS["Senior Leasing Agent"])

    user = models.AppUser(
        full_name=payload.full_name,
        email=payload.email,
        role=payload.role,
        department=payload.department,
        phone=payload.phone,
        status=payload.status or "Active",
        avatar_url=payload.avatar_url
        or f"https://api.dicebear.com/7.x/initials/svg?seed={payload.full_name}",
        last_login="Never",
        permissions=json.dumps(perms),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return serialize_user(user)


@app.get("/api/users/{user_id}")
def get_app_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.AppUser).filter(models.AppUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return serialize_user(user)


@app.put("/api/users/{user_id}")
def update_app_user(user_id: int, payload: schemas.AppUserUpdate, db: Session = Depends(get_db)):
    user = db.query(models.AppUser).filter(models.AppUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.email is not None:
        user.email = payload.email
    if payload.role is not None:
        user.role = payload.role
    if payload.department is not None:
        user.department = payload.department
    if payload.phone is not None:
        user.phone = payload.phone
    if payload.status is not None:
        user.status = payload.status
    if payload.avatar_url is not None:
        user.avatar_url = payload.avatar_url
    if payload.permissions is not None:
        user.permissions = json.dumps(payload.permissions)

    db.commit()
    db.refresh(user)
    return serialize_user(user)


@app.put("/api/users/{user_id}/permissions")
def update_app_user_permissions(user_id: int, payload: schemas.AppUserPermissionsUpdate, db: Session = Depends(get_db)):
    user = db.query(models.AppUser).filter(models.AppUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.permissions = json.dumps(payload.permissions)
    db.commit()
    db.refresh(user)
    return serialize_user(user)


@app.post("/api/users/{user_id}/reset-permissions")
def reset_app_user_permissions(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.AppUser).filter(models.AppUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role_template = DEFAULT_ROLE_PERMISSIONS.get(user.role, DEFAULT_ROLE_PERMISSIONS["Senior Leasing Agent"])
    user.permissions = json.dumps(role_template)
    db.commit()
    db.refresh(user)
    return serialize_user(user)


@app.delete("/api/users/{user_id}")
def delete_app_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.AppUser).filter(models.AppUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "Super Admin" and db.query(models.AppUser).filter(models.AppUser.role == "Super Admin").count() <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the only Super Admin in the system")

    db.delete(user)
    db.commit()
    return {"ok": True}


# --- Static Frontend SPA Production Serving (Cloud Deployment) ---
FRONTEND_DIST = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist"
)
if os.path.exists(FRONTEND_DIST):
    assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend_spa(full_path: str):
        if full_path.startswith("api") or full_path.startswith("uploads"):
            raise HTTPException(status_code=404, detail="API route not found")
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))


