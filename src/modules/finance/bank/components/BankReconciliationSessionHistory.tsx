"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
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
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { LoadingState } from "@/components/shared/feedback/LoadingState";

type Session = {
  id: string;
  fileName: string;
  bankFormat: string;
  statementFromDate: string | null;
  statementToDate: string | null;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicatedRows: number;
  matchedRows: number;
  unmatchedRows: number;
  ignoredRows: number;
  createdAt: string;
  bankAccount: { bankName: string; accountNo: string };
};

type SessionList = { sessions: Session[]; total: number; page: number; pageSize: number };
const DEFAULT_PAGE_SIZE = 20;

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

function formatCreatedAt(value: string) {
  return new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

export function BankReconciliationSessionHistory() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSessions = useCallback(async (targetPage: number, targetPageSize: number) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/bank-statement-imports?page=${targetPage}&pageSize=${targetPageSize}`);
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tải phiên đối soát"));
      const data = await unwrapApiResponse<SessionList>(response);
      setSessions(data.sessions);
      setTotal(data.total);
      setPage(data.page);
      setPageSize(data.pageSize);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải phiên đối soát");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadSessions(1, DEFAULT_PAGE_SIZE); }, [loadSessions]);
  useEffect(() => {
    const refresh = () => { void loadSessions(1, pageSize); };
    window.addEventListener("bank-reconciliation-sessions-updated", refresh);
    return () => window.removeEventListener("bank-reconciliation-sessions-updated", refresh);
  }, [loadSessions, pageSize]);

  return (
    <Paper sx={{ width: "100%", minWidth: 0, boxSizing: "border-box", p: { xs: 1.5, md: 2 } }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1}>
          <Box>
            <Typography variant="h6" fontWeight={700}>Lịch sử phiên đối soát</Typography>
            <Typography variant="body2" color="text.secondary">{total} phiên đã lưu</Typography>
          </Box>
          <Button startIcon={<RefreshOutlinedIcon />} onClick={() => void loadSessions(page, pageSize)} disabled={loading}>
            Làm mới
          </Button>
        </Stack>
        {error && <Alert severity="error">{error}</Alert>}
        {loading && sessions.length === 0 && !error && <LoadingState label="Đang tải lịch sử đối soát..." minHeight={200} />}
        {!error && sessions.length === 0 && !loading && <Alert severity="info">Chưa có phiên sao kê nào.</Alert>}
        {sessions.length > 0 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Thời điểm import</TableCell>
                  <TableCell>File / tài khoản</TableCell>
                  <TableCell>Ngày sao kê</TableCell>
                  <TableCell align="right">Dòng</TableCell>
                  <TableCell align="right">Khớp</TableCell>
                  <TableCell align="right">Chưa khớp</TableCell>
                  <TableCell align="right">Bỏ qua</TableCell>
                  <TableCell align="right">Trùng / lỗi</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id} hover>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatCreatedAt(session.createdAt)}</TableCell>
                    <TableCell sx={{ minWidth: 180 }}>
                      <Typography variant="body2" fontWeight={600}>{session.fileName}</Typography>
                      <Typography variant="caption" color="text.secondary">{session.bankAccount.bankName} · {session.bankAccount.accountNo}</Typography>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(session.statementFromDate)} – {formatDate(session.statementToDate)}</TableCell>
                    <TableCell align="right">{session.totalRows}</TableCell>
                    <TableCell align="right">{session.matchedRows}</TableCell>
                    <TableCell align="right">{session.unmatchedRows}</TableCell>
                    <TableCell align="right">{session.ignoredRows}</TableCell>
                    <TableCell align="right">{session.duplicatedRows} / {session.invalidRows}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {loading && sessions.length > 0 && <LoadingState label="Đang tải phiên đối soát..." inline size={18} />}
        {total > 0 && (
          <TablePagination
            component="div"
            count={total}
            page={page - 1}
            rowsPerPage={pageSize}
            onPageChange={(_, nextPage) => void loadSessions(nextPage + 1, pageSize)}
            onRowsPerPageChange={(event) => {
              const nextPageSize = Number(event.target.value);
              void loadSessions(1, nextPageSize);
            }}
            rowsPerPageOptions={[10, 20, 50, 100]}
            labelRowsPerPage="Số dòng/trang"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} trên ${count !== -1 ? count : `hơn ${to}`}`}
          />
        )}
      </Stack>
    </Paper>
  );
}
