"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Typography,
  type ButtonProps,
} from "@mui/material";
import type { ReactElement, ReactNode } from "react";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  content?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  confirmDisabled?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: ButtonProps["color"];
}

export function ConfirmDialog({
  open,
  title,
  message,
  content,
  onConfirm,
  onCancel,
  isLoading = false,
  confirmDisabled = false,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  confirmColor = "error",
}: ConfirmDialogProps): ReactElement {
  return (
    <Dialog open={open} onClose={isLoading ? undefined : onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography>{message}</Typography>
        {content}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} variant="outlined" disabled={isLoading}>
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color={confirmColor}
          disabled={isLoading || confirmDisabled}
        >
          {isLoading ? <CircularProgress size={18} color="inherit" /> : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
