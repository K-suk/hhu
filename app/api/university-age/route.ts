import { NextResponse } from "next/server";
import { z } from "zod";

import { inferMinAgeFromDomain } from "@/lib/auth/age-gate";
import { createClient } from "@/lib/supabase/server";
import { universityEmailDomainSchema } from "@/lib/validations/auth";

const querySchema = z.object({
  domain: universityEmailDomainSchema,
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    domain: url.searchParams.get("domain"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Bad Request",
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_domain_min_age", {
    p_email_domain: parsed.data.domain,
  });

  if (error) {
    return NextResponse.json(
      {
        isKnown: false,
        minAge: inferMinAgeFromDomain(parsed.data.domain),
      },
      { status: 200 },
    );
  }

  const row = data?.[0];
  return NextResponse.json({
    isKnown: row?.is_known ?? false,
    minAge: row?.min_age ?? inferMinAgeFromDomain(parsed.data.domain),
  });
}
