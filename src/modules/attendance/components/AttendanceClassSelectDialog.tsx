"use client";

import { useMemo, useState, type ReactElement } from "react";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Stack,
  TextField,
} from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";

export type AttendanceClassOption = {
  classId: string;
  classCode: string;
  className: string;
  classStatus: "ACTIVE" | "COMPLETED";
  subjectName: string;
  teacherName: string;
  canCreate: boolean;
};

type Props = {
  open: boolean;
  options: AttendanceClassOption[];
  onClose: () => void;
  onSelect: (option: AttendanceClassOption) => void;
};

const columns: GridColDef<AttendanceClassOption>[] = [
  { field: "classCode", headerName: "Mã lớp", width: 130 },
  { field: "className", headerName: "Tên lớp", flex: 1, minWidth: 180 },
  { field: "subjectName", headerName: "Môn học", flex: 1, minWidth: 160 },
];

export function AttendanceClassSelectDialog({
  open,
  options,
  onClose,
  onSelect,
}: Props): ReactElement {
  const [search, setSearch] = useState("");
  const rows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    if (!query) return options;
    return options.filter((item) =>
      `${item.classCode} ${item.className} ${item.subjectName}`
        .toLocaleLowerCase("vi")
        .includes(query),
    );
  }, [options, search]);

  const close = () => {
    setSearch("");
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="md">
      <DialogTitle>Chọn lớp điểm danh</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            autoFocus
            size="small"
            placeholder="Tìm theo mã lớp, tên lớp hoặc môn học"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlinedIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <DataGrid
            autoHeight
            rows={rows}
            columns={columns}
            getRowId={(row) => `${row.classId}:${row.subjectName}`}
            onRowClick={(params) => {
              onSelect(params.row);
              close();
            }}
            initialState={{
              pagination: { paginationModel: { pageSize: 10, page: 0 } },
            }}
            pageSizeOptions={[10, 25, 50]}
            disableRowSelectionOnClick
            localeText={{
              noRowsLabel: "Không tìm thấy lớp phù hợp",
              footerTotalRows: "Tổng số dòng:",
              paginationDisplayedRows: ({ from, to, count }) =>
                `${from}–${to} trên ${count}`,
            }}
            sx={{
              cursor: "pointer",
              "& .MuiDataGrid-row:hover": { bgcolor: "action.hover" },
            }}
          />
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
