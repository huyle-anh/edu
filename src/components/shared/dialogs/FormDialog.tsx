"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Box,
} from "@mui/material";
import type { ReactElement, ReactNode } from "react";

export interface FormDialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit?: () => Promise<void> | void;
  formId?: string;
  children: ReactNode;
  isLoading?: boolean;
  submitText?: string;
  cancelText?: string;
}

export function FormDialog({
  open,
  title,
  onClose,
  onSubmit,
  formId,
  children,
  isLoading = false,
  submitText = "Lưu",
  cancelText = "Hủy",
}: FormDialogProps): ReactElement {
  return (
    <Dialog
      open={open}
      onClose={isLoading ? undefined : onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>{children}</Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined" disabled={isLoading}>
          {cancelText}
        </Button>
        <Button
          type={formId ? "submit" : "button"}
          form={formId}
          onClick={formId ? undefined : onSubmit}
          variant="contained"
          disabled={isLoading}
        >
          {isLoading ? <CircularProgress size={20} color="inherit" /> : submitText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
