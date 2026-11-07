"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
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
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import CallSplitOutlinedIcon from "@mui/icons-material/CallSplitOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import HourglassTopOutlinedIcon from "@mui/icons-material/HourglassTopOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import MergeTypeOutlinedIcon from "@mui/icons-material/MergeTypeOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import Link from "next/link";
import {
  ClassSelectDialog,
  type ClassItem,
} from "@/components/shared/dialogs/ClassSelectDialog";
import {
  StudentSelectDialog,
  type StudentItem,
} from "@/components/shared/dialogs/StudentSelectDialog";
import { AppTextField } from "@/components/shared/forms/AppTextField";
import {
  MasterSelectField,
  type MasterSelectValue,
} from "@/components/shared/forms/MasterSelectField";
import { ConfirmDialog } from "@/components/shared/dialogs/ConfirmDialog";
import { useDisclosure } from "@/hooks/useDisclosure";
import { useSnackbar } from "@/hooks/useSnackbar";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { LoadingState } from "@/components/shared/feedback/LoadingState";
import { FilterActions } from "@/components/shared/FilterActions";
import {
  fetchAllNoticePages,
  fetchNoticeBankAccounts,
  fetchOutstandingFees,
  fetchPendingBatches,
  fetchSuccessfulBatches,
  downloadNoticeBatchesPdf,
  issueClassNoticeBatches,
  issueNoticeBatches,
  restructurePendingBatches,
  type NoticeBankAccount,
  type NoticeFee,
  type NoticePdfScope,
  type PendingBatch,
} from "@/modules/finance/payments/services/payment-batch-management.client";

type View = "UNISSUED" | "PENDING" | "SUCCESS";
type RestructureMode = "SPLIT" | "MERGE";
type IssuedBatch = { id: string; batchNo: string; totalAmount: number };

const money = (value: number) =>
  `${new Intl.NumberFormat("vi-VN").format(Number(value))} ₫`;

const feeStatusLabels: Record<NoticeFee["status"], string> = {
  UNPAID: "Chưa thu",
  PARTIAL: "Đã thu một phần",
  OVERDUE: "Quá hạn",
};

const feeStatusColors: Record<
  NoticeFee["status"],
  "warning" | "info" | "error"
> = {
  UNPAID: "warning",
  PARTIAL: "info",
  OVERDUE: "error",
};

function sameStudent<T extends { student: { id: string } }>(items: T[]) {
  return new Set(items.map((item) => item.student.id)).size <= 1;
}

function groupByStudent<
  T extends { student: { id: string; code: string; fullName: string } },
>(items: T[]) {
  const groups = new Map<string, { student: T["student"]; items: T[] }>();
  for (const item of items) {
    const existing = groups.get(item.student.id);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(item.student.id, { student: item.student, items: [item] });
    }
  }
  return [...groups.values()];
}

function getFeePeriod(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function samePeriods(left: string[], right: string[]) {
  return left.length === right.length && left.every((period, index) => period === right[index]);
}

function getBatchFeeGroups(
  batch: PendingBatch,
) {
  const grouped = new Map<string, Map<string, { className: string; amount: number }>>();
  for (const allocation of batch.allocations) {
    const fee = allocation.tuitionFee;
    const period = getFeePeriod(fee.billingYear, fee.billingMonth);
    const classLabel = fee.class?.name || "-";
    const classKey = fee.class?.id ?? classLabel;
    const classes = grouped.get(period) ?? new Map();
    const current = classes.get(classKey);
    if (current) current.amount += Number(allocation.amount);
    else {
      classes.set(classKey, {
        className: classLabel,
        amount: Number(allocation.amount),
      });
    }
    grouped.set(period, classes);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([period, classes]) => ({
      period,
      classes: [...classes.values()].sort((left, right) =>
        left.className.localeCompare(right.className, "vi"),
      ),
    }));
}

function batchHasOutOfScopeFees(
  batch: PendingBatch,
  monthFilters: string[],
) {
  return batch.allocations.some(({ tuitionFee }) => {
    const period = getFeePeriod(tuitionFee.billingYear, tuitionFee.billingMonth);
    return monthFilters.length > 0 && !monthFilters.includes(period);
  });
}

function getNoticePdfScope(months: string[]): NoticePdfScope | undefined {
  if (!months.length) return undefined;
  return { months };
}

function getNoticePdfFilePeriodLabel(months: string[]) {
  return months.length === 1 ? months[0] : "nhieu-ky";
}

function groupFeesByPeriod(items: NoticeFee[]) {
  const groups = new Map<string, NoticeFee[]>();
  for (const fee of items) {
    const period = getFeePeriod(fee.billingYear, fee.billingMonth);
    groups.set(period, [...(groups.get(period) ?? []), fee]);
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
}

export function PaymentBatchManagement() {
  const [view, setView] = useState<View>("UNISSUED");
  // Để trống danh sách kỳ sẽ tải và phát hành các khoản của mọi kỳ.
  const [months, setMonths] = useState<string[]>([]);
  const [periodOptions, setPeriodOptions] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [student, setStudent] = useState<MasterSelectValue | null>(null);
  const [selectedClass, setSelectedClass] = useState<MasterSelectValue | null>(
    null,
  );
  const [appliedStudentId, setAppliedStudentId] = useState<
    string | undefined
  >();
  const [appliedClassId, setAppliedClassId] = useState<string | undefined>();
  const [fees, setFees] = useState<NoticeFee[]>([]);
  const [unissuedTotal, setUnissuedTotal] = useState(0);
  const [pendingBatches, setPendingBatches] = useState<PendingBatch[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [successfulBatches, setSuccessfulBatches] = useState<PendingBatch[]>(
    [],
  );
  const [successfulTotal, setSuccessfulTotal] = useState(0);
  const [bankAccounts, setBankAccounts] = useState<NoticeBankAccount[]>([]);
  const [selectedFeeIds, setSelectedFeeIds] = useState<string[]>([]);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [noticeDialogOpen, setNoticeDialogOpen] = useState(false);
  const [classNoticeMode, setClassNoticeMode] = useState(false);
  const [bankAccountId, setBankAccountId] = useState("");
  const [restructureMode, setRestructureMode] =
    useState<RestructureMode | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [issuedBatches, setIssuedBatches] = useState<IssuedBatch[]>([]);
  const [issuedClassId, setIssuedClassId] = useState<string | null>(null);
  const [issuedMonths, setIssuedMonths] = useState<string[] | null>(null);
  const [issuedDialogOpen, setIssuedDialogOpen] = useState(false);
  const [isDownloadingNoticePdf, setIsDownloadingNoticePdf] = useState(false);
  const [isDownloadingSelectedNotices, setIsDownloadingSelectedNotices] = useState(false);
  const { showSuccess, showError, Snackbar } = useSnackbar();
  const appliedUrlFilters = useRef(false);
  const studentDialog = useDisclosure();
  const classDialog = useDisclosure();

  useEffect(() => {
    setSelectedFeeIds([]);
    setSelectedBatchIds([]);
    setSelectedStudentIds([]);
  }, [appliedClassId, appliedSearch, appliedStudentId, months, view]);

  const load = useCallback(async (filters = {
    months,
    search: search.trim(),
    studentId: student?.id,
    classId: selectedClass?.id,
  }) => {
    setLoading(true);
    setError("");
    const listFilters = {
      months: filters.months,
      page: 1,
      pageSize: 100,
      search: filters.search,
      studentId: filters.studentId,
      studentClassId: filters.classId,
    };
    try {
      const [feeItems, batchItems, paidBatchItems, accounts] =
        await Promise.all([
          fetchAllNoticePages(fetchOutstandingFees, listFilters),
          fetchAllNoticePages(fetchPendingBatches, listFilters),
          fetchAllNoticePages(fetchSuccessfulBatches, listFilters),
          fetchNoticeBankAccounts(),
        ]);
      setFees(feeItems.items);
      setUnissuedTotal(feeItems.total);
      setPendingBatches(batchItems.items);
      setPendingTotal(batchItems.total);
      setSuccessfulBatches(paidBatchItems.items);
      setSuccessfulTotal(paidBatchItems.total);
      if (!filters.months.length) {
        const availablePeriods = new Set<string>(
          feeItems.items.map((fee) => getFeePeriod(fee.billingYear, fee.billingMonth)),
        );
        for (const batch of [...batchItems.items, ...paidBatchItems.items]) {
          for (const allocation of batch.allocations) {
            availablePeriods.add(
              getFeePeriod(
                allocation.tuitionFee.billingYear,
                allocation.tuitionFee.billingMonth,
              ),
            );
          }
        }
        setPeriodOptions([...availablePeriods].sort());
      }
      setBankAccounts(accounts);
      setBankAccountId((current) =>
        accounts.some((account) => account.id === current)
          ? current
          : (accounts[0]?.id ?? ""),
      );
    } catch (reasonValue) {
      setError(
        reasonValue instanceof Error
          ? reasonValue.message
          : "Không thể tải dữ liệu",
      );
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  }, [months, search, selectedClass, student]);

  function applyFilters() {
    const nextFilters = {
      months,
      search: search.trim(),
      studentId: student?.id,
      classId: selectedClass?.id,
    };
    setAppliedSearch(nextFilters.search);
    setAppliedStudentId(student?.id);
    setAppliedClassId(selectedClass?.id);
    void load(nextFilters);
  }

  function clearFilters() {
    setSearch("");
    setAppliedSearch("");
    setStudent(null);
    setSelectedClass(null);
    setAppliedStudentId(undefined);
    setAppliedClassId(undefined);
    setIssuedBatches([]);
    setIssuedClassId(null);
    setIssuedMonths(null);
    setIssuedDialogOpen(false);
    setMonths([]);
  }

  const unissuedFees = fees;
  const visiblePendingBatches = pendingBatches;
  const visibleSuccessfulBatches = successfulBatches;

  const unissuedGroups = useMemo(
    () => groupByStudent(unissuedFees),
    [unissuedFees],
  );
  const pendingGroups = useMemo(
    () => groupByStudent(visiblePendingBatches),
    [visiblePendingBatches],
  );
  const successfulGroups = useMemo(
    () => groupByStudent(visibleSuccessfulBatches),
    [visibleSuccessfulBatches],
  );
  const selectedFees = fees.filter((fee) => selectedFeeIds.includes(fee.id));
  const selectedBatches = pendingBatches.filter((batch) =>
    selectedBatchIds.includes(batch.id),
  );
  const selectedStudentBatches = pendingBatches.filter((batch) =>
    selectedStudentIds.includes(batch.student.id),
  );
  const selectedStudentOutOfScopeBatches = selectedStudentBatches.filter((batch) =>
    batchHasOutOfScopeFees(batch, months),
  );
  const selectedStudentNoticeCount = selectedStudentBatches.length;
  const selectedFeeTotal = selectedFees.reduce(
    (sum, fee) => sum + Number(fee.remainingAmount),
    0,
  );
  const selectedBatchTotal = selectedBatches.reduce(
    (sum, batch) => sum + Number(batch.totalAmount),
    0,
  );
  const selectedStudentCount = new Set(
    selectedFees.map((fee) => fee.student.id),
  ).size;
  const canMergeBatches =
    selectedBatches.length >= 2 &&
    sameStudent(selectedBatches) &&
    new Set(selectedBatches.map((batch) => batch.bankAccountId)).size <= 1;
  const splitTarget =
    selectedBatches.length === 1 ? selectedBatches[0] : undefined;
  const selectedBatchStudent = selectedBatches[0]?.student.id;
  const selectedCount =
    view === "UNISSUED" ? selectedFeeIds.length : selectedBatchIds.length;
  const selectedTotal =
    view === "UNISSUED" ? selectedFeeTotal : selectedBatchTotal;
  const hasMatchingIssuedNotice =
    issuedClassId === appliedClassId &&
    issuedMonths !== null &&
    samePeriods(issuedMonths, months);

  useEffect(() => {
    if (appliedUrlFilters.current) return;
    appliedUrlFilters.current = true;
    const params = new URLSearchParams(window.location.search);
    const queryMonths = params.get("months")?.split(",") ?? [];
    const queryMonth = params.get("month");
    const queryClassId = params.get("classId");
    const urlMonths = queryMonths.length ? queryMonths : queryMonth ? [queryMonth] : [];
    setMonths(
      [...new Set(urlMonths.filter((value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value)))].sort(),
    );
    if (!queryClassId) return;
    void fetch(`/api/classes/${encodeURIComponent(queryClassId)}`)
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            await extractApiErrorMessage(response, "Không thể tải lớp đã chọn"),
          );
        return unwrapApiResponse<ClassItem>(response);
      })
      .then((item) => {
        setSelectedClass({ id: item.id, code: item.code, name: item.name });
        setAppliedClassId(item.id);
      })
      .catch((reasonValue: unknown) => {
        showError(
          reasonValue instanceof Error
            ? reasonValue.message
            : "Không thể tải lớp đã chọn",
        );
      });
  }, [showError]);

  function toggleFee(id: string) {
    setSelectedFeeIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function toggleBatch(id: string) {
    setSelectedBatchIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function toggleStudent(studentId: string, checked: boolean) {
    setSelectedStudentIds((current) =>
      checked
        ? [...new Set([...current, studentId])]
        : current.filter((id) => id !== studentId),
    );
  }

  async function downloadSelectedStudentNotices() {
    if (!selectedStudentIds.length || !selectedStudentBatches.length) return;
    if (selectedStudentOutOfScopeBatches.length) {
      showError(
        `Batch ${selectedStudentOutOfScopeBatches[0]!.batchNo} có khoản ngoài bộ lọc. Hãy chọn batch đó và tách đợt trước khi xuất PDF.`,
      );
      return;
    }
    if (selectedStudentBatches.length > 5000) {
      showError("Mỗi lần xuất PDF tối đa 5.000 thông báo");
      return;
    }
    setIsDownloadingSelectedNotices(true);
    try {
      const pdf = await downloadNoticeBatchesPdf(
        selectedStudentBatches.map((batch) => batch.id),
        getNoticePdfScope(months),
      );
      const url = URL.createObjectURL(pdf);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "thong-bao-hoc-phi-hoc-sinh-da-chon.pdf";
      anchor.click();
      URL.revokeObjectURL(url);
      showSuccess(
        `Đã xuất ${selectedStudentNoticeCount} thông báo cho ${selectedStudentIds.length} học sinh`,
      );
    } catch (reasonValue) {
      showError(
        reasonValue instanceof Error
          ? reasonValue.message
          : "Không thể tải PDF thông báo",
      );
    } finally {
      setIsDownloadingSelectedNotices(false);
    }
  }

  async function downloadPendingBatchNotice(batch: PendingBatch) {
    if (batchHasOutOfScopeFees(batch, months)) {
      showError(
        `Batch ${batch.batchNo} có khoản ngoài bộ lọc. Hãy tách đợt trước khi xuất PDF.`,
      );
      return;
    }
    setIsDownloadingSelectedNotices(true);
    try {
      const pdf = await downloadNoticeBatchesPdf(
        [batch.id],
        getNoticePdfScope(months),
      );
      const url = URL.createObjectURL(pdf);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `thong-bao-${batch.batchNo}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reasonValue) {
      showError(
        reasonValue instanceof Error
          ? reasonValue.message
          : "Không thể tải PDF thông báo",
      );
    } finally {
      setIsDownloadingSelectedNotices(false);
    }
  }

  function handleStudentFilterSelect(item: StudentItem) {
    setStudent({ id: item.id, code: item.code, name: item.fullName });
    studentDialog.onClose();
  }

  function handleClassFilterSelect(item: ClassItem) {
    setSelectedClass({ id: item.id, code: item.code, name: item.name });
    classDialog.onClose();
  }

  function openNoticeDialog() {
    if (!selectedFees.length) {
      showError("Hãy chọn ít nhất một khoản học phí");
      return;
    }
    if (selectedFees.length > 500) {
      showError("Mỗi lần phát hành tối đa 500 khoản học phí");
      return;
    }
    setNoticeDialogOpen(true);
    setClassNoticeMode(false);
    setDialogError("");
  }

  function openClassNoticeDialog() {
    if (!appliedClassId || appliedStudentId) {
      showError(
        "Hãy lọc theo một lớp và bỏ bộ lọc học viên trước khi phát hành theo lớp",
      );
      return;
    }
    setClassNoticeMode(true);
    setNoticeDialogOpen(true);
    setDialogError("");
  }

  async function submitNotice() {
    if (!noticeDialogOpen || !bankAccountId) {
      setDialogError("Tài khoản nhận tiền là bắt buộc");
      return;
    }
    setBusy(true);
    setDialogError("");
    try {
      const result = classNoticeMode
        ? await issueClassNoticeBatches({
            classId: appliedClassId!,
            ...(months.length ? { months } : {}),
            bankAccountId,
            idempotencyKey: crypto.randomUUID(),
          })
        : await issueNoticeBatches({
            tuitionFeeIds: selectedFeeIds,
            mode: "BY_STUDENT",
            bankAccountId,
            idempotencyKey: crypto.randomUUID(),
          });
      setNoticeDialogOpen(false);
      setIssuedBatches(result.batches);
      setIssuedClassId(classNoticeMode ? (appliedClassId ?? null) : null);
      setIssuedMonths(classNoticeMode ? months : null);
      setIssuedDialogOpen(true);
      setView("PENDING");
      showSuccess(
        classNoticeMode
          ? `Đã xuất ${result.batches.length} thông báo theo lớp; đã cập nhật ${"updatedBatchCount" in result ? result.updatedBatchCount : 0} đợt đang chờ`
          : `Đã phát hành ${result.batches.length} đợt thu cho ${selectedStudentCount} học viên`,
      );
      try {
        const pdf = await downloadNoticeBatchesPdf(
          result.batches.map((batch) => batch.id),
        classNoticeMode
          ? getNoticePdfScope(months)
          : undefined,
        );
        const url = URL.createObjectURL(pdf);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `thong-bao-hoc-phi-${getNoticePdfFilePeriodLabel(months)}.pdf`;
        anchor.click();
        URL.revokeObjectURL(url);
      } catch {
        showError(
          "Đợt thu đã được tạo. Có thể tải lại PDF từ thông báo vừa phát hành.",
        );
      }
    } catch (reasonValue) {
      setDialogError(
        reasonValue instanceof Error
          ? reasonValue.message
          : "Không thể phát hành thông báo",
      );
    } finally {
      setBusy(false);
    }
  }

  async function downloadIssuedNoticePdf() {
    if (!issuedBatches.length) return;
    setIsDownloadingNoticePdf(true);
    try {
      const pdf = await downloadNoticeBatchesPdf(
        issuedBatches.map((batch) => batch.id),
        getNoticePdfScope(issuedMonths ?? []),
      );
      const url = URL.createObjectURL(pdf);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `thong-bao-hoc-phi-${getNoticePdfFilePeriodLabel(issuedMonths ?? months)}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reasonValue) {
      showError(
        reasonValue instanceof Error
          ? reasonValue.message
          : "Không thể tải PDF thông báo",
      );
    } finally {
      setIsDownloadingNoticePdf(false);
    }
  }

  function openRestructureDialog(mode: RestructureMode) {
    if (
      mode === "SPLIT" &&
      (!splitTarget || splitTarget.allocations.length < 2)
    ) {
      showError("Hãy chọn một batch có ít nhất hai khoản học phí");
      return;
    }
    if (mode === "MERGE" && !canMergeBatches) {
      showError(
        "Hãy chọn ít nhất hai batch của cùng học sinh và cùng tài khoản nhận tiền",
      );
      return;
    }
    setRestructureMode(mode);
    setReason("");
    setDialogError("");
  }

  async function submitRestructure() {
    if (!restructureMode || !reason.trim()) {
      setDialogError("Lý do là bắt buộc");
      return;
    }
    setBusy(true);
    setDialogError("");
    try {
      const input =
        restructureMode === "SPLIT"
          ? {
              operation: "SPLIT" as const,
              sourceBatchId: splitTarget!.id,
              reason: reason.trim(),
              idempotencyKey: crypto.randomUUID(),
            }
          : {
              operation: "MERGE" as const,
              batchIds: selectedBatches.map((batch) => batch.id),
              reason: reason.trim(),
              idempotencyKey: crypto.randomUUID(),
            };
      const result = await restructurePendingBatches(input);
      setRestructureMode(null);
      setSelectedBatchIds([]);
      setSelectedStudentIds([]);
      await load();
      showSuccess(`Đã tạo lại ${result.batches.length} đợt thanh toán`);
    } catch (reasonValue) {
      setDialogError(
        reasonValue instanceof Error
          ? reasonValue.message
          : "Không thể tách hoặc gộp đợt thu",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack spacing={{ xs: 2, md: 3 }}>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ sm: "center" }}
          spacing={2}
          sx={{ position: "relative", zIndex: 1 }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                display: "grid",
                placeItems: "center",
                width: 44,
                height: 44,
                flexShrink: 0,
                borderRadius: 2,
                color: "primary.main",
                bgcolor: "primary.light",
              }}
            >
              <CampaignOutlinedIcon />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={800} color="text.primary">
                Thông báo &amp; đợt thu
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Theo dõi khoản chưa phát, xử lý thanh toán và tra cứu lịch sử.
              </Typography>
            </Box>
          </Stack>
          <Chip
            icon={<InfoOutlinedIcon />}
            label={months.length ? `Kỳ ${months.join(", ")}` : "Tất cả kỳ học phí"}
            variant="outlined"
            color="primary"
            sx={{ alignSelf: { xs: "flex-start", sm: "center" }, fontWeight: 700 }}
          />
        </Stack>
      </Paper>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr 1fr",
            md: "repeat(4, minmax(0, 1fr))",
          },
          gap: { xs: 1, md: 1.25 },
        }}
      >
        <DashboardMetric
          icon={<CampaignOutlinedIcon />}
          label="Chưa phát"
          value={unissuedTotal}
          tone="primary"
        />
        <DashboardMetric
          icon={<HourglassTopOutlinedIcon />}
          label="Đang chờ"
          value={pendingTotal}
          tone="warning"
        />
        <DashboardMetric
          icon={<TaskAltOutlinedIcon />}
          label="Đã thanh toán"
          value={successfulTotal}
          tone="success"
        />
        <DashboardMetric
          icon={<CheckCircleOutlineOutlinedIcon />}
          label="Đang chọn"
          value={selectedCount}
          tone="info"
          detail={selectedCount ? money(selectedTotal) : undefined}
        />
      </Box>

      <Paper
        variant="outlined"
        sx={{
          p: { xs: 1.5, md: 2 },
          borderRadius: 3,
          borderColor: "divider",
          boxShadow: "none",
        }}
      >
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            gap={1}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <TuneOutlinedIcon color="primary" fontSize="small" />
              <Box>
                <Typography variant="subtitle1" fontWeight={800}>
                  Tìm kiếm &amp; lọc
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Tìm theo học viên, mã học phí, lớp hoặc đợt thu.
                </Typography>
              </Box>
            </Stack>
            <Stack
              direction="row"
              spacing={0.75}
              flexWrap="wrap"
              useFlexGap
              justifyContent={{ sm: "flex-end" }}
            >
              {student && (
                <Chip
                  size="small"
                  label={`HV: ${student.code}`}
                  onDelete={() => setStudent(null)}
                />
              )}
              {selectedClass && (
                <Chip
                  size="small"
                  label={`Lớp: ${selectedClass.name}`}
                  onDelete={() => setSelectedClass(null)}
                />
              )}
              {appliedSearch && (
                <Chip
                  size="small"
                  label={`Từ khóa: ${appliedSearch}`}
                  onDelete={() => {
                    setSearch("");
                    setAppliedSearch("");
                  }}
                />
              )}
            </Stack>
          </Stack>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.25}
            alignItems={{ md: "center" }}
          >
            <AppTextField
              label="Tìm học sinh, mã học phí hoặc batch"
              size="small"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyFilters();
              }}
              sx={{ flex: 2, minWidth: 0 }}
            />
            <MasterSelectField
              label="Học viên"
              value={student}
              onOpen={studentDialog.onOpen}
              size="small"
              codeLabel="Mã học viên"
              nameLabel="Họ tên"
              sx={{ flex: 1, minWidth: 0 }}
            />
            <MasterSelectField
              label="Lớp học"
              value={selectedClass}
              onOpen={classDialog.onOpen}
              size="small"
              codeLabel="Mã lớp"
              nameLabel="Tên lớp"
              sx={{ flex: 1, minWidth: 0 }}
            />
          </Stack>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ sm: "flex-end" }}
          gap={1.5}
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} alignItems={{ sm: "flex-end" }} flex={1}>
            <FormControl
              size="small"
              sx={{ width: { xs: "100%", sm: 280 }, maxWidth: "100%" }}
              disabled={loading || periodOptions.length === 0}
            >
              <InputLabel id="notice-periods-label">Kỳ học phí</InputLabel>
              <Select
                labelId="notice-periods-label"
                multiple
                value={months}
                label="Kỳ học phí"
                onChange={(event) => {
                  const selected = typeof event.target.value === "string"
                    ? event.target.value.split(",")
                    : event.target.value;
                  setMonths([...selected].sort());
                  setIssuedBatches([]);
                  setIssuedClassId(null);
                  setIssuedMonths(null);
                  setIssuedDialogOpen(false);
                }}
                renderValue={(selected) =>
                  selected.length ? selected.join(", ") : "Tất cả kỳ"
                }
              >
                {periodOptions.map((period) => (
                  <MenuItem key={period} value={period}>
                    <Checkbox checked={months.includes(period)} />
                    {period}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText sx={{ mx: 0 }}>Có thể chọn nhiều kỳ. Bỏ trống để xem tất cả.</FormHelperText>
            </FormControl>
            {months.length > 0 && (
              <Button
                size="small"
                onClick={() => {
                  setIssuedBatches([]);
                  setIssuedClassId(null);
                  setIssuedMonths(null);
                  setIssuedDialogOpen(false);
                  setMonths([]);
                }}
                sx={{ whiteSpace: "nowrap", mb: 0.5 }}
              >
                Tất cả kỳ
              </Button>
            )}
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="flex-end">
            <FilterActions
              onSearch={applyFilters}
              onClear={clearFilters}
              hasFilters={Boolean(search.trim() || appliedSearch || student || selectedClass || months.length)}
              isLoading={loading}
            />
            <Button
              variant="outlined"
              startIcon={<RefreshOutlinedIcon />}
              onClick={() => void load()}
              disabled={loading}
              sx={{ whiteSpace: "nowrap" }}
            >
              Làm mới
            </Button>
            {appliedClassId && (
              <Button
                variant="contained"
                startIcon={hasMatchingIssuedNotice ? <DownloadOutlinedIcon /> : <SendOutlinedIcon />}
                onClick={() => hasMatchingIssuedNotice ? void downloadIssuedNoticePdf() : openClassNoticeDialog()}
                disabled={loading || busy || isDownloadingNoticePdf || (hasMatchingIssuedNotice && !issuedBatches.length)}
                sx={{ whiteSpace: "nowrap" }}
              >
                {hasMatchingIssuedNotice ? (isDownloadingNoticePdf ? "Đang tạo PDF..." : "Xuất PDF toàn bộ lớp") : "Phát hành toàn bộ lớp"}
              </Button>
            )}
          </Stack>
        </Stack>
        </Stack>
      </Paper>

      <Paper
        variant="outlined"
        sx={{
          px: { xs: 1, md: 1.5 },
          borderRadius: 2.5,
          borderColor: "divider",
          bgcolor: "background.paper",
          boxShadow: "0 5px 20px rgba(16, 42, 67, 0.045)",
        }}
      >
        <Tabs
          value={view}
          variant="scrollable"
          scrollButtons="auto"
          onChange={(_, value: View) => {
            setView(value);
            setSelectedFeeIds([]);
            setSelectedBatchIds([]);
          }}
          sx={{
            "& .MuiTab-root": { minHeight: 58, fontWeight: 700, textTransform: "none" },
            "& .Mui-selected": { color: "primary.main" },
            "& .MuiTabs-indicator": { height: 3, borderRadius: 3 },
          }}
        >
          <Tab
            icon={<CampaignOutlinedIcon fontSize="small" />}
            iconPosition="start"
            value="UNISSUED"
            label={`Chưa phát · ${unissuedTotal}`}
          />
          <Tab
            icon={<HourglassTopOutlinedIcon fontSize="small" />}
            iconPosition="start"
            value="PENDING"
            label={`Đang chờ · ${pendingTotal}`}
          />
          <Tab
            icon={<TaskAltOutlinedIcon fontSize="small" />}
            iconPosition="start"
            value="SUCCESS"
            label={`Đã thanh toán · ${successfulTotal}`}
          />
        </Tabs>
      </Paper>

      {error && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void load()}>
              Thử lại
            </Button>
          }
        >
          {error}
        </Alert>
      )}
      {loading && (
        <LoadingState
          label="Đang tải danh sách thông báo và đợt thu..."
          inline
          size={18}
        />
      )}
      <Dialog
        open={issuedDialogOpen && issuedBatches.length > 0}
        onClose={() => setIssuedDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        scroll="paper"
      >
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <CheckCircleOutlineOutlinedIcon color="success" />
            <span>Thông báo vừa phát hành</span>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              Đã tạo {issuedBatches.length} đợt thu. Tải PDF gộp hoặc mở chi
              tiết từng đợt để tiếp tục xử lý.
            </Typography>
            {issuedBatches.map((batch) => (
              <Button
                key={batch.id}
                component={Link}
                href={`/admin/tuition-fees/payment-history/${batch.id}`}
                variant="outlined"
                sx={{ justifyContent: "flex-start" }}
              >
                Chi tiết {batch.batchNo}
              </Button>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setIssuedDialogOpen(false)}>Đóng</Button>
          <Button
            variant="contained"
            startIcon={<DownloadOutlinedIcon />}
            onClick={() => void downloadIssuedNoticePdf()}
            disabled={isDownloadingNoticePdf}
          >
            {isDownloadingNoticePdf
              ? "Đang tạo PDF..."
              : `Tải PDF gộp (${issuedBatches.length} đợt)`}
          </Button>
        </DialogActions>
      </Dialog>

      {view === "UNISSUED" ? (
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ md: "center" }}
          >
            <SectionHeader
              icon={<CampaignOutlinedIcon />}
              title="Khoản học phí chưa phát thông báo"
              subtitle="Chọn các khoản cần thu. Hệ thống tự gom thành một đợt cho mỗi học viên."
            />
          </Stack>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) 280px" },
              gap: 2,
            }}
          >
            <Paper
              variant="outlined"
              sx={{ overflow: "hidden", borderRadius: 3, borderColor: "divider" }}
            >
              <Box sx={{ overflowX: "auto" }}>
                <Table sx={{ minWidth: 900 }} size="small">
                  <TableHead sx={{ "& .MuiTableCell-root": { bgcolor: "action.hover", color: "text.secondary", fontWeight: 800 } }}>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={
                            Boolean(unissuedFees.length) &&
                            selectedFeeIds.length === unissuedFees.length
                          }
                          onChange={(event) =>
                            setSelectedFeeIds(
                              event.target.checked
                                ? unissuedFees.map((fee) => fee.id)
                                : [],
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>Học sinh</TableCell>
                      <TableCell>Lớp</TableCell>
                      <TableCell>Phải thu</TableCell>
                      <TableCell>Còn nợ</TableCell>
                      <TableCell>Trạng thái</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {unissuedGroups.map((group) => {
                      const groupIds = group.items.map((fee) => fee.id);
                      const groupSelected = groupIds.every((id) =>
                        selectedFeeIds.includes(id),
                      );
                      return (
                        <Fragment key={group.student.id}>
                          <TableRow sx={{ bgcolor: "action.hover" }}>
                            <TableCell padding="checkbox">
                              <Checkbox
                                checked={groupSelected}
                                onChange={(event) =>
                                  setSelectedFeeIds((current) =>
                                    event.target.checked
                                      ? [...new Set([...current, ...groupIds])]
                                      : current.filter(
                                          (id) => !groupIds.includes(id),
                                        ),
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell colSpan={5}>
                              <Typography fontWeight={800}>
                                {group.student.fullName}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {group.student.code} · {group.items.length}{" "}
                                khoản chưa phát thông báo
                              </Typography>
                            </TableCell>
                          </TableRow>
                          {groupFeesByPeriod(group.items).map(
                            ([period, periodFees]) => (
                              <Fragment key={period}>
                                <TableRow sx={{ bgcolor: "action.selected" }}>
                                  <TableCell colSpan={6}>
                                    <Typography
                                      variant="body2"
                                      fontWeight={800}
                                    >
                                      Kỳ {period}
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                                {periodFees.map((fee) => (
                                  <TableRow key={fee.id} hover>
                                    <TableCell padding="checkbox">
                                      <Checkbox
                                        checked={selectedFeeIds.includes(fee.id)}
                                        onChange={() => toggleFee(fee.id)}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      {fee.student.fullName}
                                      <Typography
                                        variant="caption"
                                        display="block"
                                        color="text.secondary"
                                      >
                                        {fee.student.code}
                                      </Typography>
                                    </TableCell>
                                    <TableCell>{fee.class.name}</TableCell>
                                    <TableCell>{money(fee.finalAmount)}</TableCell>
                                    <TableCell>
                                      <Typography fontWeight={700}>
                                        {money(fee.remainingAmount)}
                                      </Typography>
                                    </TableCell>
                                    <TableCell>
                                      <Chip
                                        size="small"
                                        color={feeStatusColors[fee.status]}
                                        label={feeStatusLabels[fee.status]}
                                      />
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </Fragment>
                            ),
                          )}
                        </Fragment>
                      );
                    })}
                    {!loading && !unissuedFees.length && (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <EmptyState message={hasLoaded ? "Không có khoản học phí chưa phát thông báo với bộ lọc hiện tại" : "Bấm Tìm kiếm hoặc Làm mới để tải dữ liệu"} />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Box>
            </Paper>
            <SelectionSummary
              count={selectedFeeIds.length}
              total={selectedFeeTotal}
              details={selectedFees
                .slice(0, 5)
                .map((fee) => `${getFeePeriod(fee.billingYear, fee.billingMonth)} · ${fee.class.name} · ${fee.student.fullName}`)}
            >
              <Button
                fullWidth
                variant="contained"
                startIcon={<SendOutlinedIcon />}
                onClick={openNoticeDialog}
                disabled={!selectedFeeIds.length || selectedFeeIds.length > 500}
              >
                Phát hành cho {selectedStudentCount} học viên
              </Button>
              {selectedFeeIds.length > 500 && (
                <Alert severity="warning">
                  Mỗi lần phát hành tối đa 500 khoản học phí.
                </Alert>
              )}
              {selectedFeeIds.length > 0 && (
                <Alert severity="info">
                  Các khoản đã chọn của cùng học viên sẽ được gom vào một đợt
                  thu.
                </Alert>
              )}
            </SelectionSummary>
          </Box>
        </Stack>
      ) : view === "PENDING" ? (
        <Stack spacing={1.5}>
          <SectionHeader
            icon={<HourglassTopOutlinedIcon />}
            title="Đợt thu đang chờ thanh toán"
            subtitle="Chọn học sinh để xuất toàn bộ thông báo phù hợp bộ lọc; chọn từng batch để tách hoặc gộp."
          />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) 280px" },
              gap: 2,
            }}
          >
            <Paper
              variant="outlined"
              sx={{ overflow: "hidden", borderRadius: 3, borderColor: "divider" }}
            >
              <Box sx={{ overflowX: "auto" }}>
                <Table sx={{ minWidth: 900 }} size="small">
                  <TableHead sx={{ "& .MuiTableCell-root": { bgcolor: "action.hover", color: "text.secondary", fontWeight: 800 } }}>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Tooltip title="Chọn tất cả học sinh để xuất thông báo">
                          <span>
                            <Checkbox
                              checked={
                                pendingGroups.length > 0 &&
                                selectedStudentIds.length === pendingGroups.length
                              }
                              indeterminate={
                                selectedStudentIds.length > 0 &&
                                selectedStudentIds.length < pendingGroups.length
                              }
                              onChange={(event) =>
                                setSelectedStudentIds(
                                  event.target.checked
                                    ? pendingGroups.map((group) => group.student.id)
                                    : [],
                                )
                              }
                            />
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell>Đợt thu</TableCell>
                      <TableCell>Học sinh</TableCell>
                      <TableCell>Các khoản</TableCell>
                      <TableCell>Tổng đợt thu</TableCell>
                      <TableCell>Thao tác</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pendingGroups.map((group) => {
                      const groupSelected = selectedStudentIds.includes(group.student.id);
                      return (
                        <Fragment key={group.student.id}>
                          <TableRow sx={{ bgcolor: "action.hover" }}>
                            <TableCell padding="checkbox">
                              <Checkbox
                                checked={groupSelected}
                                onChange={(event) =>
                                  toggleStudent(group.student.id, event.target.checked)
                                }
                              />
                            </TableCell>
                            <TableCell colSpan={5}>
                              <Typography fontWeight={800}>
                                {group.student.fullName}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {group.student.code} · {group.items.length} đợt
                                đang chờ
                              </Typography>
                            </TableCell>
                          </TableRow>
                          {group.items.map((batch) => (
                            <TableRow key={batch.id} hover>
                              <TableCell padding="checkbox">
                                <Tooltip title="Chọn batch để tách hoặc gộp">
                                  <Checkbox
                                    checked={selectedBatchIds.includes(batch.id)}
                                    onChange={() => toggleBatch(batch.id)}
                                  />
                                </Tooltip>
                              </TableCell>
                              <TableCell>
                                <Typography fontWeight={700}>
                                  {batch.batchNo}
                                </Typography>
                                <Chip
                                  size="small"
                                  color="warning"
                                  label="Đang chờ"
                                />
                              </TableCell>
                              <TableCell>
                                {batch.student.fullName}
                                <Typography
                                  variant="caption"
                                  display="block"
                                  color="text.secondary"
                                >
                                  {batch.student.code}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                {getBatchFeeGroups(batch).map((group) => (
                                  <Box key={group.period} sx={{ mb: 0.75 }}>
                                    <Typography variant="caption" color="text.secondary" display="block">
                                      {group.period}
                                    </Typography>
                                    {group.classes.map((line) => (
                                      <Typography key={line.className} variant="body2">
                                        {line.className} · {money(line.amount)}
                                      </Typography>
                                    ))}
                                  </Box>
                                ))}
                              </TableCell>
                              <TableCell>
                                <Typography fontWeight={800}>
                                  {money(batch.totalAmount)}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Stack
                                  direction="row"
                                  spacing={0.5}
                                  flexWrap="wrap"
                                  useFlexGap
                                >
                                  <Button
                                    size="small"
                                    startIcon={<DownloadOutlinedIcon />}
                                    onClick={() => void downloadPendingBatchNotice(batch)}
                                    disabled={isDownloadingSelectedNotices}
                                  >
                                    {isDownloadingSelectedNotices ? "Đang xuất" : "Xuất PDF"}
                                  </Button>
                                  <Button
                                    component={Link}
                                    href={`/admin/tuition-fees/payment-history/${batch.id}`}
                                    size="small"
                                  >
                                    Chi tiết
                                  </Button>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          ))}
                        </Fragment>
                      );
                    })}
                    {!loading && !visiblePendingBatches.length && (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <EmptyState message={hasLoaded ? "Không có đợt thanh toán đang chờ với bộ lọc hiện tại" : "Bấm Tìm kiếm hoặc Làm mới để tải dữ liệu"} />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Box>
            </Paper>
            <Stack spacing={2} sx={{ alignSelf: "start", position: { xl: "sticky" }, top: { xl: 24 } }}>
              <Paper variant="outlined" sx={{ p: 2, borderColor: "primary.light" }}>
                <Stack spacing={1}>
                <Typography variant="body2" fontWeight={700}>
                  Đã chọn {selectedStudentIds.length} học sinh · {selectedStudentNoticeCount} thông báo
                </Typography>
                {selectedStudentOutOfScopeBatches.length > 0 && (
                  <Alert severity="warning" sx={{ py: 0.25 }}>
                    Batch {selectedStudentOutOfScopeBatches[0]!.batchNo} có khoản
                    ngoài kỳ/lớp đang lọc. Hãy chọn batch đó và tách đợt trước khi
                    xuất PDF.
                  </Alert>
                )}
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<DownloadOutlinedIcon />}
                  onClick={() => void downloadSelectedStudentNotices()}
                  disabled={
                    !selectedStudentIds.length ||
                    !selectedStudentNoticeCount ||
                    selectedStudentOutOfScopeBatches.length > 0 ||
                    selectedStudentNoticeCount > 5000 ||
                    isDownloadingSelectedNotices
                  }
                  sx={{ mt: 1 }}
                >
                  {isDownloadingSelectedNotices ? "Đang xuất PDF..." : "Xuất PDF học sinh đã chọn"}
                </Button>
                {selectedStudentNoticeCount > 5000 && (
                  <Typography variant="caption" color="error.main">
                    Mỗi lần xuất tối đa 5.000 thông báo.
                  </Typography>
                )}
                </Stack>
              </Paper>
              <SelectionSummary
                count={selectedBatchIds.length}
                total={selectedBatchTotal}
                details={selectedBatches
                  .slice(0, 5)
                  .map((batch) => `${batch.batchNo} · ${batch.student.fullName}`)}
              >
              <Button
                fullWidth
                variant="contained"
                color="warning"
                startIcon={<CallSplitOutlinedIcon />}
                onClick={() => openRestructureDialog("SPLIT")}
                disabled={!splitTarget || splitTarget.allocations.length < 2}
              >
                Tách đợt thu
              </Button>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<MergeTypeOutlinedIcon />}
                onClick={() => openRestructureDialog("MERGE")}
                disabled={!canMergeBatches}
              >
                Gộp đợt thu
              </Button>
              {selectedBatches.length > 0 && !sameStudent(selectedBatches) && (
                <Alert severity="info">
                  Chỉ được gộp các đợt của cùng một học sinh.
                </Alert>
              )}
              {selectedBatches.length > 0 &&
                selectedBatchStudent &&
                new Set(selectedBatches.map((batch) => batch.bankAccountId))
                  .size > 1 && (
                  <Alert severity="info">
                    Các đợt phải dùng cùng tài khoản nhận tiền.
                  </Alert>
                )}
              </SelectionSummary>
            </Stack>
          </Box>
        </Stack>
      ) : (
        <Stack spacing={1.5}>
          <SectionHeader
            icon={<TaskAltOutlinedIcon />}
            title="Lịch sử đợt thu đã thanh toán"
            subtitle="Dữ liệu chỉ xem; các batch đã thanh toán không thể tách hoặc gộp lại."
          />
          <Paper
            variant="outlined"
            sx={{ overflow: "hidden", borderRadius: 3, borderColor: "divider" }}
          >
            <Box sx={{ overflowX: "auto" }}>
              <Table sx={{ minWidth: 850 }} size="small">
                <TableHead sx={{ "& .MuiTableCell-root": { bgcolor: "action.hover", color: "text.secondary", fontWeight: 800 } }}>
                  <TableRow>
                    <TableCell>Đợt thu</TableCell>
                    <TableCell>Học sinh</TableCell>
                    <TableCell>Các khoản</TableCell>
                    <TableCell>Tổng đợt thu</TableCell>
                    <TableCell>Trạng thái</TableCell>
                    <TableCell>Thao tác</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {successfulGroups.map((group) => (
                    <Fragment key={group.student.id}>
                      <TableRow sx={{ bgcolor: "action.hover" }}>
                        <TableCell colSpan={6}>
                          <Typography fontWeight={800}>
                            {group.student.fullName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {group.student.code} · {group.items.length} đợt đã
                            thanh toán
                          </Typography>
                        </TableCell>
                      </TableRow>
                      {group.items.map((batch) => (
                        <TableRow key={batch.id} hover>
                          <TableCell>
                            <Typography fontWeight={700}>
                              {batch.batchNo}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {batch.student.fullName}
                            <Typography
                              variant="caption"
                              display="block"
                              color="text.secondary"
                            >
                              {batch.student.code}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {getBatchFeeGroups(batch).map((group) => (
                              <Box key={group.period} sx={{ mb: 0.75 }}>
                                <Typography variant="caption" color="text.secondary" display="block">
                                  {group.period}
                                </Typography>
                                {group.classes.map((line) => (
                                  <Typography key={line.className} variant="body2">
                                    {line.className} · {money(line.amount)}
                                  </Typography>
                                ))}
                              </Box>
                            ))}
                          </TableCell>
                          <TableCell>
                            <Typography fontWeight={800}>
                              {money(batch.totalAmount)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              color="success"
                              label="Đã thanh toán"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              component={Link}
                              href={`/admin/tuition-fees/payment-history/${batch.id}`}
                              size="small"
                            >
                              Xem chi tiết
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  ))}
                  {!loading && !visibleSuccessfulBatches.length && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <EmptyState message={hasLoaded ? "Không có đợt đã thanh toán với bộ lọc hiện tại" : "Bấm Tìm kiếm hoặc Làm mới để tải dữ liệu"} />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          </Paper>
        </Stack>
      )}

      <Paper sx={{ p: 2, bgcolor: "action.hover" }}>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <AccountBalanceWalletOutlinedIcon color="primary" />
          <Typography variant="body2" color="text.secondary">
            Tách/gộp chỉ thay đổi thông báo và đợt thanh toán. Hệ thống không
            xóa học phí, không sửa payment đã thành công và không tạo biên lai
            khi phát hành thông báo.
          </Typography>
        </Stack>
      </Paper>

      <ConfirmDialog
        open={noticeDialogOpen}
        title={
          classNoticeMode
            ? "Phát hành toàn bộ thông báo theo lớp"
            : "Phát hành thông báo chuyển khoản"
        }
        message={
          classNoticeMode
          ? `Hệ thống tìm học sinh thuộc lớp ${selectedClass?.name ?? "đã chọn"}, rồi lấy các khoản học phí tháng còn nợ của các em ở mọi lớp ${months.length ? `trong các kỳ ${months.join(", ")}` : "ở tất cả kỳ học phí"}. Mỗi học sinh và mỗi kỳ được phát hành thành một đợt riêng. Đợt chuyển khoản đang chờ cùng học sinh và kỳ được cập nhật nếu phù hợp; đợt đang gắn với sao kê không bị thay đổi.`
            : `Hệ thống sẽ phát hành ${selectedFeeIds.length} khoản cho ${selectedStudentCount} học viên, tự gom theo từng học viên. Tổng số tiền còn nợ: ${money(selectedFeeTotal)}.`
        }
        content={
          <Stack spacing={1.5} sx={{ mt: 2 }}>
            <FormControl fullWidth required error={Boolean(dialogError)}>
              <InputLabel id="notice-bank-account-label">
                Tài khoản nhận tiền
              </InputLabel>
              <Select
                labelId="notice-bank-account-label"
                label="Tài khoản nhận tiền"
                value={bankAccountId}
                onChange={(event) => {
                  setBankAccountId(event.target.value);
                  setDialogError("");
                }}
              >
                <MenuItem value="">Chọn tài khoản nhận tiền</MenuItem>
                {bankAccounts.map((account) => (
                  <MenuItem key={account.id} value={account.id}>
                    {account.bankName} — {account.accountNo} —{" "}
                    {account.accountName}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                {dialogError ||
                  (bankAccounts.length
                    ? "Tài khoản này sẽ được gắn vào batch mới."
                    : "Chưa cấu hình tài khoản nhận tiền")}
              </FormHelperText>
            </FormControl>
          </Stack>
        }
        confirmLabel="Phát hành"
        cancelLabel="Hủy"
        confirmColor="primary"
        onConfirm={() => void submitNotice()}
        onCancel={() => {
          if (!busy) setNoticeDialogOpen(false);
        }}
        isLoading={busy}
        confirmDisabled={!bankAccountId || !bankAccounts.length}
      />

      <ConfirmDialog
        open={Boolean(restructureMode)}
        title={
          restructureMode === "SPLIT"
            ? "Tách đợt thanh toán"
            : "Gộp đợt thanh toán"
        }
        message={
          restructureMode === "SPLIT"
            ? "Batch hiện tại sẽ được hủy và tạo lại thành các batch riêng theo từng khoản học phí."
            : `Các batch đã chọn sẽ được hủy và tạo lại thành một batch tổng ${money(selectedBatchTotal)}.`
        }
        content={
          <Stack spacing={1.5} sx={{ mt: 2 }}>
            {restructureMode === "SPLIT" && splitTarget && (
              <Alert severity="warning">
                <Typography variant="body2" fontWeight={700}>
                  Sau khi tách {splitTarget.batchNo}, hệ thống sẽ tạo:
                </Typography>
                {splitTarget.allocations.map((allocation) => (
                  <Typography key={allocation.tuitionFee.id} variant="body2">
                    {getFeePeriod(allocation.tuitionFee.billingYear, allocation.tuitionFee.billingMonth)} · {allocation.tuitionFee.class?.name || "-"}: {money(allocation.amount)}
                  </Typography>
                ))}
              </Alert>
            )}
            {restructureMode === "MERGE" && (
              <Alert severity="info">
                <Typography variant="body2" fontWeight={700}>
                  Sau khi gộp sẽ tạo 1 batch tổng:
                </Typography>
                <Typography variant="body2">
                  {selectedBatches.map((batch) => batch.batchNo).join(" + ")} →{" "}
                  {money(selectedBatchTotal)}
                </Typography>
              </Alert>
            )}
            <AppTextField
              label="Lý do thao tác"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setDialogError("");
              }}
              multiline
              minRows={3}
              required
              error={Boolean(dialogError)}
              helperText={dialogError || "Bắt buộc nhập để lưu audit log."}
            />
          </Stack>
        }
        confirmLabel="Xác nhận"
        cancelLabel="Hủy"
        confirmColor="warning"
        onConfirm={() => void submitRestructure()}
        onCancel={() => {
          if (!busy) setRestructureMode(null);
        }}
        isLoading={busy}
        confirmDisabled={!reason.trim()}
      />
      <StudentSelectDialog
        open={studentDialog.open}
        onClose={studentDialog.onClose}
        onSelect={handleStudentFilterSelect}
        title="Chọn học viên để lọc"
      />
      <ClassSelectDialog
        open={classDialog.open}
        onClose={classDialog.onClose}
        onSelect={handleClassFilterSelect}
      />
      {Snackbar}
    </Stack>
  );
}

const metricTones = {
  primary: { color: "primary.main", background: "primary.light" },
  warning: { color: "warning.main", background: "warning.light" },
  success: { color: "success.main", background: "success.light" },
  info: { color: "info.main", background: "info.light" },
} as const;

function DashboardMetric({
  icon,
  label,
  value,
  tone,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: keyof typeof metricTones;
  detail?: string;
}) {
  const colors = metricTones[tone];
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.25, md: 1.75 },
        borderRadius: 2.75,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        boxShadow: "0 5px 18px rgba(16, 42, 67, 0.04)",
        transition: "box-shadow 160ms ease, transform 160ms ease",
        "&:hover": { boxShadow: 2, transform: "translateY(-1px)" },
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Box
          sx={{
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            width: 38,
            height: 38,
            borderRadius: 1.75,
            color: colors.color,
            bgcolor: colors.background,
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" noWrap>
            {label}
          </Typography>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={{ sm: 0.75 }}
            alignItems={{ sm: "baseline" }}
          >
            <Typography variant="h6" fontWeight={800} lineHeight={1.2}>
              {value}
            </Typography>
            {detail && (
              <Typography variant="caption" color="text.secondary" noWrap>
                {detail}
              </Typography>
            )}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Stack direction="row" spacing={1} alignItems="flex-start">
      <Box
        sx={{
          display: "grid",
          placeItems: "center",
          width: 34,
          height: 34,
          mt: 0.25,
          borderRadius: 1.5,
          color: "primary.main",
          bgcolor: "primary.light",
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography variant="subtitle1" fontWeight={800}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      </Box>
    </Stack>
  );
}

function SelectionSummary({
  count,
  total,
  details,
  children,
}: {
  count: number;
  total: number;
  details: string[];
  children: ReactNode;
}) {
  return (
    <Paper
      sx={{
        p: { xs: 1.75, md: 2 },
        alignSelf: "start",
        position: { lg: "sticky" },
        top: { lg: 24 },
        border: "1px solid",
        borderColor: "primary.light",
        bgcolor: "background.paper",
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <InfoOutlinedIcon color="primary" fontSize="small" />
          <Box>
            <Typography variant="subtitle1" fontWeight={800}>
              Tóm tắt lựa chọn
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Kiểm tra trước khi thực hiện thao tác
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Box
            sx={{
              flex: 1,
              p: 1.25,
              borderRadius: 1.5,
              bgcolor: "background.default",
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Số khoản/đợt
            </Typography>
            <Typography variant="h6" fontWeight={800}>
              {count}
            </Typography>
          </Box>
          <Box
            sx={{
              flex: 1,
              p: 1.25,
              borderRadius: 1.5,
              bgcolor: "background.default",
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Tổng tiền
            </Typography>
            <Typography variant="body1" fontWeight={800} sx={{ mt: 0.5 }}>
              {money(total)}
            </Typography>
          </Box>
        </Stack>
        {details.length > 0 && (
          <Stack spacing={0.25} sx={{ maxHeight: 130, overflowY: "auto" }}>
            {details.map((detail) => (
              <Typography
                key={detail}
                variant="caption"
                color="text.secondary"
                noWrap
              >
                {detail}
              </Typography>
            ))}
            {count > details.length && (
              <Typography variant="caption" color="text.secondary">
                + {count - details.length} khoản/đợt khác
              </Typography>
            )}
          </Stack>
        )}
        <Box sx={{ pt: 0.5 }}>
          <Stack spacing={1}>{children}</Stack>
        </Box>
      </Stack>
    </Paper>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Stack alignItems="center" spacing={1} sx={{ py: 5 }}>
      <CheckCircleOutlineOutlinedIcon color="disabled" />
      <Typography color="text.secondary">{message}</Typography>
    </Stack>
  );
}
