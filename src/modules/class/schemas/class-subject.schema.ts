import { z } from "zod";

export const subjectCreateSchema = z.object({
  name: z.string().trim().min(1, "Tên môn học là bắt buộc").max(255),
});

export const subjectUpdateSchema = z.object({
  name: z.string().trim().min(1, "Tên môn học là bắt buộc").max(255),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const classSubjectCreateSchema = z.object({
  subjectId: z.string().uuid(),
  teacherId: z.string().uuid().nullable().optional(),
  tuitionFee: z.number().finite().positive(),
  totalSessions: z.number().int().min(0),
  maxStudents: z.number().int().min(1).nullable().optional(),
});

export const classSubjectUpdateSchema = z.object({
  teacherId: z.string().uuid().nullable().optional(),
  tuitionFee: z.number().finite().positive(),
  totalSessions: z.number().int().min(0),
  maxStudents: z.number().int().min(1).nullable().optional(),
});

export type SubjectCreate = z.infer<typeof subjectCreateSchema>;
export type SubjectUpdate = z.infer<typeof subjectUpdateSchema>;
export type ClassSubjectCreate = z.infer<typeof classSubjectCreateSchema>;
export type ClassSubjectUpdate = z.infer<typeof classSubjectUpdateSchema>;
