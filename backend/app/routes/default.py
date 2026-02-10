from flask import Blueprint

default_blueprint = Blueprint('default', __name__)

@default_blueprint.route('/')
@default_blueprint.route('')
def index():
    return {"message": "Welcome to the User API"}
