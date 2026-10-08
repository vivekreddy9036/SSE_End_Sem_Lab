// ──────────────────────────────────────────────────
// API Request / Response Types
// ──────────────────────────────────────────────────

export interface LoginRequest {
  username: string;
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

export interface CreateCaseRequest {
  psLimit: string;
  crimeNumber: string;
  sectionOfLaw: string;
  dateOfOccurrence: string;
  dateOfRegistration: string;
  complainantName: string;
  accusedDetails: string;
  gist: string;
  stageId: number;
  assignedOfficerId: number;
  branchId: number;
  actions: string[]; // initial "Action To Be Taken" items
}

export interface UpdateCaseRequest {
  psLimit?: string;
  sectionOfLaw?: string;
  complainantName?: string;
  accusedDetails?: string;
  gist?: string;
  stageId?: number;
  assignedOfficerId?: number;
}

export interface CreateProgressRequest {
  progressDate: string;
  progressDetails: string;
  reminderDate?: string;
  furtherAction?: string;
  remarks?: string;
  completedActionIds?: number[]; // actions marked as done
}

// ──────────────────────────────────────────────────
// Dashboard Types
// ──────────────────────────────────────────────────

export interface StageSummary {
  stageCode: string;
  stageName: string;
  count: number;
}

export interface BranchStageSummary {
  branchCode: string;
  branchName: string;
  stages: StageSummary[];
  total: number;
}

export interface DashboardData {
  branches: BranchStageSummary[];
  totalCases: number;
  progressEntries?: ProgressEntry[];
}

export interface ProgressEntry {
  id: number;
  caseUid: string;
  progressDate: string;
  progressDetails: string;
  furtherAction: string | null;
  remarks: string | null;
  officerName: string;
  branchName: string;
}

// ──────────────────────────────────────────────────
// User Session (client-side)
// ──────────────────────────────────────────────────

export interface SessionUser {
  userId: number;
  username: string;
  fullName: string;
  roleCode: string;
  isSupervisory: boolean;
  branchId: number;
  branchCode: string;
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
