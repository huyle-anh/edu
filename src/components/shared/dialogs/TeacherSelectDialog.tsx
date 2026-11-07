"use client";

import type { ReactElement } from "react";
import { type GridColDef } from "@mui/x-data-grid";
import {
  BaseSelectDialog,
  type SelectableItem,
} from "@/components/shared/dialogs/BaseSelectDialog";

export interface TeacherItem extends SelectableItem {
  id: string;
  code: string;
  fullName: string;
  phone?: string;
  specialty?: string;
  status?: string;
}

/**
 * The value returned to the parent after selection.
 * `name` is populated from the teacher profile full name.
 */
export interface TeacherSelectValue {
  id: string;
  code: string;
  /** Teacher display name */
  name: string;
}

export interface TeacherSelectDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (value: TeacherSelectValue) => void;
}

export function TeacherSelectDialog({
  open,
  onClose,
  onSelect,
}: TeacherSelectDialogProps): ReactElement {
  const columns: GridColDef<TeacherItem>[] = [
    { field: "code", headerName: "Mã giáo viên", width: 130 },
    {
      field: "fullName",
      headerName: "Họ tên",
      width: 220,
      valueGetter: (_value, row) => row.fullName,
    },
    {
      field: "phone",
      headerName: "Số điện thoại",
      width: 140,
      renderCell: (params) => params.value ?? "-",
    },
    {
      field: "specialty",
      headerName: "Chuyên môn",
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
        };
        return map[params.value as string] ?? "-";
      },
    },
  ];

  const handleSelect = (item: TeacherItem) => {
    onSelect({
      id: item.id,
      code: item.code,
      name: item.fullName,
    });
  };

  return (
    <BaseSelectDialog<TeacherItem>
      open={open}
      onClose={onClose}
      onSelect={handleSelect}
      endpoint="/api/teachers"
      query={{ status: "ACTIVE" }}
      title="Chọn giáo viên"
      columns={columns}
      searchPlaceholder="Nhập mã hoặc tên giáo viên"
      maxWidth="lg"
    />
  );
}
