"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useForm } from "react-hook-form";
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
  disabled,
}: {
  mode: "login" | "signup";
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const label = mode === "login" ? "ENTER" : "ENROLL";
  const isDisabled = pending || disabled;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      className="group/btn relative mt-4 w-full overflow-hidden rounded-full bg-primary-amber p-[1px] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-1000 group-hover/btn:translate-x-[100%]" />
      <div className="relative flex h-14 w-full items-center justify-center rounded-full border border-primary-amber/50 bg-background-dark/90 text-primary-amber transition-all group-hover/btn:bg-primary-amber group-hover/btn:text-background-dark">
        <span className="mr-2 text-lg font-bold uppercase tracking-widest">
          {pending ? "PROCESSING..." : label}
        </span>
        {!pending && (
          <span className="material-symbols-outlined transition-transform group-hover/btn:translate-x-1">
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
    formState: { errors },
    register,
    setValue,
    trigger,
    watch,
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
  const watchedEmail = watch("email");
  const watchedBirthDate = watch("birth_date");
  const age = calculateAge(watchedBirthDate);
  const isUnderAge = mode === "signup" && age !== null && age < requiredMinAge;
  const hasValidAgeForSignUp =
    mode === "signup" && age !== null && age >= requiredMinAge;
  const emailDomain = extractDomainCandidate(watchedEmail);
  const hasDomainInput = emailDomain !== null;
  const canSubmitSignUp =
    isKnownUniversityDomain && hasValidAgeForSignUp && hasAgreedToCompliance;

  useEffect(() => {
    setMode(requestedMode);
  }, [requestedMode]);

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
      setIsKnownUniversityDomain(false);
      setRequiredMinAge(DEFAULT_MIN_AGE);
      setUniversityLookupStatus("idle");
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
          setIsKnownUniversityDomain(false);
          setRequiredMinAge(DEFAULT_MIN_AGE);
          setUniversityLookupStatus("error");
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [mode, watchedEmail]);

  async function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    const values = {
      birth_date: watchedBirthDate,
      email: watchedEmail,
      password: watch("password"),
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
          <label className="pl-4 font-mono text-xs uppercase tracking-wider text-primary-amber/80">
            Student Email
          </label>
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-4 text-slate-400">
              badge
            </span>
            <input
              {...register("email")}
              name="email"
              type="email"
              autoComplete="email"
              placeholder={
                mode === "signup" ? "you student email" : "student email"
              }
              required
              onChange={(event) => {
                event.target.value = sanitizeInlineTextInput(
                  event.target.value.toLowerCase(),
                );
              }}
              className="w-full rounded-full border border-white/10 bg-black/40 py-4 pl-12 pr-4 font-mono text-white outline-none placeholder:text-slate-600 transition-all focus:border-primary-amber/50 focus:bg-black/60 focus:ring-1 focus:ring-primary-amber/50"
            />
          </div>
          {errors.email?.message || state.fieldErrors?.email?.[0] ? (
            <p className="pl-4 text-xs text-rose-400">
              {errors.email?.message ?? state.fieldErrors?.email?.[0]}
            </p>
          ) : null}
        </div>

        {mode === "signup" ? (
          <div className="flex flex-col gap-1.5">
            <label className="pl-4 font-mono text-xs uppercase tracking-wider text-primary-amber/80">
              Date Of Birth
            </label>
            <div className="relative flex w-full items-center rounded-full border border-white/10 bg-black/40 py-4 pl-12 pr-4 transition-all focus-within:border-primary-amber/50 focus-within:bg-black/60 focus-within:ring-1 focus-within:ring-primary-amber/50">
              <span className="material-symbols-outlined absolute left-4 text-slate-400">
                cake
              </span>
              <input {...register("birth_date")} type="hidden" />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                placeholder="YYYY"
                value={birthYear}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setBirthYear(val);
                  if (val.length === 4) monthInputRef.current?.focus();
                }}
                className="w-14 bg-transparent font-mono text-center text-white outline-none placeholder:text-slate-600"
              />
              <span className="px-1 font-mono text-slate-500">—</span>
              <input
                ref={monthInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                placeholder="MM"
                value={birthMonth}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 2);
                  setBirthMonth(val);
                  if (val.length === 2) dayInputRef.current?.focus();
                }}
                className="w-10 bg-transparent font-mono text-center text-white outline-none placeholder:text-slate-600"
              />
              <span className="px-1 font-mono text-slate-500">—</span>
              <input
                ref={dayInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                placeholder="DD"
                value={birthDay}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 2);
                  setBirthDay(val);
                }}
                className="w-10 bg-transparent font-mono text-center text-white outline-none placeholder:text-slate-600"
              />
            </div>
            {errors.birth_date?.message || state.fieldErrors?.birth_date?.[0] ? (
              <p className="pl-4 text-xs text-rose-400">
                {errors.birth_date?.message ?? state.fieldErrors?.birth_date?.[0]}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <label className="pl-4 font-mono text-xs uppercase tracking-wider text-primary-amber/80">
            Passcode
          </label>
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-4 text-slate-400">
              password
            </span>
            <input
              {...register("password")}
              name="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              placeholder="••••••••"
              required
              className="w-full rounded-full border border-white/10 bg-black/40 py-4 pl-12 pr-4 font-mono text-white outline-none placeholder:text-slate-600 transition-all focus:border-primary-amber/50 focus:bg-black/60 focus:ring-1 focus:ring-primary-amber/50"
            />
          </div>
          {errors.password?.message || state.fieldErrors?.password?.[0] ? (
            <p className="pl-4 text-xs text-rose-400">
              {errors.password?.message ?? state.fieldErrors?.password?.[0]}
            </p>
          ) : null}
        </div>

        {/* Status message */}
        {state.message ? (
          <p
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
            <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
              <span className="material-symbols-outlined text-[14px] text-slate-500">
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
          <p className="pl-4 text-xs text-amber-300">
            We could not verify your university domain right now. Please try
            again in a moment.
          </p>
        ) : null}

        {mode === "signup" ? (
          <div className="flex items-start gap-2 pl-4">
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
              className="mt-0.5 h-4 w-4 rounded border-white/30 bg-black/40 text-primary-amber focus:ring-primary-amber/60"
            />
            <label htmlFor="compliance" className="text-xs text-slate-300">
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

        {mode === "signup" && hasAttemptedInvalidSignUp ? (
          <p className="pl-4 text-xs text-rose-400">
            You must agree to the terms and be {requiredMinAge}+ to continue.
          </p>
        ) : null}

        {mode === "signup" && isUnderAge ? (
          <p className="pl-4 text-xs text-rose-400">
            You must be {requiredMinAge}+ to enter HHU. Grab a soda and come
            back later! 🥤
          </p>
        ) : null}

        <SubmitButton mode={mode} disabled={mode === "signup" && !canSubmitSignUp} />
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
            className="ml-1 font-bold text-primary-amber decoration-primary-amber decoration-2 underline-offset-4 hover:underline"
          >
            {mode === "login" ? "Sign up" : "Enter Here"}
          </button>
        </p>
      </div>
    </div>
  );
}
