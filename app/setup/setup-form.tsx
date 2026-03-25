"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Controller, useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { completeSetupAction } from "@/app/setup/actions";
import { AvatarUpload } from "@/components/profile/avatar-upload";
import {
  getFriendlyErrorMessage,
  sanitizeInlineTextInput,
  sanitizePlainTextInput,
} from "@/lib/client/security-ui";
import { CSRF_FORM_FIELD_NAME } from "@/lib/security/csrf-shared";
import { getCsrfToken } from "@/lib/security/csrf-client";
import {
  genderIdentityOptions,
  INITIAL_SETUP_PROFILE_STATE,
  setupProfileSchema,
  type SetupProfileInput,
} from "@/lib/validations/matching";

type SetupFormProps = {
  userId: string;
  initialAvatarUrl: string | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="group flex w-full items-center justify-center gap-2 rounded-full bg-[#ffbf00] px-6 py-4 text-base font-bold text-black shadow-[0_0_20px_rgba(255,191,0,0.4)] transition-all hover:bg-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
    >
      <span>{pending ? "Minting..." : "MINT IDENTITY"}</span>
      <span className="material-symbols-outlined text-[20px] transition-transform group-hover:translate-x-1">
        arrow_forward
      </span>
    </button>
  );
}

type GenderIdentityFieldProps = {
  control: Control<SetupProfileInput>;
  onPreviewUpdate: (uppercaseLabel: string) => void;
};

function GenderIdentityField({ control, onPreviewUpdate }: GenderIdentityFieldProps) {
  const { pending } = useFormStatus();

  return (
    <Controller
      control={control}
      name="gender_identity"
      render={({ field }) => (
        <>
          <input type="hidden" name="gender_identity" value={field.value ?? ""} />
          <div
            role="listbox"
            aria-labelledby="setup-gender-identity-label"
            className="grid gap-2"
          >
            {genderIdentityOptions.map((option) => {
              const selected = field.value === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={pending}
                  onClick={() => {
                    field.onChange(option);
                    onPreviewUpdate(option.toUpperCase());
                  }}
                  className={`w-full rounded-xl border px-4 py-3.5 text-left text-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    selected
                      ? "border-[#ffbf00]/80 bg-[#ffbf00]/15 text-[#ffbf00] shadow-[0_0_14px_rgba(255,191,0,0.25)] ring-1 ring-[#ffbf00]/40"
                      : "border-white/10 bg-white/5 text-white hover:border-[#ffbf00]/35 hover:bg-white/[0.08]"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </>
      )}
    />
  );
}

export function SetupForm({ userId, initialAvatarUrl }: SetupFormProps) {
  const [state, formAction] = useActionState(
    completeSetupAction,
    INITIAL_SETUP_PROFILE_STATE,
  );
  const [toast, setToast] = useState("");
  const [displayNamePreview, setDisplayNamePreview] = useState("J. DOE");
  const [departmentPreview, setDepartmentPreview] = useState("UNDECLARED");
  const [genderPreview, setGenderPreview] = useState("UNSET");
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(
    initialAvatarUrl,
  );
  const [csrfToken, setCsrfToken] = useState("");
  const {
    control,
    formState: { errors },
    register,
    setValue,
    trigger,
  } = useForm<SetupProfileInput>({
    defaultValues: {
      department: "",
      display_name: "",
      gender_identity: undefined as never,
    },
    mode: "onChange",
    resolver: zodResolver(setupProfileSchema),
  });

  useEffect(() => {
    if (state.status === "error" && state.message) {
      setToast(getFriendlyErrorMessage(state.message));
    }
  }, [state]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    let isMounted = true;

    void getCsrfToken()
      .then((token) => {
        if (isMounted) {
          setCsrfToken(token);
        }
      })
      .catch(() => {
        if (isMounted) {
          setToast("Security token bootstrap failed. Refresh and try again.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const isValid = await trigger();

    if (!isValid) {
      event.preventDefault();
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1f3a2f_0%,#111_35%,#000_100%)] font-display text-white">
      <div className="mx-auto pt-[24px] flex min-h-screen w-full max-w-md flex-col overflow-hidden bg-black shadow-2xl md:my-4 md:min-h-[calc(100vh-2rem)] md:max-w-4xl md:rounded-3xl md:border md:border-white/10 lg:max-w-5xl">
        {toast ? (
          <div className="fixed left-1/2 top-4 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-rose-300/40 bg-rose-950/95 px-3 py-2 text-sm text-rose-100 shadow-[0_0_20px_rgba(251,113,133,0.25)] md:max-w-xl">
            {toast}
          </div>
        ) : null}

        <form
          action={formAction}
          className="flex flex-1 flex-col"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <input type="hidden" name={CSRF_FORM_FIELD_NAME} value={csrfToken} />
          <div className="no-scrollbar mx-auto flex w-full max-w-md flex-col flex-1 space-y-5 overflow-y-auto px-6 pt-2 pb-28 md:max-w-2xl md:px-8 lg:max-w-3xl">
            <div className="mb-6 space-y-2 text-center">
              <h1 className="text-3xl font-bold tracking-tight text-white">
                Student ID
                <br />
                <span className="text-[#ffbf00]">Registration</span>
              </h1>
              <p className="font-mono text-sm tracking-wide text-gray-400">
                Initialize your cyber-student profile to access the HHU
                network.
              </p>
            </div>

            <div className="relative mb-7 aspect-[1.586/1] w-full">
              <div className="absolute inset-0 overflow-hidden rounded-2xl border-2 border-[#ffbf00]/50 bg-[#1a1614] bg-[radial-gradient(circle_at_85%_90%,rgba(199,140,56,0.25)_0%,rgba(199,140,56,0.08)_40%,transparent_70%),linear-gradient(120deg,rgba(255,191,0,0.05)_0%,rgba(255,191,0,0.18)_50%,rgba(255,191,0,0.03)_100%)] shadow-[0_0_10px_rgba(255,191,0,0.3),inset_0_0_20px_rgba(255,191,0,0.1)]">
                <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_1px,rgba(255,191,0,0.08)_2px,rgba(255,191,0,0.08)_3px)] opacity-40" />

                <div className="relative z-10 flex h-full flex-col justify-between p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col">
                      <span className="mb-0.5 font-mono text-[10px] tracking-widest text-[#ffbf00]/80">
                        HHU
                      </span>
                      <h3 className="text-lg leading-none font-bold text-white">
                        STUDENT ID
                      </h3>
                    </div>
                    <div className="flex size-8 items-center justify-center rounded border border-[#ffbf00]/30 bg-black/40">
                      <span className="material-symbols-outlined text-lg text-[#ffbf00]">
                        local_bar
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-4">
                    <div className="relative size-20 shrink-0 overflow-hidden rounded border border-[#ffbf00]/40 bg-black/60">
                      <div className="absolute inset-0 z-10 bg-[repeating-linear-gradient(0deg,transparent,transparent_1px,rgba(255,191,0,0.1)_2px,rgba(255,191,0,0.1)_3px)] opacity-60" />
                      {avatarPreviewUrl ? (
                        <img
                          src={avatarPreviewUrl}
                          alt="Student avatar preview"
                          className="h-full w-full object-cover [image-rendering:pixelated]"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center text-[#ffbf00]/40">
                          <span className="material-symbols-outlined mb-1 text-2xl">
                            face
                          </span>
                          <span className="font-mono text-center text-[8px] leading-tight">
                            AVATAR
                            <br />
                            PENDING
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-2 font-mono">
                      <div>
                        <p className="mb-0.5 text-[8px] tracking-wider text-[#ffbf00]/60 uppercase">
                          Name
                        </p>
                        <p className="truncate text-sm font-medium tracking-wide text-white uppercase">
                          {displayNamePreview}
                        </p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-[8px] tracking-wider text-[#ffbf00]/60 uppercase">
                          Department
                        </p>
                        <p className="truncate text-xs text-gray-300 uppercase">
                          {departmentPreview}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto flex items-end justify-between border-t border-white/5 pt-2">
                    <div className="flex flex-col">
                      <span className="mb-0.5 text-[8px] text-[#ffbf00]/60 uppercase">
                        Identity
                      </span>
                      <span className="font-mono text-xs tracking-widest text-white">
                        {genderPreview}
                      </span>
                    </div>
                    <div className="h-6 w-24 bg-white/20 [mask-image:repeating-linear-gradient(90deg,black,black_2px,transparent_2px,transparent_4px,black_4px,black_5px,transparent_5px,transparent_7px)]" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="group/input">
                <label
                  htmlFor="display_name"
                  className="mb-2 ml-1 block font-mono text-xs tracking-wider text-[#ffbf00]/80"
                >
                  FULL NAME <span className="text-rose-400/80">*</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    {...register("display_name")}
                    id="display_name"
                    name="display_name"
                    autoComplete="nickname"
                    placeholder="Ex: Arnold Schwarzenegger"
                    required
                    onChange={(event) => {
                      const value = sanitizeInlineTextInput(event.target.value);
                      setValue("display_name", value, { shouldDirty: true, shouldValidate: true });
                      setDisplayNamePreview(
                        sanitizePlainTextInput(value).toUpperCase() || "J. DOE",
                      );
                    }}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-lg text-white placeholder:text-white/20 focus:border-[#ffbf00] focus:ring-1 focus:ring-[#ffbf00]/50 focus:outline-none"
                  />
                  <span className="material-symbols-outlined absolute right-4 text-white/20 transition-colors group-focus-within/input:text-[#ffbf00]">
                    badge
                  </span>
                </div>
                {errors.display_name?.message || state.fieldErrors?.display_name?.[0] ? (
                  <p className="mt-1 text-xs text-rose-300">
                    {errors.display_name?.message ?? state.fieldErrors?.display_name?.[0]}
                  </p>
                ) : null}
              </div>

              <div className="group/input">
                <label
                  htmlFor="department"
                  className="mb-2 ml-1 block font-mono text-xs tracking-wider text-[#ffbf00]/80"
                >
                  DEPARTMENT <span className="text-rose-400/80">*</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    {...register("department")}
                    id="department"
                    name="department"
                    placeholder="Ex: BEER SCIENCE"
                    required
                    onChange={(event) => {
                      const value = sanitizeInlineTextInput(event.target.value);
                      setValue("department", value, { shouldDirty: true, shouldValidate: true });
                      setDepartmentPreview(
                        sanitizePlainTextInput(value).toUpperCase() || "UNDECLARED",
                      );
                    }}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-lg text-white placeholder:text-white/20 focus:border-[#ffbf00] focus:ring-1 focus:ring-[#ffbf00]/50 focus:outline-none"
                  />
                  <span className="material-symbols-outlined absolute right-4 text-white/20 transition-colors group-focus-within/input:text-[#ffbf00]">
                    school
                  </span>
                </div>
                {errors.department?.message || state.fieldErrors?.department?.[0] ? (
                  <p className="mt-1 text-xs text-rose-300">
                    {errors.department?.message ?? state.fieldErrors?.department?.[0]}
                  </p>
                ) : null}
              </div>

              <div className="group/input">
                <p
                  id="setup-gender-identity-label"
                  className="mb-2 ml-1 block font-mono text-xs tracking-wider text-[#ffbf00]/80"
                >
                  GENDER IDENTITY <span className="text-rose-400/80">*</span>
                </p>
                <GenderIdentityField
                  control={control}
                  onPreviewUpdate={(label) => setGenderPreview(label)}
                />
                {errors.gender_identity?.message || state.fieldErrors?.gender_identity?.[0] ? (
                  <p className="mt-1 text-xs text-rose-300">
                    {errors.gender_identity?.message ?? state.fieldErrors?.gender_identity?.[0]}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2 pb-2">
              <p className="font-mono text-xs tracking-wider text-[#ffbf00]/70 uppercase">
                Profile Image
              </p>
              <AvatarUpload
                userId={userId}
                csrfToken={csrfToken}
                initialAvatarUrl={avatarPreviewUrl}
                onUploaded={(url) => setAvatarPreviewUrl(url)}
              />
              <p className="font-mono text-xs text-zinc-500">
                Upload is saved immediately to your student profile.
              </p>
            </div>
          </div>

          <div className="fixed right-0 bottom-0 left-0 z-50 mx-auto w-full max-w-md bg-gradient-to-t from-black via-black to-transparent p-6 md:max-w-4xl lg:max-w-5xl">
            <div className="mx-auto w-full max-w-md md:max-w-lg">
              <SubmitButton />
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
