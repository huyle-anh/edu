"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from "@mui/material";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { AppTextField } from "@/components/shared/forms/AppTextField";
import { DatePickerField } from "@/components/shared/forms/DatePickerField";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { ReceiptDetailDialog } from "./ReceiptDetailDialog";
import { LoadingState } from "@/components/shared/feedback/LoadingState";
import { FilterActions } from "@/components/shared/FilterActions";

type Receipt = {
  id: string;
  receiptNo: string;
  issuedAt: string;
  printedAt?: string | null;
  receiverName?: string | null;
  amount: number;
  status: "ACTIVE" | "CANCELLED";
  payment: {
    paymentNo: string;
    paymentMethod: string;
    tuitionFee: {
      feeNo: string;
      student: { id: string; code: string; fullName: string };
      class: { name: string };
      items: Array<{
        itemName: string;
        classSubject: { subject: { name: string } } | null;
      }>;
    };
  };
};

type ReceiptResult = {
  items: Receipt[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;
const statusLabels = { ACTIVE: "Đang hiệu lực", CANCELLED: "Đã hủy" } as const;
const paymentMethodLabels: Record<string, string> = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
  QR: "QR ngân hàng",
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

export function ReceiptList() {
  const [items, setItems] = useState<Receipt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [appliedDateFrom, setAppliedDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedDateTo, setAppliedDateTo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const hasInvalidDateRange = appliedDateFrom && appliedDateTo && appliedDateFrom > appliedDateTo;
    if (hasInvalidDateRange) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      setError("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc");
      return () => controller.abort();
    }
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ page: String(page + 1), pageSize: String(pageSize) });
      if (appliedSearch.trim()) params.set("search", appliedSearch.trim());
      if (appliedStatus) params.set("status", appliedStatus);
      if (appliedDateFrom) params.set("dateFrom", appliedDateFrom);
      if (appliedDateTo) params.set("dateTo", appliedDateTo);
      void fetch(`/api/receipts?${params}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tải biên lai"));
          return unwrapApiResponse<ReceiptResult>(response);
        })
        .then((result) => {
          setItems(result.items);
          setTotal(result.total);
        })
        .catch((reason: unknown) => {
          if ((reason as { name?: string })?.name !== "AbortError") {
            setError(reason instanceof Error ? reason.message : "Không thể tải biên lai");
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [page, pageSize, appliedSearch, appliedStatus, appliedDateFrom, appliedDateTo, refreshKey]);

  const activeCount = items.filter((item) => item.status === "ACTIVE").length;
  const cancelledCount = items.filter((item) => item.status === "CANCELLED").length;
  const hasFilters = Boolean(search || status || dateFrom || dateTo || appliedSearch || appliedStatus || appliedDateFrom || appliedDateTo);

  function applyFilters() {
    setAppliedSearch(search.trim());
    setAppliedStatus(status);
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
    setPage(0);
  }

  function resetFilters() {
    setSearch("");
    setAppliedSearch("");
    setStatus("");
    setAppliedStatus("");
    setDateFrom("");
    setAppliedDateFrom("");
    setDateTo("");
    setAppliedDateTo("");
    setPage(0);
  }

  return (
    <Stack spacing={{ xs: 2, md: 3 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "flex-end" }} spacing={2}>
        <BoxTitle />
        <Button variant="outlined" startIcon={<RefreshOutlinedIcon />} onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}>
          Làm mới dữ liệu
        </Button>
      </Stack>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 1.5 }}>
        <SummaryCard icon={<ReceiptLongOutlinedIcon />} label="Tổng biên lai" value={total.toLocaleString("vi-VN")} helper="Theo bộ lọc hiện tại" />
        <SummaryCard icon={<CheckCircleOutlineIcon />} label="Đang hiệu lực" value={activeCount.toLocaleString("vi-VN")} helper="Trên trang hiện tại" tone="success" />
        <SummaryCard icon={<CancelOutlinedIcon />} label="Đã hủy" value={cancelledCount.toLocaleString("vi-VN")} helper="Trên trang hiện tại" tone="neutral" />
      </Box>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3 }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1.5} sx={{ mb: 1.75 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ display: "flex", p: 0.75, borderRadius: 1.5, bgcolor: "primary.50", color: "primary.main" }}><FilterAltOutlinedIcon fontSize="small" /></Box>
            <Box>
              <Typography fontWeight={800}>Tra cứu biên lai</Typography>
              <Typography variant="caption" color="text.secondary">Tìm theo mã biên lai, học viên, mã học phí hoặc payment</Typography>
            </Box>
          </Stack>
        </Stack>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} alignItems={{ md: "center" }}>
          <AppTextField
            fullWidth
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") applyFilters(); }}
            placeholder="Tìm số biên lai, mã học viên, họ tên hoặc mã học phí"
            InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: "text.secondary" }} /> }}
            sx={{ flex: 1 }}
          />
          <AppTextField select label="Trạng thái" value={status} onChange={(event) => setStatus(event.target.value)} sx={{ minWidth: { md: 190 } }}>
            <MenuItem value="">Tất cả trạng thái</MenuItem>
            <MenuItem value="ACTIVE">Đang hiệu lực</MenuItem>
            <MenuItem value="CANCELLED">Đã hủy</MenuItem>
          </AppTextField>
          <FilterActions onSearch={applyFilters} onClear={resetFilters} hasFilters={hasFilters} isLoading={loading} />
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ mt: 1.5 }}>
          <DatePickerField label="Từ ngày" value={dateFrom} onChange={setDateFrom} textFieldProps={{ error: Boolean(dateFrom && dateTo && dateFrom > dateTo) }} />
          <DatePickerField label="Đến ngày" value={dateTo} onChange={setDateTo} textFieldProps={{ error: Boolean(dateFrom && dateTo && dateFrom > dateTo), helperText: dateFrom && dateTo && dateFrom > dateTo ? "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc" : undefined }} />
        </Stack>
      </Paper>

      {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setRefreshKey((value) => value + 1)}>Thử lại</Button>}>{error}</Alert>}

      <Paper variant="outlined" sx={{ overflow: "hidden", borderRadius: 3 }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1.25} sx={{ p: { xs: 2, md: 2.5 }, borderBottom: 1, borderColor: "divider" }}>
          <Box>
            <Typography variant="h6" fontWeight={800}>Danh sách biên lai</Typography>
            <Typography variant="body2" color="text.secondary">{total.toLocaleString("vi-VN")} kết quả · Chọn một biên lai để xem đầy đủ thông tin</Typography>
          </Box>
          {hasFilters && <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {status && <Chip size="small" color={status === "ACTIVE" ? "success" : "default"} variant="outlined" label={statusLabels[status as keyof typeof statusLabels]} />}
            {dateFrom && <Chip size="small" variant="outlined" icon={<CalendarMonthOutlinedIcon />} label={`Từ ${dateFrom}`} />}
            {dateTo && <Chip size="small" variant="outlined" icon={<CalendarMonthOutlinedIcon />} label={`Đến ${dateTo}`} />}
            {search && <Chip size="small" variant="outlined" label={`Từ khóa: ${search}`} sx={{ maxWidth: 260 }} />}
          </Stack>}
        </Stack>

        {loading ? <LoadingState label="Đang tải danh sách biên lai..." minHeight={300} size={30} /> : !items.length ? <EmptyState hasFilters={hasFilters} onReset={resetFilters} /> : <>
          <TableContainer sx={{ display: { xs: "none", md: "block" } }}>
            <Table sx={{ minWidth: 1080 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Biên lai & payment</TableCell>
                  <TableCell>Người nộp</TableCell>
                  <TableCell>Khoản thu</TableCell>
                  <TableCell>Phát hành</TableCell>
                  <TableCell>Ngày in</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell align="right">Số tiền</TableCell>
                  <TableCell align="right">Thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => <ReceiptTableRow key={item.id} item={item} onOpen={() => setDetailId(item.id)} />)}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ display: { xs: "block", md: "none" }, p: 1.5 }}>
            <Stack spacing={1.25}>{items.map((item) => <ReceiptMobileCard key={item.id} item={item} onOpen={() => setDetailId(item.id)} />)}</Stack>
          </Box>
        </>}
        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={pageSize}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          onRowsPerPageChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50, 100]}
          labelRowsPerPage="Số dòng/trang"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} trên ${count !== -1 ? count : `hơn ${to}`}`}
          sx={{ borderTop: 1, borderColor: "divider" }}
        />
      </Paper>

      {detailId && <ReceiptDetailDialog id={detailId} onClose={() => setDetailId(null)} onCancelled={() => setRefreshKey((value) => value + 1)} />}
    </Stack>
  );
}

function BoxTitle() {
  return <Stack direction="row" spacing={1.5} alignItems="flex-start"><Box sx={{ width: 52, height: 52, flexShrink: 0, borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: "primary.light", color: "primary.dark" }}><ReceiptLongOutlinedIcon /></Box><Box><Typography variant="h4" fontWeight={800} letterSpacing="-0.02em">Biên lai học phí</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Tra cứu, xem chi tiết và tải lại biên lai đã phát hành.</Typography></Box></Stack>;
}

function SummaryCard({ icon, label, value, helper, tone = "primary" }: { icon: ReactNode; label: string; value: string; helper: string; tone?: "primary" | "success" | "neutral" }) {
  const colors = { primary: "primary.main", success: "success.main", neutral: "text.secondary" } as const;
  return <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}><Stack direction="row" spacing={1.25} alignItems="center"><Box sx={{ display: "flex", p: 1, borderRadius: 2, color: colors[tone], bgcolor: "action.hover" }}>{icon}</Box><Box><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="h5" fontWeight={800} lineHeight={1.15}>{value}</Typography><Typography variant="caption" color="text.secondary">{helper}</Typography></Box></Stack></Paper>;
}

function ReceiptTableRow({ item, onOpen }: { item: Receipt; onOpen: () => void }) {
  const payerName = displayPayerName(item.receiverName, item.payment.tuitionFee.student);
  return <TableRow hover sx={{ "&:last-child td": { borderBottom: 0 } }}>
    <TableCell sx={{ minWidth: 185 }}><Button size="small" variant="text" startIcon={<VisibilityOutlinedIcon />} onClick={onOpen} sx={{ p: 0, minWidth: 0, justifyContent: "flex-start", fontWeight: 800 }}>{item.receiptNo}</Button><Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>Payment {item.payment.paymentNo}</Typography></TableCell>
    <TableCell sx={{ minWidth: 190 }}><Typography variant="body2" fontWeight={700}>{payerName}</Typography><Typography variant="caption" color="text.secondary">Người nộp · {item.payment.tuitionFee.class.name}</Typography></TableCell>
    <TableCell sx={{ minWidth: 220 }}><Typography variant="body2" fontWeight={600}>{item.payment.tuitionFee.feeNo}</Typography><Typography variant="caption" color="text.secondary" sx={{ display: "block", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{feeSummary(item)}</Typography></TableCell>
    <TableCell sx={{ minWidth: 180 }}><Typography variant="body2">{dateTime(item.issuedAt)}</Typography><Typography variant="caption" color="text.secondary">{paymentMethodLabels[item.payment.paymentMethod] ?? item.payment.paymentMethod}</Typography></TableCell>
    <TableCell sx={{ minWidth: 165 }}><Typography variant="body2">{item.printedAt ? dateTime(item.printedAt) : "-"}</Typography></TableCell>
    <TableCell sx={{ minWidth: 135 }}><StatusChip status={item.status} /></TableCell>
    <TableCell align="right" sx={{ minWidth: 140 }}><Typography fontWeight={800} whiteSpace="nowrap">{money(Number(item.amount))}</Typography></TableCell>
    <TableCell align="right" sx={{ minWidth: 180 }}><Stack direction="row" spacing={0.75} justifyContent="flex-end"><Button size="small" variant="outlined" onClick={onOpen}>Chi tiết</Button>{item.status === "ACTIVE" && <Button size="small" variant="contained" href={`/api/tuition-receipts/${item.id}/pdf`} startIcon={<DownloadOutlinedIcon />} sx={{ whiteSpace: "nowrap" }}>PDF</Button>}</Stack></TableCell>
  </TableRow>;
}

function ReceiptMobileCard({ item, onOpen }: { item: Receipt; onOpen: () => void }) {
  const payerName = displayPayerName(item.receiverName, item.payment.tuitionFee.student);
  return <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2.5 }}><Stack spacing={1.5}>
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}><Box sx={{ minWidth: 0 }}><Button size="small" variant="text" startIcon={<VisibilityOutlinedIcon />} onClick={onOpen} sx={{ p: 0, minWidth: 0, justifyContent: "flex-start", fontWeight: 800 }}>{item.receiptNo}</Button><Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>Payment {item.payment.paymentNo}</Typography></Box><StatusChip status={item.status} /></Stack>
    <Divider />
    <Stack direction="row" spacing={1} alignItems="flex-start"><PersonOutlineOutlinedIcon fontSize="small" color="action" /><Box sx={{ minWidth: 0 }}><Typography variant="body2" fontWeight={700}>{payerName}</Typography><Typography variant="caption" color="text.secondary">Người nộp · {item.payment.tuitionFee.class.name}</Typography></Box></Stack>
    <Stack direction="row" spacing={1} alignItems="flex-start"><PaymentsOutlinedIcon fontSize="small" color="action" /><Box sx={{ minWidth: 0 }}><Typography variant="body2" fontWeight={600}>{item.payment.tuitionFee.feeNo}</Typography><Typography variant="caption" color="text.secondary">{feeSummary(item)}</Typography></Box></Stack>
    <Stack direction="row" justifyContent="space-between" alignItems="flex-end" spacing={1}><Box><Typography variant="caption" color="text.secondary">Phát hành</Typography><Typography variant="body2">{dateTime(item.issuedAt)}</Typography></Box><Box sx={{ textAlign: "right" }}><Typography variant="caption" color="text.secondary">Số tiền</Typography><Typography fontWeight={800}>{money(Number(item.amount))}</Typography></Box></Stack>
    <Typography variant="caption" color="text.secondary">Ngày in: {item.printedAt ? dateTime(item.printedAt) : "Chưa in"}</Typography>
    <Stack direction="row" spacing={1}><Button fullWidth size="small" variant="outlined" onClick={onOpen}>Xem chi tiết</Button>{item.status === "ACTIVE" && <Button fullWidth size="small" variant="contained" href={`/api/tuition-receipts/${item.id}/pdf`} startIcon={<DownloadOutlinedIcon />}>Tải PDF</Button>}</Stack>
  </Stack></Paper>;
}

function feeSummary(item: Receipt) {
  return item.payment.tuitionFee.items.map((feeItem) => feeItem.classSubject?.subject.name || feeItem.itemName).join(", ") || "-";
}

function displayPayerName(receiverName: string | null | undefined, student: { id: string; fullName: string }) {
  const name = receiverName?.trim();
  const isUuid = Boolean(name && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(name));
  return name && !isUuid && name !== student.id ? name : student.fullName;
}

function StatusChip({ status }: { status: Receipt["status"] }) {
  return <Chip size="small" icon={status === "ACTIVE" ? <CheckCircleOutlineIcon /> : <CancelOutlinedIcon />} color={status === "ACTIVE" ? "success" : "default"} label={statusLabels[status]} sx={{ fontWeight: 700 }} />;
}

function EmptyState({ hasFilters, onReset }: { hasFilters: boolean; onReset: () => void }) {
  return <Stack alignItems="center" spacing={1} sx={{ py: 7, px: 3 }}><Box sx={{ display: "flex", p: 1.5, borderRadius: "50%", bgcolor: "action.hover", color: "text.secondary" }}><ReceiptLongOutlinedIcon /></Box><Typography fontWeight={700}>Không tìm thấy biên lai</Typography><Typography variant="body2" color="text.secondary" textAlign="center">{hasFilters ? "Thử thay đổi bộ lọc hoặc xóa bộ lọc để xem toàn bộ danh sách." : "Chưa có biên lai học phí nào được phát hành."}</Typography>{hasFilters && <Button size="small" variant="outlined" onClick={onReset}>Xóa bộ lọc</Button>}</Stack>;
}
