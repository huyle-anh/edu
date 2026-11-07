"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Paper, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import { useForm } from "react-hook-form";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { AppTextField } from "@/components/shared/forms/AppTextField";
import { PageHeader } from "@/components/shared/PageHeader";
import { useSnackbar } from "@/hooks/useSnackbar";
import { LoadingTableRow } from "@/components/shared/feedback/LoadingState";

type Account = { id: string; bankCode: string; bankName: string; accountNo: string; accountName: string; branchName?: string | null; currencyCode: string; isActive: boolean };
type FormValues = { bankCode: string; bankName: string; accountNo: string; accountName: string; branchName: string; currencyCode: string };
const emptyValues: FormValues = { bankCode: "", bankName: "", accountNo: "", accountName: "", branchName: "", currencyCode: "VND" };

export function BankAccountManagement() {
  const [items, setItems] = useState<Account[]>([]);
  const [editing, setEditing] = useState<Account | null>(null);
  const [open, setOpen] = useState(false);
  const [showInactive, setShowInactive] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState("");
  const { showSuccess, Snackbar } = useSnackbar();
  const load = useCallback(async () => { setLoading(true); setError(""); try { const response = await fetch(`/api/bank-accounts?includeInactive=${showInactive}`); if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tải tài khoản ngân hàng")); setItems(await unwrapApiResponse<Account[]>(response)); } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tải tài khoản ngân hàng"); } finally { setLoading(false); } }, [showInactive]);
  useEffect(() => { void load(); }, [load]);
  function startCreate() { setEditing(null); setDialogError(""); setOpen(true); }
  function startEdit(item: Account) { setEditing(item); setDialogError(""); setOpen(true); }
  async function toggle(item: Account) {
    setTogglingId(item.id);
    setError("");
    try {
      const response = await fetch(`/api/bank-accounts/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !item.isActive }) });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể cập nhật trạng thái tài khoản"));
      await load();
      showSuccess(item.isActive ? "Đã ngưng sử dụng tài khoản" : "Đã kích hoạt tài khoản");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Không thể cập nhật trạng thái tài khoản";
      setError(message);
    } finally {
      setTogglingId(null);
    }
  }
  async function save(values: FormValues) {
    setSaving(true);
    setDialogError("");
    setError("");
    try {
      const response = await fetch(editing ? `/api/bank-accounts/${editing.id}` : "/api/bank-accounts", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể lưu tài khoản ngân hàng"));
      setOpen(false);
      await load();
      showSuccess(editing ? "Đã cập nhật tài khoản ngân hàng" : "Đã lưu tài khoản ngân hàng");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Không thể lưu tài khoản ngân hàng";
      setDialogError(message);
    } finally {
      setSaving(false);
    }
  }
  return <Stack spacing={{ xs: 2, md: 3 }}>
    <PageHeader
      title="Tài khoản nhận chuyển khoản"
      description="Quản lý tài khoản ngân hàng dùng để nhận học phí."
      actions={<Button variant="contained" startIcon={<AddIcon />} onClick={startCreate}>Thêm tài khoản</Button>}
    />
    {error && <Alert severity="error" action={<Button color="inherit" size="small" startIcon={<RefreshOutlinedIcon />} onClick={() => void load()} disabled={loading}>Thử lại</Button>}>{error}</Alert>}
    <Paper sx={{ p: { xs: 2, md: 2.5 } }}>
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" gap={1}>
        <Typography variant="subtitle1" fontWeight={700}>Tài khoản sử dụng cho thu học phí</Typography>
        <FormControlLabel control={<Switch checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />} label="Hiển thị tài khoản đã ngưng sử dụng" />
      </Stack>
    </Paper>
    <Paper sx={{ overflow: "hidden" }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "block", md: "none" }, px: 2, pt: 1.5, pb: 1 }}>Vuốt ngang để xem đầy đủ thông tin và thao tác.</Typography>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ width: "100%", minWidth: { xs: 980, md: 0 } }}>
          <TableHead><TableRow><TableCell sx={{ minWidth: { xs: 240, md: 0 } }}>Ngân hàng</TableCell><TableCell sx={{ minWidth: { xs: 160, md: 0 } }}>Số tài khoản</TableCell><TableCell sx={{ minWidth: { xs: 180, md: 0 } }}>Chủ tài khoản</TableCell><TableCell sx={{ minWidth: { xs: 140, md: 0 } }}>Chi nhánh</TableCell><TableCell sx={{ minWidth: { xs: 90, md: 0 } }}>Tiền tệ</TableCell><TableCell sx={{ minWidth: { xs: 120, md: 0 } }}>Trạng thái</TableCell><TableCell sx={{ minWidth: { xs: 230, md: 0 } }} /></TableRow></TableHead>
          <TableBody>
            {!loading && items.map((item) => <TableRow key={item.id} hover><TableCell sx={{ minWidth: { xs: 240, md: 0 } }}>{item.bankName}<br /><Typography variant="caption" color="text.secondary">{item.bankCode}</Typography></TableCell><TableCell sx={{ minWidth: { xs: 160, md: 0 } }}>{item.accountNo}</TableCell><TableCell sx={{ minWidth: { xs: 180, md: 0 } }}>{item.accountName}</TableCell><TableCell sx={{ minWidth: { xs: 140, md: 0 } }}>{item.branchName || "-"}</TableCell><TableCell sx={{ minWidth: { xs: 90, md: 0 } }}>{item.currencyCode}</TableCell><TableCell sx={{ minWidth: { xs: 120, md: 0 } }}><Chip size="small" color={item.isActive ? "success" : "default"} label={item.isActive ? "Đang dùng" : "Đã ngưng"} /></TableCell><TableCell sx={{ minWidth: { xs: 230, md: 0 } }}><Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" justifyContent="flex-end"><Button size="small" variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => startEdit(item)}>Sửa</Button><Button size="small" variant="outlined" color={item.isActive ? "warning" : "success"} disabled={togglingId === item.id} onClick={() => void toggle(item)}>{togglingId === item.id ? "Đang cập nhật..." : item.isActive ? "Ngưng dùng" : "Kích hoạt"}</Button></Stack></TableCell></TableRow>)}
            {!loading && !items.length && <TableRow><TableCell colSpan={7}><Typography sx={{ p: 4 }} textAlign="center" color="text.secondary">Chưa có tài khoản ngân hàng</Typography></TableCell></TableRow>}
            {loading && <LoadingTableRow colSpan={7} label="Đang tải tài khoản ngân hàng..." />}
          </TableBody>
        </Table>
      </Box>
    </Paper>
    <AccountDialog open={open} editing={editing} saving={saving} error={dialogError} onClose={() => { setDialogError(""); setOpen(false); }} onSave={save} />{Snackbar}
  </Stack>;
}

function AccountDialog({ open, editing, saving, error, onClose, onSave }: { open: boolean; editing: Account | null; saving: boolean; error: string; onClose: () => void; onSave: (values: FormValues) => Promise<void> }) {
  const form = useForm<FormValues>({ defaultValues: emptyValues });
  useEffect(() => { form.reset(editing ? { bankCode: editing.bankCode, bankName: editing.bankName, accountNo: editing.accountNo, accountName: editing.accountName, branchName: editing.branchName || "", currencyCode: editing.currencyCode } : emptyValues); }, [editing, form, open]);
  return <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm"><DialogTitle>{editing ? "Sửa tài khoản nhận chuyển khoản" : "Thêm tài khoản nhận chuyển khoản"}</DialogTitle><form onSubmit={form.handleSubmit(onSave)}><DialogContent dividers>{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}<Stack spacing={2}><AppTextField fullWidth label="Mã ngân hàng" {...form.register("bankCode", { required: "Mã ngân hàng là bắt buộc" })} error={!!form.formState.errors.bankCode} helperText={form.formState.errors.bankCode?.message} /><AppTextField fullWidth label="Tên ngân hàng" {...form.register("bankName", { required: "Tên ngân hàng là bắt buộc" })} error={!!form.formState.errors.bankName} helperText={form.formState.errors.bankName?.message} /><AppTextField fullWidth label="Số tài khoản" {...form.register("accountNo", { required: "Số tài khoản là bắt buộc" })} error={!!form.formState.errors.accountNo} helperText={form.formState.errors.accountNo?.message} /><AppTextField fullWidth label="Tên chủ tài khoản" {...form.register("accountName", { required: "Tên chủ tài khoản là bắt buộc" })} error={!!form.formState.errors.accountName} helperText={form.formState.errors.accountName?.message} /><AppTextField fullWidth label="Chi nhánh" {...form.register("branchName")} /><AppTextField fullWidth label="Loại tiền" {...form.register("currencyCode", { required: "Loại tiền là bắt buộc" })} error={!!form.formState.errors.currencyCode} helperText={form.formState.errors.currencyCode?.message} /></Stack></DialogContent><DialogActions><Button variant="outlined" onClick={onClose} disabled={saving}>Hủy</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</Button></DialogActions></form></Dialog>;
}
