"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import Link from "next/link";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import {
  MasterSelectField,
  type MasterSelectValue,
} from "@/components/shared/forms/MasterSelectField";
import {
  StudentSelectDialog,
  type StudentItem,
} from "@/components/shared/dialogs/StudentSelectDialog";
import { useDisclosure } from "@/hooks/useDisclosure";
import { ConfirmDialog } from "@/components/shared/dialogs/ConfirmDialog";
import { AppTextField } from "@/components/shared/forms/AppTextField";
import { DatePickerField } from "@/components/shared/forms/DatePickerField";
import { useSnackbar } from "@/hooks/useSnackbar";
import { getVietnamDate } from "@/lib/vietnam-time";
import { LoadingTableRow } from "@/components/shared/feedback/LoadingState";
import { FilterActions } from "@/components/shared/FilterActions";

type Batch = {
  id: string;
  batchNo: string;
  totalAmount: number;
  paymentMethod: string;
  status: string;
  paymentDate?: string | null;
  createdAt: string;
  student: { code: string; fullName: string };
  receipt?: { id: string } | null;
  allocations: Array<{
    amount: number;
    tuitionFee: { feeNo: string; class?: { name: string } | null };
  }>;
};

const money = (value: number) =>
  `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;
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
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}:${get("second")}`;
};
const statusLabels: Record<string, string> = {
  PENDING: "Chờ chuyển khoản / đối soát",
  SUCCESS: "Đã thanh toán",
  FAILED: "Thất bại",
  CANCELLED: "Đã hủy",
};
const statusColors: Record<
  string,
  "warning" | "success" | "error" | "default"
> = {
  PENDING: "warning",
  SUCCESS: "success",
  FAILED: "error",
  CANCELLED: "default",
};

export function PaymentBatchHistory() {
  const [items, setItems] = useState<Batch[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [transactionCode, setTransactionCode] = useState("");
  const [pendingTransactionCode, setPendingTransactionCode] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [pendingStudentCode, setPendingStudentCode] = useState("");
  const [student, setStudent] = useState<MasterSelectValue | null>(null);
  const [status, setStatus] = useState("");
  const [pendingStatus, setPendingStatus] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Batch | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cashTarget, setCashTarget] = useState<Batch | null>(null);
  const [cashPaymentDate, setCashPaymentDate] = useState(() => getVietnamDate());
  const [cashNote, setCashNote] = useState("");
  const [convertingCash, setConvertingCash] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelReasonError, setCancelReasonError] = useState("");
  const { showSuccess, Snackbar } = useSnackbar();
  const studentDialog = useDisclosure();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      page: String(page + 1),
      pageSize: String(pageSize),
    });
    if (transactionCode.trim()) {
      params.set("transactionCode", transactionCode.trim());
    }
    if (studentCode.trim()) params.set("studentCode", studentCode.trim());
    if (status) params.set("status", status);

    try {
      const response = await fetch(`/api/payment-batches?${params}`);
      if (!response.ok) {
        throw new Error(
          await extractApiErrorMessage(
            response,
            "Không thể tải lịch sử thu học phí",
          ),
        );
      }
      const result = await unwrapApiResponse<{ items: Batch[]; total: number }>(
        response,
      );
      setItems(result.items);
      setTotal(result.total);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể tải lịch sử thu học phí",
      );
    } finally {
      setLoading(false);
    }
  }, [transactionCode, studentCode, status, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  function clearSearch() {
    const hasSearchState = Boolean(
      transactionCode ||
        studentCode ||
        status ||
        pendingTransactionCode ||
        pendingStudentCode ||
        pendingStatus ||
        page !== 0,
    );
    setTransactionCode("");
    setPendingTransactionCode("");
    setStudent(null);
    setStudentCode("");
    setPendingStudentCode("");
    setStatus("");
    setPendingStatus("");
    setPage(0);
    if (!hasSearchState) return;
  }

  function applySearch() {
    setTransactionCode(pendingTransactionCode);
    setStudentCode(pendingStudentCode);
    setStatus(pendingStatus);
    setPage(0);
  }

  async function cancelBatch() {
    if (!cancelTarget) return;
    const reason = cancelReason.trim();
    if (!reason) {
      setCancelReasonError("Lý do hủy là bắt buộc");
      return;
    }
    setCancelReasonError("");
    setCancelling(true);
    try {
      const response = await fetch(
        `/api/payment-batches/${cancelTarget.id}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(
            response,
            "Không thể hủy đợt thanh toán",
          ),
        );
      setCancelTarget(null);
      await load();
      showSuccess("Đã hủy đợt thanh toán");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể hủy đợt thanh toán",
      );
    } finally {
      setCancelling(false);
    }
  }

  async function convertToCash() {
    if (!cashTarget) return;
    if (!cashPaymentDate) {
      setError("Ngày nhận tiền mặt là bắt buộc");
      return;
    }
    setConvertingCash(true);
    try {
      const response = await fetch(`/api/payment-batches/${cashTarget.id}/cash`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentDate: cashPaymentDate, note: cashNote || undefined }),
      });
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(response, "Không thể chuyển sang tiền mặt"),
        );
      setCashTarget(null);
      setExpanded(null);
      await load();
      showSuccess("Đã chuyển đợt thanh toán sang tiền mặt và phát hành biên lai");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể chuyển sang tiền mặt",
      );
    } finally {
      setConvertingCash(false);
    }
  }

  return (
    <Stack spacing={{ xs: 2, md: 3 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "flex-end" }} gap={2}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box sx={{ width: 48, height: 48, flexShrink: 0, borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: "primary.light", color: "primary.dark" }}>
              <ReceiptLongOutlinedIcon />
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={800} letterSpacing="-0.02em">Giao dịch thu học phí</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Theo dõi các đợt thu, đối soát chuyển khoản và biên lai.</Typography>
          </Box>
        </Stack>
        <Button variant="outlined" startIcon={<RefreshOutlinedIcon />} onClick={() => void load()} disabled={loading}>Làm mới</Button>
      </Stack>

      <Paper sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1.25} sx={{ mb: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <FilterAltOutlinedIcon color="primary" fontSize="small" />
            <Box>
              <Typography variant="subtitle1" fontWeight={800}>Tra cứu giao dịch</Typography>
          <Typography variant="caption" color="text.secondary">Lọc theo mã giao dịch, học viên và trạng thái xử lý</Typography>
            </Box>
          </Stack>
          <Chip size="small" variant="outlined" icon={<CalendarMonthOutlinedIcon />} label="Lịch sử thu học phí" />
        </Stack>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1}
          alignItems={{ xs: "stretch", md: "center" }}
        >
          <AppTextField
            size="small"
            label="Mã giao dịch"
            placeholder="Mã giao dịch hoặc dán nội dung QR"
            value={pendingTransactionCode}
            onChange={(event) => setPendingTransactionCode(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") applySearch(); }}
            sx={{ flex: 1, minWidth: { md: 240 } }}
          />
          <MasterSelectField
            label="Học viên"
            value={student}
            onOpen={studentDialog.onOpen}
            size="small"
            codeLabel="Mã học sinh"
            nameLabel="Họ tên"
            sx={{ flex: 1, minWidth: { md: 260 } }}
          />
          <AppTextField
            size="small"
            select
            label="Trạng thái"
            value={pendingStatus}
            onChange={(event) => setPendingStatus(event.target.value)}
            sx={{ minWidth: { md: 180 } }}
          >
            <MenuItem value="">Tất cả trạng thái</MenuItem>
            <MenuItem value="SUCCESS">Đã thanh toán</MenuItem>
            <MenuItem value="PENDING">Chờ chuyển khoản / đối soát</MenuItem>
            <MenuItem value="FAILED">Thất bại</MenuItem>
            <MenuItem value="CANCELLED">Đã hủy</MenuItem>
          </AppTextField>
          <FilterActions
            onSearch={applySearch}
            onClear={clearSearch}
            hasFilters={Boolean(transactionCode || studentCode || status || pendingTransactionCode || pendingStudentCode || pendingStatus || student || page)}
            isLoading={loading}
          />
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      <Paper sx={{ overflow: "hidden" }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1.25} sx={{ p: { xs: 2, md: 2.5 }, borderBottom: 1, borderColor: "divider" }}>
          <Box>
            <Typography variant="h6" fontWeight={800}>Danh sách đợt thu</Typography>
            <Typography variant="body2" color="text.secondary">{total} đợt thanh toán trong kết quả hiện tại</Typography>
          </Box>
          <Chip size="small" label={status ? statusLabels[status] : "Tất cả trạng thái"} variant="outlined" />
        </Stack>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: { xs: "block", md: "none" }, px: { xs: 2, md: 0 }, pb: 1 }}
        >
          Vuốt ngang để xem đầy đủ thông tin và thao tác.
        </Typography>
        <Box sx={{ overflowX: "auto" }}>
        <Table sx={{ minWidth: 900 }} size="small">
          <TableHead>
            <TableRow>
              <TableCell>Đợt thu</TableCell>
              <TableCell>Học viên</TableCell>
              <TableCell>Giá trị đợt thu</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell>Ngày tạo</TableCell>
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading &&
              items.map((batch) => (
                <Fragment key={batch.id}>
                  <TableRow
                    key={batch.id}
                    hover
                  >
                    <TableCell sx={{ minWidth: 170 }}>
                      <Button
                        component={Link}
                        href={`/admin/tuition-fees/payment-history/${batch.id}`}
                        size="small"
                        variant="text"
                        startIcon={<VisibilityOutlinedIcon />}
                        sx={{ p: 0, minWidth: 0, justifyContent: "flex-start", fontWeight: 800 }}
                      >
                        {batch.batchNo}
                      </Button>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                        {batch.paymentMethod === "BANK_TRANSFER"
                          ? "Chuyển khoản / VietQR"
                          : batch.paymentMethod === "CASH"
                            ? "Tiền mặt"
                            : "Phương thức cũ"}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ minWidth: 180 }}>
                      <Typography fontWeight={700}>
                        {batch.student.fullName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {batch.student.code}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ minWidth: 170 }}>
                      <Typography fontWeight={800}>
                        {money(Number(batch.totalAmount))}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {batch.allocations.length} khoản học phí
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={statusColors[batch.status] || "default"}
                        label={statusLabels[batch.status] || batch.status}
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 145 }}>
                      <Typography variant="body2">
                        {dateTime(batch.createdAt)}
                      </Typography>
                      {batch.status === "SUCCESS" && batch.paymentDate && (
                        <Typography variant="caption" color="text.secondary">
                          Thu: {dateTime(batch.paymentDate)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ minWidth: 155 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ExpandMoreIcon />}
                        aria-expanded={expanded === batch.id}
                        aria-controls={`batch-details-${batch.id}`}
                        onClick={() =>
                          setExpanded(expanded === batch.id ? null : batch.id)
                        }
                      >
                        {expanded === batch.id ? "Thu gọn" : "Xem khoản phí"}
                      </Button>
                    </TableCell>
                  </TableRow>
                  <TableRow key={`${batch.id}-detail`}>
                    <TableCell colSpan={6} sx={{ p: 0, border: 0 }}>
                      <Collapse in={expanded === batch.id} id={`batch-details-${batch.id}`}>
                        <Box sx={{ p: 2, bgcolor: "action.hover" }}>
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            justifyContent="space-between"
                            gap={1}
                            sx={{ mb: 1 }}
                          >
                            <Typography variant="subtitle2">
                              Các khoản học phí trong đợt
                            </Typography>
                            <Typography variant="subtitle2" color="primary.main">
                              Tổng: {money(Number(batch.totalAmount))}
                            </Typography>
                          </Stack>
                          {batch.allocations.map((allocation) => (
                            <Stack
                              key={allocation.tuitionFee.feeNo}
                              direction="row"
                              justifyContent="space-between"
                            >
                              <Typography variant="body2">
                                {allocation.tuitionFee.feeNo} ·{" "}
                                {allocation.tuitionFee.class?.name ||
                                  "Chưa có lớp"}
                              </Typography>
                              <Typography variant="body2">
                                {money(Number(allocation.amount))}
                              </Typography>
                            </Stack>
                          ))}
                          {batch.receipt && batch.status === "SUCCESS" ? (
                            <Button
                              size="small"
                              sx={{ mt: 1 }}
                              variant="outlined"
                              href={`/api/payment-batch-receipts/${batch.receipt.id}/pdf`}
                            >
                              Xuất biên lai
                            </Button>
                          ) : batch.status === "PENDING" ? (
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={1}
                              sx={{ mt: 1 }}
                            >
                              {batch.paymentMethod === "BANK_TRANSFER" && (
                                <>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    href={`/api/payment-batches/${batch.id}/notice/pdf`}
                                  >
                                    Tải thông báo PDF
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<PrintOutlinedIcon />}
                                    component="a"
                                    href={`/api/payment-batches/${batch.id}/notice/pdf?inline=1`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    Mở để in
                                  </Button>
                                  <Button
                                    size="small"
                                    color="warning"
                                    variant="outlined"
                                    onClick={() => {
                                      setCashPaymentDate(getVietnamDate());
                                      setCashNote("");
                                      setCashTarget(batch);
                                    }}
                                  >
                                    Chuyển sang tiền mặt
                                  </Button>
                                </>
                              )}
                              <Button
                                size="small"
                                color="error"
                                variant="outlined"
                                onClick={() => {
                                  setCancelReason("");
                                  setCancelReasonError("");
                                  setCancelTarget(batch);
                                }}
                              >
                                Hủy đợt thanh toán
                              </Button>
                            </Stack>
                          ) : null}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </Fragment>
              ))}
            {!loading && !items.length && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Stack alignItems="center" spacing={1} sx={{ py: 6, color: "text.secondary" }}>
                    <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 38, color: "text.disabled" }} />
                    <Typography fontWeight={700}>Chưa có đợt thu phù hợp</Typography>
                    <Typography variant="body2">Thử thay đổi bộ lọc để xem thêm giao dịch.</Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            )}
            {loading && <LoadingTableRow colSpan={6} label="Đang tải danh sách đợt thu..." />}
          </TableBody>
        </Table>
        </Box>
        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={pageSize}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          onRowsPerPageChange={(event) => {
            setPageSize(Number(event.target.value));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 20, 50, 100]}
          labelRowsPerPage="Số dòng/trang"
          labelDisplayedRows={({ from, to, count }) =>
            `${from}–${to} trên ${count !== -1 ? count : `hơn ${to}`}`
          }
        />
      </Paper>

      <StudentSelectDialog
        open={studentDialog.open}
        onClose={studentDialog.onClose}
        onSelect={(item: StudentItem) => {
          setStudent({ id: item.id, code: item.code, name: item.fullName });
          setPendingStudentCode(item.code);
          studentDialog.onClose();
        }}
        title="Chọn học viên xem lịch sử thanh toán"
      />
      <ConfirmDialog
        open={!!cancelTarget}
        title="Hủy đợt chuyển khoản"
        message={
          cancelTarget
            ? `Hủy đợt ${cancelTarget.batchNo}? Các khoản học phí sẽ được giải phóng để thu tiền mặt.`
            : ""
        }
        confirmLabel="Hủy đợt thanh toán"
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
        onConfirm={() => void cancelBatch()}
        onCancel={() => setCancelTarget(null)}
        isLoading={cancelling}
      />
      <ConfirmDialog
        open={!!cashTarget}
        title="Chuyển sang thanh toán tiền mặt"
        message={
          cashTarget
            ? `Xác nhận đã nhận ${money(Number(cashTarget.totalAmount))} tiền mặt từ ${cashTarget.student.fullName}? Hệ thống sẽ hoàn tất thanh toán và phát hành biên lai.`
            : ""
        }
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
              inputProps={{ maxLength: 1000 }}
            />
          </Stack>
        }
        confirmLabel="Xác nhận tiền mặt"
        cancelLabel="Quay lại"
        onConfirm={() => void convertToCash()}
        onCancel={() => setCashTarget(null)}
        isLoading={convertingCash}
      />
      {Snackbar}
    </Stack>
  );
}
