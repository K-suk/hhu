"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AvatarUpload } from "@/components/profile/avatar-upload";
import { CyberIdCard } from "@/components/profile/cyber-id-card";
import { useToast } from "@/components/ui/toast-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getFriendlyErrorMessage,
  handleProtectedResponse,
  sanitizeInlineTextInput,
  sanitizePlainTextInput,
} from "@/lib/client/security-ui";
import { getCsrfToken } from "@/lib/security/csrf-client";
import { CSRF_HEADER_NAME } from "@/lib/security/csrf-shared";
import type { Database } from "@/lib/supabase/database.types";
import {
  profileUpdateSchema,
  type ProfileUpdateInput,
} from "@/lib/validations/matching";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];

type ProfilePageClientProps = {
  userId: string;
  initialProfile: ProfileRow;
  recentMatches: MatchRow[];
};

function formatStatus(status: MatchRow["status"]): string {
  switch (status) {
    case "finished":
      return "Finished";
    case "graded":
      return "Graded";
    case "reported":
      return "Reported";
    case "expired":
      return "Expired";
    default:
      return "Active";
  }
}

function formatDate(date: string | null): string {
  if (!date) {
    return "Unknown date";
  }

  return new Date(date).toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ProfilePageClient({
  userId,
  initialProfile,
  recentMatches,
}: ProfilePageClientProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [profile, setProfile] = useState(initialProfile);
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [csrfToken, setCsrfToken] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const {
    formState: { errors },
    register,
    reset,
    setValue,
    trigger,
    watch,
  } = useForm<ProfileUpdateInput>({
    defaultValues: {
      display_name: initialProfile.display_name ?? "",
      department: initialProfile.department ?? "",
    },
    mode: "onChange",
    resolver: zodResolver(profileUpdateSchema),
  });

  useEffect(() => {
    void getCsrfToken()
      .then((token) => {
        setCsrfToken(token);
      })
      .catch(() => {
        setErrorMessage("Security token bootstrap failed. Refresh and try again.");
      });
  }, []);

  useEffect(() => {
    if (!successMessage && !errorMessage) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setSuccessMessage("");
      setErrorMessage("");
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [successMessage, errorMessage]);

  useEffect(() => {
    if (open) {
      document.body.classList.add("profile-edit-modal-open");
    } else {
      document.body.classList.remove("profile-edit-modal-open");
    }
    return () => document.body.classList.remove("profile-edit-modal-open");
  }, [open]);

  function openEditDialog() {
    reset({
      display_name: profile.display_name ?? "",
      department: profile.department ?? "",
    });
    setOpen(true);
  }

  async function handleSaveProfile() {
    const isValid = await trigger();
    if (!isValid) {
      setErrorMessage(
        errors.display_name?.message ??
        errors.department?.message ??
        "Invalid profile input.",
      );
      return;
    }

    const values = {
      display_name: sanitizePlainTextInput(watch("display_name")),
      department: sanitizePlainTextInput(watch("department")),
    };
    const parsed = profileUpdateSchema.safeParse({
      display_name: values.display_name,
      department: values.department,
    });

    if (!parsed.success) {
      setErrorMessage(
        parsed.error.flatten().fieldErrors.display_name?.[0] ??
        parsed.error.flatten().fieldErrors.department?.[0] ??
        "Invalid profile input.",
      );
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    if (!csrfToken) {
      setIsSaving(false);
      setErrorMessage("Security token bootstrap failed. Refresh and try again.");
      return;
    }

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [CSRF_HEADER_NAME]: csrfToken,
        },
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        const message = await handleProtectedResponse(response, () => router.push("/login"));
        setErrorMessage(message ?? "Failed to update profile.");
        return;
      }

      const payload = (await response.json()) as { profile?: ProfileRow };
      if (!payload.profile) {
        setErrorMessage("Failed to update profile.");
        return;
      }

      setProfile(payload.profile);
      setSuccessMessage("Profile updated.");
      showToast("Profile updated.", "success");
      setOpen(false);
    } catch (error) {
      setErrorMessage(
        getFriendlyErrorMessage(
          error instanceof Error ? error.message : "Failed to update profile.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-black font-display text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col overflow-hidden bg-black md:max-w-none">
        {successMessage ? (
          <div className="fixed top-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-emerald-300/40 bg-emerald-950/95 px-3 py-2 text-sm text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.28)] md:max-w-xl">
            {successMessage}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="fixed top-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-rose-300/40 bg-rose-950/95 px-3 py-2 text-sm text-rose-100 shadow-[0_0_20px_rgba(251,113,133,0.25)] md:max-w-xl">
            {errorMessage}
          </div>
        ) : null}

        <div className="no-scrollbar mx-auto flex w-full max-w-md flex-col flex-1 space-y-5 overflow-y-auto px-6 pt-2 pb-28 md:max-w-3xl md:px-8 lg:max-w-4xl">
          <div className="mb-6 space-y-2 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Student ID
              <br />
              <span className="text-[#ffbf00]">Profile</span>
            </h1>
            <p className="font-mono text-sm tracking-wide text-gray-400">
              Review and edit your cyber-student profile and academic history.
            </p>
          </div>

          {/* Desktop: card + enrollments side by side */}
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-8">
            {/* Left column: ID card + edit button */}
            <div className="flex flex-col gap-5 md:w-1/2 md:max-w-md">
              <CyberIdCard profile={profile} />

              <button
                type="button"
                onClick={openEditDialog}
                className="group flex w-full items-center justify-center gap-2 rounded-full border border-[#ffbf00]/60 bg-[#ffbf00]/15 px-6 py-3 text-sm font-bold tracking-wide text-[#ffbf00] transition-all hover:bg-[#ffbf00]/24 active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
                Edit Profile
              </button>
            </div>

            {/* Right column: recent enrollments */}
            <section className="relative flex-1 overflow-hidden rounded-2xl border border-[#ffbf00]/30 bg-[#141414] p-4">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,191,0,0.08),transparent)]" />
              <div className="relative z-10">
                <div className="mb-3 flex items-center justify-between border-b border-dashed border-white/10 pb-2">
                  <h2 className="text-base font-bold text-white">Recent Enrollments</h2>
                  <span className="font-mono text-xs tracking-wider text-[#ffbf00]/80 uppercase">Transcript</span>
                </div>

                <div className="space-y-2">
                  {recentMatches.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-700 bg-black/30 px-3 py-4 text-center text-sm text-zinc-400">
                      No enrollments yet.
                    </div>
                  ) : (
                    recentMatches.map((match) => (
                      <article
                        key={match.id}
                        className="rounded-xl border border-zinc-700/70 bg-black/40 px-3 py-2"
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <p className="font-mono text-xs tracking-wider text-[#ffbf00] uppercase">
                            {match.course_id ?? "UNKNOWN"}
                          </p>
                          <p className="font-mono text-[11px] text-zinc-400">{formatDate(match.created_at)}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="font-mono text-[11px] text-zinc-500">Record #{match.id.slice(0, 8)}</p>
                          <span className="rounded border border-[#ffbf00]/30 bg-[#ffbf00]/10 px-2 py-0.5 text-[11px] text-amber-200">
                            {formatStatus(match.status)}
                          </span>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden border-[#ffbf00]/30 bg-zinc-900 text-white shadow-[0_0_30px_rgba(255,191,0,0.2)] sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-white">Edit Profile</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Update your student card details and avatar photo.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pt-4">
            <div className="group/input">
              <label
                htmlFor="profile-display-name"
                className="mb-2 ml-1 block font-mono text-xs tracking-wider text-[#ffbf00]/80"
              >
                FULL NAME
              </label>
              <div className="relative flex items-center">
                <input
                  id="profile-display-name"
                  {...register("display_name")}
                  onChange={(event) => {
                    setValue(
                      "display_name",
                      sanitizeInlineTextInput(event.target.value),
                      { shouldDirty: true, shouldValidate: true },
                    );
                  }}
                  placeholder="Ex: Alex Reynolds"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/20 focus:border-[#ffbf00] focus:ring-1 focus:ring-[#ffbf00]/50 focus:outline-none"
                />
                <span className="material-symbols-outlined absolute right-4 text-white/20 transition-colors group-focus-within/input:text-[#ffbf00]">
                  badge
                </span>
              </div>
              {errors.display_name?.message ? (
                <p className="mt-1 text-xs text-rose-300">
                  {errors.display_name.message}
                </p>
              ) : null}
            </div>

            <div className="group/input">
              <label
                htmlFor="profile-department"
                className="mb-2 ml-1 block font-mono text-xs tracking-wider text-[#ffbf00]/80"
              >
                DEPARTMENT
              </label>
              <div className="relative flex items-center">
                <input
                  id="profile-department"
                  {...register("department")}
                  onChange={(event) => {
                    setValue(
                      "department",
                      sanitizeInlineTextInput(event.target.value),
                      { shouldDirty: true, shouldValidate: true },
                    );
                  }}
                  placeholder="Ex: Computer Science"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/20 focus:border-[#ffbf00] focus:ring-1 focus:ring-[#ffbf00]/50 focus:outline-none"
                />
                <span className="material-symbols-outlined absolute right-4 text-white/20 transition-colors group-focus-within/input:text-[#ffbf00]">
                  school
                </span>
              </div>
              {errors.department?.message ? (
                <p className="mt-1 text-xs text-rose-300">
                  {errors.department.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <p className="font-mono text-xs tracking-wider text-[#ffbf00]/70 uppercase">
                Profile Image
              </p>
              <AvatarUpload
                userId={userId}
              csrfToken={csrfToken}
                initialAvatarUrl={profile.avatar_url}
                onUploaded={(avatarUrl) => {
                  setProfile((prev) => ({ ...prev, avatar_url: avatarUrl }));
                  setSuccessMessage("Avatar updated.");
                  showToast("Avatar updated.", "success");
                }}
              />
            </div>

            <div className="flex gap-2 pb-1 pt-2">
              <button
                type="button"
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-800"
                onClick={() => setOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="w-full rounded-md border border-[#ffbf00]/50 bg-[#ffbf00]/20 px-4 py-2.5 text-sm font-semibold text-[#ffbf00] transition-colors hover:bg-[#ffbf00]/30 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleSaveProfile}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
