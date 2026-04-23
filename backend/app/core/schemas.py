"""
Input validation schemas (Marshmallow).

Use validate_request() in route handlers to reject malformed or oversized
payloads before they touch the database layer.
"""

from functools import wraps

from flask import request, jsonify
from marshmallow import Schema, ValidationError, fields, validate

# Shared password rule: 8–128 characters.
_PASSWORD = fields.Str(
    required=True,
    validate=validate.Length(min=8, max=128),
    metadata={"description": "8–128 character password"},
)

_ALLOWED_ROLES = ("customer", "associate", "manager", "supervisor")


class RegisterSchema(Schema):
    first_name = fields.Str(required=True, validate=validate.Length(min=1, max=80))
    last_name  = fields.Str(required=True, validate=validate.Length(min=1, max=80))
    email      = fields.Email(required=True)
    password   = _PASSWORD
    role       = fields.Str(
        load_default="customer",
        validate=validate.OneOf(_ALLOWED_ROLES),
    )
    phone      = fields.Str(
        load_default=None,
        allow_none=True,
        validate=validate.Length(max=20),
    )


class LoginSchema(Schema):
    email    = fields.Email(required=True)
    password = fields.Str(required=True, validate=validate.Length(min=1, max=128))


class UpdateRoleSchema(Schema):
    role = fields.Str(required=True, validate=validate.OneOf(_ALLOWED_ROLES))


class InvitationCompleteSchema(Schema):
    token      = fields.Str(required=True)
    phone      = fields.Str(required=True, validate=validate.Length(max=20))
    first_name = fields.Str(load_default=None, allow_none=True, validate=validate.Length(max=80))
    last_name  = fields.Str(load_default=None, allow_none=True, validate=validate.Length(max=80))
    password   = fields.Str(load_default=None, allow_none=True, validate=validate.Length(min=8, max=128))


def validate_request(schema: Schema):
    """
    Decorator that deserialises and validates the JSON body against `schema`.
    Injects the cleaned data as the first positional argument to the route.
    Returns 400 with field-level error messages on failure.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if request.method == "OPTIONS":
                return fn(None, *args, **kwargs)
            raw = request.get_json(silent=True)
            if raw is None:
                return jsonify({"message": "Request body must be valid JSON"}), 400
            try:
                data = schema.load(raw)
            except ValidationError as exc:
                # Flatten nested error lists into a single readable message.
                messages = {k: v[0] if isinstance(v, list) else v
                            for k, v in exc.messages.items()}
                return jsonify({"message": "Validation error", "errors": messages}), 400
            return fn(data, *args, **kwargs)
        return wrapper
    return decorator
