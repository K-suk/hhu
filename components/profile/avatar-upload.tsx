"use client";

import { useEffect, useRef, useState } from "react";

import { uploadAvatarAction } from "@/app/actions/upload-avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import {
  getFriendlyErrorMessage,
  validateImageFile,
} from "@/lib/client/security-ui";
import { CSRF_FORM_FIELD_NAME } from "@/lib/security/csrf-shared";

type AvatarUploadProps = {
  userId: string;
  csrfToken: string;
  initialAvatarUrl?: string | null;
  onUploaded?: (avatarUrl: string) => void;
};

const MAX_AVATAR_BYTES = 1024 * 1024;
const MAX_DIMENSION = 1024;
const MIN_DIMENSION = 240;
const OUTPUT_QUALITY = 0.8;
const ACCEPTED_IMAGE_TYPES = "image/jpeg, image/png, image/webp";
const SYSTEM_LOGS = [
  "> calibrating image sensor...",
  "> encrypting student identity...",
  "> bypassing SSC firewall...",
];

function objectUrlFromBlob(blob: Blob): string {
  return URL.createObjectURL(blob);
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to encode image."));
        return;
      }
      resolve(blob);
    }, "image/jpeg", quality);
  });
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read image file."));
    };

    img.src = url;
  });
}

async function compressAvatar(file: File): Promise<Blob> {
  const image = await loadImageFromFile(file);
  let width = image.width;
  let height = image.height;

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  let output: Blob | null = null;

  for (let step = 0; step < 6; step += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Canvas is not supported on this device.");
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, width, height);

    const blob = await canvasToJpegBlob(canvas, OUTPUT_QUALITY);
    output = blob;

    if (blob.size <= MAX_AVATAR_BYTES) {
      return blob;
    }

    width = Math.max(MIN_DIMENSION, Math.floor(width * 0.82));
    height = Math.max(MIN_DIMENSION, Math.floor(height * 0.82));
  }

  if (!output) {
    throw new Error("Failed to process image.");
  }

  return output;
}

export function AvatarUpload({
  csrfToken,
  userId: _userId,
  initialAvatarUrl = null,
  onUploaded,
}: AvatarUploadProps) {
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedBlob, setSelectedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialAvatarUrl);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [logIndex, setLogIndex] = useState(0);
  const isBusy = isProcessing || isUploading;

  useEffect(() => {
    setPreviewUrl(initialAvatarUrl);
  }, [initialAvatarUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!isBusy) {
      setScanProgress(0);
      return;
    }

    setScanProgress(8);
    const intervalId = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 96) {
          return prev;
        }
        return Math.min(96, prev + Math.floor(Math.random() * 10 + 3));
      });
    }, 120);

    return () => clearInterval(intervalId);
  }, [isBusy]);

  useEffect(() => {
    if (!isBusy) {
      setLogIndex(0);
      return;
    }

    const intervalId = setInterval(() => {
      setLogIndex((prev) => (prev + 1) % SYSTEM_LOGS.length);
    }, 1250);

    return () => clearInterval(intervalId);
  }, [isBusy]);

  function showSystemError(message: string) {
    showToast(`SYSTEM ERROR // ${message}`, "error");
  }

  async function handleOpenCamera() {
    try {
      if ("permissions" in navigator && navigator.permissions?.query) {
        const status = await navigator.permissions.query({
          name: "camera" as PermissionName,
        });
        if (status.state === "denied") {
          showSystemError("User rejected camera access.");
          return;
        }
      }
    } catch {
      // No-op: fallback to opening capture input.
    }

    cameraInputRef.current?.click();
  }

  async function handleChooseFile(file: File) {
    const fileValidationError = validateImageFile(file);
    if (fileValidationError) {
      showSystemError(fileValidationError);
      return;
    }

    setIsProcessing(true);
    try {
      const compressed = await compressAvatar(file);
      if (compressed.size > MAX_AVATAR_BYTES) {
        showSystemError("Image exceeds 1MB after compression.");
        return;
      }
      if (compressed.type !== "image/jpeg") {
        showSystemError("Image conversion failed.");
        return;
      }

      const nextPreview = objectUrlFromBlob(compressed);
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }

      setSelectedBlob(compressed);
      setPreviewUrl(nextPreview);
      setScanProgress(100);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to process image. Please try again.";
      showSystemError(message);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleUpload() {
    if (!selectedBlob || isUploading) {
      return;
    }
    if (!csrfToken) {
      showSystemError("Security token missing. Refresh and try again.");
      return;
    }

    setIsUploading(true);
    const uploadFile = new File([selectedBlob], "avatar-upload.jpg", {
      type: selectedBlob.type || "image/jpeg",
    });
    const formData = new FormData();
    formData.append("avatar", uploadFile);
    formData.append(CSRF_FORM_FIELD_NAME, csrfToken);

    const result = await uploadAvatarAction(formData).catch(() => ({
      ok: false as const,
      message: "We couldn't save your avatar right now. Please try again.",
    }));

    setIsUploading(false);

    if (!result.ok) {
      showSystemError(getFriendlyErrorMessage(result.message));
      return;
    }

    setPreviewUrl(result.avatarUrl);
    setSelectedBlob(null);
    setScanProgress(100);
    onUploaded?.(result.avatarUrl);
    showToast("Avatar uploaded.", "success");
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-[#00ff88]/40 bg-[#1f1712] wood-texture p-3 shadow-[inset_0_0_24px_rgba(0,255,136,0.08)]">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-mono text-[10px] tracking-[0.2em] text-[#7effc4] uppercase">
            Digital Scanner
          </p>
          <p className="font-mono text-[10px] tracking-widest text-zinc-400 uppercase">
            5MB Source Limit
          </p>
        </div>

        <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-[#00ff88]/30 bg-black/40">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Avatar preview"
              className="h-full w-full object-cover [image-rendering:pixelated]"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center text-[#00ff88]/50">
              <span className="material-symbols-outlined text-3xl">add_a_photo</span>
              <span className="mt-1 font-mono text-[11px] uppercase tracking-widest">
                No Scan Loaded
              </span>
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,255,136,0.08)_3px,rgba(0,255,136,0.08)_4px)]" />
          <div className="scan-line pointer-events-none absolute left-0 h-[2px] w-full bg-[#00ff88]/80 shadow-[0_0_14px_rgba(0,255,136,0.8)]" />
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }
            void handleChooseFile(file);
            event.currentTarget.value = "";
          }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          capture="environment"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }
            void handleChooseFile(file);
            event.currentTarget.value = "";
          }}
        />

        <div className="mt-3">
          <Button
            type="button"
            variant="ghost"
            className="w-auto border-[#00ff88]/50 bg-[#042416] px-4 text-[#7effc4] hover:bg-[#083421] mb-2"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading || isProcessing}
          >
            {isProcessing ? "Scanning Image..." : "Choose Image"}
          </Button>
          <Button
            type="button"
            className="w-auto border-[#00ff88]/40 bg-[#00aa66] px-4 text-black hover:bg-[#00c878]"
            onClick={() => void handleUpload()}
            disabled={!selectedBlob || isUploading || isProcessing || !csrfToken}
          >
            Upload Avatar
          </Button>
        </div>

        {isBusy ? (
          <div className="mt-3 space-y-1">
            <p className="font-mono text-xs tracking-wider text-[#7effc4] uppercase">
              SCANNING DATA...
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full border border-[#00ff88]/40 bg-black/60">
              <div
                className="h-full bg-gradient-to-r from-[#00c878] via-[#54ffb3] to-[#00ff88] transition-[width] duration-150"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
            <p className="font-mono text-[11px] text-[#7effc4]/85">{SYSTEM_LOGS[logIndex]}</p>
          </div>
        ) : null}

        {isUploading ? (
          <p className="mt-2 font-mono text-xs tracking-wider text-[#7effc4] uppercase">
            Data Uploading...
          </p>
        ) : null}
      </div>
    </div>
  );
}
