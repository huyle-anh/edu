"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  InputAdornment,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableSortLabel,
  TableRow,
  Typography,
} from "@mui/material";
import AddCardOutlinedIcon from "@mui/icons-material/AddCardOutlined";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import Link from "next/link";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { useSnackbar } from "@/hooks/useSnackbar";
import { MonthPickerField } from "@/components/shared/forms/MonthPickerField";
import { AppTextField } from "@/components/shared/forms/AppTextField";
import { getVietnamMonth } from "@/lib/vietnam-time";
import { clampMonth } from "@/utils/date";
import { LoadingState } from "@/components/shared/feedback/LoadingState";
import { FilterActions } from "@/components/shared/FilterActions";

type ClassData = {
  id: string;
  code: string;
  name: string;
  status: "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  startDate?: string | null;
  endDate?: string | null;
};
type Fee = {
  id: string;
  feeNo: string;
  originalAmount: number;
  finalAmount: number;
  status: "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE" | "EXEMPTED" | "CANCELLED";
  paidAmount: number;
  remainingAmount: number;
  billingYear: number;
  billingMonth: number;
  note?: string | null;
  student: { code: string; fullName: string };
  items: Array<{ itemName: string; amount: number }>;
  paymentAllocations?: Array<{
    paymentBatch: { id: string; batchNo: string; status: string };
  }>;
};
type FeeSortKey = "student" | "item" | "finalAmount" | "paidAmount" | "remainingAmount" | "status";

const currentMonth = () => {
  return getVietnamMonth();
};
const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(Number(value))} ₫`;
const statusLabel: Record<Fee["status"], string> = { UNPAID: "Chưa thu", PARTIAL: "Đã thu một phần", PAID: "Đã thu", OVERDUE: "Quá hạn", EXEMPTED: "Miễn phí", CANCELLED: "Đã hủy" };
const statusColor: Record<Fee["status"], "warning" | "success" | "error" | "info" | "default"> = { UNPAID: "warning", PARTIAL: "info", PAID: "success", OVERDUE: "error", EXEMPTED: "info", CANCELLED: "default" };
const classStatusLabel: Record<ClassData["status"], string> = { DRAFT: "Bản nháp", ACTIVE: "Đang hoạt động", COMPLETED: "Đã hoàn thành", CANCELLED: "Đã hủy" };
const classStatusColor: Record<ClassData["status"], "default" | "success" | "info" | "error"> = { DRAFT: "default", ACTIVE: "success", COMPLETED: "info", CANCELLED: "error" };
const feeStatusOrder: Record<Fee["status"], number> = {
  UNPAID: 1,
  PARTIAL: 2,
  OVERDUE: 3,
  PAID: 4,
  EXEMPTED: 5,
  CANCELLED: 6,
};

type CreateFeeFailure = { studentId: string; studentCode: string; studentName: string; reason: string };
export function ClassTuitionManagement({
  id,
  embedded = false,
  month: sharedMonth,
  onMonthChange,
  onFeeSelect,
  refreshKey,
}: {
  id: string;
  embedded?: boolean;
  month?: string;
  onMonthChange?: (month: string) => void;
  onFeeSelect?: (feeId: string) => void;
  refreshKey?: number;
}) {
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [fees, setFees] = useState<Fee[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [appliedStudentSearch, setAppliedStudentSearch] = useState("");
  const [sortKey, setSortKey] = useState<FeeSortKey>("student");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [localMonth, setLocalMonth] = useState(currentMonth);
  const month = sharedMonth ?? localMonth;
  const setMonth = onMonthChange ?? setLocalMonth;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createFailures, setCreateFailures] = useState<CreateFeeFailure[]>([]);
  const requestVersion = useRef(0);
  const { showSuccess, showWarning, showError, Snackbar } = useSnackbar();
  const classNotActive = classData?.status !== "ACTIVE";
  const classStartMonth = classData?.startDate?.slice(0, 7) ?? null;
  const classEndMonth = classData?.endDate?.slice(0, 7) ?? null;

  useEffect(() => {
    const clampedMonth = clampMonth(month, classStartMonth, classEndMonth);
    if (clampedMonth !== month) setMonth(clampedMonth);
  }, [classEndMonth, classStartMonth, month, setMonth]);

  useEffect(() => {
    setCreateFailures([]);
  }, [id, month]);

  const load = useCallback(async () => {
    const currentRequest = ++requestVersion.current;
    setLoading(true);
    setError("");
    try {
      const [classResponse, feeResponse] = await Promise.all([
        fetch(`/api/classes/${id}`),
        fetch(`/api/tuition-fees?classId=${id}&month=${encodeURIComponent(month)}&billingType=MONTHLY&page=1&pageSize=100`),
      ]);
      if (!classResponse.ok) throw new Error(await extractApiErrorMessage(classResponse, "Không thể tải lớp học"));
      if (!feeResponse.ok) throw new Error(await extractApiErrorMessage(feeResponse, "Không thể tải học phí"));
      const [classResult, feeResult] = await Promise.all([
        unwrapApiResponse<ClassData>(classResponse),
        unwrapApiResponse<{ items: Fee[]; pagination?: { totalPages: number } }>(feeResponse),
      ]);
      const totalPages = feeResult.pagination?.totalPages ?? 1;
      const remainingPages = await Promise.all(
        Array.from({ length: Math.max(totalPages - 1, 0) }, (_, index) =>
          fetch(`/api/tuition-fees?classId=${id}&month=${encodeURIComponent(month)}&billingType=MONTHLY&page=${index + 2}&pageSize=100`).then(async (response) => {
            if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tải đầy đủ học phí"));
            return unwrapApiResponse<{ items: Fee[] }>(response);
          }),
        ),
      );
      if (currentRequest !== requestVersion.current) return;
      setClassData(classResult);
      setFees([feeResult.items, ...remainingPages.map((page) => page.items)].flat());
    } catch (reason) {
      if (currentRequest === requestVersion.current) {
        setError(reason instanceof Error ? reason.message : "Không thể tải dữ liệu");
      }
    } finally {
      if (currentRequest === requestVersion.current) setLoading(false);
    }
  }, [id, month]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const filteredFees = useMemo(() => {
    const query = appliedStudentSearch.trim().toLocaleLowerCase("vi-VN");
    const filtered = query
      ? fees.filter((fee) => fee.student.fullName.toLocaleLowerCase("vi-VN").includes(query))
      : fees;
    return [...filtered].sort((left, right) => {
      let comparison = 0;
      if (sortKey === "student") {
        comparison = left.student.fullName.localeCompare(right.student.fullName, "vi", { sensitivity: "base" });
        if (comparison === 0) comparison = left.student.code.localeCompare(right.student.code, "vi", { sensitivity: "base" });
      } else if (sortKey === "item") {
        comparison = left.items.map((item) => item.itemName).join(", ").localeCompare(
          right.items.map((item) => item.itemName).join(", "),
          "vi",
          { sensitivity: "base" },
        );
      } else if (sortKey === "status") {
        comparison = feeStatusOrder[left.status] - feeStatusOrder[right.status];
      } else {
        comparison = Number(left[sortKey]) - Number(right[sortKey]);
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [fees, sortDirection, sortKey, appliedStudentSearch]);

  function applyStudentSearch() {
    setAppliedStudentSearch(studentSearch.trim());
  }

  function clearStudentSearch() {
    setStudentSearch("");
    setAppliedStudentSearch("");
  }

  function handleSort(nextKey: FeeSortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(nextKey);
    setSortDirection("asc");
  }

  const totals = useMemo(() => ({
    amount: fees
      .filter((fee) => fee.status !== "EXEMPTED" && fee.status !== "CANCELLED")
      .reduce((sum, fee) => sum + Number(fee.finalAmount), 0),
    paid: fees
      .filter((fee) => fee.status !== "EXEMPTED" && fee.status !== "CANCELLED")
      .reduce((sum, fee) => sum + Number(fee.paidAmount), 0),
    remaining: fees
      .filter((fee) => fee.status !== "EXEMPTED" && fee.status !== "CANCELLED")
      .reduce((sum, fee) => sum + Number(fee.remainingAmount), 0),
  }), [fees]);

  async function createFees() {
    setBusy(true);
    setCreateFailures([]);
    try {
      const response = await fetch(`/api/classes/${id}/tuition-fees?month=${encodeURIComponent(month)}`, { method: "POST" });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tạo học phí tháng"));
      const result = await unwrapApiResponse<{ created: number; skipped: number; failed?: CreateFeeFailure[] }>(response);
      await load();
      const failed = result.failed ?? [];
      setCreateFailures(failed);
      if (failed.length) showWarning(`Đã tạo học phí cho ${result.created} học viên, ${failed.length} học viên chưa tạo được`);
      else showSuccess(`Đã tạo học phí cho ${result.created} học viên`);
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : "Không thể tạo học phí tháng");
    } finally {
      setBusy(false);
    }
  }

  if (!classData && loading) {
    return <LoadingState label="Đang tải thông tin học phí lớp..." minHeight={360} size={30} />;
  }
  if (!classData) return <Alert severity="error">{error || "Không tìm thấy lớp học"}</Alert>;

  const metrics = [
    { label: `Khoản phí kỳ ${month}`, value: fees.length },
    { label: "Tổng phải thu", value: money(totals.amount) },
  ];

  return <Stack spacing={{ xs: 2, md: 3 }}>
    {!embedded && <Box sx={{ px: { xs: 0, md: 0.5 } }}>
      <Button component={Link} href={`/admin/classes/${id}`} variant="text" size="small" startIcon={<ArrowBackOutlinedIcon />} sx={{ px: 0, mb: 1, color: "text.secondary" }}>
        Quay lại lớp {classData.code}
      </Button>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "flex-end" }} gap={2}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box sx={{ width: 48, height: 48, flexShrink: 0, borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: "primary.light", color: "primary.dark" }}>
            <AccountBalanceWalletOutlinedIcon />
          </Box>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="h4" fontWeight={800} letterSpacing="-0.02em">Học phí lớp học</Typography>
              <Chip size="small" color={classStatusColor[classData.status]} label={classStatusLabel[classData.status]} />
            </Stack>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>{classData.name} · {classData.code}</Typography>
          </Box>
        </Stack>
        <Chip icon={<CalendarMonthOutlinedIcon />} label={`Kỳ đang xem: ${month}`} color="primary" variant="outlined" sx={{ alignSelf: { xs: "flex-start", md: "center" }, fontWeight: 700 }} />
      </Stack>
    </Box>}

    {!embedded && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2 }}>
      <Paper sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.25} alignItems="flex-start">
            <Box sx={{ width: 36, height: 36, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: "primary.light", color: "primary.dark", flexShrink: 0 }}>
              <CalendarMonthOutlinedIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={800}>Kỳ học phí</Typography>
              <Typography variant="body2" color="text.secondary">Chọn kỳ cần xem hoặc tạo phí còn thiếu.</Typography>
            </Box>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
            <MonthPickerField label="Kỳ học phí" value={month} onChange={setMonth} minMonth={classStartMonth} maxMonth={classEndMonth} textFieldProps={{ size: "small" }} />
            <Button variant="outlined" startIcon={<RefreshOutlinedIcon />} onClick={() => void load()} disabled={loading} sx={{ whiteSpace: "nowrap" }}>Làm mới</Button>
          </Stack>
        </Stack>
      </Paper>
      <Paper sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.25} alignItems="flex-start">
            <Box sx={{ width: 36, height: 36, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: "success.light", color: "success.dark", flexShrink: 0 }}>
              <AddCardOutlinedIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={800}>Thao tác thu học phí</Typography>
              <Typography variant="body2" color="text.secondary">Tạo học phí tại đây; phát hành yêu cầu chuyển khoản ở màn hình thông báo tập trung.</Typography>
            </Box>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button variant="contained" startIcon={<AddCardOutlinedIcon />} onClick={() => void createFees()} disabled={busy || classNotActive} sx={{ flex: 1 }}>
              Tạo học phí tháng
            </Button>
            <Button
              component={Link}
              href={`/admin/tuition-fees/notice-management?classId=${encodeURIComponent(id)}&month=${encodeURIComponent(month)}`}
              variant="outlined"
              color="primary"
              sx={{ flex: 1 }}
            >
              Mở thông báo & đợt thu
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>}

    {!embedded && classNotActive && <Alert severity="info" icon={<InfoOutlinedIcon />}>Lớp chưa ở trạng thái ACTIVE; học phí chỉ được xem, không thể tạo mới.</Alert>}
    {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void load()}>Thử lại</Button>}>{error}</Alert>}
    {createFailures.length > 0 && <Alert severity="warning" onClose={() => setCreateFailures([])}>
      <Typography variant="body2" fontWeight={700}>{createFailures.length} học viên chưa được tạo học phí kỳ {month}:</Typography>
      {createFailures.map((failure) => <Typography key={failure.studentId} variant="body2">{failure.studentName} ({failure.studentCode}): {failure.reason}</Typography>)}
    </Alert>}
    {!embedded && <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ alignItems: "flex-start" }}>
      Học phí tính trọn tháng theo môn đang đăng ký. Sau khi tạo phí, mở <strong>Thông báo & đợt thu</strong> để chọn khoản cần yêu cầu chuyển khoản.
    </Alert>}

    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", lg: "repeat(4, 1fr)" }, gap: 1.5 }}>
      <MetricCard icon={<GroupsOutlinedIcon />} label={`Khoản phí kỳ ${month}`} value={metrics[0]?.value ?? 0} tone="blue" />
      <MetricCard icon={<AccountBalanceWalletOutlinedIcon />} label="Tổng phải thu" value={metrics[1]?.value ?? money(0)} tone="violet" />
      <MetricCard icon={<CheckCircleOutlineOutlinedIcon />} label="Đã thu" value={money(totals.paid)} tone="green" />
      <MetricCard icon={<PaymentsOutlinedIcon />} label="Còn nợ" value={money(totals.remaining)} tone="orange" />
    </Box>

    <Paper sx={{ overflow: "hidden" }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={1.5} sx={{ p: { xs: 2, md: 2.5 }, borderBottom: "1px solid", borderColor: "divider" }}>
        <Box>
          <Typography variant="h6" fontWeight={800}>Danh sách khoản phí</Typography>
          <Typography variant="body2" color="text.secondary">Theo dõi số tiền và trạng thái thu của từng học viên trong kỳ.</Typography>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
          <AppTextField
            size="small"
            placeholder="Tìm theo tên học viên..."
            value={studentSearch}
            onChange={(event) => setStudentSearch(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") applyStudentSearch(); }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlinedIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
            sx={{
              width: { xs: "100%", sm: 270 },
              "& .MuiOutlinedInput-root": { borderRadius: 2 },
            }}
          />
          <FilterActions mobileDirection="row" onSearch={applyStudentSearch} onClear={clearStudentSearch} hasFilters={Boolean(studentSearch.trim() || appliedStudentSearch)} isLoading={loading} />
          <Chip size="small" variant="outlined" label={`${filteredFees.length} khoản phí`} sx={{ alignSelf: { xs: "flex-start", sm: "center" } }} />
        </Stack>
      </Stack>
      {loading && <LinearProgress />}
      <Box sx={{ display: { xs: "none", md: "block" }, overflowX: "auto" }}>
        <Table sx={{ minWidth: 900 }}>
          <TableHead><TableRow>
            <SortableHeader label="Học viên" sortKey="student" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
            <SortableHeader label="Môn tính phí" sortKey="item" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
            <SortableHeader label="Tổng phải thu" sortKey="finalAmount" activeKey={sortKey} direction={sortDirection} onSort={handleSort} align="right" />
            <SortableHeader label="Đã thu" sortKey="paidAmount" activeKey={sortKey} direction={sortDirection} onSort={handleSort} align="right" />
            <SortableHeader label="Còn nợ" sortKey="remainingAmount" activeKey={sortKey} direction={sortDirection} onSort={handleSort} align="right" />
            <SortableHeader label="Trạng thái" sortKey="status" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
            <TableCell align="right">Thao tác</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {filteredFees.map((fee) => {
              const pendingBatch = fee.paymentAllocations?.[0]?.paymentBatch;
              const feeStatus = pendingBatch ? "Đang chờ đối soát" : statusLabel[fee.status];
              const feeColor = pendingBatch ? "warning" : statusColor[fee.status];
              const canPay = !pendingBatch && (fee.status === "UNPAID" || fee.status === "PARTIAL" || fee.status === "OVERDUE");
              return (
                <TableRow key={fee.id} hover>
                  <TableCell sx={{ minWidth: 220 }}><Typography fontWeight={700}>{fee.student.fullName}</Typography><Typography variant="caption" color="text.secondary">{fee.student.code}</Typography>{fee.note && <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5, whiteSpace: "normal", overflowWrap: "anywhere" }}><strong>Ghi chú:</strong> {fee.note}</Typography>}</TableCell>
                  <TableCell sx={{ minWidth: 200 }}><Typography variant="body2" sx={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fee.items.map((item) => item.itemName).join(", ") || "-"}</Typography></TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap", minWidth: 150 }}><Typography fontWeight={800}>{money(Number(fee.finalAmount))}</Typography></TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap", minWidth: 135 }}>{money(Number(fee.paidAmount))}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap", minWidth: 135 }}><Typography fontWeight={800} color={Number(fee.remainingAmount) > 0 ? "error.main" : "success.main"}>{money(Number(fee.remainingAmount))}</Typography></TableCell>
                  <TableCell><Stack spacing={0.5} alignItems="flex-start"><Chip size="small" color={feeColor} label={feeStatus} />{pendingBatch && <Typography variant="caption" color="text.secondary">{pendingBatch.batchNo}</Typography>}</Stack></TableCell>
                  <TableCell align="right"><Stack direction={{ xs: "column", sm: "row" }} spacing={0.75} justifyContent="flex-end">
                    {pendingBatch && <><Button component={Link} href={`/admin/tuition-fees/payment-history/${pendingBatch.id}`} size="small" variant="contained" color="warning" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>Xử lý đợt thu</Button><Button component="a" href={`/api/payment-batches/${pendingBatch.id}/notice/pdf`} size="small" variant="outlined" sx={{ whiteSpace: "nowrap" }}>Xuất thông báo tổng</Button></>}
                    {canPay && <Button component={Link} href={`/admin/tuition-fees/payment?tuitionFeeId=${fee.id}`} size="small" variant="contained" startIcon={<PaymentsOutlinedIcon />} sx={{ whiteSpace: "nowrap" }}>{fee.status === "PARTIAL" ? "Thu phần còn lại" : "Thu học phí"}</Button>}
                    {onFeeSelect ? (
                      <Button size="small" variant="outlined" startIcon={<VisibilityOutlinedIcon />} sx={{ whiteSpace: "nowrap" }} onClick={() => onFeeSelect(fee.id)}>Chi tiết</Button>
                    ) : (
                      <Button component={Link} href={`/admin/tuition-fees/${fee.id}`} size="small" variant="outlined" startIcon={<VisibilityOutlinedIcon />} sx={{ whiteSpace: "nowrap" }}>Chi tiết</Button>
                    )}
                  </Stack></TableCell>
                </TableRow>
              );
            })}
            {!loading && !filteredFees.length && <TableRow><TableCell colSpan={7}><Stack alignItems="center" spacing={1} sx={{ py: 6, color: "text.secondary" }}><PaymentsOutlinedIcon sx={{ fontSize: 38, color: "text.disabled" }} /><Typography fontWeight={700}>{appliedStudentSearch ? "Không tìm thấy học viên phù hợp" : `Chưa có học phí cho kỳ ${month}`}</Typography><Typography variant="body2">{appliedStudentSearch ? "Thử tìm bằng tên khác hoặc xóa bộ lọc." : classNotActive ? "Chỉ có thể tạo học phí khi lớp ở trạng thái Hoạt động." : "Chọn “Tạo học phí tháng” để phát sinh các khoản phí còn thiếu."}</Typography></Stack></TableCell></TableRow>}
          </TableBody>
        </Table>
      </Box>
      <Box sx={{ display: { xs: "grid", md: "none" }, gap: 1.25, p: 1.5 }}>
        {filteredFees.map((fee) => {
          const pendingBatch = fee.paymentAllocations?.[0]?.paymentBatch;
          const feeStatus = pendingBatch ? "Đang chờ đối soát" : statusLabel[fee.status];
          const feeColor = pendingBatch ? "warning" : statusColor[fee.status];
          const canPay = !pendingBatch && (fee.status === "UNPAID" || fee.status === "PARTIAL" || fee.status === "OVERDUE");
          return (
            <Paper key={fee.id} variant="outlined" sx={{ p: 1.5, minWidth: 0 }}>
              <Stack spacing={1.25}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                  <Box minWidth={0}>
                    <Typography fontWeight={700} sx={{ overflowWrap: "anywhere" }}>{fee.student.fullName}</Typography>
                    <Typography variant="caption" color="text.secondary">{fee.student.code}</Typography>
                  </Box>
                  <Chip size="small" color={feeColor} label={feeStatus} sx={{ maxWidth: "55%" }} />
                </Stack>
                {pendingBatch && <Typography variant="caption" color="text.secondary">Đợt thu: {pendingBatch.batchNo}</Typography>}
                {fee.note && <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}><strong>Ghi chú:</strong> {fee.note}</Typography>}
                <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                  Môn tính phí: {fee.items.map((item) => item.itemName).join(", ") || "-"}
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                  <Box><Typography variant="caption" color="text.secondary">Tổng phải thu</Typography><Typography variant="body2" fontWeight={800}>{money(Number(fee.finalAmount))}</Typography></Box>
                  <Box><Typography variant="caption" color="text.secondary">Đã thu</Typography><Typography variant="body2">{money(Number(fee.paidAmount))}</Typography></Box>
                  <Box sx={{ gridColumn: "1 / -1" }}><Typography variant="caption" color="text.secondary">Còn nợ</Typography><Typography variant="body2" fontWeight={800} color={Number(fee.remainingAmount) > 0 ? "error.main" : "success.main"}>{money(Number(fee.remainingAmount))}</Typography></Box>
                </Box>
                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                  {pendingBatch && <>
                    <Button component={Link} href={`/admin/tuition-fees/payment-history/${pendingBatch.id}`} size="small" variant="contained" color="warning" sx={{ fontWeight: 700 }}>Xử lý đợt thu</Button>
                    <Button component="a" href={`/api/payment-batches/${pendingBatch.id}/notice/pdf`} size="small" variant="outlined">Xuất thông báo</Button>
                  </>}
                  {canPay && <Button component={Link} href={`/admin/tuition-fees/payment?tuitionFeeId=${fee.id}`} size="small" variant="contained" startIcon={<PaymentsOutlinedIcon />}>{fee.status === "PARTIAL" ? "Thu phần còn lại" : "Thu học phí"}</Button>}
                  {onFeeSelect ? (
                    <Button size="small" variant="outlined" startIcon={<VisibilityOutlinedIcon />} onClick={() => onFeeSelect(fee.id)}>Chi tiết</Button>
                  ) : (
                    <Button component={Link} href={`/admin/tuition-fees/${fee.id}`} size="small" variant="outlined" startIcon={<VisibilityOutlinedIcon />}>Chi tiết</Button>
                  )}
                </Stack>
              </Stack>
            </Paper>
          );
        })}
        {!loading && !filteredFees.length && <Stack alignItems="center" spacing={1} sx={{ py: 5, px: 2, color: "text.secondary", textAlign: "center" }}><PaymentsOutlinedIcon sx={{ fontSize: 38, color: "text.disabled" }} /><Typography fontWeight={700}>{appliedStudentSearch ? "Không tìm thấy học viên phù hợp" : `Chưa có học phí cho kỳ ${month}`}</Typography><Typography variant="body2">{appliedStudentSearch ? "Thử tìm bằng tên khác hoặc xóa bộ lọc." : classNotActive ? "Chỉ có thể tạo học phí khi lớp ở trạng thái Hoạt động." : "Chọn “Tạo học phí tháng” để phát sinh các khoản phí còn thiếu."}</Typography></Stack>}
      </Box>
    </Paper>
    {Snackbar}
  </Stack>;
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: FeeSortKey;
  activeKey: FeeSortKey;
  direction: "asc" | "desc";
  onSort: (key: FeeSortKey) => void;
  align?: "left" | "right";
}) {
  return (
    <TableCell align={align}>
      <TableSortLabel
        active={activeKey === sortKey}
        direction={activeKey === sortKey ? direction : "asc"}
        onClick={() => onSort(sortKey)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );
}

type MetricTone = "blue" | "violet" | "green" | "orange";

type MetricCardProps = {
  icon: ReactNode;
  label: string;
  value: string | number;
  tone: MetricTone;
};

function MetricCard({ icon, label, value, tone }: MetricCardProps) {
  const toneStyles: Record<MetricTone, { background: string; color: string }> = {
    blue: { background: "primary.light", color: "primary.dark" },
    violet: { background: "info.light", color: "info.dark" },
    green: { background: "success.light", color: "success.dark" },
    orange: { background: "warning.light", color: "warning.dark" },
  };
  const style = toneStyles[tone];

  return (
    <Paper sx={{ p: { xs: 1.75, md: 2 }, minWidth: 0 }}>
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <Box sx={{ width: 36, height: 36, flexShrink: 0, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: style.background, color: style.color }}>
          {icon}
        </Box>
        <Box minWidth={0}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.35 }}>{label}</Typography>
          <Typography variant="h6" fontWeight={800} noWrap sx={{ mt: 0.5 }}>{value}</Typography>
        </Box>
      </Stack>
    </Paper>
  );
}
