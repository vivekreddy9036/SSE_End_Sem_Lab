import { after } from "next/server";
import { prisma } from "./prisma";

export type AuditAction =
  | "USER_REGISTERED"
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGIN_LOCKED"
  | "LOGOUT"
  | "TOTP_SETUP_STARTED"
  | "TOTP_SETUP_COMPLETED"
  | "TOTP_VERIFY_SUCCESS"
  | "TOTP_VERIFY_FAILED"
  | "TOTP_ACCOUNT_LOCKED"
  | "TOTP_RECOVERY_USED"
  | "TOTP_DISABLED"
  | "PASSKEY_REGISTERED"
  | "PASSKEY_AUTH_SUCCESS"
  | "PASSKEY_AUTH_FAILED"
  | "PASSWORD_RESET_REQUESTED"
  | "PASSWORD_RESET_COMPLETED"
  | "PASSWORD_RESET_FAILED"
  | "ROLE_ASSIGNED"
  | "ROLE_ASSIGNMENT_BLOCKED"
  | "PERMISSION_GRANTED"
  | "PERMISSION_REVOKED"
  | "ACCESS_REQUESTED"
  | "ACCESS_APPROVED"
  | "ACCESS_REJECTED"
  | "ACCESS_APPROVAL_BLOCKED"
  | "ACCOUNT_DEACTIVATED"
  | "ACCOUNT_REACTIVATED";

/**
 * Write an audit log entry. Never blocks the response — the insert runs via
 * Next's after() so it's scheduled once the response is sent, but on
 * serverless platforms (Vercel) the runtime is kept alive until it finishes.
 * A plain un-awaited prisma call here would silently drop rows in production:
 * Vercel can freeze/terminate the function the instant the response flushes,
 * before a bare fire-and-forget promise resolves.
 */
export function auditLog(
  userId: number,
  action: AuditAction,
  detail?: string,
  ipAddress?: string
): void {
  after(async () => {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action,
          detail: detail ?? null,
          ipAddress: ipAddress ?? null,
        },
      });
    } catch (err) {
      console.error("Audit log write failed:", err);
    }
  });
}

/**
 * Extract client IP from a Request (works behind proxies).
 */
export function getClientIpFromRequest(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export interface LoginGeoResult {
  location: string;   // human-readable place name for display ("city, state")
  lat: number | null;
  lng: number | null;
  address: string | null;
  pincode: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  source: "gps" | "ip" | "none";
}

interface StructuredLocation {
  address: string | null;
  pincode: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  label: string;
}

/**
 * Reverse-geocode coordinates to a structured address via Nominatim (OpenStreetMap).
 * Free, no API key. zoom=16 gives street/suburb-level precision.
 */
async function reverseGeocodeNominatim(lat: number, lng: number): Promise<StructuredLocation | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16&addressdetails=1`,
      {
        headers: { "User-Agent": "SentinelIAM/1.0 location-lookup" },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!res.ok) return null;

    const nm = await res.json() as {
      display_name?: string;
      address?: {
        village?: string;
        suburb?: string;
        town?: string;
        city?: string;
        state_district?: string;
        county?: string;
        state?: string;
        country?: string;
        postcode?: string;
      };
    };
    const a = nm.address;
    if (!a) return null;

    // Prefer state_district ("Chennai") over the formal municipal body name
    // in `city` ("Chennai Corporation") and over granular sub-localities
    // like "Zone 5 Royapuram" — state_district reads cleanest for Indian
    // urban addresses while still falling back sensibly elsewhere.
    const city = a.state_district ?? a.city ?? a.town ?? a.village ?? a.suburb ?? a.county ?? null;
    const state = a.state ?? null;
    const country = a.country ?? null;
    const label = [city, state].filter(Boolean).join(", ");

    return {
      address: nm.display_name ?? null,
      pincode: a.postcode ?? null,
      city,
      state,
      country,
      label: label || nm.display_name || "",
    };
  } catch {
    return null;
  }
}

function isValidCoordPair(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/**
 * Resolve login location, preferring accurate browser GPS coordinates over
 * IP-based lookup. IP geolocation on Indian mobile/broadband ISPs is often
 * wrong by hundreds of km (whole state), since IP ranges are frequently
 * registered to a distant regional office rather than the actual usage point.
 *
 * Falls back to lookupIpLocation() when GPS coords are missing/invalid or
 * when the browser reverse-geocode call fails.
 */
export async function resolveLoginLocation(
  ip: string,
  browserLat?: number | null,
  browserLng?: number | null
): Promise<LoginGeoResult> {
  if (isValidCoordPair(browserLat, browserLng)) {
    const geo = await reverseGeocodeNominatim(browserLat, browserLng as number);
    if (geo) {
      return {
        location: geo.label,
        lat: browserLat,
        lng: browserLng as number,
        address: geo.address,
        pincode: geo.pincode,
        city: geo.city,
        state: geo.state,
        country: geo.country,
        source: "gps",
      };
    }
    // Reverse-geocode failed, but the GPS fix itself is still accurate — keep it.
    return {
      location: "",
      lat: browserLat,
      lng: browserLng as number,
      address: null,
      pincode: null,
      city: null,
      state: null,
      country: null,
      source: "gps",
    };
  }

  return lookupIpLocation(ip);
}

/**
 * Resolve an IP address to coordinates + a human-readable place name.
 * Steps:
 *   1. ipapi.co  → lat/lng + rough city/country fallback (no key, 1000 req/day)
 *   2. Nominatim → precise reverse-geocode (OSM, free)
 * No browser permissions required; done entirely server-side. Used as a
 * fallback when browser GPS is unavailable/denied.
 * Returns null location fields on private IPs or any network failure.
 */
export async function lookupIpLocation(ip: string): Promise<LoginGeoResult> {
  const empty: LoginGeoResult = {
    location: "", lat: null, lng: null,
    address: null, pincode: null, city: null, state: null, country: null,
    source: "none",
  };

  if (
    !ip ||
    ip === "unknown" ||
    ip === "::1" ||
    ip.startsWith("127.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.")
  ) {
    return empty;
  }

  let lat: number | null = null;
  let lng: number | null = null;
  let fallbackLocation = "";

  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { "User-Agent": "SentinelIAM/1.0" },
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json() as {
        latitude?: number;
        longitude?: number;
        city?: string;
        region?: string;
        country_name?: string;
        error?: boolean;
      };
      if (!data.error) {
        lat = data.latitude ?? null;
        lng = data.longitude ?? null;
        // Fallback label in case Nominatim fails
        const parts = [data.city, data.country_name].filter(Boolean);
        fallbackLocation = parts.join(", ");
      }
    }
  } catch {
    return empty;
  }

  if (lat === null || lng === null) return empty;

  const geo = await reverseGeocodeNominatim(lat, lng);
  if (geo) {
    return {
      location: geo.label || fallbackLocation,
      lat, lng,
      address: geo.address,
      pincode: geo.pincode,
      city: geo.city,
      state: geo.state,
      country: geo.country,
      source: "ip",
    };
  }

  return {
    location: fallbackLocation, lat, lng,
    address: null, pincode: null, city: null, state: null, country: null,
    source: "ip",
  };
}
