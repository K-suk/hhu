import { NextResponse } from "next/server";
import type { z } from "zod";

import type { AuthSession } from "@/lib/security/auth";
import { requireAuth } from "@/lib/security/auth";
import {
  AuthenticationError,
  BadRequestError,
  ForbiddenError,
} from "@/lib/security/errors";

type JsonRouteHandler<TSchema extends z.ZodTypeAny> = (
  data: z.infer<TSchema>,
  context: AuthSession,
  request: Request,
) => Promise<Response | NextResponse | unknown>;

async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new BadRequestError("Bad Request");
  }
}

function toErrorResponse(error: unknown) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (error instanceof ForbiddenError) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  if (error instanceof BadRequestError) {
    return NextResponse.json(
      {
        message: error.message,
        errors: error.fieldErrors,
      },
      { status: 400 },
    );
  }

  console.error(error);
  return NextResponse.json(
    { message: "Internal Server Error" },
    { status: 500 },
  );
}

export function authedJsonRoute<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  handler: JsonRouteHandler<TSchema>,
  requireSession: () => Promise<AuthSession> = requireAuth,
) {
  return async function routeHandler(request: Request) {
    try {
      const session = await requireSession();
      const payload = await parseJson(request);
      const parsed = schema.safeParse(payload);

      if (!parsed.success) {
        throw new BadRequestError(
          "Bad Request",
          parsed.error.flatten().fieldErrors,
        );
      }

      const response = await handler(parsed.data, session, request);
      return response instanceof Response
        ? response
        : NextResponse.json(response);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
