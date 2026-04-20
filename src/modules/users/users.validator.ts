import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  firmName: z.string().optional(),
  phone: z.string().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});
