# app/util/auth.py
from functools import wraps
from flask import request, jsonify
from app.services.user_services import get_user_by_token

EMPLOYEE_ROLES = ('associate', 'manager')


def _get_current_user():
    """Extract and validate the auth token from cookies, return user or None."""
    token = request.cookies.get('authToken')
    if not token:
        return None
    return get_user_by_token(token)

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


def require_active_employee(f):
    """Require a valid session AND an employee role (associate or manager)."""
    @wraps(f)
    def decorated(*args, **kwargs):
        user = _get_current_user()
        if not user:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        if user.role not in EMPLOYEE_ROLES:
            return jsonify({'success': False, 'message': 'Employee access required'}), 403
        if user.employee.status != 'active':
            return jsonify({'success': False, 'message': 'Employee account is not active'}), 403
        return f(*args, session=user, **kwargs)
    return decorated


def require_active_manager(f):
    """Require a valid session AND the manager role."""
    @wraps(f)
    def decorated(*args, **kwargs):
        user = _get_current_user()
        if not user:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        if user.role != 'manager':
            return jsonify({'success': False, 'message': 'Manager access required'}), 403
        if user.employee.status != 'active':
            return jsonify({'success': False, 'message': 'Manager account is not active'}), 403
        return f(*args, session=user, **kwargs)
    return decorated