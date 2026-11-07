"use client";

import dayjs from "dayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import type { TextFieldProps } from "@mui/material";

type DatePickerTextFieldProps = Pick<
  TextFieldProps,
  | "disabled"
  | "error"
  | "fullWidth"
  | "helperText"
  | "placeholder"
  | "required"
  | "size"
>;

type DatePickerFieldProps = {
  label: string;
  value?: string | null;
  onChange: (value: string) => void;
  textFieldProps?: DatePickerTextFieldProps;
};

/** Dùng chung cho ngày nhập vào, hiển thị DD/MM/YYYY và trả về YYYY-MM-DD. */
export function DatePickerField({
  label,
  value,
  onChange,
  textFieldProps,
}: DatePickerFieldProps) {
  return (
    <DatePicker
      label={label}
      format="DD/MM/YYYY"
      value={value ? dayjs(value.slice(0, 10)) : null}
      onChange={(date) =>
        onChange(date?.isValid() ? date.format("YYYY-MM-DD") : "")
      }
      slotProps={{
        textField: {
          ...textFieldProps,
          fullWidth: textFieldProps?.fullWidth ?? true,
          size: textFieldProps?.size ?? "small",
        },
      }}
    />
  );
}
