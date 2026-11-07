"use client";

import {
  TextField,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
} from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { studentCreateSchema } from "@/modules/student/schemas/student.schema";
import type { z } from "zod";
import type { ReactElement } from "react";
import { DatePickerField } from "@/components/shared/forms/DatePickerField";

type StudentFormData = z.infer<typeof studentCreateSchema>;

export interface StudentFormProps {
  formId?: string;
  onSubmit: (data: StudentFormData) => void | Promise<void>;
  defaultValues?: Partial<StudentFormData>;
}

export function StudentForm({
  formId,
  onSubmit,
  defaultValues,
}: StudentFormProps): ReactElement {
  const toIsoDateTime = (value: string) =>
    value ? new Date(`${value}T00:00:00.000Z`).toISOString() : undefined;

  const { control, handleSubmit } = useForm<StudentFormData>({
    resolver: zodResolver(studentCreateSchema),
    defaultValues: {
      fullName: defaultValues?.fullName ?? "",
      birthday: defaultValues?.birthday ?? undefined,
      phone: defaultValues?.phone ?? "",
      address: defaultValues?.address ?? "",
      parentName: defaultValues?.parentName ?? "",
      status: defaultValues?.status ?? "ACTIVE",
    },
  });

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Controller
            name="fullName"
            control={control}
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                label="Họ tên"
                autoFocus
                error={!!error}
                helperText={error?.message}
                fullWidth
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
                error={!!error}
                helperText={error?.message}
                fullWidth
              />
            )}
          />
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Controller
            name="birthday"
            control={control}
            render={({ field, fieldState: { error } }) => (
              <DatePickerField
                label="Ngày sinh"
                value={field.value}
                onChange={(value) => field.onChange(value ? toIsoDateTime(value) : null)}
                textFieldProps={{ error: !!error, helperText: error?.message }}
              />
            )}
          />
          <Controller
            name="parentName"
            control={control}
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                label="Tên phụ huynh"
                error={!!error}
                helperText={error?.message}
                fullWidth
              />
            )}
          />
        </Stack>

        <Controller
          name="address"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Địa chỉ"
              error={!!error}
              helperText={error?.message}
              fullWidth
            />
          )}
        />

        <Controller
          name="status"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <FormControl error={!!error} fullWidth>
              <InputLabel>Trạng thái</InputLabel>
              <Select {...field} label="Trạng thái">
                <MenuItem value="ACTIVE">Hoạt động</MenuItem>
                <MenuItem value="INACTIVE">Ngừng hoạt động</MenuItem>
              </Select>
              <FormHelperText>{error?.message}</FormHelperText>
            </FormControl>
          )}
        />
      </Stack>
    </form>
  );
}
