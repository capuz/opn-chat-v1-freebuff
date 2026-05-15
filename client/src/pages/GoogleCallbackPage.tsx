import { useEffect } from 'react';

const GoogleCallbackPage = () => {
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const idToken = params.get('id_token');
    const error = params.get('error');

    if (window.opener) {
      window.opener.postMessage(
        { type: 'GOOGLE_AUTH_CALLBACK', id_token: idToken, error },
        window.location.origin
      );
      window.close();
    }
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', color: '#6b7280' }}>
      Autenticando...
    </div>
  );
};

export default GoogleCallbackPage;
