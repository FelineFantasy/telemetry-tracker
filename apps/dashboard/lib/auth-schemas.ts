import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "At least 8 characters").max(256),
});

export const registerPageSchema = z
  .object({
    name: z.string().trim().min(1, "Required").max(120),
    email: z.string().trim().email("Enter a valid email").max(255),
    password: z.string().min(8, "At least 8 characters").max(256),
    confirm: z.string(),
    termsAccepted: z.boolean(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  })
  .refine((v) => v.termsAccepted, {
    message: "Required",
    path: ["termsAccepted"],
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterPageValues = z.infer<typeof registerPageSchema>;

export function fieldErrorsFromZod<T extends string>(
  issues: z.ZodIssue[]
): Partial<Record<T, string>> {
  const errors: Partial<Record<T, string>> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in errors)) {
      errors[key as T] = issue.message;
    }
  }
  return errors;
}
