"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Paper, Stack, Typography } from "@mui/material";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingState } from "@/components/shared/feedback/LoadingState";
import { MasterSelectField, type MasterSelectValue } from "@/components/shared/forms/MasterSelectField";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { AttendanceRecordList, type AttendanceRow } from "@/modules/attendance/components/AttendanceRecordList";
import { AttendanceClassSelectDialog, type AttendanceClassOption } from "@/modules/attendance/components/AttendanceClassSelectDialog";

type AttendanceSession = { id: string | null; class: { id: string; code: string; name: string; subjectName: string; teacherName: string }; records: AttendanceRow[] };
type PageResult<T> = { items: T[]; pagination: { page: number; pageSize: number; totalPages: number } };

export function AttendancePage() {
  const [classes, setClasses] = useState<AttendanceClassOption[]>([]);
  const [classId, setClassId] = useState("");
  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingSession, setLoadingSession] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadClasses = useCallback(async () => {
    setLoadingClasses(true);
    try {
      const response = await fetch("/api/attendance?page=1&pageSize=100");
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không tải được danh sách lớp"));
      const first = await unwrapApiResponse<PageResult<AttendanceClassOption>>(response);
      const others = await Promise.all(Array.from({ length: Math.max(0, first.pagination.totalPages - 1) }, async (_, index) => {
        const result = await fetch(`/api/attendance?page=${index + 2}&pageSize=100`);
        if (!result.ok) throw new Error(await extractApiErrorMessage(result, "Không tải được danh sách lớp"));
        return unwrapApiResponse<PageResult<AttendanceClassOption>>(result);
      }));
      setClasses([...first.items, ...others.flatMap((item) => item.items)]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tải được danh sách lớp");
    } finally { setLoadingClasses(false); }
  }, []);

  useEffect(() => { void loadClasses(); }, [loadClasses]);

  const selectedClass = classes.find((item) => item.classId === classId);
  const selectedClassValue: MasterSelectValue | null = selectedClass
    ? { id: selectedClass.classId, code: selectedClass.classCode, name: selectedClass.className }
    : null;
  const beginNewSession = async () => {
    if (!classId) return;
    setLoadingSession(true); setSession(null); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/attendance?classId=${classId}&newSession=true`);
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không tải được danh sách học viên"));
      const result = await unwrapApiResponse<Omit<AttendanceSession, "id">>(response);
      setSession({ ...result, id: null });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không tải được danh sách học viên"); }
    finally { setLoadingSession(false); }
  };

  const changeRecord = (enrollmentId: string, changes: Partial<Pick<AttendanceRow, "status" | "note">>) => {
    setSession((current) => current ? { ...current, records: current.records.map((row) => row.enrollmentId === enrollmentId ? { ...row, ...changes } : row) } : current);
  };

  const save = async () => {
    if (!session || !session.records.length) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ classId, records: session.records.map(({ enrollmentId, status, note }) => ({ enrollmentId, status, note })) }) });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể lưu điểm danh"));
      const saved = await unwrapApiResponse<{ id: string; sessionAt: string }>(response);
      setMessage(`Đã lưu điểm danh lúc ${new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }).format(new Date(saved.sessionAt))}`);
      setSession(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể lưu điểm danh"); }
    finally { setSaving(false); }
  };

  return <Stack spacing={2.5}>
    <PageHeader title="Điểm danh" description="Chọn lớp, đánh dấu học viên có mặt và lưu điểm danh." />
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
      <Button component={Link} href="/teacher/attendance/calendar" variant="outlined" startIcon={<CalendarMonthOutlinedIcon />} fullWidth sx={{ maxWidth: { sm: 240 }, minHeight: 44 }}>Lịch điểm danh</Button>
    </Stack>
    {error && <Alert severity="error">{error}</Alert>}
    {message && <Alert severity="success" onClose={() => setMessage("")}>{message}</Alert>}
    <Paper sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
        <MasterSelectField
          label="Lớp"
          value={selectedClassValue}
          onOpen={() => setClassDialogOpen(true)}
          disabled={loadingClasses || classes.length === 0}
          codeLabel="Mã lớp"
          nameLabel="Tên lớp"
          sx={{ flex: 1, minWidth: 0 }}
        />
        <Button variant="contained" startIcon={<FactCheckOutlinedIcon />} onClick={() => void beginNewSession()} disabled={!selectedClass?.canCreate || loadingClasses || loadingSession} sx={{ minWidth: { md: 210 }, minHeight: 48, flexShrink: 0 }}>
          {loadingSession ? "Đang tải..." : "Bắt đầu điểm danh"}
        </Button>
      </Stack>
      {selectedClass && !selectedClass.canCreate && <Alert severity="info" sx={{ mt: 2 }}>Lớp này hiện chỉ xem được lịch sử điểm danh.</Alert>}
      {!loadingClasses && !classes.length && <Alert severity="info" sx={{ mt: 2 }}>Tài khoản chưa được phân công lớp/môn nào để điểm danh.</Alert>}
    </Paper>
    <AttendanceClassSelectDialog
      open={classDialogOpen}
      options={classes}
      onClose={() => setClassDialogOpen(false)}
      onSelect={(item) => {
        setClassId(item.classId);
        setSession(null);
        setError("");
        setMessage("");
      }}
    />
    {loadingSession && <LoadingState label="Đang tải danh sách học viên..." />}
    {session && !loadingSession && <Paper sx={{ overflow: "hidden" }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1.5} sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
        <Box><Typography variant="h6" fontWeight={700}>{session.class.code} · {session.class.name}</Typography><Typography variant="body2" color="text.secondary">{session.class.subjectName} · {session.records.length} học viên</Typography></Box>
        <Button variant="contained" onClick={() => void save()} disabled={saving || session.records.length === 0} sx={{ display: { xs: "none", md: "inline-flex" }, minHeight: 44 }}>{saving ? "Đang lưu..." : "Lưu điểm danh"}</Button>
      </Stack>
      <Box sx={{ pb: { xs: 9, md: 0 } }}><AttendanceRecordList records={session.records} onChange={changeRecord} /></Box>
    </Paper>}
    {session && <Button variant="contained" onClick={() => void save()} disabled={saving || session.records.length === 0} sx={{ display: { xs: "flex", md: "none" }, position: "fixed", left: 2, right: 2, bottom: "calc(8px + env(safe-area-inset-bottom))", zIndex: 1200, minHeight: 48, boxShadow: 4 }}>
      {saving ? "Đang lưu..." : "Lưu điểm danh"}
    </Button>}
  </Stack>;
}
