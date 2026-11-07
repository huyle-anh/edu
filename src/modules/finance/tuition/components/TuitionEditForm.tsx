"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { CurrencyInput } from "@/components/shared/forms/CurrencyInput";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import Link from "next/link";
import { DatePickerField } from "@/components/shared/forms/DatePickerField";
import { LoadingState } from "@/components/shared/feedback/LoadingState";

type Fee = {
  feeNo: string;
  originalAmount: number;
  discountAmount: number;
  additionalAmount: number;
  finalAmount: number;
  dueDate?: string | null;
  note?: string | null;
  version: number;
  status: string;
  paymentAllocations?: Array<{ paymentBatch: { batchNo: string; status: string } }>;
};
export function TuitionEditForm({
  id,
  onSuccess,
  embedded = false,
  onCancel,
}: {
  id: string;
  onSuccess: () => void;
  embedded?: boolean;
  onCancel?: () => void;
}) {
  const [fee, setFee] = useState<Fee | null>(null);
  const [discount, setDiscount] = useState(0);
  const [additional, setAdditional] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/tuition-fees/${id}`);
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(response, "Không thể tải học phí"),
        );
      const data = await unwrapApiResponse<Fee>(response);
      setFee(data);
      setDiscount(Number(data.discountAmount));
      setAdditional(Number(data.additionalAmount));
      setDueDate(data.dueDate?.slice(0, 10) || "");
      setNote(data.note || "");
    } catch (reason) {
      setFee(null);
      setError(reason instanceof Error ? reason.message : "Không thể tải học phí");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    if (!fee || !reason.trim()) {
      setError("Lý do thay đổi là bắt buộc");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/tuition-fees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discountAmount: discount,
          additionalAmount: additional,
          dueDate: dueDate || null,
          note: note || null,
          version: fee.version,
          reason: reason.trim(),
        }),
      });
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(response, "Không thể cập nhật học phí"),
        );
      onSuccess();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể cập nhật học phí",
      );
    } finally {
      setSaving(false);
    }
  }
  if (loading) return <LoadingState label="Đang tải dữ liệu học phí..." minHeight={360} />;
  if (error && !fee)
    return (
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
    );
  if (!fee) return <Alert severity="error">Không tìm thấy học phí</Alert>;
  if (fee.status === "PAID")
    return (
      <Alert severity="warning">Học phí đã thanh toán và không thể sửa.</Alert>
    );
  if (fee.status === "CANCELLED" || fee.status === "EXEMPTED")
    return (
      <Alert severity="warning">
        Học phí {fee.status === "CANCELLED" ? "đã hủy" : "đã được miễn"} và không thể sửa. Hãy khôi phục trước khi chỉnh sửa.
      </Alert>
    );
  const pendingBatch = fee.paymentAllocations?.find(
    (allocation) => allocation.paymentBatch.status === "PENDING",
  )?.paymentBatch;
  if (pendingBatch)
    return (
      <Alert severity="warning">
        Khoản phí đang chờ thanh toán trong đợt {pendingBatch.batchNo} và không thể sửa.
      </Alert>
    );
  if (fee.status === "PARTIAL")
    return (
      <Alert severity="warning">Học phí đã phát sinh thanh toán một phần và không thể sửa số tiền.</Alert>
    );
  const total = Number(fee.originalAmount) - discount + additional;
  return (
    <Stack spacing={{ xs: 2, md: 3 }} maxWidth={760}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        spacing={1}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Sửa học phí {fee.feeNo}
          </Typography>
          <Typography color="text.secondary">
            Cập nhật thông tin trước khi ghi nhận thanh toán
          </Typography>
        </Box>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      <Paper sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Typography variant="subtitle1" fontWeight={700}>
            Thông tin điều chỉnh
          </Typography>
          <CurrencyInput
            label="Học phí gốc"
            value={Number(fee.originalAmount)}
            readOnly
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <CurrencyInput
              label="Giảm giá / học bổng"
              value={discount}
              onChange={setDiscount}
            />
            <CurrencyInput
              label="Phụ phí"
              value={additional}
              onChange={setAdditional}
            />
          </Stack>
          <Typography variant="h6" color="primary.main">
            Tổng mới: {total.toLocaleString("vi-VN")} VND
          </Typography>
          <DatePickerField
            label="Hạn thanh toán"
            value={dueDate}
            onChange={setDueDate}
          />
          <TextField
            label="Ghi chú"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
          />
          <TextField
            label="Lý do thay đổi *"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            multiline
            minRows={2}
          />
        </Stack>
      </Paper>
      <Stack direction="row" justifyContent="flex-end" spacing={1}>
        {embedded ? (
          <Button variant="outlined" onClick={onCancel} disabled={saving}>
            Hủy
          </Button>
        ) : (
          <Button
            component={Link}
            href={`/admin/tuition-fees/${id}`}
            variant="outlined"
          >
            Hủy
          </Button>
        )}
        <Button
          variant="contained"
          onClick={() => void submit()}
          disabled={saving}
        >
          {saving ? "Đang lưu..." : "Lưu thay đổi"}
        </Button>
      </Stack>
    </Stack>
  );
}
