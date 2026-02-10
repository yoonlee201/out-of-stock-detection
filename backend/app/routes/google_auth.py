# app/routes/google_auth.py
from flask import Blueprint, request, jsonify, redirect, make_response
from app.services.google_auth_services import GoogleAuthService, GoogleDriveService
from app.services.user_services import generate_token
from app.models import Users, GoogleTokens
from app.core.db import db
from app.core.config import Config
import uuid
import traceback

from app.core.config import config

google_auth_bp = Blueprint('google_auth', __name__)
google_service = GoogleAuthService(Config)


@google_auth_bp.route('/login', methods=['GET'])
@google_auth_bp.route('/login/', methods=['GET'])
def google_login():
    """Initiate Google OAuth flow"""
    try:
        authorization_url, state = google_service.get_authorization_url()
        return jsonify({
            'authorization_url': authorization_url,
            'state': state
        })
    except Exception as e:
        print(f"Error in google_login: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@google_auth_bp.route('/callback', methods=['GET'])
@google_auth_bp.route('/callback/', methods=['GET'])
def google_callback():
    """Handle Google OAuth callback"""
    print("\n" + "="*50)
    print("GOOGLE CALLBACK TRIGGERED")
    print("="*50)
    
    code = request.args.get('code')
    error = request.args.get('error')
    
    print(f"Code received: {code[:20] if code else 'None'}...")
    print(f"Error received: {error}")
    
    # Handle user denial
    if error:
        print(f"❌ User denied access: {error}")
        return redirect(f'{config.FRONTEND_URL}/login?error={error}')
    
    if not code:
        print("❌ No authorization code received")
        return redirect(f'{config.FRONTEND_URL}/login?error=no_code')
    
    try:
        print("\n🔹 Step 1: Exchanging code for tokens...")
        token_data = google_service.exchange_code_for_tokens(code)
        print(f"✅ Tokens received")
        print(f"   Access token: {token_data['access_token'][:20]}...")
        print(f"   Refresh token exists: {bool(token_data.get('refresh_token'))}")
        
        print("\n🔹 Step 2: Getting user info...")
        user_info = google_service.get_user_info(token_data['access_token'])
        user = Users.query.filter_by(email=user_info['email']).first()
        
        is_new_user = False
        if not user:
            print(f"   Creating new user for {user_info['email']}")
            is_new_user = True
            user = Users(
                id=uuid.uuid4(),
                email=user_info['email'],
                name=user_info.get('name', user_info['email'].split('@')[0]),
                google_id=user_info['id']
            )
            db.session.add(user)
            db.session.commit()
            print(f"   ✅ New user created: {user.id}")
        else:
            print(f"   ✅ Existing user found: {user.email}")
            if not user.google_id:
                user.google_id = user_info['id']
                db.session.commit()
                print(f"   ✅ Google ID updated")
        
        print("\n🔹 Step 4: Saving Google tokens...")
        google_service.save_tokens(user.id, token_data)
        print(f"   ✅ Google tokens saved")
        
        # Step 4.5: Create Google Drive folder for new users
        if is_new_user:
            print("\n🔹 Step 4.5: Creating Google Drive folder...")
            try:
                # Get credentials that were just saved
                credentials = google_service.get_credentials(user.id)
                
                if credentials:
                    drive_service = GoogleDriveService(credentials)
                    
                    # Create folder with user's name or email
                    folder_name = "oos-detection"
                    folder = drive_service.get_or_create_folder(folder_name)
                    
                    print(f"   ✅ Folder created: {folder['name']}")
                    print(f"   Folder ID: {folder['id']}")
                    
                    # Save folder ID to user
                    user.folder_id = folder['id']
                    db.session.commit()
                    print(f"   ✅ Folder ID saved to user")
                else:
                    print(f"   ⚠️  Could not get credentials to create folder")
            except Exception as folder_error:
                print(f"   ⚠️  Error creating folder: {folder_error}")
                # Don't fail the whole auth flow if folder creation fails
                traceback.print_exc()
            
        print("\n🔹 Step 5: Generating app auth token...")
        auth_token = generate_token(user)
        print(f"   ✅ Auth token: {auth_token[:20]}...")
        
        print("\n🔹 Step 6: Setting cookie and redirecting...")
        response = make_response(redirect(f'{config.FRONTEND_URL}/auth/callback?success=true'))
        response.set_cookie(
            'authToken',
            auth_token,
            httponly=True,
            secure=True,  # ✅ Change to True for production (Render uses HTTPS)
            samesite='None',  # ✅ Change to 'None' for cross-domain cookies
            max_age=7*24*60*60,
            path='/'
        )
        
        print("✅ SUCCESS - Redirecting to frontend")
        print("="*50 + "\n")
        
        return response
        
    except Exception as e:
        print("\n" + "="*50)
        print("❌ AUTHENTICATION FAILED")
        print("="*50)
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        print("\nFull traceback:")
        traceback.print_exc()
        print("="*50 + "\n")
        
        return redirect(f'{config.FRONTEND_URL}/login?error=auth_failed')


@google_auth_bp.route('/status', methods=['GET'])
@google_auth_bp.route('/status/', methods=['GET'])
def google_status():
    """Check if user has connected Google Drive"""
    token = request.cookies.get('authToken')
    
    if not token:
        return jsonify({'connected': False}), 200
    
    from app.models import Tokens
    stored_token = Tokens.query.filter_by(token=token).first()
    
    if not stored_token:
        return jsonify({'connected': False}), 200
    
    google_token = GoogleTokens.query.filter_by(user_id=stored_token.user_id).first()
    
    return jsonify({
        'connected': google_token is not None,
        'email': stored_token.user.email if google_token else None
    })


@google_auth_bp.route('/disconnect', methods=['POST'])
@google_auth_bp.route('/disconnect/', methods=['POST'])
def google_disconnect():
    """Disconnect Google Drive"""
    token = request.cookies.get('authToken')
    
    if not token:
        return jsonify({'error': 'Unauthorized'}), 401
    
    from app.models import Tokens
    stored_token = Tokens.query.filter_by(token=token).first()
    
    if not stored_token:
        return jsonify({'error': 'Unauthorized'}), 401
    
    GoogleTokens.query.filter_by(user_id=stored_token.user_id).delete()
    db.session.commit()
    
    return jsonify({'message': 'Google Drive disconnected successfully'})