"use client";

import type { ReactElement } from "react";
import { type GridColDef } from "@mui/x-data-grid";
import { BaseSelectDialog } from "@/components/shared/dialogs/BaseSelectDialog";

export interface ClassItem {
  id: string;
  code: string;
  name: string;
  status?: string;
}

export interface ClassSelectDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (classItem: ClassItem) => void;
  reportableOnly?: boolean;
}

export function ClassSelectDialog({
  open,
  onClose,
  onSelect,
  reportableOnly = false,
}: ClassSelectDialogProps): ReactElement {
  const columns: GridColDef<ClassItem>[] = [
    { field: "code", headerName: "Mã lớp", width: 120 },
    { field: "name", headerName: "Tên lớp", flex: 1, minWidth: 200 },
    {
      field: "status",
      headerName: "Trạng thái",
      width: 120,
      renderCell: (params) => {
        const map: Record<string, string> = {
          DRAFT: "Nháp",
          ACTIVE: "Hoạt động",
          COMPLETED: "Hoàn thành",
          CANCELLED: "Hủy",
        };
        return map[params.value as string] ?? params.value ?? "-";
      },
    },
  ];

  return (
    <BaseSelectDialog<ClassItem>
      open={open}
      onClose={onClose}
      onSelect={onSelect}
      endpoint="/api/classes"
      query={reportableOnly ? { statuses: "ACTIVE,COMPLETED" } : undefined}
      title={reportableOnly ? "Chọn lớp đang hoạt động hoặc đã hoàn thành" : "Chọn lớp học"}
      columns={columns}
      searchPlaceholder="Nhập mã lớp hoặc tên lớp"
      maxWidth="md"
    />
  );
}
