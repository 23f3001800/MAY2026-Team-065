// Reverse geocoding: coordinates -> a human-readable street address.
//
// The backend has no geocoding endpoint, so this calls OpenStreetMap's
// Nominatim directly. Chosen because it needs no API key — anything else would
// mean shipping a credential in the bundle, where it is public by definition.
//
// Two consequences the caller has to respect:
//   - Nominatim's usage policy is roughly one request per second. Never call
//     this on a timer or per keystroke; only when coordinates actually change.
//   - It is a third party and may be slow or down. Every failure resolves to
//     null rather than throwing, and the address field stays editable, so a
//     citizen can always type the address themselves.
//
// It also does not go through api/client.js: this is not our API, and attaching
// our bearer token to a third-party host would leak the session.

const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';

// Nominatim returns a long formal string ("123, Main Street, Ward 4, Bengaluru
// Urban, Karnataka, 560001, India"). A citizen confirming a location wants the
// first few parts, not the postal hierarchy.
function shortAddress(data) {
  const a = data?.address;
  if (!a) return data?.display_name || null;

  const parts = [
    a.house_number,
    a.road || a.pedestrian || a.footway || a.neighbourhood,
    a.suburb || a.village || a.town || a.city_district,
    a.city || a.county,
  ].filter(Boolean);

  // De-duplicate: Nominatim often repeats a name across levels.
  const seen = new Set();
  const unique = parts.filter((p) => {
    const k = p.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return unique.length ? unique.join(', ') : data.display_name || null;
}

/**
 * @returns {Promise<string|null>} a short address, or null if unavailable.
 */
export async function reverseGeocode({ latitude, longitude }, { signal } = {}) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;

  const url = new URL(NOMINATIM);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', latitude);
  url.searchParams.set('lon', longitude);
  // Street level. Higher zoom returns building-level detail that is usually
  // noise for a civic complaint.
  url.searchParams.set('zoom', '18');
  url.searchParams.set('addressdetails', '1');

  try {
    const res = await fetch(url.toString(), {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return shortAddress(await res.json());
  } catch {
    // Offline, blocked, rate-limited, or aborted — all mean "type it yourself".
    return null;
  }
}
