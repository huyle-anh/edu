"use client";

import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import type { ReactNode } from "react";

type LocalizationWrapperProps = {
  children: ReactNode;
};

export function LocalizationWrapper({
  children,
}: LocalizationWrapperProps): ReactNode {
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      {children}
    </LocalizationProvider>
  );
}
