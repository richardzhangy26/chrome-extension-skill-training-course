/**
 * Trigger a browser "Save As" download for a remote URL or `data:` URL.
 *
 * Note: This is a *client-side* helper that programmatically clicks a hidden
 * `<a download>` link. It is unrelated to the server-side R2 helper of the
 * same role exposed under `@/storage`.
 *
 * - Data URLs are clicked directly via an `<a download>` link.
 * - Remote URLs are fetched and turned into a blob URL so the browser does
 *   not navigate away when the response sets `Content-Disposition: inline`.
 *   Falls back to opening the URL in a new tab on CORS / network errors.
 */
export async function downloadFile(
  url: string,
  filename?: string
): Promise<void> {
  const isDataUrl = url.startsWith('data:');
  const finalName = filename ?? defaultFilename(url);

  let blobUrl = url;
  let shouldRevoke = false;

  if (!isDataUrl) {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      blobUrl = URL.createObjectURL(blob);
      shouldRevoke = true;
    } catch {
      // CORS / network failure — open in a new tab so the user can save it.
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
  }

  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = finalName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  if (shouldRevoke) {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }
}

function defaultFilename(url: string): string {
  const stamp = Date.now();
  if (url.startsWith('data:')) {
    const mime = url.slice(5, url.indexOf(';'));
    const ext = mime.split('/')[1]?.split('+')[0] ?? 'bin';
    return `ai-image-${stamp}.${ext}`;
  }
  try {
    const path = new URL(url).pathname;
    const last = path.split('/').pop() ?? '';
    if (last && /\.[a-z0-9]{2,5}$/i.test(last)) return last;
  } catch {
    // ignore
  }
  return `ai-image-${stamp}.jpg`;
}
