import React from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

// Auto-detect environment host
const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// Dynamic Base URL target for API calls
const API_BASE_URL = isLocalhost
  ? 'http://localhost:3000/api'
  : 'https://thepartygoers.partygoers.online/api';

// Shared Client ID across local and online
const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "164735893104-fct0sc6ovu9dra7sp2ckmc4j1k7agpc0.apps.googleusercontent.com";

export default function GoogleAuthButton({ onSuccess, onError }) {
  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: credentialResponse.credential
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      console.log('Google Sign-In Successful:', data);
      if (onSuccess) onSuccess(data);
    } catch (err) {
      console.error('Google Sign-In Request Error:', err.message);
      if (onError) onError(err.message);
    }
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="w-full flex justify-center my-2">
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => {
            if (onError) onError('Google Popup authorization failed.');
          }}
          theme="filled_dark"
          shape="pill"
          size="large"
          width="100%"
        />
      </div>
    </GoogleOAuthProvider>
  );
}
