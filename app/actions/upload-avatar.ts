"use server";

import { randomUUID } from "node:crypto";

import { requireEligibleUser } from "@/lib/security/auth";
import { verifyCsrfFormSubmission } from "@/lib/security/csrf";
import { checkRateLimitForServerAction } from "@/lib/security/rate-limit";

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

type AllowedImageType = {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
};

export type UploadAvatarActionResult =
  | {
      ok: true;
      avatarUrl: string;
    }
  | {
      ok: false;
      message: string;
    };

function logAvatarSecurityEvent(
  message: string,
  context: {
    error?: unknown;
    path?: string;
    userId: string;
  },
) {
  const errorDetails =
    context.error && typeof context.error === "object"
      ? {
          message:
            "message" in context.error &&
            typeof context.error.message === "string"
              ? context.error.message
              : context.error instanceof Error
                ? context.error.message
                : undefined,
          code:
            "code" in context.error && typeof context.error.code === "string"
              ? context.error.code
              : undefined,
          details:
            "details" in context.error &&
            typeof context.error.details === "string"
              ? context.error.details
              : undefined,
          hint:
            "hint" in context.error && typeof context.error.hint === "string"
              ? context.error.hint
              : undefined,
        }
      : {
          message:
            context.error instanceof Error
              ? context.error.message
              : typeof context.error === "string"
                ? context.error
                : undefined,
          code: undefined,
          details: undefined,
          hint: undefined,
        };

  console.error("[avatar-upload]", {
    error: errorDetails,
    pathSuffix: context.path ? context.path.slice(-24) : undefined,
    userIdSuffix: context.userId.slice(-8),
    message,
  });
}

function detectImageType(buffer: Buffer): AllowedImageType | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { contentType: "image/png", extension: "png" };
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }

  return null;
}

async function cleanupOtherAvatars(
  userId: string,
  keepPath: string,
  supabase: Awaited<ReturnType<typeof requireEligibleUser>>["supabase"],
) {
  const { data: existingFiles, error: listError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .list(userId, { limit: 100 });

  if (listError || !existingFiles?.length) {
    if (listError) {
      logAvatarSecurityEvent("failed_to_list_existing_avatars", {
        error: listError,
        path: keepPath,
        userId,
      });
    }
    return;
  }

  const removable = existingFiles
    .filter((item) => item.name && `${userId}/${item.name}` !== keepPath)
    .map((item) => `${userId}/${item.name}`);

  if (removable.length === 0) {
    return;
  }

  const { error: removeError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .remove(removable);

  if (removeError) {
    logAvatarSecurityEvent("failed_to_remove_previous_avatars", {
      error: removeError,
      path: keepPath,
      userId,
    });
  }
}

export async function uploadAvatarAction(
  formData: FormData,
): Promise<UploadAvatarActionResult> {
  const session = await requireEligibleUser().catch(() => null);

  if (!session) {
    return {
      ok: false,
      message: "Your session could not be verified. Refresh and try again.",
    };
  }

  const rateLimit = await checkRateLimitForServerAction("general", session.user.id);
  if (!rateLimit.success) {
    return {
      ok: false,
      message: `Too many avatar upload attempts. Try again in ${rateLimit.retryAfter}s.`,
    };
  }

  try {
    await verifyCsrfFormSubmission(formData, session.user.id);
  } catch (error) {
    logAvatarSecurityEvent("csrf_validation_failed", {
      error,
      userId: session.user.id,
    });
    return {
      ok: false,
      message: "Security verification failed. Refresh and try again.",
    };
  }

  const fileValue = formData.get("avatar");
  if (!(fileValue instanceof File)) {
    return {
      ok: false,
      message: "Select an image before uploading.",
    };
  }

  if (fileValue.size <= 0 || fileValue.size > MAX_AVATAR_BYTES) {
    return {
      ok: false,
      message: "Avatar image must be 5MB or smaller.",
    };
  }

  let buffer: Buffer;

  try {
    const arrayBuffer = await fileValue.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  } catch (error) {
    logAvatarSecurityEvent("failed_to_read_file_buffer", {
      error,
      userId: session.user.id,
    });
    return {
      ok: false,
      message: "We couldn't process that image. Try another file.",
    };
  }

  const detectedType = detectImageType(buffer);
  if (!detectedType) {
    return {
      ok: false,
      message: "Only JPG, PNG, or WEBP images are allowed.",
    };
  }

  if (fileValue.type && fileValue.type !== detectedType.contentType) {
    logAvatarSecurityEvent("mime_mismatch_detected", {
      error: `client=${fileValue.type}; detected=${detectedType.contentType}`,
      userId: session.user.id,
    });
    return {
      ok: false,
      message: "The uploaded image format was not accepted.",
    };
  }

  const path = `${session.user.id}/${randomUUID()}.${detectedType.extension}`;
  const { error: uploadError } = await session.supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, buffer, {
      contentType: detectedType.contentType,
      upsert: false,
    });

  if (uploadError) {
    logAvatarSecurityEvent("storage_upload_failed", {
      error: uploadError,
      path,
      userId: session.user.id,
    });
    return {
      ok: false,
      message: "We couldn't store that avatar right now. Please try again.",
    };
  }

  const { data: publicData } = session.supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(path);

  const avatarUrl = `${publicData.publicUrl}?t=${Date.now()}`;

  const { error: profileError } = await session.supabase.rpc(
    "update_profile_avatar",
    {
      p_avatar_url: avatarUrl,
    },
  );

  if (profileError) {
    logAvatarSecurityEvent("profile_avatar_update_failed", {
      error: profileError,
      path,
      userId: session.user.id,
    });

    const { error: cleanupError } = await session.supabase.storage
      .from(AVATAR_BUCKET)
      .remove([path]);

    if (cleanupError) {
      logAvatarSecurityEvent("orphan_cleanup_failed", {
        error: cleanupError,
        path,
        userId: session.user.id,
      });
    }

    return {
      ok: false,
      message: "We couldn't save your avatar right now. Please try again.",
    };
  }

  await cleanupOtherAvatars(session.user.id, path, session.supabase);

  return {
    ok: true,
    avatarUrl,
  };
}
