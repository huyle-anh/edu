import { TextField, type TextFieldProps } from "@mui/material";

export function AppTextField(props: TextFieldProps) {
  return <TextField {...props} />;
}

export function AppNumberField(props: Omit<TextFieldProps, "type">) {
  return <TextField {...props} type="number" />;
}
