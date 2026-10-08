"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { DatePicker } from "@/components/ui/DatePicker";
import CaseFiles from "@/components/CaseFiles";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface PendingAction {
  id: number;
  description: string;
  isCompleted: boolean;
}

interface CaseBasic {
  id: number;
  uid: string;
  crimeNumber: string;
  actions: PendingAction[];
}

export default function ProgressUpdatePage() {
  const { id } = useParams();
  const router = useRouter();

  const [caseData, setCaseData] = useState<CaseBasic | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [progressDate, setProgressDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [progressDetails, setProgressDetails] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [furtherAction, setFurtherAction] = useState("");
  const [remarks, setRemarks] = useState("");
  const [completedActionIds, setCompletedActionIds] = useState<number[]>([]);

  useEffect(() => {
    fetch(`/api/cases/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setCaseData(json.data);
        } else {
          setError(json.message || "Failed to load case");
        }
      })
      .catch(() => setError("Failed to load case"))
      .finally(() => setLoading(false));
  }, [id]);

  const toggleAction = (actionId: number) => {
    setCompletedActionIds((prev) =>
      prev.includes(actionId)
        ? prev.filter((id) => id !== actionId)
        : [...prev, actionId]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch(`/api/cases/${id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          progressDate,
          progressDetails,
          reminderDate: reminderDate || undefined,
          furtherAction: furtherAction || undefined,
          remarks: remarks || undefined,
          completedActionIds,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.message || "Failed to add progress");
        return;
      }

      toast.success("Progress updated");
      router.push(`/cases/${id}`);
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <Skeleton className="h-9 w-48 rounded-lg" />
            <Skeleton className="h-28 w-full rounded-lg" />
            <Skeleton className="h-9 w-48 rounded-lg" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-2.5 pt-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <Skeleton className="h-4 w-4 rounded shrink-0" />
                <Skeleton className="h-4 flex-1 max-w-sm" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }
  if (error && !caseData) return <div className="text-destructive p-4">{error}</div>;
  if (!caseData) return null;

  const pendingActions = caseData.actions.filter((a) => !a.isCompleted);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Progress Update</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {caseData.uid} — Crime No. {caseData.crimeNumber}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Pending Actions checklist */}
        {pendingActions.length > 0 && (
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle>Action To Be Taken — Mark Completed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingActions.map((action) => (
                <label
                  key={action.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={completedActionIds.includes(action.id)}
                    onCheckedChange={() => toggleAction(action.id)}
                    className="mt-0.5"
                  />
                  <span className="text-sm text-foreground">{action.description}</span>
                </label>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Progress Entry Form */}
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle>Progress Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DatePicker
              label="Date of Progress"
              value={progressDate}
              onChange={setProgressDate}
              required
            />

            <div className="space-y-1.5">
              <Label>Details of Progress *</Label>
              <Textarea
                value={progressDetails}
                onChange={(e) => setProgressDetails(e.target.value)}
                rows={4}
                required
              />
            </div>

            <DatePicker
              label="Reminder Date"
              value={reminderDate}
              onChange={setReminderDate}
            />

            <div className="space-y-1.5">
              <Label>Further Action To Be Taken</Label>
              <Textarea
                value={furtherAction}
                onChange={(e) => setFurtherAction(e.target.value)}
                rows={2}
                placeholder="This will become a new action item for the next progress update"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Remarks</Label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={submitting} className="bg-navy hover:bg-navy-light px-6 h-10.5">
            {submitting ? "Submitting..." : "Submit Progress"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push(`/cases/${id}`)} className="px-6 h-10.5">
            Cancel
          </Button>
        </div>
      </form>

      {/* Case Documents */}
      <div className="mt-6">
        <CaseFiles caseId={caseData.id} />
      </div>
    </div>
  );
}
