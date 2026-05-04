from html import escape

from app.core.config import config
from app.core.db import db
from app.models import Alerts, Products
from app.services.user_services import get_all_active_employees
from app.util.send import render_email, send_email, send_sms
from datetime import datetime


def _useful(value):
    # Blanks and the planogram's "unknown" placeholder mean "no filter".
    return value and str(value).strip().lower() not in ("", "unknown")


def _resolve_product_by_sku(sku):
    if not isinstance(sku, dict):
        return None
    name = sku.get("product_name") or sku.get("name")
    if not _useful(name):
        return None
    query = Products.query.filter(Products.name == name)
    brand = sku.get("brand")
    if _useful(brand):
        query = query.filter(Products.brand == brand)
    variant = sku.get("variant")
    if _useful(variant):
        query = query.filter(Products.variant == variant)
    size = sku.get("size")
    if _useful(size):
        query = query.filter(Products.size == size)
    return query.first()


def _resolve_product(item):
    """Resolve the Products row this detection is *about*.
    Always the slot's expected SKU: for missing/misplaced/correct, the row we
    care about is the one the planogram says belongs in that slot. The actual
    detected SKU (item['sku']) is only used as a fallback if there's no
    expected SKU on the entry.
    """
    if not isinstance(item, dict):
        return None
    return _resolve_product_by_sku(item.get("expected_sku") or item.get("sku"))


def _describe_sku(sku: dict | None) -> str:
    """Compact human label for an SKU dict; falls back to '—'."""
    if not sku:
        return "—"
    parts = [
        sku.get("brand"),
        sku.get("product_name") or sku.get("name"),
        sku.get("variant"),
        sku.get("size"),
    ]
    parts = [str(p) for p in parts if p and str(p).strip() and str(p).lower() != "unknown"]
    return " · ".join(parts) or "—"


def _slot_label(item: dict) -> str:
    """Detection coordinates straight from the planogram match."""
    slot_id = item.get("slot_id")
    if slot_id:
        return str(slot_id)
    row = item.get("row")
    pos = item.get("position")
    if row and pos:
        return f"R{row}-P{pos}"
    return "—"


def _build_items_table(detected_items: list[dict]) -> str:
    """Render the missing/misplaced items as an HTML table for the email body."""
    rows: list[str] = []
    for item in detected_items:
        if not isinstance(item, dict):
            continue
        status = item.get("audit_status")
        if status not in ("missing", "misplaced"):
            continue

        # For missing slots, the "what should be here" SKU is expected_sku.
        # For misplaced products, sku is the actual product detected; expected_sku
        # is what the planogram said belongs in that slot.
        primary_sku = item.get("expected_sku") if status == "missing" else item.get("sku")
        product = _resolve_product(item)
        shelf = product.shelf if product is not None else "—"
        aisle = product.aisle if product is not None else "—"

        rows.append(
            "<tr>"
            f"<td style='padding:8px 12px;border-bottom:1px solid #f3f4f6;'><span class='accent'>{escape(status.title())}</span></td>"
            f"<td style='padding:8px 12px;border-bottom:1px solid #f3f4f6;'>{escape(_describe_sku(primary_sku))}</td>"
            f"<td style='padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;'>{escape(_slot_label(item))}</td>"
            f"<td style='padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;'>{escape(str(shelf))}</td>"
            f"<td style='padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;'>{escape(str(aisle))}</td>"
            "</tr>"
        )

    if not rows:
        return ""

    return (
        "<table style='width:100%;border-collapse:collapse;font-size:14px;margin:8px 0 24px;'>"
        "<thead>"
        "<tr style='text-align:left;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.05em;'>"
        "<th style='padding:8px 12px;border-bottom:1px solid #e5e7eb;'>Status</th>"
        "<th style='padding:8px 12px;border-bottom:1px solid #e5e7eb;'>Product</th>"
        "<th style='padding:8px 12px;border-bottom:1px solid #e5e7eb;'>Slot</th>"
        "<th style='padding:8px 12px;border-bottom:1px solid #e5e7eb;'>Shelf</th>"
        "<th style='padding:8px 12px;border-bottom:1px solid #e5e7eb;'>Aisle</th>"
        "</tr>"
        "</thead>"
        f"<tbody>{''.join(rows)}</tbody>"
        "</table>"
    )


def _build_email(
    detected_items: list[dict],
    shelf_analysis_log_id: int | None,
    missing_count: int,
    misplaced_count: int,
    timestamp: str,
) -> tuple[str, str]:
    """Return (plain_text_body, html_body) for the alert email."""
    base_url = config.FRONTEND_URL.split(",")[0].strip().rstrip("/")
    if shelf_analysis_log_id is not None:
        link = f"{base_url}/shelf-detection?log_id={shelf_analysis_log_id}"
    else:
        link = f"{base_url}/shelf-detection"

    plain = (
        f"Shelf scan at {timestamp}\n"
        f"Total issues: {len(detected_items)} (missing: {missing_count}, misplaced: {misplaced_count})\n\n"
        f"View the scan: {link}\n"
    )

    items_html = _build_items_table(detected_items)
    content = (
        f"<p>A shelf scan completed at <span class='accent'>{escape(timestamp)}</span> "
        f"and flagged <span class='accent'>{len(detected_items)}</span> issue(s) — "
        f"missing: <span class='accent'>{missing_count}</span>, "
        f"misplaced: <span class='accent'>{misplaced_count}</span>.</p>"
        f"{items_html}"
        f"<a class='btn' href='{escape(link)}'>View Shelf Detection</a>"
        f"<p class='muted'>If the button doesn't work, copy this URL into your browser:<br>"
        f"<a href='{escape(link)}' style='color:#6b7280;'>{escape(link)}</a></p>"
    )
    return plain, render_email(content)


def update_shelf_status_from_detections(detections):
    """Flip Products.shelf_status based on the latest scan results so the
    out-of-stock / low-stock views can read it directly from the DB.
    """
    if not detections:
        return

    now = datetime.now()
    # Subtractive update: each scan only DECREMENTS quantity_in_store by the
    # number of facings newly reported missing. We never reset it back to the
    # planogram total — once depleted, only a real restock should refill it.
    missing_by_product: dict[int, int] = {}
    misplaced_seen: set[int] = set()
    products_by_id: dict[int, Products] = {}
    unresolved_skus: list[str] = []

    for item in detections:
        if not isinstance(item, dict):
            continue
        audit_status = item.get("audit_status")
        if audit_status not in ("correct", "missing", "misplaced", "unverified"):
            continue

        product = _resolve_product(item)
        if product is None:
            sku = item.get("expected_sku") or item.get("sku") or {}
            unresolved_skus.append(
                f"{sku.get('brand', '?')}/{sku.get('product_name') or sku.get('name', '?')}/{sku.get('variant', '?')}"
            )
            continue

        products_by_id[product.product_id] = product

        if audit_status == "missing":
            slot_qty = (item.get("expected_sku") or {}).get("quantity")
            slot_qty = int(slot_qty) if slot_qty is not None else 0
            # Camera only sees the front face. gap_type hints at depth:
            # "full" gap → assume the whole stack is gone;
            # "partial" → front is gone but something still sits behind it.
            gap_type = item.get("gap_type")
            if gap_type == "partial":
                lost = max(1, slot_qty // 2)
            else:
                lost = slot_qty if slot_qty > 0 else 1
            missing_by_product[product.product_id] = missing_by_product.get(product.product_id, 0) + lost
        elif audit_status == "misplaced":
            misplaced_seen.add(product.product_id)

    for product_id, product in products_by_id.items():
        lost = missing_by_product.get(product_id, 0)
        if lost > 0:
            product.quantity_in_store = max(0, (product.quantity_in_store or 0) - lost)

        remaining = product.quantity_in_store or 0
        baseline = product.original_quantity or remaining or 1
        ratio = remaining / baseline if baseline > 0 else 0
        # Misplaced wins over stock-level statuses: even if the product is also
        # low/out of stock, the placement issue is what we want surfaced.
        if product_id in misplaced_seen:
            product.shelf_status = "misplaced"
        elif ratio < 0.05:
            product.shelf_status = "out_of_stock"
        elif ratio < 0.15:
            product.shelf_status = "low_stock"
        else:
            product.shelf_status = "on_shelf"
        product.last_checked = now

    if products_by_id:
        db.session.commit()

    print(
        f"[shelf_status] resolved={len(products_by_id)} "
        f"decremented={sum(1 for q in missing_by_product.values() if q > 0)} "
        f"unresolved={len(unresolved_skus)}"
    )
    if unresolved_skus:
        print(f"[shelf_status] unresolved SKUs (first 10): {unresolved_skus[:10]}")


def send_out_of_stock_alerts(detected_items=None, shelf_analysis_log_id=None):
    """Email every active employee with the scan summary and a deep-link to the
    shelf-detection page. Also sends a short SMS for users with a phone/carrier,
    and writes one Alerts row per employee tied to the analysis log.
    """
    detected_items = detected_items or []

    missing_count = sum(1 for i in detected_items if i.get("audit_status") == "missing")
    misplaced_count = sum(1 for i in detected_items if i.get("audit_status") == "misplaced")
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    sms_summary = (
        f"Shelf scan at {timestamp}. "
        f"Total: {len(detected_items)}, Missing: {missing_count}, Misplaced: {misplaced_count}."
    )
    plain_body, html_body = _build_email(
        detected_items, shelf_analysis_log_id, missing_count, misplaced_count, timestamp,
    )
    subject = f"[MCCS Shelf Detector] {missing_count} missing, {misplaced_count} misplaced"

    employees = get_all_active_employees()

    for user, _emp in employees:
        if user.email:
            try:
                send_email(user.email, subject, plain_body, html=html_body)
            except Exception as e:
                print(f"Email failed for {user.email}: {e}")

        if user.phone and user.carrier:
            try:
                send_sms(user.phone, sms_summary, carrier=user.carrier)
            except Exception as e:
                print(f"SMS failed for {user.email}: {e}")

        db.session.add(Alerts(
            user_id=user.user_id,
            shelf_analysis_log_id=shelf_analysis_log_id,
            alert_type="shelf_detection",
            missing=missing_count,
            misplaced=misplaced_count,
        ))

    db.session.commit()
