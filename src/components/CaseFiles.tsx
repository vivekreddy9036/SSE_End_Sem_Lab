"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Image as ImageIcon,
  Music,
  Video,
  FileText,
  FileSpreadsheet,
  Paperclip,
  Mic,
  Camera,
  X,
  Eye,
  Download,
  Trash2,
} from "lucide-react";

interface CaseFileRecord {
  id: number;
  r2Key: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy: { fullName: string };
}

interface StorageInfo {
  used: number;
  cap: number;
  usedFormatted: string;
  capFormatted: string;
  remainingFormatted: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i > 1 ? 2 : 0)} ${units[i]}`;
}

function FileTypeIcon({ contentType, className }: { contentType: string; className?: string }) {
  if (contentType.startsWith("image/")) return <ImageIcon className={className} />;
  if (contentType.startsWith("audio/")) return <Music className={className} />;
  if (contentType.startsWith("video/")) return <Video className={className} />;
  if (contentType === "application/pdf") return <FileText className={className} />;
  if (contentType.includes("word")) return <FileText className={className} />;
  if (contentType.includes("sheet") || contentType.includes("excel")) return <FileSpreadsheet className={className} />;
  return <Paperclip className={className} />;
}

// Types that can be previewed inline in the browser
function isViewable(contentType: string): boolean {
  return (
    contentType.startsWith("image/") ||
    contentType.startsWith("audio/") ||
    contentType.startsWith("video/") ||
    contentType === "application/pdf" ||
    contentType === "text/plain"
  );
}

// ── Lightbox modal for image preview ────────────────────────────────────────
function ImageLightbox({
  src,
  fileName,
  onClose,
}: {
  src: string;
  fileName: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl max-h-[90vh] w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-card rounded-t-xl px-4 py-2 border-b border-border">
          <span className="text-sm font-medium text-foreground truncate">{fileName}</span>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors ml-4"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={fileName}
          className="w-full max-h-[80vh] object-contain rounded-b-xl bg-muted"
        />
      </div>
    </div>
  );
}

export default function CaseFiles({ caseId }: { caseId: number }) {
  const [files, setFiles] = useState<CaseFileRecord[]>([]);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; fileName: string } | null>(null);
  const [captureMode, setCaptureMode] = useState<"audio" | "video" | "photo" | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [captureBusy, setCaptureBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/files`);
      const json = await res.json();
      if (json.success) {
        setFiles(json.data.files);
        setStorage(json.data.storage);
      }
    } catch {
      toast.error("Failed to load files");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Close lightbox on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const stopStreamTracks = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const resetCaptureState = useCallback(() => {
    stopStreamTracks();
    mediaRecorderRef.current = null;
    mediaChunksRef.current = [];
    discardRecordingRef.current = false;
    setCaptureMode(null);
    setIsRecording(false);
    setCaptureBusy(false);
  }, [stopStreamTracks]);

  useEffect(() => {
    return () => {
      stopStreamTracks();
    };
  }, [stopStreamTracks]);

  useEffect(() => {
    if ((captureMode === "photo" || captureMode === "video") && previewVideoRef.current && mediaStreamRef.current) {
      previewVideoRef.current.srcObject = mediaStreamRef.current;
      void previewVideoRef.current.play().catch(() => {});
    }
  }, [captureMode]);

  const uploadSingleFile = async (file: File | null) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large", { description: "Maximum file size is 5 MB" });
      return;
    }

    if (storage && storage.used + file.size > storage.cap) {
      toast.error("Storage quota exceeded", {
        description: `Only ${storage.remainingFormatted} remaining. This file is ${formatBytes(file.size)}.`,
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/cases/${caseId}/files`, {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error("Upload failed", { description: json.error || "Unknown error" });
        return;
      }

      toast.success("File uploaded", { description: file.name });
      await fetchFiles();
    } catch {
      toast.error("Upload failed", { description: "Network error" });
    } finally {
      setUploading(false);
    }
  };

  const guessExtension = (mimeType: string, fallback: string): string => {
    if (mimeType.includes("webm")) return "webm";
    if (mimeType.includes("ogg")) return "ogg";
    if (mimeType.includes("mp4")) return "mp4";
    if (mimeType.includes("wav")) return "wav";
    if (mimeType.includes("mpeg")) return "mp3";
    if (mimeType.includes("quicktime")) return "mov";
    if (mimeType.includes("jpeg")) return "jpg";
    if (mimeType.includes("png")) return "png";
    return fallback;
  };

  const createCapturedFile = (blob: Blob, prefix: string, fallbackExt: string): File => {
    const ext = guessExtension(blob.type, fallbackExt);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return new File([blob], `${prefix}_${stamp}.${ext}`, { type: blob.type || "application/octet-stream" });
  };

  const stopRecording = (discard = false) => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    discardRecordingRef.current = discard;
    if (recorder.state !== "inactive") {
      setIsRecording(false);
      recorder.stop();
    }
  };

  const startAudioRecording = async () => {
    if (uploading || isAtLimit || captureBusy || isRecording) return;

    if (typeof window === "undefined" || !("MediaRecorder" in window) || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Audio recording is not supported in this browser");
      return;
    }

    setCaptureBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setCaptureMode("audio");

      const preferred = ["audio/webm", "audio/ogg", "audio/mp4"];
      const mimeType = preferred.find((t) => MediaRecorder.isTypeSupported(t));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      mediaChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) mediaChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const shouldDiscard = discardRecordingRef.current;
        const recordedType = recorder.mimeType || "audio/webm";
        const blob = new Blob(mediaChunksRef.current, { type: recordedType });

        if (!shouldDiscard && blob.size > 0) {
          const file = createCapturedFile(blob, "audio", "webm");
          await uploadSingleFile(file);
        }

        if (shouldDiscard) {
          toast.message("Audio recording discarded");
        }
        resetCaptureState();
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setCaptureBusy(false);
      toast.success("Audio recording started");
    } catch {
      resetCaptureState();
      toast.error("Unable to access microphone");
    }
  };

  const startVideoRecording = async () => {
    if (uploading || isAtLimit || captureBusy || isRecording) return;

    if (typeof window === "undefined" || !("MediaRecorder" in window) || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Video recording is not supported in this browser");
      return;
    }

    setCaptureBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: true,
      });
      mediaStreamRef.current = stream;
      setCaptureMode("video");

      const preferred = ["video/webm", "video/mp4"];
      const mimeType = preferred.find((t) => MediaRecorder.isTypeSupported(t));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      mediaChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) mediaChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const shouldDiscard = discardRecordingRef.current;
        const recordedType = recorder.mimeType || "video/webm";
        const blob = new Blob(mediaChunksRef.current, { type: recordedType });

        if (!shouldDiscard && blob.size > 0) {
          const file = createCapturedFile(blob, "video", "webm");
          await uploadSingleFile(file);
        }

        if (shouldDiscard) {
          toast.message("Video recording discarded");
        }
        resetCaptureState();
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setCaptureBusy(false);
      toast.success("Video recording started");
    } catch {
      resetCaptureState();
      toast.error("Unable to access camera and microphone");
    }
  };

  const startPhotoCapture = async () => {
    if (uploading || isAtLimit || captureBusy || isRecording) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Camera capture is not supported in this browser");
      return;
    }

    setCaptureBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      mediaStreamRef.current = stream;
      setCaptureMode("photo");
      setCaptureBusy(false);
    } catch {
      resetCaptureState();
      toast.error("Unable to access camera");
    }
  };

  const capturePhotoAndUpload = async () => {
    const videoEl = previewVideoRef.current;
    if (!videoEl) return;

    if (!videoEl.videoWidth || !videoEl.videoHeight) {
      toast.error("Camera is not ready yet");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      toast.error("Failed to capture photo");
      return;
    }

    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92);
    });

    if (!blob) {
      toast.error("Failed to encode photo");
      return;
    }

    const file = createCapturedFile(blob, "camera", "jpg");
    await uploadSingleFile(file);
    resetCaptureState();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    await uploadSingleFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (fileId: number, fileName: string) => {
    if (!confirm(`Delete "${fileName}"? This cannot be undone.`)) return;

    setDeleting(fileId);
    try {
      const res = await fetch(`/api/cases/${caseId}/files?fileId=${fileId}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error("Delete failed", { description: json.error });
        return;
      }

      toast.success("File deleted");
      await fetchFiles();
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  const getPresignedUrl = async (fileId: number): Promise<string | null> => {
    try {
      const res = await fetch(`/api/cases/${caseId}/files/${fileId}/download`);
      const json = await res.json();
      if (!res.ok) {
        toast.error("Failed to get file URL", { description: json.error });
        return null;
      }
      return json.data.url as string;
    } catch {
      toast.error("Network error");
      return null;
    }
  };

  const handleView = async (f: CaseFileRecord) => {
    const url = await getPresignedUrl(f.id);
    if (!url) return;

    if (f.contentType.startsWith("image/")) {
      // Show inline lightbox for images
      setLightbox({ src: url, fileName: f.fileName });
    } else {
      // Open PDF / text in a new browser tab
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handleDownload = async (fileId: number, fileName: string) => {
    const url = await getPresignedUrl(fileId);
    if (!url) return;

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const usedPercent = storage ? Math.min(100, (storage.used / storage.cap) * 100) : 0;
  const isNearLimit = usedPercent > 80;
  const isAtLimit = usedPercent > 95;

  return (
    <>
      {/* Image lightbox */}
      {lightbox && (
        <ImageLightbox
          src={lightbox.src}
          fileName={lightbox.fileName}
          onClose={() => setLightbox(null)}
        />
      )}

      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        {(captureMode === "photo" || captureMode === "video") && (
          <div className="mb-4 rounded-lg border border-border bg-muted p-3">
            <p className="text-sm font-medium text-foreground mb-2">
              {captureMode === "photo" ? "Camera Preview" : "Video Recording In Progress"}
            </p>
            <video
              ref={previewVideoRef}
              autoPlay
              playsInline
              muted={captureMode === "video"}
              className="w-full max-h-72 rounded-md bg-black object-cover"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {captureMode === "photo" ? (
                <>
                  <Button type="button" size="sm" onClick={capturePhotoAndUpload} disabled={uploading || captureBusy}>
                    Capture & Upload
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={resetCaptureState}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" size="sm" onClick={() => stopRecording(false)} disabled={!isRecording}>
                    Stop & Upload
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => stopRecording(true)} disabled={!isRecording}>
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {captureMode === "audio" && isRecording && (
          <div className="mb-4 rounded-lg border border-success/20 bg-success/10 p-3 flex items-center justify-between gap-3">
            <p className="text-sm text-success">Audio recording in progress...</p>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={() => stopRecording(false)}>
                Stop & Upload
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => stopRecording(true)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            Case Documents ({files.length})
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <label
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-colors cursor-pointer ${
                uploading || isAtLimit || captureBusy || isRecording
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              <Paperclip className="h-3.5 w-3.5" />
              {uploading ? "Uploading…" : "Upload File"}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading || isAtLimit || captureBusy || isRecording}
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt,.mp3,.wav,.m4a,.ogg,.mp4,.webm,.mov"
              />
            </label>
            <button
              type="button"
              onClick={startAudioRecording}
              disabled={uploading || isAtLimit || captureBusy || isRecording}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-success/10 text-success hover:bg-success/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Mic className="h-3.5 w-3.5" /> Record Audio
            </button>
            <button
              type="button"
              onClick={startPhotoCapture}
              disabled={uploading || isAtLimit || captureBusy || isRecording}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300 hover:bg-sky-200 dark:hover:bg-sky-950/60 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Camera className="h-3.5 w-3.5" /> Open Camera
            </button>
            <button
              type="button"
              onClick={startVideoRecording}
              disabled={uploading || isAtLimit || captureBusy || isRecording}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-950/60 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Video className="h-3.5 w-3.5" /> Record Video
            </button>
          </div>
        </div>

        {/* Storage quota bar */}
        {storage && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{storage.usedFormatted} used</span>
              <span>{storage.remainingFormatted} remaining</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isAtLimit
                    ? "bg-destructive"
                    : isNearLimit
                    ? "bg-warning"
                    : "bg-success"
                }`}
                style={{ width: `${usedPercent}%` }}
              />
            </div>
            <div className="text-right text-xs text-muted-foreground mt-0.5">
              {storage.capFormatted} total
            </div>
          </div>
        )}

        {/* File list */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Loading files…</div>
        ) : files.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-sm">No documents uploaded yet.</p>
            <p className="text-muted-foreground/70 text-xs mt-1">
              Upload documents, images, audio, or video (max 5 MB each)
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-3 py-3 group">
                <FileTypeIcon contentType={f.contentType} className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {f.fileName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(f.sizeBytes)} · {f.uploadedBy.fullName} ·{" "}
                    {new Date(f.createdAt).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* View — only for PDF, images, text */}
                  {isViewable(f.contentType) && (
                    <button
                      onClick={() => handleView(f)}
                      className="p-1.5 text-muted-foreground hover:text-success rounded transition-colors"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  {/* Download */}
                  <button
                    onClick={() => handleDownload(f.id, f.fileName)}
                    className="p-1.5 text-muted-foreground hover:text-blue-600 rounded transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(f.id, f.fileName)}
                    disabled={deleting === f.id}
                    className="p-1.5 text-muted-foreground hover:text-destructive rounded transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
