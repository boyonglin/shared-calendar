from google_client.auth import GoogleOAuthManager, Scopes
import json

# Load client secrets
with open('credentials.json', 'r') as f:
    client_secrets = json.load(f)

# Initialize OAuth manager (redirect_uri defaults to localhost:8080)
oauth_manager = GoogleOAuthManager(
    client_secrets_dict=client_secrets
)

# Authenticate using local server - browser opens automatically!
user_info = oauth_manager.authenticate_via_local_server(
    scopes=[Scopes.CALENDAR]
)

# Save credentials
with open('user_token.json', 'w') as f:
    json.dump(user_info, f)