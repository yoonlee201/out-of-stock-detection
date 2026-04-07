"""
send_messages.py
----------------
Send emails and SMS (via email-to-SMS gateway) using Gmail SMTP.
Carrier is detected automatically using the free NumVerify API.
No paid services required!

SETUP:
1. Install dependencies:
       pip install requests

2. Gmail — App Password:
   - Go to https://myaccount.google.com/apppasswords
   - Generate a password for "Mail"
   - Paste the 16-char password into GMAIL_PASSWORD below

3. NumVerify free API key (250 free lookups/month):
   - Sign up at https://numverify.com (free plan, no credit card)
   - Copy your API key into IPQS_API_KEY below
"""

import smtplib
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import config

from itsdangerous import URLSafeTimedSerializer, BadSignature

CARRIER_GATEWAYS = {
    # AT&T
    "at&t":                     "txt.att.net",
    "att":                      "txt.att.net",
    "at&t mobility":            "txt.att.net",
    "at&t wireless":            "txt.att.net",
    # Verizon
    "verizon":                  "vtext.com",
    "verizon wireless":         "vtext.com",
    # T-Mobile
    "t-mobile":                 "tmomail.net",
    "tmobile":                  "tmomail.net",
    "t-mobile usa":             "tmomail.net",
    "t-mobile usa, inc.":       "tmomail.net",
    # Sprint (now T-Mobile)
    "sprint":                   "messaging.sprintpcs.com",
    "sprint pcs":               "messaging.sprintpcs.com",
    # Boost
    "boost":                    "sms.myboostmobile.com",
    "boost mobile":             "sms.myboostmobile.com",
    # Cricket
    "cricket":                  "sms.cricketwireless.net",
    "cricket wireless":         "sms.cricketwireless.net",
    # Metro (T-Mobile)
    "metro":                    "mymetropcs.com",
    "metropcs":                 "mymetropcs.com",
    "metro by t-mobile":        "mymetropcs.com",
    # US Cellular
    "uscellular":               "email.uscc.net",
    "us cellular":              "email.uscc.net",
    "united states cellular":   "email.uscc.net",
    # Virgin
    "virgin":                   "vmobl.com",
    "virgin mobile":            "vmobl.com",
    # Xfinity / Comcast
    "xfinity":                  "vtext.com",
    "xfinity mobile":           "vtext.com",
    "comcast":                  "vtext.com",
    # Visible (Verizon MVNO)
    "visible":                  "vtext.com",
    # Google Fi
    "google fi":                "msg.fi.google.com",
    "google":                   "msg.fi.google.com",
    # Mint Mobile (T-Mobile MVNO)
    "mint mobile":              "mailmymobile.net",
    "mint":                     "mailmymobile.net",
    # Consumer Cellular
    "consumer cellular":        "mailmymobile.net",
}


def get_gateway(carrier_str: str) -> str | None:
    """Look up SMS gateway from a carrier string, tolerating messy IPQS values."""
    return CARRIER_GATEWAYS.get(carrier_str.lower().strip())


_EMAIL_BASE = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body {{ margin: 0; padding: 0; background: #f4f4f5; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; color: #111827; -webkit-font-smoothing: antialiased; }}
    .wrapper {{ max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.06); }}
    .header {{ background: #1c1c20; padding: 28px 40px; display: flex; align-items: center; gap: 10px; }}
    .header-dot {{ width: 8px; height: 8px; border-radius: 50%; background: #7a131b; flex-shrink: 0; }}
    .header h1 {{ margin: 0; color: #f8fafc; font-size: 18px; font-weight: 600; letter-spacing: -.2px; }}
    .body {{ padding: 40px; }}
    .body p {{ margin: 0 0 16px; line-height: 1.6; font-size: 15px; color: #374151; }}
    .body p.muted {{ font-size: 13px; color: #9ca3af; }}
    .btn {{ display: inline-block; margin: 8px 0 24px; padding: 13px 28px; background: #1c1c20; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600; letter-spacing: .1px; }}
    .divider {{ border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }}
    .footer {{ padding: 20px 40px; background: #f9f9f9; border-top: 1px solid #e5e7eb; text-align: center; }}
    .footer p {{ margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.6; }}
    .accent {{ color: #7a131b; font-weight: 600; }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="header-dot"></div>
      <h1>ShelfMonitor</h1>
    </div>
    <div class="body">
      {content}
    </div>
    <div class="footer">
      <p>ShelfMonitor &mdash; You received this email because an account action was initiated.<br>If this wasn't you, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>
"""

def render_email(content: str) -> str:
    return _EMAIL_BASE.format(content=content)


# --- Email verification ---
def verification_serializer():
    return URLSafeTimedSerializer(config.SECRET_KEY)

def invite_serializer():
    secret_key = config.INVITATION_SECRET_KEY
    return URLSafeTimedSerializer(secret_key)

def load_invitation_payload(token: str):
    serializer = invite_serializer()
    payload = serializer.loads(token, max_age=60 * 60 * 24 * 7)
    if payload.get("purpose") != "employee_invitation":
        raise BadSignature("Invalid invitation purpose")
    return payload

def load_verification_payload(token: str):
    serializer = verification_serializer()
    payload = serializer.loads(token, max_age=60 * 60 * 24)
    if payload.get("purpose") != "email_verification":
        raise BadSignature("Invalid token purpose")
    return payload


# ── Core SMTP helper ──────────────────────────────────────────────────────────
def _send_via_gmail(to_address: str, subject: str, body: str, html: str = None) -> None:
    msg = MIMEMultipart("alternative")
    msg["From"]    = config.GMAIL_ADDRESS
    msg["To"]      = to_address
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))
    if html:
        msg.attach(MIMEText(html, "html"))  # html part last = preferred by email clients

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(config.GMAIL_ADDRESS, config.GMAIL_PASSWORD)
        server.sendmail("MCPS Shelf Monitor", to_address, msg.as_string())


# ── Email ─────────────────────────────────────────────────────────────────────
def send_email(to_address: str, subject: str, body: str, html: str = None) -> None:
    _send_via_gmail(to_address, subject, body, html=html)
    print(f"[Email] Sent to {to_address}")


# ── SMS ───────────────────────────────────────────────────────────────────────
def send_sms(phone_number: str, message: str, carrier: str = None) -> None:
    """Send an SMS via email-to-SMS gateway.

    Carrier is auto-detected if not provided.

    Args:
        phone_number:  10-digit US number, e.g. '5551234567'
        message:       Text to send (keep under 160 chars per segment)
        carrier:       Optional. If omitted, carrier is looked up automatically.

    Examples:
        send_sms("5551234567", "Hello!")                      # auto-detect carrier
        send_sms("5551234567", "Hello!", carrier="verizon")   # manual override
    """
    digits = "".join(filter(str.isdigit, phone_number))
    if len(digits) != 10:
        print(f"[SMS] Phone number must be 10 digits (got {len(digits)})")
        return

    if carrier is None:
        return
    
    carrier = carrier.lower().strip()
    if carrier not in CARRIER_GATEWAYS:
        print(f"[SMS] Unknown carrier '{carrier}'. Available: {', '.join(CARRIER_GATEWAYS)}")
        return

    import uuid
    gateway_address = f"{digits}@{get_gateway(carrier)}"
    _send_via_gmail(gateway_address, subject=str(uuid.uuid4()), body=message)
    print(f"[SMS] Sent to {phone_number} ({carrier}) ✓")

def lookup_carrier(phone_number: str) -> str:
    from app.util.IPQS import get_user_carrier
    return get_user_carrier(phone_number)
