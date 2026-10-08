export interface BrowserCoords {
  lat: number;
  lng: number;
}

/**
 * Requests the device's GPS/network location via the browser Geolocation API.
 * Resolves to null (never rejects) on denial, timeout, or unsupported browsers
 * so callers can always fall back to server-side IP location.
 */
export function getBrowserCoords(timeoutMs = 8000): Promise<BrowserCoords | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
    }, timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 }
    );
  });
}
