"use client";

import { AutoAwesomeOutlined } from "@mui/icons-material";
import { Box, CircularProgress, LinearProgress, Stack, TableCell, TableRow, Typography } from "@mui/material";

type LoadingStateProps = {
  label?: string;
  minHeight?: number;
  size?: number;
  inline?: boolean;
};

export function LoadingState({
  label = "Đang tải dữ liệu...",
  minHeight = 220,
  size = 28,
  inline = false,
}: LoadingStateProps) {
  return (
    <Stack
      role="status"
      aria-live="polite"
      direction={inline ? "row" : "column"}
      alignItems="center"
      justifyContent="center"
      spacing={inline ? 1 : 1.5}
      sx={{ minHeight: inline ? undefined : minHeight, p: inline ? 0 : 2, color: "text.secondary" }}
    >
      {inline ? (
        <CircularProgress size={size} thickness={4} aria-label={label} />
      ) : (
        <Stack
          alignItems="center"
          spacing={1.25}
          sx={{
            minWidth: { xs: 220, sm: 260 },
            px: 3,
            py: 2.5,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
            bgcolor: "background.paper",
            boxShadow: "0 8px 28px rgba(31, 71, 89, 0.07)",
          }}
        >
          <Box
            sx={{
              width: 52,
              height: 52,
              position: "relative",
              display: "grid",
              placeItems: "center",
              borderRadius: "50%",
              bgcolor: "primary.light",
              color: "primary.main",
            }}
          >
            <CircularProgress
              size={52}
              thickness={2.5}
              aria-label={label}
              sx={{ position: "absolute", inset: 0 }}
            />
            <AutoAwesomeOutlined fontSize="small" />
          </Box>
          <Typography variant="body2" fontWeight={700} color="text.primary" textAlign="center">
            {label}
          </Typography>
          <LinearProgress
            sx={{ width: 92, height: 3, borderRadius: 99, bgcolor: "action.hover" }}
          />
        </Stack>
      )}
      {inline && <Typography variant="body2" color="text.secondary">{label}</Typography>}
    </Stack>
  );
}

export function LoadingTableRow({
  colSpan,
  label = "Đang tải dữ liệu...",
}: {
  colSpan: number;
  label?: string;
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan}>
        <LoadingState label={label} minHeight={112} size={24} />
      </TableCell>
    </TableRow>
  );
}
