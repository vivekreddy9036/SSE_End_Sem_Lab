import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { NextResponse } from "next/server"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── API response helpers ─────────────────────────────────────────────────────

export function apiSuccess<T>(data: T, message?: string) {
  return NextResponse.json(
    { success: true, data, ...(message ? { message } : {}) },
    { status: 200 }
  );
}

export function apiCreated<T>(data: T, message?: string) {
  return NextResponse.json(
    { success: true, data, ...(message ? { message } : {}) },
    { status: 201 }
  );
}

export function apiError(error: string, status: number = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

// ── Pagination helpers ───────────────────────────────────────────────────────

export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  return NextResponse.json({
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// ── Case UID generator ───────────────────────────────────────────────────────

export function generateCaseUid(branchCode: string, sequenceNumber: number): string {
  const year = new Date().getFullYear();
  const seq = String(sequenceNumber).padStart(3, "0");
  return `${branchCode}/${seq}/${year}`;
}
