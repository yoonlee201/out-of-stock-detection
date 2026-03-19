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
        print(f"[Carrier] Lookup error: {e}")
        return None


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
