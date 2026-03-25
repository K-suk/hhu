import { extractEmailDomain as extractValidatedEmailDomain } from "@/lib/validations/auth";

export function extractEmailDomain(email: string): string | null {
  return extractValidatedEmailDomain(email);
}
