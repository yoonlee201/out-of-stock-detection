#!/usr/bin/env python3
"""
CLI script to create a user directly in the database.

Usage (run from the backend/ directory):
    python ../scripts/add_user.py
    python ../scripts/add_user.py --first-name Jane --last-name Doe \
        --email jane@example.com --password secret --role manager --phone +15551234567
"""

import argparse
import getpass
import sys
import os

# Allow running from repo root or from backend/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app import create_app
from app.core.db import db
from app.models import Users, Employee
from app.services.user_services import ALLOWED_ROLES, EMPLOYEE_ROLES
from app.util.send import lookup_carrier

ROLE_DESCRIPTIONS = {
    'customer':   'Regular customer account (no store access)',
    'associate':  'Store associate — can view alerts and products',
    'supervisor': 'Supervisor — can manage associates',
    'manager':    'Manager — full access including invitations',
}


def parse_args():
    parser = argparse.ArgumentParser(
        description='Create a new user in the out-of-stock detection system.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='\n'.join(
            f'  {role:<12} {desc}' for role, desc in ROLE_DESCRIPTIONS.items()
        ),
    )
    parser.add_argument('--first-name', help='First name')
    parser.add_argument('--last-name',  help='Last name')
    parser.add_argument('--email',      help='Email address')
    parser.add_argument('--password',   help='Password (prompted if omitted)')
    parser.add_argument(
        '--role',
        choices=ALLOWED_ROLES,
        help='User role (%(choices)s)',
    )
    parser.add_argument('--phone', help='Phone number (required for employee roles)')
    parser.add_argument(
        '--skip-verification',
        action='store_true',
        default=False,
        help='Mark the account as already verified (skips the email check)',
    )
    return parser.parse_args()


def prompt_role() -> str:
    print('\nAvailable roles:')
    roles = list(ALLOWED_ROLES)
    for i, role in enumerate(roles, 1):
        print(f'  [{i}] {role:<12} — {ROLE_DESCRIPTIONS[role]}')
    while True:
        choice = input('\nSelect role [1-%d]: ' % len(roles)).strip()
        if choice.isdigit() and 1 <= int(choice) <= len(roles):
            return roles[int(choice) - 1]
        # Also accept the role name directly
        if choice in ALLOWED_ROLES:
            return choice
        print('  Invalid choice, try again.')


def collect_inputs(args):
    """Interactively fill in any missing fields."""
    first_name = args.first_name or input('First name: ').strip()
    last_name  = args.last_name  or input('Last name:  ').strip()
    email      = args.email      or input('Email:      ').strip()

    if args.password:
        password = args.password
    else:
        while True:
            password = getpass.getpass('Password:   ')
            confirm  = getpass.getpass('Confirm:    ')
            if password == confirm:
                break
            print('  Passwords do not match, try again.')

    role = args.role or prompt_role()

    phone = args.phone
    if role in EMPLOYEE_ROLES and not phone:
        phone = input('Phone (required for %s): ' % role).strip() or None

    if not first_name: sys.exit('Error: first name is required.')
    if not last_name:  sys.exit('Error: last name is required.')
    if not email:      sys.exit('Error: email is required.')
    if not password:   sys.exit('Error: password is required.')

    return first_name, last_name, email, password, role, phone


def main():
    args = parse_args()
    first_name, last_name, email, password, role, phone = collect_inputs(args)

    # Resolve carrier for employee roles
    carrier = None
    if role in EMPLOYEE_ROLES:
        if not phone:
            sys.exit('Error: phone number is required for employee roles.')
        try:
            carrier = lookup_carrier(phone)
            print(f'  Carrier detected: {carrier}')
        except Exception as exc:
            print(f'  Warning: carrier lookup failed ({exc}), defaulting to "verizon".')
            carrier = 'verizon'

    app = create_app()
    with app.app_context():
        # Duplicate-check
        if Users.query.filter_by(email=email).first():
            sys.exit(f'Error: email "{email}" is already registered.')
        if phone and Users.query.filter_by(phone=phone).first():
            sys.exit(f'Error: phone "{phone}" is already registered.')

        user = Users(
            first_name=first_name,
            last_name=last_name,
            email=email,
            role=role,
            phone=phone,
            carrier=carrier,
            is_verified=args.skip_verification,
        )
        user.set_password(password)
        db.session.add(user)
        db.session.flush()  # get user_id before commit

        # Create employee record for employee roles
        if role in EMPLOYEE_ROLES:
            emp = Employee(user_id=user.user_id, status='active')
            db.session.add(emp)

        db.session.commit()

        print('\n  User created successfully!')
        print(f'  ID:       {user.user_id}')
        print(f'  Name:     {user.first_name} {user.last_name}')
        print(f'  Email:    {user.email}')
        print(f'  Role:     {user.role}')
        if user.phone:
            print(f'  Phone:    {user.phone} ({user.carrier})')
        print(f'  Verified: {user.is_verified}')
        if role in EMPLOYEE_ROLES:
            print(f'  Employee status: active')
        if not user.is_verified:
            print('\n  Note: account is unverified. The user must verify their email')
            print('  before logging in, or re-run with --skip-verification.')


if __name__ == '__main__':
    main()
