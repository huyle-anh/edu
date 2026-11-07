"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/shared/dialogs/ConfirmDialog";
import { useSnackbar } from "@/hooks/useSnackbar";
import { AppTextField } from "@/components/shared/forms/AppTextField";
import { LoadingTableRow } from "@/components/shared/feedback/LoadingState";

type SubjectOption = {
  id: string;
  subject: { name: string; status?: "ACTIVE" | "INACTIVE" };
  teacherId: string | null;
  teacher?: { fullName?: string | null } | null;
};
type Schedule = {
  id: string;
  classSubjectId: string;
  teacherId: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  teacher?: { fullName?: string | null } | null;
  classSubject: { subject: { name: string } };
};
const days = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
const toMinutes = (value: string) => {
  const [hour = 0, minute = 0] = value.split(":").map(Number);
  return hour * 60 + minute;
};
const toTime = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

export function ClassSchedulePanel({
  classId,
  classSubjects,
  readOnly = false,
}: {
  classId: string;
  classSubjects: SubjectOption[];
  readOnly?: boolean;
}) {
  const activeClassSubjects = classSubjects.filter(
    (subject) => subject.subject.status !== "INACTIVE",
  );
  const [items, setItems] = useState<Schedule[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [classSubjectId, setClassSubjectId] = useState(
    activeClassSubjects[0]?.id || "",
  );
  const [day, setDay] = useState(1);
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("10:00");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Schedule | null>(null);
  const selectedSubject = classSubjects.find(
    (subject) => subject.id === classSubjectId,
  );
  const { showSuccess, Snackbar } = useSnackbar();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/schedules?classId=${classId}&page=${page + 1}&pageSize=${pageSize}`,
      );
      if (!response.ok) {
        throw new Error(await extractApiErrorMessage(response, "Không thể tải lịch học"));
      }
      const result = await unwrapApiResponse<{
        items: Schedule[];
        total: number;
      }>(response);
      setItems(result.items);
      setTotal(result.total);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải lịch học");
    } finally {
      setLoading(false);
    }
  }, [classId, page, pageSize]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const nextActiveSubjects = classSubjects.filter(
      (subject) => subject.subject.status !== "INACTIVE",
    );
    if (!nextActiveSubjects.some((subject) => subject.id === classSubjectId)) {
      setClassSubjectId(nextActiveSubjects[0]?.id || "");
    }
  }, [classSubjects, classSubjectId]);

  function resetForm() {
    setEditingSchedule(null);
    setClassSubjectId(activeClassSubjects[0]?.id || "");
    setDay(1);
    setStart("08:00");
    setEnd("10:00");
    setError("");
  }

  function openEditSchedule(schedule: Schedule) {
    setEditingSchedule(schedule);
    setClassSubjectId(schedule.classSubjectId);
    setDay(schedule.dayOfWeek);
    setStart(toTime(schedule.startMinute));
    setEnd(toTime(schedule.endMinute));
    setError("");
  }

  async function addSchedule() {
    if (readOnly) return;
    if (!selectedSubject) {
      setError("Lớp chưa có môn học");
      return;
    }
    if (!selectedSubject.teacherId) {
      setError("Môn học chưa được phân công giáo viên");
      return;
    }
    if (toMinutes(start) >= toMinutes(end)) {
      setError("Giờ kết thúc phải sau giờ bắt đầu");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const conflictResponse = await fetch("/api/schedules/check-conflict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          classSubjectId,
          teacherId: selectedSubject.teacherId,
          dayOfWeek: day,
          startMinute: toMinutes(start),
          endMinute: toMinutes(end),
          ...(editingSchedule?.id && { excludeScheduleId: editingSchedule.id }),
        }),
      });
      if (!conflictResponse.ok) {
        throw new Error(await extractApiErrorMessage(conflictResponse, "Không thể kiểm tra trùng lịch"));
      }
      const conflictResult = await unwrapApiResponse<{
        hasConflict: boolean;
        conflicts: Array<{
          class?: { code?: string; name?: string } | null;
          startMinute: number;
          endMinute: number;
        }>;
      }>(conflictResponse);
      if (conflictResult.hasConflict) {
        const details = conflictResult.conflicts
          .slice(0, 2)
          .map((conflict) => `${conflict.class?.code || "Lớp khác"} (${toTime(conflict.startMinute)}–${toTime(conflict.endMinute)})`)
          .join(", ");
        setError(`Lịch học bị trùng${details ? ` với ${details}` : ""}. Vui lòng chọn khung giờ khác.`);
        return;
      }

      const response = await fetch(editingSchedule ? `/api/schedules/${editingSchedule.id}` : "/api/schedules", {
        method: editingSchedule ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          classSubjectId,
          teacherId: selectedSubject.teacherId,
          dayOfWeek: day,
          startMinute: toMinutes(start),
          endMinute: toMinutes(end),
        }),
      });
      if (!response.ok) {
        throw new Error(await extractApiErrorMessage(response, editingSchedule ? "Không thể cập nhật lịch học" : "Không thể tạo lịch học"));
      }
      resetForm();
      await load();
      showSuccess(editingSchedule ? "Đã cập nhật lịch học" : "Đã thêm lịch học");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể tạo lịch học",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeSchedule(id: string) {
    if (readOnly) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/schedules/${id}`, {
        method: "DELETE",
      });
      if (!response.ok)
        setError(
          await extractApiErrorMessage(response, "Không thể gỡ lịch học"),
        );
      else {
        setRemoveTarget(null);
        await load();
        showSuccess("Đã gỡ lịch học");
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể gỡ lịch học",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={{ xs: 2, md: 3 }}>
      {readOnly && (
        <Alert severity="info">
          Lớp đã hoàn thành hoặc đã hủy; lịch học chỉ được xem.
        </Alert>
      )}
      {!readOnly && <Paper sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
            <Box>
              <Typography fontWeight={700}>{editingSchedule ? "Sửa lịch học" : "Thêm lịch học"}</Typography>
              <Typography variant="body2" color="text.secondary">Giáo viên được lấy theo môn học đã phân công.</Typography>
            </Box>
            {editingSchedule && <Button size="small" variant="outlined" onClick={resetForm}>Hủy sửa</Button>}
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="class-schedule-subject-label">Môn học</InputLabel>
              <Select
                labelId="class-schedule-subject-label"
                label="Môn học"
                value={classSubjectId}
                onChange={(event) => setClassSubjectId(event.target.value)}
              >
                {activeClassSubjects.map((subject) => (
                  <MenuItem key={subject.id} value={subject.id}>
                    {subject.subject.name} — {subject.teacher?.fullName || "Chưa phân công"}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="class-schedule-day-label">Thứ</InputLabel>
              <Select
                labelId="class-schedule-day-label"
                label="Thứ"
                value={day}
                onChange={(event) => setDay(Number(event.target.value))}
              >
                {days.map((label, index) => (
                  <MenuItem key={label} value={index}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <AppTextField
              size="small"
              type="time"
              label="Bắt đầu"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <AppTextField
              size="small"
              type="time"
              label="Kết thúc"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <Button
              variant="contained"
              onClick={() => void addSchedule()}
              disabled={readOnly || saving}
            >
              {editingSchedule ? "Cập nhật lịch học" : "Thêm lịch học"}
            </Button>
          </Stack>
        </Stack>
      </Paper>}
      {error && <Alert severity="error">{error}</Alert>}
      <Paper sx={{ overflow: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Môn học</TableCell>
              <TableCell>Ngày</TableCell>
              <TableCell>Thời gian</TableCell>
              <TableCell>Giáo viên</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? <LoadingTableRow colSpan={5} label="Đang tải lịch học..." /> : items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.classSubject?.subject.name || "-"}</TableCell>
                <TableCell>{days[item.dayOfWeek]}</TableCell>
                <TableCell>
                  {toTime(item.startMinute)} - {toTime(item.endMinute)}
                </TableCell>
                  <TableCell>{item.teacher?.fullName || "-"}</TableCell>
                  <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button
                      color="primary"
                      size="small"
                      variant="outlined"
                      startIcon={<EditOutlinedIcon />}
                      onClick={() => openEditSchedule(item)}
                      disabled={readOnly || saving}
                    >
                      Sửa
                    </Button>
                    <Button
                      color="error"
                      size="small"
                      variant="outlined"
                      startIcon={<DeleteOutlineIcon />}
                      onClick={() => setRemoveTarget(item)}
                      disabled={readOnly || saving}
                    >
                      Gỡ lịch
                    </Button>
                  </Stack>
                  </TableCell>
              </TableRow>
            ))}
            {!loading && !items.length && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography
                    sx={{ p: 3, textAlign: "center" }}
                    color="text.secondary"
                  >
                    Lớp chưa có lịch học
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
      <ConfirmDialog
        open={!readOnly && Boolean(removeTarget)}
        title="Gỡ lịch học"
        message={`Bạn có chắc muốn gỡ lịch ${removeTarget ? `${days[removeTarget.dayOfWeek]} ${toTime(removeTarget.startMinute)}–${toTime(removeTarget.endMinute)}` : "này"}? Lịch sẽ được giữ lại trong lịch sử.`}
        onConfirm={() => {
          if (removeTarget) void removeSchedule(removeTarget.id);
        }}
        onCancel={() => setRemoveTarget(null)}
        isLoading={saving}
        confirmLabel="Gỡ lịch"
      />
      {Snackbar}
    </Stack>
  );
}
