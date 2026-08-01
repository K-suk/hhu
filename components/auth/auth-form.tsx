"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { loginAction, signUpAction } from "@/app/login/actions";
import { DEFAULT_MIN_AGE, calculateAge } from "@/lib/auth/age-gate";
import { sanitizeInlineTextInput } from "@/lib/client/security-ui";
import {
  INITIAL_AUTH_STATE,
  birthDateSchema,
  loginSchema,
  signUpSchema,
  universityEmailSchema,
} from "@/lib/validations/auth";
import { getFriendlyErrorMessage } from "@/lib/client/security-ui";

type UniversityAgeResponse = {
  isKnown: boolean;
  minAge: number;
};

type UniversityLookupStatus = "idle" | "loading" | "success" | "error";

const UNIVERSITY_REQUEST_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSf4Wr6LYZBPsi1dCSGXrxtD39Wfw69_Kg_dQN_NrEiH0PSGUA/viewform?usp=publish-editor";

function getAuthMode(value: string | null): "login" | "signup" {
  return value === "signup" ? "signup" : "login";
}

type AuthFormValues = {
  birth_date: string;
  email: string;
  password: string;
};

const authFormSchema = z.object({
  birth_date: birthDateSchema.or(z.literal("")),
  email: universityEmailSchema,
  password: z.string().min(1, "Password is required."),
});

function extractDomainCandidate(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");

  if (atIndex < 0 || atIndex === normalized.length - 1) {
    return null;
  }

  const domain = normalized.slice(atIndex + 1);
  if (!domain || domain.includes(" ")) {
    return null;
  }

  return domain;
}

function SubmitButton({
  mode,
}: {
  mode: "login" | "signup";
}) {
  const { pending } = useFormStatus();
  const label = mode === "login" ? "ENTER" : "ENROLL";

  return (
    <button
      type="submit"
      disabled={pending}
      aria-describedby={mode === "signup" ? "signup-requirements" : undefined}
      className="group/btn relative mt-4 w-full overflow-hidden rounded-full bg-primary-amber p-[1px] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-1000 group-hover/btn:translate-x-[100%]" />
      <div className="relative flex h-14 w-full items-center justify-center rounded-full border border-primary-amber/50 bg-background-dark/90 text-primary-amber transition-all group-hover/btn:bg-primary-amber group-hover/btn:text-background-dark">
        <span className="mr-2 text-lg font-bold uppercase tracking-widest">
          {pending ? "PROCESSING..." : label}
        </span>
        {!pending && (
          <span
            className="material-symbols-outlined transition-transform group-hover/btn:translate-x-1"
            aria-hidden="true"
          >
            login
          </span>
        )}
      </div>
    </button>
  );
}

export function AuthForm() {
  const searchParams = useSearchParams();
  const requestedMode = getAuthMode(searchParams.get("mode"));
  const [mode, setMode] = useState<"login" | "signup">(requestedMode);
  const [requiredMinAge, setRequiredMinAge] = useState(DEFAULT_MIN_AGE);
  const [isKnownUniversityDomain, setIsKnownUniversityDomain] = useState(false);
  const [universityLookupStatus, setUniversityLookupStatus] =
    useState<UniversityLookupStatus>("idle");
  const [universityLookupAttempt, setUniversityLookupAttempt] = useState(0);
  const [hasAgreedToCompliance, setHasAgreedToCompliance] = useState(false);
  const [hasAttemptedInvalidSignUp, setHasAttemptedInvalidSignUp] =
    useState(false);
  const [loginState, loginFormAction] = useActionState(
    loginAction,
    INITIAL_AUTH_STATE,
  );
  const [signUpState, signUpFormAction] = useActionState(
    signUpAction,
    INITIAL_AUTH_STATE,
  );
  const {
    control,
    formState: { errors },
    getValues,
    register,
    setValue,
    trigger,
  } = useForm<AuthFormValues>({
    defaultValues: {
      birth_date: "",
      email: "",
      password: "",
    },
    mode: "onChange",
    resolver: zodResolver(authFormSchema),
  });

  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const monthInputRef = useRef<HTMLInputElement>(null);
  const dayInputRef = useRef<HTMLInputElement>(null);

  const state = mode === "login" ? loginState : signUpState;
  const formAction = mode === "login" ? loginFormAction : signUpFormAction;
  const watchedEmail = useWatch({ control, name: "email" }) ?? "";
  const watchedBirthDate = useWatch({ control, name: "birth_date" }) ?? "";
  const age = calculateAge(watchedBirthDate);
  const isUnderAge = mode === "signup" && age !== null && age < requiredMinAge;
  const hasValidAgeForSignUp =
    mode === "signup" && age !== null && age >= requiredMinAge;
  const emailDomain = extractDomainCandidate(watchedEmail);
  const hasDomainInput = emailDomain !== null;
  const canSubmitSignUp =
    isKnownUniversityDomain && hasValidAgeForSignUp && hasAgreedToCompliance;
  const signUpBlockReason = !hasDomainInput
    ? "Enter your university email, date of birth, and confirm the terms to continue."
    : universityLookupStatus === "loading"
      ? "Checking whether your university is supported..."
      : universityLookupStatus === "error"
        ? "We could not verify your university. Check your connection and try again."
        : !isKnownUniversityDomain
          ? "Use a supported university email or request to add your university."
          : age === null
            ? "Enter your complete date of birth to continue."
            : isUnderAge
              ? `You must be ${requiredMinAge}+ to join HHU.`
              : !hasAgreedToCompliance
                ? "Confirm your age and agreement to the terms to continue."
                : null;

  useEffect(() => {
    const isComplete =
      birthYear.length === 4 && birthMonth.length >= 1 && birthDay.length >= 1;
    const value = isComplete
      ? `${birthYear}-${birthMonth.padStart(2, "0")}-${birthDay.padStart(2, "0")}`
      : "";
    setValue("birth_date", value, { shouldValidate: isComplete });
  }, [birthYear, birthMonth, birthDay, setValue]);

  useEffect(() => {
    if (mode !== "signup") {
      return;
    }

    const domain = extractDomainCandidate(watchedEmail);
    if (!domain) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setUniversityLookupStatus("loading");
      void fetch(`/api/university-age?domain=${encodeURIComponent(domain)}`, {
        method: "GET",
        signal: controller.signal,
        cache: "no-store",
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Failed to fetch university age policy.");
          }

          const payload = (await response.json()) as UniversityAgeResponse;
          setIsKnownUniversityDomain(payload.isKnown);
          setRequiredMinAge(payload.minAge);
          setUniversityLookupStatus("success");
        })
        .catch(() => {
          if (controller.signal.aborted) {
            return;
          }

          setIsKnownUniversityDomain(false);
          setRequiredMinAge(DEFAULT_MIN_AGE);
          setUniversityLookupStatus("error");
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [mode, universityLookupAttempt, watchedEmail]);

  async function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    const values = {
      birth_date: watchedBirthDate,
      email: watchedEmail,
      password: getValues("password"),
    };
    const parsed =
      mode === "login"
        ? loginSchema.safeParse(values)
        : signUpSchema.safeParse(values);

    if (!parsed.success) {
      event.preventDefault();
      await trigger();
      return;
    }

    if (mode === "signup" && !canSubmitSignUp) {
      event.preventDefault();
      setHasAttemptedInvalidSignUp(true);
    }
  }

  function toggleAuthMode() {
    setMode(mode === "login" ? "signup" : "login");
    setHasAttemptedInvalidSignUp(false);
  }

  return (
    <div className="relative w-full overflow-hidden rounded-[2rem] border border-primary-amber/10 bg-stone-900/60 p-6 shadow-2xl backdrop-blur-xl">
      {/* Corner accents */}
      <div className="absolute left-0 top-0 h-8 w-8 rounded-tl-[2rem] border-l-2 border-t-2 border-primary-amber/40" />
      <div className="absolute right-0 top-0 h-8 w-8 rounded-tr-[2rem] border-r-2 border-t-2 border-primary-amber/40" />
      <div className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-[2rem] border-b-2 border-l-2 border-primary-amber/40" />
      <div className="absolute bottom-0 right-0 h-8 w-8 rounded-br-[2rem] border-b-2 border-r-2 border-primary-amber/40" />

      <h2 className="mb-6 text-center text-xl font-bold tracking-wide text-white">
        {mode === "login" ? "THE ENTRANCE" : "THE GUESTLIST"}
      </h2>
      {mode === "signup" ? (
        <p className="-mt-3 mb-6 text-center text-xs text-slate-400">
          HHU is a strict 19+ community for university students.
        </p>
      ) : null}

      <form
        action={formAction}
        className="flex flex-col gap-5"
        onSubmit={(event) => void handleFormSubmit(event)}
      >
        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="auth-email"
            className="pl-4 font-mono text-xs uppercase tracking-wider text-primary-amber/80"
          >
            Student Email
          </label>
          <div className="relative flex items-center">
            <span
              className="material-symbols-outlined absolute left-4 text-slate-400"
              aria-hidden="true"
            >
              badge
            </span>
            <input
              {...register("email")}
              id="auth-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder={
                mode === "signup" ? "your student email" : "student email"
              }
              required
              aria-invalid={Boolean(errors.email || state.fieldErrors?.email?.[0])}
              aria-describedby={
                errors.email?.message || state.fieldErrors?.email?.[0]
                  ? "auth-email-error"
                  : undefined
              }
              onChange={(event) => {
                const nextEmail = sanitizeInlineTextInput(
                  event.target.value.toLowerCase(),
                );
                event.target.value = nextEmail;
                setValue(
                  "email",
                  nextEmail,
                  { shouldDirty: true, shouldValidate: true },
                );
                setIsKnownUniversityDomain(false);
                setUniversityLookupStatus(
                  extractDomainCandidate(nextEmail) ? "loading" : "idle",
                );
                setHasAttemptedInvalidSignUp(false);
              }}
              className="w-full rounded-full border border-white/10 bg-black/40 py-4 pl-12 pr-4 font-mono text-white outline-none placeholder:text-slate-600 transition-all focus:border-primary-amber/50 focus:bg-black/60 focus:ring-1 focus:ring-primary-amber/50"
            />
          </div>
          {errors.email?.message || state.fieldErrors?.email?.[0] ? (
            <p id="auth-email-error" className="pl-4 text-xs text-rose-400" role="alert">
              {errors.email?.message ?? state.fieldErrors?.email?.[0]}
            </p>
          ) : null}
        </div>

        {mode === "signup" ? (
          <div className="flex flex-col gap-1.5">
            <p
              id="birth-date-label"
              className="pl-4 font-mono text-xs uppercase tracking-wider text-primary-amber/80"
            >
              Date Of Birth
            </p>
            <div
              role="group"
              aria-labelledby="birth-date-label"
              aria-describedby={
                errors.birth_date?.message || state.fieldErrors?.birth_date?.[0]
                  ? "birth-date-error"
                  : undefined
              }
              className="relative flex w-full items-center rounded-full border border-white/10 bg-black/40 py-1.5 pl-12 pr-4 transition-all focus-within:border-primary-amber/50 focus-within:bg-black/60 focus-within:ring-1 focus-within:ring-primary-amber/50"
            >
              <span
                className="material-symbols-outlined absolute left-4 text-slate-400"
                aria-hidden="true"
              >
                cake
              </span>
              <input {...register("birth_date")} type="hidden" />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                placeholder="YYYY"
                aria-label="Birth year"
                autoComplete="bday-year"
                value={birthYear}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setBirthYear(val);
                  setHasAttemptedInvalidSignUp(false);
                  if (val.length === 4) monthInputRef.current?.focus();
                }}
                className="min-h-11 w-16 bg-transparent font-mono text-center text-white outline-none placeholder:text-slate-600"
              />
              <span className="px-1 font-mono text-slate-500">—</span>
              <input
                ref={monthInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                placeholder="MM"
                aria-label="Birth month"
                autoComplete="bday-month"
                value={birthMonth}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 2);
                  setBirthMonth(val);
                  setHasAttemptedInvalidSignUp(false);
                  if (val.length === 2) dayInputRef.current?.focus();
                }}
                className="min-h-11 w-12 bg-transparent font-mono text-center text-white outline-none placeholder:text-slate-600"
              />
              <span className="px-1 font-mono text-slate-500">—</span>
              <input
                ref={dayInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                placeholder="DD"
                aria-label="Birth day"
                autoComplete="bday-day"
                value={birthDay}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 2);
                  setBirthDay(val);
                  setHasAttemptedInvalidSignUp(false);
                }}
                className="min-h-11 w-12 bg-transparent font-mono text-center text-white outline-none placeholder:text-slate-600"
              />
            </div>
            {errors.birth_date?.message || state.fieldErrors?.birth_date?.[0] ? (
              <p id="birth-date-error" className="pl-4 text-xs text-rose-400" role="alert">
                {errors.birth_date?.message ?? state.fieldErrors?.birth_date?.[0]}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="auth-password"
            className="pl-4 font-mono text-xs uppercase tracking-wider text-primary-amber/80"
          >
            Password
          </label>
          <div className="relative flex items-center">
            <span
              className="material-symbols-outlined absolute left-4 text-slate-400"
              aria-hidden="true"
            >
              password
            </span>
            <input
              {...register("password")}
              id="auth-password"
              name="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              placeholder="••••••••"
              required
              aria-invalid={Boolean(
                errors.password || state.fieldErrors?.password?.[0],
              )}
              aria-describedby={
                errors.password?.message || state.fieldErrors?.password?.[0]
                  ? "auth-password-error"
                  : mode === "signup"
                    ? "auth-password-help"
                    : undefined
              }
              className="w-full rounded-full border border-white/10 bg-black/40 py-4 pl-12 pr-4 font-mono text-white outline-none placeholder:text-slate-600 transition-all focus:border-primary-amber/50 focus:bg-black/60 focus:ring-1 focus:ring-primary-amber/50"
            />
          </div>
          {errors.password?.message || state.fieldErrors?.password?.[0] ? (
            <p id="auth-password-error" className="pl-4 text-xs text-rose-400" role="alert">
              {errors.password?.message ?? state.fieldErrors?.password?.[0]}
            </p>
          ) : null}
          {mode === "signup" && !errors.password?.message ? (
            <p id="auth-password-help" className="pl-4 text-xs text-slate-500">
              Use at least 8 characters.
            </p>
          ) : null}
        </div>

        {/* Status message */}
        {state.message ? (
          <p
            role={state.status === "error" ? "alert" : "status"}
            className={`rounded-xl border px-4 py-2.5 text-xs ${state.status === "error"
              ? "border-rose-400/30 bg-rose-950/40 text-rose-300"
              : "border-emerald-400/30 bg-emerald-950/40 text-emerald-300"
              }`}
          >
            {getFriendlyErrorMessage(state.message)}
          </p>
        ) : null}

        {mode === "signup" ? (
          <div className="pl-4 text-xs text-slate-500">
            <p>Sign-up is restricted to student emails.</p>
            <div className="mt-1 flex min-h-11 items-center gap-1 text-[11px] text-slate-400">
              <span
                className="material-symbols-outlined text-[14px] text-slate-500"
                aria-hidden="true"
              >
                school
              </span>
              <Link
                href={UNIVERSITY_REQUEST_FORM_URL}
                target="_blank"
                rel="noreferrer"
                className="decoration-primary-amber/70 underline-offset-2 hover:text-primary-amber"
              >
                Your university not listed? Request to add it here.
              </Link>
            </div>
          </div>
        ) : null}

        {mode === "signup" && hasDomainInput && isKnownUniversityDomain ? (
          <p className="pl-4 text-xs text-slate-400">
            Required age for your university: {requiredMinAge}+
          </p>
        ) : null}

        {mode === "signup" &&
        hasDomainInput &&
        universityLookupStatus === "success" &&
        !isKnownUniversityDomain ? (
          <p className="pl-4 text-xs text-rose-400">
            This university domain is not yet supported. Use the link above to
            request adding your university.
          </p>
        ) : null}

        {mode === "signup" && universityLookupStatus === "error" ? (
          <div className="flex items-center justify-between gap-3 pl-4">
            <p id="signup-requirements" className="text-xs text-amber-300" role="alert">
              We could not verify your university domain. Check your connection and try again.
            </p>
            <button
              type="button"
              onClick={() => {
                setUniversityLookupStatus("loading");
                setUniversityLookupAttempt((attempt) => attempt + 1);
              }}
              className="min-h-11 shrink-0 rounded-full border border-amber-300/30 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-300/10"
            >
              Try again
            </button>
          </div>
        ) : null}

        {mode === "signup" && universityLookupStatus !== "error" ? (
          <div className="flex min-h-11 items-start gap-3 rounded-lg pl-4">
            <input
              id="compliance"
              type="checkbox"
              checked={hasAgreedToCompliance}
              onChange={(event) => {
                setHasAgreedToCompliance(event.target.checked);
                if (event.target.checked) {
                  setHasAttemptedInvalidSignUp(false);
                }
              }}
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-white/30 bg-black/40 text-primary-amber focus:ring-primary-amber/60"
            />
            <label htmlFor="compliance" className="cursor-pointer text-sm leading-5 text-slate-300">
              I confirm that I am {requiredMinAge}+ and agree to the{" "}
              <Link href="/terms" className="text-blue-400 underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-blue-400 underline">
                Privacy Policy
              </Link>
              .
            </label>
          </div>
        ) : null}

        {mode === "signup" ? (
          <p
            id="signup-requirements"
            className={`pl-4 text-xs ${
              signUpBlockReason
                ? hasAttemptedInvalidSignUp
                  ? "text-rose-400"
                  : "text-slate-400"
                : "text-emerald-300"
            }`}
            role={hasAttemptedInvalidSignUp ? "alert" : "status"}
          >
            {signUpBlockReason ?? "You're ready to create your HHU account."}
          </p>
        ) : null}

        <SubmitButton mode={mode} />
      </form>

      {/* Divider */}
      <div className="relative my-6 h-px w-full bg-white/10">
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-stone-900/80 px-2 font-mono text-xs text-slate-500">
          OR
        </span>
      </div>

      {/* Toggle login / signup */}
      <div className="text-center">
        <p className="text-sm text-slate-400 mr-4">
          {mode === "login" ? "New Student?" : "Already enrolled?"}
          <button
            type="button"
            onClick={toggleAuthMode}
            className="ml-1 inline-flex min-h-11 items-center rounded-md px-1 font-bold text-primary-amber decoration-primary-amber decoration-2 underline-offset-4 hover:underline"
          >
            {mode === "login" ? "Sign up" : "Enter Here"}
          </button>
        </p>
      </div>
    </div>
  );
}
