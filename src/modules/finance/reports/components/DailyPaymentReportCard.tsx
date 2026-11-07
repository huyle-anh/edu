"use client";

import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import RestartAltOutlinedIcon from "@mui/icons-material/RestartAltOutlined";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { DatePickerField } from "@/components/shared/forms/DatePickerField";
import { extractApiErrorMessage } from "@/lib/api-client";
import { getVietnamDate } from "@/lib/vietnam-time";

export function DailyPaymentReportCard() {
  const [date, setDate] = useState(getVietnamDate);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  async function handleExport() {
    if (!date) return;
    setExporting(true);
    setError("");
    try {
      const response = await fetch(`/api/reports/daily-payments/export?date=${date}`);
      if (!response.ok) {
        throw new Error(await extractApiErrorMessage(response, "Không thể xuất báo cáo ngày"));
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `bao-cao-thu-hoc-phi-ngay-${date}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xuất báo cáo ngày");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Paper sx={{ p: { xs: 2, md: 2.5 } }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>Điều kiện báo cáo</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Chọn ngày nhận tiền để xuất danh sách thanh toán thành công.
          </Typography>
        </Box>
        {error && <Alert severity="error">{error}</Alert>}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <DatePickerField label="Ngày báo cáo" value={date} onChange={setDate} textFieldProps={{ size: "small" }} />
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button variant="outlined" color="inherit" startIcon={<RestartAltOutlinedIcon />} onClick={() => { setDate(getVietnamDate()); setError(""); }} disabled={exporting || date === getVietnamDate()} sx={{ whiteSpace: "nowrap" }}>
              Đặt lại
            </Button>
            <Button
              variant="contained"
              startIcon={<DownloadOutlinedIcon />}
              onClick={() => void handleExport()}
              disabled={exporting || !date}
              sx={{ whiteSpace: "nowrap" }}
            >
              {exporting ? "Đang xuất..." : "Xuất Excel"}
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
}
