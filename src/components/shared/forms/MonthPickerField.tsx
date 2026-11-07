"use client";

import dayjs from "dayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import type { TextFieldProps } from "@mui/material";
import { clampMonth } from "@/utils/date";

type MonthPickerTextFieldProps = Pick<
  TextFieldProps,
  | "disabled"
  | "error"
  | "fullWidth"
  | "helperText"
  | "placeholder"
  | "required"
  | "size"
>;

type MonthPickerFieldProps = {
  label: string;
  value?: string | null;
  onChange: (value: string) => void;
  minMonth?: string | null;
  maxMonth?: string | null;
  textFieldProps?: MonthPickerTextFieldProps;
};

/** Dùng chung cho kỳ nhập vào, hiển thị MM/YYYY và trả về YYYY-MM. */
export function MonthPickerField({
  label,
  value,
  onChange,
  minMonth,
  maxMonth,
  textFieldProps,
}: MonthPickerFieldProps) {
  return (
    <DatePicker
      label={label}
      views={["year", "month"]}
      openTo="month"
      format="MM/YYYY"
      value={value ? dayjs(`${value}-01`) : null}
      minDate={minMonth ? dayjs(`${minMonth}-01`) : undefined}
      maxDate={maxMonth ? dayjs(`${maxMonth}-01`) : undefined}
      onChange={(date) =>
        onChange(date?.isValid() ? clampMonth(date.format("YYYY-MM"), minMonth, maxMonth) : "")
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
