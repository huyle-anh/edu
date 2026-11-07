"use client";

import { Box, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      alignItems={{ xs: "stretch", sm: "center" }}
      justifyContent="space-between"
      gap={1.5}
      sx={{ minWidth: 0 }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h4" component="h1" fontWeight={750} letterSpacing="-0.025em">
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {description}
          </Typography>
        )}
      </Box>
      {actions && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexShrink={0}>
          {actions}
        </Stack>
      )}
    </Stack>
  );
}
