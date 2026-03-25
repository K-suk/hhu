import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

function getOrigin(value: string | undefined): string | null {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function toWebSocketOrigin(origin: string): string | null {
  try {
    const url = new URL(origin);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.origin;
  } catch {
    return null;
  }
}

function compact(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value));
}

function unique(values: string[]) {
  return [...new Set(values)];
}

const supabaseOrigin = getOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseWsOrigin = supabaseOrigin ? toWebSocketOrigin(supabaseOrigin) : null;
const formspreeOrigin = getOrigin(process.env.NEXT_PUBLIC_FORMSPREE_REPORT_ENDPOINT);

const scriptSrc = unique(
  compact([
    "'self'",
    "'unsafe-inline'",
    isProduction ? null : "'unsafe-eval'",
    "https://va.vercel-scripts.com",
  ]),
);

const styleSrc = unique(
  compact([
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
  ]),
);

const connectSrc = unique(
  compact([
    "'self'",
    supabaseOrigin,
    supabaseWsOrigin,
    formspreeOrigin,
    "https://vitals.vercel-insights.com",
    isProduction ? null : "ws:",
    isProduction ? null : "http://localhost:*",
    isProduction ? null : "http://127.0.0.1:*",
  ]),
);

const imgSrc = unique(
  compact([
    "'self'",
    "data:",
    "blob:",
    supabaseOrigin,
  ]),
);

const fontSrc = unique(
  compact([
    "'self'",
    "data:",
    "https://fonts.gstatic.com",
  ]),
);

const csp = [
  "default-src 'self'",
  `script-src ${scriptSrc.join(" ")}`,
  `style-src ${styleSrc.join(" ")}`,
  `connect-src ${connectSrc.join(" ")}`,
  `img-src ${imgSrc.join(" ")}`,
  `font-src ${fontSrc.join(" ")}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  "frame-src 'none'",
  isProduction ? "upgrade-insecure-requests" : null,
]
  .filter((directive): directive is string => Boolean(directive))
  .join("; ")
  .trim();

const permissionsPolicy = [
  "accelerometer=()",
  "autoplay=()",
  "browsing-topics=()",
  "camera=(self)",
  "display-capture=()",
  "fullscreen=(self)",
  "geolocation=()",
  "gyroscope=()",
  "hid=()",
  "magnetometer=()",
  "microphone=()",
  "midi=()",
  "payment=()",
  "publickey-credentials-get=(self)",
  "screen-wake-lock=()",
  "serial=()",
  "usb=()",
  "web-share=()",
]
  .join(", ")
  .trim();

const securityHeaders = compact([
  "X-Frame-Options: DENY",
  "X-Content-Type-Options: nosniff",
  "Referrer-Policy: strict-origin-when-cross-origin",
  `Permissions-Policy: ${permissionsPolicy}`,
  `Content-Security-Policy: ${csp}`,
  isProduction
    ? "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload"
    : null,
]).map((header) => {
  const separatorIndex = header.indexOf(":");
  return {
    key: header.slice(0, separatorIndex),
    value: header.slice(separatorIndex + 1).trim(),
  };
});

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
