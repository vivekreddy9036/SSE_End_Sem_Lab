// ──────────────────────────────────────────────────
// API Request / Response Types
// ──────────────────────────────────────────────────

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  turnstileToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  turnstileToken: string;
  lat?: number;
  lng?: number;
}

export interface LoginResponse {
  requires2FA?: boolean;
  totpEnabled?: boolean;
  passkeyEnabled?: boolean;
  user?: SessionUser;
}

export interface TwoFactorVerifyRequest {
  token?: string;
  recoveryCode?: string;
}

export interface ForgotPasswordRequest {
  email: string;
  turnstileToken: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface AssignRoleRequest {
  roleId: number;
}

export interface CreateAccessRequestRequest {
  permissionId: number;
  justification: string;
}

export interface ReviewAccessRequestRequest {
  decision: "APPROVED" | "REJECTED";
  reviewNote?: string;
  /** Minutes until the grant expires; omit for a permanent grant. */
  expiresInMinutes?: number;
}

export interface CreateRoleRequest {
  code: string;
  name: string;
  description?: string;
}

export interface CreateResourceRequest {
  code: string;
  name: string;
  description?: string;
  sensitivity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface CreatePermissionRequest {
  code: string;
  name: string;
  action: "READ" | "WRITE" | "APPROVE" | "MANAGE" | "ADMIN";
  resourceId: number;
}

export interface SetRolePermissionRequest {
  permissionId: number;
  grant: boolean;
}

// ──────────────────────────────────────────────────
// User Session (client-side)
// ──────────────────────────────────────────────────

export interface SessionUser {
  userId: number;
  email: string;
  fullName: string;
  roleCode: string;
  permissions: string[];
  lastLoginLocation: string | null;
  lastLoginIp: string | null;
  lastLoginLat: number | null;
  lastLoginLng: number | null;
  lastLoginAddress: string | null;
  lastLoginPincode: string | null;
  lastLoginCity: string | null;
  lastLoginState: string | null;
  lastLoginCountry: string | null;
  lastLoginSource: string | null;
}

// ──────────────────────────────────────────────────
// API Envelope
// ──────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
