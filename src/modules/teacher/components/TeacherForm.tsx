"use client";

import {
  TextField,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
  Box,
} from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { teacherCreateSchema } from "@/modules/teacher/schemas/teacher.schema";
import type { z } from "zod";
import type { ReactElement } from "react";

type TeacherFormData = z.infer<typeof teacherCreateSchema>;

export interface TeacherFormProps {
  formId?: string;
  onSubmit: (data: TeacherFormData) => void | Promise<void>;
  defaultValues?: Partial<TeacherFormData>;
}

export function TeacherForm({
  formId,
  onSubmit,
  defaultValues,
}: TeacherFormProps): ReactElement {
  const { control, handleSubmit } = useForm<TeacherFormData>({
    resolver: zodResolver(teacherCreateSchema),
    defaultValues: {
      fullName: defaultValues?.fullName ?? "",
      phone: defaultValues?.phone ?? "",
      bankAccount: defaultValues?.bankAccount ?? "",
      specialty: defaultValues?.specialty ?? "",
      commissionPercent: defaultValues?.commissionPercent ?? 0,
      status: defaultValues?.status ?? "ACTIVE",
    },
  });

  return (
    <Box component="form" id={formId} onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={2.5}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Controller
            name="fullName"
            control={control}
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                label="Họ và tên"
                placeholder="VD: Nguyễn Văn A"
                autoFocus
                error={!!error}
                helperText={error?.message}
                fullWidth
                size="small"
              />
            )}
          />

          <Controller
            name="phone"
            control={control}
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                label="Số điện thoại"
                placeholder="VD: 0912345678"
                error={!!error}
                helperText={error?.message}
                fullWidth
                size="small"
              />
            )}
          />
        </Stack>

        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Controller
            name="bankAccount"
            control={control}
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                label="Tài khoản ngân hàng"
                placeholder="VD: 123456789"
                error={!!error}
                helperText={error?.message}
                fullWidth
                size="small"
              />
            )}
          />

          <Controller
            name="specialty"
            control={control}
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                label="Chuyên môn"
                placeholder="VD: Toán học"
                error={!!error}
                helperText={error?.message}
                fullWidth
                size="small"
              />
            )}
          />
        </Stack>

        <Controller
          name="commissionPercent"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Tỷ lệ trích (%)"
              type="number"
              inputProps={{ min: 0, max: 100, step: 0.01 }}
              error={!!error}
              helperText={error?.message ?? "Tỷ lệ dùng khi tính báo cáo tiền đã thu"}
              fullWidth
              size="small"
              onChange={(event) => field.onChange(Number(event.target.value))}
            />
          )}
        />

        <Controller
          name="status"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <FormControl error={!!error} fullWidth size="small">
              <InputLabel>Trạng thái</InputLabel>
              <Select {...field} label="Trạng thái">
                <MenuItem value="ACTIVE">Đang hoạt động</MenuItem>
                <MenuItem value="INACTIVE">Ngừng hoạt động</MenuItem>
              </Select>

              {error?.message && (
                <FormHelperText>{error.message}</FormHelperText>
              )}
            </FormControl>
          )}
        />
      </Stack>
    </Box>
  );
}
