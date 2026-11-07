"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import { AppTextField } from "@/components/shared/forms/AppTextField";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { LoadingState } from "@/components/shared/feedback/LoadingState";

const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;

type Detail = {
  receiptNo: string;
  issuedAt: string;
  receiverName?: string | null;
  amount: number;
  status: string;
  payment: {
    id: string;
    paymentNo: string;
    paymentDate: string;
    paymentStatus: string;
    paymentMethod: string;
    transactionReference?: string | null;
    refunds: Array<{
      id: string;
      refundNo: string;
      amount: number;
      refundMethod: string;
      status: string;
      reason: string;
      bankTransactionNo?: string | null;
    }>;
    tuitionFee: {
      feeNo: string;
      finalAmount: number;
      discountAmount: number;
      additionalAmount: number;
      student: { id: string; code: string; fullName: string };
      class: { name: string };
      items: Array<{
        itemName: string;
        amount: number;
        classSubject?: { subject: { name: string } } | null;
      }>;
    };
  };
};

const paymentMethodLabels: Record<string, string> = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
  QR: "QR ngân hàng",
};
const receiptStatusLabels: Record<string, string> = {
  ACTIVE: "Đang hiệu lực",
  CANCELLED: "Đã hủy",
};
const refundStatusLabels: Record<string, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  COMPLETED: "Đã hoàn tất",
  CANCELLED: "Đã hủy",
};
const dateTime = (value: string) => {
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

const displayPayerName = (receiverName: string | null | undefined, student: { id: string; fullName: string }) => {
  const name = receiverName?.trim();
  const isUuid = Boolean(name && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(name));
  return name && !isUuid && name !== student.id ? name : student.fullName;
};

export function ReceiptDetailDialog({ id, onClose, onCancelled }: { id: string; onClose: () => void; onCancelled?: () => void }) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [refundDialog, setRefundDialog] = useState<"CREATE" | "COMPLETE" | null>(null);
  const [refundMethod, setRefundMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");
  const [refundReason, setRefundReason] = useState("");
  const [refundBankTransactionNo, setRefundBankTransactionNo] = useState("");
  const [refundLoading, setRefundLoading] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelReasonError, setCancelReasonError] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  const load = useCallback(() => {
    setError("");
    setData(null);
    return fetch(`/api/receipts/${id}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tải chi tiết biên lai"));
        return unwrapApiResponse<Detail>(response);
      })
      .then(setData)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Không thể tải chi tiết biên lai"));
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const activeRefund = data?.payment.refunds.find((refund) => !["REJECTED", "CANCELLED"].includes(refund.status));
  const isPartialReceipt = data ? Number(data.amount) < Number(data.payment.tuitionFee.finalAmount) : false;

  async function createRefund() {
    if (!refundReason.trim()) { setError("Vui lòng nhập lý do hoàn tiền"); return; }
    setRefundLoading(true);
    setError("");
    try {
      const response = await fetch("/api/payment-refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: data?.payment.id, refundMethod, reason: refundReason.trim() }),
      });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tạo yêu cầu hoàn tiền"));
      setRefundDialog(null);
      setRefundReason("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tạo yêu cầu hoàn tiền");
    } finally { setRefundLoading(false); }
  }

  async function approveRefund() {
    if (!activeRefund) return;
    setRefundLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/payment-refunds/${activeRefund.id}/approve`, { method: "POST" });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể duyệt hoàn tiền"));
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể duyệt hoàn tiền");
    } finally { setRefundLoading(false); }
  }

  async function completeRefund() {
    if (!activeRefund) return;
    if (activeRefund.refundMethod === "BANK_TRANSFER" && !refundBankTransactionNo.trim()) { setError("Vui lòng nhập mã giao dịch hoàn tiền"); return; }
    setRefundLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/payment-refunds/${activeRefund.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankTransactionNo: refundBankTransactionNo.trim() || undefined }),
      });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể hoàn tất hoàn tiền"));
      setRefundDialog(null);
      setRefundBankTransactionNo("");
      await load();
      onCancelled?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể hoàn tất hoàn tiền");
    } finally { setRefundLoading(false); }
  }

  async function cancelReceipt() {
    const reason = cancelReason.trim();
    if (!reason) { setCancelReasonError("Vui lòng nhập lý do hủy"); return; }
    setCancelLoading(true);
    setCancelReasonError("");
    setError("");
    try {
      const response = await fetch(`/api/receipts/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể hủy ghi nhận thanh toán"));
      setCancelDialogOpen(false);
      setCancelReason("");
      await load();
      onCancelled?.();
    } catch (reasonError) {
      setError(reasonError instanceof Error ? reasonError.message : "Không thể hủy ghi nhận thanh toán");
    } finally { setCancelLoading(false); }
  }

  return (
    <>
      <Dialog open onClose={onClose} fullWidth maxWidth="md" scroll="paper">
        <DialogTitle sx={{ p: 0 }}>
          <Stack direction="row" alignItems="flex-start" spacing={1.5} sx={{ p: { xs: 2, sm: 3 }, pb: 2 }}>
            <Box sx={{ display: "flex", p: 1, borderRadius: 2, bgcolor: "primary.50", color: "primary.main" }}><ReceiptLongOutlinedIcon /></Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.2 }}>Biên lai học phí</Typography>
              <Typography variant="h6" fontWeight={800}>Chi tiết biên lai</Typography>
              {data && <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>{data.receiptNo} · {data.payment.paymentNo}</Typography>}
            </Box>
            <IconButton aria-label="Đóng chi tiết biên lai" onClick={onClose} edge="end"><CloseOutlinedIcon /></IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          {error && <Box sx={{ p: { xs: 2, sm: 3 } }}><Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void load()}>Thử lại</Button>}>{error}</Alert></Box>}
          {!data && !error && <LoadingState label="Đang tải chi tiết biên lai..." minHeight={360} />}
          {data && (
            <Stack spacing={2.25} sx={{ p: { xs: 2, sm: 3 } }}>
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1.5}>
                <Box><Typography variant="body2" color="text.secondary">Trạng thái biên lai</Typography><Chip icon={data.status === "ACTIVE" ? <CheckCircleOutlineIcon /> : undefined} size="small" color={data.status === "ACTIVE" ? "success" : "default"} label={receiptStatusLabels[data.status] ?? data.status} sx={{ mt: 0.75, fontWeight: 700 }} /></Box>
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: { sm: "right" } }}>{data.status === "ACTIVE" ? "Biên lai đang được sử dụng để đối soát." : "Biên lai đã được hủy và không còn hiệu lực."}</Typography>
              </Stack>
              {activeRefund && <Alert severity={activeRefund.status === "COMPLETED" ? "success" : "warning"}>Hoàn tiền {activeRefund.refundNo}: {refundStatusLabels[activeRefund.status] ?? activeRefund.status} · {money(Number(activeRefund.amount))}</Alert>}
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 1.5 }}>
                <DetailMetric icon={<PaymentsOutlinedIcon />} label={isPartialReceipt ? "Số tiền lần thu" : "Tổng tiền"} value={money(Number(data.amount))} emphasis />
                <DetailMetric icon={<InfoOutlinedIcon />} label="Phương thức" value={paymentMethodLabels[data.payment.paymentMethod] ?? data.payment.paymentMethod} />
                <DetailMetric icon={<ReceiptLongOutlinedIcon />} label="Ngày thu" value={dateTime(data.payment.paymentDate)} />
              </Box>
              {isPartialReceipt && <Alert severity="info" icon={<InfoOutlinedIcon />}>Đây là thanh toán một phần. Các khoản thu còn lại có thể được thanh toán ở những lần thu khác.</Alert>}

              <DetailSection title="Học viên và khoản học phí" icon={<SchoolOutlinedIcon />}>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" }, columnGap: 3, rowGap: 1.5 }}>
                  <DetailRow label="Học viên" value={`${data.payment.tuitionFee.student.code} — ${data.payment.tuitionFee.student.fullName}`} strong />
                  <DetailRow label="Lớp" value={data.payment.tuitionFee.class.name} />
                  <DetailRow label="Mã học phí" value={data.payment.tuitionFee.feeNo} />
                  <DetailRow label="Người nộp" value={displayPayerName(data.receiverName, data.payment.tuitionFee.student)} />
                </Box>
              </DetailSection>

              <DetailSection title="Chi tiết khoản thu" icon={<PaymentsOutlinedIcon />}>
                <Stack spacing={1}>
                  {data.payment.tuitionFee.items.map((item, index) => <Stack key={`${item.itemName}-${index}`} direction="row" justifyContent="space-between" spacing={2}><Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>{item.classSubject?.subject.name || item.itemName}</Typography>{!isPartialReceipt && <Typography variant="body2" fontWeight={600} sx={{ whiteSpace: "nowrap" }}>{money(Number(item.amount))}</Typography>}</Stack>)}
                  {!isPartialReceipt && Number(data.payment.tuitionFee.discountAmount) > 0 && <DetailRow label="Giảm giá" value={`-${money(Number(data.payment.tuitionFee.discountAmount))}`} valueColor="success.main" />}
                  {!isPartialReceipt && Number(data.payment.tuitionFee.additionalAmount) > 0 && <DetailRow label="Phụ thu" value={money(Number(data.payment.tuitionFee.additionalAmount))} />}
                  <Divider />
                  <DetailRow label={isPartialReceipt ? "Số tiền lần thu" : "Tổng cộng"} value={money(Number(data.amount))} strong />
                </Stack>
              </DetailSection>

              <DetailSection title="Thông tin thanh toán" icon={<PersonOutlineOutlinedIcon />}>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" }, columnGap: 3, rowGap: 1.5 }}>
                  <DetailRow label="Mã payment" value={data.payment.paymentNo} />
                  <DetailRow label="Trạng thái payment" value={data.payment.paymentStatus === "SUCCESS" ? "Đã ghi nhận" : data.payment.paymentStatus} />
                  <DetailRow label="Phương thức" value={paymentMethodLabels[data.payment.paymentMethod] ?? data.payment.paymentMethod} />
                  <DetailRow label="Mã giao dịch" value={data.payment.transactionReference || "-"} />
                  <DetailRow label="Thời điểm phát hành biên lai" value={dateTime(data.issuedAt)} />
                </Box>
              </DetailSection>

              {data.status === "ACTIVE" && <DetailSection title="Thao tác" icon={<ReceiptLongOutlinedIcon />}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Chọn đúng thao tác theo tình huống: hủy ghi nhận nhầm khi chưa thực nhận tiền; hoàn tiền khi đã thực nhận và đã trả lại tiền.</Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap>
                  <Button variant="outlined" startIcon={<DownloadOutlinedIcon />} href={`/api/tuition-receipts/${id}/pdf`}>Tải PDF</Button>
                  <Button variant="outlined" startIcon={<PrintOutlinedIcon />} href={`/api/tuition-receipts/${id}/pdf?inline=1`} target="_blank" rel="noopener noreferrer">Mở để in</Button>
                  {data.payment.paymentStatus === "SUCCESS" && !activeRefund && <>
                    <Button variant="outlined" color="error" onClick={() => { setCancelReason(""); setCancelReasonError(""); setCancelDialogOpen(true); }} disabled={refundLoading || cancelLoading}>Hủy ghi nhận nhầm</Button>
                    <Button variant="outlined" color="warning" onClick={() => setRefundDialog("CREATE")} disabled={refundLoading || cancelLoading}>Tạo yêu cầu hoàn tiền</Button>
                  </>}
                  {activeRefund?.status === "PENDING" && <Button variant="outlined" color="warning" onClick={() => void approveRefund()} disabled={refundLoading}>Duyệt hoàn tiền</Button>}
                  {activeRefund?.status === "APPROVED" && <Button variant="contained" color="warning" onClick={() => setRefundDialog("COMPLETE")} disabled={refundLoading}>Hoàn tất hoàn tiền</Button>}
                </Stack>
              </DetailSection>}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 1.5 }}><Button variant="outlined" onClick={onClose}>Đóng</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(refundDialog)} onClose={() => !refundLoading && setRefundDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>{refundDialog === "CREATE" ? "Tạo yêu cầu hoàn tiền toàn bộ" : "Hoàn tất hoàn tiền"}</DialogTitle>
        <DialogContent dividers>
          {refundDialog === "CREATE" ? <Stack spacing={2}>
            <Alert severity="warning">Chỉ dùng khi tiền đã thực nhận và đã trả lại cho người nộp. Nếu chỉ ghi nhận nhầm và chưa thực nhận tiền, hãy quay lại và chọn “Hủy ghi nhận nhầm”.</Alert>
            <Typography variant="body2" color="text.secondary">Nếu payment thuộc batch nhiều khoản, toàn bộ batch sẽ được hoàn cùng lúc.</Typography>
            <AppTextField select fullWidth label="Phương thức hoàn" value={refundMethod} onChange={(event) => setRefundMethod(event.target.value as "CASH" | "BANK_TRANSFER")} SelectProps={{ native: true }}><option value="CASH">Tiền mặt</option><option value="BANK_TRANSFER">Chuyển khoản</option></AppTextField>
            <AppTextField fullWidth required multiline minRows={3} label="Lý do" value={refundReason} onChange={(event) => setRefundReason(event.target.value)} inputProps={{ maxLength: 500 }} />
          </Stack> : <AppTextField fullWidth label="Mã giao dịch hoàn tiền" required={activeRefund?.refundMethod === "BANK_TRANSFER"} value={refundBankTransactionNo} onChange={(event) => setRefundBankTransactionNo(event.target.value)} disabled={activeRefund?.refundMethod === "CASH"} helperText={activeRefund?.refundMethod === "CASH" ? "Không cần nhập với hoàn tiền mặt." : "Bắt buộc với hoàn tiền qua chuyển khoản."} />}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setRefundDialog(null)} disabled={refundLoading}>Quay lại</Button>
          <Button variant="contained" color="warning" onClick={() => void (refundDialog === "CREATE" ? createRefund() : completeRefund())} disabled={refundLoading || (refundDialog === "CREATE" ? !refundReason.trim() : activeRefund?.refundMethod === "BANK_TRANSFER" && !refundBankTransactionNo.trim())}>{refundLoading ? "Đang xử lý..." : refundDialog === "CREATE" ? "Tạo yêu cầu" : "Hoàn tất"}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={cancelDialogOpen} onClose={() => !cancelLoading && setCancelDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Hủy ghi nhận thanh toán?</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="warning">Chỉ dùng khi thanh toán được ghi nhận nhầm và chưa thực nhận tiền. Nếu biên lai thuộc một đợt thu, toàn bộ đợt sẽ được hoàn tác. Trường hợp đã nhận tiền và trả lại tiền, hãy dùng luồng hoàn tiền.</Alert>
            <AppTextField fullWidth required multiline minRows={3} label="Lý do hủy" value={cancelReason} onChange={(event) => { setCancelReason(event.target.value); if (event.target.value.trim()) setCancelReasonError(""); }} error={Boolean(cancelReasonError)} helperText={cancelReasonError || "Tối đa 500 ký tự"} inputProps={{ maxLength: 500 }} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setCancelDialogOpen(false)} disabled={cancelLoading}>Quay lại</Button>
          <Button variant="contained" color="error" onClick={() => void cancelReceipt()} disabled={cancelLoading || !cancelReason.trim()}>{cancelLoading ? "Đang hủy..." : "Xác nhận hủy"}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function DetailMetric({ icon, label, value, emphasis = false }: { icon: ReactNode; label: string; value: string; emphasis?: boolean }) {
  return <Paper variant="outlined" sx={{ p: 1.75, bgcolor: emphasis ? "action.hover" : "background.paper" }}><Stack direction="row" spacing={1.25} alignItems="flex-start"><Box sx={{ display: "flex", color: "primary.main", mt: 0.25 }}>{icon}</Box><Box sx={{ minWidth: 0 }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography fontWeight={800} sx={{ overflowWrap: "anywhere" }}>{value}</Typography></Box></Stack></Paper>;
}

function DetailSection({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <Paper variant="outlined" sx={{ p: { xs: 1.75, sm: 2.25 } }}><Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.75 }}><Box sx={{ display: "flex", color: "primary.main" }}>{icon}</Box><Typography variant="subtitle1" fontWeight={800}>{title}</Typography></Stack>{children}</Paper>;
}

function DetailRow({ label, value, strong = false, valueColor }: { label: string; value: ReactNode; strong?: boolean; valueColor?: string }) {
  return <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="body2" fontWeight={strong ? 800 : 500} color={valueColor} sx={{ textAlign: "right", overflowWrap: "anywhere" }}>{value}</Typography></Stack>;
}
