"use client";

import SearchIcon from "@mui/icons-material/Search";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import {
  Box,
  Button,
  FormHelperText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import type { ReactElement } from "react";

export type MasterSelectValue = {
  id: string;
  code: string;
  name: string;
};

export type MasterSelectFieldProps = {
  label: string;
  value?: MasterSelectValue | null;
  onOpen: () => void;
  disabled?: boolean;
  error?: string;
  required?: boolean;
  codeLabel?: string;
  nameLabel?: string;
  size?: "small" | "medium";
  sx?: SxProps<Theme>;
};

export function MasterSelectField({
  label,
  value,
  onOpen,
  disabled = false,
  error,
  required = false,
  codeLabel = "Mã",
  nameLabel = "Tên",
  size = "medium",
  sx,
}: MasterSelectFieldProps): ReactElement {
  const hasValue = Boolean(value?.id);
  const isSmall = size === "small";

  return (
    <Box sx={[{ position: "relative" }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Typography
        component="label"
        variant="caption"
        fontWeight={500}
        color={error ? "error.main" : "text.secondary"}
        sx={{
          position: "absolute",
          left: 12,
          top: -9,
          bgcolor: "background.paper",
          px: 0.5,
          zIndex: 1,
          lineHeight: 1,
        }}
      >
        {label}
        {required && (
          <Typography component="span" color="error.main" ml={0.25}>
            *
          </Typography>
        )}
      </Typography>

      <Paper
        variant="outlined"
        aria-invalid={!!error}
        sx={{
          px: 1.5,
          py: isSmall ? 0.5 : 1.5,
          minHeight: isSmall ? 40 : 56,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          borderColor: error ? "error.main" : "divider",
          borderRadius: 1,
          transition: "border-color 0.2s",
          bgcolor: disabled ? "action.disabledBackground" : "background.paper",
          opacity: disabled ? 0.8 : 1,
          "&:hover": {
            borderColor: disabled ? undefined : "primary.main",
          },
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5} width="100%">
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {hasValue ? (
              <Stack
                direction="row"
                spacing={isSmall ? 1.5 : 3}
                alignItems="center"
              >
                <Stack
                  direction="row"
                  spacing={0.5}
                  alignItems="center"
                  sx={{ minWidth: 0 }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ whiteSpace: "nowrap" }}
                  >
                    {codeLabel}:
                  </Typography>

                  <Typography variant="body2" fontWeight={600} noWrap>
                    {value?.code}
                  </Typography>
                </Stack>

                <Stack
                  direction="row"
                  spacing={0.5}
                  alignItems="center"
                  sx={{ minWidth: 0, flex: 1 }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ whiteSpace: "nowrap" }}
                  >
                    {nameLabel}:
                  </Typography>

                  <Typography variant="body2" noWrap>
                    {value?.name}
                  </Typography>
                </Stack>
              </Stack>
            ) : (
              <Typography
                variant="body2"
                color="text.disabled"
                fontStyle="italic"
              >
                Chưa chọn...
              </Typography>
            )}
          </Box>

          <Button
            size="small"
            variant={hasValue ? "text" : "contained"}
            startIcon={hasValue ? <SwapHorizIcon /> : <SearchIcon />}
            onClick={onOpen}
            disabled={disabled}
            sx={{
              flexShrink: 0,
              boxShadow: "none",
              "&:hover": {
                boxShadow: "none",
              },
            }}
          >
            {hasValue ? "Đổi" : "Chọn"}
          </Button>
        </Stack>
      </Paper>

      {error && (
        <FormHelperText error sx={{ mx: "14px", mt: 0.5 }}>
          {error}
        </FormHelperText>
      )}
    </Box>
  );
}
