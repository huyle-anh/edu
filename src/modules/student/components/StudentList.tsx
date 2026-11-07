"use client";

import {
  Box,
  Stack,
  Button,
  Alert,
  Chip,
  Collapse,
  Paper,
  Typography,
  InputAdornment,
  MenuItem,
  Select,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import SearchIcon from "@mui/icons-material/Search";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import { GridColDef } from "@mui/x-data-grid";
import { useState, useCallback, useEffect } from "react";
import { BaseTable } from "@/components/shared/tables/BaseTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormDialog } from "@/components/shared/dialogs/FormDialog";
import { ConfirmDialog } from "@/components/shared/dialogs/ConfirmDialog";
import { useList } from "@/hooks/useList";
import { useSnackbar } from "@/hooks/useSnackbar";
import { extractApiErrorMessage } from "@/lib/api-client";
import { StudentForm } from "./StudentForm";
import type { ReactElement } from "react";
import type { z } from "zod";
import { studentCreateSchema } from "@/modules/student/schemas/student.schema";
import { AppTextField } from "@/components/shared/forms/AppTextField";
import { FilterActions } from "@/components/shared/FilterActions";

type StudentFormData = z.infer<typeof studentCreateSchema>;

export interface Student {
  id: string;
  code: string;
  fullName: string;
  birthday?: string | null;
  parentName?: string | null;
  address?: string | null;
  phone?: string | null;
  status: "ACTIVE" | "INACTIVE";
}

type StudentRow = Student & {
  _onEdit?: (student: Student) => void;
  _onDelete?: (student: Student) => void;
};

const getColumns = (): GridColDef<StudentRow>[] => [
  {
    field: "code",
    headerName: "Mã học sinh",
    minWidth: 120,
    flex: 0.6,
  },
  {
    field: "fullName",
    headerName: "Họ tên",
    minWidth: 180,
    flex: 1,
  },
  {
    field: "address",
    headerName: "Địa chỉ",
    minWidth: 220,
    flex: 1.2,
    renderCell: (params) => (
      <Box
        sx={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
        }}
      >
        <Typography
          variant="body2"
          color={params.value ? "text.primary" : "text.disabled"}
          noWrap
          title={params.value || "Chưa cập nhật"}
        >
          {params.value || "Chưa cập nhật"}
        </Typography>
      </Box>
    ),
  },
  {
    field: "phone",
    headerName: "Số điện thoại",
    minWidth: 140,
  },
  {
    field: "status",
    headerName: "Trạng thái",
    minWidth: 140,
    align: "center",
    headerAlign: "center",
    renderCell: (params) => {
      const status = params.value as Student["status"];

      return (
        <Box
          sx={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Chip
            label={status === "ACTIVE" ? "Đang hoạt động" : "Ngừng hoạt động"}
            size="small"
            color={status === "ACTIVE" ? "success" : "error"}
            variant="outlined"
            sx={{
              minWidth: 90,
              fontWeight: 600,
              borderRadius: 999,
            }}
          />
        </Box>
      );
    },
  },
  {
    field: "actions",
    headerName: "Thao tác",
    minWidth: 300,
    sortable: false,
    filterable: false,
    disableColumnMenu: true,
    align: "center",
    headerAlign: "center",
    renderCell: (params) => (
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="center"
        sx={{
          width: "100%",
          height: "100%",
        }}
      >
        <Button
          size="small"
          variant="outlined"
          startIcon={<ManageAccountsOutlinedIcon fontSize="small" />}
          onClick={() => params.row._onEdit?.(params.row)}
          sx={{
            minWidth: 64,
          }}
        >
          Sửa
        </Button>

        <Button
          size="small"
          variant="outlined"
          color="error"
          startIcon={<BlockOutlinedIcon fontSize="small" />}
          onClick={() => params.row._onDelete?.(params.row)}
          sx={{
            minWidth: 162,
          }}
        >
          Ngừng hoạt động
        </Button>
      </Stack>
    ),
  },
];

export function StudentList(): ReactElement {
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [appliedStatus, setAppliedStatus] = useState("ALL");

  const {
    data,
    isLoading,
    error,
    page,
    pageSize,
    setPageNumber,
    setPageSize,
    refresh,
  } = useList<Student>("/api/students", { pageSize: 10, search: appliedSearch, status: appliedStatus });

  useEffect(() => {
    setPageNumber(1);
  }, [appliedSearch, appliedStatus, setPageNumber]);

  const applyFilters = useCallback(() => {
    setAppliedSearch(search.trim());
    setAppliedStatus(status);
    setPageNumber(1);
  }, [search, status, setPageNumber]);

  const clearFilters = useCallback(() => {
    setSearch("");
    setAppliedSearch("");
    setStatus("ALL");
    setAppliedStatus("ALL");
    setPageNumber(1);
  }, [setPageNumber]);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showImportHelp, setShowImportHelp] = useState(false);

  const { showSuccess, showError, Snackbar } = useSnackbar();

  const handleCreate = useCallback(() => {
    setEditingStudent(null);
    setOpenDialog(true);
  }, []);

  const handleEdit = useCallback((student: Student) => {
    setEditingStudent(student);
    setOpenDialog(true);
  }, []);

  const handleDelete = useCallback((student: Student) => {
    setDeleteId(student.id);
  }, []);

  const handleCloseDialog = useCallback(() => {
    if (isSubmitting) return;

    setOpenDialog(false);
    setEditingStudent(null);
  }, [isSubmitting]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteId) return;

    try {
      setIsSubmitting(true);

      const response = await fetch(`/api/students/${deleteId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(
          "Không thể chuyển học sinh sang trạng thái ngừng hoạt động",
        );
      }

      showSuccess("Đã chuyển học sinh sang trạng thái ngừng hoạt động");
      setDeleteId(null);
      await refresh();
    } catch (err) {
      showError(
        err instanceof Error
          ? err.message
          : "Có lỗi khi cập nhật trạng thái học sinh",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [deleteId, refresh, showSuccess, showError]);

  const handleSubmit = useCallback(
    async (formData: StudentFormData) => {
      try {
        setIsSubmitting(true);

        const isEdit = !!editingStudent?.id;

        const response = await fetch(
          isEdit ? `/api/students/${editingStudent.id}` : "/api/students",
          {
            method: isEdit ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          },
        );

        if (!response.ok) {
          throw new Error(
            await extractApiErrorMessage(
              response,
              isEdit ? "Cập nhật học sinh thất bại" : "Thêm học sinh thất bại",
            ),
          );
        }

        showSuccess(
          isEdit
            ? "Đã cập nhật học sinh thành công"
            : "Đã thêm học sinh thành công",
        );

        setOpenDialog(false);
        setEditingStudent(null);
        await refresh();
      } catch (err) {
        showError(
          err instanceof Error ? err.message : "Có lỗi khi lưu học sinh",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [editingStudent, refresh, showSuccess, showError],
  );

  const exportExcel = useCallback(async () => {
    try {
      setIsExporting(true);
      const query = new URLSearchParams({ export: "xlsx", status: appliedStatus });
      if (appliedSearch) query.set("search", appliedSearch);

      const response = await fetch(`/api/students?${query.toString()}`);
      if (!response.ok) {
        throw new Error(
          await extractApiErrorMessage(response, "Không thể xuất danh sách học viên"),
        );
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `danh-sach-hoc-vien-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Không thể xuất danh sách học viên",
      );
    } finally {
      setIsExporting(false);
    }
  }, [appliedSearch, appliedStatus, showError]);

  const tableData = (data?.items || []).map((row) => ({
    ...row,
    phone: row.phone ?? "",
    _onEdit: handleEdit,
    _onDelete: handleDelete,
  }));

  return (
    <Stack spacing={{ xs: 2, md: 3 }}>
      <Box>
        <PageHeader
          title="Quản lý học viên"
          description="Danh sách học viên, thông tin liên hệ và trạng thái."
          actions={
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreate}
                sx={{ whiteSpace: "nowrap" }}
              >
                Thêm học sinh
              </Button>
              <Button
                variant="outlined"
                component="label"
                disabled={isSubmitting}
                title="CSV có cột Họ tên và Số điện thoại; cũng hỗ trợ Họ, Tên, Số điện thoại"
                sx={{ whiteSpace: "nowrap" }}
              >
                Import CSV
                <input
                  hidden
                  type="file"
                  accept=".csv,text/csv"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;

                    try {
                      setIsSubmitting(true);
                      const form = new FormData();
                      form.append("file", file);
                      const response = await fetch("/api/students/import", {
                        method: "POST",
                        body: form,
                      });
                      if (!response.ok) {
                        throw new Error(
                          await extractApiErrorMessage(
                            response,
                            "Import học viên thất bại",
                          ),
                        );
                      }

                      const result = (await response.json()) as {
                        success: boolean;
                        data?: {
                          importedRows: number;
                          skippedRows: number;
                          errors: Array<{ rowNo: number; message: string }>;
                        };
                      };
                      if (!result.success || !result.data) {
                        throw new Error("Import học viên thất bại");
                      }

                      const errorMessage =
                        result.data.errors.length > 0
                          ? ` Có ${result.data.errors.length} dòng lỗi.`
                          : "";
                      showSuccess(
                        `Đã import ${result.data.importedRows} học viên, bỏ qua ${result.data.skippedRows} dòng.${errorMessage}`,
                      );
                      await refresh();
                    } catch (error) {
                      showError(
                        error instanceof Error
                          ? error.message
                          : "Import học viên thất bại",
                      );
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                />
              </Button>
              <Button
                variant="outlined"
                startIcon={<HelpOutlineOutlinedIcon />}
                onClick={() => setShowImportHelp((current) => !current)}
                aria-expanded={showImportHelp}
                aria-controls="student-import-help"
              >
                Hướng dẫn CSV
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadOutlinedIcon />}
                onClick={() => void exportExcel()}
                disabled={isSubmitting || isExporting}
                sx={{ whiteSpace: "nowrap" }}
              >
                {isExporting ? "Đang xuất..." : "Xuất Excel"}
              </Button>
            </Stack>
          }
        />
        <Collapse in={showImportHelp}>
          <Alert id="student-import-help" severity="info" sx={{ mt: 1.5 }}>
              CSV hỗ trợ cột “Họ tên” và “Số điện thoại”, hoặc tách riêng “Họ”
              và “Tên”. File danh sách đăng ký dạng cột 1 mã đăng ký/lớp, cột 2
              họ tên, cột 5 số điện thoại sẽ đưa cột 1 vào “Địa chỉ”.
          </Alert>
        </Collapse>
      </Box>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 2.5 },
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ sm: "center" }}
          justifyContent="space-between"
          sx={{ mb: 1.75 }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1.75,
                display: "grid",
                placeItems: "center",
                bgcolor: "action.hover",
                color: "primary.main",
              }}
            >
              <TuneOutlinedIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={800}>
                Tra cứu học viên
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Lọc nhanh danh sách theo thông tin và trạng thái
              </Typography>
            </Box>
          </Stack>
          <Chip
            size="small"
            variant="outlined"
            color={status === "ALL" ? "default" : "primary"}
            label={
              status === "ALL"
                ? "Tất cả trạng thái"
                : status === "ACTIVE"
                  ? "Đang hoạt động"
                  : "Ngừng hoạt động"
            }
          />
        </Stack>

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.25}
          alignItems={{ md: "center" }}
        >
          <AppTextField
            placeholder="Tìm theo mã học sinh, họ tên hoặc số điện thoại..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") applyFilters(); }}
            size="small"
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
            sx={{
              flex: 1,
              minWidth: 240,
              "& .MuiOutlinedInput-root": {
                borderRadius: 2,
                bgcolor: "background.default",
              },
            }}
          />
          <Select
            size="small"
            value={status}
            displayEmpty
            onChange={(event) => {
              setStatus(event.target.value);
            }}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="ALL">Tất cả trạng thái</MenuItem>
            <MenuItem value="ACTIVE">Đang hoạt động</MenuItem>
            <MenuItem value="INACTIVE">Ngừng hoạt động</MenuItem>
          </Select>
          <FilterActions onSearch={applyFilters} onClear={clearFilters} hasFilters={Boolean(search.trim()) || status !== "ALL" || Boolean(appliedSearch) || appliedStatus !== "ALL"} isLoading={isLoading} />
        </Stack>
      </Paper>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        alignItems={{ sm: "center" }}
        justifyContent="space-between"
        sx={{ px: { xs: 0.25, md: 0.5 } }}
      >
        <Box>
          <Typography variant="h6" fontWeight={800}>
            Danh sách học viên
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {data?.total || 0} học viên trong kết quả hiện tại
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          Có thể chỉnh sửa hoặc ngừng hoạt động ngay trên từng dòng
        </Typography>
      </Stack>

      <BaseTable
        columns={getColumns()}
        rows={tableData}
        totalRows={data?.total || 0}
        page={page}
        pageSize={pageSize}
        isLoading={isLoading}
        onPageChange={setPageNumber}
        onPageSizeChange={setPageSize}
        error={error}
        onRetry={refresh}
      />

      <FormDialog
        open={openDialog}
        title={editingStudent ? "Sửa học sinh" : "Thêm học sinh"}
        onClose={handleCloseDialog}
        formId="student-form"
        isLoading={isSubmitting}
      >
        <StudentForm
          key={editingStudent?.id ?? "create"}
          formId="student-form"
          onSubmit={handleSubmit}
          defaultValues={
            editingStudent
              ? {
                  fullName: editingStudent.fullName ?? "",
                  birthday: editingStudent.birthday ?? undefined,
                  parentName: editingStudent.parentName ?? "",
                  address: editingStudent.address ?? "",
                  phone: editingStudent.phone ?? "",
                  status: editingStudent.status ?? "ACTIVE",
                }
              : undefined
          }
        />
      </FormDialog>

      <ConfirmDialog
        open={!!deleteId}
        title="Ngừng hoạt động học sinh"
        message="Học sinh sẽ được giữ lại để bảo toàn lịch sử và chuyển sang trạng thái ngừng hoạt động. Tiếp tục?"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteId(null)}
        isLoading={isSubmitting}
      />

      {Snackbar}
    </Stack>
  );
}
