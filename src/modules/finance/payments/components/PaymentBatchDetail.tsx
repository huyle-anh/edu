"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import Link from "next/link";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/shared/dialogs/ConfirmDialog";
import { AppTextField } from "@/components/shared/forms/AppTextField";
import { DatePickerField } from "@/components/shared/forms/DatePickerField";
import { useSnackbar } from "@/hooks/useSnackbar";
import { getVietnamDate } from "@/lib/vietnam-time";
import { LoadingState } from "@/components/shared/feedback/LoadingState";

type Batch = {
  id: string;
  batchNo: string;
  totalAmount: number;
  paymentMethod: string;
  status: string;
  paymentDate?: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string | null;
  bankTransactionNo?: string | null;
  transactionReference?: string | null;
  payerName?: string | null;
  paymentContent?: string | null;
  student: { id: string; code: string; fullName: string; phone?: string | null };
  bankAccount?: { accountNo: string; accountName: string; bankName: string } | null;
  receipt?: { id: string; receiptNo: string; issuedAt: string; printedAt?: string | null; amount: number } | null;
  createdByUser?: { fullName: string; email: string } | null;
  confirmedByUser?: { fullName: string; email: string } | null;
  receivedByUser?: { fullName: string; email: string } | null;
  allocations: Array<{
    amount: number;
    tuitionFee: {
      feeNo: string;
      finalAmount: number;
      originalAmount: number;
      discountAmount: number;
      additionalAmount: number;
      dueDate?: string | null;
      class: { code: string; name: string };
      items: Array<{
        itemName: string;
        quantity: number;
        unitPrice: number;
        amount: number;
        classSubject?: { subject: { name: string } } | null;
      }>;
    };
  }>;
  payments: Array<{
    paymentNo: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    receipt?: { id: string; receiptNo: string } | null;
  }>;
};

const money = (value: number) =>
  `${new Intl.NumberFormat("vi-VN").format(Number(value))} VND`;
const date = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "-";
const dateTime = (value?: string | null) => {
  if (!value) return "-";
  const parts = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}:${get("second")}`;
};
const displayPayerName = (
  payerName: string | null | undefined,
  student: Batch["student"],
) => {
  const name = payerName?.trim();
  const looksLikeId = Boolean(
    name &&
      (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(name) || name === student.id),
  );
  return name && !looksLikeId ? name : student.fullName;
};
const statusLabels: Record<string, string> = {
  PENDING: "Chờ chuyển khoản / đối soát",
  SUCCESS: "Đã thanh toán",
  FAILED: "Thất bại",
  CANCELLED: "Đã hủy",
};
const statusColors: Record<string, "warning" | "success" | "error" | "default"> = {
  PENDING: "warning",
  SUCCESS: "success",
  FAILED: "error",
  CANCELLED: "default",
};

export function PaymentBatchDetail({ id }: { id: string }) {
  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cashDialogOpen, setCashDialogOpen] = useState(false);
  const [cashPaymentDate, setCashPaymentDate] = useState(() => getVietnamDate());
  const [cashNote, setCashNote] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelReasonError, setCancelReasonError] = useState("");
  const [reverseDialogOpen, setReverseDialogOpen] = useState(false);
  const [reverseReason, setReverseReason] = useState("");
  const [reverseReasonError, setReverseReasonError] = useState("");
  const { showSuccess, Snackbar } = useSnackbar();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/payment-batches/${id}`);
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(response, "Không thể tải chi tiết đợt thanh toán"),
        );
      setBatch(await unwrapApiResponse<Batch>(response));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải chi tiết đợt thanh toán");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function convertToCash() {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/payment-batches/${id}/cash`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentDate: cashPaymentDate, note: cashNote || undefined }),
      });
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(response, "Không thể chuyển sang tiền mặt"),
        );
      setCashDialogOpen(false);
      await load();
      showSuccess("Đã chuyển đợt thanh toán sang tiền mặt và phát hành biên lai");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể chuyển sang tiền mặt");
    } finally {
      setActionLoading(false);
    }
  }

  async function cancelPayment() {
    const reason = cancelReason.trim();
    if (!reason) {
      setCancelReasonError("Lý do hủy là bắt buộc");
      return;
    }
    setCancelReasonError("");
    setActionLoading(true);
    try {
      const response = await fetch(`/api/payment-batches/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(response, "Không thể hủy thanh toán"),
        );
      setCancelDialogOpen(false);
      await load();
      showSuccess("Đã hủy đợt thanh toán");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể hủy thanh toán");
    } finally {
      setActionLoading(false);
    }
  }

  async function reverseSuccessfulBatch() {
    const reason = reverseReason.trim();
    const receiptId = batch?.payments.find((payment) => payment.receipt?.id)?.receipt?.id;
    if (!reason) {
      setReverseReasonError("Lý do hủy là bắt buộc");
      return;
    }
    if (!receiptId) {
      setError("Không tìm thấy biên lai chi tiết để hoàn tác đợt thanh toán");
      return;
    }
    setReverseReasonError("");
    setActionLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/receipts/${receiptId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) {
        throw new Error(await extractApiErrorMessage(response, "Không thể hủy ghi nhận thanh toán"));
      }
      setReverseDialogOpen(false);
      setReverseReason("");
      await load();
      showSuccess("Đã hủy ghi nhận thanh toán và giải phóng toàn bộ đợt thu");
    } catch (reasonError) {
      setError(
        reasonError instanceof Error
          ? reasonError.message
          : "Không thể hủy ghi nhận thanh toán",
      );
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <LoadingState label="Đang tải chi tiết đợt thu..." minHeight={360} />;
  if (error || !batch)
    return (
      <Alert
        severity="error"
        action={
          <Button
            color="inherit"
            size="small"
            startIcon={<RefreshOutlinedIcon />}
            onClick={() => void load()}
            disabled={loading}
          >
            Thử lại
          </Button>
        }
      >
        {error || "Không tìm thấy đợt thanh toán"}
      </Alert>
    );

  return (
    <Stack spacing={{ xs: 2, md: 3 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "center" }}
        gap={1}
      >
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Chi tiết đợt thanh toán
          </Typography>
          <Typography color="text.secondary">{batch.batchNo}</Typography>
        </Box>
        <Button
          component={Link}
          href="/admin/tuition-fees/payment-history"
          variant="outlined"
          startIcon={<ArrowBackOutlinedIcon />}
        >
          Quay lại lịch sử
        </Button>
      </Stack>

      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            gap={2}
          >
            <Stack spacing={0.75}>
              <Typography variant="h6">{batch.batchNo}</Typography>
              <Chip
                sx={{ alignSelf: "flex-start" }}
                color={statusColors[batch.status] || "default"}
                label={statusLabels[batch.status] || batch.status}
              />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              {batch.status === "PENDING" && (
                <>
                  {batch.paymentMethod === "BANK_TRANSFER" && (
                    <>
                      <Button
                        variant="outlined"
                        color="warning"
                        onClick={() => {
                          setCashPaymentDate(getVietnamDate());
                          setCashNote("");
                          setCashDialogOpen(true);
                        }}
                      >
                        Chuyển sang tiền mặt
                      </Button>
                      <Button
                        variant="outlined"
                        href={`/api/payment-batches/${batch.id}/notice/pdf`}
                      >
                        Tải thông báo PDF
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<PrintOutlinedIcon />}
                        component="a"
                        href={`/api/payment-batches/${batch.id}/notice/pdf?inline=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Mở để in
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => {
                      setCancelReason("");
                      setCancelReasonError("");
                      setCancelDialogOpen(true);
                    }}
                  >
                    Hủy thanh toán
                  </Button>
                </>
              )}
              {batch.status === "SUCCESS" && batch.payments.some((payment) => Boolean(payment.receipt?.id)) && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => {
                    setReverseReason("");
                    setReverseReasonError("");
                    setReverseDialogOpen(true);
                  }}
                  disabled={actionLoading}
                >
                  Hủy ghi nhận nhầm
                </Button>
              )}
              {batch.receipt && batch.status === "SUCCESS" && (
                <>
                  <Button
                    variant="outlined"
                    href={`/api/payment-batch-receipts/${batch.receipt.id}/pdf`}
                  >
                    Tải biên lai
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<PrintOutlinedIcon />}
                    href={`/api/payment-batch-receipts/${batch.receipt.id}/pdf?inline=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Mở để in
                  </Button>
                </>
              )}
            </Stack>
          </Stack>
          <Divider />
          <InfoGrid>
            <Info label="Học viên" value={`${batch.student.code} — ${batch.student.fullName}`} />
            <Info label="Số điện thoại" value={batch.student.phone || "-"} />
            <Info label="Phương thức" value={paymentMethodLabel(batch.paymentMethod)} />
            <Info label="Tổng tiền" value={money(batch.totalAmount)} strong />
            <Info label="Ngày tạo" value={dateTime(batch.createdAt)} />
            <Info
              label="Ngày thanh toán"
              value={batch.status === "SUCCESS" ? dateTime(batch.paymentDate) : "-"}
            />
            <Info label="Nhân viên tạo" value={batch.createdByUser?.fullName || "-"} />
            <Info
              label={batch.paymentMethod === "CASH" ? "Nhân viên nhận tiền" : "Nhân viên xác nhận"}
              value={
                batch.paymentMethod === "CASH"
                  ? batch.receivedByUser?.fullName || batch.confirmedByUser?.fullName || "-"
                  : batch.confirmedByUser?.fullName || "-"
              }
            />
          </InfoGrid>
        </Stack>
      </Paper>

      {batch.status === "PENDING" && (
        <Alert
          severity="warning"
          variant="filled"
          sx={{
            alignItems: "flex-start",
            boxShadow: 2,
            "& .MuiAlert-message": { width: "100%" },
          }}
        >
          <AlertTitle sx={{ fontWeight: 800 }}>
            Đợt thanh toán đang chờ xử lý
          </AlertTitle>
          Chưa ghi nhận thanh toán thành công. Vui lòng đối soát chuyển khoản,
          chuyển sang tiền mặt hoặc hủy thanh toán nếu cần.
        </Alert>
      )}
      {batch.status === "CANCELLED" && (
        <Alert severity="error" variant="filled" sx={{ boxShadow: 2 }}>
          <AlertTitle sx={{ fontWeight: 800 }}>Đợt thanh toán đã bị hủy</AlertTitle>
          Các khoản học phí trong đợt đã được giải phóng để có thể tạo thanh toán lại.
        </Alert>
      )}

      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          Các khoản học phí trong đợt
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Tiền môn học lấy theo chi tiết từng môn; tổng khoản học phí là số tiền sau khi áp dụng giảm giá và phụ phí.
        </Typography>
        <Table sx={{ minWidth: 760 }} size="small">
          <TableHead>
            <TableRow>
              <TableCell>Mã học phí</TableCell>
              <TableCell>Lớp</TableCell>
              <TableCell>Môn học</TableCell>
              <TableCell align="right">Tiền môn học</TableCell>
              <TableCell>Hạn thanh toán</TableCell>
              <TableCell align="right">Tổng khoản học phí</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {batch.allocations.map((allocation) => {
              const items = allocation.tuitionFee.items.length
                ? allocation.tuitionFee.items
                : [null];
              return items.map((item, index) => (
                <TableRow key={`${allocation.tuitionFee.feeNo}-${item?.itemName || "total"}`}>
                  <TableCell>{index === 0 ? allocation.tuitionFee.feeNo : ""}</TableCell>
                  <TableCell>{index === 0 ? `${allocation.tuitionFee.class.code} — ${allocation.tuitionFee.class.name}` : ""}</TableCell>
                  <TableCell>
                    {item?.classSubject?.subject.name || item?.itemName || "Chưa có chi tiết môn học"}
                  </TableCell>
                  <TableCell align="right">{money(item ? item.amount : allocation.amount)}</TableCell>
                  {index === 0 && (
                    <TableCell rowSpan={items.length}>{date(allocation.tuitionFee.dueDate)}</TableCell>
                  )}
                  {index === 0 && (
                    <TableCell align="right" rowSpan={items.length}>
                      <Typography fontWeight={700}>{money(allocation.amount)}</Typography>
                      {(allocation.tuitionFee.discountAmount || allocation.tuitionFee.additionalAmount) && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Sau điều chỉnh
                        </Typography>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ));
            })}
            <TableRow>
              <TableCell colSpan={5} align="right"><Typography fontWeight={700}>Tổng cộng đợt thanh toán</Typography></TableCell>
              <TableCell align="right"><Typography fontWeight={700}>{money(batch.totalAmount)}</Typography></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>

      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          Thông tin thanh toán và đối soát
        </Typography>
        <InfoGrid>
          <Info label="Người nộp" value={displayPayerName(batch.payerName, batch.student)} />
          <Info label="Nội dung thanh toán" value={batch.paymentContent || "-"} />
          <Info label="Mã giao dịch ngân hàng" value={batch.bankTransactionNo || "-"} />
          <Info label="Mã tham chiếu" value={batch.transactionReference || "-"} />
          <Info label="Tài khoản nhận" value={batch.bankAccount ? `${batch.bankAccount.bankName} — ${batch.bankAccount.accountNo}` : "-"} />
          <Info label="Ngày cập nhật" value={dateTime(batch.updatedAt)} />
          <Info label="Ngày in biên lai" value={batch.receipt?.printedAt ? dateTime(batch.receipt.printedAt) : "Chưa in"} />
        </InfoGrid>
        {batch.receipt && batch.status === "SUCCESS" && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Biên lai {batch.receipt.receiptNo} đã phát hành ngày {dateTime(batch.receipt.issuedAt)}
            {batch.paymentMethod === "CASH" &&
            (batch.receivedByUser || batch.confirmedByUser)
              ? ` bởi ${(batch.receivedByUser || batch.confirmedByUser)?.fullName}.`
              : "."}
          </Alert>
        )}
      </Paper>

      <ConfirmDialog
        open={cashDialogOpen}
        title="Chuyển sang thanh toán tiền mặt"
        message={`Xác nhận đã nhận ${money(batch.totalAmount)} tiền mặt từ ${batch.student.fullName}? Hệ thống sẽ hoàn tất thanh toán và phát hành biên lai.`}
        content={
          <Stack spacing={2} sx={{ mt: 2 }}>
            <DatePickerField
              label="Ngày nhận tiền"
              value={cashPaymentDate}
              onChange={setCashPaymentDate}
              textFieldProps={{ required: true }}
            />
            <AppTextField
              fullWidth
              multiline
              minRows={2}
              label="Ghi chú (nếu có)"
              value={cashNote}
              onChange={(event) => setCashNote(event.target.value)}
              inputProps={{ maxLength: 500 }}
            />
          </Stack>
        }
        confirmLabel="Xác nhận tiền mặt"
        cancelLabel="Quay lại"
        confirmColor="warning"
        onConfirm={() => void convertToCash()}
        onCancel={() => setCashDialogOpen(false)}
        isLoading={actionLoading}
      />
      <ConfirmDialog
        open={cancelDialogOpen}
        title="Hủy thanh toán"
        message={`Hủy đợt ${batch.batchNo}? Các khoản học phí sẽ được giải phóng để có thể tạo thanh toán lại.`}
        confirmLabel="Hủy thanh toán"
        cancelLabel="Quay lại"
        content={
          <AppTextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label="Lý do hủy"
            value={cancelReason}
            onChange={(event) => {
              setCancelReason(event.target.value);
              if (event.target.value.trim()) setCancelReasonError("");
            }}
            error={Boolean(cancelReasonError)}
            helperText={cancelReasonError || "Tối đa 500 ký tự"}
            inputProps={{ maxLength: 500 }}
            sx={{ mt: 2 }}
          />
        }
        onConfirm={() => void cancelPayment()}
        onCancel={() => setCancelDialogOpen(false)}
        isLoading={actionLoading}
      />
      <ConfirmDialog
        open={reverseDialogOpen}
        title="Hủy ghi nhận thanh toán?"
        message={`Hủy ghi nhận đợt ${batch.batchNo}? Tất cả payment và biên lai trong đợt sẽ bị hủy, các khoản học phí sẽ được mở lại.`}
        confirmLabel="Xác nhận hủy"
        cancelLabel="Quay lại"
        confirmColor="error"
        content={
          <Stack spacing={1} sx={{ mt: 2 }}>
            <Alert severity="warning">
              Chỉ dùng khi thanh toán được ghi nhận nhầm và chưa thực nhận tiền.
              Nếu đã nhận tiền và trả lại tiền, hãy dùng luồng hoàn tiền.
            </Alert>
            <AppTextField
              autoFocus
              fullWidth
              multiline
              minRows={3}
              label="Lý do hủy"
              value={reverseReason}
              onChange={(event) => {
                setReverseReason(event.target.value);
                if (event.target.value.trim()) setReverseReasonError("");
              }}
              error={Boolean(reverseReasonError)}
              helperText={reverseReasonError || "Tối đa 500 ký tự"}
              inputProps={{ maxLength: 500 }}
            />
          </Stack>
        }
        onConfirm={() => void reverseSuccessfulBatch()}
        onCancel={() => setReverseDialogOpen(false)}
        isLoading={actionLoading}
        confirmDisabled={!reverseReason.trim()}
      />
      {Snackbar}
    </Stack>
  );
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(4, 1fr)" }, gap: 2 }}>{children}</Box>;
}

function Info({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <Box><Typography variant="caption" color="text.secondary">{label}</Typography><Typography fontWeight={strong ? 700 : 500}>{value}</Typography></Box>;
}

function paymentMethodLabel(value: string) {
  if (value === "BANK_TRANSFER") return "Chuyển khoản / VietQR";
  if (value === "CASH") return "Tiền mặt";
  return "Phương thức cũ";
}
