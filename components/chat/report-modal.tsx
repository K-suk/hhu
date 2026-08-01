"use client";

import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sanitizeMultilinePlainTextInput } from "@/lib/client/security-ui";

type ReportCategory = "Harassment" | "Fake Profile" | "No-show" | "Other";

type ReportModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { category: ReportCategory; details: string }) => Promise<void>;
  isSubmitting: boolean;
  submissionError?: string;
};

const categories: ReportCategory[] = [
  "Harassment",
  "Fake Profile",
  "No-show",
  "Other",
];

const reportSchema = z.object({
  category: z.enum(categories, {
    message: "Select a report category.",
  }),
  details: z
    .string()
    .transform((value) => sanitizeMultilinePlainTextInput(value).trim())
    .pipe(
      z
        .string()
        .min(1, "Please include report details.")
        .max(1200, "Report details must be 1200 characters or fewer."),
    ),
});

export function ReportModal({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  submissionError = "",
}: ReportModalProps) {
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setValue,
  } = useForm<z.infer<typeof reportSchema>>({
    defaultValues: {
      category: undefined,
      details: "",
    },
    mode: "onChange",
    resolver: zodResolver(reportSchema),
  });

  useEffect(() => {
    if (!open) {
      reset({
        category: undefined,
        details: "",
      });
    }
  }, [open, reset]);

  const details = useWatch({ control, name: "details" }) ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report / Block</DialogTitle>
          <DialogDescription>
            Submit this report to the Admin Board. This ends the match and cannot
            be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <p
              id="report-category-label"
              className="font-mono text-xs font-medium tracking-wider text-emerald-400/80 uppercase"
            >
              Category
            </p>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <div
                  role="radiogroup"
                  aria-labelledby="report-category-label"
                  aria-describedby={
                    errors.category || submissionError ? "report-form-error" : undefined
                  }
                  className="grid gap-2"
                >
                  {categories.map((item) => {
                    const selected = field.value === item;
                    return (
                      <label
                        key={item}
                        className={`relative w-full cursor-pointer rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary-amber ${
                          selected
                            ? "border-primary-amber/70 bg-amber-500/15 text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.2)] ring-1 ring-primary-amber/35"
                            : "border-white/10 bg-zinc-950/80 text-zinc-200 hover:border-emerald-500/30 hover:bg-zinc-900"
                        }`}
                      >
                        <input
                          type="radio"
                          name={field.name}
                          value={item}
                          checked={selected}
                          onChange={() => field.onChange(item)}
                          onBlur={field.onBlur}
                          disabled={isSubmitting}
                          className="sr-only"
                        />
                        <span className="flex items-center justify-between gap-2">
                          {item}
                          {selected ? (
                            <span className="material-symbols-outlined text-base" aria-hidden="true">
                              check
                            </span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-details">Details</Label>
            <Textarea
              {...register("details")}
              id="report-details"
              value={details}
              onChange={(event) =>
                setValue("details", sanitizeMultilinePlainTextInput(event.target.value), {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              placeholder="Describe what happened..."
              rows={5}
              maxLength={1200}
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.details)}
              aria-describedby={
                errors.details || submissionError ? "report-form-error" : undefined
              }
            />
          </div>

          {submissionError || errors.category?.message || errors.details?.message ? (
            <p
              id="report-form-error"
              className="rounded-md border border-rose-300/40 bg-rose-950/80 px-3 py-2 text-sm text-rose-100"
              role="alert"
            >
              {submissionError || errors.category?.message || errors.details?.message}
            </p>
          ) : null}

          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="w-auto px-4"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              className="w-auto border-rose-400 bg-rose-600 px-4 text-white hover:bg-rose-500"
              onClick={() =>
                void handleSubmit(async (values) => {
                  await onSubmit(values);
                })()
              }
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit Report"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
