import { z } from "zod";

const minuteSchema = z.number().int().min(0).max(1439);

const requiredClassScheduleSchema = z.object({
  classId: z.string().uuid("Lớp học không hợp lệ"),
  classSubjectId: z.string().uuid("Môn học là bắt buộc"),
  teacherId: z.string().uuid("Giáo viên không hợp lệ"),
  dayOfWeek: z.number().int().min(0).max(6),
  startMinute: minuteSchema,
  endMinute: minuteSchema,
});

export const classScheduleCreateSchema = requiredClassScheduleSchema.refine(
  (data) => data.startMinute < data.endMinute,
  {
    message: "Giờ kết thúc phải sau giờ bắt đầu",
    path: ["endMinute"],
  },
);

export const classScheduleUpdateSchema = requiredClassScheduleSchema
  .partial()
  .refine(
    (data) =>
      data.startMinute === undefined ||
      data.endMinute === undefined ||
      data.startMinute < data.endMinute,
    {
      message: "Giờ kết thúc phải sau giờ bắt đầu",
      path: ["endMinute"],
    },
  );

export const scheduleFilterSchema = z.object({
  classId: z.string().uuid().optional(),
  classSubjectId: z.string().uuid().optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export type ClassScheduleCreate = z.infer<typeof classScheduleCreateSchema>;
export type ClassScheduleUpdate = z.infer<typeof classScheduleUpdateSchema>;
export type ScheduleFilter = z.infer<typeof scheduleFilterSchema>;
