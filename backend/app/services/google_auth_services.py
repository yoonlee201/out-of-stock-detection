# app/services/google_auth_services.py
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload
from app.models import GoogleTokens, Users
from app.core.db import db
from datetime import datetime, timedelta
import uuid
import os
import io

class GoogleAuthService:
    def __init__(self, config):
        self.client_id = config.GOOGLE_CLIENT_ID
        self.client_secret = config.GOOGLE_CLIENT_SECRET
        self.redirect_uri = config.GOOGLE_REDIRECT_URI
        self.scopes = config.GOOGLE_SCOPES
    
    def get_authorization_url(self):
        """Generate Google OAuth authorization URL"""
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [self.redirect_uri],
                }
            },
            scopes=self.scopes,
            redirect_uri=self.redirect_uri
        )
        
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'
        )
        
        return authorization_url, state
    
    def exchange_code_for_tokens(self, code):
        """Exchange authorization code for access and refresh tokens"""
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [self.redirect_uri],
                }
            },
            scopes=self.scopes,
            redirect_uri=self.redirect_uri
        )
        
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        # Calculate expiry time (use naive datetime)
        expires_at = datetime.utcnow() + timedelta(seconds=3600)
        
        return {
            'access_token': credentials.token,
            'refresh_token': credentials.refresh_token,
            'token_type': 'Bearer',
            'expires_at': expires_at
        }
    
    def get_user_info(self, access_token):
        """Get user info from Google"""
        credentials = Credentials(token=access_token)
        service = build('oauth2', 'v2', credentials=credentials)
        user_info = service.userinfo().get().execute()
        return user_info
    
    def save_tokens(self, user_id, token_data):
        """Save Google tokens to database"""
        # Delete existing tokens for this user
        GoogleTokens.query.filter_by(user_id=user_id).delete()
        
        # Create new token entry
        google_token = GoogleTokens(
            id=uuid.uuid4(),
            user_id=user_id,
            access_token=token_data['access_token'],
            refresh_token=token_data.get('refresh_token'),
            token_type=token_data['token_type'],
            expires_at=token_data['expires_at']
        )
        
        db.session.add(google_token)
        db.session.commit()
        
        return google_token
    
    def get_credentials(self, user_id):
        """Get Google credentials for a user"""
        google_token = GoogleTokens.query.filter_by(user_id=user_id).first()
        
        if not google_token:
            return None
        
        # Convert to naive if timezone-aware (handle both cases)
        token_expires = google_token.expires_at
        if token_expires.tzinfo is not None:
            token_expires = token_expires.replace(tzinfo=None)
        
        # Check if token is expired (now comparing naive datetimes)
        if token_expires < datetime.utcnow():
            # Refresh token
            if google_token.refresh_token:
                try:
                    credentials = Credentials(
                        token=google_token.access_token,
                        refresh_token=google_token.refresh_token,
                        token_uri="https://oauth2.googleapis.com/token",
                        client_id=self.client_id,
                        client_secret=self.client_secret
                    )
                    
                    # Refresh
                    from google.auth.transport.requests import Request
                    credentials.refresh(Request())
                    
                    # Update tokens (save as naive datetime)
                    google_token.access_token = credentials.token
                    google_token.expires_at = datetime.utcnow() + timedelta(seconds=3600)
                    db.session.commit()
                    
                    return credentials
                except Exception as e:
                    print(f"Error refreshing token: {e}")
                    return None
            else:
                return None
        
        return Credentials(token=google_token.access_token)


class GoogleDriveService:
    def __init__(self, credentials):
        self.service = build('drive', 'v3', credentials=credentials)
    
    def upload_file(self, file_path, file_name, folder_id=None, mime_type=None):
        """Upload a file to Google Drive"""
        file_metadata = {'name': file_name}
        
        if folder_id:
            file_metadata['parents'] = [folder_id]
        
        media = MediaFileUpload(file_path, mimetype=mime_type, resumable=True)
        
        file = self.service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id, name, mimeType, size, createdTime, webViewLink, webContentLink'
        ).execute()
        
        return file
    
    def list_files(self, folder_id=None, page_size=100):
        """List files in Google Drive"""
        query = f"'{folder_id}' in parents" if folder_id else None
        
        results = self.service.files().list(
            q=query,
            pageSize=page_size,
            fields="files(id, name, mimeType, size, createdTime, modifiedTime)"
        ).execute()
        
        return results.get('files', [])
    
    def download_file(self, file_id, destination_path):
        """Download a file from Google Drive to a local path"""
        request = self.service.files().get_media(fileId=file_id)
        
        with open(destination_path, 'wb') as f:
            downloader = MediaIoBaseDownload(f, request)
            done = False
            while not done:
                status, done = downloader.next_chunk()
                print(f"Download progress: {int(status.progress() * 100)}%")
        
        return destination_path
    
    def download_file_to_temp(self, file_id, filename=None):
        """
        Download a file from Google Drive to a temporary location
        
        Args:
            file_id: Google Drive file ID
            filename: Optional filename to use (will get from Drive if not provided)
            
        Returns:
            Path to the temporary file
        """
        import tempfile
        
        # Get filename from Google Drive if not provided
        if not filename:
            file_info = self.get_file_metadata(file_id)
            filename = file_info['name']
        
        # Create temp file with proper extension
        temp_dir = tempfile.gettempdir()
        temp_path = os.path.join(temp_dir, filename)
        
        # Download to temp location
        self.download_file(file_id, temp_path)
        
        print(f"✅ Downloaded to temp: {temp_path}")
        return temp_path
    
    def delete_file(self, file_id):
        """Delete a file from Google Drive"""
        self.service.files().delete(fileId=file_id).execute()
        return True
    
    def get_file_metadata(self, file_id):
        """Get file metadata"""
        file = self.service.files().get(
            fileId=file_id,
            fields='id, name, mimeType, size, createdTime, modifiedTime, parents'
        ).execute()
        
        return file
    def find_folder_by_name(self, folder_name, parent_id=None):
        """
        Find folder(s) by name in Google Drive
        
        Args:
            folder_name: Name of the folder to search for
            parent_id: Optional parent folder ID to search within
            
        Returns:
            List of matching folders with their metadata
        """
        try:
            # Build query
            query = f"mimeType='application/vnd.google-apps.folder' and name='{folder_name}' and trashed=false"
            
            # If parent_id is provided, search only in that folder
            if parent_id:
                query += f" and '{parent_id}' in parents"
            
            # Execute search
            results = self.service.files().list(
                q=query,
                spaces='drive',
                fields='files(id, name, parents, createdTime, modifiedTime, webViewLink)',
                pageSize=100
            ).execute()
            
            folders = results.get('files', [])
            
            print(f"Found {len(folders)} folder(s) with name '{folder_name}'")
            for folder in folders:
                print(f"  - {folder['name']} (ID: {folder['id']})")
            
            return folders
            
        except Exception as e:
            print(f"Error finding folder: {e}")
            raise
    
    def find_folder_by_name_single(self, folder_name, parent_id=None):
        """
        Find a single folder by name (returns first match)
        
        Returns:
            Folder metadata dict or None if not found
        """
        folders = self.find_folder_by_name(folder_name, parent_id)
        return folders[0] if folders else None
    
    def get_or_create_folder(self, folder_name, parent_id=None):
        """
        Get folder by name, or create it if it doesn't exist
        
        Returns:
            Folder metadata dict
        """
        # Try to find existing folder
        existing_folder = self.find_folder_by_name_single(folder_name, parent_id)
        
        if existing_folder:
            print(f"Found existing folder: {existing_folder['name']} ({existing_folder['id']})")
            return existing_folder
        
        # Create new folder if not found
        print(f"Folder not found, creating new folder: {folder_name}")
        return self.create_folder(folder_name, parent_id)
    
    def rename_file(self, file_id, new_name):
        try:
            file_metadata = {'name': new_name}
            
            updated_file = self.service.files().update(
                fileId=file_id,
                body=file_metadata,
                fields='id, name, mimeType, modifiedTime, webViewLink, webContentLink'
            ).execute()
            
            print(f"✅ File renamed: {updated_file['name']} (ID: {file_id})")
            return updated_file
            
        except Exception as e:
            print(f"❌ Error renaming file: {e}")
            raise
        
    def find_file_by_name(self, filename, parent_id=None):
        """
        Find file(s) by name in Google Drive
        
        Args:
            filename: Name of the file to search for
            parent_id: Optional parent folder ID to search within
            
        Returns:
            List of matching files with their metadata including file_id
        """
        try:
            # Build query with EXACT name match
            # The '=' operator in Drive API does exact matching, not partial
            query = f"name = '{filename}' and trashed = false"
            
            # If parent_id is provided, search only in that folder
            if parent_id:
                query += f" and '{parent_id}' in parents"
            
            results = self.service.files().list(
                q=query,
                spaces='drive',
                fields='files(id, name)',
                pageSize=10  # Get up to 10 results to check for exact matches
            ).execute()
            
            files = results.get('files', [])
            
            # Double-check for EXACT match (case-sensitive)
            exact_matches = [f for f in files if f['name'] == filename]
            
            exists = len(exact_matches) > 0
            
            if exists:
                print(f"❌ File '{filename}' exists (ID: {exact_matches[0]['id']})")
                return True
            else:
                print(f"✅ File '{filename}' not found")
                return False
            
        except Exception as e:
            print(f"❌ Error checking file existence: {e}")
            import traceback
            traceback.print_exc()
            return False