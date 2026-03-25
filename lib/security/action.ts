import type { z } from "zod";

import type { AuthSession } from "@/lib/security/auth";
import { requireAuth } from "@/lib/security/auth";
import {
  AuthenticationError,
  BadRequestError,
  ForbiddenError,
} from "@/lib/security/errors";

type AuthedActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      status: 400 | 401 | 403 | 500;
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

type AuthedActionHandler<TSchema extends z.ZodTypeAny, TResult> = (
  data: z.infer<TSchema>,
  context: AuthSession,
) => Promise<TResult>;

export function authedAction<TSchema extends z.ZodTypeAny, TResult>(
  schema: TSchema,
  handler: AuthedActionHandler<TSchema, TResult>,
) {
  return async function runAuthedAction(
    rawInput: unknown,
  ): Promise<AuthedActionResult<TResult>> {
    try {
      const session = await requireAuth();
      const parsed = schema.safeParse(rawInput);

      if (!parsed.success) {
        throw new BadRequestError("Bad Request", parsed.error.flatten().fieldErrors);
      }

      const data = await handler(parsed.data, session);
      return { ok: true, data };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return { ok: false, status: 401, message: "Unauthorized" };
      }

      if (error instanceof ForbiddenError) {
        return { ok: false, status: 403, message: "Forbidden" };
      }

      if (error instanceof BadRequestError) {
        return {
          ok: false,
          status: 400,
          message: error.message,
          fieldErrors: error.fieldErrors,
        };
      }

      console.error(error);
      return { ok: false, status: 500, message: "Internal Server Error" };
    }
  };
}

