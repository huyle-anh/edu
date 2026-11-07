"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { AppTextField } from "@/components/shared/forms/AppTextField";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingTableRow } from "@/components/shared/feedback/LoadingState";
import { FilterActions } from "@/components/shared/FilterActions";

type Subject = {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
};

export function SubjectManagement() {
  const [items, setItems] = useState<Subject[]>([]);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Subject["status"]>("ACTIVE");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/subjects?includeInactive=true${appliedSearch ? `&search=${encodeURIComponent(appliedSearch)}` : ""}`,
      );
      if (!response.ok) {
        throw new Error(await extractApiErrorMessage(response, "Không thể tải danh sách môn học"));
      }
      setItems(await unwrapApiResponse<Subject[]>(response));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải danh sách môn học");
    } finally {
      setLoading(false);
    }
  }, [appliedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  function applySearch() {
    setAppliedSearch(search.trim());
  }

  function clearSearch() {
    setSearch("");
    setAppliedSearch("");
  }

  function openCreate() {
    setEditing(null);
    setName("");
    setStatus("ACTIVE");
    setError("");
    setDialogOpen(true);
  }
  function openEdit(item: Subject) {
    setEditing(item);
    setName(item.name);
    setStatus(item.status);
    setError("");
    setDialogOpen(true);
  }

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        editing ? `/api/subjects/${editing.id}` : "/api/subjects",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editing ? { name, status } : { name }),
        },
      );
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(response, "Không thể lưu môn học"),
        );
      setDialogOpen(false);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể lưu môn học",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={{ xs: 2, md: 3 }}>
      {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void load()}>Thử lại</Button>}>{error}</Alert>}
      <PageHeader
        title="Quản lý môn học"
        description="Danh sách môn học được sử dụng trong các lớp."
        actions={<Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Thêm môn học</Button>}
      />
      <Paper sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ sm: "center" }}
        >
          <AppTextField
            size="small"
            placeholder="Tìm theo tên môn học..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") applySearch(); }}
            sx={{ minWidth: { sm: 280 }, maxWidth: 460, flex: 1 }}
            InputProps={{ startAdornment: <SearchOutlinedIcon fontSize="small" color="action" sx={{ mr: 1 }} /> }}
          />
          <FilterActions onSearch={applySearch} onClear={clearSearch} hasFilters={Boolean(search.trim() || appliedSearch)} isLoading={loading} />
        </Stack>
      </Paper>
      <Paper sx={{ overflow: "auto" }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Tên môn học</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? <LoadingTableRow colSpan={3} label="Đang tải danh sách môn học..." /> : items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={
                      item.status === "ACTIVE"
                        ? "Đang hoạt động"
                        : "Ngừng hoạt động"
                    }
                    color={item.status === "ACTIVE" ? "success" : "default"}
                  />
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<EditOutlinedIcon />}
                    onClick={() => openEdit(item)}
                  >
                    Sửa
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && !items.length && (
              <TableRow>
                <TableCell colSpan={3}>
                  <Typography
                    sx={{ p: 3 }}
                    textAlign="center"
                    color="text.secondary"
                  >
                    Chưa có môn học
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
      <Dialog
        open={dialogOpen}
        onClose={() => !saving && setDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{editing ? "Sửa môn học" : "Thêm môn học"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <AppTextField
              label="Tên môn học"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              disabled={saving}
            />
            {editing && (
              <AppTextField
                select
                SelectProps={{ native: true }}
                label="Trạng thái"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as Subject["status"])
                }
                disabled={saving}
              >
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="INACTIVE">Ngừng hoạt động</option>
              </AppTextField>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDialogOpen(false)} disabled={saving}>
            Hủy
          </Button>
          <Button
            variant="contained"
            onClick={() => void save()}
            disabled={saving || !name.trim()}
          >
            Lưu
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
