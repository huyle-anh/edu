"use client";

import { Snackbar as MuiSnackbar, Alert, AlertColor } from "@mui/material";
import { useState, useCallback, type ReactElement } from "react";

export interface UseSnackbarOptions {
  autoHideDuration?: number;
}

export interface SnackbarComponentProps {
  open: boolean;
  message: string;
  severity: AlertColor;
  onClose: () => void;
  autoHideDuration: number;
}

export function SnackbarComponent({
  open,
  message,
  severity,
  onClose,
  autoHideDuration,
}: SnackbarComponentProps): ReactElement {
  return (
    <MuiSnackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={onClose}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "right",
      }}
    >
      <Alert
        severity={severity}
        onClose={onClose}
        variant="filled"
        sx={{ width: "100%" }}
      >
        {message ?? ""}
      </Alert>
    </MuiSnackbar>
  );
}

export function useSnackbar(options: UseSnackbarOptions = {}) {
  const { autoHideDuration = 4000 } = options;
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<AlertColor>("info");

  const showMessage = useCallback((msg: string, sev: AlertColor = "info") => {
    setMessage(msg);
    setSeverity(sev);
    setOpen(true);
  }, []);

  const showSuccess = useCallback((msg: string) => showMessage(msg, "success"), [showMessage]);
  const showError = useCallback((msg: string) => showMessage(msg, "error"), [showMessage]);
  const showInfo = useCallback((msg: string) => showMessage(msg, "info"), [showMessage]);
  const showWarning = useCallback((msg: string) => showMessage(msg, "warning"), [showMessage]);

  const handleClose = () => setOpen(false);

  return {
    showMessage,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    Snackbar: (
      <SnackbarComponent
        open={open}
        message={message}
        severity={severity}
        onClose={handleClose}
        autoHideDuration={autoHideDuration}
      />
    ),
  };
}
