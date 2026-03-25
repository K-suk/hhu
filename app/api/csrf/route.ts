import { issueCsrfTokenForCurrentUser } from "@/lib/security/csrf";

export const GET = issueCsrfTokenForCurrentUser;
