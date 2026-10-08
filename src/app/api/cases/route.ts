import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import {
  apiCreated,
  apiError,
  parsePagination,
  paginatedResponse,
  generateCaseUid,
} from "@/lib/utils";
import { fabricRecordCaseCreated } from "@/lib/fabric";
import type { CreateCaseRequest } from "@/types";

function parseDateOnlyStrict(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [year, month, day] = value.split("-").map((part) => parseInt(part, 10));
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}


/**
 * GET /api/cases
 * Case holders → own cases only. Supervisory → all cases (with filters).
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { isActive: true };

  // Case holders see only their assigned cases
  if (!session.isSupervisory) {
    where.assignedOfficerId = session.userId;
  }

  // Optional filters
  const stageId = searchParams.get("stageId");
  if (stageId) where.stageId = parseInt(stageId, 10);

  const branchId = searchParams.get("branchId");
  if (branchId && session.isSupervisory) {
    where.branchId = parseInt(branchId, 10);
  }

  const search = searchParams.get("search");
  if (search) {
    where.OR = [
      { uid: { contains: search, mode: "insensitive" } },
      { crimeNumber: { contains: search, mode: "insensitive" } },
      { complainantName: { contains: search, mode: "insensitive" } },
    ];
  }

  const [cases, total] = await Promise.all([
    prisma.case.findMany({
      where,
      include: {
        stage: true,
        branch: true,
        assignedOfficer: { select: { id: true, fullName: true, username: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.case.count({ where }),
  ]);

  return paginatedResponse(cases, total, page, limit);
}

/**
 * POST /api/cases
 * Create a new case with initial actions.
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  try {
    const body = (await req.json()) as CreateCaseRequest;

    // Validate required fields
    const required: (keyof CreateCaseRequest)[] = [
      "psLimit", "crimeNumber", "sectionOfLaw", "dateOfOccurrence",
      "dateOfRegistration", "complainantName", "accusedDetails",
      "gist", "stageId", "assignedOfficerId", "branchId",
    ];

    for (const field of required) {
      if (!body[field] && body[field] !== 0) {
        return apiError(`${field} is required`);
      }
    }

    const occurrenceDate = parseDateOnlyStrict(body.dateOfOccurrence);
    const registrationDate = parseDateOnlyStrict(body.dateOfRegistration);

    if (!occurrenceDate || !registrationDate) {
      return apiError("Invalid date format. Use YYYY-MM-DD.");
    }

    const todayUtc = new Date();
    const todayUtcDateOnly = new Date(
      Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate())
    );

    if (occurrenceDate > todayUtcDateOnly || registrationDate > todayUtcDateOnly) {
      return apiError("Date of occurrence and date of registration cannot be in the future.");
    }

    // Generate UID: count existing cases for the branch this year
    const year = new Date().getFullYear();
    const startOfYear = new Date(`${year}-01-01`);
    const count = await prisma.case.count({
      where: {
        branchId: body.branchId,
        createdAt: { gte: startOfYear },
      },
    });

    const branch = await prisma.branch.findUnique({
      where: { id: body.branchId },
    });

    if (!branch) return apiError("Invalid branch");

    const uid = generateCaseUid(branch.code, count + 1);

    // Create case + initial actions in a transaction
    const newCase = await prisma.$transaction(async (tx) => {
      const created = await tx.case.create({
        data: {
          uid,
          psLimit: body.psLimit,
          crimeNumber: body.crimeNumber,
          sectionOfLaw: body.sectionOfLaw,
          dateOfOccurrence: occurrenceDate,
          dateOfRegistration: registrationDate,
          complainantName: body.complainantName,
          accusedDetails: body.accusedDetails,
          gist: body.gist,
          stageId: body.stageId,
          assignedOfficerId: body.assignedOfficerId,
          branchId: body.branchId,
          createdById: session.userId,
        },
        include: { stage: true, branch: true },
      });

      // Create initial actions if provided
      if (body.actions && body.actions.length > 0) {
        await tx.caseAction.createMany({
          data: body.actions.map((desc) => ({
            caseId: created.id,
            description: desc,
            createdById: session.userId,
          })),
        });
      }

      return created;
    });

    // Anchor case creation on Hyperledger Fabric ledger (fire-and-forget)
    fabricRecordCaseCreated(newCase.uid, session.userId, newCase.branchId, newCase.crimeNumber, newCase.id);

    return apiCreated(newCase);
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return apiError("A case with this crime number already exists in this branch", 409);
    }
    console.error("Create case error:", error);
    return apiError("Internal server error", 500);
  }
}
