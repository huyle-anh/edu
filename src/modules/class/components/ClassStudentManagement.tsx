"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Drawer,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Menu,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { StudentSelectDialog, type StudentItem } from "@/components/shared/dialogs/StudentSelectDialog";
import { ConfirmDialog } from "@/components/shared/dialogs/ConfirmDialog";
import { MonthPickerField } from "@/components/shared/forms/MonthPickerField";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { useSnackbar } from "@/hooks/useSnackbar";
import { getVietnamMonth } from "@/lib/vietnam-time";
import { clampMonth } from "@/utils/date";
import { AppTextField } from "@/components/shared/forms/AppTextField";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import { LoadingState } from "@/components/shared/feedback/LoadingState";
import { FilterActions } from "@/components/shared/FilterActions";
import AddCardOutlinedIcon from "@mui/icons-material/AddCardOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import MoreVertOutlinedIcon from "@mui/icons-material/MoreVertOutlined";
import { TuitionDetail } from "@/modules/finance/tuition/components/TuitionDetail";

type ClassSubject = {
  id: string;
  tuitionFee: number;
  status: "ACTIVE" | "INACTIVE" | "COMPLETED";
  subject: { id: string; name: string; status?: "ACTIVE" | "INACTIVE" };
};

type ClassData = { id: string; code: string; name: string; status: string; startDate?: string | null; endDate?: string | null; classSubjects: ClassSubject[] };
type EnrollmentPause = { id: string; status: "ACTIVE" | "CANCELLED"; startMonth: string; endMonth: string; reason: string | null };
type Fee = {
  id: string;
  feeNo: string;
  status: string;
  finalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  billingYear: number;
  billingMonth: number;
  billingType: string;
  note: string | null;
  payments: Array<{
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    bankTransactionNo: string | null;
    transactionReference: string | null;
    paymentContent: string | null;
    paymentBatch: {
      bankTransactionNo: string | null;
      transactionReference: string | null;
      paymentContent: string | null;
      statementRowLinks: Array<{
        isConfirmed: boolean;
        row: {
          bankTransactionNo: string | null;
          description: string;
          reconciliationContent: string;
        };
      }>;
    } | null;
  }>;
  items: Array<{ classSubjectId: string | null; itemName: string; amount: number }>;
  paymentAllocations: Array<{
    paymentBatch: {
      id: string;
      batchNo: string;
      status: string;
      paymentContent: string | null;
      bankTransactionNo: string | null;
      transactionReference: string | null;
      statementRowLinks: Array<{
        isConfirmed: boolean;
        row: { bankTransactionNo: string | null; description: string; reconciliationContent: string };
      }>;
    };
  }>;
};
type StudentRow = {
  id: string;
  studentId: string;
  status: "ACTIVE" | "COMPLETED" | "LEFT";
  student: { code: string; fullName: string; phone?: string | null };
  subjects: Array<{ classSubjectId: string }>;
  tuitionFees: Fee[];
  pauses: EnrollmentPause[];
};
type StudentSummary = {
  total: number;
  active: number;
  paused: number;
  completed: number;
  left: number;
  uncreated: number;
  tuitionFees: { count: number; amount: number; paid: number; remaining: number };
};
type StudentListResult = {
  items: StudentRow[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  summary: StudentSummary;
};
type ClassStudentImportResult = {
  importedRows: number;
  skippedRows: number;
  errors: Array<{ rowNo: number; message: string }>;
};

const currentMonth = () => {
  return getVietnamMonth();
};
const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} VND`;
const monthValue = (value: string) => value.slice(0, 7);
const paymentDateValue = (value: string) => new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  dateStyle: "short",
  timeStyle: "short",
}).format(new Date(value));
const feeStatusLabel: Record<string, string> = {
  UNPAID: "Chưa thu",
  PARTIAL: "Đã thu một phần",
  PAID: "Đã thanh toán",
  OVERDUE: "Quá hạn",
  EXEMPTED: "Được miễn",
  CANCELLED: "Đã hủy",
};
const feeStatusColor: Record<string, "warning" | "success" | "error" | "info" | "default"> = {
  UNPAID: "warning",
  PARTIAL: "info",
  PAID: "success",
  OVERDUE: "error",
  EXEMPTED: "info",
  CANCELLED: "default",
};

export function ClassStudentManagement({ id }: { id: string }) {
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [month, setMonth] = useState(currentMonth);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [appliedStatusFilter, setAppliedStatusFilter] = useState("ALL");
  const [subjectFilter, setSubjectFilter] = useState("ALL");
  const [appliedSubjectFilter, setAppliedSubjectFilter] = useState("ALL");
  const [tuitionStatusFilter, setTuitionStatusFilter] = useState("ALL");
  const [appliedTuitionStatusFilter, setAppliedTuitionStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [studentPage, setStudentPage] = useState(0);
  const [studentPageSize, setStudentPageSize] = useState(20);
  const [studentSort, setStudentSort] = useState<{ key: "code" | "fullName" | "item" | "finalAmount" | "paidAmount" | "remainingAmount" | "feeStatus"; direction: "asc" | "desc" }>({ key: "fullName", direction: "asc" });
  const [totalStudents, setTotalStudents] = useState(0);
  const [summary, setSummary] = useState<StudentSummary>({ total: 0, active: 0, paused: 0, completed: 0, left: 0, uncreated: 0, tuitionFees: { count: 0, amount: 0, paid: 0, remaining: 0 } });
  const requestVersion = useRef(0);
  const [error, setError] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [studentPickerOpen, setStudentPickerOpen] = useState(false);
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [pendingStudent, setPendingStudent] = useState<StudentItem | null>(null);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [registeredSubjectIds, setRegisteredSubjectIds] = useState<string[]>([]);
  const [dropTarget, setDropTarget] = useState<{ student: StudentRow; subjectId: string; hasFee: boolean } | null>(null);
  const [dropReason, setDropReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<StudentRow | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [pauseTarget, setPauseTarget] = useState<StudentRow | null>(null);
  const [pauseStart, setPauseStart] = useState(currentMonth);
  const [pauseEnd, setPauseEnd] = useState(currentMonth);
  const [pauseReason, setPauseReason] = useState("");
  const [editingPauseId, setEditingPauseId] = useState<string | null>(null);
  const [pauseCancelTarget, setPauseCancelTarget] = useState<{
    student: StudentRow;
    pauseId: string;
  } | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSubjectIds, setImportSubjectIds] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<ClassStudentImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [createFeesConfirmOpen, setCreateFeesConfirmOpen] = useState(false);
  const [selectedFeeId, setSelectedFeeId] = useState<string | null>(null);
  const [actionMenu, setActionMenu] = useState<{ anchorEl: HTMLElement; student: StudentRow } | null>(null);
  const feeDrawerHistoryEntry = useRef(false);
  const { showSuccess, showError, Snackbar } = useSnackbar();

  const load = useCallback(async () => {
    const currentRequest = ++requestVersion.current;
    setLoading(true);
    setError("");
    try {
      const [classResponse, studentsResponse] = await Promise.all([
        fetch(`/api/classes/${id}`),
        fetch(`/api/classes/${id}/students?page=${studentPage + 1}&pageSize=${studentPageSize}&search=${encodeURIComponent(appliedSearch)}&status=${appliedStatusFilter === "ALL" ? "" : appliedStatusFilter}&subjectId=${appliedSubjectFilter === "ALL" ? "" : appliedSubjectFilter}&tuitionStatus=${appliedTuitionStatusFilter === "ALL" ? "" : appliedTuitionStatusFilter}&month=${encodeURIComponent(month)}&sortBy=${studentSort.key}&sortDirection=${studentSort.direction}`),
      ]);
      if (!classResponse.ok) throw new Error(await extractApiErrorMessage(classResponse, "Không thể tải lớp học"));
      if (!studentsResponse.ok) throw new Error(await extractApiErrorMessage(studentsResponse, "Không thể tải danh sách học viên"));
      const [classResult, studentResult] = await Promise.all([
        unwrapApiResponse<ClassData>(classResponse),
        unwrapApiResponse<StudentListResult>(studentsResponse),
      ]);
      if (currentRequest !== requestVersion.current) return;
      setClassData(classResult);
      setStudents(studentResult.items);
      setTotalStudents(studentResult.total);
      setSummary(studentResult.summary);
      setSelectedStudent((current) => current ? studentResult.items.find((item) => item.id === current.id) ?? null : null);
    } catch (reason) {
      if (currentRequest === requestVersion.current) {
        setError(reason instanceof Error ? reason.message : "Không thể tải dữ liệu");
      }
    } finally {
      if (currentRequest === requestVersion.current) setLoading(false);
    }
  }, [id, month, appliedSearch, appliedStatusFilter, studentPage, studentPageSize, appliedSubjectFilter, appliedTuitionStatusFilter, studentSort]);

  const handleStudentSort = (key: typeof studentSort.key) => {
    setStudentPage(0);
    setStudentSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const syncFeeDrawer = () => {
      const feeId = new URLSearchParams(window.location.search).get("feeId");
      setSelectedFeeId(feeId);
      if (!feeId) feeDrawerHistoryEntry.current = false;
    };
    syncFeeDrawer();
    window.addEventListener("popstate", syncFeeDrawer);
    return () => window.removeEventListener("popstate", syncFeeDrawer);
  }, []);

  function openFeeDrawer(feeId: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("feeId", feeId);
    window.history.pushState({ feeDrawer: true }, "", url);
    feeDrawerHistoryEntry.current = true;
    setSelectedFeeId(feeId);
  }

  function closeFeeDrawer() {
    if (feeDrawerHistoryEntry.current) {
      window.history.back();
      feeDrawerHistoryEntry.current = false;
    } else {
      const url = new URL(window.location.href);
      url.searchParams.delete("feeId");
      window.history.replaceState(window.history.state, "", url);
      setSelectedFeeId(null);
    }
  }

  function refreshWorkspace() {
    void load();
  }

  useEffect(() => {
    setMonth((current) => clampMonth(
      current,
      classData?.startDate?.slice(0, 7),
      classData?.endDate?.slice(0, 7),
    ));
  }, [classData?.endDate, classData?.startDate]);

  const subjectName = useMemo(() => new Map((classData?.classSubjects ?? []).map((item) => [item.id, item.subject.name])), [classData]);
  const getPause = (student: StudentRow) => student.pauses.find((pause) => pause.status === "ACTIVE" && monthValue(pause.startMonth) <= month && monthValue(pause.endMonth) >= month);
  const getFee = (student: StudentRow) => {
    const [year, selectedMonth] = month.split("-").map(Number);
    return student.tuitionFees.find((fee) => fee.billingType === "MONTHLY" && fee.billingYear === year && fee.billingMonth === selectedMonth);
  };
  const getFees = (student: StudentRow) => {
    const [year, selectedMonth] = month.split("-").map(Number);
    return student.tuitionFees.filter((fee) => fee.billingType === "MONTHLY" && fee.billingYear === year && fee.billingMonth === selectedMonth);
  };
  const feeAmount = (fees: Fee[], field: "finalAmount" | "paidAmount" | "remainingAmount") => fees.reduce((sum, fee) => sum + Number(fee[field]), 0);
  const pagedStudents = students;
  const activeCount = summary.active;
  const pausedCount = summary.paused;
  const uncreatedCount = summary.uncreated;

  useEffect(() => {
    setStudentPage(0);
  }, [month, appliedSearch, appliedStatusFilter, appliedSubjectFilter, appliedTuitionStatusFilter]);

  function applyFilters() {
    setAppliedSearch(search.trim());
    setAppliedStatusFilter(statusFilter);
    setAppliedSubjectFilter(subjectFilter);
    setAppliedTuitionStatusFilter(tuitionStatusFilter);
    setStudentPage(0);
  }

  function clearFilters() {
    setSearch("");
    setAppliedSearch("");
    setStatusFilter("ALL");
    setAppliedStatusFilter("ALL");
    setSubjectFilter("ALL");
    setAppliedSubjectFilter("ALL");
    setTuitionStatusFilter("ALL");
    setAppliedTuitionStatusFilter("ALL");
    setStudentPage(0);
  }

  function openSubjectDialog(student: StudentItem, existing?: StudentRow) {
    const registered = existing?.subjects.map((item) => item.classSubjectId) ?? [];
    setPendingStudent(student);
    setRegisteredSubjectIds(registered);
    setSelectedSubjectIds(registered);
    setSubjectDialogOpen(true);
  }

  async function submitSubjects() {
    const subjectsToAdd = selectedSubjectIds.filter(
      (subjectId) => !registeredSubjectIds.includes(subjectId),
    );
    if (!pendingStudent || !subjectsToAdd.length) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/classes/${id}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: pendingStudent.id, classSubjectIds: subjectsToAdd }),
      });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể cập nhật môn học"));
      setSubjectDialogOpen(false);
      await load();
      showSuccess("Đã cập nhật môn đăng ký");
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : "Không thể cập nhật môn học");
    } finally {
      setBusy(false);
    }
  }

  async function dropSubject() {
    if (!dropTarget) return;
    if (dropTarget.hasFee && !dropReason.trim()) {
      showError("Vui lòng nhập lý do force cancel môn đã phát sinh học phí");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/classes/${id}/students/${dropTarget.student.studentId}/subjects/${dropTarget.subjectId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: dropTarget.hasFee, reason: dropTarget.hasFee ? dropReason.trim() : undefined }),
      });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể bỏ môn"));
      setDropTarget(null);
      setDropReason("");
      await load();
      showSuccess("Đã bỏ môn học");
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : "Không thể bỏ môn");
    } finally {
      setBusy(false);
    }
  }

  async function deleteStudent() {
    if (!deleteTarget) return;
    const hasFee = deleteTarget.tuitionFees.length > 0;
    if (hasFee && !deleteReason.trim()) {
      showError("Vui lòng nhập lý do force rời lớp đã phát sinh học phí");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/classes/${id}/students`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: deleteTarget.studentId, force: hasFee, reason: hasFee ? deleteReason.trim() : undefined }),
      });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể xóa học viên"));
      setDeleteTarget(null);
      setDeleteReason("");
      await load();
      showSuccess("Đã xóa học viên khỏi lớp");
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : "Không thể xóa học viên");
    } finally {
      setBusy(false);
    }
  }

  async function pauseStudent() {
    if (!pauseTarget) return;
    const wasEditing = Boolean(editingPauseId);
    if (!pauseStart || !pauseEnd) {
      showError("Vui lòng chọn đủ tháng bắt đầu và tháng kết thúc");
      return;
    }
    if (pauseStart > pauseEnd) {
      showError("Tháng bắt đầu phải trước hoặc bằng tháng kết thúc");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/classes/${id}/students/${pauseTarget.studentId}/pause`, {
        method: editingPauseId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingPauseId && { pauseId: editingPauseId }),
          startMonth: pauseStart,
          endMonth: pauseEnd,
          reason: pauseReason,
        }),
      });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể lưu thời gian tạm nghỉ"));
      setPauseTarget(null);
      setEditingPauseId(null);
      setPauseReason("");
      await load();
      showSuccess(wasEditing ? "Đã cập nhật thời gian tạm nghỉ" : "Đã ghi nhận thời gian tạm nghỉ");
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : "Không thể tạo thời gian tạm nghỉ");
    } finally {
      setBusy(false);
    }
  }

  async function cancelPause(student: StudentRow, pauseId: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/classes/${id}/students/${student.studentId}/pause`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pauseId }),
      });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể hủy thời gian tạm nghỉ"));
      setPauseCancelTarget(null);
      await load();
      showSuccess("Đã hủy thời gian tạm nghỉ");
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : "Không thể hủy thời gian tạm nghỉ");
    } finally {
      setBusy(false);
    }
  }

  function openImportDialog() {
    setImportFile(null);
    setImportSubjectIds([]);
    setImportResult(null);
    setImportDialogOpen(true);
  }

  async function importStudents() {
    if (!importFile) {
      showError("Vui lòng chọn file Excel danh sách học viên");
      return;
    }
    if (!importSubjectIds.length) {
      showError("Vui lòng chọn ít nhất một môn học");
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", importFile);
      importSubjectIds.forEach((subjectId) => form.append("classSubjectIds", subjectId));
      const response = await fetch("/api/classes/" + id + "/students/import", {
        method: "POST",
        body: form,
      });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể import học viên vào lớp"));

      const result = await unwrapApiResponse<ClassStudentImportResult>(response);
      setImportResult(result);
      await load();
      showSuccess("Đã đăng ký " + result.importedRows + " học viên, bỏ qua " + result.skippedRows + " dòng.");
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : "Không thể import học viên vào lớp");
    } finally {
      setBusy(false);
    }
  }

  async function exportStudents() {
    setBusy(true);
    try {
      const response = await fetch(`/api/classes/${id}/students/export`);
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể xuất danh sách học viên"));

      const file = await response.blob();
      const url = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `danh-sach-hoc-vien-${classData?.code ?? "lop"}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
      showSuccess("Đã xuất danh sách học viên ra Excel");
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : "Không thể xuất danh sách học viên");
    } finally {
      setBusy(false);
    }
  }

  async function createFees() {
    setBusy(true);
    try {
      const response = await fetch(
        `/api/classes/${id}/tuition-fees?month=${encodeURIComponent(month)}`,
        { method: "POST" },
      );
      if (!response.ok) {
        throw new Error(
          await extractApiErrorMessage(response, "Không thể tạo học phí tháng"),
        );
      }
      const result = await unwrapApiResponse<{ created: number; skipped: number }>(response);
      setCreateFeesConfirmOpen(false);
      await load();
      showSuccess(`Đã tạo/cập nhật phí cho ${result.created} học viên; bỏ qua ${result.skipped} học viên.`);
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : "Không thể tạo học phí tháng");
    } finally {
      setBusy(false);
    }
  }

  if (!classData && loading) return <LoadingState label="Đang tải quản lý học viên..." minHeight={320} />;
  if (!classData) return <Alert severity="error">{error || "Không tìm thấy lớp học"}</Alert>;
  const classNotActive = classData.status !== "ACTIVE";
  const canRegisterStudents = classData.status === "ACTIVE" || classData.status === "DRAFT";
  const hasActiveClassSubjects = classData.classSubjects.some((subject) => subject.subject.status !== "INACTIVE");
  const selectedFee = selectedStudent ? getFee(selectedStudent) : null;
  const selectedExpectedAmount = selectedStudent?.subjects.reduce(
    (total, item) => total + Number(classData.classSubjects.find((subject) => subject.id === item.classSubjectId)?.tuitionFee ?? 0),
    0,
  ) ?? 0;
  const overviewGroups = [
    {
      title: "Học viên trong lớp",
      items: [
        ["Tổng số", summary.total],
        ["Đang học", activeCount],
        ["Tạm nghỉ", pausedCount],
        ["Hoàn thành / rời lớp", summary.completed + summary.left],
      ],
    },
    {
      title: `Học phí kỳ ${month} · toàn lớp`,
      items: [
        ["Khoản phí", summary.tuitionFees.count],
        ["Chưa tạo phí", Math.max(0, uncreatedCount)],
        ["Phải thu", money(summary.tuitionFees.amount)],
        ["Đã thu", money(summary.tuitionFees.paid)],
        ["Còn nợ", money(summary.tuitionFees.remaining)],
      ],
    },
  ];

  return <Stack spacing={{ xs: 2, md: 3 }}>
    <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={2}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ width: 44, height: 44, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "primary.main", color: "primary.contrastText" }}>
            <PeopleAltOutlinedIcon />
          </Box>
          <Stack spacing={0.25}>
            <Button component={Link} href={`/admin/classes/${id}`} variant="text" size="small" sx={{ alignSelf: "flex-start", px: 0 }}>← {classData.code}</Button>
            <Typography variant="h5" fontWeight={700}>Học viên & học phí</Typography>
            <Typography color="text.secondary">{classData.name}</Typography>
          </Stack>
        </Stack>
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" justifyContent={{ xs: "flex-start", sm: "flex-end" }}>
          <Button size="small" variant="outlined" startIcon={<RefreshOutlinedIcon />} onClick={refreshWorkspace} disabled={loading}>Làm mới</Button>
          <Button size="small" variant="outlined" startIcon={<DownloadOutlinedIcon />} onClick={() => void exportStudents()} disabled={busy || loading}>Xuất Excel</Button>
          <Button size="small" variant="outlined" startIcon={<UploadFileOutlinedIcon />} onClick={openImportDialog} disabled={!canRegisterStudents || !hasActiveClassSubjects}>Import Excel</Button>
          <Button size="small" variant="contained" onClick={() => setStudentPickerOpen(true)} disabled={!canRegisterStudents || !hasActiveClassSubjects}>Đăng ký học viên</Button>
        </Stack>
      </Stack>
    </Paper>
    {error && <Alert severity="error">{error}</Alert>}
    {classData.status === "DRAFT" && <Alert severity="info">Lớp Nháp: có thể đăng ký học viên; quản lý môn và tạo học phí cần lớp Hoạt động.</Alert>}
    {classData.status !== "ACTIVE" && classData.status !== "DRAFT" && <Alert severity="info">Lớp đã kết thúc hoặc đã hủy; thông tin đăng ký chỉ được xem.</Alert>}
    {!classNotActive && !hasActiveClassSubjects && <Alert severity="warning">Lớp chưa có môn đang hoạt động; hãy mở môn học trước khi đăng ký học viên.</Alert>}
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
      {overviewGroups.map((group) => <Paper key={group.title} variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, minWidth: 0 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.25 }}>{group.title}</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1 }}>
          {group.items.map(([label, value]) => <Box key={String(label)} sx={{ minWidth: 0, p: 1, borderRadius: 1.5, bgcolor: "action.hover" }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", overflowWrap: "anywhere" }}>{label}</Typography>
            <Typography variant="subtitle1" fontWeight={700} sx={{ overflowWrap: "anywhere" }}>{value}</Typography>
          </Box>)}
        </Box>
      </Paper>)}
    </Box>
    <Paper sx={{ p: { xs: 1.5, md: 2 } }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={1.5}>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <Box>
            <Typography variant="subtitle2" fontWeight={700}>Kỳ học phí</Typography>
            <Typography variant="caption" color="text.secondary">Áp dụng cho danh sách học viên và học phí</Typography>
          </Box>
          <MonthPickerField label="Kỳ học phí" value={month} onChange={setMonth} minMonth={classData.startDate?.slice(0, 7)} maxMonth={classData.endDate?.slice(0, 7)} textFieldProps={{ size: "small" }} />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            startIcon={<AddCardOutlinedIcon />}
            onClick={() => setCreateFeesConfirmOpen(true)}
            disabled={busy || loading || classNotActive}
            sx={{ flex: 1, minWidth: 0, whiteSpace: "normal" }}
          >
            Tạo học phí
          </Button>
          <Button
            component={Link}
            href={`/admin/tuition-fees/notice-management?classId=${encodeURIComponent(id)}&month=${encodeURIComponent(month)}`}
            variant="outlined"
            sx={{ flex: 1, minWidth: 0, whiteSpace: "normal" }}
          >
            Thông báo thu
          </Button>
        </Stack>
      </Stack>
    </Paper>
    <Stack spacing={1.5}>
    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={1}>
      <Box><Typography variant="h6" fontWeight={700}>Danh sách học viên</Typography><Typography variant="body2" color="text.secondary">Một dòng cho mỗi học viên; số liệu học phí theo kỳ {month}.</Typography></Box>
      <Chip size="small" variant="outlined" label={`${totalStudents} học viên phù hợp`} />
    </Stack>
    <Paper sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}><FilterAltOutlinedIcon color="action" fontSize="small" /><Typography fontWeight={700}>Tìm và lọc học viên, học phí</Typography></Stack>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} useFlexGap sx={{ flexWrap: { xs: "nowrap", md: "wrap" } }} alignItems={{ md: "center" }}>
        <AppTextField name="studentSearch" size="small" label="Tìm mã, tên, số điện thoại" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") applyFilters(); }} sx={{ minWidth: 280, flex: 1 }} />
        <FormControl size="small" sx={{ minWidth: 150 }}><InputLabel id="student-status-filter-label" htmlFor="student-status-filter-input">Trạng thái</InputLabel><Select id="student-status-filter" labelId="student-status-filter-label" inputProps={{ id: "student-status-filter-input", name: "studentStatusFilter" }} label="Trạng thái" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><MenuItem value="ALL">Tất cả</MenuItem><MenuItem value="ACTIVE">Đang học</MenuItem><MenuItem value="PAUSED">Tạm nghỉ</MenuItem><MenuItem value="COMPLETED">Đã hoàn thành</MenuItem><MenuItem value="LEFT">Đã rời lớp</MenuItem></Select></FormControl>
        <FormControl size="small" sx={{ minWidth: 170 }}><InputLabel id="student-subject-filter-label" htmlFor="student-subject-filter-input">Môn học</InputLabel><Select id="student-subject-filter" labelId="student-subject-filter-label" inputProps={{ id: "student-subject-filter-input", name: "studentSubjectFilter" }} label="Môn học" value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}><MenuItem value="ALL">Tất cả môn</MenuItem>{classData.classSubjects.map((subject) => <MenuItem key={subject.id} value={subject.id}>{subject.subject.name}</MenuItem>)}</Select></FormControl>
        <FormControl size="small" sx={{ minWidth: 170 }}><InputLabel id="tuition-status-filter-label" htmlFor="tuition-status-filter-input">Trạng thái học phí</InputLabel><Select id="tuition-status-filter" labelId="tuition-status-filter-label" inputProps={{ id: "tuition-status-filter-input", name: "tuitionStatusFilter" }} label="Trạng thái học phí" value={tuitionStatusFilter} onChange={(event) => setTuitionStatusFilter(event.target.value)}><MenuItem value="ALL">Tất cả học phí</MenuItem><MenuItem value="NONE">Chưa tạo phí</MenuItem><MenuItem value="UNPAID">Chưa thu</MenuItem><MenuItem value="PARTIAL">Đã thu một phần</MenuItem><MenuItem value="PAID">Đã thanh toán</MenuItem><MenuItem value="OVERDUE">Quá hạn</MenuItem><MenuItem value="EXEMPTED">Miễn phí</MenuItem><MenuItem value="CANCELLED">Đã hủy</MenuItem></Select></FormControl>
        <FilterActions mobileDirection="row" onSearch={applyFilters} onClear={clearFilters} hasFilters={Boolean(search.trim() || appliedSearch) || statusFilter !== "ALL" || appliedStatusFilter !== "ALL" || subjectFilter !== "ALL" || appliedSubjectFilter !== "ALL" || tuitionStatusFilter !== "ALL" || appliedTuitionStatusFilter !== "ALL"} isLoading={loading} />
      </Stack>
    </Paper>
    <Paper sx={{ overflow: "hidden" }}>
      {loading && <LinearProgress />}
      <Box sx={{ display: { xs: "none", md: "block" }, overflowX: "auto" }}>
      <Table sx={{ minWidth: 1250 }}>
        <TableHead><TableRow>
          <TableCell><TableSortLabel active={studentSort.key === "fullName"} direction={studentSort.key === "fullName" ? studentSort.direction : "asc"} onClick={() => handleStudentSort("fullName")}>Học viên</TableSortLabel></TableCell>
          <TableCell align="right"><TableSortLabel active={studentSort.key === "finalAmount"} direction={studentSort.key === "finalAmount" ? studentSort.direction : "asc"} onClick={() => handleStudentSort("finalAmount")}>Phải thu</TableSortLabel></TableCell>
          <TableCell align="right"><TableSortLabel active={studentSort.key === "remainingAmount"} direction={studentSort.key === "remainingAmount" ? studentSort.direction : "asc"} onClick={() => handleStudentSort("remainingAmount")}>Còn nợ</TableSortLabel></TableCell>
          <TableCell align="right"><TableSortLabel active={studentSort.key === "paidAmount"} direction={studentSort.key === "paidAmount" ? studentSort.direction : "asc"} onClick={() => handleStudentSort("paidAmount")}>Đã thu</TableSortLabel></TableCell>
          <TableCell><TableSortLabel active={studentSort.key === "item"} direction={studentSort.key === "item" ? studentSort.direction : "asc"} onClick={() => handleStudentSort("item")}>Khoản phí / ghi chú</TableSortLabel></TableCell>
          <TableCell><TableSortLabel active={studentSort.key === "feeStatus"} direction={studentSort.key === "feeStatus" ? studentSort.direction : "asc"} onClick={() => handleStudentSort("feeStatus")}>Trạng thái phí</TableSortLabel></TableCell>
          <TableCell>Tình trạng</TableCell>
          <TableCell align="right" sx={{ position: "sticky", right: 0, zIndex: 3, bgcolor: "background.paper", boxShadow: "-6px 0 8px -8px rgba(0,0,0,0.35)" }}>Thao tác</TableCell>
        </TableRow></TableHead>
        <TableBody>{pagedStudents.map((student) => {
          const pause = getPause(student);
          const fees = getFees(student);
          const totalAmount = feeAmount(fees, "finalAmount");
          const remainingAmount = feeAmount(fees, "remainingAmount");
          const paidAmount = feeAmount(fees, "paidAmount");
          return <TableRow key={student.id} hover>
            <TableCell sx={{ minWidth: 200 }}><Typography fontWeight={600}>{student.student.fullName}</Typography><Typography variant="caption" color="text.secondary">{student.student.code} · {student.student.phone || "Chưa có SĐT"}</Typography></TableCell>
            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{fees.length ? money(totalAmount) : <Typography variant="body2" color="text.secondary">{pause ? "Không phát sinh" : "Chưa tạo phí"}</Typography>}</TableCell>
            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}><Typography fontWeight={700} color={remainingAmount > 0 ? "error.main" : "success.main"}>{fees.length ? money(remainingAmount) : "—"}</Typography></TableCell>
            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{fees.length ? money(paidAmount) : "—"}</TableCell>
            <TableCell sx={{ minWidth: 190, maxWidth: 260 }}>
              {fees.length ? <>{fees.slice(0, 2).map((fee) => <Box key={fee.id} sx={{ mb: fee.note ? 0.75 : 0 }}><Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>{fee.items.map((item) => item.itemName).join(", ") || "Học phí"}</Typography>{fee.note && <Typography variant="caption" color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }} title={fee.note}><strong>Ghi chú:</strong> {fee.note}</Typography>}</Box>)}{fees.length > 2 && <Typography variant="caption" color="text.secondary">+{fees.length - 2} khoản phí khác</Typography>}</> : <Typography variant="body2" color="text.secondary">{pause ? "Không phát sinh do tạm nghỉ" : "Chưa tạo học phí"}</Typography>}
            </TableCell>
            <TableCell sx={{ minWidth: 150 }}>{fees.length ? <>{fees.slice(0, 2).map((fee) => {
              const pendingBatch = fee.paymentAllocations[0]?.paymentBatch;
              return <Stack key={fee.id} spacing={0.5} alignItems="flex-start" sx={{ mb: 0.5 }}><Chip size="small" color={pendingBatch ? "warning" : feeStatusColor[fee.status] ?? "default"} label={pendingBatch ? "Đang chờ đối soát" : feeStatusLabel[fee.status] ?? fee.status} />{pendingBatch && <Typography variant="caption" color="text.secondary">{pendingBatch.batchNo}</Typography>}</Stack>;
            })}{fees.length > 2 && <Typography variant="caption" color="text.secondary">+{fees.length - 2} trạng thái</Typography>}</> : <Chip size="small" color={pause ? "info" : "warning"} label={pause ? "Tạm nghỉ · không phát sinh" : "Chưa tạo"} />}</TableCell>
            <TableCell sx={{ minWidth: 170 }}><Chip size="small" color={student.status === "LEFT" ? "error" : student.status === "COMPLETED" ? "default" : pause ? "info" : "success"} label={student.status === "LEFT" ? "Đã rời lớp" : student.status === "COMPLETED" ? "Đã hoàn thành" : pause ? `Tạm nghỉ đến ${monthValue(pause.endMonth)}` : "Đang học"} /><Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, maxWidth: 220 }} noWrap title={student.subjects.map((item) => subjectName.get(item.classSubjectId)).filter(Boolean).join(", ")}>{student.subjects.map((item) => subjectName.get(item.classSubjectId)).filter(Boolean).join(", ") || "Chưa đăng ký môn"}</Typography></TableCell>
            <TableCell align="right" sx={{ position: "sticky", right: 0, zIndex: 1, bgcolor: "background.paper", whiteSpace: "nowrap", boxShadow: "-6px 0 8px -8px rgba(0,0,0,0.35)" }}><Button size="small" variant="outlined" onClick={() => setSelectedStudent(student)}>Chi tiết</Button><Button size="small" aria-label={`Thao tác ${student.student.fullName}`} onClick={(event) => setActionMenu({ anchorEl: event.currentTarget, student })}><MoreVertOutlinedIcon /></Button></TableCell>
          </TableRow>;
        })}{!pagedStudents.length && <TableRow><TableCell colSpan={8}><Typography sx={{ p: 4, textAlign: "center" }} color="text.secondary">{loading ? "Đang tải dữ liệu..." : "Không có học viên hoặc khoản phí phù hợp"}</Typography></TableCell></TableRow>}</TableBody>
      </Table>
      </Box>
      <Box sx={{ display: { xs: "grid", md: "none" }, gap: 1.25, p: 1.5 }}>
        {pagedStudents.map((student) => {
          const pause = getPause(student);
          const fees = getFees(student);
          const totalAmount = feeAmount(fees, "finalAmount");
          const paidAmount = feeAmount(fees, "paidAmount");
          const remainingAmount = feeAmount(fees, "remainingAmount");
          const studentStatus = student.status === "COMPLETED"
            ? { label: "Đã hoàn thành", color: "default" as const }
            : student.status === "LEFT"
              ? { label: "Đã rời lớp", color: "error" as const }
              : pause
                ? { label: `Tạm nghỉ đến ${monthValue(pause.endMonth)}`, color: "info" as const }
                : { label: "Đang học", color: "success" as const };
          return (
            <Paper key={student.id} variant="outlined" sx={{ p: 1.5 }}>
              <Stack spacing={1.25}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                  <Box minWidth={0}>
                    <Typography fontWeight={700} noWrap>{student.student.fullName}</Typography>
                    <Typography variant="caption" color="text.secondary">{student.student.code} · {student.student.phone || "Chưa có số điện thoại"}</Typography>
                  </Box>
                  <Chip size="small" color={studentStatus.color} label={studentStatus.label} />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                  Môn: {student.subjects.map((item) => subjectName.get(item.classSubjectId)).filter(Boolean).join(", ") || "-"}
                </Typography>
                {fees.length ? <>
                  {fees.slice(0, 2).map((fee) => <Stack key={fee.id} spacing={0.4} sx={{ p: 1, bgcolor: "action.hover", borderRadius: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" gap={1}><Typography variant="body2" fontWeight={700}>{fee.items.map((item) => item.itemName).join(", ") || "Học phí"}</Typography><Chip size="small" color={fee.paymentAllocations[0] ? "warning" : feeStatusColor[fee.status] ?? "default"} label={fee.paymentAllocations[0] ? "Chờ đối soát" : feeStatusLabel[fee.status] ?? fee.status} /></Stack>
                    {fee.note && <Typography variant="caption" color="text.secondary" title={fee.note} sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}><strong>Ghi chú:</strong> {fee.note}</Typography>}
                    {fee.paymentAllocations[0] && <Typography variant="caption" color="text.secondary">Đợt thu: {fee.paymentAllocations[0].paymentBatch.batchNo}</Typography>}
                  </Stack>)}
                  {fees.length > 2 && <Typography variant="caption" color="text.secondary">+{fees.length - 2} khoản phí khác, xem trong Chi tiết</Typography>}
                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 0.5 }}>
                    <Box><Typography variant="caption" color="text.secondary">Phải thu</Typography><Typography variant="body2" fontWeight={700}>{money(totalAmount)}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">Đã thu</Typography><Typography variant="body2">{money(paidAmount)}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">Còn nợ</Typography><Typography variant="body2" fontWeight={700} color={remainingAmount > 0 ? "error.main" : "success.main"}>{money(remainingAmount)}</Typography></Box>
                  </Box>
                </> : <Chip size="small" color="warning" label={pause ? "Tạm nghỉ · chưa phát sinh phí" : "Chưa tạo học phí"} sx={{ alignSelf: "flex-start" }} />}
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="outlined" onClick={() => setSelectedStudent(student)}>Chi tiết</Button>
                  <Button size="small" aria-label={`Thao tác ${student.student.fullName}`} onClick={(event) => setActionMenu({ anchorEl: event.currentTarget, student })}><MoreVertOutlinedIcon /></Button>
                </Stack>
              </Stack>
            </Paper>
          );
        })}
        {!pagedStudents.length && <Typography sx={{ p: 3, textAlign: "center" }} color="text.secondary">{totalStudents ? "Không có học viên ở trang này" : "Không có học viên phù hợp"}</Typography>}
      </Box>
      <TablePagination
        component="div"
        count={totalStudents}
        page={studentPage}
        rowsPerPage={studentPageSize}
        onPageChange={(_, nextPage) => setStudentPage(nextPage)}
        onRowsPerPageChange={(event) => {
          setStudentPageSize(Number(event.target.value));
          setStudentPage(0);
        }}
        rowsPerPageOptions={[10, 20, 50, 100]}
        SelectProps={{ inputProps: { name: "studentPageSize" } }}
        labelRowsPerPage="Số dòng/trang"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} trên ${count}`}
      />
    </Paper>
    </Stack>
    <Menu anchorEl={actionMenu?.anchorEl} open={Boolean(actionMenu)} onClose={() => setActionMenu(null)}>
      {actionMenu && <>
        <MenuItem onClick={() => { setSelectedStudent(actionMenu.student); setActionMenu(null); }}>Chi tiết học viên</MenuItem>
        <MenuItem disabled={classNotActive || actionMenu.student.status !== "ACTIVE"} onClick={() => { openSubjectDialog({ id: actionMenu.student.studentId, code: actionMenu.student.student.code, fullName: actionMenu.student.student.fullName }, actionMenu.student); setActionMenu(null); }}>Quản lý môn học</MenuItem>
        {getFees(actionMenu.student).map((fee) => {
          const pendingBatch = fee.paymentAllocations[0]?.paymentBatch;
          const canPay = !pendingBatch && ["UNPAID", "PARTIAL", "OVERDUE"].includes(fee.status);
          return <Fragment key={fee.id}>
            <Divider />
            <MenuItem onClick={() => { openFeeDrawer(fee.id); setActionMenu(null); }}>Chi tiết phí · {fee.feeNo}</MenuItem>
            {canPay && <MenuItem component={Link} href={`/admin/tuition-fees/payment?tuitionFeeId=${fee.id}`} onClick={() => setActionMenu(null)}>{fee.status === "PARTIAL" ? "Thu tiếp" : "Thu phí"} · {fee.feeNo}</MenuItem>}
            {pendingBatch && <><MenuItem component={Link} href={`/admin/tuition-fees/payment-history/${pendingBatch.id}`} onClick={() => setActionMenu(null)}>Xử lý đợt thu · {pendingBatch.batchNo}</MenuItem><MenuItem component="a" href={`/api/payment-batches/${pendingBatch.id}/notice/pdf`} onClick={() => setActionMenu(null)}>Tải thông báo · {pendingBatch.batchNo}</MenuItem></>}
          </Fragment>;
        })}
      </>}
    </Menu>
    <StudentSelectDialog open={studentPickerOpen} onClose={() => setStudentPickerOpen(false)} onSelect={(student) => { setStudentPickerOpen(false); openSubjectDialog(student); }} excludeClassId={id} title="Chọn học viên để đăng ký" />
    <Dialog open={importDialogOpen} onClose={() => !busy && setImportDialogOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>Import học viên vào lớp</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">
            Chọn file Excel đã xuất từ danh sách học viên. Hệ thống dùng cột “MÃ HỌC VIÊN” để tìm học viên hiện có và đăng ký các môn được chọn bên dưới.
          </Alert>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button variant="outlined" component="label" startIcon={<UploadFileOutlinedIcon />} disabled={busy}>
              Chọn file .xlsx
              <input
                hidden
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  event.target.value = "";
                  if (file && !file.name.toLocaleLowerCase().endsWith(".xlsx")) {
                    showError("Chỉ hỗ trợ file Excel .xlsx");
                    return;
                  }
                  setImportFile(file);
                  setImportResult(null);
                }}
              />
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {importFile?.name ?? "Chưa chọn file"}
            </Typography>
          </Stack>
          <Typography variant="subtitle2" fontWeight={700}>Môn học áp dụng cho danh sách import</Typography>
          <Stack spacing={1}>
            {classData.classSubjects
              .filter((subject) => subject.subject.status !== "INACTIVE")
              .map((subject) => {
                const checked = importSubjectIds.includes(subject.id);
                return (
                  <Button
                    key={subject.id}
                    variant={checked ? "contained" : "outlined"}
                    onClick={() => setImportSubjectIds((current) => checked ? current.filter((item) => item !== subject.id) : [...current, subject.id])}
                    sx={{ justifyContent: "space-between" }}
                    disabled={busy}
                  >
                    <span>{subject.subject.name}</span>
                    <span>{money(Number(subject.tuitionFee))}{checked ? " · Đã chọn" : ""}</span>
                  </Button>
                );
              })}
          </Stack>
          {importResult && (
            <Alert severity={importResult.errors.length ? "warning" : "success"}>
              <Typography variant="body2">Đã đăng ký {importResult.importedRows} học viên; bỏ qua {importResult.skippedRows} dòng.</Typography>
              {importResult.errors.length > 0 && (
                <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2.5 }}>
                  {importResult.errors.slice(0, 10).map((item) => <li key={String(item.rowNo) + item.message}>Dòng {item.rowNo}: {item.message}</li>)}
                  {importResult.errors.length > 10 && <li>Còn {importResult.errors.length - 10} lỗi khác.</li>}
                </Box>
              )}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={() => setImportDialogOpen(false)} disabled={busy}>Đóng</Button>
        <Button variant="contained" onClick={() => void importStudents()} disabled={busy || !importFile || !importSubjectIds.length}>{busy ? "Đang import..." : "Import vào lớp"}</Button>
      </DialogActions>
    </Dialog>
    <Dialog open={subjectDialogOpen} onClose={() => !busy && setSubjectDialogOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>{registeredSubjectIds.length ? "Quản lý môn học" : "Đăng ký học viên"}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {pendingStudent?.fullName} — Chọn các môn đang học
        </Typography>
        {registeredSubjectIds.length > 0 && (
          <Alert severity="info" sx={{ mb: 1.5 }}>
            Môn đang học được giữ nguyên trong màn hình này. Muốn bỏ môn, dùng nút “Bỏ môn” trong chi tiết học viên để hệ thống kiểm tra học phí và lý do force cancel.
          </Alert>
        )}
        <Stack spacing={1}>
          {classData.classSubjects
            .filter((subject) =>
              (subject.status === "ACTIVE" && subject.subject.status === "ACTIVE") ||
              registeredSubjectIds.includes(subject.id),
            )
            .map((subject) => {
              const checked = selectedSubjectIds.includes(subject.id);
              const registered = registeredSubjectIds.includes(subject.id);
              return (
                <Button
                  key={subject.id}
                  variant={checked ? "contained" : "outlined"}
                  color={registered ? "inherit" : "primary"}
                  disabled={registered}
                  onClick={() => setSelectedSubjectIds((current) =>
                    checked ? current.filter((item) => item !== subject.id) : [...current, subject.id],
                  )}
                  sx={{ justifyContent: "space-between" }}
                >
                  <span>{subject.subject.name}</span>
                  <span>{money(Number(subject.tuitionFee))}{registered ? " · Đang học" : ""}</span>
                </Button>
              );
            })}
        </Stack>
      </DialogContent>
      <DialogActions><Button variant="outlined" onClick={() => setSubjectDialogOpen(false)} disabled={busy}>Hủy</Button><Button variant="contained" onClick={() => void submitSubjects()} disabled={busy || !selectedSubjectIds.some((subjectId) => !registeredSubjectIds.includes(subjectId))}>{busy ? "Đang lưu..." : "Lưu môn học"}</Button></DialogActions>
    </Dialog>
    <Drawer anchor="right" open={Boolean(selectedStudent)} onClose={() => setSelectedStudent(null)}>
      {selectedStudent && <Stack spacing={2} sx={{ width: { xs: "100vw", sm: 480 }, p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start"><Stack><Typography variant="h6" fontWeight={700}>{selectedStudent.student.fullName}</Typography><Typography color="text.secondary">{selectedStudent.student.code}</Typography></Stack><Button variant="text" size="small" onClick={() => setSelectedStudent(null)}>Đóng</Button></Stack>
        <Divider />
        <Stack direction="row" spacing={1}><Button variant="outlined" disabled={classNotActive || selectedStudent.status !== "ACTIVE"} onClick={() => { setEditingPauseId(null); setPauseStart(month); setPauseEnd(month); setPauseReason(""); setPauseTarget(selectedStudent); }}>Tạm nghỉ</Button><Button color="error" variant="outlined" disabled={classNotActive || selectedStudent.status !== "ACTIVE"} onClick={() => { setDeleteReason(""); setDeleteTarget(selectedStudent); }}>Rời lớp</Button></Stack>
        <Typography variant="subtitle1" fontWeight={700}>Môn đăng ký</Typography>
        {selectedStudent.subjects.map((item) => <Paper key={item.classSubjectId} variant="outlined" sx={{ p: 1.5 }}><Stack direction="row" justifyContent="space-between" alignItems="center"><Stack><Typography fontWeight={600}>{subjectName.get(item.classSubjectId)}</Typography><Typography variant="caption" color="text.secondary">{money(Number(classData.classSubjects.find((subject) => subject.id === item.classSubjectId)?.tuitionFee ?? 0))}/tháng</Typography></Stack><Button size="small" variant="outlined" color="error" disabled={classNotActive || selectedStudent.status !== "ACTIVE"} onClick={() => selectedStudent.subjects.length === 1 ? (setDeleteReason(""), setDeleteTarget(selectedStudent)) : setDropTarget({ student: selectedStudent, subjectId: item.classSubjectId, hasFee: selectedStudent.tuitionFees.some((fee) => fee.items.some((feeItem) => feeItem.classSubjectId === item.classSubjectId)) })}>{selectedStudent.subjects.length === 1 ? "Rời lớp" : "Bỏ môn"}</Button></Stack></Paper>)}
        <Button variant="contained" disabled={classNotActive || selectedStudent.status !== "ACTIVE"} onClick={() => openSubjectDialog({ id: selectedStudent.studentId, code: selectedStudent.student.code, fullName: selectedStudent.student.fullName }, selectedStudent)}>Thêm môn</Button>
        <Typography variant="subtitle1" fontWeight={700}>Lịch sử tạm nghỉ</Typography>
        {selectedStudent.pauses.length ? selectedStudent.pauses.map((pause) => <Paper key={pause.id} variant="outlined" sx={{ p: 1.5, opacity: pause.status === "CANCELLED" ? 0.65 : 1 }}><Stack direction="row" justifyContent="space-between" gap={1}><Stack><Typography fontWeight={600}>{monthValue(pause.startMonth)} → {monthValue(pause.endMonth)} {pause.status === "CANCELLED" ? "· Đã hủy" : ""}</Typography><Typography variant="caption" color="text.secondary">{pause.reason || "Không có lý do"}</Typography></Stack>{pause.status === "ACTIVE" && <Stack direction="row"><Button size="small" disabled={classNotActive} onClick={() => { setEditingPauseId(pause.id); setPauseStart(monthValue(pause.startMonth)); setPauseEnd(monthValue(pause.endMonth)); setPauseReason(pause.reason || ""); setPauseTarget(selectedStudent); }}>Sửa</Button><Button size="small" color="error" disabled={busy || classNotActive} onClick={() => setPauseCancelTarget({ student: selectedStudent, pauseId: pause.id })}>Hủy</Button></Stack>}</Stack></Paper>) : <Typography variant="body2" color="text.secondary">Chưa có thời gian tạm nghỉ.</Typography>}
        <Divider />
        <Typography variant="subtitle1" fontWeight={700}>Học phí {month}</Typography>
        {getPause(selectedStudent) ? (
          <Chip color="info" label="Không phát sinh trong kỳ tạm nghỉ" />
        ) : selectedFee ? (
          <Stack spacing={1}>
            <Typography variant="h5">{money(Number(selectedFee.finalAmount))}</Typography>
            <Typography variant="body2" color="text.secondary">
              Đã thu: {money(Number(selectedFee.paidAmount))} · Còn nợ: {money(Number(selectedFee.remainingAmount))}
            </Typography>
            <Chip
              size="small"
              sx={{ alignSelf: "flex-start" }}
              color={feeStatusColor[selectedFee.status] ?? "default"}
              label={feeStatusLabel[selectedFee.status] ?? selectedFee.status}
            />
            {(selectedFee.payments.length > 0 || selectedFee.paymentAllocations.length > 0) && (
              <Stack spacing={1} sx={{ pt: 0.75 }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Thông tin thanh toán và đối soát
                </Typography>
                {selectedFee.payments.map((payment, index) => {
                  const rows = payment.paymentBatch?.statementRowLinks ?? [];
                  const allConfirmed = rows.length > 0 && rows.every((link) => link.isConfirmed);
                  const paymentContent = payment.paymentContent || payment.paymentBatch?.paymentContent;
                  const transactionNo = payment.bankTransactionNo || payment.paymentBatch?.bankTransactionNo || payment.transactionReference || payment.paymentBatch?.transactionReference;
                  return (
                    <Paper key={`${index}-${payment.amount}`} variant="outlined" sx={{ p: 1.5 }}>
                      <Stack spacing={0.5}>
                        <Typography variant="body2" fontWeight={700}>
                          {money(Number(payment.amount))} · {payment.paymentMethod === "CASH" ? "Tiền mặt" : payment.paymentMethod === "BANK_TRANSFER" ? "Chuyển khoản" : payment.paymentMethod}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Thời gian: {paymentDateValue(payment.paymentDate)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                          Nội dung thanh toán: {paymentContent || "-"}
                        </Typography>
                        {payment.paymentMethod !== "CASH" && (
                          <>
                            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                              Mã giao dịch: {transactionNo || "-"}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Đối soát: {rows.length === 0 ? "Chưa gắn sao kê" : allConfirmed ? "Đã xác nhận" : "Đang chờ xác nhận"}
                            </Typography>
                            {rows.map((link, rowIndex) => (
                              <Typography key={`${rowIndex}-${link.row.bankTransactionNo}`} variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                                Sao kê: {link.row.reconciliationContent || link.row.description}
                              </Typography>
                            ))}
                          </>
                        )}
                      </Stack>
                    </Paper>
                  );
                })}
                {selectedFee.paymentAllocations.map(({ paymentBatch }) => {
                  const rows = paymentBatch.statementRowLinks;
                  const allConfirmed = rows.length > 0 && rows.every((link) => link.isConfirmed);
                  return (
                    <Paper key={paymentBatch.id} variant="outlined" sx={{ p: 1.5 }}>
                      <Stack spacing={0.5}>
                        <Typography variant="body2" fontWeight={700}>
                          Đợt thu {paymentBatch.batchNo} · Đang chờ thanh toán
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                          Nội dung thanh toán: {paymentBatch.paymentContent || "-"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                          Mã giao dịch: {paymentBatch.bankTransactionNo || paymentBatch.transactionReference || "-"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Đối soát: {rows.length === 0 ? "Chưa có giao dịch ngân hàng khớp" : allConfirmed ? "Đã xác nhận" : "Đang chờ xác nhận"}
                        </Typography>
                        {rows.map((link, rowIndex) => (
                          <Typography key={`${rowIndex}-${link.row.bankTransactionNo}`} variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                            Sao kê: {link.row.reconciliationContent || link.row.description}
                          </Typography>
                        ))}
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            )}
            <Button variant="outlined" startIcon={<PaymentsOutlinedIcon />} onClick={() => { setSelectedStudent(null); openFeeDrawer(selectedFee.id); }}>
              Chi tiết và xử lý học phí
            </Button>
          </Stack>
        ) : (
          <Stack spacing={0.5}>
            <Typography variant="h5">{money(selectedExpectedAmount)}</Typography>
            <Typography variant="body2" color="text.secondary">Dự kiến theo các môn đang đăng ký; chưa tạo khoản học phí.</Typography>
          </Stack>
        )}
        <Typography variant="body2" color="text.secondary">Đăng ký học viên và tạo học phí là hai thao tác độc lập.</Typography>
      </Stack>}
    </Drawer>
    <Dialog open={createFeesConfirmOpen} onClose={() => !busy && setCreateFeesConfirmOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>Tạo học phí tháng {month}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          <Alert severity="info">
            Trong kỳ này có {activeCount} học viên đang học, {pausedCount} học viên tạm nghỉ và {uncreatedCount} học viên chưa có học phí đủ môn. Đây là số liệu hiện tại; máy chủ sẽ kiểm tra lại điều kiện của từng học viên khi tạo.
          </Alert>
          <Typography>
            Hệ thống xử lý toàn bộ học viên đủ điều kiện trong lớp, không chỉ học viên đang hiển thị hoặc khớp bộ lọc. Khoản phí đã có đủ môn sẽ được bỏ qua; môn mới chưa tính phí có thể được bổ sung nếu khoản phí chưa có thanh toán hoặc batch chờ.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={() => setCreateFeesConfirmOpen(false)} disabled={busy}>Đóng</Button>
        <Button variant="contained" onClick={() => void createFees()} disabled={busy}>{busy ? "Đang tạo..." : "Xác nhận tạo phí"}</Button>
      </DialogActions>
    </Dialog>
    {selectedFeeId && <TuitionDetail
      id={selectedFeeId}
      mode="drawer"
      onClose={closeFeeDrawer}
      onUpdated={() => {
        void load();
      }}
    />}
    <Dialog open={Boolean(pauseTarget)} onClose={() => !busy && (setPauseTarget(null), setEditingPauseId(null))} fullWidth maxWidth="sm"><DialogTitle>{editingPauseId ? "Sửa thời gian tạm nghỉ" : "Tạm nghỉ học"}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><Typography>{pauseTarget?.student.fullName}</Typography><Stack direction={{ xs: "column", sm: "row" }} spacing={1}><MonthPickerField label="Từ tháng" value={pauseStart} onChange={setPauseStart} /><MonthPickerField label="Đến tháng" value={pauseEnd} onChange={setPauseEnd} /></Stack><AppTextField fullWidth label="Lý do" multiline minRows={2} value={pauseReason} onChange={(event) => setPauseReason(event.target.value)} /></Stack></DialogContent><DialogActions><Button variant="outlined" onClick={() => { setPauseTarget(null); setEditingPauseId(null); }} disabled={busy}>Hủy</Button><Button variant="contained" onClick={() => void pauseStudent()} disabled={busy}>{editingPauseId ? "Lưu thay đổi" : "Xác nhận tạm nghỉ"}</Button></DialogActions></Dialog>
    <Dialog open={Boolean(dropTarget)} onClose={() => !busy && setDropTarget(null)} fullWidth maxWidth="sm">
      <DialogTitle>{dropTarget?.hasFee ? "Force cancel môn học" : "Bỏ môn học"}</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 1 }}>
          Bỏ môn {subjectName.get(dropTarget?.subjectId ?? "") ?? "này"} của {dropTarget?.student.student.fullName ?? "học viên"}?
        </Typography>
        {dropTarget?.hasFee && <>
          <Typography variant="body2" color="warning.main" sx={{ mb: 1 }}>
            Học phí đã phát sinh sẽ được giữ nguyên cho kỳ hiện tại; các kỳ sau không tạo thêm phí môn này.
          </Typography>
          <AppTextField fullWidth required label="Lý do force cancel" value={dropReason} onChange={(event) => setDropReason(event.target.value)} multiline minRows={2} inputProps={{ maxLength: 500 }} />
        </>}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={() => setDropTarget(null)} disabled={busy}>Hủy</Button>
        <Button variant="contained" color="error" onClick={() => void dropSubject()} disabled={busy || Boolean(dropTarget?.hasFee && !dropReason.trim())}>{busy ? "Đang xử lý..." : dropTarget?.hasFee ? "Force cancel" : "Bỏ môn"}</Button>
      </DialogActions>
    </Dialog>
    <Dialog open={Boolean(deleteTarget)} onClose={() => !busy && setDeleteTarget(null)} fullWidth maxWidth="sm">
      <DialogTitle>{deleteTarget?.tuitionFees.length ? "Force rời lớp" : "Rời lớp"}</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 1 }}>
          {deleteTarget?.student.fullName ?? "Học viên này"} sẽ rời khỏi lớp và các môn đang đăng ký sẽ được đánh dấu đã bỏ.
        </Typography>
        {deleteTarget?.tuitionFees.length ? <>
          <Typography variant="body2" color="warning.main" sx={{ mb: 1 }}>
            Học phí đã phát sinh sẽ được giữ nguyên để bảo toàn lịch sử. Thao tác force cần lý do.
          </Typography>
          <AppTextField fullWidth required label="Lý do force rời lớp" value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} multiline minRows={2} inputProps={{ maxLength: 500 }} />
        </> : null}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={() => setDeleteTarget(null)} disabled={busy}>Hủy</Button>
        <Button variant="contained" color="error" onClick={() => void deleteStudent()} disabled={busy || Boolean(deleteTarget?.tuitionFees.length && !deleteReason.trim())}>{busy ? "Đang xử lý..." : deleteTarget?.tuitionFees.length ? "Force rời lớp" : "Rời lớp"}</Button>
      </DialogActions>
    </Dialog>
    <ConfirmDialog
      open={Boolean(pauseCancelTarget)}
      title="Hủy thời gian tạm nghỉ"
      message="Sau khi hủy, học viên có thể phát sinh học phí trong khoảng tháng này. Bạn có chắc chắn muốn tiếp tục?"
      confirmLabel="Hủy thời gian nghỉ"
      isLoading={busy}
      onCancel={() => setPauseCancelTarget(null)}
      onConfirm={() => {
        if (pauseCancelTarget) {
          void cancelPause(pauseCancelTarget.student, pauseCancelTarget.pauseId);
        }
      }}
    />
    {Snackbar}
  </Stack>;
}
