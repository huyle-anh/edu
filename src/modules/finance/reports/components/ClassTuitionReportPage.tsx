"use client";

import { useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import RestartAltOutlinedIcon from "@mui/icons-material/RestartAltOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import { ClassSelectDialog, type ClassItem } from "@/components/shared/dialogs/ClassSelectDialog";
import { DatePickerField } from "@/components/shared/forms/DatePickerField";
import { MasterSelectField, type MasterSelectValue } from "@/components/shared/forms/MasterSelectField";
import { MonthPickerField } from "@/components/shared/forms/MonthPickerField";
import { PageHeader } from "@/components/shared/PageHeader";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { getVietnamDate, getVietnamMonth } from "@/lib/vietnam-time";
import { DailyPaymentReportCard } from "@/modules/finance/reports/components/DailyPaymentReportCard";
import { BankReconciliationReportCard } from "@/modules/finance/reports/components/BankReconciliationReportCard";

type ClassSubject = {
  id: string;
  subject: { id: string; name: string };
  teacher: { id: string; code: string; fullName: string } | null;
};

type ClassDetail = {
  classSubjects: ClassSubject[];
};

type ReportKey = "CLASS_TUITION" | "DAILY_PAYMENT" | "BANK_RECONCILIATION";

const reportDefinitions: Array<{
  key: ReportKey;
  title: string;
  description: string;
  icon: ReactNode;
}> = [
  {
    key: "CLASS_TUITION",
    title: "Thu học phí theo lớp",
    description: "Đã thu theo lớp, môn học và kỳ.",
    icon: <AssessmentOutlinedIcon fontSize="small" />,
  },
  {
    key: "DAILY_PAYMENT",
    title: "Thu học phí theo ngày",
    description: "Các khoản thanh toán thành công theo ngày nhận tiền.",
    icon: <CalendarMonthOutlinedIcon fontSize="small" />,
  },
  {
    key: "BANK_RECONCILIATION",
    title: "Đối soát ngân hàng",
    description: "Giao dịch sao kê theo tài khoản và khoảng ngày.",
    icon: <AccountBalanceOutlinedIcon fontSize="small" />,
  },
];

function currentMonth() {
  return getVietnamMonth();
}

export function ClassTuitionReportPage() {
  const [activeReport, setActiveReport] = useState<ReportKey>("CLASS_TUITION");
  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [subjects, setSubjects] = useState<ClassSubject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [month, setMonth] = useState(currentMonth);
  const [fromDate, setFromDate] = useState(() => `${currentMonth()}-01`);
  const [toDate, setToDate] = useState(getVietnamDate);
  const [loadingClass, setLoadingClass] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId) ?? null;
  const teacher: MasterSelectValue | null = selectedSubject?.teacher
    ? {
        id: selectedSubject.teacher.id,
        code: selectedSubject.teacher.code,
        name: selectedSubject.teacher.fullName,
      }
    : null;

  async function handleClassSelect(classItem: ClassItem) {
    setClassDialogOpen(false);
    setSelectedClass(classItem);
    setSelectedSubjectId("");
    setSubjects([]);
    setError("");
    setLoadingClass(true);
    try {
      const response = await fetch(`/api/classes/${classItem.id}`);
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tải môn học của lớp"));
      const detail = await unwrapApiResponse<ClassDetail>(response);
      setSubjects(detail.classSubjects);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải môn học của lớp");
    } finally {
      setLoadingClass(false);
    }
  }

  async function handleExport() {
    if (!selectedClass || !selectedSubjectId || !month || !fromDate || !toDate || fromDate > toDate) return;
    setExporting(true);
    setError("");
    try {
      const params = new URLSearchParams({
        classId: selectedClass.id,
        classSubjectId: selectedSubjectId,
        month,
        fromDate,
        toDate,
      });
      const response = await fetch(`/api/reports/class-tuition/export?${params.toString()}`);
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể xuất báo cáo Excel"));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `bao-cao-thu-hoc-phi-${selectedClass.code}-${month}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xuất báo cáo Excel");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Stack spacing={{ xs: 2, md: 3 }}>
      <PageHeader
        title="Báo cáo"
        description="Chọn báo cáo, điền điều kiện cần thiết rồi xuất dữ liệu."
      />

      <Box component="section" aria-label="Chọn loại báo cáo">
        <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1.25 }}>
          <Typography variant="subtitle1" fontWeight={700}>Loại báo cáo</Typography>
          <Typography variant="caption" color="text.secondary">{reportDefinitions.length} loại</Typography>
        </Stack>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" }, gap: 1.5 }}>
          {reportDefinitions.map((report) => {
            const selected = activeReport === report.key;
            return (
              <Button
                key={report.key}
                variant="outlined"
                aria-pressed={selected}
                onClick={() => {
                  setActiveReport(report.key);
                  setError("");
                }}
                sx={{
                  minHeight: 92,
                  p: 1.5,
                  justifyContent: "flex-start",
                  textAlign: "left",
                  alignItems: "stretch",
                  borderColor: selected ? "primary.main" : "divider",
                  bgcolor: selected ? "primary.light" : "background.paper",
                  color: selected ? "primary.dark" : "text.primary",
                  "&:hover": {
                    borderColor: "primary.main",
                    bgcolor: selected ? "primary.light" : "action.hover",
                  },
                }}
              >
                <Stack direction="row" spacing={1.25} alignItems="center" sx={{ width: "100%" }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: 1.5, display: "grid", placeItems: "center", flexShrink: 0, bgcolor: "background.paper", color: "primary.main" }}>
                    {report.icon}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" fontWeight={700}>{report.title}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>{report.description}</Typography>
                  </Box>
                  {selected && <CheckCircleOutlineOutlinedIcon fontSize="small" color="primary" />}
                </Stack>
              </Button>
            );
          })}
        </Box>
      </Box>

      {activeReport === "DAILY_PAYMENT" && <DailyPaymentReportCard />}
      {activeReport === "BANK_RECONCILIATION" && <BankReconciliationReportCard />}

      {error && <Alert severity="error">{error}</Alert>}

      {activeReport === "CLASS_TUITION" && <Paper sx={{ p: { xs: 2, md: 2.5 }, overflow: "hidden" }}>
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1.25} alignItems="flex-start">
            <Box sx={{ width: 36, height: 36, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: "primary.light", color: "primary.dark", flexShrink: 0 }}>
            <AssessmentOutlinedIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={800}>Điều kiện báo cáo</Typography>
              <Typography variant="body2" color="text.secondary">Chọn kỳ học phí và khoảng ngày nhận tiền để đối chiếu phải thu, đã thu và còn nợ.</Typography>
            </Box>
          </Stack>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
            <MasterSelectField
              label="Lớp học"
              value={selectedClass ? { id: selectedClass.id, code: selectedClass.code, name: selectedClass.name } : null}
              onOpen={() => setClassDialogOpen(true)}
              size="small"
              required
            />
            <FormControl fullWidth disabled={!selectedClass || loadingClass}>
              <InputLabel id="report-subject-label">Môn học</InputLabel>
              <Select
                labelId="report-subject-label"
                label="Môn học"
                value={selectedSubjectId}
                onChange={(event) => setSelectedSubjectId(event.target.value)}
              >
                <MenuItem value=""><em>{loadingClass ? "Đang tải môn học..." : "Chọn môn học"}</em></MenuItem>
                {subjects.map((subject) => (
                  <MenuItem key={subject.id} value={subject.id} disabled={!subject.teacher}>
                    {subject.subject.name}{subject.teacher ? "" : " · Chưa phân công giáo viên"}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <MasterSelectField label="Giáo viên phụ trách" value={teacher} onOpen={() => undefined} size="small" disabled />
            <MonthPickerField
              label="Kỳ học phí"
              value={month}
              onChange={(value) => {
                setMonth(value);
                if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
                  const [year, monthNumber] = value.split("-").map(Number);
                  const lastDay = new Date(Date.UTC(year!, monthNumber!, 0)).getUTCDate();
                  setFromDate(`${value}-01`);
                  setToDate(`${value}-${String(lastDay).padStart(2, "0")}`);
                }
              }}
              textFieldProps={{ required: true, size: "small" }}
            />
            <DatePickerField label="Ngày thu từ" value={fromDate} onChange={setFromDate} textFieldProps={{ required: true, size: "small" }} />
            <DatePickerField label="Đến ngày" value={toDate} onChange={setToDate} textFieldProps={{ required: true, size: "small" }} />
          </Box>

          <Alert severity="info" icon={<CalendarMonthOutlinedIcon />} sx={{ alignItems: "flex-start" }}>
            Báo cáo phân biệt tiền thu trong khoảng ngày chọn với dư nợ học phí của kỳ, kèm trạng thái học viên và học phí. Học viên đã rời lớp vẫn được đối chiếu theo khoản phí đã phát sinh; khoản được miễn hoặc đã hủy hiển thị trạng thái nhưng không cộng vào phải thu.
          </Alert>

          <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: "action.hover", border: "1px solid", borderColor: "divider" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>Phạm vi đang chọn</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }, gap: 1.5, mt: 1.25 }}>
              <ReportScopeItem icon={<MenuBookOutlinedIcon fontSize="small" />} label="Lớp học" value={selectedClass?.name || "Chưa chọn lớp"} />
              <ReportScopeItem icon={<AssessmentOutlinedIcon fontSize="small" />} label="Môn học" value={selectedSubject?.subject.name || "Chưa chọn môn"} />
              <ReportScopeItem icon={<PersonOutlineOutlinedIcon fontSize="small" />} label="Giáo viên" value={teacher?.name || "Chưa phân công"} />
              <ReportScopeItem icon={<CalendarMonthOutlinedIcon fontSize="small" />} label="Kỳ học phí" value={month || "Chưa chọn kỳ"} />
            </Box>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1.5}>
            <Typography variant="body2" color="text.secondary">File Excel gồm danh sách học viên, trạng thái học viên, trạng thái học phí và số tiền theo môn.</Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button variant="outlined" color="inherit" startIcon={<RestartAltOutlinedIcon />} onClick={() => { const defaultMonth = currentMonth(); const today = getVietnamDate(); setSelectedClass(null); setSubjects([]); setSelectedSubjectId(""); setMonth(defaultMonth); setFromDate(`${defaultMonth}-01`); setToDate(today); setError(""); }} disabled={exporting || (!selectedClass && !selectedSubjectId && month === currentMonth() && fromDate === `${currentMonth()}-01` && toDate === getVietnamDate())} sx={{ whiteSpace: "nowrap" }}>
                Đặt lại
              </Button>
              <Button variant="contained" startIcon={<DownloadOutlinedIcon />} onClick={() => void handleExport()} disabled={exporting || !selectedClass || !selectedSubjectId || !selectedSubject?.teacher || !month || !fromDate || !toDate || fromDate > toDate}>
                {exporting ? "Đang xuất..." : "Xuất báo cáo Excel"}
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Paper>}

      <ClassSelectDialog open={classDialogOpen} onClose={() => setClassDialogOpen(false)} onSelect={(classItem) => void handleClassSelect(classItem)} reportableOnly />
    </Stack>
  );
}

function ReportScopeItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Stack direction="row" spacing={1} alignItems="flex-start" minWidth={0}>
      <Box sx={{ width: 30, height: 30, flexShrink: 0, borderRadius: 1.25, display: "grid", placeItems: "center", bgcolor: "background.paper", color: "primary.main", border: "1px solid", borderColor: "divider" }}>{icon}</Box>
      <Box minWidth={0}>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{label}</Typography>
        <Typography variant="body2" fontWeight={700} noWrap title={value}>{value}</Typography>
      </Box>
    </Stack>
  );
}
