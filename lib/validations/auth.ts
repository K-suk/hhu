import { z } from "zod";

import { DEFAULT_MIN_AGE, hasReachedMinimumAge } from "@/lib/auth/age-gate";

const EMAIL_MAX_LENGTH = 254;
const PASSWORD_MAX_LENGTH = 72;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DOMAIN_REGEX = /^[a-z0-9.-]+$/;

export function extractEmailDomain(email: string): string | null {
  const normalizedEmail = email.trim().toLowerCase();
  const atIndex = normalizedEmail.lastIndexOf("@");

  if (atIndex < 0 || atIndex === normalizedEmail.length - 1) {
    return null;
  }

  const domain = normalizedEmail.slice(atIndex + 1);
  return DOMAIN_REGEX.test(domain) ? domain : null;
}

export const universityEmailDomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Domain is required.")
  .max(255, "Domain is too long.")
  .regex(DOMAIN_REGEX, "Invalid domain.");

export const universityEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(EMAIL_MAX_LENGTH, "Email is too long.")
  .email("Please enter a valid email address.");

export const birthDateSchema = z
  .string()
  .trim()
  .regex(ISO_DATE_REGEX, "Please enter a valid date of birth.");

export function validateBirthDateForMinimumAge(
  birthDate: string,
  requiredMinAge: number,
): string[] | undefined {
  if (hasReachedMinimumAge(birthDate, requiredMinAge)) {
    return undefined;
  }

  return [`You must be ${requiredMinAge}+ to continue with this university domain.`];
}

export const signUpSchema = z.object({
  email: universityEmailSchema,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(PASSWORD_MAX_LENGTH, "Password is too long."),
  birth_date: birthDateSchema,
});

export const loginSchema = z.object({
  email: universityEmailSchema,
  password: z.string().min(1, "Password is required."),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export type AuthActionState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors?: {
    email?: string[];
    password?: string[];
    birth_date?: string[];
  };
};

export const INITIAL_AUTH_STATE: AuthActionState = {
  status: "idle",
  message: "",
};

export function getMinimumAgeOrDefault(minAge: number | null | undefined): number {
  return typeof minAge === "number" && Number.isFinite(minAge) ? minAge : DEFAULT_MIN_AGE;
}
