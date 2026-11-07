"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormHelperText,
  InputLabel,
  FormControlLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import SearchIcon from "@mui/icons-material/Search";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Link from "next/link";
import { ConfirmDialog } from "@/components/shared/dialogs/ConfirmDialog";
import {
  MasterSelectField,
  type MasterSelectValue,
} from "@/components/shared/forms/MasterSelectField";
import {
  StudentSelectDialog,
  type StudentItem,
} from "@/components/shared/dialogs/StudentSelectDialog";
import { AppTextField } from "@/components/shared/forms/AppTextField";
import { CurrencyInput } from "@/components/shared/forms/CurrencyInput";
import { DatePickerField } from "@/components/shared/forms/DatePickerField";
import { useDisclosure } from "@/hooks/useDisclosure";
import { useSnackbar } from "@/hooks/useSnackbar";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { getVietnamDate } from "@/lib/vietnam-time";
import { LoadingState } from "@/components/shared/feedback/LoadingState";
import { VietQrCard, downloadVietQrCard, type VietQrCardData } from "./VietQrCard";

type Fee = {
  id: string;
  feeNo: string;
  finalAmount: number;
  paidAmount?: number;
  remainingAmount?: number;
  dueDate?: string | null;
  status: string;
  student?: { code: string; fullName: string } | null;
  class?: { name: string } | null;
  paymentAllocations?: Array<{
    paymentBatch: { id: string; batchNo: string; status: string };
  }>;
};
type BankAccount = {
  id: string;
  bankCode: string;
  bankName: string;
  accountNo: string;
  accountName: string;
};
type PendingBatch = {
  id: string;
  batchNo: string;
  amount: number;
  account: BankAccount;
  qrDataUrl: string;
  transferContent?: string;
};
const steps = ["Tìm học viên", "Nhập số tiền", "Xác nhận", "Hoàn tất"];
const feeStatusLabels: Record<string, string> = {
  UNPAID: "Chưa thanh toán",
  PARTIAL: "Đã thu một phần",
  OVERDUE: "Quá hạn",
};
const feeStatusColors: Record<string, "warning" | "error" | "info"> = {
  UNPAID: "warning",
  PARTIAL: "info",
  OVERDUE: "error",
};
const money = (value: number) =>
  `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;
const paymentAttemptStoragePrefix = "edu:payment-attempt:";

export function TuitionPaymentWorkspace({
  initialTuitionFeeId,
}: {
  initialTuitionFeeId?: string;
}) {
  const [step, setStep] = useState(0);
  const [student, setStudent] = useState<MasterSelectValue | null>(null);
  const [studentCode, setStudentCode] = useState("");
  const [fees, setFees] = useState<Fee[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showMultipleFees, setShowMultipleFees] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [method, setMethod] = useState("CASH");
  const [payerName, setPayerName] = useState("");
  const [transactionReference, setTransactionReference] = useState("");
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankAccountId, setBankAccountId] = useState("");
  const [bankAccountsLoading, setBankAccountsLoading] = useState(false);
  const [bankAccountsError, setBankAccountsError] = useState("");
  const [bankAccountError, setBankAccountError] = useState("");
  const [pendingBatch, setPendingBatch] = useState<PendingBatch | null>(null);
  const [cashDialogOpen, setCashDialogOpen] = useState(false);
  const [cashPaymentDate, setCashPaymentDate] = useState(() => getVietnamDate());
  const [cashNote, setCashNote] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [newPaymentConfirmOpen, setNewPaymentConfirmOpen] = useState(false);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [completedBatchId, setCompletedBatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [error, setError] = useState("");
  const paymentIdempotencyKeyRef = useRef<string | null>(null);
  const paymentAttemptFingerprintRef = useRef<string | null>(null);
  const studentDialog = useDisclosure();
  const { showSuccess, showError, Snackbar } = useSnackbar();
  const selectedFees = fees.filter((fee) => selectedIds.includes(fee.id));
  const selectedFee = selectedFees[0];
  const getRemaining = (fee: Fee) => Number(fee.remainingAmount ?? fee.finalAmount);
  const getAmount = (fee: Fee) => amounts[fee.id] ?? getRemaining(fee);
  const getAmountError = (fee: Fee) => {
    const amount = getAmount(fee);
    if (amount <= 0) return "Số tiền phải lớn hơn 0";
    if (amount > getRemaining(fee)) return "Không được vượt số tiền còn nợ";
    return "";
  };
  const total = useMemo(
    () => selectedFees.reduce((sum, fee) => sum + (amounts[fee.id] ?? Number(fee.remainingAmount ?? fee.finalAmount)), 0),
    [selectedFees, amounts],
  );
  const hasInvalidAmount = selectedFees.some((fee) => Boolean(getAmountError(fee)));
  const selectedStudent = fees[0]?.student;

  const loadBankAccounts = useCallback(async () => {
    setBankAccountsLoading(true);
    setBankAccountsError("");
    try {
      const response = await fetch("/api/bank-accounts");
      if (!response.ok) {
        throw new Error(
          await extractApiErrorMessage(
            response,
            "Không thể tải tài khoản ngân hàng",
          ),
        );
      }
      setBankAccounts(await unwrapApiResponse<BankAccount[]>(response));
    } catch (reason) {
      setBankAccounts([]);
      setBankAccountsError(
        reason instanceof Error
          ? reason.message
          : "Không thể tải tài khoản ngân hàng",
      );
    } finally {
      setBankAccountsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBankAccounts();
  }, [loadBankAccounts]);

  useEffect(() => {
    if (!initialTuitionFeeId) return;
    setInitialLoading(true);
    setError("");
    void fetch(`/api/tuition-fees/${initialTuitionFeeId}`)
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            await extractApiErrorMessage(
              response,
              "Không thể tải khoản học phí",
            ),
          );
        return unwrapApiResponse<
          Fee & { student: { id: string; code: string; fullName: string } }
        >(response);
      })
      .then((fee) => {
        if (fee.status !== "UNPAID" && fee.status !== "PARTIAL" && fee.status !== "OVERDUE")
          throw new Error("Khoản học phí này không còn cần thanh toán");
        const pendingBatchNo =
          fee.paymentAllocations?.[0]?.paymentBatch.batchNo;
        if (pendingBatchNo)
          throw new Error(
            `Khoản học phí đang chờ thanh toán trong đợt ${pendingBatchNo}`,
          );
        setStudent({
          id: fee.student.id,
          code: fee.student.code,
          name: fee.student.fullName,
        });
        setStudentCode(fee.student.code);
        return fetch(
          `/api/tuition-fees?studentCode=${encodeURIComponent(fee.student.code)}&pageSize=100`,
        ).then(async (studentFeesResponse) => {
          if (!studentFeesResponse.ok)
            throw new Error(
              await extractApiErrorMessage(
                studentFeesResponse,
                "Không thể tải đầy đủ học phí của học viên",
              ),
            );
          const result = await unwrapApiResponse<{
            items: Fee[];
            pagination?: { totalPages: number };
          }>(studentFeesResponse);
          const totalPages = result.pagination?.totalPages ?? 1;
          const remainingPages = await Promise.all(
            Array.from({ length: Math.max(totalPages - 1, 0) }, (_, index) =>
              fetch(
                `/api/tuition-fees?studentCode=${encodeURIComponent(fee.student.code)}&page=${index + 2}&pageSize=100`,
              ).then(async (pageResponse) => {
                if (!pageResponse.ok)
                  throw new Error(
                    await extractApiErrorMessage(
                      pageResponse,
                      "Không thể tải đầy đủ học phí của học viên",
                    ),
                  );
                return unwrapApiResponse<{ items: Fee[] }>(pageResponse);
              }),
            ),
          );
          const allFees = [result.items, ...remainingPages.map((page) => page.items)].flat();
          return {
            fee,
            fees: allFees.filter(
              (studentFee) =>
                studentFee.status === "UNPAID" || studentFee.status === "PARTIAL" || studentFee.status === "OVERDUE",
            ),
          };
        });
      })
      .then(({ fee, fees: studentFees }) => {
        setFees(studentFees);
        setAmounts(Object.fromEntries(studentFees.map((item) => [item.id, Number(item.remainingAmount ?? item.finalAmount)])));
        setSelectedIds([fee.id]);
        setShowMultipleFees(false);
        setStep(1);
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Không thể tải khoản học phí",
        ),
      )
      .finally(() => setInitialLoading(false));
  }, [initialTuitionFeeId]);

  async function lookupStudent() {
    if (!studentCode) {
      setError("Mã học viên là bắt buộc");
      return;
    }
    setLoading(true);
    setError("");
    setPendingBatch(null);
    setReceiptId(null);
    setCompletedBatchId(null);
    try {
      const response = await fetch(
        `/api/tuition-fees?studentCode=${encodeURIComponent(studentCode)}&pageSize=100`,
      );
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(response, "Không thể tải học phí"),
        );
      const result = await unwrapApiResponse<{ items: Fee[]; pagination?: { totalPages: number } }>(response);
      const totalPages = result.pagination?.totalPages ?? 1;
      const remainingPages = await Promise.all(
        Array.from({ length: Math.max(totalPages - 1, 0) }, (_, index) =>
          fetch(`/api/tuition-fees?studentCode=${encodeURIComponent(studentCode)}&page=${index + 2}&pageSize=100`).then(async (pageResponse) => {
            if (!pageResponse.ok) throw new Error(await extractApiErrorMessage(pageResponse, "Không thể tải đầy đủ học phí"));
            return unwrapApiResponse<{ items: Fee[] }>(pageResponse);
          }),
        ),
      );
      const allFees = [result.items, ...remainingPages.map((page) => page.items)].flat();
      const unpaid = allFees.filter(
        (fee) => fee.status === "UNPAID" || fee.status === "PARTIAL" || fee.status === "OVERDUE",
      );
      const firstAvailableFee = unpaid.find((fee) => !fee.paymentAllocations?.length);
      setFees(unpaid);
      setAmounts(Object.fromEntries(unpaid.map((fee) => [fee.id, Number(fee.remainingAmount ?? fee.finalAmount)])));
      setSelectedIds(firstAvailableFee ? [firstAvailableFee.id] : []);
      setShowMultipleFees(false);
      if (!unpaid.length || !firstAvailableFee) {
        setError("Học sinh không còn khoản học phí cần thanh toán");
        return;
      }
      setStep(1);
    } catch (reason) {
      setFees([]);
      setSelectedIds([]);
      setError(
        reason instanceof Error ? reason.message : "Không thể tải học phí",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadPendingQr(batch: {
    id: string;
    batchNo: string;
    amount: number;
    account: BankAccount;
  }) {
    setQrLoading(true);
    setQrError("");
    try {
      const qrResponse = await fetch(`/api/payment-batches/${batch.id}/qr`);
      if (!qrResponse.ok) {
        throw new Error(
          await extractApiErrorMessage(
            qrResponse,
            "Không thể tạo QR thanh toán",
          ),
        );
      }
      const qr = await unwrapApiResponse<{
        qrDataUrl: string;
        amount: number;
        account: BankAccount;
        transferContent: string;
      }>(qrResponse);
      setPendingBatch({
        ...batch,
        amount: Number(qr.amount),
        account: qr.account,
        qrDataUrl: qr.qrDataUrl,
        transferContent: qr.transferContent,
      });
    } catch (reason) {
      setQrError(
        reason instanceof Error
          ? reason.message
          : "Không thể tạo QR thanh toán",
      );
    } finally {
      setQrLoading(false);
    }
  }

  async function submitPayment() {
    if (!selectedIds.length) {
      setError("Hãy chọn ít nhất một khoản học phí");
      setStep(1);
      return;
    }
    if (selectedFees.some((fee) => getAmount(fee) <= 0 || getAmount(fee) > getRemaining(fee))) {
      setError("Số tiền thanh toán phải lớn hơn 0 và không vượt số tiền còn nợ");
      setStep(1);
      return;
    }
    if (method === "BANK_TRANSFER" && !bankAccountId) {
      setBankAccountError("Hãy chọn tài khoản nhận tiền");
      return;
    }
    setConfirmOpen(false);
    setLoading(true);
    setError("");
    let response: Response | null = null;
    try {
      const requestPayload = {
        tuitionFeeIds: [...selectedIds].sort(),
        amounts: Object.fromEntries(
          Object.entries(
            Object.fromEntries(selectedFees.map((fee) => [fee.id, getAmount(fee)])),
          ).sort(([left], [right]) => left.localeCompare(right)),
        ),
        paymentMethod: method,
        paymentDate: method === "CASH" ? cashPaymentDate : undefined,
        bankAccountId: method === "BANK_TRANSFER" ? bankAccountId : undefined,
        payerName: payerName || undefined,
        transactionReference:
          method === "BANK_TRANSFER" ? transactionReference || undefined : undefined,
        note: method === "CASH" ? cashNote || undefined : undefined,
      };
      const requestFingerprint = JSON.stringify(requestPayload);
      if (paymentAttemptFingerprintRef.current !== requestFingerprint) {
        paymentIdempotencyKeyRef.current = null;
        paymentAttemptFingerprintRef.current = requestFingerprint;
      }
      const storageKey = `${paymentAttemptStoragePrefix}${requestFingerprint}`;
      let storedKey: string | null = null;
      try {
        storedKey = window.sessionStorage.getItem(storageKey);
      } catch {
        storedKey = null;
      }
      const idempotencyKey =
        paymentIdempotencyKeyRef.current ?? storedKey ?? crypto.randomUUID();
      paymentIdempotencyKeyRef.current = idempotencyKey;
      try {
        window.sessionStorage.setItem(storageKey, idempotencyKey);
      } catch {
        // Session storage can be unavailable in privacy-restricted browsers.
      }
      response = await fetch("/api/payment-batches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          ...requestPayload,
          idempotencyKey,
        }),
      });
      if (!response.ok) {
        // Keep the key for network/5xx failures: the server may have committed
        // the transaction before the response was lost. Clear it only for a
        // definitive client/domain rejection so the user can submit a new payload.
        if (response.status < 500 && response.status !== 408 && response.status !== 429) {
          clearPaymentAttempt(storageKey);
        }
        throw new Error(
          await extractApiErrorMessage(response, "Không thể tạo thanh toán"),
        );
      }
      const batch = await unwrapApiResponse<{
        id: string;
        batchNo: string;
        status: string;
        totalAmount: number;
        receipt?: { id: string } | null;
      }>(response);
      if (batch.status === "SUCCESS") {
        clearPaymentAttempt(storageKey);
        setReceiptId(batch.receipt?.id || null);
        setCompletedBatchId(batch.id);
        setStep(3);
        showSuccess("Đã ghi nhận thanh toán và phát hành biên lai");
        return;
      }
      setPendingBatch({
        id: batch.id,
        batchNo: batch.batchNo,
        amount: Number(batch.totalAmount),
        account:
          bankAccounts.find((account) => account.id === bankAccountId) ?? {
            id: bankAccountId,
            bankCode: "",
            bankName: "",
            accountNo: "",
            accountName: "",
          },
        qrDataUrl: "",
      });
      setStep(3);
      await loadPendingQr({
        id: batch.id,
        batchNo: batch.batchNo,
        amount: Number(batch.totalAmount),
        account:
          bankAccounts.find((account) => account.id === bankAccountId) ?? {
            id: bankAccountId,
            bankCode: "",
            bankName: "",
            accountNo: "",
            accountName: "",
        },
      });
      clearPaymentAttempt(storageKey);
      showSuccess("Đã tạo đợt chuyển khoản. Chờ đối soát sau khi nhận tiền");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Thanh toán thất bại",
      );
    } finally {
      setLoading(false);
    }
  }

  function clearPaymentAttempt(storageKey?: string) {
    const activeStorageKey =
      storageKey ||
      (paymentAttemptFingerprintRef.current
        ? `${paymentAttemptStoragePrefix}${paymentAttemptFingerprintRef.current}`
        : null);
    paymentIdempotencyKeyRef.current = null;
    paymentAttemptFingerprintRef.current = null;
    if (!activeStorageKey) return;
    try {
      window.sessionStorage.removeItem(activeStorageKey);
    } catch {
      // Session storage can be unavailable in privacy-restricted browsers.
    }
  }

  async function convertPendingBatchToCash() {
    if (!pendingBatch) return;
    if (!cashPaymentDate) {
      setError("Ngày nhận tiền mặt là bắt buộc");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/payment-batches/${pendingBatch.id}/cash`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentDate: cashPaymentDate, note: cashNote || undefined }),
      });
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(
            response,
            "Không thể chuyển đợt thanh toán sang tiền mặt",
          ),
        );
      const completed = await unwrapApiResponse<{
        id: string;
        receipt?: { id: string } | null;
      }>(response);
      setCashDialogOpen(false);
      setPendingBatch(null);
      setReceiptId(completed.receipt?.id || null);
      setCompletedBatchId(completed.id);
      setQrError("");
      showSuccess("Đã chuyển sang tiền mặt và phát hành biên lai");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể chuyển đợt thanh toán sang tiền mặt",
      );
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    clearPaymentAttempt();
    setStep(0);
    setStudent(null);
    setStudentCode("");
    setFees([]);
    setSelectedIds([]);
    setShowMultipleFees(false);
    setAmounts({});
    setPendingBatch(null);
    setReceiptId(null);
    setCompletedBatchId(null);
    setError("");
    setMethod("CASH");
    setCashPaymentDate(getVietnamDate());
    setCashNote("");
    setPayerName("");
    setTransactionReference("");
    setBankAccountId("");
    setBankAccountError("");
    setQrError("");
  }

  function startNewPayment() {
    if (pendingBatch) {
      setNewPaymentConfirmOpen(true);
      return;
    }
    reset();
  }

  function continueWithSameStudent() {
    clearPaymentAttempt();
    setStep(0);
    setFees([]);
    setSelectedIds([]);
    setAmounts({});
    setShowMultipleFees(false);
    setPendingBatch(null);
    setReceiptId(null);
    setCompletedBatchId(null);
    setError("");
    setMethod("CASH");
    setBankAccountId("");
    setTransactionReference("");
    void lookupStudent();
  }
  function selectStudent(item: StudentItem) {
    clearPaymentAttempt();
    setStudent({ id: item.id, code: item.code, name: item.fullName });
    setStudentCode(item.code);
    setFees([]);
    setSelectedIds([]);
    setShowMultipleFees(false);
    setAmounts({});
    setPendingBatch(null);
    setReceiptId(null);
    setCompletedBatchId(null);
    setError("");
    studentDialog.onClose();
  }

  function requestPaymentConfirmation() {
    if (!selectedIds.length) {
      setError("Hãy chọn ít nhất một khoản học phí");
      setStep(1);
      return;
    }
    if (selectedFees.some((fee) => getAmount(fee) <= 0 || getAmount(fee) > getRemaining(fee))) {
      setError("Số tiền thanh toán phải lớn hơn 0 và không vượt số tiền còn nợ");
      setStep(1);
      return;
    }
    if (method === "BANK_TRANSFER" && !bankAccountId) {
      setBankAccountError("Hãy chọn tài khoản nhận tiền");
      return;
    }
    if (method === "CASH" && !cashPaymentDate) {
      setError("Ngày nhận tiền mặt là bắt buộc");
      return;
    }
    setBankAccountError("");
    setConfirmOpen(true);
  }

  const pendingTransferContent =
    pendingBatch?.transferContent || pendingBatch?.batchNo || "";

  async function copyTransferContent() {
    if (!pendingBatch) return;
    try {
      await navigator.clipboard.writeText(pendingTransferContent);
      showSuccess("Đã sao chép nội dung chuyển khoản");
    } catch {
      showError("Không thể sao chép tự động. Vui lòng nhập: " + pendingTransferContent);
    }
  }

  const qrCardData: VietQrCardData | null = pendingBatch?.qrDataUrl
    ? {
        qrDataUrl: pendingBatch.qrDataUrl,
        bankCode: pendingBatch.account.bankCode,
        bankName: pendingBatch.account.bankName,
        accountName: pendingBatch.account.accountName,
        accountNo: pendingBatch.account.accountNo,
        amount: pendingBatch.amount,
        batchNo: pendingBatch.batchNo,
        transferContent: pendingTransferContent,
      }
    : null;

  async function downloadQrCard() {
    if (!qrCardData) return;
    try {
      await downloadVietQrCard(qrCardData);
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : "Không thể tải ảnh QR");
    }
  }

  return (
    <Stack spacing={{ xs: 2, md: 3 }} sx={{ width: "100%", minWidth: 0, pb: 3 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        gap={2}
      >
        <Box>
          <Typography variant="overline" color="primary.main" fontWeight={700}>
            Tài chính / Thu học phí
          </Typography>
          <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: -0.5 }}>
            Thu học phí
          </Typography>
          <Typography color="text.secondary">
            Thu toàn bộ hoặc chia thành nhiều lần theo từng khoản học phí.
          </Typography>
        </Box>
        {step > 0 && (
          <Button variant="outlined" onClick={startNewPayment} sx={{ flexShrink: 0 }}>
            Bắt đầu lượt thu mới
          </Button>
        )}
      </Stack>

      <Paper
        variant="outlined"
        sx={{
          p: { xs: 1, sm: 2 },
          borderRadius: 2,
          bgcolor: "background.paper",
        }}
      >
        <Stepper
          activeStep={step}
          alternativeLabel
          sx={{
            "& .MuiStepLabel-label": {
              fontSize: { xs: "0.68rem", sm: "0.875rem" },
              lineHeight: 1.2,
            },
          }}
        >
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}
      {initialLoading && <LoadingState label="Đang tải khoản học phí được chọn..." inline size={18} />}

      {step === 0 && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 340px" },
            gap: 2,
            alignItems: "start",
          }}
        >
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="h6" fontWeight={800}>
                  Chọn học viên
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Tìm theo mã hoặc tên để tải các khoản học phí còn phải thu.
                </Typography>
              </Box>
              <MasterSelectField
                label="Học viên"
                value={student}
                onOpen={studentDialog.onOpen}
                disabled={initialLoading}
                required
                codeLabel="Mã học viên"
                nameLabel="Họ tên"
              />
              <Button
                fullWidth
                variant="contained"
                size="large"
                startIcon={
                  loading || initialLoading ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />
                }
                onClick={() => void lookupStudent()}
                disabled={loading || initialLoading || !studentCode}
              >
                Tra cứu học phí
              </Button>
            </Stack>
          </Paper>
          <Paper
            variant="outlined"
            sx={{ p: { xs: 2, md: 3 }, borderRadius: 2, bgcolor: "action.hover" }}
          >
            <Typography variant="subtitle1" fontWeight={800}>
              Quy trình thu
            </Typography>
            <Stack spacing={1.5} sx={{ mt: 2 }}>
              {["Chọn học viên", "Chọn khoản và nhập số tiền", "Chọn phương thức thanh toán", "Xác nhận giao dịch"].map(
                (label, index) => (
                  <Stack key={label} direction="row" spacing={1.25} alignItems="center">
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        bgcolor: "primary.main",
                        color: "primary.contrastText",
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {index + 1}
                    </Box>
                    <Typography variant="body2">{label}</Typography>
                  </Stack>
                ),
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
              Có thể thu một phần và tiếp tục thu ở các lần sau.
            </Typography>
          </Paper>
        </Box>
      )}

      {step === 1 && (
        <Stack spacing={2}>
          <Paper
            variant="outlined"
            sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2, bgcolor: "primary.light" }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
              gap={1.5}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="overline" color="primary.main" fontWeight={700}>
                  Học viên đang thu
                </Typography>
                <Typography variant="h6" fontWeight={800} noWrap title={selectedStudent?.fullName || student?.name || "-"}>
                  {selectedStudent?.fullName || student?.name || "-"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedStudent?.code || student?.code || "-"}
                </Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={() => setStep(0)}
                sx={{ flexShrink: 0 }}
              >
                Đổi học viên
              </Button>
            </Stack>
          </Paper>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 320px" },
              gap: 2,
              alignItems: "start",
            }}
          >
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 2, minWidth: 0 }}>
              <Stack spacing={2.5}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  gap={1}
                >
                  <Box>
                    <Typography variant="h6" fontWeight={800}>
                      Khoản học phí cần thu
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Nhập số tiền nhỏ hơn số còn nợ nếu muốn thanh toán từng phần.
                    </Typography>
                  </Box>
                  {!showMultipleFees && selectedFee && (
                    <Button size="small" variant="outlined" onClick={() => setShowMultipleFees(true)}>
                      Thu nhiều khoản
                    </Button>
                  )}
                </Stack>

                {!showMultipleFees && selectedFee && (
                  <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderColor: "primary.main", borderWidth: 1.5, borderRadius: 2 }}>
                    <Stack spacing={2.25}>
                      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                            <Typography variant="subtitle1" fontWeight={800}>{selectedFee.feeNo}</Typography>
                            <Chip
                              size="small"
                              color={feeStatusColors[selectedFee.status] || "warning"}
                              label={feeStatusLabels[selectedFee.status] || selectedFee.status}
                            />
                          </Stack>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {selectedFee.class?.name || "Chưa có lớp"}
                            {selectedFee.dueDate
                              ? ` · Hạn ${new Date(selectedFee.dueDate).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`
                              : ""}
                          </Typography>
                        </Box>
                      </Stack>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
                          gap: 1,
                        }}
                      >
                        {[
                          ["Tổng phải thu", money(Number(selectedFee.finalAmount)), "text.primary"],
                          ["Đã thu", money(Number(selectedFee.paidAmount ?? 0)), "text.primary"],
                          ["Còn nợ", money(getRemaining(selectedFee)), "warning.main"],
                        ].map(([label, value, color]) => (
                          <Box key={label} sx={{ p: 1.25, borderRadius: 1.5, bgcolor: "action.hover" }}>
                            <Typography variant="caption" color="text.secondary">{label}</Typography>
                            <Typography fontWeight={800} color={color}>{value}</Typography>
                          </Box>
                        ))}
                      </Box>
                      <CurrencyInput
                        label="Số tiền thu lần này"
                        value={getAmount(selectedFee)}
                        onChange={(value) => setAmounts((current) => ({ ...current, [selectedFee.id]: value }))}
                        error={getAmountError(selectedFee) || undefined}
                        helperText="Mặc định là toàn bộ số tiền còn nợ."
                      />
                    </Stack>
                  </Paper>
                )}

                {showMultipleFees && (
                  <>
                    <Alert
                      severity="info"
                      action={
                        <Button
                          color="inherit"
                          size="small"
                          onClick={() => {
                            const feeToKeep = selectedFee ?? fees.find((fee) => !fee.paymentAllocations?.length);
                            setShowMultipleFees(false);
                            setSelectedIds(feeToKeep ? [feeToKeep.id] : []);
                          }}
                        >
                          Thu một khoản
                        </Button>
                      }
                    >
                      Chọn nhiều khoản và nhập số tiền riêng cho từng khoản.
                    </Alert>
                    <Stack spacing={1}>
                      {fees.map((fee) => {
                        const locked = Boolean(fee.paymentAllocations?.length);
                        const batchNo = fee.paymentAllocations?.[0]?.paymentBatch.batchNo;
                        const selected = selectedIds.includes(fee.id);
                        return (
                          <Paper
                            key={fee.id}
                            variant="outlined"
                            sx={{
                              p: { xs: 1.25, sm: 1.5 },
                              borderColor: selected ? "primary.main" : "divider",
                              bgcolor: selected ? "primary.light" : "background.paper",
                              opacity: locked ? 0.65 : 1,
                              borderRadius: 1.5,
                            }}
                          >
                            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1.5}>
                              <FormControlLabel
                                sx={{ alignItems: "flex-start", m: 0, minWidth: 0, flex: 1 }}
                                control={
                                  <Checkbox
                                    sx={{ pt: 0.5 }}
                                    disabled={locked}
                                    checked={selected}
                                    onChange={() => {
                                      setSelectedIds((current) => current.includes(fee.id) ? current.filter((id) => id !== fee.id) : [...current, fee.id]);
                                      setAmounts((current) => ({ ...current, [fee.id]: current[fee.id] ?? getRemaining(fee) }));
                                    }}
                                  />
                                }
                                label={
                                  <Box sx={{ minWidth: 0, pt: 0.25 }}>
                                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                                      <Typography fontWeight={700}>{fee.feeNo}</Typography>
                                      {!locked && <Chip size="small" color={feeStatusColors[fee.status] || "warning"} label={feeStatusLabels[fee.status] || fee.status} />}
                                    </Stack>
                                    <Typography variant="body2" color="text.secondary" noWrap title={fee.class?.name || "Chưa có lớp"}>
                                      {fee.class?.name || "Chưa có lớp"}
                                    </Typography>
                                    <Typography variant="caption" color={locked ? "warning.main" : "text.secondary"}>
                                      {locked ? `Đang chờ thanh toán trong đợt ${batchNo}` : `Còn nợ: ${money(getRemaining(fee))}`}
                                    </Typography>
                                  </Box>
                                }
                              />
                              {!locked && selected && (
                                <Box sx={{ width: { xs: "100%", md: 230 }, flexShrink: 0 }}>
                                  <CurrencyInput
                                    label="Số tiền lần này"
                                    value={getAmount(fee)}
                                    onChange={(value) => setAmounts((current) => ({ ...current, [fee.id]: value }))}
                                    error={getAmountError(fee) || undefined}
                                    helperText={`Còn nợ: ${money(getRemaining(fee))}`}
                                  />
                                </Box>
                              )}
                              {locked && fee.paymentAllocations?.[0]?.paymentBatch.id && (
                                <Button
                                  component={Link}
                                  href={`/admin/tuition-fees/payment-history/${fee.paymentAllocations[0].paymentBatch.id}`}
                                  size="small"
                                  variant="contained"
                                  color="warning"
                                  sx={{ alignSelf: { xs: "stretch", md: "center" }, flexShrink: 0 }}
                                >
                                  Xử lý đợt thu
                                </Button>
                              )}
                            </Stack>
                          </Paper>
                        );
                      })}
                    </Stack>
                  </>
                )}
              </Stack>
            </Paper>

            <Paper
              variant="outlined"
              sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2, position: { lg: "sticky" }, top: { lg: 88 } }}
            >
              <Typography variant="subtitle1" fontWeight={800}>
                Tóm tắt lượt thu
              </Typography>
              <Stack spacing={1.25} sx={{ mt: 2 }}>
                <Stack direction="row" justifyContent="space-between" gap={2}>
                  <Typography variant="body2" color="text.secondary">Số khoản</Typography>
                  <Typography fontWeight={700}>{selectedFees.length}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" gap={2}>
                  <Typography variant="body2" color="text.secondary">Tổng tiền lần này</Typography>
                  <Typography variant="h6" color="primary.main" fontWeight={800}>{money(total)}</Typography>
                </Stack>
                <Divider />
                <Typography variant="caption" color="text.secondary">
                  Số tiền còn lại sau lượt thu: {money(Math.max(0, selectedFees.reduce((sum, fee) => sum + getRemaining(fee), 0) - total))}
                </Typography>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={() => setStep(2)}
                  disabled={!selectedIds.length || hasInvalidAmount}
                  sx={{ mt: 0.5 }}
                >
                  Tiếp tục chọn phương thức
                </Button>
              </Stack>
            </Paper>
          </Box>
        </Stack>
      )}

      {step === 2 && (
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2 }}>
            <Typography variant="h6" fontWeight={800}>Xác nhận thông tin thanh toán</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Kiểm tra lại số tiền và chọn phương thức trước khi ghi nhận.
            </Typography>
          </Paper>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 320px" },
              gap: 2,
              alignItems: "start",
            }}
          >
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 2, minWidth: 0 }}>
              <Stack spacing={2.25}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={800}>Phương thức thanh toán</Typography>
                  <Typography variant="body2" color="text.secondary">Chọn một phương thức để tiếp tục.</Typography>
                </Box>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" }, gap: 1.25 }}>
                  {[
                    { value: "CASH", label: "Tiền mặt", description: "Ghi nhận hoàn tất ngay" },
                    { value: "BANK_TRANSFER", label: "Chuyển khoản / VietQR", description: "Chờ đối soát giao dịch" },
                  ].map((option) => (
                    <Button
                      key={option.value}
                      variant={method === option.value ? "contained" : "outlined"}
                      onClick={() => {
                        setMethod(option.value);
                        setBankAccountError("");
                        if (option.value === "CASH") {
                          setBankAccountId("");
                          setTransactionReference("");
                        }
                      }}
                      sx={{ minHeight: 76, justifyContent: "flex-start", alignItems: "flex-start", textAlign: "left", flexDirection: "column", px: 2 }}
                    >
                      <Typography fontWeight={800}>{option.label}</Typography>
                      <Typography variant="caption" sx={{ opacity: 0.8, mt: 0.25 }}>{option.description}</Typography>
                    </Button>
                  ))}
                </Box>
                {method === "CASH" && (
                  <DatePickerField
                    label="Ngày nhận tiền"
                    value={cashPaymentDate}
                    onChange={setCashPaymentDate}
                    textFieldProps={{
                      required: true,
                      error: !cashPaymentDate,
                      helperText: !cashPaymentDate ? "Ngày nhận tiền là bắt buộc" : undefined,
                    }}
                  />
                )}
                {method === "BANK_TRANSFER" && (
                  <>
                    {bankAccountsError && (
                      <Alert
                        severity="error"
                        action={
                          <Button color="inherit" size="small" onClick={() => void loadBankAccounts()} disabled={bankAccountsLoading}>
                            Thử lại
                          </Button>
                        }
                      >
                        {bankAccountsError}
                      </Alert>
                    )}
                    <FormControl fullWidth required disabled={bankAccountsLoading}>
                      <InputLabel id="bank-account-label">Tài khoản nhận tiền</InputLabel>
                      <Select
                        labelId="bank-account-label"
                        label="Tài khoản nhận tiền"
                        value={bankAccountId}
                        onChange={(event) => {
                          setBankAccountId(event.target.value);
                          setBankAccountError("");
                        }}
                        error={Boolean(bankAccountError)}
                      >
                        <MenuItem value="">
                          {bankAccountsLoading ? <LoadingState label="Đang tải tài khoản..." inline size={16} /> : "Chọn tài khoản nhận tiền"}
                        </MenuItem>
                        {!bankAccountsLoading && !bankAccountsError && !bankAccounts.length && (
                          <MenuItem value="" disabled>Chưa cấu hình tài khoản nhận tiền</MenuItem>
                        )}
                        {bankAccounts.map((account) => (
                          <MenuItem key={account.id} value={account.id}>
                            {account.bankName} — {account.accountNo} — {account.accountName}
                          </MenuItem>
                        ))}
                      </Select>
                      <FormHelperText error={Boolean(bankAccountError)}>
                        {bankAccountError || "Chỉ chọn tài khoản đang hoạt động của trung tâm"}
                      </FormHelperText>
                    </FormControl>
                  </>
                )}
                <Accordion disableGutters variant="outlined">
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>
                      Thông tin bổ sung <Typography component="span" color="text.secondary" variant="body2">(không bắt buộc)</Typography>
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={2}>
                      <AppTextField
                        fullWidth
                        label="Người nộp"
                        value={payerName}
                        onChange={(event) => setPayerName(event.target.value)}
                      />
                      {method === "BANK_TRANSFER" && (
                        <AppTextField
                          fullWidth
                          label="Mã giao dịch (nếu có)"
                          value={transactionReference}
                          onChange={(event) => setTransactionReference(event.target.value)}
                        />
                      )}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2, position: { lg: "sticky" }, top: { lg: 88 } }}>
              <Typography variant="subtitle1" fontWeight={800}>Tóm tắt thanh toán</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }} noWrap>
                {selectedStudent?.fullName || student?.name || "-"}
              </Typography>
              <Stack spacing={1} sx={{ mt: 2 }}>
                {selectedFees.map((fee) => (
                  <Stack key={fee.id} direction="row" justifyContent="space-between" gap={1}>
                    <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>{fee.feeNo}</Typography>
                    <Typography variant="body2" fontWeight={700} sx={{ flexShrink: 0 }}>{money(getAmount(fee))}</Typography>
                  </Stack>
                ))}
              </Stack>
              <Divider sx={{ my: 1.5 }} />
              <Stack direction="row" justifyContent="space-between" gap={1}>
                <Typography fontWeight={700}>Tổng thanh toán</Typography>
                <Typography variant="h6" color="primary.main" fontWeight={800}>{money(total)}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" gap={1} sx={{ mt: 2 }}>
                <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => setStep(1)}>
                  Quay lại
                </Button>
                <Button variant="contained" onClick={requestPaymentConfirmation} disabled={loading || qrLoading}>
                  {loading ? <CircularProgress size={20} color="inherit" /> : "Xác nhận"}
                </Button>
              </Stack>
            </Paper>
          </Box>
        </Stack>
      )}

      {step === 3 && (
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 4 }, borderRadius: 2, maxWidth: 960, width: "100%", mx: "auto" }}>
          <Stack spacing={2.25} alignItems="center" textAlign="center">
            <Chip color={pendingBatch ? "warning" : "success"} label={pendingBatch ? "Đang chờ đối soát" : "Thanh toán thành công"} />
            <Box>
              <Typography variant="h5" fontWeight={800}>
                {pendingBatch ? `Mã đợt thanh toán: ${pendingBatch.batchNo}` : "Đã ghi nhận toàn bộ khoản đã chọn"}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                {pendingBatch ? "Hoàn tất chuyển khoản để hệ thống đối soát và phát hành biên lai." : "Giao dịch đã hoàn tất và có thể xuất biên lai."}
              </Typography>
            </Box>
            {pendingBatch && (
              <Stack spacing={2} sx={{ width: "100%" }}>
                <Alert severity="info" sx={{ textAlign: "left" }}>
                  Đây là phiếu báo thanh toán, chưa phải biên lai. Chỉ chuyển đúng số tiền và nội dung bên dưới.
                </Alert>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 420px" }, gap: 2, alignItems: "start" }}>
                  <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, textAlign: "left", minWidth: 0, borderRadius: 2, bgcolor: "background.default" }}>
                    <Typography variant="overline" color="text.secondary" fontWeight={800} letterSpacing={1}>Thông tin chuyển khoản</Typography>
                    <Stack spacing={2} sx={{ mt: 1.5 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={700}>NGÂN HÀNG</Typography>
                        <Typography fontWeight={700} sx={{ overflowWrap: "anywhere" }}>{pendingBatch.account.bankName || "-"}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={700}>SỐ TÀI KHOẢN</Typography>
                        <Typography variant="h6" color="primary.main" fontWeight={800} sx={{ lineHeight: 1.25, overflowWrap: "anywhere" }}>{pendingBatch.account.accountNo || "-"}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={700}>
                          CHỦ TÀI KHOẢN
                        </Typography>
                        <Typography
                          color="error.main"
                          sx={{ fontSize: { xs: "1.15rem", md: "1.35rem" }, fontWeight: 900, lineHeight: 1.25, overflowWrap: "anywhere" }}
                        >
                          {pendingBatch.account.accountName || "-"}
                        </Typography>
                      </Box>
                      <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: "background.paper", border: 1, borderColor: "divider" }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={700}>SỐ TIỀN CẦN CHUYỂN</Typography>
                        <Typography variant="h6" color="error.main" fontWeight={900}>{money(pendingBatch.amount)}</Typography>
                        <Typography variant="caption" color="text.secondary" fontWeight={700} component="div" sx={{ mt: 1.25 }}>NỘI DUNG CHUYỂN KHOẢN</Typography>
                        <Typography fontWeight={800} sx={{ overflowWrap: "anywhere" }}>{pendingTransferContent}</Typography>
                      </Box>
                    </Stack>
                  </Paper>
                  <Paper variant="outlined" sx={{ p: 2, display: "grid", placeItems: "center", minHeight: 444, alignContent: "center", gap: 1.5, borderRadius: 2 }}>
                    <Typography variant="overline" color="text.secondary" fontWeight={800} letterSpacing={1}>Quét mã thanh toán</Typography>
                    {qrError && (
                      <Alert severity="error" sx={{ width: "100%" }} action={<Button color="inherit" size="small" onClick={() => void loadPendingQr(pendingBatch)} disabled={qrLoading}>Thử lại</Button>}>
                        {qrError}
                      </Alert>
                    )}
                    {qrLoading ? (
                      <LoadingState label="Đang tạo mã QR thanh toán..." minHeight={240} />
                    ) : qrCardData ? (
                      <VietQrCard data={qrCardData} />
                    ) : null}
                    {pendingBatch.qrDataUrl && (
                      <Typography variant="caption" color="text.secondary" textAlign="center">
                        Quét mã QR để chuyển khoản đúng số tiền
                      </Typography>
                    )}
                  </Paper>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Nếu số tiền hoặc khoản phí thay đổi, hãy tạo lại đợt thanh toán và QR mới.
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap>
                  <Button variant="outlined" startIcon={<ContentCopyOutlinedIcon />} onClick={() => void copyTransferContent()}>Sao chép nội dung</Button>
                  {pendingBatch.qrDataUrl && (
                    <Button variant="outlined" startIcon={<DownloadOutlinedIcon />} disabled={!qrCardData} onClick={() => void downloadQrCard()}>Tải QR</Button>
                  )}
                  <Button variant="outlined" href={`/api/payment-batches/${pendingBatch.id}/notice/pdf`} startIcon={<DownloadOutlinedIcon />}>Tải thông báo PDF</Button>
                  <Button variant="contained" href={`/api/payment-batches/${pendingBatch.id}/notice/pdf?inline=1`} target="_blank" rel="noopener noreferrer" startIcon={<PrintOutlinedIcon />}>Mở để in</Button>
                  <Button variant="outlined" color="warning" onClick={() => { setCashPaymentDate(getVietnamDate()); setCashNote(""); setCashDialogOpen(true); }}>Đổi sang tiền mặt</Button>
                </Stack>
              </Stack>
            )}
            {receiptId && (
              <Button
                variant="outlined"
                onClick={() => window.open(`/api/payment-batch-receipts/${receiptId}/pdf`, "_blank", "noopener,noreferrer")}
              >
                Xuất biên lai tổng
              </Button>
            )}
            {completedBatchId && (
              <Button
                component={Link}
                variant="outlined"
                color="error"
                href={`/admin/tuition-fees/payment-history/${completedBatchId}`}
              >
                Xử lý nếu ghi nhận nhầm
              </Button>
            )}
            {!pendingBatch && (
              <Alert severity="success" sx={{ width: "100%", textAlign: "left" }}>
                Thanh toán đã hoàn tất và biên lai đã được phát hành. Vui lòng xuất hoặc in biên lai để lưu hồ sơ.
              </Alert>
            )}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="center" sx={{ width: "100%" }}>
              {!pendingBatch && <Button variant="contained" onClick={continueWithSameStudent}>Thu tiếp cho học viên này</Button>}
              <Button variant="outlined" onClick={startNewPayment}>Thu học phí cho học viên khác</Button>
            </Stack>
          </Stack>
        </Paper>
      )}
      <StudentSelectDialog
        open={studentDialog.open}
        onClose={studentDialog.onClose}
        onSelect={selectStudent}
        title="Chọn học viên để thu học phí"
      />
      <ConfirmDialog
        open={confirmOpen}
        title="Xác nhận thu học phí"
        message="Bạn có chắc muốn ghi nhận số tiền thanh toán đã nhập? Thao tác này sẽ tạo giao dịch; thanh toán tiền mặt hoàn tất ngay, còn chuyển khoản sẽ chờ đối soát."
        content={
          <Stack spacing={0.5} sx={{ mt: 2 }}>
            <Typography variant="body2">
              Học viên: <strong>{selectedStudent?.fullName || "-"}</strong>
            </Typography>
            <Typography variant="body2">
              Số khoản: <strong>{selectedFees.length}</strong>
            </Typography>
            <Typography variant="body2">
              Tổng tiền lần này: <strong>{money(total)}</strong>
            </Typography>
            <Typography variant="body2">
              Phương thức: <strong>{method === "CASH" ? "Tiền mặt" : "Chuyển khoản / VietQR"}</strong>
            </Typography>
            {method === "CASH" && (
              <Typography variant="body2">
                Ngày nhận tiền: <strong>{cashPaymentDate || "-"}</strong>
              </Typography>
            )}
          </Stack>
        }
        onConfirm={() => void submitPayment()}
        onCancel={() => setConfirmOpen(false)}
        isLoading={loading}
        confirmLabel="Ghi nhận thanh toán"
        cancelLabel="Quay lại"
        confirmColor="primary"
      />
      <ConfirmDialog
        open={cashDialogOpen}
        title="Đổi sang thanh toán tiền mặt"
        message={
          pendingBatch
            ? `Xác nhận đã nhận ${money(pendingBatch.amount)} tiền mặt từ ${selectedStudent?.fullName || "học viên"}? Hệ thống sẽ hoàn tất toàn bộ đợt ${pendingBatch.batchNo} và phát hành biên lai.`
            : ""
        }
        content={
          <Stack spacing={2} sx={{ mt: 2 }}>
            <DatePickerField
              label="Ngày nhận tiền"
              value={cashPaymentDate}
              onChange={setCashPaymentDate}
              textFieldProps={{
                required: true,
                error: !cashPaymentDate,
                helperText: !cashPaymentDate ? "Ngày nhận tiền là bắt buộc" : undefined,
              }}
            />
            <AppTextField
              fullWidth
              multiline
              minRows={2}
              label="Ghi chú (nếu có)"
              value={cashNote}
              onChange={(event) => setCashNote(event.target.value)}
              inputProps={{ maxLength: 500 }}
            />
          </Stack>
        }
        onConfirm={() => void convertPendingBatchToCash()}
        onCancel={() => setCashDialogOpen(false)}
        isLoading={loading}
        confirmLabel="Xác nhận tiền mặt"
        cancelLabel="Quay lại"
        confirmColor="warning"
      />
      <ConfirmDialog
        open={newPaymentConfirmOpen}
        title="Bắt đầu lượt thu mới?"
        message={`Đợt ${pendingBatch?.batchNo || "thanh toán"} vẫn đang chờ đối soát. Nếu tiếp tục, màn hình QR và thao tác xử lý đợt này sẽ được đóng.`}
        onConfirm={() => {
          setNewPaymentConfirmOpen(false);
          reset();
        }}
        onCancel={() => setNewPaymentConfirmOpen(false)}
        confirmLabel="Tiếp tục lượt mới"
        cancelLabel="Ở lại xử lý đợt thu"
        confirmColor="warning"
      />
      {Snackbar}
    </Stack>
  );
}
