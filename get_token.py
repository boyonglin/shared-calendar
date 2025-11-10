"""
get_token.py

Helper to run the OAuth 2.0 InstalledAppFlow and save credentials to `token.json`.

Usage:
  1. Create an OAuth 2.0 Client ID in Google Cloud Console (Application type: Desktop app)
  2. Download the JSON and save it as `credentials.json` in the same folder as this script
  3. Run: python get_token.py
  4. A browser will open and after consenting a `token.json` file will be written.

This token file can be used by the Python Google client libraries.
"""

from __future__ import annotations
import json
import os
from google_auth_oauthlib.flow import InstalledAppFlow

# Set the scopes you need. Adjust as necessary.
SCOPES = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
    'https://www.googleapis.com/auth/tasks.readonly',
    'https://mail.google.com/'
]

CREDS_FILE = 'credentials.json'
TOKEN_FILE = 'token.json'


def main():
    if not os.path.exists(CREDS_FILE):
        print(f"Missing {CREDS_FILE}. Create an OAuth client in Google Cloud Console and save the JSON as {CREDS_FILE}.")
        return

    flow = InstalledAppFlow.from_client_secrets_file(CREDS_FILE, SCOPES)
    creds = flow.run_local_server(port=0)

    with open(TOKEN_FILE, 'w') as f:
        f.write(creds.to_json())

    print(f"Saved credentials to {TOKEN_FILE}")


if __name__ == '__main__':
    main()
