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
   - Copy your API key into NUMVERIFY_API_KEY below
"""

import smtplib
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import config

from itsdangerous import URLSafeTimedSerializer, BadSignature

CARRIER_GATEWAYS = {
    "at&t":       "txt.att.net",
    "att":        "txt.att.net",
    "verizon":    "vtext.com",
    "t-mobile":   "tmomail.net",
    "tmobile":    "tmomail.net",
    "sprint":     "messaging.sprintpcs.com",
    "boost":      "sms.myboostmobile.com",
    "cricket":    "sms.cricketwireless.net",
    "metro":      "mymetropcs.com",
    "uscellular": "email.uscc.net",
    "virgin":     "vmobl.com",
    "xfinity":    "vtext.com",
}


_EMAIL_BASE = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {{ margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; }}
    .wrapper {{ max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.08); }}
    .header {{ background: #1e293b; padding: 32px 40px; text-align: center; }}
    .header h1 {{ margin: 0; color: #f8fafc; font-size: 22px; font-weight: 600; letter-spacing: -.3px; }}
    .body {{ padding: 40px; }}
    .body p {{ margin: 0 0 16px; line-height: 1.6; font-size: 15px; color: #374151; }}
    .body p.muted {{ font-size: 13px; color: #9ca3af; }}
    .btn {{ display: inline-block; margin: 8px 0 24px; padding: 14px 32px; background: #2563eb; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; letter-spacing: .2px; }}
    .btn:hover {{ background: #1d4ed8; }}
    .divider {{ border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }}
    .footer {{ padding: 24px 40px; background: #f8fafc; text-align: center; }}
    .footer p {{ margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.6; }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>ShelfMonitor</h1></div>
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



# ── Carrier lookup ────────────────────────────────────────────────────────────

def lookup_carrier(phone_number: str) -> str | None:
    """Look up a phone number's carrier using the free NumVerify API.

    Returns a lowercase carrier name string, or None if lookup fails.
    """
    digits = "".join(filter(str.isdigit, phone_number))
    url = (
        f"http://apilayer.net/api/validate"
        f"?access_key={config.NUMVERIFY_API_KEY}"
        f"&number={digits}"
        f"&country_code=US"
        f"&format=1"
    )
    try:
        response = requests.get(url, timeout=10)
        data = response.json()
        if data.get("valid") and data.get("carrier"):
            carrier_raw = data["carrier"].lower()
            # Match returned carrier name to our gateway keys
            for key in CARRIER_GATEWAYS:
                if key in carrier_raw:
                    return key
            print(f"[Carrier] Detected '{data['carrier']}' but no gateway match found.")
            print(f"          Available gateways: {', '.join(CARRIER_GATEWAYS.keys())}")
            return None
        else:
            print(f"[Carrier] Lookup failed or number invalid: {data}")
            return None
    except Exception as e:
        return {"message": f"Carrier lookup error: {str(e)}"}, 500


# ── Core SMTP helper ──────────────────────────────────────────────────────────
def _send_via_gmail(to_address: str, subject: str, body: str, html: str = None) -> None:
    msg = MIMEMultipart("alternative")
    msg["From"]    = "MCPS Shelf Monitor"
    msg["To"]      = to_address
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))
    if html:
        msg.attach(MIMEText(html, "html"))  # html part last = preferred by email clients

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(config.GMAIL_ADDRESS, config.GMAIL_PASSWORD)
        server.sendmail(config.GMAIL_ADDRESS, to_address, msg.as_string())


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

    gateway_address = f"{digits}@{CARRIER_GATEWAYS[carrier]}"
    _send_via_gmail(gateway_address, subject="", body=message)
    print(f"[SMS] Sent to {phone_number} ({carrier}) ✓")
