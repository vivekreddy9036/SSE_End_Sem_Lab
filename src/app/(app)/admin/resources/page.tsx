"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Spinner from "@/components/ui/Spinner";
import { Plus } from "lucide-react";

interface ResourceRow {
  id: number;
  code: string;
  name: string;
  description: string | null;
  sensitivity: string;
  permissionCount: number;
}

function sensitivityVariant(s: string) {
  if (s === "CRITICAL") return "destructive";
  if (s === "HIGH") return "secondary";
  return "outline";
}

export default function ResourcesPage() {
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sensitivity, setSensitivity] = useState("MEDIUM");

  const load = () => {
    fetch("/api/admin/resources")
      .then((r) => r.json())
      .then((json) => setResources(json.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name, description: description || undefined, sensitivity }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || "Failed to create resource");
      setOpen(false);
      setCode("");
      setName("");
      setDescription("");
      setSensitivity("MEDIUM");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create resource");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Resources</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-navy hover:bg-navy-light">
              <Plus className="h-4 w-4" /> New Resource
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Define a new resource</DialogTitle>
            </DialogHeader>
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="code">Code</Label>
                <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="PAYROLL" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Payroll System" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Sensitivity</Label>
                <Select value={sensitivity} onValueChange={setSensitivity}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving} className="bg-navy hover:bg-navy-light">
                  {saving ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Resources</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Spinner className="py-8" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Sensitivity</TableHead>
                  <TableHead className="text-right">Permissions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resources.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.code}</TableCell>
                    <TableCell>
                      <div className="font-medium">{r.name}</div>
                      {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
                    </TableCell>
                    <TableCell><Badge variant={sensitivityVariant(r.sensitivity)}>{r.sensitivity}</Badge></TableCell>
                    <TableCell className="text-right">{r.permissionCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
