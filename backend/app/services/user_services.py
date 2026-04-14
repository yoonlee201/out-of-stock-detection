import logging
import uuid

from app.core.config import config
from app.core.db import db
from app.models import Tokens, Users, Employee
from app.util.send import (
    lookup_carrier,
    send_email,
    render_email,
    verification_serializer,
    invite_serializer,
    load_verification_payload,
    load_invitation_payload,
)
from datetime import datetime, timedelta, timezone
import secrets

EMPLOYEE_ROLES = ('associate', 'supervisor', 'manager')
ALLOWED_ROLES = ('customer', 'associate', 'supervisor', 'manager')
logger = logging.getLogger(__name__)

def _resolve_role(user=None, role=None):
    if role is not None:
        return role
    return getattr(user, 'role', None)


def _needs_account_setup(user):
    return (
        not bool((user.first_name or "").strip())
        and not bool((user.last_name or "").strip())
    )


# --- Token helpers ---

def generate_token(user):
    if not user.user_id:
        raise ValueError("User ID is None")

    token_value = uuid.uuid4()
    expires = datetime.now(timezone.utc) + timedelta(days=7)

    token = Tokens(token_id=token_value, user_id=user.user_id, expires=expires)
    db.session.add(token)
    db.session.commit()
    return str(token_value)


def _coerce_token_uuid(token):
    if isinstance(token, uuid.UUID):
        return token
    if not token:
        return None
    try:
        return uuid.UUID(str(token))
    except (ValueError, TypeError, AttributeError):
        return None


def get_user_by_token(token):
    token_uuid = _coerce_token_uuid(token)
    if token_uuid is None:
        return None

    stored_token = Tokens.query.filter(Tokens.token_id == token_uuid).first()
    if not stored_token:
        return None
    if stored_token.expires <= datetime.now(timezone.utc):
        db.session.delete(stored_token)
        db.session.commit()
        return None
    return Users.query.get(stored_token.user_id)


def delete_token(token):
    token_uuid = _coerce_token_uuid(token)
    if token_uuid is None:
        return
    Tokens.query.filter_by(token_id=token_uuid).delete()
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


def is_email_verified(user):
    return user.is_verified


def role_is_allowed(user=None, role=None):
    return _resolve_role(user=user, role=role) in ALLOWED_ROLES


def role_is_employee(user=None, role=None):
    return _resolve_role(user=user, role=role) in EMPLOYEE_ROLES


def role_is_manager(user=None, role=None):
    return _resolve_role(user=user, role=role) == 'manager'


def create_user(first_name, last_name, role, email, password, phone=None, carrier=None):
    """Create and persist a new user. Raises ValueError if email is already taken."""
    if Users.query.filter_by(email=email).first():
        raise ValueError("Email already registered")
    if phone and Users.query.filter_by(phone=phone).first():
        raise ValueError("Phone number already registered")

    user = Users(
        first_name=first_name,
        last_name=last_name,
        phone=phone,
        carrier=carrier,
        role=role,
        email=email,
    )
    user.set_password(password)
    try:
        db.session.add(user)
        db.session.flush()
        send_verification_email(user)
        db.session.commit()
    except Exception as exc:  # noqa: BLE001
        db.session.rollback()
        logger.warning("User creation or verification email failed for %s: %s", user.email, exc)
        raise RuntimeError(
            "Could not send the verification email. Check the Gmail sender settings and try again."
        ) from exc
    return user


def update_user_role(user_id, new_role):
    """Update a user's role. Raises LookupError if not found, ValueError if missing phone/carrier."""
    user = Users.query.get(user_id)
    if not user:
        raise LookupError("User not found")

    if new_role in EMPLOYEE_ROLES:
        if not user.phone:
            raise ValueError("User must have a phone number before being assigned an employee role")
        else:
            try:
                user.carrier = lookup_carrier(user.phone)
            except Exception as e:
                print(f"Carrier lookup failed: {e}")
                user.carrier = "verizon"

    user.role = new_role
    db.session.commit()
    return user

def update_employee_status(user_id, new_status):
    """Update an employee's status. Raises LookupError if not found, ValueError if user is not an employee."""
    user = Users.query.get(user_id)
    if not user:
        raise LookupError("User not found")

    if user.role not in EMPLOYEE_ROLES:
        raise ValueError("User is not an employee")

    employee = Employee.query.filter_by(user_id=user_id).first()
    if not employee:
        raise LookupError("Employee record not found")

    employee.status = new_status
    db.session.commit()
    return employee

def get_all_employees():
    """Return list of (Users, Employee) tuples for all employees."""
    return (
        db.session.query(Users, Employee)
        .join(Employee, Users.user_id == Employee.user_id)
        .all()
    )


def get_all_active_employees():
    """Return list of (Users, Employee) tuples for active employees."""
    return (
        db.session.query(Users, Employee)
        .join(Employee, Users.user_id == Employee.user_id)
        .filter(Employee.status == 'active')
        .all()
    )


def update_employee(user_id, first_name=None, last_name=None, email=None, phone=None, role=None):
    """Update editable fields on an employee. Raises LookupError if not found."""
    user = Users.query.get(user_id)
    if not user:
        raise LookupError("User not found")

    if first_name is not None:
        user.first_name = first_name
    if last_name is not None:
        user.last_name = last_name
    if email is not None:
        user.email = email
    if phone is not None:
        user.phone = phone
        try:
            user.carrier = lookup_carrier(phone)
        except Exception as e:
            print(f"Carrier lookup failed: {e}")
            user.carrier = "verizon"
    if role is not None:
        if role not in EMPLOYEE_ROLES:
            raise ValueError(f"Invalid role '{role}'")
        user.role = role

    db.session.commit()
    return user


def deactivate_employee(user_id):
    """Deactivate an employee. Raises LookupError if user or employee record not found."""
    user = Users.query.get(user_id)
    if not user:
        raise LookupError("User not found")

    employee = Employee.query.filter_by(user_id=user_id).first()
    if not employee:
        raise LookupError("Employee record not found")

    user.role = 'customer'
    employee.status = 'inactive'
    db.session.commit()


def delete_employee(user_id):
    """Delete both employee and user records."""
    user = Users.query.get(user_id)
    if not user:
        raise LookupError("User not found")

    employee = Employee.query.filter_by(user_id=user_id).first()
    if not employee:
        raise LookupError("Employee record not found")

    db.session.delete(employee)
    db.session.delete(user)
    db.session.commit()


# --- Verification helpers ---

def send_verification_email(user):
    """Send an email verification link to the user."""
    serializer = verification_serializer()
    token = serializer.dumps({"purpose": "email_verification", "user_id": user.user_id})
    verify_link = f"{config.FRONTEND_URL}/verify-email?token={token}"

    html = render_email(f"""
      <p>Hi <strong>{user.first_name}</strong>,</p>
      <p>Thanks for signing up! Please verify your email address to activate your account.</p>
      <p>
        <a
          href="{verify_link}"
          style="display:inline-block;margin:8px 0 24px;padding:14px 32px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;"
        >
          Verify Email Address
        </a>
      </p>
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
    Raises SignatureExpired, BadSignature, or LookupError — caught by the route.
    """
    payload = load_verification_payload(token)

    user = Users.query.get(payload.get("user_id"))
    if not user:
        raise LookupError("User not found")

    user.is_verified = True
    db.session.commit()
    return user


# --- Invitation helpers ---

def prepare_invitation(email, invited_role='associate'):
    """Find or create a pending user+employee for the given email.

    Returns (user, needs_account_setup).
    Raises ValueError if the email belongs to an active employee.
    """
    user = Users.query.filter_by(email=email).first()
    created_new_user = user is None

    # Case 1: no existing user -> create placeholder user, needs setup.
    if created_new_user:
        user = Users(
            first_name="",
            last_name="",
            email=email,
            role=invited_role,
            is_verified=False,
        )
        user.set_password(secrets.token_hex(32))
        db.session.add(user)
        db.session.flush()
    else:
        # Case 2/4: existing user -> keep account, update role for invitation.
        user.role = invited_role

    employee = Employee.query.filter_by(user_id=user.user_id).first()
    if employee is None:
        # Case 2: existing user but no employee -> create pending employee record.
        employee = Employee(user_id=user.user_id, status="pending")
        db.session.add(employee)
    else:
        if employee.status == 'active':
            # Case 3: existing active employee -> reject duplicate invite.
            raise ValueError("User is already an active employee")
        # Case 4: inactive/pending employee -> re-invite by setting pending.
        employee.status = "pending"

    # `is_new` in the token means "needs setup".
    # Real existing accounts skip setup; placeholder invite-only accounts require it.
    needs_account_setup = created_new_user or _needs_account_setup(user)

    db.session.commit()
    return user, needs_account_setup


def send_invitation_email(user, invited_role, is_new=False):
    """Send an invitation email. Returns the invitation link."""
    greeting = "there" if is_new else user.first_name

    serializer = invite_serializer()
    payload = {
        "purpose": "employee_invitation",
        "user_id": user.user_id,
        "role": invited_role,
        "is_new": is_new,
    }

    token = serializer.dumps(payload)
    invitation_link = f"{config.FRONTEND_URL.rstrip('/')}/invitation?token={token}"

    html = render_email(f"""
      <p>Hi <strong>{greeting}</strong>,</p>
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
        body=f"Hi {greeting}, you've been invited as a {invited_role}. Accept here: {invitation_link} (expires in 7 days)",
        html=html,
    )
    return invitation_link


def verify_invitation_token(token):
    payload = load_invitation_payload(token)
    user = Users.query.get(payload.get("user_id"))
    if not user:
        raise LookupError("User not found")
    return user, payload.get("role", "associate"), payload.get("is_new", False)


def complete_invitation(token, phone, first_name=None, last_name=None, password=None):
    payload = load_invitation_payload(token)
    invited_role = payload.get("role", "associate")
    if invited_role not in EMPLOYEE_ROLES:
        raise ValueError("Invalid invited role")

    user = Users.query.get(payload.get("user_id"))
    if not user:
        raise LookupError("User not found")

    if payload.get("is_new", False):
        if not first_name or not last_name:
            raise ValueError("First name and last name are required")
        if not password:
            raise ValueError("Password is required")
        user.first_name = first_name
        user.last_name = last_name
        user.set_password(password)
        user.is_verified = True

    user.phone = phone
    try:
        user.carrier = lookup_carrier(phone)
    except Exception as e:
        print(f"Carrier lookup failed: {e}")
        user.carrier = "verizon"
    user.role = invited_role

    employee = Employee.query.filter_by(user_id=user.user_id).first()
    if employee is None:
        employee = Employee(user_id=user.user_id, status="active")
        db.session.add(employee)
    else:
        employee.status = "active"

    db.session.commit()
    return user
