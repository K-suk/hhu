import { z } from "zod";

import { universityEmailDomainSchema } from "@/lib/validations/auth";

export const genderIdentityOptions = ["Male", "Female", "Non-binary"] as const;

const HTML_LIKE_PATTERN = /<[^>]*>/;

function rejectHtmlLikeInput(value: string): boolean {
  return !HTML_LIKE_PATTERN.test(value);
}

function buildSanitizedStringSchema(config: {
  min: number;
  max: number;
  requiredMessage: string;
  tooShortMessage: string;
  tooLongMessage: string;
  rejectHtmlMessage: string;
}) {
  return z
    .string()
    .trim()
    .min(config.min, config.min === 1 ? config.requiredMessage : config.tooShortMessage)
    .max(config.max, config.tooLongMessage)
    .refine(rejectHtmlLikeInput, {
      message: config.rejectHtmlMessage,
    });
}

export const displayNameSchema = buildSanitizedStringSchema({
  min: 2,
  max: 50,
  requiredMessage: "Display name is required.",
  tooShortMessage: "Display name must be at least 2 characters.",
  tooLongMessage: "Display name must be 50 characters or fewer.",
  rejectHtmlMessage: "Display name cannot contain HTML.",
});

export const departmentSchema = buildSanitizedStringSchema({
  min: 2,
  max: 80,
  requiredMessage: "Department is required.",
  tooShortMessage: "Department is required.",
  tooLongMessage: "Department must be 80 characters or fewer.",
  rejectHtmlMessage: "Department cannot contain HTML.",
});

export const courseIdSchema = z
  .string()
  .trim()
  .min(1, "Course ID is required.")
  .max(32, "Course ID is too long.")
  .regex(/^[a-z0-9-]+$/i, "Course ID must be alphanumeric.");

export const genderIdentitySchema = z.enum(genderIdentityOptions, {
  message: "Select a valid gender identity option.",
});

export const messageContentSchema = buildSanitizedStringSchema({
  min: 1,
  max: 500,
  requiredMessage: "Message content is required.",
  tooShortMessage: "Message content is required.",
  tooLongMessage: "Message must be 500 characters or fewer.",
  rejectHtmlMessage: "Message content cannot contain HTML.",
});

export const setupProfileSchema = z.object({
  display_name: displayNameSchema,
  department: departmentSchema,
  gender_identity: genderIdentitySchema,
});

export const profileUpdateSchema = z.object({
  display_name: displayNameSchema,
  department: departmentSchema,
});

export const enrolCourseSchema = z.object({
  p_course_id: courseIdSchema,
  p_gender_identity: genderIdentitySchema,
  p_email_domain: universityEmailDomainSchema,
});

export const reportMatchSchema = z.object({
  match_id: z.string().uuid("Invalid match."),
  category: z.enum(["Harassment", "Fake Profile", "No-show", "Other"], {
    message: "Select a report category.",
  }),
  details: buildSanitizedStringSchema({
    min: 1,
    max: 1200,
    requiredMessage: "Please include report details.",
    tooShortMessage: "Please include report details.",
    tooLongMessage: "Report details must be 1200 characters or fewer.",
    rejectHtmlMessage: "Report details cannot contain HTML.",
  }),
});

export const sendMessageSchema = z.object({
  match_id: z.string().uuid("Invalid match."),
  sender_id: z.string().uuid("Invalid sender."),
  content: messageContentSchema,
});

const validGradePoints = [4.33, 4, 3, 2, 0] as const;

export const submitGradeSchema = z.object({
  p_match_id: z.string().uuid("Invalid match."),
  p_rated_user_id: z.string().uuid("Invalid rated user."),
  p_grade_point: z.union(validGradePoints.map((point) => z.literal(point)) as [
    z.ZodLiteral<(typeof validGradePoints)[number]>,
    z.ZodLiteral<(typeof validGradePoints)[number]>,
    ...z.ZodLiteral<(typeof validGradePoints)[number]>[],
  ]),
});

export type SetupProfileInput = z.infer<typeof setupProfileSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type EnrolCourseInput = z.infer<typeof enrolCourseSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type SubmitGradeInput = z.infer<typeof submitGradeSchema>;

export type SetupProfileActionState = {
  status: "idle" | "error";
  message: string;
  fieldErrors?: {
    display_name?: string[];
    department?: string[];
    gender_identity?: string[];
  };
};

export const INITIAL_SETUP_PROFILE_STATE: SetupProfileActionState = {
  status: "idle",
  message: "",
};
