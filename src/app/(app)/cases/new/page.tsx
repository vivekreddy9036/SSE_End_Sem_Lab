"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { DatePicker } from "@/components/ui/DatePicker";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus } from "lucide-react";

interface UserOption {
  id: number;
  fullName: string;
  username: string;
  branch: { id: number; code: string; name: string };
}

interface BranchOption {
  id: number;
  code: string;
  name: string;
}

interface StageOption {
  id: number;
  code: string;
  name: string;
}

export default function CreateCasePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [officers, setOfficers] = useState<UserOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [stages, setStages] = useState<StageOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [form, setForm] = useState({
    psLimit: "",
    crimeNumber: "",
    sectionOfLaw: "",
    dateOfOccurrence: "",
    dateOfRegistration: "",
    complainantName: "",
    accusedDetails: "",
    gist: "",
    stageId: "",
    assignedOfficerId: "",
    branchId: "",
    actions: [""],
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, branchesRes, stagesRes] = await Promise.all([
          fetch("/api/users?roleType=case-holder").then((r) => r.ok ? r.json() : { data: [] }),
          fetch("/api/branches").then((r) => r.ok ? r.json() : { data: [] }),
          fetch("/api/stages").then((r) => r.ok ? r.json() : { data: [] }),
        ]);

        setOfficers(usersRes.data || []);
        setBranches(branchesRes.data || []);
        setStages(stagesRes.data || []);

        // Default branch to user's branch
        if (user?.branchId) {
          setForm((f) => ({ ...f, branchId: String(user.branchId) }));
        }
      } catch (err) {
        console.error("Failed to fetch form data:", err);
      }
    };

    fetchData();
  }, [user]);

  const setField = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleActionChange = (idx: number, value: string) => {
    const updated = [...form.actions];
    updated[idx] = value;
    setForm((f) => ({ ...f, actions: updated }));
  };

  const addAction = () => setForm((f) => ({ ...f, actions: [...f.actions, ""] }));

  const removeAction = (idx: number) =>
    setForm((f) => ({ ...f, actions: f.actions.filter((_, i) => i !== idx) }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          stageId: parseInt(form.stageId, 10),
          assignedOfficerId: parseInt(form.assignedOfficerId, 10),
          branchId: parseInt(form.branchId, 10),
          actions: form.actions.filter((a) => a.trim()),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        const msg = json.error || json.message || "Failed to create case";
        setError(msg);
        toast.error("Failed to create case", { description: msg });
        return;
      }

      toast.success("Case registered", {
        description: `Case ${json.data.uid} created. You can now upload documents on the case page.`,
      });
      router.push(`/cases/${json.data.id}`);
    } catch {
      setError("Something went wrong");
      toast.error("Something went wrong", { description: "Please try again or contact support." });
    } finally {
      setLoading(false);
    }
  };

  // Filter officers based on selected branch
  const filteredOfficers = form.branchId
    ? officers.filter((o) => o.branch.id === parseInt(form.branchId, 10))
    : officers;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">Register New Case</h1>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Case Identification */}
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle>Case Identification</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>PS Limit *</Label>
              <Input
                type="text"
                value={form.psLimit}
                onChange={(e) => setField("psLimit", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Crime Number *</Label>
              <Input
                type="text"
                value={form.crimeNumber}
                onChange={(e) => setField("crimeNumber", e.target.value)}
                required
              />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label>Section of Law *</Label>
              <Input
                type="text"
                value={form.sectionOfLaw}
                onChange={(e) => setField("sectionOfLaw", e.target.value)}
                required
              />
            </div>
            <DatePicker
              label="Date of Occurrence"
              value={form.dateOfOccurrence}
              onChange={(val) => setField("dateOfOccurrence", val)}
              disableFutureDates
              required
            />
            <DatePicker
              label="Date of Registration"
              value={form.dateOfRegistration}
              onChange={(val) => setField("dateOfRegistration", val)}
              disableFutureDates
              required
            />
          </CardContent>
        </Card>

        {/* Section 2: Individuals */}
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle>Individuals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name of the Complainant *</Label>
              <Input
                type="text"
                value={form.complainantName}
                onChange={(e) => setField("complainantName", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Details of the Accused *</Label>
              <Textarea
                value={form.accusedDetails}
                onChange={(e) => setField("accusedDetails", e.target.value)}
                rows={3}
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Case Summary */}
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle>Case Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Gist of the Case *</Label>
              <Textarea
                value={form.gist}
                onChange={(e) => setField("gist", e.target.value)}
                rows={4}
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Current Stage *</Label>
                <Select value={form.stageId} onValueChange={(val) => setField("stageId", val)} required>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Branch *</Label>
                <Select value={form.branchId} onValueChange={(val) => setField("branchId", val)} required>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Case Holding Officer *</Label>
                <Select
                  value={form.assignedOfficerId}
                  onValueChange={(val) => setField("assignedOfficerId", val)}
                  required
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select officer" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredOfficers.map((o) => (
                      <SelectItem key={o.id} value={String(o.id)}>
                        {o.fullName} ({o.username})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Action To Be Taken */}
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle>Action To Be Taken</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {form.actions.map((action, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  type="text"
                  value={action}
                  onChange={(e) => handleActionChange(idx, e.target.value)}
                  placeholder={`Action item ${idx + 1}`}
                  className="flex-1"
                />
                {form.actions.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeAction(idx)}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addAction}
              className="inline-flex items-center gap-1 text-sm text-navy hover:underline cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Add another action
            </button>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={loading} className="bg-navy hover:bg-navy-light px-6 h-10.5">
            {loading ? "Registering..." : "Register Case"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()} className="px-6 h-10.5">
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
