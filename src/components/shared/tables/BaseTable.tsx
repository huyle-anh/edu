"use client";

import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";
import {
  DataGrid,
  type GridColDef,
  type GridPaginationModel,
  type GridValidRowModel,
} from "@mui/x-data-grid";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import TableRowsOutlinedIcon from "@mui/icons-material/TableRowsOutlined";
import type { ReactElement } from "react";
import { LoadingState } from "@/components/shared/feedback/LoadingState";

export interface BaseTableProps<T extends GridValidRowModel> {
  columns: GridColDef<T>[];
  rows: T[];
  totalRows: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  error?: string | null;
  onRetry?: () => void;
}

export function BaseTable<T extends GridValidRowModel>({
  columns,
  rows,
  totalRows,
  page,
  pageSize,
  isLoading,
  onPageChange,
  onPageSizeChange,
  error,
  onRetry,
}: BaseTableProps<T>): ReactElement {
  if (error) {
    return (
      <Card>
        <CardContent sx={{ p: { xs: 3, md: 5 } }}>
          <Alert severity="error" action={onRetry ? <Button variant="text" color="inherit" size="small" startIcon={<RefreshOutlinedIcon />} onClick={onRetry}>Thử lại</Button> : undefined}>
            <AlertTitle>Không thể tải dữ liệu</AlertTitle>
            {error}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (isLoading && rows.length === 0) {
    return (
      <Card sx={{ minHeight: 320, display: "grid", placeItems: "center" }}>
        <LoadingState label="Đang tải danh sách..." minHeight={260} />
      </Card>
    );
  }

  const handlePaginationModelChange = (model: GridPaginationModel) => {
    const nextPage = model.page + 1;

    if (nextPage !== page) {
      onPageChange(nextPage);
    }

    if (model.pageSize !== pageSize) {
      onPageSizeChange(model.pageSize);
    }
  };

  return (
    <Card>
      <Box sx={{ overflowX: "auto", borderRadius: 2 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          pageSizeOptions={[5, 10, 25, 50]}
          paginationModel={{ page: page - 1, pageSize }}
          onPaginationModelChange={handlePaginationModelChange}
          rowCount={totalRows}
          paginationMode="server"
          loading={isLoading}
          disableRowSelectionOnClick
          rowHeight={56}
          columnHeaderHeight={48}
          slots={{ noRowsOverlay: EmptyRowsOverlay, loadingOverlay: LoadingRowsOverlay }}
          localeText={{
            noRowsLabel: "Không có dữ liệu",
            noResultsOverlayLabel: "Không tìm thấy kết quả",
            toolbarDensity: "Mật độ hiển thị",
            toolbarDensityLabel: "Mật độ hiển thị",
            toolbarDensityCompact: "Gọn",
            toolbarDensityStandard: "Tiêu chuẩn",
            toolbarDensityComfortable: "Thoải mái",
            columnsManagementSearchTitle: "Tìm cột",
            columnsManagementShowHideAllText: "Hiện/ẩn tất cả",
            columnsManagementReset: "Đặt lại",
            paginationRowsPerPage: "Số dòng/trang",
            paginationDisplayedRows: ({ from, to, count }) => `${from}–${to} trên ${count !== -1 ? count : `hơn ${to}`}`,
          }}
          sx={{
            border: "none",
            minHeight: 320,
            minWidth: 0,
            "& .MuiDataGrid-cell": {
              borderBottom: "1px solid var(--mui-palette-divider)",
            },
          }}
        />
      </Box>
    </Card>
  );
}

function LoadingRowsOverlay(): ReactElement {
  return <LoadingState label="Đang tải danh sách..." inline size={24} />;
}

function EmptyRowsOverlay(): ReactElement {
  return (
    <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ height: "100%", minHeight: 220, color: "text.secondary" }}>
      <TableRowsOutlinedIcon sx={{ fontSize: 36, color: "text.disabled" }} />
      <Typography fontWeight={700}>Không có dữ liệu</Typography>
      <Typography variant="body2">Thử thay đổi bộ lọc hoặc tạo bản ghi mới.</Typography>
    </Stack>
  );
}
