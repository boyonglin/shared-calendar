import { useEffect } from 'react';
import { GOOGLE_ICON_SIZE, GOOGLE_ICON_VIEWBOX_SIZE } from '../constants/google';

interface GoogleSignInButtonProps {
  isInitialized: boolean;
  isSignedIn: boolean;
  onSignIn: () => void;
}

/**
 * Google Sign-In button component
 * Renders a custom button that triggers the OAuth flow
 */
export function GoogleSignInButton({
  isInitialized,
  isSignedIn,
  onSignIn,
}: GoogleSignInButtonProps) {
  useEffect(() => {
    if (!isInitialized || isSignedIn || !window.google) return;

    const buttonDiv = document.getElementById('g_id_onload_signin');
    if (!buttonDiv) return;

    // Clear any existing content
    buttonDiv.innerHTML = '';

    // Create a custom button that triggers OAuth flow
    const button = document.createElement('button');
    button.className =
      'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2';
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${GOOGLE_ICON_SIZE}" height="${GOOGLE_ICON_SIZE}" viewBox="0 0 ${GOOGLE_ICON_VIEWBOX_SIZE} ${GOOGLE_ICON_VIEWBOX_SIZE}">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        <path fill="none" d="M0 0h48v48H0z"/>
      </svg>
      Sign in with Google
    `;
    button.onclick = onSignIn;
    buttonDiv.appendChild(button);
  }, [isInitialized, isSignedIn, onSignIn]);

  return null;
}
