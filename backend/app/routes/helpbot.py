"""
Help-bot chat endpoint.

POST /helpbot/chat
    Body:  { "message": "..." }
    Returns: { "answer": "..." }

No external API needed — keyword scoring against a built-in FAQ knowledge base
with optional live DB stats for dynamic inventory questions.
"""

from flask import Blueprint, request, jsonify

from app.core.db import db
from app.models import Products, ProductLocations

helpbot_blueprint = Blueprint("helpbot", __name__)

# ---------------------------------------------------------------------------
# FAQ knowledge base
# ---------------------------------------------------------------------------
_FAQ: list[dict] = [
    {
        "keywords": [
            "upload", "image", "photo", "picture", "shelf image",
            "how to upload", "where upload", "submit", "scan", "new scan", "add image",
        ],
        "answer": (
            "To upload a shelf image, go to the **Dashboard** and click the **+** button "
            "in the top right corner. You can drag and drop images or click to browse your files. "
            "Supported formats are JPG, PNG, and WEBP.\n\n"
            "The system will analyze the image against the planogram and return results "
            "within a few seconds. You can track scan progress in the active jobs panel."
        ),
    },
    {
        "keywords": [
            "result", "tell me", "what does it", "analysis", "show", "output",
            "detect", "detection", "what does the system", "what will it",
        ],
        "answer": (
            "After uploading a shelf image the system returns:\n"
            "• **Missing** – products that should be on the shelf but weren't detected\n"
            "• **Misplaced** – products detected in the wrong shelf position\n"
            "• **On Shelf** – products correctly placed per the planogram\n"
            "• **Compliance Score** – a percentage showing how closely the shelf matches the planogram\n\n"
            "Click any entry in the scan history panel to see the full per-slot breakdown."
        ),
    },
    {
        "keywords": ["compliance", "score", "percentage", "compliance score"],
        "answer": (
            "The **Compliance Score** is a percentage (0–100%) measuring how closely a scanned "
            "shelf matches the expected planogram layout. 100% means every product is in the "
            "correct position. Scores below roughly 80% typically trigger alerts for managers."
        ),
    },
    {
        "keywords": [
            "missing", "not on shelf", "empty", "gap", "absent", "out of stock",
        ],
        "answer": (
            "A product is marked **Missing** when the shelf scan detects a gap where that product "
            "should be according to the planogram. This usually means the product sold out or "
            "was never restocked. Missing items are highlighted in red on the dashboard and "
            "automatically trigger restock alerts."
        ),
    },
    {
        "keywords": [
            "misplaced", "wrong position", "wrong spot", "wrong location",
            "wrong place", "incorrect position",
        ],
        "answer": (
            "A product is **Misplaced** when it's detected on the shelf but in the wrong slot "
            "relative to the planogram — it was stocked in the wrong position. "
            "Misplaced items appear in amber/yellow and should be corrected by an associate."
        ),
    },
    {
        "keywords": [
            "planogram", "plan", "layout", "expected layout", "shelf plan",
        ],
        "answer": (
            "The **planogram** is the master shelf layout — it defines exactly which product goes "
            "in which slot. Every scan is compared against the planogram to determine what's "
            "missing or misplaced.\n\n"
            "The current planogram covers the **cereal aisle** with 4 rows and 43 slot positions "
            "across brands like General Mills, Kellogg's, Quaker, and Great Value."
        ),
    },
    {
        "keywords": [
            "alert", "notification", "notify", "restock alert", "shelf alert",
            "get notified", "alerts page",
        ],
        "answer": (
            "There are two types of alerts:\n"
            "• **Restock alerts** – triggered when a product's quantity drops below 50% of its "
            "planogram capacity (low stock) or below 10% (out of stock)\n"
            "• **Shelf detection alerts** – triggered after a scan finds missing or misplaced products\n\n"
            "Alerts go to managers and supervisors. View all alerts on the **Notifications** page."
        ),
    },
    {
        "keywords": [
            "inventory", "stock", "quantity", "how much", "count", "inventory page",
        ],
        "answer": (
            "The **Inventory** page shows all products with their current stock levels. Each row shows:\n"
            "• Current quantity vs. planogram baseline capacity\n"
            "• Stock status: In Stock, Low Stock, or Out of Stock\n"
            "• Shelf and aisle location\n"
            "• Last scan time and shelf status\n\n"
            "You can filter by status and search by product name. Managers can also trigger reorders from here."
        ),
    },
    {
        "keywords": [
            "reorder", "order more", "replenish", "restock", "re-order", "order quantity",
        ],
        "answer": (
            "To create a reorder, go to the **Inventory** page, find the product, and use the reorder option. "
            "You can specify how many units to order. Reorders are logged and visible to managers. "
            "The system also flags products automatically when they fall below stock thresholds."
        ),
    },
    {
        "keywords": [
            "employee", "staff", "worker", "associate", "manager", "supervisor",
            "user", "role", "roles", "permissions", "access",
        ],
        "answer": (
            "There are four user roles:\n"
            "• **Supervisor** – full access including user management\n"
            "• **Manager** – view all data, manage inventory, receive all alerts\n"
            "• **Associate** – upload scans and view inventory\n"
            "• **Customer** – limited read-only view of product availability\n\n"
            "Roles are set when users are created and can be updated in the **Manager** page."
        ),
    },
    {
        "keywords": [
            "dashboard", "home", "main page", "overview", "what is the dashboard",
        ],
        "answer": (
            "The **Dashboard** is the main page. It shows:\n"
            "• Active scan jobs currently processing\n"
            "• Scan history with compliance scores and missing/misplaced counts\n"
            "• A quick overview of recent shelf health\n\n"
            "Click any history entry to expand the full detection results for that scan."
        ),
    },
    {
        "keywords": [
            "demo", "demo mode", "test mode", "example", "sample", "try it",
        ],
        "answer": (
            "The **Demo** page lets you test the shelf analyzer with pre-loaded sample images "
            "without needing to upload your own photos. It's a great way to see how detection "
            "and planogram matching works before running a real scan."
        ),
    },
    {
        "keywords": [
            "login", "sign in", "password", "account", "locked out", "credentials",
        ],
        "answer": (
            "Log in with your registered email and password on the login page. "
            "Test accounts use password **12345678**. "
            "If you're locked out, contact your supervisor or manager — they can reset your account "
            "from the Manager page."
        ),
    },
    {
        "keywords": [
            "shelf status", "status mean", "status label", "on_shelf", "unknown status",
            "what does status", "status definitions",
        ],
        "answer": (
            "Shelf status labels:\n"
            "• **On Shelf** – product detected in the correct position\n"
            "• **Missing** – product absent from its expected slot\n"
            "• **Misplaced** – product on the shelf but in the wrong slot\n"
            "• **Low Stock** – quantity below 50% of planogram capacity\n"
            "• **Out of Stock** – quantity below 10% of planogram capacity\n"
            "• **Unknown** – slot has not been scanned yet"
        ),
    },
    {
        "keywords": [
            "how does it work", "how does the system", "how does detection",
            "ai", "model", "yolo", "machine learning", "computer vision",
        ],
        "answer": (
            "The system uses a **YOLO object detection model** trained on retail shelf imagery "
            "to locate products in uploaded photos. Each detection is mapped to a planogram slot "
            "using position matching — products not in the right slot get flagged as missing or misplaced.\n\n"
            "The model runs entirely in the backend container, so no external API calls are made during detection."
        ),
    },
    {
        "keywords": [
            "aisle", "cereal", "where is", "find product", "product location",
            "which aisle", "which shelf",
        ],
        "answer": (
            "Products are organized by **aisle** and **shelf row**. The current planogram covers "
            "the cereal aisle (aisle 5) with 4 shelf rows and products from General Mills, "
            "Kellogg's, Quaker, and Great Value.\n\n"
            "Find any product's location on the **Inventory** page — each item shows "
            "its aisle, shelf row, and planogram slot positions."
        ),
    },
    {
        "keywords": [
            "history", "past scans", "previous scans", "scan log", "scan history",
        ],
        "answer": (
            "Scan history is on the **Dashboard** in the history panel. "
            "Each entry shows the file name, timestamp, compliance score, and counts of "
            "missing and misplaced items. Click any entry to expand the full per-product results."
        ),
    },
]


def _score(message: str, keywords: list) -> int:
    msg_lower = message.lower()
    return sum(1 for kw in keywords if kw.lower() in msg_lower)


def _get_live_stats():
    try:
        total = Products.query.count()
        missing = ProductLocations.query.filter_by(shelf_status="missing").count()
        misplaced = ProductLocations.query.filter_by(shelf_status="misplaced").count()
        out_of_stock = Products.query.filter_by(shelf_status="out_of_stock").count()
        low_stock = Products.query.filter_by(shelf_status="low_stock").count()
        unknown = ProductLocations.query.filter_by(shelf_status="unknown").count()
        return {
            "total": total,
            "missing": missing,
            "misplaced": misplaced,
            "out_of_stock": out_of_stock,
            "low_stock": low_stock,
            "unknown": unknown,
        }
    except Exception:
        return None


@helpbot_blueprint.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()

    if not message:
        return jsonify({"answer": "Go ahead — type a question and I'll do my best to help!"}), 200

    msg_lower = message.lower()

    # Live data intent: "how many missing right now?" etc.
    live_triggers = {"how many", "current", "right now", "currently", "today", "latest", "live"}
    stock_triggers = {"missing", "misplaced", "out of stock", "low stock", "products", "inventory", "status"}
    is_live = any(t in msg_lower for t in live_triggers) and any(t in msg_lower for t in stock_triggers)

    if is_live:
        stats = _get_live_stats()
        if stats:
            return jsonify({
                "answer": (
                    "Here's the current inventory snapshot:\n"
                    f"• **Total products**: {stats['total']}\n"
                    f"• **Missing from shelf**: {stats['missing']} slot(s)\n"
                    f"• **Misplaced**: {stats['misplaced']} slot(s)\n"
                    f"• **Out of stock**: {stats['out_of_stock']} product(s)\n"
                    f"• **Low stock**: {stats['low_stock']} product(s)\n"
                    f"• **Not yet scanned**: {stats['unknown']} slot(s)\n\n"
                    "Head to the **Dashboard** to run a new scan, or **Inventory** for full detail."
                )
            }), 200

    # FAQ keyword scoring
    best_score = 0
    best_answer = None
    for faq in _FAQ:
        score = _score(message, faq["keywords"])
        if score > best_score:
            best_score = score
            best_answer = faq["answer"]

    if best_score >= 1 and best_answer:
        return jsonify({"answer": best_answer}), 200

    # Fallback
    return jsonify({
        "answer": (
            "I'm not sure about that one. Here are some things I can help with:\n"
            "• How to upload shelf images\n"
            "• What detection results mean (missing, misplaced, compliance score)\n"
            "• How alerts and reorders work\n"
            "• User roles and permissions\n"
            "• Current inventory status\n\n"
            "Try asking something like *\"how do I upload an image?\"* or *\"what does misplaced mean?\"*"
        )
    }), 200
