import { z } from "zod";

const userStatus = z.enum(["ACTIVE", "INACTIVE", "LOCKED"]);

export const userCreateSchema = z.object({
  email: z.string().email().max(255),
  fullName: z.string().trim().min(1).max(255),
  password: z.string().min(8).max(100),
  status: userStatus.default("ACTIVE"),
  teacherId: z.string().uuid().nullable().optional(),
});

export const userUpdateSchema = userCreateSchema
  .omit({ password: true })
  .extend({ password: z.string().min(8).max(100).optional(), teacherId: z.string().uuid().nullable().optional() });

export const userFilterSchema = z.object({
  search: z.string().optional(),
  status: userStatus.optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export type UserCreate = z.infer<typeof userCreateSchema>;
export type UserUpdate = z.infer<typeof userUpdateSchema>;
export type UserFilter = z.infer<typeof userFilterSchema>;
