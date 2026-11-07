"use client";

import type { ReactElement } from "react";
import { type GridColDef } from "@mui/x-data-grid";
import { Box, Typography } from "@mui/material";
import { BaseSelectDialog } from "@/components/shared/dialogs/BaseSelectDialog";

export interface StudentItem {
  id: string;
  code: string;
  fullName: string;
  className?: string;
  phone?: string;
  status?: string;
}

export interface StudentSelectDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (studentItem: StudentItem) => void;
  excludeClassId?: string;
  title: string;
}

export function StudentSelectDialog({
  open,
  onClose,
  onSelect,
  excludeClassId,
  title,
}: StudentSelectDialogProps): ReactElement {
  const columns: GridColDef<StudentItem>[] = [
    { field: "code", headerName: "Mã học viên", width: 120 },
    { field: "fullName", headerName: "Tên học viên", flex: 1, minWidth: 200 },
    {
      field: "className",
      headerName: "Lớp",
      flex: 1,
      minWidth: 220,
      renderCell: (params) => (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            height: "100%",
            minWidth: 0,
          }}
        >
          <Typography
            variant="body2"
            color={params.value ? "text.primary" : "text.disabled"}
            noWrap
            title={params.value || "Chưa xếp lớp"}
            sx={{ minWidth: 0, width: "100%" }}
          >
            {params.value || "Chưa xếp lớp"}
          </Typography>
        </Box>
      ),
    },
    {
      field: "phone",
      headerName: "Số điện thoại",
      width: 150,
      renderCell: (params) => params.value ?? "-",
    },
    {
      field: "status",
      headerName: "Trạng thái",
      width: 120,
      renderCell: (params) => {
        const map: Record<string, string> = {
          ACTIVE: "Hoạt động",
          INACTIVE: "Không hoạt động",
          GRADUATED: "Tốt nghiệp",
        };
        return map[params.value as string] ?? params.value ?? "-";
      },
    },
  ];

  return (
    <BaseSelectDialog<StudentItem>
      open={open}
      onClose={onClose}
      onSelect={onSelect}
      endpoint="/api/students"
      title={title}
      columns={columns}
      searchPlaceholder="Nhập mã hoặc tên học viên"
      maxWidth="lg"
      query={{ status: "ACTIVE", excludeClassId }}
    />
  );
}
