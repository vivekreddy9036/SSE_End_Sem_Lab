"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import StageBadge from "@/components/ui/StageBadge";
import { SkeletonDetailGrid, SkeletonListCard } from "@/components/ui/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import CaseFiles from "@/components/CaseFiles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Circle, CheckCircle2, ChevronDown, Printer } from "lucide-react";

interface CaseDetail {
  id: number;
  uid: string;
  psLimit: string;
  crimeNumber: string;
  sectionOfLaw: string;
  dateOfOccurrence: string;
  dateOfRegistration: string;
  complainantName: string;
  accusedDetails: string;
  gist: string;
  createdAt: string;
  stage: { code: string; name: string };
  branch: { code: string; name: string };
  assignedOfficer: { id: number; fullName: string; username: string };
  createdBy: { fullName: string };
  actions: {
    id: number;
    description: string;
    isCompleted: boolean;
    completedAt: string | null;
    createdAt: string;
  }[];
  progressEntries: {
    id: number;
    progressDate: string;
    progressDetails: string;
    reminderDate: string | null;
    furtherAction: string | null;
    remarks: string | null;
    createdBy: { fullName: string };
  }[];
}

export default function CaseDetailPage() {
  const { id } = useParams();
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    fetch(`/api/cases/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) {
          setError(json.message || "Failed to load case");
        } else {
          setCaseData(json.data);
        }
      })
      .catch(() => setError("Failed to load case"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-36 rounded-lg" />
          </div>
        </div>
        <div className="mb-6">
          <SkeletonDetailGrid lines={10} />
        </div>
        <div className="mb-6">
          <SkeletonListCard items={3} />
        </div>
        <SkeletonListCard items={4} />
      </div>
    );
  }
  if (error) return <div className="text-destructive p-4">{error}</div>;
  if (!caseData) return null;

  const pendingActions = caseData.actions.filter((a) => !a.isCompleted);
  const completedActions = caseData.actions.filter((a) => a.isCompleted);

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{caseData.uid}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registered on {new Date(caseData.createdAt).toLocaleDateString("en-IN")}
            {" by "}{caseData.createdBy.fullName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StageBadge code={caseData.stage.code} showFullName />
          <Button asChild variant="outline">
            <Link href={`/cases/${caseData.id}/print`}>
              <Printer className="h-4 w-4" /> Print
            </Link>
          </Button>
          <Button asChild className="bg-navy hover:bg-navy-light">
            <Link href={`/cases/${caseData.id}/progress`}>Update Progress</Link>
          </Button>
        </div>
      </div>

      {/* Case Details */}
      <Card className="mb-6">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle>Case Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <InfoRow label="PS Limit" value={caseData.psLimit} />
          <InfoRow label="Crime Number" value={caseData.crimeNumber} />
          <InfoRow label="Section of Law" value={caseData.sectionOfLaw} />
          <InfoRow label="Branch" value={caseData.branch.name} />
          <InfoRow label="Date of Occurrence" value={new Date(caseData.dateOfOccurrence).toLocaleDateString("en-IN")} />
          <InfoRow label="Date of Registration" value={new Date(caseData.dateOfRegistration).toLocaleDateString("en-IN")} />
          <InfoRow label="Complainant" value={caseData.complainantName} />
          <InfoRow label="Assigned Officer" value={`${caseData.assignedOfficer.fullName} (${caseData.assignedOfficer.username})`} />
          <div className="md:col-span-2">
            <InfoRow label="Details of Accused" value={caseData.accusedDetails} />
          </div>
          <div className="md:col-span-2">
            <InfoRow label="Gist" value={caseData.gist} />
          </div>
        </CardContent>
      </Card>

      {/* Pending Actions */}
      <Card className="mb-6">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle>Pending Actions ({pendingActions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingActions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending actions.</p>
          ) : (
            <ul className="space-y-2">
              {pendingActions.map((a) => (
                <li key={a.id} className="flex items-start gap-3 p-3 bg-warning/10 rounded-lg border border-warning/20">
                  <Circle className="h-4 w-4 mt-0.5 shrink-0 text-warning" />
                  <span className="text-sm text-foreground">{a.description}</span>
                </li>
              ))}
            </ul>
          )}

          {completedActions.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowCompleted((v) => !v)}
                className="flex items-center gap-1 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${showCompleted ? "rotate-180" : ""}`} />
                Show {completedActions.length} completed action(s)
              </button>
              {showCompleted && (
                <ul className="mt-2 space-y-2">
                  {completedActions.map((a) => (
                    <li key={a.id} className="flex items-start gap-3 p-3 bg-success/10 rounded-lg border border-success/20">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-success" />
                      <div>
                        <span className="text-sm text-muted-foreground line-through">{a.description}</span>
                        {a.completedAt && (
                          <span className="block text-xs text-muted-foreground mt-0.5">
                            Completed {new Date(a.completedAt).toLocaleDateString("en-IN")}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress History */}
      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle>Progress History ({caseData.progressEntries.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {caseData.progressEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No progress entries yet.</p>
          ) : (
            <div className="space-y-4">
              {caseData.progressEntries.map((entry) => (
                <div key={entry.id} className="border border-border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-foreground">
                      {new Date(entry.progressDate).toLocaleDateString("en-IN")}
                    </span>
                    <span className="text-xs text-muted-foreground">by {entry.createdBy.fullName}</span>
                  </div>
                  <p className="text-sm text-foreground mb-2">{entry.progressDetails}</p>
                  {entry.furtherAction && (
                    <p className="text-sm text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300 p-2 rounded">
                      <span className="font-medium">Further Action:</span> {entry.furtherAction}
                    </p>
                  )}
                  {entry.reminderDate && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Reminder: {new Date(entry.reminderDate).toLocaleDateString("en-IN")}
                    </p>
                  )}
                  {entry.remarks && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Remarks: {entry.remarks}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Case Documents (R2 Storage) */}
      <div className="mt-6">
        <CaseFiles caseId={caseData.id} />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}:</span>{" "}
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}
