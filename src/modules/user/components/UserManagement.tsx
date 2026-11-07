"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import { LoadingTableRow } from "@/components/shared/feedback/LoadingState";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { FilterActions } from "@/components/shared/FilterActions";
import { ConfirmDialog } from "@/components/shared/dialogs/ConfirmDialog";
import { userCreateSchema, userUpdateSchema } from "@/modules/user/schemas/user.schema";
import { AppTextField } from "@/components/shared/forms/AppTextField";
import { TeacherSelectDialog } from "@/components/shared/dialogs/TeacherSelectDialog";

type User = {
  id: string;
  email: string;
  fullName: string;
  status: "ACTIVE" | "INACTIVE" | "LOCKED";
  teacherId: string | null;
  teacher: { id: string; code: string; fullName: string } | null;
};
type FormState = {
  email: string;
  fullName: string;
  password: string;
  status: User["status"];
  teacherId: string | null;
  teacherName: string;
};
type FormErrors = Partial<Record<keyof FormState, string>>;
const emptyForm: FormState = {
  email: "",
  fullName: "",
  password: "",
  status: "ACTIVE",
  teacherId: null,
  teacherName: "",
};
const statusLabel = {
  ACTIVE: "Hoạt động",
  INACTIVE: "Ngừng hoạt động",
  LOCKED: "Đã khóa",
} as const;
const statusColor: Record<User["status"], "success" | "warning" | "default"> = {
  ACTIVE: "success",
  INACTIVE: "default",
  LOCKED: "warning",
};

export function UserManagement() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [items, setItems] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);
  const [teacherDialogOpen, setTeacherDialogOpen] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page + 1),
        pageSize: String(pageSize),
      });
      if (appliedSearch) params.set("search", appliedSearch);
      if (appliedStatus) params.set("status", appliedStatus);
      const response = await fetch(`/api/users?${params}`);
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(response, "Không thể tải người dùng"),
        );
      const result = await unwrapApiResponse<{
        items: User[];
        total: number;
      }>(response);
      setItems(result.items);
      setTotal(result.total);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể tải người dùng",
      );
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, appliedSearch, appliedStatus]);
  useEffect(() => {
    void load();
  }, [load]);

  const applyFilters = () => {
    setAppliedSearch(search.trim());
    setAppliedStatus(status);
    setPage(0);
  };

  const clearFilters = () => {
    setSearch("");
    setAppliedSearch("");
    setStatus("");
    setAppliedStatus("");
    setPage(0);
  };
  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setFieldErrors({});
    setError("");
    setOpen(true);
  };
  const openEdit = (user: User) => {
    setEditing(user);
    setForm({
      email: user.email,
      fullName: user.fullName,
      password: "",
      status: user.status,
      teacherId: user.teacherId,
      teacherName: user.teacher ? `${user.teacher.code} - ${user.teacher.fullName}` : "",
    });
    setFieldErrors({});
    setError("");
    setOpen(true);
  };
  const submit = async () => {
    const payload = editing && !form.password ? { ...form, password: undefined } : form;
    const parsed = (editing ? userUpdateSchema : userCreateSchema).safeParse(payload);
    if (!parsed.success) {
      const nextErrors: FormErrors = {};
      const messages: Record<keyof FormState, string> = {
        email: "Email không hợp lệ hoặc vượt quá 255 ký tự",
        fullName: "Họ tên là bắt buộc và không quá 255 ký tự",
        password: "Mật khẩu phải từ 8 đến 100 ký tự",
        status: "Trạng thái không hợp lệ",
        teacherId: "Giáo viên không hợp lệ",
        teacherName: "Giáo viên không hợp lệ",
      };
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && field in emptyForm) {
          const key = field as keyof FormState;
          if (!nextErrors[key]) nextErrors[key] = messages[key];
        }
      }
      setError("");
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        editing ? `/api/users/${editing.id}` : "/api/users",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(response, "Không thể lưu người dùng"),
        );
      setMessage(editing ? "Đã cập nhật người dùng" : "Đã tạo người dùng");
      setOpen(false);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể lưu người dùng",
      );
    } finally {
      setLoading(false);
    }
  };
  const deactivate = async () => {
    if (!deactivateTarget) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/users/${deactivateTarget.id}`, {
        method: "DELETE",
      });
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(response, "Không thể khóa người dùng"),
        );
      setMessage("Đã khóa người dùng");
      setDeactivateTarget(null);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể khóa người dùng",
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <Stack spacing={{ xs: 2, md: 3 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "flex-end" }} gap={2}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box sx={{ width: 48, height: 48, flexShrink: 0, borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: "primary.light", color: "primary.dark" }}>
            <PeopleAltOutlinedIcon />
          </Box>
          <BoxTitle />
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Thêm người dùng</Button>
      </Stack>
      {message && (
        <Alert severity="success" onClose={() => setMessage("")}>
          {message}
        </Alert>
      )}
      {error && !open && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void load()}>Thử lại</Button>}>{error}</Alert>}
      <Paper sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1.25} sx={{ mb: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <FilterAltOutlinedIcon color="primary" fontSize="small" />
            <Box>
              <Typography fontWeight={800}>Tra cứu tài khoản</Typography>
              <Typography variant="caption" color="text.secondary">Tìm theo email, họ tên hoặc trạng thái hoạt động</Typography>
            </Box>
          </Stack>
          <Chip size="small" variant="outlined" label={status ? statusLabel[status as User["status"]] : "Tất cả trạng thái"} />
        </Stack>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} alignItems={{ md: "center" }}>
          <AppTextField
            fullWidth
            size="small"
            label="Tìm email hoặc họ tên"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            onKeyDown={(event) => { if (event.key === "Enter") applyFilters(); }}
            InputProps={{ startAdornment: <SearchOutlinedIcon fontSize="small" sx={{ mr: 1, color: "text.secondary" }} /> }}
            sx={{ flex: 1 }}
          />
          <FormControl size="small" sx={{ minWidth: { md: 210 } }}>
            <InputLabel id="user-status-filter-label">Trạng thái</InputLabel>
            <Select
              labelId="user-status-filter-label"
              label="Trạng thái"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
              }}
            >
              <MenuItem value="">Tất cả trạng thái</MenuItem>
              {Object.entries(statusLabel).map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}
            </Select>
          </FormControl>
          <FilterActions onSearch={applyFilters} onClear={clearFilters} hasFilters={Boolean(search.trim() || appliedSearch || status || appliedStatus)} isLoading={loading} />
        </Stack>
      </Paper>

      <Paper sx={{ overflow: "hidden" }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1.25} sx={{ p: { xs: 2, md: 2.5 }, borderBottom: 1, borderColor: "divider" }}>
          <Box>
            <Typography variant="h6" fontWeight={800}>Danh sách người dùng</Typography>
            <Typography variant="body2" color="text.secondary">{total} tài khoản trong kết quả hiện tại</Typography>
          </Box>
          <Chip size="small" color="primary" variant="outlined" label={loading ? "Đang tải" : `${items.length} tài khoản trên trang`} />
        </Stack>
        <Box sx={{ overflowX: "auto" }}>
        <Table sx={{ minWidth: 760 }} size="small">
          <TableHead>
            <TableRow>
              <TableCell>Tài khoản</TableCell>
              <TableCell>Email đăng nhập</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? <LoadingTableRow colSpan={4} label="Đang tải danh sách người dùng..." /> : !items.length ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Stack alignItems="center" spacing={1} sx={{ py: 5, color: "text.secondary" }}><PeopleAltOutlinedIcon sx={{ fontSize: 38, color: "text.disabled" }} /><Typography fontWeight={700}>Không có người dùng phù hợp</Typography><Typography variant="body2">Thử thay đổi từ khóa hoặc trạng thái lọc.</Typography></Stack>
                </TableCell>
              </TableRow>
            ) : (
              items.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell sx={{ minWidth: 220 }}><Typography fontWeight={700}>{user.fullName}</Typography><Typography variant="caption" color="text.secondary">{user.teacher ? `Giáo viên: ${user.teacher.fullName}` : "Tài khoản quản trị"}</Typography></TableCell>
                  <TableCell sx={{ minWidth: 260 }}><Typography variant="body2" color="text.secondary">{user.email}</Typography></TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={statusLabel[user.status]}
                      color={statusColor[user.status]}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.75} justifyContent="flex-end">
                    <Button size="small" variant="outlined" startIcon={<VisibilityOutlinedIcon />} onClick={() => openEdit(user)}>
                      Sửa
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      onClick={() => setDeactivateTarget(user)}
                      disabled={user.status === "INACTIVE" || loading}
                    >
                      Khóa
                    </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </Box>
        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={pageSize}
          onPageChange={(_, value) => setPage(value)}
          onRowsPerPageChange={(event) => {
            setPageSize(Number(event.target.value));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 20, 50]}
          labelRowsPerPage="Số dòng/trang"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} trên ${count !== -1 ? count : `hơn ${to}`}`}
        />
      </Paper>
      <Dialog
        open={open}
        onClose={() => !loading && setOpen(false)}
        fullWidth
        maxWidth="sm"
        fullScreen={isMobile}
      >
        <DialogTitle>
          {editing ? "Sửa người dùng" : "Thêm người dùng"}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <AppTextField
                label="Họ tên"
                required
                fullWidth
                value={form.fullName}
                error={Boolean(fieldErrors.fullName)}
                helperText={fieldErrors.fullName}
                onChange={(event) => {
                  setForm({ ...form, fullName: event.target.value });
                  setFieldErrors((current) => ({ ...current, fullName: undefined }));
                }}
              />
              <AppTextField
                label="Email"
                required
                fullWidth
                type="email"
                value={form.email}
                error={Boolean(fieldErrors.email)}
                helperText={fieldErrors.email}
                onChange={(event) => {
                  setForm({ ...form, email: event.target.value });
                  setFieldErrors((current) => ({ ...current, email: undefined }));
                }}
              />
            </Stack>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <AppTextField label="Liên kết hồ sơ giáo viên (không bắt buộc)" value={form.teacherName} fullWidth InputProps={{ readOnly: true }} helperText="Tài khoản liên kết chỉ được điểm danh các lớp được phân công." />
              <Button sx={{ mt: 0.5, minWidth: 110 }} variant="outlined" onClick={() => setTeacherDialogOpen(true)}>Chọn GV</Button>
              {form.teacherId && <Button sx={{ mt: 0.5 }} onClick={() => setForm({ ...form, teacherId: null, teacherName: "" })}>Bỏ liên kết</Button>}
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <AppTextField
                label={
                  editing ? "Mật khẩu mới (bỏ trống nếu không đổi)" : "Mật khẩu"
                }
                required={!editing}
                fullWidth
                type="password"
                value={form.password}
                error={Boolean(fieldErrors.password)}
                helperText={fieldErrors.password || (editing ? "Để trống nếu không đổi mật khẩu" : "Tối thiểu 8 ký tự")}
                onChange={(event) => {
                  setForm({ ...form, password: event.target.value });
                  setFieldErrors((current) => ({ ...current, password: undefined }));
                }}
              />
              <FormControl error={Boolean(fieldErrors.status)} fullWidth>
                <InputLabel>Trạng thái</InputLabel>
                <Select
                  label="Trạng thái"
                  value={form.status}
                  onChange={(event) => {
                    setForm({ ...form, status: event.target.value as FormState["status"] });
                    setFieldErrors((current) => ({ ...current, status: undefined }));
                  }}
                >
                  {Object.entries(statusLabel).map(([key, label]) => (
                    <MenuItem key={key} value={key}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
                {fieldErrors.status && <FormHelperText>{fieldErrors.status}</FormHelperText>}
              </FormControl>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setOpen(false)} disabled={loading}>
            Hủy
          </Button>
          <Button
            variant="contained"
            onClick={() => void submit()}
            disabled={loading}
          >
            {loading ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogActions>
      </Dialog>
      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        title="Khóa tài khoản"
        message={deactivateTarget ? `Tài khoản ${deactivateTarget.email} sẽ không thể đăng nhập. Bạn có muốn tiếp tục?` : "Bạn có chắc chắn muốn khóa tài khoản này không?"}
        confirmLabel="Khóa tài khoản"
        onConfirm={() => void deactivate()}
        onCancel={() => setDeactivateTarget(null)}
        isLoading={loading}
      />
      <TeacherSelectDialog
        open={teacherDialogOpen}
        onClose={() => setTeacherDialogOpen(false)}
        onSelect={(teacher) => {
          setForm((current) => ({ ...current, teacherId: teacher.id, teacherName: `${teacher.code} - ${teacher.name}` }));
          setTeacherDialogOpen(false);
        }}
      />
    </Stack>
  );
}

function BoxTitle() {
  return (
    <Box>
      <Typography variant="h5" fontWeight={700}>
        Quản lý người dùng
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Quản lý tài khoản đăng nhập và trạng thái hoạt động.
      </Typography>
    </Box>
  );
}
