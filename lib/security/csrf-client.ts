const CSRF_ENDPOINT = "/api/csrf";

type CsrfResponse = {
  expiresInMs: number;
  token: string;
};

export async function getCsrfToken(): Promise<string> {
  const response = await fetch(CSRF_ENDPOINT, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch CSRF token.");
  }

  const payload = (await response.json()) as CsrfResponse;
  if (!payload.token) {
    throw new Error("Missing CSRF token.");
  }

  return payload.token;
}
