"use client";

import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import RestartAltOutlinedIcon from "@mui/icons-material/RestartAltOutlined";
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
import { useEffect, useState } from "react";
import { DatePickerField } from "@/components/shared/forms/DatePickerField";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { getVietnamDate } from "@/lib/vietnam-time";

type BankAccount = {
  id: string;
  bankName: string;
  accountNo: string;
};

type ReportScope = "ALL" | "MATCHED" | "UNMATCHED";

export function BankReconciliationReportCard() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [fromDate, setFromDate] = useState(getVietnamDate);
  const [toDate, setToDate] = useState(getVietnamDate);
  const [scope, setScope] = useState<ReportScope>("ALL");
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadAccounts() {
      setLoadingAccounts(true);
      try {
        const response = await fetch("/api/bank-accounts");
        if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tải tài khoản ngân hàng"));
        const data = await unwrapApiResponse<BankAccount[]>(response);
        if (!cancelled) {
          setAccounts(data);
          setAccountId((current) => data.some((account) => account.id === current) ? current : data[0]?.id || "");
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Không thể tải tài khoản ngân hàng");
      } finally {
        if (!cancelled) setLoadingAccounts(false);
      }
    }
    void loadAccounts();
    return () => { cancelled = true; };
  }, []);

  async function handleExport() {
    if (!accountId || !fromDate || !toDate) {
      setError("Chọn tài khoản và khoảng ngày cần xuất báo cáo");
      return;
    }
    if (fromDate > toDate) {
      setError("Đến ngày phải lớn hơn hoặc bằng Từ ngày");
      return;
    }
    setExporting(true);
    setError("");
    try {
      const response = await fetch("/api/bank-reconciliation-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankAccountId: accountId, fromDate, toDate, scope }),
      });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể xuất báo cáo đối soát"));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || "bao-cao-doi-soat.xlsx";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xuất báo cáo đối soát");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Paper sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack spacing={2.5}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>Điều kiện báo cáo</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Chọn tài khoản, khoảng ngày giao dịch và trạng thái cần tổng hợp.
          </Typography>
        </Box>
        {error && <Alert severity="error">{error}</Alert>}
        {!loadingAccounts && !accounts.length && <Alert severity="warning">Chưa có tài khoản ngân hàng đang hoạt động.</Alert>}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
          <FormControl fullWidth disabled={loadingAccounts || !accounts.length}>
            <InputLabel id="reports-bank-account-label">Tài khoản nhận</InputLabel>
            <Select
              labelId="reports-bank-account-label"
              label="Tài khoản nhận"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              {accounts.map((account) => <MenuItem key={account.id} value={account.id}>{account.bankName} — {account.accountNo}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel id="reports-reconciliation-scope-label">Phạm vi</InputLabel>
            <Select
              labelId="reports-reconciliation-scope-label"
              label="Phạm vi"
              value={scope}
              onChange={(event) => setScope(event.target.value as ReportScope)}
            >
              <MenuItem value="ALL">Tất cả giao dịch</MenuItem>
              <MenuItem value="MATCHED">Đã khớp</MenuItem>
              <MenuItem value="UNMATCHED">Chưa khớp</MenuItem>
            </Select>
          </FormControl>
          <DatePickerField label="Từ ngày" value={fromDate} onChange={setFromDate} textFieldProps={{ size: "small" }} />
          <DatePickerField label="Đến ngày" value={toDate} onChange={setToDate} textFieldProps={{ size: "small" }} />
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1.5}>
          <Typography variant="body2" color="text.secondary">Tiêu chí lọc là ngày giao dịch trên sao kê ngân hàng.</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button variant="outlined" color="inherit" startIcon={<RestartAltOutlinedIcon />} onClick={() => { setAccountId(accounts[0]?.id || ""); setFromDate(getVietnamDate()); setToDate(getVietnamDate()); setScope("ALL"); setError(""); }} disabled={exporting || (accountId === (accounts[0]?.id || "") && fromDate === getVietnamDate() && toDate === getVietnamDate() && scope === "ALL")} sx={{ whiteSpace: "nowrap" }}>
              Đặt lại
            </Button>
            <Button variant="contained" startIcon={<DownloadOutlinedIcon />} onClick={() => void handleExport()} disabled={exporting || loadingAccounts || !accountId} sx={{ whiteSpace: "nowrap" }}>
              {exporting ? "Đang xuất..." : "Xuất báo cáo Excel"}
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
}
