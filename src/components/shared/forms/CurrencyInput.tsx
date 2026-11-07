import {
  TextField,
  InputAdornment,
  type SxProps,
  type Theme,
} from "@mui/material";
import type { FieldError } from "react-hook-form";

interface CurrencyInputProps {
  label: string;
  value: number | undefined | null;
  onChange?: (value: number) => void;
  error?: FieldError | string;
  disabled?: boolean;
  readOnly?: boolean;
  helperText?: string;
  sx?: SxProps<Theme>;
}

export function CurrencyInput({
  label,
  value,
  onChange,
  error,
  disabled,
  readOnly,
  helperText,
  sx,
}: CurrencyInputProps) {
  const errorMessage = typeof error === "string" ? error : error?.message;

  return (
    <TextField
      label={label}
      fullWidth
      size="small"
      disabled={disabled}
      value={
        value === undefined || value === null
          ? ""
          : Number(value).toLocaleString("vi-VN")
      }
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d]/g, "");
        onChange?.(raw ? Number(raw) : 0);
      }}
      error={!!error}
      helperText={errorMessage || helperText}
      sx={{
        "& input": {
          textAlign: "right",
          fontWeight: 600,
          fontSize: "0.95rem",
          letterSpacing: "0.3px",
        },
        "& .MuiInputBase-root": {
          backgroundColor: disabled ? "action.disabledBackground" : "background.paper",
        },
        ...sx,
      }}
      InputProps={{
        readOnly,
        endAdornment: (
          <InputAdornment position="end" sx={{ color: "text.secondary" }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              ₫
            </span>
          </InputAdornment>
        ),
      }}
    />
  );
}
