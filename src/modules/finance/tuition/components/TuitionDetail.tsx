"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Alert,
  Button,
  Box,
  Chip,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from "@mui/material";
import Link from "next/link";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import RestoreOutlinedIcon from "@mui/icons-material/RestoreOutlined";
import { AppTextField } from "@/components/shared/forms/AppTextField";
import { ConfirmDialog } from "@/components/shared/dialogs/ConfirmDialog";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { useSnackbar } from "@/hooks/useSnackbar";
import { LoadingState } from "@/components/shared/feedback/LoadingState";
import { TuitionEditForm } from "./TuitionEditForm";

type Fee = {
  id: string;
  feeNo: string;
  billingYear: number;
  billingMonth: number;
  originalAmount: number;
  discountAmount: number;
  additionalAmount: number;
  finalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  version: number;
  dueDate?: string | null;
  status: "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE" | "EXEMPTED" | "CANCELLED";
  student: { code: string; fullName: string; phone?: string | null };
  class: { code: string; name: string; status: string };
  items: Array<{ itemName: string; quantity: number; amount: number }>;
  paymentAllocations?: Array<{
    paymentBatch: { id: string; batchNo: string; status: string };
  }>;
  payments: Array<{
    id: string;
    paymentNo: string;
    amount: number;
    paymentStatus: string;
    paymentMethod: string;
    paymentDate: string;
    receipt?: { id: string } | null;
  }>;
  auditLogs?: Array<{
    id: string;
    action: string;
    reason?: string | null;
    performedAt: string;
    performedByName: string;
  }>;
};
const labels = {
  UNPAID: "Chưa thanh toán",
  PARTIAL: "Đã thu một phần",
  PAID: "Đã thanh toán",
  OVERDUE: "Quá hạn",
  EXEMPTED: "Miễn học phí",
  CANCELLED: "Đã hủy",
};
const paymentMethodLabels: Record<string, string> = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
  QR: "QR ngân hàng",
};
const paymentStatusLabels: Record<string, string> = {
  SUCCESS: "Thành công",
  PENDING: "Đang chờ",
  FAILED: "Thất bại",
  CANCELLED: "Đã hủy",
  REFUNDED: "Đã hoàn tiền",
};
const auditActionLabels: Record<string, string> = {
  CREATED: "Tạo học phí",
  CREATED_MONTHLY_FROM_ENROLLMENT: "Tạo học phí tháng từ đăng ký học viên",
  UPDATE: "Cập nhật học phí",
  EXEMPT: "Miễn học phí",
  CANCEL: "Hủy học phí",
  TUITION_FEE_RESTORED: "Khôi phục học phí",
  TUITION_FEE_EXEMPTION_REVERSED: "Bỏ miễn học phí",
  PAID: "Đã thu đủ học phí",
  PARTIAL: "Thu một phần học phí",
};
const money = (value: number) => `${Number(value).toLocaleString("vi-VN")} ₫`;
const date = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
      })
    : "Chưa xác định";
const dateTime = (value: string) =>
  new Date(value).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
  });

export function TuitionDetail({
  id,
  mode = "page",
  onClose,
  onUpdated,
}: {
  id: string;
  mode?: "page" | "drawer";
  onClose?: () => void;
  onUpdated?: () => void;
}) {
  const [fee, setFee] = useState<Fee | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusAction, setStatusAction] = useState<
    "EXEMPTED" | "CANCELLED" | null
  >(null);
  const [statusReason, setStatusReason] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreReason, setRestoreReason] = useState("");
  const [restoreSaving, setRestoreSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const { showSuccess, Snackbar } = useSnackbar();
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/tuition-fees/${id}`);
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(
            response,
            "Không thể tải chi tiết học phí",
          ),
        );
      setFee(await unwrapApiResponse<Fee>(response));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể tải chi tiết học phí",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  async function submitStatusAction() {
    if (!fee || !statusAction || !statusReason.trim()) return;
    setStatusSaving(true);
    setActionError("");
    try {
      const response = await fetch(`/api/tuition-fees/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: statusAction,
          reason: statusReason.trim(),
          version: fee.version,
        }),
      });
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(
            response,
            "Không thể thay đổi trạng thái học phí",
          ),
        );
      setStatusAction(null);
      setStatusReason("");
      await load();
      onUpdated?.();
    } catch (reason) {
      setActionError(
        reason instanceof Error
          ? reason.message
          : "Không thể thay đổi trạng thái học phí",
      );
    } finally {
      setStatusSaving(false);
    }
  }

  async function restoreFee() {
    if (!fee || !restoreReason.trim()) return;
    setRestoreSaving(true);
    setActionError("");
    try {
      const response = await fetch(`/api/tuition-fees/${id}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: restoreReason.trim(),
          version: fee.version,
        }),
      });
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(
            response,
            fee.status === "EXEMPTED"
              ? "Không thể bỏ miễn học phí"
              : "Không thể khôi phục học phí",
          ),
        );
      setRestoreOpen(false);
      setRestoreReason("");
      showSuccess(
        fee.status === "EXEMPTED"
          ? "Đã bỏ miễn học phí, có thể thu tiền lại"
          : "Đã khôi phục học phí, có thể thu tiền lại",
      );
      await load();
      onUpdated?.();
    } catch (reason) {
      setActionError(
        reason instanceof Error
          ? reason.message
          : fee.status === "EXEMPTED"
            ? "Không thể bỏ miễn học phí"
            : "Không thể khôi phục học phí",
      );
    } finally {
      setRestoreSaving(false);
    }
  }
  const drawerShell = (children: ReactNode) => (
    <Drawer
      anchor="right"
      open={mode === "drawer"}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100vw", sm: 760 }, maxWidth: "100vw" } }}
    >
      <Box sx={{ p: { xs: 2, sm: 3 }, overflowY: "auto", height: "100%" }}>
        {children}
      </Box>
    </Drawer>
  );
  if (loading) {
    const loadingState = <LoadingState label="Đang tải chi tiết học phí..." minHeight={360} />;
    return mode === "drawer" ? drawerShell(loadingState) : loadingState;
  }
  if (error || !fee)
    return mode === "drawer" ? drawerShell(
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => void load()}>
            Thử lại
          </Button>
        }
      >
        {error || "Không tìm thấy học phí"}
      </Alert>
    ) : (
      <Alert
        severity="error"
        action={<Button color="inherit" size="small" onClick={() => void load()}>Thử lại</Button>}
      >
        {error || "Không tìm thấy học phí"}
      </Alert>
    );
  const paid = fee.status === "PAID";
  const pendingBatch = fee.paymentAllocations?.[0]?.paymentBatch;
  const editableStatus =
    (fee.status === "UNPAID" || fee.status === "OVERDUE") && !pendingBatch;
  const canPay =
    !paid &&
    fee.status !== "EXEMPTED" &&
    fee.status !== "CANCELLED" &&
    !fee.paymentAllocations?.length;
  const statusColor =
    fee.status === "PAID"
      ? "success"
      : fee.status === "OVERDUE"
        ? "error"
        : fee.status === "PARTIAL"
          ? "info"
          : "warning";
  const paymentProgress =
    fee.finalAmount > 0
      ? Math.min(100, Math.max(0, (fee.paidAmount / fee.finalAmount) * 100))
      : 0;
  if (editing) {
    return (
      <Drawer
        anchor="right"
        open={mode === "drawer"}
        onClose={onClose}
        PaperProps={{ sx: { width: { xs: "100vw", sm: 620 }, maxWidth: "100vw" } }}
      >
        <Box sx={{ p: { xs: 2, sm: 3 }, overflowY: "auto", height: "100%" }}>
          <TuitionEditForm
            id={id}
            embedded
            onCancel={() => setEditing(false)}
            onSuccess={() => {
              setEditing(false);
              showSuccess("Đã cập nhật học phí");
              void load();
              onUpdated?.();
            }}
          />
        </Box>
      </Drawer>
    );
  }
  const content = (
    <Stack
      spacing={{ xs: 2, md: 3 }}
      sx={{
        width: "100%",
        pb: 2,
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ md: "flex-start" }}
        gap={2}
      >
        <Box>
          {mode === "page" ? (
            <Button
              component={Link}
              href="/admin/tuition-fees"
              startIcon={<ArrowBackOutlinedIcon />}
              sx={{ mb: 1, px: 0 }}
            >
              Danh sách học phí
            </Button>
          ) : (
            <Button onClick={onClose} sx={{ mb: 1, px: 0 }}>Đóng</Button>
          )}
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
          >
            <Typography variant="h4" fontWeight={800}>
              {fee.feeNo}
            </Typography>
            <Chip color={statusColor} label={labels[fee.status]} />
          </Stack>
          <Typography color="text.secondary">
            Kỳ {fee.billingYear}-{String(fee.billingMonth).padStart(2, "0")} ·{" "}
            {fee.class.name}
          </Typography>
        </Box>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          flexWrap="wrap"
          useFlexGap
        >
          {canPay && (
            <Button
              component={Link}
              href={`/admin/tuition-fees/payment?tuitionFeeId=${id}`}
              variant="contained"
              size="large"
              startIcon={<PaymentsOutlinedIcon />}
            >
              {fee.status === "PARTIAL" ? "Thu phần còn lại" : "Thu tiền"}
            </Button>
          )}
          {pendingBatch && (
            <>
              <Button
                component={Link}
                href={`/admin/tuition-fees/payment-history/${pendingBatch.id}`}
                variant="contained"
                color="warning"
              >
                Xử lý đợt thu
              </Button>
              <Button
                component="a"
                href={`/api/payment-batches/${pendingBatch.id}/notice/pdf`}
                variant="outlined"
              >
                Xuất thông báo
              </Button>
            </>
          )}
          {(fee.status === "CANCELLED" || fee.status === "EXEMPTED") &&
            fee.class.status !== "COMPLETED" &&
            fee.class.status !== "CANCELLED" && (
            <Button
              variant="contained"
              color="success"
              startIcon={<RestoreOutlinedIcon />}
              onClick={() => { setActionError(""); setRestoreOpen(true); }}
            >
              {fee.status === "EXEMPTED"
                ? "Bỏ miễn, thu lại"
                : "Khôi phục học phí"}
            </Button>
          )}
          {editableStatus && (
            <>
              {mode === "drawer" ? (
                <Button
                  variant="outlined"
                  startIcon={<EditOutlinedIcon />}
                  onClick={() => setEditing(true)}
                >
                  Chỉnh sửa
                </Button>
              ) : (
                <Button
                  component={Link}
                  href={`/admin/tuition-fees/${id}/edit`}
                  variant="outlined"
                  startIcon={<EditOutlinedIcon />}
                >
                  Chỉnh sửa
                </Button>
              )}
              <Button
                variant="outlined"
                color="warning"
                onClick={() => { setActionError(""); setStatusAction("EXEMPTED"); }}
              >
                Miễn học phí
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={() => { setActionError(""); setStatusAction("CANCELLED"); }}
              >
                Hủy học phí
              </Button>
            </>
          )}
        </Stack>
      </Stack>

      {pendingBatch && (
        <Alert severity="warning">
          Khoản phí đang chờ thanh toán trong đợt{" "}
          <strong>{pendingBatch.batchNo}</strong>. Không thể chỉnh sửa hoặc tạo
          thanh toán khác.
        </Alert>
      )}

      <Paper
        sx={{
          p: { xs: 2, md: 3 },
          border: "1px solid",
          borderColor:
            fee.remainingAmount > 0 ? "warning.light" : "success.light",
          bgcolor: "background.paper",
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1.2fr 2fr" },
            gap: { xs: 2, md: 4 },
            alignItems: "center",
          }}
        >
          <Box>
            <Typography variant="body2" color="text.secondary">
              Số tiền còn phải thu
            </Typography>
            <Typography
              variant="h3"
              fontWeight={800}
              color={fee.remainingAmount > 0 ? "warning.dark" : "success.dark"}
              sx={{ mt: 0.5 }}
            >
              {money(fee.remainingAmount)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {fee.remainingAmount > 0
                ? "Có thể thu toàn bộ hoặc chia thành nhiều lần."
                : "Khoản phí đã được thanh toán đủ."}
            </Typography>
          </Box>
          <Box>
            <Stack direction="row" justifyContent="space-between" mb={0.75}>
              <Typography variant="body2" color="text.secondary">
                Tiến độ thanh toán
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {Math.round(paymentProgress)}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={paymentProgress}
              color={fee.remainingAmount > 0 ? "warning" : "success"}
              sx={{ height: 10, borderRadius: 5 }}
            />
            <Stack direction="row" justifyContent="space-between" mt={1.25}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Đã thu
                </Typography>
                <Typography fontWeight={700}>
                  {money(fee.paidAmount)}
                </Typography>
              </Box>
              <Box textAlign="right">
                <Typography variant="caption" color="text.secondary">
                  Tổng phải thu
                </Typography>
                <Typography fontWeight={700}>
                  {money(fee.finalAmount)}
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Box>
      </Paper>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: "minmax(0, 1fr) minmax(0, 1fr)",
          },
          gap: 2,
        }}
      >
        <Paper
          sx={{
            p: { xs: 2, md: 3 },
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
            Thông tin khoản phí
          </Typography>
          <Stack spacing={2}>
            <Info title="Học viên">
              <Typography fontWeight={700}>{fee.student.fullName}</Typography>
              <Typography variant="body2" color="text.secondary">
                {fee.student.code} · SĐT: {fee.student.phone || "-"}
              </Typography>
            </Info>
            <Divider />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
              <Info title="Lớp học">
                <Typography fontWeight={700}>{fee.class.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {fee.class.code}
                </Typography>
              </Info>
              <Info title="Hạn thanh toán">
                <Typography fontWeight={700}>{date(fee.dueDate)}</Typography>
              </Info>
            </Stack>
          </Stack>
        </Paper>

        <Paper
          sx={{
            p: { xs: 2, md: 3 },
            overflow: "hidden",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>
            Chi tiết số tiền
          </Typography>
          <Table
            size="small"
            sx={{ minWidth: 0, width: "100%", tableLayout: "fixed" }}
          >
            <TableBody>
              {fee.items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell sx={{ pl: 0, width: "68%", overflowWrap: "anywhere" }}>
                    {item.itemName}
                    <Typography
                      component="span"
                      variant="body2"
                      color="text.secondary"
                    >{` × ${Number(item.quantity)}`}</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ pr: 0, width: "32%", whiteSpace: "nowrap" }}>
                    {money(item.amount)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow
                sx={{
                  "& td": { borderTop: 1, borderColor: "divider", pt: 1.5 },
                }}
              >
                <TableCell sx={{ pl: 0, overflowWrap: "anywhere" }}>Học phí gốc</TableCell>
                <TableCell align="right" sx={{ pr: 0, whiteSpace: "nowrap" }}>
                  {money(fee.originalAmount)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 0, overflowWrap: "anywhere" }}>Giảm giá / học bổng</TableCell>
                <TableCell align="right" sx={{ pr: 0, whiteSpace: "nowrap" }}>
                  -{money(fee.discountAmount)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 0, overflowWrap: "anywhere" }}>Phụ phí</TableCell>
                <TableCell align="right" sx={{ pr: 0, whiteSpace: "nowrap" }}>
                  {money(fee.additionalAmount)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 0, overflowWrap: "anywhere" }}>
                  <strong>Tổng phải thu</strong>
                </TableCell>
                <TableCell align="right" sx={{ pr: 0, whiteSpace: "nowrap" }}>
                  <strong>{money(fee.finalAmount)}</strong>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Paper>
      </Box>

      <Paper
        sx={{
          p: { xs: 2, md: 3 },
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          gap={1}
          sx={{ mb: 1 }}
        >
          <Box>
            <Typography variant="h6" fontWeight={800}>
              Lịch sử thanh toán
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Các lần thu và biên lai của khoản phí này
            </Typography>
          </Box>
          <Chip
            size="small"
            variant="outlined"
            label={`${fee.payments.length} giao dịch`}
          />
        </Stack>
        {fee.payments.length ? (
          fee.payments.map((payment, index) => (
            <Box
              key={payment.id}
              sx={{
                py: 1.5,
                borderTop: index ? "1px solid" : undefined,
                borderColor: "divider",
              }}
            >
              <Stack
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                gap={1.5}
              >
                <Box>
                  <Typography fontWeight={700}>
                    {money(payment.amount)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {payment.paymentNo} ·{" "}
                    {paymentMethodLabels[payment.paymentMethod] ??
                      payment.paymentMethod}{" "}
                    · {date(payment.paymentDate)}
                  </Typography>
                </Box>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  flexWrap="wrap"
                >
                  <Chip
                    size="small"
                    color={
                      payment.paymentStatus === "SUCCESS"
                        ? "success"
                        : "warning"
                    }
                    label={
                      paymentStatusLabels[payment.paymentStatus] ??
                      payment.paymentStatus
                    }
                  />
                  {payment.receipt && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<ReceiptLongOutlinedIcon />}
                      href={`/api/tuition-receipts/${payment.receipt.id}/pdf`}
                    >
                      Xuất biên lai
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Box>
          ))
        ) : (
          <Typography color="text.secondary" sx={{ py: 2 }}>
            Chưa có giao dịch thanh toán.
          </Typography>
        )}
      </Paper>
      <Paper
        sx={{
          p: { xs: 2, md: 3 },
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          gap={1}
          sx={{ mb: 1 }}
        >
          <Box>
            <Typography variant="h6" fontWeight={800}>
              Lịch sử nghiệp vụ
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Lịch sử thay đổi trạng thái và số tiền của khoản phí
            </Typography>
          </Box>
          <Chip
            size="small"
            variant="outlined"
            label={`${fee.auditLogs?.length ?? 0} thao tác`}
          />
        </Stack>
        {fee.auditLogs?.length ? (
          fee.auditLogs.map((log, index) => (
            <Box
              key={log.id}
              sx={{
                py: 1.5,
                borderTop: index ? "1px solid" : undefined,
                borderColor: "divider",
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                gap={1}
              >
                <Box>
                  <Typography fontWeight={700}>
                    {auditActionLabels[log.action] ?? log.action}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {log.reason || "Không có lý do"}
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  textAlign={{ sm: "right" }}
                >
                  {dateTime(log.performedAt)}
                  <br />
                  {log.performedByName}
                </Typography>
              </Stack>
            </Box>
          ))
        ) : (
          <Typography color="text.secondary" sx={{ py: 2 }}>
            Chưa có lịch sử nghiệp vụ.
          </Typography>
        )}
      </Paper>
      <Dialog
        open={Boolean(statusAction)}
        onClose={() => !statusSaving && setStatusAction(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {statusAction === "EXEMPTED" ? "Miễn học phí" : "Hủy khoản học phí"}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {statusAction === "EXEMPTED"
              ? "Khoản phí sẽ không còn được đưa vào công nợ hoặc thanh toán."
              : "Khoản phí sẽ được hủy và không còn được thu. Có thể khôi phục lại khi cần; lịch sử hủy vẫn được lưu."}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Học phí: <strong>{fee.feeNo}</strong>
          </Typography>
          {actionError && (
            <Alert severity="error" sx={{ mb: 1.5 }}>
              {actionError}
            </Alert>
          )}
          <AppTextField
            fullWidth
            required
            multiline
            minRows={2}
            label="Lý do"
            value={statusReason}
            onChange={(event) => setStatusReason(event.target.value)}
            inputProps={{ maxLength: 500 }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            onClick={() => setStatusAction(null)}
            disabled={statusSaving}
          >
            Hủy
          </Button>
          <Button
            variant="contained"
            color={statusAction === "EXEMPTED" ? "warning" : "error"}
            onClick={() => void submitStatusAction()}
            disabled={statusSaving || !statusReason.trim()}
          >
            {statusSaving ? "Đang lưu..." : "Xác nhận"}
          </Button>
        </DialogActions>
      </Dialog>
      <ConfirmDialog
        open={restoreOpen}
        title={fee.status === "EXEMPTED" ? "Bỏ miễn học phí" : "Khôi phục học phí"}
        message={
          fee.status === "EXEMPTED"
            ? "Khoản phí sẽ bỏ trạng thái miễn và chuyển về chưa thanh toán hoặc quá hạn để có thể thu lại. Lịch sử miễn vẫn được lưu trong nhật ký nghiệp vụ."
            : "Khoản phí sẽ chuyển về trạng thái chưa thanh toán để có thể thu lại. Lịch sử hủy vẫn được lưu trong nhật ký nghiệp vụ."
        }
        content={
          <>
            {actionError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {actionError}
              </Alert>
            )}
            <AppTextField
              fullWidth
              required
              multiline
              minRows={2}
              label={fee.status === "EXEMPTED" ? "Lý do bỏ miễn" : "Lý do khôi phục"}
              value={restoreReason}
              onChange={(event) => setRestoreReason(event.target.value)}
              inputProps={{ maxLength: 500 }}
              sx={{ mt: 2 }}
            />
          </>
        }
        onConfirm={() => void restoreFee()}
        onCancel={() => {
          if (!restoreSaving) {
            setRestoreOpen(false);
            setRestoreReason("");
          }
        }}
        isLoading={restoreSaving}
        confirmDisabled={!restoreReason.trim()}
        confirmLabel={fee.status === "EXEMPTED" ? "Bỏ miễn và thu lại" : "Khôi phục"}
        confirmColor="success"
      />
      {Snackbar}
    </Stack>
  );
  return mode === "drawer" ? drawerShell(content) : content;
}

function Info({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack minWidth={0} flex={1}>
      <Typography variant="caption" color="text.secondary">
        {title}
      </Typography>
      {children}
    </Stack>
  );
}
