# app/routes/google_drive.py
from flask import Blueprint, request, jsonify
from app.services.google_auth_services import GoogleAuthService, GoogleDriveService
from app.models import Tokens, Users
from app.core.config import Config
from werkzeug.utils import secure_filename
import os
import uuid

google_drive_bp = Blueprint('google_drive', __name__)
google_service = GoogleAuthService(Config)


def get_user_from_token():
    """Helper to get user from auth token"""
    token = request.cookies.get('authToken')
    if not token:
        return None
    
    stored_token = Tokens.query.filter_by(token=token).first()
    if not stored_token:
        return None
    
    return stored_token.user_id


@google_drive_bp.route('/files', methods=['GET'])
@google_drive_bp.route('/files/', methods=['GET'])
def list_files():
    """List files in user's Google Drive"""
    user_id = get_user_from_token()
    
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        credentials = google_service.get_credentials(user_id)
        
        if not credentials:
            return jsonify({'error': 'Google Drive not connected'}), 400
        
        drive_service = GoogleDriveService(credentials)
        folder_id = request.args.get('folder_id')
        
        files = drive_service.list_files(folder_id=folder_id)
        
        return jsonify({'files': files})
        
    except Exception as e:
        print(f"Error listing files: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# app/routes/google_drive.py
@google_drive_bp.route('/upload', methods=['POST'])
@google_drive_bp.route('/upload/', methods=['POST'])
def upload_file():
    """Upload one or multiple files to Google Drive"""
    user_id = get_user_from_token()
    
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    
    if 'files' not in request.files:
        return jsonify({'error': 'No files provided'}), 400
    
    files = request.files.getlist('files')  # Get multiple files
    
    if not files or all(f.filename == '' for f in files):
        return jsonify({'error': 'No files selected'}), 400
    
    try:
        credentials = google_service.get_credentials(user_id)
        
        if not credentials:
            return jsonify({'error': 'Google Drive not connected'}), 400
        
        # Get user's folder ID
        user = Users.query.filter_by(id=user_id).first()
        folder_id = user.folder_id
        
        # Upload to Google Drive
        drive_service = GoogleDriveService(credentials)
        
        uploaded_files = []
        errors = []
        
        for file in files:
            if file.filename == '':
                continue
            
            try:
                # Save file temporarily
                filename = secure_filename(file.filename)
                temp_path = f'/tmp/{uuid.uuid4()}_{filename}'  # Unique temp filename
                file.save(temp_path)
                
                # Upload to Google Drive
                uploaded_file = drive_service.upload_file(
                    temp_path,
                    filename,
                    folder_id=folder_id,
                    mime_type=file.content_type
                )
                
                uploaded_files.append({
                    'name': filename,
                    'id': uploaded_file['id'],
                    'size': uploaded_file.get('size'),
                    'mimeType': uploaded_file.get('mimeType')
                })
                
                # Clean up temp file
                os.remove(temp_path)
                
                print(f"✅ Uploaded: {filename}")
                
            except Exception as file_error:
                print(f"❌ Error uploading {file.filename}: {file_error}")
                errors.append({
                    'filename': file.filename,
                    'error': str(file_error)
                })
                
                # Clean up temp file if it exists
                if os.path.exists(temp_path):
                    os.remove(temp_path)
        
        return jsonify({
            'message': f'Uploaded {len(uploaded_files)} file(s) successfully',
            'uploaded': uploaded_files,
            'errors': errors,
            'total': len(files),
            'successful': len(uploaded_files),
            'failed': len(errors)
        })
        
    except Exception as e:
        print(f"Error uploading files: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@google_drive_bp.route('/files/<file_id>/', methods=['DELETE'])
@google_drive_bp.route('/files/<file_id>', methods=['DELETE'])
def delete_file(file_id):
    """Delete a file from Google Drive"""
    user_id = get_user_from_token()
    
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        credentials = google_service.get_credentials(user_id)
        
        if not credentials:
            return jsonify({'error': 'Google Drive not connected'}), 400
        
        drive_service = GoogleDriveService(credentials)
        drive_service.delete_file(file_id)
        
        return jsonify({'message': 'File deleted successfully'})
        
    except Exception as e:
        print(f"Error deleting file: {e}")
        return jsonify({'error': str(e)}), 500