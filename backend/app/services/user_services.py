from app.core.config import config
from app.core.db import db
from app.models import Tokens, Users, Employee
from app.util.send import lookup_carrier, send_email
from datetime import datetime, timedelta
from itsdangerous import URLSafeTimedSerializer, BadSignature
from sqlalchemy.exc import IntegrityError
import uuid


# --- Token helpers ---

def generate_token(user):
    if not user.user_id:
        raise ValueError("User ID is None")

    token_value = uuid.uuid4()
    expires = datetime.utcnow() + timedelta(days=7)

    token = Tokens(
        token_id=token_value,
        user_id=user.user_id,
        expires=expires
    )
    db.session.add(token)
    db.session.commit()
    return str(token_value)


def get_user_by_token(token):
    """Return the User for a valid, non-expired token, or None."""
    stored_token = Tokens.query.filter(
        Tokens.token_id == token,
        Tokens.expires > db.func.now()
    ).first()
    if not stored_token:
        return None
    return Users.query.get(stored_token.user_id)


def delete_token(token):
    Tokens.query.filter_by(token_id=token).delete()
    db.session.commit()


# --- User helpers ---

def check_password(user, password):
    return user.check_password(password)


def get_user_by_email(email):
    return Users.query.filter_by(email=email).first()


def get_user_by_id(user_id):
    return Users.query.get(user_id)


def get_all_users():
    return Users.query.all()


def create_user(first_name, last_name, role, email, password, phone=None, carrier=None):
    """Create and persist a new user. Raises ValueError if email is already taken."""
    if Users.query.filter_by(email=email).first():
        raise ValueError("Email already registered")

    user = Users(
        first_name=first_name,
        last_name=last_name,
        phone=phone,
        carrier=carrier,
        role=role,
        email=email,
    )
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    send_verification_email(user)
    return user


def update_user_role(user_id, new_role):
    """Update a user's role. Raises LookupError if user not found, ValueError if missing phone/carrier."""
    user = Users.query.get(user_id)
    if not user:
        raise LookupError("User not found")

    if new_role in ('associate', 'manager'):
        if not user.phone:
            raise ValueError("User must have a phone number before being assigned an employee role")
        if not user.carrier:
            raise ValueError("User must have a carrier before being assigned an employee role")

    user.role = new_role
    db.session.commit()
    return user


def get_all_employees():
    """Return list of (Users, Employee) tuples for all employees."""
    return (
        db.session.query(Users, Employee)
        .join(Employee, Users.user_id == Employee.user_id)
        .all()
    )


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


def _render_email(content: str) -> str:
    return _EMAIL_BASE.format(content=content)


# --- Email verification ---

def _verification_serializer():
    return URLSafeTimedSerializer(config.SECRET_KEY)


def send_verification_email(user):
    """Send an email verification link to the user."""
    serializer = _verification_serializer()
    token = serializer.dumps({"purpose": "email_verification", "user_id": user.user_id})

    frontend_url = config.FRONTEND_URL
    verify_link = f"{frontend_url.rstrip('/')}/verify-email?token={token}"

    html = _render_email(f"""
      <p>Hi <strong>{user.first_name}</strong>,</p>
      <p>Thanks for signing up! Please verify your email address to activate your account.</p>
      <p><a class="btn" href="{verify_link}">Verify Email Address</a></p>
      <hr class="divider">
      <p>This link expires in <strong>24 hours</strong>.</p>
      <p class="muted">Or copy this link into your browser:<br>{verify_link}</p>
    """)

    send_email(
        to_address=user.email,
        subject="Verify your email address",
        body=f"Hi {user.first_name}, please verify your email: {verify_link} (expires in 24 hours)",
        html=html,
    )


def verify_email_token(token):
    """Validate an email verification token and mark the user as verified.

    Raises SignatureExpired or BadSignature on invalid/expired tokens.
    Raises LookupError if the user no longer exists.
    """
    serializer = _verification_serializer()
    payload = serializer.loads(token, max_age=60 * 60 * 24)  # 24 hours
    if payload.get("purpose") != "email_verification":
        raise BadSignature("Invalid token purpose")

    user = Users.query.get(payload.get("user_id"))
    if not user:
        raise LookupError("User not found")

    user.is_verified = True
    db.session.commit()
    return user


# --- Invitation helpers ---

def _invite_serializer():
    secret_key = config.INVITATION_SECRET_KEY or config.SECRET_KEY or "dev-invitation-secret"
    return URLSafeTimedSerializer(secret_key)


def _load_invitation_payload(token: str):
    serializer = _invite_serializer()
    payload = serializer.loads(token, max_age=60 * 60 * 24 * 7)
    if payload.get("purpose") != "employee_invitation":
        raise BadSignature("Invalid invitation purpose")
    return payload


def send_invitation_email(user, invited_role):
    serializer = _invite_serializer()
    token = serializer.dumps({
        "purpose": "employee_invitation",
        "user_id": user.user_id,
        "role": invited_role
    })

    frontend_url = config.FRONTEND_URL
    invitation_link = f"{frontend_url.rstrip('/')}/continue?token={token}"

    html = _render_email(f"""
      <p>Hi <strong>{user.first_name}</strong>,</p>
      <p>You've been invited to join the team as a <strong>{invited_role.capitalize()}</strong>.</p>
      <p>Click the button below to accept your invitation and set up your account.</p>
      <p><a class="btn" href="{invitation_link}">Accept Invitation</a></p>
      <hr class="divider">
      <p>This link expires in <strong>7 days</strong>.</p>
      <p class="muted">Or copy this link into your browser:<br>{invitation_link}</p>
    """)

    send_email(
        to_address=user.email,
        subject="You're Invited to Join Our Team!",
        body=f"Hi {user.first_name}, you've been invited as a {invited_role}. Accept here: {invitation_link} (expires in 7 days)",
        html=html,
    )
    return invitation_link


def verify_invitation_token(token):
    """Return (user, invited_role). Raises SignatureExpired or BadSignature on invalid token."""
    payload = _load_invitation_payload(token)
    user = Users.query.get(payload.get("user_id"))
    if not user:
        raise LookupError("User not found")
    return user, payload.get("role", "associate")


def complete_invitation(token, phone):
    """Complete an employee invitation. Raises on invalid token or missing user."""
    payload = _load_invitation_payload(token)
    invited_role = payload.get("role", "associate")
    if invited_role not in ("associate", "manager"):
        raise ValueError("Invalid invited role")

    user = Users.query.get(payload.get("user_id"))
    if not user:
        raise LookupError("User not found")

    user.phone = phone
    user.carrier = lookup_carrier(phone)
    user.role = invited_role

    employee = Employee.query.filter_by(user_id=user.user_id).first()
    if employee is None:
        employee = Employee(user_id=user.user_id, status='active')
        db.session.add(employee)
    else:
        employee.status = 'active'

    return user
