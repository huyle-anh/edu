"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Chip, Drawer, IconButton, Paper, Stack, Typography } from "@mui/material";
import ArrowBackIosNewOutlinedIcon from "@mui/icons-material/ArrowBackIosNewOutlined";
import ArrowForwardIosOutlinedIcon from "@mui/icons-material/ArrowForwardIosOutlined";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingState } from "@/components/shared/feedback/LoadingState";
import { MasterSelectField, type MasterSelectValue } from "@/components/shared/forms/MasterSelectField";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { AttendanceRecordList, type AttendanceRow } from "@/modules/attendance/components/AttendanceRecordList";
import { AttendanceClassSelectDialog, type AttendanceClassOption } from "@/modules/attendance/components/AttendanceClassSelectDialog";

type SessionSummary = { id: string; sessionAt: string; updatedAt: string; studentCount: number };
type AttendanceSession = { id: string; sessionAt: string; updatedAt: string; class: { id: string; code: string; name: string; subjectName: string; teacherName: string }; records: AttendanceRow[]; audits: { id: string; action: string; performedAt: string; actor: { fullName: string } }[] };
type PageResult<T> = { items: T[]; pagination: { page: number; pageSize: number; totalPages: number } };
const weekdays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function vietnamDateKey(value: Date | string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const get = (name: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === name)?.value ?? "";
  return get("year") + "-" + get("month") + "-" + get("day");
}
function formatSessionTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(Date.UTC(year, month, 1, 12)));
}
function currentVietnamMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  return { year, month: month - 1 };
}

export function AttendanceCalendarPage() {
  const [classes, setClasses] = useState<AttendanceClassOption[]>([]);
  const [classId, setClassId] = useState("");
  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [shownMonth, setShownMonth] = useState(currentVietnamMonth);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const monthRequestId = useRef(0);

  const loadClasses = useCallback(async () => {
    setLoadingClasses(true);
    try {
      const response = await fetch("/api/attendance?page=1&pageSize=100");
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không tải được danh sách lớp"));
      const first = await unwrapApiResponse<PageResult<AttendanceClassOption>>(response);
      const rest = await Promise.all(Array.from({ length: Math.max(0, first.pagination.totalPages - 1) }, async (_, index) => {
        const next = await fetch("/api/attendance?page=" + (index + 2) + "&pageSize=100");
        if (!next.ok) throw new Error(await extractApiErrorMessage(next, "Không tải được danh sách lớp"));
        return unwrapApiResponse<PageResult<AttendanceClassOption>>(next);
      }));
      const items = [...first.items, ...rest.flatMap((page) => page.items)];
      setClasses(items);
      const firstClass = items[0];
      if (firstClass) setClassId((current) => current || firstClass.classId);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không tải được danh sách lớp"); }
    finally { setLoadingClasses(false); }
  }, []);
  useEffect(() => { void loadClasses(); }, [loadClasses]);

  const selectedClass = classes.find((item) => item.classId === classId);
  const selectedClassValue: MasterSelectValue | null = selectedClass
    ? { id: selectedClass.classId, code: selectedClass.classCode, name: selectedClass.className }
    : null;

  const loadMonthSessions = useCallback(async () => {
    const requestId = ++monthRequestId.current;
    if (!classId) { setSessions([]); setLoadingSessions(false); return; }
    setLoadingSessions(true); setError("");
    try {
      const start = shownMonth.year + "-" + String(shownMonth.month + 1).padStart(2, "0") + "-01";
      const lastDay = new Date(shownMonth.year, shownMonth.month + 1, 0).getDate();
      const end = shownMonth.year + "-" + String(shownMonth.month + 1).padStart(2, "0") + "-" + String(lastDay).padStart(2, "0");
      const query = "classId=" + classId + "&fromDate=" + start + "&toDate=" + end + "&pageSize=100";
      const response = await fetch("/api/attendance?" + query + "&page=1");
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không tải được lịch sử điểm danh"));
      const first = await unwrapApiResponse<PageResult<SessionSummary>>(response);
      const rest = await Promise.all(Array.from({ length: Math.max(0, first.pagination.totalPages - 1) }, async (_, index) => {
        const next = await fetch("/api/attendance?" + query + "&page=" + (index + 2));
        if (!next.ok) throw new Error(await extractApiErrorMessage(next, "Không tải được lịch sử điểm danh"));
        return unwrapApiResponse<PageResult<SessionSummary>>(next);
      }));
      const all = [...first.items, ...rest.flatMap((page) => page.items)];
      if (requestId === monthRequestId.current) setSessions(all);
    } catch (reason) {
      if (requestId === monthRequestId.current) { setError(reason instanceof Error ? reason.message : "Không tải được lịch sử điểm danh"); setSessions([]); }
    } finally { if (requestId === monthRequestId.current) setLoadingSessions(false); }
  }, [classId, shownMonth]);
  useEffect(() => { void loadMonthSessions(); }, [loadMonthSessions]);

  const days = useMemo(() => {
    const offset = (new Date(Date.UTC(shownMonth.year, shownMonth.month, 1)).getUTCDay() + 6) % 7;
    const monthLength = new Date(Date.UTC(shownMonth.year, shownMonth.month + 1, 0)).getUTCDate();
    const total = Math.ceil((offset + monthLength) / 7) * 7;
    return Array.from({ length: total }, (_, index) => {
      const day = index - offset + 1;
      return day < 1 || day > monthLength ? null : shownMonth.year + "-" + String(shownMonth.month + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
    });
  }, [shownMonth]);
  const sessionsByDate = useMemo(() => {
    const grouped = new Map<string, SessionSummary[]>();
    sessions.forEach((item) => { const key = vietnamDateKey(item.sessionAt); grouped.set(key, [...(grouped.get(key) ?? []), item]); });
    return grouped;
  }, [sessions]);
  const selectedDaySessions = sessionsByDate.get(selectedDate) ?? [];
  const today = vietnamDateKey(new Date());
  const presentCount = session?.records.filter((record) => record.status === "PRESENT").length ?? 0;
  const absentCount = session ? session.records.length - presentCount : 0;

  const openSession = async (id: string) => {
    setSession(null); setLoadingDetail(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/attendance?sessionId=" + id);
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không tải được phiên điểm danh"));
      setSession(await unwrapApiResponse<AttendanceSession>(response));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không tải được phiên điểm danh"); }
    finally { setLoadingDetail(false); }
  };
  const changeRecord = (enrollmentId: string, changes: Partial<Pick<AttendanceRow, "status" | "note">>) => {
    setSession((current) => current ? { ...current, records: current.records.map((row) => row.enrollmentId === enrollmentId ? { ...row, ...changes } : row) } : current);
  };
  const save = async () => {
    if (!session) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/attendance", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: session.id, records: session.records.map(({ enrollmentId, status, note }) => ({ enrollmentId, status, note })) }) });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể cập nhật điểm danh"));
      await openSession(session.id);
      await loadMonthSessions();
      setMessage("Đã cập nhật điểm danh");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể cập nhật điểm danh"); }
    finally { setSaving(false); }
  };
  const moveMonth = (delta: number) => setShownMonth((current) => { const next = new Date(Date.UTC(current.year, current.month + delta, 1)); return { year: next.getUTCFullYear(), month: next.getUTCMonth() }; });

  return <Stack spacing={2.5}>
    <PageHeader title="Lịch điểm danh" description="Chọn ngày để xem hoặc chỉnh sửa các phiên đã lưu." />
    <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderColor: "divider", bgcolor: "background.paper" }}>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
      <Button component={Link} href="/teacher/attendance" variant="outlined" startIcon={<ArrowBackOutlinedIcon />} sx={{ minHeight: 44, alignSelf: { xs: "flex-start", sm: "auto" } }}>Quay lại điểm danh</Button>
      <MasterSelectField
        label="Lớp"
        value={selectedClassValue}
        onOpen={() => setClassDialogOpen(true)}
        disabled={loadingClasses || classes.length === 0}
        codeLabel="Mã lớp"
        nameLabel="Tên lớp"
        sx={{ flex: 1, minWidth: 0, maxWidth: { sm: 440 } }}
      />
    </Stack>
    </Paper>
    <AttendanceClassSelectDialog
      open={classDialogOpen}
      options={classes}
      onClose={() => setClassDialogOpen(false)}
      onSelect={(item) => {
        setClassId(item.classId);
        setSelectedDate("");
        setSession(null);
      }}
    />
    {error && <Alert severity="error">{error}</Alert>}
    {message && !selectedDate && <Alert severity="success" onClose={() => setMessage("")}>{message}</Alert>}
    <Paper sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2, px: { xs: 0, sm: 0.5 } }}>
        <IconButton aria-label="Tháng trước" onClick={() => moveMonth(-1)} sx={{ border: 1, borderColor: "divider", borderRadius: 2 }}><ArrowBackIosNewOutlinedIcon fontSize="small" /></IconButton>
        <Stack alignItems="center" spacing={0.25}>
          <Typography variant="h6" textTransform="capitalize" fontWeight={700}>{monthLabel(shownMonth.year, shownMonth.month)}</Typography>
          {shownMonth.year + "-" + String(shownMonth.month + 1).padStart(2, "0") === today.slice(0, 7) && <Typography variant="caption" color="text.secondary">Tháng hiện tại</Typography>}
        </Stack>
        <IconButton aria-label="Tháng sau" onClick={() => moveMonth(1)} sx={{ border: 1, borderColor: "divider", borderRadius: 2 }}><ArrowForwardIosOutlinedIcon fontSize="small" /></IconButton>
      </Stack>
      {loadingSessions && <LoadingState label="Đang tải lịch điểm danh..." minHeight={120} />}
      {!loadingSessions && <Box role="grid" aria-label={"Lịch điểm danh " + monthLabel(shownMonth.year, shownMonth.month)} sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: { xs: 0.25, sm: 0.75 } }}>
        {weekdays.map((day) => <Typography key={day} role="columnheader" variant="caption" fontWeight={700} color="text.secondary" textAlign="center" sx={{ py: 1 }}>{day}</Typography>)}
        {days.map((date, index) => {
          if (!date) return <Box key={"blank-" + index} aria-hidden="true" sx={{ minHeight: { xs: 48, sm: 72 } }} />;
          const daySessions = sessionsByDate.get(date) ?? [];
          const day = Number(date.slice(-2));
          const isSelected = selectedDate === date;
          const hasSessions = daySessions.length > 0;
          const isToday = date === today;
          return <Button key={date} role="gridcell" aria-label={day + "/" + (shownMonth.month + 1) + "/" + shownMonth.year + (hasSessions ? ", " + daySessions.length + " phiên điểm danh" : ", không có điểm danh") + (isToday ? ", hôm nay" : "")} aria-selected={isSelected} onClick={() => { setSelectedDate(date); setSession(null); setMessage(""); }} variant="text" sx={{ minWidth: 0, minHeight: { xs: 56, sm: 78 }, p: 0.5, borderRadius: 2, border: "1px solid", borderColor: isSelected ? "primary.main" : hasSessions ? "info.light" : "divider", bgcolor: isSelected ? "primary.main" : hasSessions ? "info.50" : "background.paper", color: isSelected ? "primary.contrastText" : "text.primary", display: "flex", flexDirection: "column", justifyContent: "center", gap: 0.35, transition: "background-color 120ms ease, border-color 120ms ease", "&:hover": { bgcolor: isSelected ? "primary.dark" : hasSessions ? "info.100" : "action.hover", borderColor: isSelected ? "primary.dark" : hasSessions ? "info.main" : "text.disabled" }, ...(isToday && !isSelected ? { boxShadow: "inset 0 0 0 1px", "& .MuiTypography-root:first-of-type": { color: "primary.main" } } : {}) }}>
            <Typography component="span" variant="body2" fontWeight={isSelected || isToday ? 700 : 500}>{day}</Typography>
            {hasSessions && <Stack direction="row" spacing={0.4} alignItems="center"><Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: isSelected ? "common.white" : "info.main" }} /><Typography component="span" variant="caption" sx={{ fontSize: { xs: 9, sm: 11 }, lineHeight: 1.2, fontWeight: 700 }}>{daySessions.length} phiên</Typography></Stack>}
          </Button>;
        })}
      </Box>}
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 1.75, pt: 1.5, borderTop: 1, borderColor: "divider" }}>
        <Stack direction="row" spacing={0.75} alignItems="center"><Box sx={{ width: 12, height: 12, borderRadius: 0.75, bgcolor: "info.50", border: 1, borderColor: "info.light" }} /><Typography variant="caption" color="text.secondary">Đã có phiên điểm danh</Typography></Stack>
        <Stack direction="row" spacing={0.75} alignItems="center"><Box sx={{ width: 12, height: 12, borderRadius: 0.75, bgcolor: "primary.main" }} /><Typography variant="caption" color="text.secondary">Ngày đang chọn</Typography></Stack>
        <Typography variant="caption" color="text.secondary">Chọn ngày để xem các phiên đã lưu</Typography>
      </Stack>
      {!loadingSessions && classId && sessions.length === 0 && <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 2 }}>Tháng này chưa có phiên điểm danh.</Typography>}
    </Paper>
    <Drawer anchor="right" open={Boolean(selectedDate)} onClose={() => { setSelectedDate(""); setSession(null); }} PaperProps={{ sx: { width: { xs: "100%", sm: "min(900px, 92vw)" }, height: "100dvh", borderRadius: { xs: 0, sm: "16px 0 0 16px" }, pb: "env(safe-area-inset-bottom)", display: "flex", flexDirection: "column" } }}>
      <Box sx={{ px: { xs: 2, sm: 3 }, py: 2, borderBottom: 1, borderColor: "divider", bgcolor: "background.paper", flexShrink: 0 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ maxWidth: 900, mx: "auto" }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" color="primary.main" fontWeight={700} lineHeight={1.4}>LỊCH ĐIỂM DANH</Typography>
            <Typography variant="h6" fontWeight={700} noWrap>{session ? `${session.class.code} · ${session.class.name}` : `Ngày ${selectedDate.split("-").reverse().join("/")}`}</Typography>
            <Typography variant="body2" color="text.secondary" noWrap>{session ? `${session.class.subjectName} · ${formatSessionTime(session.sessionAt)}` : `${selectedDaySessions.length} phiên điểm danh`}</Typography>
          </Box>
          <IconButton aria-label="Đóng lịch điểm danh" onClick={() => { setSelectedDate(""); setSession(null); setMessage(""); }} sx={{ border: 1, borderColor: "divider", flexShrink: 0 }}><CloseOutlinedIcon /></IconButton>
        </Stack>
      </Box>
      <Box sx={{ width: "100%", maxWidth: 900, mx: "auto", p: { xs: 2, sm: 3 }, overflowY: "auto", flex: 1 }}>
        {session ? <>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1.5 }}>
            <Button onClick={() => { setSession(null); setMessage(""); }} startIcon={<ArrowBackOutlinedIcon />} sx={{ flexShrink: 0, px: 0 }}>Danh sách phiên</Button>
            <Stack direction="row" spacing={0.75}>
              <Chip size="small" color="success" label={`${presentCount} có mặt`} />
              <Chip size="small" color="error" label={`${absentCount} vắng`} />
            </Stack>
          </Stack>
          {message && <Alert severity="success" onClose={() => setMessage("")} sx={{ mb: 2 }}>{message}</Alert>}
          {loadingDetail ? <LoadingState label="Đang tải phiên điểm danh..." minHeight={120} /> : <>
            <Paper variant="outlined" sx={{ overflow: "hidden" }}><AttendanceRecordList records={session.records} onChange={changeRecord} /></Paper>
            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}><Button variant="contained" onClick={() => void save()} disabled={saving} sx={{ minHeight: 44 }}>{saving ? "Đang lưu..." : "Lưu thay đổi"}</Button></Stack>
            {session.audits.length > 0 && <Stack spacing={0.5} sx={{ mt: 2 }}><Typography variant="subtitle2">Lịch sử chỉnh sửa</Typography>{session.audits.map((audit) => <Typography key={audit.id} variant="caption" color="text.secondary">{audit.action === "ATTENDANCE_CREATED" ? "Tạo điểm danh" : "Cập nhật điểm danh"} · {audit.actor.fullName} · {formatSessionTime(audit.performedAt)}</Typography>)}</Stack>}
          </>}
        </> : <>
          {selectedDaySessions.length ? <Stack spacing={1}>{selectedDaySessions.map((item) => <Button key={item.id} variant="outlined" onClick={() => void openSession(item.id)} sx={{ justifyContent: "space-between", textAlign: "left", p: 1.5, minHeight: 64, borderColor: "info.light", bgcolor: "info.50", color: "text.primary", borderRadius: 2, "&:hover": { bgcolor: "info.100", borderColor: "info.main" } }}><Stack direction="row" spacing={1.25} alignItems="center"><Box sx={{ width: 36, height: 36, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "info.100", color: "info.dark" }}><ArrowForwardIosOutlinedIcon sx={{ fontSize: 14 }} /></Box><Box><Typography component="span" variant="body2" fontWeight={700}>{formatSessionTime(item.sessionAt)}</Typography><Typography display="block" component="span" variant="caption" color="text.secondary">Mở chi tiết phiên</Typography></Box></Stack><Chip size="small" color="info" variant="outlined" label={`${item.studentCount} học viên`} /></Button>)}</Stack> : <Typography color="text.secondary" sx={{ py: 2 }}>Ngày này chưa có phiên điểm danh.</Typography>}
          {loadingDetail && <LoadingState label="Đang tải phiên điểm danh..." minHeight={100} />}
        </>}
      </Box>
    </Drawer>
  </Stack>;
}
