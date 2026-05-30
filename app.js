(() => {
  'use strict';

  const KNOWN_GOOD_APP_BLOB = 'ac9f6293aad3978256861c9e05c7248f538d3459';
  const BLOB_URL = `https://api.github.com/repos/Hinderio/Habbits/git/blobs/${KNOWN_GOOD_APP_BLOB}`;

  function decodeBase64Utf8(value) {
    const binary = atob(String(value || '').replace(/\s+/g, ''));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  }

  function showRuntimeError(error) {
    console.error('[HabitFlow] App runtime konnte nicht geladen werden.', error);
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = 'App konnte nicht geladen werden. Bitte Verbindung prüfen und neu laden.';
      toast.classList.remove('hidden');
    }
  }

  fetch(BLOB_URL, { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error(`GitHub blob fetch failed: ${response.status}`);
      return response.json();
    })
    .then(blob => {
      const source = decodeBase64Utf8(blob.content);
      if (!source || !source.includes('APP_DATA_SCHEMA_VERSION')) throw new Error('Ungültiger App-Blob');
      (0, eval)(source);
    })
    .catch(showRuntimeError);
})();
