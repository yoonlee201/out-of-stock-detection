# app/util/auth.py
from functools import wraps
from flask import request, jsonify
from app.services.user_services import get_user_by_token

MANAGEMENT_ROLES = ('supervisor', 'manager')
EMPLOYEE_ROLES = ('associate', 'supervisor', 'manager')
ALLOWED_ROLES = ('customer', 'associate', 'supervisor', 'manager')

def _get_current_user():
    """Extract and validate the auth token from cookies, return user or None."""
    token = request.cookies.get('authToken')
    if not token:
        return None
    return get_user_by_token(token)


def _active_employee_check(user):
    """Return a 403 response if the user has no employee record or is pending, else None."""
    if not user.employee or user.employee.status not in ('active', 'inactive'):
        return jsonify({'success': False, 'message': 'Employee account is not active'}), 403
    return None


# ── Decorators for route protection ─────────────────────────────────────────
def session(f):
    """Require a valid auth session. Injects `current_user` into the route."""
    @wraps(f)
    def decorated(*args, **kwargs):
        user = _get_current_user()
        if not user:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        return f(*args, session=user, **kwargs)
    return decorated

def require_active_supervisor(f):
    """Require a valid session AND supervisor or manager role."""
    @wraps(f)
    def decorated(*args, **kwargs):
        user = _get_current_user()
        if not user:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        if user.role != 'supervisor':
            return jsonify({'success': False, 'message': 'Supervisor access required'}), 403
        err = _active_employee_check(user)
        if err:
            return err
        return f(*args, session=user, **kwargs)
    return decorated


def require_active_supervisor_or_manager(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = _get_current_user()
        if not user:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        if user.role not in MANAGEMENT_ROLES:
            return jsonify({'success': False, 'message': 'Supervisor or manager access required'}), 403
        err = _active_employee_check(user)
        if err:
            return err
        return f(*args, session=user, **kwargs)
    return decorated

def require_active_employee(f):
    """Require a valid session AND any employee role (associate, supervisor, or manager)."""
    @wraps(f)
    def decorated(*args, **kwargs):
        user = _get_current_user()
        if not user:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        if user.role not in EMPLOYEE_ROLES:
            return jsonify({'success': False, 'message': 'Employee access required'}), 403
        err = _active_employee_check(user)
        if err:
            return err
        return f(*args, session=user, **kwargs)
    return decorated
