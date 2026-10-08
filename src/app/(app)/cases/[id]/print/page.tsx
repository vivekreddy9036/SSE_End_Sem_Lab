"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SkeletonDetailGrid } from "@/components/ui/skeletons";
import PrintLetterhead from "@/components/print/PrintLetterhead";
import StageBadge from "@/components/ui/StageBadge";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  assignedOfficer: { fullName: string; username: string };
  createdBy: { fullName: string };
  actions: {
    id: number;
    description: string;
    isCompleted: boolean;
    completedAt: string | null;
  }[];
  progressEntries: {
    id: number;
    progressDate: string;
    progressDetails: string;
    furtherAction: string | null;
    remarks: string | null;
    createdBy: { fullName: string };
  }[];
}

export default function CasePrintPage() {
  const { id } = useParams();
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/cases/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) setError(json.message || "Failed to load case");
        else setCaseData(json.data);
      })
      .catch(() => setError("Failed to load case"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto">
        <SkeletonDetailGrid lines={10} />
      </div>
    );
  }
  if (error) return <div className="text-destructive p-4">{error}</div>;
  if (!caseData) return null;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex justify-end mb-4 print:hidden">
        <Button onClick={() => window.print()} className="bg-navy hover:bg-navy-light">
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </Button>
      </div>

      <PrintLetterhead title={`Case Report — ${caseData.uid}`} />

      <div className="flex items-center gap-3 mb-4">
        <StageBadge code={caseData.stage.code} showFullName />
        <span className="text-sm text-muted-foreground">
          Registered {new Date(caseData.createdAt).toLocaleDateString("en-IN")} by {caseData.createdBy.fullName}
        </span>
      </div>

      <section className="mb-6 print-avoid-break">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-2 pb-1 border-b border-border">
          Case Details
        </h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <Field label="PS Limit" value={caseData.psLimit} />
          <Field label="Crime Number" value={caseData.crimeNumber} />
          <Field label="Section of Law" value={caseData.sectionOfLaw} />
          <Field label="Branch" value={caseData.branch.name} />
          <Field label="Date of Occurrence" value={new Date(caseData.dateOfOccurrence).toLocaleDateString("en-IN")} />
          <Field label="Date of Registration" value={new Date(caseData.dateOfRegistration).toLocaleDateString("en-IN")} />
          <Field label="Complainant" value={caseData.complainantName} />
          <Field label="Assigned Officer" value={`${caseData.assignedOfficer.fullName} (${caseData.assignedOfficer.username})`} />
        </div>
        <div className="mt-3 text-sm">
          <p className="text-muted-foreground">Details of Accused:</p>
          <p className="text-foreground mt-0.5">{caseData.accusedDetails}</p>
        </div>
        <div className="mt-3 text-sm">
          <p className="text-muted-foreground">Gist:</p>
          <p className="text-foreground mt-0.5">{caseData.gist}</p>
        </div>
      </section>

      <section className="mb-6 print-avoid-break">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-2 pb-1 border-b border-border">
          Action Items ({caseData.actions.length})
        </h2>
        {caseData.actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No actions recorded.</p>
        ) : (
          <ul className="text-sm space-y-1.5">
            {caseData.actions.map((a) => (
              <li key={a.id} className="flex gap-2">
                <span>{a.isCompleted ? "[x]" : "[ ]"}</span>
                <span className={a.isCompleted ? "line-through text-muted-foreground" : "text-foreground"}>
                  {a.description}
                  {a.completedAt && ` — completed ${new Date(a.completedAt).toLocaleDateString("en-IN")}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-2 pb-1 border-b border-border">
          Progress History ({caseData.progressEntries.length})
        </h2>
        {caseData.progressEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No progress entries.</p>
        ) : (
          <div className="space-y-3">
            {caseData.progressEntries.map((entry) => (
              <div key={entry.id} className="text-sm print-avoid-break">
                <p className="font-medium text-foreground">
                  {new Date(entry.progressDate).toLocaleDateString("en-IN")} — {entry.createdBy.fullName}
                </p>
                <p className="text-foreground">{entry.progressDetails}</p>
                {entry.furtherAction && (
                  <p className="text-muted-foreground">Further action: {entry.furtherAction}</p>
                )}
                {entry.remarks && <p className="text-muted-foreground">Remarks: {entry.remarks}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}:</span>{" "}
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}
