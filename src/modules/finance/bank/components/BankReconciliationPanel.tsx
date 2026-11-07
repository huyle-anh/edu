"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  FormControl,
  InputAdornment,
  InputLabel,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableContainer,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/shared/dialogs/ConfirmDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import DoneAllOutlinedIcon from "@mui/icons-material/DoneAllOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import ClearOutlinedIcon from "@mui/icons-material/ClearOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import { useSnackbar } from "@/hooks/useSnackbar";
import { LoadingState } from "@/components/shared/feedback/LoadingState";

type Account = {
  id: string;
  bankName: string;
  accountNo: string;
  accountName: string;
};
type Batch = {
  id: string;
  batchNo: string;
  totalAmount: number;
  student: { id: string; code: string; fullName: string };
  allocations: Array<{
    tuitionFeeId: string;
    amount: number;
    tuitionFee: { feeNo: string; class: { name: string } };
  }>;
};
type BatchGroup = {
  batchIds: string[];
  totalAmount: number;
  batches: Batch[];
  confirmationToken: string;
};
type Transaction = {
  confirmationToken: string;
  rowNo: number;
  transactionDate: string;
  bankTransactionNo: string | null;
  description: string;
  reconciliationContent: string;
  creditAmount: number;
  debitAmount: number;
  balanceAmount: number | null;
  reconciliationStatus: string;
  paymentBatch?: Batch | null;
  paymentBatchCandidates: Array<Batch & { confirmationToken: string }>;
  paymentBatchGroupCandidates: BatchGroup[];
};
type ImportResult = {
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicatedRows: number;
  matchedRows: number;
  unmatchedRows: number;
  ignoredRows: number;
  invalidRowErrors: Array<{ rowNo: number; message: string }>;
  statement: {
    bankFormat: "BIDV" | "TECHCOMBANK";
    fromDate: string | null;
    toDate: string | null;
    accountNo: string | null;
    accountName: string | null;
    currencyCode: string | null;
    openingBalance: number | null;
    closingBalance: number | null;
  };
  items: Transaction[];
};
type PendingConfirmation = {
  body: { confirmationToken: string; batchId?: string; batchIds?: string[] };
  itemToken: string;
  title: string;
  message: string;
};
type ResultFilter =
  | "ALL"
  | "AUTO_MATCHED"
  | "UNMATCHED"
  | "IGNORED"
  | "DUPLICATED"
  | "CONFIRMED";

const money = (value: number) =>
  new Intl.NumberFormat("vi-VN").format(Number(value));
const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
const formatTransactionDate = (value: string) => {
  const date = new Date(value);
  const datePart = date.toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${datePart} ${timePart}`;
};
const steps = ["Chọn tài khoản và file", "Phân tích", "Đối soát"];
const reconciliationLabels: Record<string, string> = {
  AUTO_MATCHED: "Tự động khớp",
  UNMATCHED: "Chưa khớp",
  IGNORED: "Bỏ qua",
  DUPLICATED: "Trùng giao dịch",
  CONFIRMED: "Đã xác nhận",
};
const reconciliationColors: Record<
  string,
  "default" | "warning" | "info" | "success"
> = {
  AUTO_MATCHED: "info",
  UNMATCHED: "warning",
  IGNORED: "default",
  DUPLICATED: "warning",
  CONFIRMED: "success",
};

export function BankReconciliationPanel() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState(0);
  const [items, setItems] = useState<Transaction[]>([]);
  const [importedFileName, setImportedFileName] = useState("");
  const [importedStatementPeriod, setImportedStatementPeriod] = useState("");
  const [confirmedTokens, setConfirmedTokens] = useState<Set<string>>(
    () => new Set(),
  );
  const [message, setMessage] = useState<{
    text: string;
    severity: "success" | "error" | "info";
  }>({ text: "", severity: "info" });
  const [loading, setLoading] = useState(false);
  const [hasAnalysis, setHasAnalysis] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation | null>(null);
  const [bulkConfirmationOpen, setBulkConfirmationOpen] = useState(false);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountError, setAccountError] = useState("");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [drawerStudentSearchTerm, setDrawerStudentSearchTerm] = useState("");
  const [candidateView, setCandidateView] = useState<"SINGLE" | "GROUP">(
    "SINGLE",
  );
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const { showSuccess, Snackbar } = useSnackbar();

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    setAccountError("");
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
      const data = await unwrapApiResponse<Account[]>(response);
      setAccounts(data);
      setAccountId((current) =>
        data.some((account) => account.id === current)
          ? current
          : data[0]?.id || "",
      );
    } catch (reason) {
      setAccountError(
        reason instanceof Error
          ? reason.message
          : "Không thể tải tài khoản ngân hàng",
      );
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    setDrawerStudentSearchTerm("");
    const item = items.find(
      (candidate) => candidate.confirmationToken === selectedToken,
    );
    setCandidateView(item?.paymentBatchCandidates.length ? "SINGLE" : "GROUP");
  }, [items, selectedToken]);

  const displayedItems = useMemo(
    () =>
      items.map((item) =>
        confirmedTokens.has(item.confirmationToken)
          ? { ...item, reconciliationStatus: "CONFIRMED" }
          : item,
      ),
    [confirmedTokens, items],
  );

  const filteredItems = useMemo(
    () =>
      resultFilter === "ALL"
        ? displayedItems
        : displayedItems.filter(
            (item) => item.reconciliationStatus === resultFilter,
          ),
    [displayedItems, resultFilter],
  );

  const searchedItems = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase("vi-VN");
    if (!normalizedSearchTerm) return filteredItems;

    return filteredItems.filter((item) => {
      const searchableContent = [
        item.rowNo,
        item.transactionDate,
        item.paymentBatch?.student.fullName,
        item.paymentBatch?.student.code,
        item.paymentBatch?.batchNo,
        ...item.paymentBatchCandidates.map(
          (candidate) => candidate.student.fullName,
        ),
        ...item.paymentBatchCandidates.map(
          (candidate) => candidate.student.code,
        ),
        ...item.paymentBatchCandidates.map((candidate) => candidate.batchNo),
        ...item.paymentBatchGroupCandidates.flatMap((group) =>
          group.batches.flatMap((batch) => [
            batch.student.fullName,
            batch.student.code,
            batch.batchNo,
          ]),
        ),
        item.bankTransactionNo,
        item.description,
        item.reconciliationContent,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("vi-VN");
      return searchableContent.includes(normalizedSearchTerm);
    });
  }, [filteredItems, searchTerm]);

  const selectedItem = useMemo(
    () =>
      searchedItems.find((item) => item.confirmationToken === selectedToken) ||
      null,
    [searchedItems, selectedToken],
  );

  const selectedClassNames = useMemo(() => {
    if (!selectedItem) return [];
    const allocations = [
      ...(selectedItem.paymentBatch?.allocations || []),
      ...selectedItem.paymentBatchCandidates.flatMap(
        (candidate) => candidate.allocations,
      ),
      ...selectedItem.paymentBatchGroupCandidates.flatMap((group) =>
        group.batches.flatMap((batch) => batch.allocations),
      ),
    ];
    return [
      ...new Set(
        allocations.map((allocation) => allocation.tuitionFee.class.name),
      ),
    ];
  }, [selectedItem]);

  const filteredDrawerCandidates = useMemo(() => {
    const candidates = selectedItem?.paymentBatchCandidates || [];
    const normalizedSearch = drawerStudentSearchTerm
      .trim()
      .toLocaleLowerCase("vi-VN");
    if (!normalizedSearch) return candidates;
    return candidates.filter((candidate) =>
      candidate.student.fullName
        .toLocaleLowerCase("vi-VN")
        .includes(normalizedSearch),
    );
  }, [drawerStudentSearchTerm, selectedItem]);

  const filteredDrawerGroupCandidates = useMemo(() => {
    const candidates = selectedItem?.paymentBatchGroupCandidates || [];
    const normalizedSearch = drawerStudentSearchTerm
      .trim()
      .toLocaleLowerCase("vi-VN");
    if (!normalizedSearch) return candidates;
    return candidates.filter((candidate) =>
      candidate.batches.some((batch) =>
        `${batch.student.fullName} ${batch.batchNo}`
          .toLocaleLowerCase("vi-VN")
          .includes(normalizedSearch),
      ),
    );
  }, [drawerStudentSearchTerm, selectedItem]);

  const summary = useMemo(
    () =>
      displayedItems.reduce(
        (result, item) => {
          result.total += 1;
          result.creditAmount += item.creditAmount;
          if (item.reconciliationStatus === "AUTO_MATCHED") result.matched += 1;
          if (item.reconciliationStatus === "UNMATCHED") result.unmatched += 1;
          if (item.reconciliationStatus === "IGNORED") result.ignored += 1;
          if (item.reconciliationStatus === "DUPLICATED")
            result.duplicated += 1;
          if (item.reconciliationStatus === "CONFIRMED") result.confirmed += 1;
          return result;
        },
        {
          total: 0,
          matched: 0,
          unmatched: 0,
          ignored: 0,
          duplicated: 0,
          confirmed: 0,
          creditAmount: 0,
        },
      ),
    [displayedItems],
  );
  const autoMatchedItems = useMemo(
    () =>
      displayedItems.filter(
        (item) =>
          item.reconciliationStatus === "AUTO_MATCHED" &&
          item.paymentBatch !== null,
      ),
    [displayedItems],
  );

  function inspectFile(nextFile: File | null) {
    setFile(nextFile);
    if (nextFile) setStep(1);
  }

  function clearFileSelection() {
    setFile(null);
    setStep(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function resetSession() {
    clearFileSelection();
    setItems([]);
    setImportedFileName("");
    setImportedStatementPeriod("");
    setConfirmedTokens(new Set());
    setHasAnalysis(false);
    setPendingConfirmation(null);
    setResultFilter("ALL");
    setSearchTerm("");
    setSelectedToken(null);
    setStep(0);
    setMessage({ text: "", severity: "info" });
    setResetDialogOpen(false);
  }

  async function importFile() {
    if (!file || !accountId) {
      setMessage({
        text: "Chọn tài khoản ngân hàng và file Excel sao kê",
        severity: "error",
      });
      return;
    }
    setLoading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("bankAccountId", accountId);
    try {
      const response = await fetch("/api/bank-statement-imports", {
        method: "POST",
        body: form,
      });
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(response, "Không thể phân tích sao kê"),
        );
      const result = await unwrapApiResponse<ImportResult>(response);
      window.dispatchEvent(new Event("bank-reconciliation-sessions-updated"));
      setItems(result.items);
      setImportedFileName(result.fileName);
      setImportedStatementPeriod(
        [result.statement.fromDate, result.statement.toDate]
          .filter(Boolean)
          .join(" – "),
      );
      setHasAnalysis(true);
      setResultFilter("ALL");
      setSearchTerm("");
      setSelectedToken(null);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setStep(2);
      setMessage({
        text: `Đã phân tích ${result.totalRows} dòng: hợp lệ ${result.validRows}, lỗi ${result.invalidRows}. Khớp ${result.matchedRows}, chưa khớp ${result.unmatchedRows}, bỏ qua ${result.ignoredRows}, trùng ${result.duplicatedRows}. Phiên đối soát đã được lưu vào lịch sử.`,
        severity: "success",
      });
    } catch (reason) {
      setMessage({
        text:
          reason instanceof Error
            ? reason.message
            : "Không thể phân tích sao kê",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  function requestConfirm(
    item: Transaction,
    selection: { batchId?: string; batchIds?: string[] },
    title: string,
    message: string,
    confirmationToken = item.confirmationToken,
  ) {
    setPendingConfirmation({
      body: { confirmationToken, ...selection },
      itemToken: item.confirmationToken,
      title,
      message,
    });
  }

  async function confirm() {
    if (!pendingConfirmation) return;
    setLoading(true);
    try {
      const response = await fetch("/api/bank-reconciliations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingConfirmation.body),
      });
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(response, "Không thể xác nhận đối soát"),
        );
      await unwrapApiResponse(response);
      const token = pendingConfirmation.itemToken;
      setConfirmedTokens((current) => new Set(current).add(token));
      showSuccess("Đã xác nhận đối soát và tạo thanh toán/biên lai");
      window.dispatchEvent(new Event("bank-reconciliation-sessions-updated"));
      setPendingConfirmation(null);
    } catch (reason) {
      setMessage({
        text:
          reason instanceof Error
            ? reason.message
            : "Không thể xác nhận đối soát",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function confirmAllAutoMatched() {
    const confirmations = autoMatchedItems.map((item) => ({
      confirmationToken: item.confirmationToken,
      batchId: item.paymentBatch!.id,
    }));
    if (!confirmations.length) return;

    setLoading(true);
    try {
      const response = await fetch("/api/bank-reconciliations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmations }),
      });
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(
            response,
            "Không thể xác nhận các giao dịch khớp tự động",
          ),
        );
      await unwrapApiResponse(response);
      setConfirmedTokens(
        (current) =>
          new Set([
            ...current,
            ...autoMatchedItems.map((item) => item.confirmationToken),
          ]),
      );
      setBulkConfirmationOpen(false);
      showSuccess(`Đã xác nhận ${confirmations.length} giao dịch khớp tự động`);
      window.dispatchEvent(new Event("bank-reconciliation-sessions-updated"));
    } catch (reason) {
      setMessage({
        text:
          reason instanceof Error
            ? reason.message
            : "Không thể xác nhận các giao dịch khớp tự động",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack spacing={{ xs: 2, md: 3 }} sx={{ width: "100%", minWidth: 0 }}>
      <PageHeader
        title="Đối soát ngân hàng"
        description="Nhập sao kê, kiểm tra giao dịch khớp và xác nhận khoản thu. Chỉ giao dịch được xác nhận mới tạo thanh toán và biên lai."
        actions={
          hasAnalysis ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshOutlinedIcon />}
              onClick={() => setResetDialogOpen(true)}
              disabled={loading}
            >
              Phiên mới
            </Button>
          ) : undefined
        }
      />
      {!hasAnalysis && (
        <Paper
          sx={{
            width: "100%",
            minWidth: 0,
            boxSizing: "border-box",
            p: { xs: 1, sm: 1.5 },
          }}
        >
          <Stepper
            activeStep={step}
            alternativeLabel
            sx={{
              width: "100%",
              minWidth: 0,
              "& .MuiStep-root": { minWidth: 0, px: 0.25 },
              "& .MuiStepLabel-label": {
                fontSize: { xs: "0.7rem", sm: "0.875rem" },
                overflowWrap: "anywhere",
              },
            }}
          >
            {steps.map((label) => (
              <Step key={label} sx={{ minWidth: 0 }}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Paper>
      )}
      {!hasAnalysis ? (
        <Paper
          sx={{
            width: "100%",
            minWidth: 0,
            boxSizing: "border-box",
            p: { xs: 1.5, md: 2 },
          }}
        >
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>
                Bước 1 · Chọn nguồn sao kê
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Chọn tài khoản nhận tiền và file Excel cần phân tích.
              </Typography>
            </Box>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              alignItems={{ xs: "stretch", md: "center" }}
            >
              <FormControl fullWidth sx={{ minWidth: { md: 300 }, flex: 1 }}>
                <InputLabel id="reconciliation-bank-account-label">
                  Tài khoản nhận
                </InputLabel>
                <Select
                  labelId="reconciliation-bank-account-label"
                  value={accountId}
                  label="Tài khoản nhận"
                  onChange={(event) => setAccountId(event.target.value)}
                  disabled={
                    accountsLoading ||
                    !accounts.length ||
                    loading ||
                    items.length > 0
                  }
                >
                  {accounts.map((account) => (
                    <MenuItem key={account.id} value={account.id}>
                      {account.bankName} — {account.accountNo}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                component="label"
                startIcon={<UploadFileOutlinedIcon />}
                disabled={loading || items.length > 0}
              >
                {file ? "Đổi file sao kê" : "Chọn file Excel sao kê"}
                <input
                  ref={fileInputRef}
                  hidden
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(event) =>
                    inspectFile(event.target.files?.[0] || null)
                  }
                />
              </Button>
            </Stack>
            {accountsLoading && (
              <LoadingState
                label="Đang tải tài khoản ngân hàng..."
                inline
                size={18}
              />
            )}
            {accountError && (
              <Alert
                severity="error"
                action={
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => void loadAccounts()}
                  >
                    Thử lại
                  </Button>
                }
              >
                {accountError}
              </Alert>
            )}
            {!accountsLoading && !accountError && !accounts.length && (
              <Alert severity="warning">
                Chưa có tài khoản ngân hàng đang hoạt động để đối soát.
              </Alert>
            )}
            {file && (
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                alignItems={{ xs: "stretch", md: "center" }}
                justifyContent="space-between"
              >
                <Box>
                  <Typography fontWeight={600} noWrap>
                    {file.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatFileSize(file.size)} · Sẵn sàng phân tích
                  </Typography>
                </Box>
                <Stack
                  direction={{ xs: "column-reverse", sm: "row" }}
                  spacing={1}
                >
                  <Button
                    variant="text"
                    onClick={clearFileSelection}
                    disabled={loading}
                  >
                    Bỏ chọn
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => void importFile()}
                    disabled={loading || !accountId}
                  >
                    {loading ? "Đang phân tích..." : "Phân tích sao kê"}
                  </Button>
                </Stack>
              </Stack>
            )}
            {loading && <LinearProgress />}
            {message.text && (
              <Alert severity={message.severity}>{message.text}</Alert>
            )}
          </Stack>
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ px: 2, py: 1.25 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={{ xs: 0.5, sm: 2 }}
            alignItems={{ sm: "center" }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={1} alignItems="center" minWidth={0}>
              <UploadFileOutlinedIcon color="primary" fontSize="small" />
              <Box minWidth={0}>
                <Typography variant="body2" fontWeight={700} noWrap>
                  {importedFileName}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {
                    accounts.find((account) => account.id === accountId)
                      ?.bankName
                  }{" "}
                  ·{" "}
                  {
                    accounts.find((account) => account.id === accountId)
                      ?.accountNo
                  }
                  {importedStatementPeriod
                    ? ` · ${importedStatementPeriod}`
                    : ""}
                </Typography>
              </Box>
            </Stack>
            <Chip
              size="small"
              color="info"
              variant="outlined"
              label={`${summary.total} giao dịch`}
            />
          </Stack>
        </Paper>
      )}
      <Paper
        sx={{
          width: "100%",
          minWidth: 0,
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ sm: "center" }}
          gap={1}
          sx={{
            p: { xs: 1.5, md: 2 },
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              {hasAnalysis ? "Giao dịch trong phiên" : "Kết quả đối soát"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {items.length
                ? `${items.length} dòng sao kê · ${money(summary.creditAmount)} VND ghi có`
                : hasAnalysis
                  ? "Không có giao dịch trong phiên"
                  : "Chưa có phiên phân tích"}
            </Typography>
          </Box>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ sm: "center" }}
          >
            {autoMatchedItems.length > 0 && (
              <Button
                size="small"
                variant="contained"
                color="success"
                startIcon={<DoneAllOutlinedIcon />}
                onClick={() => setBulkConfirmationOpen(true)}
                disabled={loading}
              >
                Xác nhận khớp tự động ({autoMatchedItems.length})
              </Button>
            )}
          </Stack>
        </Stack>
        {items.length > 0 && (
          <Stack spacing={1.5} sx={{ p: { xs: 1.5, md: 2 } }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "repeat(2, minmax(0, 1fr))",
                  md: "repeat(4, minmax(0, 1fr))",
                },
                gap: 1,
              }}
            >
              {[
                {
                  label: "Cần kiểm tra",
                  value: summary.unmatched,
                  color: "warning.main",
                },
                {
                  label: "Khớp tự động",
                  value: summary.matched,
                  color: "info.main",
                },
                {
                  label: "Đã xác nhận",
                  value: summary.confirmed,
                  color: "success.main",
                },
                {
                  label: "Bỏ qua / trùng",
                  value: summary.ignored + summary.duplicated,
                  color: "text.secondary",
                },
              ].map((metric) => (
                <Box
                  key={metric.label}
                  sx={{
                    p: 1.25,
                    borderRadius: 2,
                    bgcolor: "action.hover",
                    minWidth: 0,
                  }}
                >
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {metric.label}
                  </Typography>
                  <Typography
                    variant="h6"
                    fontWeight={800}
                    sx={{ color: metric.color, lineHeight: 1.2 }}
                  >
                    {metric.value}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1}
              alignItems={{ md: "center" }}
            >
              <TextField
                size="small"
                fullWidth
                label="Tìm giao dịch hoặc học viên"
                placeholder="Mã giao dịch, nội dung, mã đợt, tên/mã học viên..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlinedIcon fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: searchTerm ? (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        aria-label="Xóa tìm kiếm"
                        onClick={() => setSearchTerm("")}
                      >
                        <ClearOutlinedIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : undefined,
                }}
              />
              <FormControl
                size="small"
                sx={{ minWidth: { xs: "100%", md: 230 } }}
              >
                <InputLabel id="reconciliation-status-filter-label">
                  Trạng thái
                </InputLabel>
                <Select
                  labelId="reconciliation-status-filter-label"
                  value={resultFilter}
                  label="Trạng thái"
                  onChange={(event) =>
                    setResultFilter(event.target.value as ResultFilter)
                  }
                >
                  <MenuItem value="ALL">Tất cả ({summary.total})</MenuItem>
                  <MenuItem value="UNMATCHED">
                    Cần kiểm tra ({summary.unmatched})
                  </MenuItem>
                  <MenuItem value="AUTO_MATCHED">
                    Khớp tự động ({summary.matched})
                  </MenuItem>
                  <MenuItem value="CONFIRMED">
                    Đã xác nhận ({summary.confirmed})
                  </MenuItem>
                  <MenuItem value="IGNORED">
                    Bỏ qua ({summary.ignored})
                  </MenuItem>
                  <MenuItem value="DUPLICATED">
                    Trùng ({summary.duplicated})
                  </MenuItem>
                </Select>
              </FormControl>
            </Stack>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              justifyContent="space-between"
            >
              <Typography variant="body2" color="text.secondary">
                Tổng ghi có <strong>{money(summary.creditAmount)} VND</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Đang hiển thị <strong>{searchedItems.length}</strong>/
                {filteredItems.length} giao dịch
              </Typography>
            </Stack>
          </Stack>
        )}
        {items.length === 0 ? (
          <Box sx={{ p: { xs: 3, md: 5 }, textAlign: "center" }}>
            <Typography color="text.secondary">
              {!hasAnalysis
                ? "Chưa có dữ liệu phân tích trong phiên này"
                : "Đã xử lý hết giao dịch trong phiên này"}
            </Typography>
            {!hasAnalysis && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                Chọn file sao kê ở bước 1 để bắt đầu phân tích.
              </Typography>
            )}
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 640, overflowX: "auto" }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: { xs: "block", md: "none" }, px: 2, pt: 1.25 }}
            >
              Vuốt ngang để xem đầy đủ giao dịch và thao tác.
            </Typography>
            <Table
              size="small"
              stickyHeader
              sx={{
                minWidth: 900,
                "& tbody tr:nth-of-type(even)": { bgcolor: "action.hover" },
                "& th:last-of-type, & td:last-of-type": {
                  position: "sticky",
                  right: 0,
                  bgcolor: "background.paper",
                  boxShadow: "-4px 0 8px rgba(0, 0, 0, 0.04)",
                },
                "& th:last-of-type": { zIndex: 3 },
                "& td:last-of-type": { zIndex: 1 },
                "& tbody tr:nth-of-type(even) td:last-of-type": {
                  bgcolor: "action.hover",
                },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell>Ngày / dòng</TableCell>
                  <TableCell>Mã giao dịch</TableCell>
                  <TableCell>Nội dung</TableCell>
                  <TableCell>Học viên / đợt thu</TableCell>
                  <TableCell align="right">Số tiền</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell>Thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {searchedItems.map((item) => (
                  <TableRow
                    hover
                    selected={selectedToken === item.confirmationToken}
                    key={item.confirmationToken}
                  >
                    <TableCell sx={{ minWidth: 150, whiteSpace: "nowrap" }}>
                      <Typography variant="body2" fontWeight={700}>
                        {formatTransactionDate(item.transactionDate)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Dòng {item.rowNo}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ minWidth: 150, whiteSpace: "nowrap" }}>
                      {item.bankTransactionNo || "-"}
                    </TableCell>
                    <TableCell sx={{ minWidth: 220, maxWidth: 320 }}>
                      <Typography
                        variant="body2"
                        noWrap
                        title={item.description}
                      >
                        {item.description || "-"}
                      </Typography>
                      {item.reconciliationContent &&
                        item.reconciliationContent !== item.description && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                            title={item.reconciliationContent}
                          >
                            {item.reconciliationContent}
                          </Typography>
                        )}
                    </TableCell>
                    <TableCell sx={{ minWidth: 190, maxWidth: 250 }}>
                      {item.paymentBatch ? (
                        <Stack spacing={0.25}>
                          <Typography variant="body2" fontWeight={700} noWrap>
                            {item.paymentBatch.student.fullName}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                          >
                            {item.paymentBatch.batchNo} ·{" "}
                            {item.paymentBatch.student.code}
                          </Typography>
                        </Stack>
                      ) : item.paymentBatchCandidates.length ||
                        item.paymentBatchGroupCandidates.length ? (
                        <Stack spacing={0.25}>
                          <Typography variant="body2" fontWeight={700}>
                            {item.paymentBatchCandidates.length +
                              item.paymentBatchGroupCandidates.length}{" "}
                            ứng viên
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                          >
                            {item.paymentBatchCandidates[0]?.student.fullName ||
                              item.paymentBatchGroupCandidates[0]?.batches[0]
                                ?.student.fullName ||
                              "Có thể ghép nhiều đợt"}
                          </Typography>
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          {item.reconciliationStatus === "IGNORED"
                            ? "Giao dịch ghi nợ"
                            : item.reconciliationStatus === "DUPLICATED"
                              ? "Đã ghi nhận trước đó"
                              : "Chưa có đợt phù hợp"}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      <Typography
                        variant="body2"
                        fontWeight={800}
                        color={
                          item.creditAmount > 0
                            ? "success.main"
                            : "text.secondary"
                        }
                      >
                        {item.creditAmount > 0 ? "+" : "−"}
                        {money(item.creditAmount || item.debitAmount)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.creditAmount > 0 ? "Ghi có" : "Ghi nợ"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={
                          reconciliationColors[item.reconciliationStatus] ||
                          "default"
                        }
                        label={
                          reconciliationLabels[item.reconciliationStatus] ||
                          item.reconciliationStatus
                        }
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 140 }}>
                      <Button
                        size="small"
                        variant={
                          item.reconciliationStatus === "UNMATCHED" ||
                          item.reconciliationStatus === "AUTO_MATCHED"
                            ? "contained"
                            : "text"
                        }
                        color={
                          item.reconciliationStatus === "AUTO_MATCHED"
                            ? "success"
                            : "primary"
                        }
                        onClick={() => setSelectedToken(item.confirmationToken)}
                        disabled={loading}
                      >
                        {item.reconciliationStatus === "UNMATCHED"
                          ? "Chọn đợt"
                          : item.reconciliationStatus === "AUTO_MATCHED"
                            ? "Xác nhận"
                            : "Chi tiết"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {items.length > 0 && !filteredItems.length && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography
                        sx={{ p: 3 }}
                        color="text.secondary"
                        textAlign="center"
                      >
                        Không có giao dịch thuộc trạng thái đã chọn
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {filteredItems.length > 0 && !searchedItems.length && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography
                        sx={{ p: 3 }}
                        color="text.secondary"
                        textAlign="center"
                      >
                        Không tìm thấy giao dịch phù hợp với từ khóa “
                        {searchTerm}”
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {items.length > 0 && (
          <Drawer
            anchor="right"
            open={Boolean(selectedItem)}
            onClose={() => setSelectedToken(null)}
            PaperProps={{
              sx: {
                width: { xs: "100%", sm: 440 },
                display: "flex",
                flexDirection: "column",
              },
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{
                px: 2,
                py: 1.5,
                borderBottom: "1px solid",
                borderColor: "divider",
              }}
            >
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  Chi tiết đối soát
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Thông tin và thao tác giao dịch
                </Typography>
              </Box>
              <IconButton
                aria-label="Đóng chi tiết đối soát"
                onClick={() => setSelectedToken(null)}
              >
                <CloseOutlinedIcon />
              </IconButton>
            </Stack>
            <Box
              sx={{
                p: 2,
                overflowY: "auto",
                flex: 1,
                bgcolor: "background.default",
              }}
            >
              {selectedItem ? (
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="overline" color="text.secondary">
                      Giao dịch đang chọn
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={700} noWrap>
                      {selectedItem.bankTransactionNo ||
                        "Không có mã giao dịch"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Dòng {selectedItem.rowNo} ·{" "}
                      {formatTransactionDate(selectedItem.transactionDate)}
                    </Typography>
                  </Box>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    flexWrap="wrap"
                    useFlexGap
                  >
                    <Chip
                      size="small"
                      color={
                        reconciliationColors[
                          selectedItem.reconciliationStatus
                        ] || "default"
                      }
                      label={
                        reconciliationLabels[
                          selectedItem.reconciliationStatus
                        ] || selectedItem.reconciliationStatus
                      }
                    />
                    <Typography variant="body2" fontWeight={700}>
                      {money(selectedItem.creditAmount)} VND ghi có
                    </Typography>
                  </Stack>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: "background.paper",
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                    >
                      {selectedItem.description}
                    </Typography>
                    {selectedItem.reconciliationContent && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mt: 1,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        <strong>Nội dung đối soát:</strong>{" "}
                        {selectedItem.reconciliationContent}
                      </Typography>
                    )}
                  </Box>
                  <Divider />
                  {confirmedTokens.has(selectedItem.confirmationToken) ? (
                    <Alert severity="success">
                      Đã xác nhận và tạo payment/biên lai trong phiên này.
                    </Alert>
                  ) : selectedItem.paymentBatch ? (
                    <Stack spacing={1.25}>
                      <Typography variant="subtitle2" fontWeight={700}>
                        Đợt thanh toán khớp
                      </Typography>
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          bgcolor: "background.paper",
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Typography variant="body2" fontWeight={700}>
                          {selectedItem.paymentBatch.batchNo} ·{" "}
                          {selectedItem.paymentBatch.student.code}
                        </Typography>
                        <Typography variant="body2">
                          {selectedItem.paymentBatch.student.fullName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Lớp:{" "}
                          {selectedClassNames.join(", ") || "Chưa xác định"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {selectedItem.paymentBatch.allocations.length} khoản ·{" "}
                          {money(selectedItem.paymentBatch.totalAmount)} VND
                        </Typography>
                      </Box>
                      <Button
                        variant="contained"
                        disabled={loading}
                        onClick={() =>
                          requestConfirm(
                            selectedItem,
                            { batchId: selectedItem.paymentBatch!.id },
                            "Xác nhận đợt thanh toán",
                            `Xác nhận ${selectedItem.paymentBatch!.batchNo} cho ${selectedItem.paymentBatch!.student.code} — ${selectedItem.paymentBatch!.student.fullName}, số tiền ${money(selectedItem.creditAmount)} VND, giao dịch ${selectedItem.bankTransactionNo || "không có mã"} lúc ${formatTransactionDate(selectedItem.transactionDate)} và tạo biên lai?`,
                          )
                        }
                      >
                        Xác nhận đợt thanh toán
                      </Button>
                    </Stack>
                  ) : selectedItem.reconciliationStatus === "IGNORED" ? (
                    <Alert severity="info">
                      Giao dịch ghi nợ, không cần đối soát.
                    </Alert>
                  ) : selectedItem.reconciliationStatus === "DUPLICATED" ? (
                    <Alert severity="warning">
                      Giao dịch đã được xác nhận trước đó.
                    </Alert>
                  ) : selectedItem.paymentBatchCandidates.length ||
                    selectedItem.paymentBatchGroupCandidates.length ? (
                    <Stack spacing={1.25}>
                      <Box>
                        <Typography variant="subtitle2" fontWeight={700}>
                          Chọn đợt thu phù hợp
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Chọn phương án có tổng tiền khớp với giao dịch ngân
                          hàng.
                        </Typography>
                      </Box>
                      {selectedItem.paymentBatchCandidates.length > 0 &&
                        selectedItem.paymentBatchGroupCandidates.length > 0 && (
                          <Tabs
                            value={candidateView}
                            onChange={(_, value: "SINGLE" | "GROUP") =>
                              setCandidateView(value)
                            }
                            variant="fullWidth"
                            aria-label="Loại ứng viên đối soát"
                          >
                            <Tab
                              value="SINGLE"
                              label={`Một đợt (${selectedItem.paymentBatchCandidates.length})`}
                            />
                            <Tab
                              value="GROUP"
                              label={`Gộp đợt (${selectedItem.paymentBatchGroupCandidates.length})`}
                            />
                          </Tabs>
                        )}
                      <TextField
                        size="small"
                        fullWidth
                        label="Tìm học viên hoặc mã đợt"
                        placeholder="Tên, mã học viên, mã đợt..."
                        value={drawerStudentSearchTerm}
                        onChange={(event) =>
                          setDrawerStudentSearchTerm(event.target.value)
                        }
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <SearchOutlinedIcon fontSize="small" />
                            </InputAdornment>
                          ),
                          endAdornment: drawerStudentSearchTerm ? (
                            <InputAdornment position="end">
                              <IconButton
                                size="small"
                                aria-label="Xóa tìm học viên trong drawer"
                                onClick={() => setDrawerStudentSearchTerm("")}
                              >
                                <ClearOutlinedIcon fontSize="small" />
                              </IconButton>
                            </InputAdornment>
                          ) : undefined,
                        }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {candidateView === "SINGLE"
                          ? `Hiển thị ${filteredDrawerCandidates.length}/${selectedItem.paymentBatchCandidates.length} đợt đơn`
                          : `Hiển thị ${filteredDrawerGroupCandidates.length}/${selectedItem.paymentBatchGroupCandidates.length} nhóm đợt`}
                      </Typography>
                      {candidateView === "SINGLE" &&
                        filteredDrawerCandidates.map((candidate) => (
                          <Box
                            key={candidate.id}
                            sx={{
                              p: 1.5,
                              borderRadius: 2,
                              bgcolor: "background.paper",
                              border: "1px solid",
                              borderColor: "divider",
                            }}
                          >
                            <Typography variant="body2" fontWeight={700}>
                              {candidate.batchNo} · {candidate.student.code}
                            </Typography>
                            <Typography variant="body2">
                              {candidate.student.fullName}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Lớp:{" "}
                              {[
                                ...new Set(
                                  candidate.allocations.map(
                                    (allocation) =>
                                      allocation.tuitionFee.class.name,
                                  ),
                                ),
                              ].join(", ") || "Chưa xác định"}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {candidate.allocations.length} khoản ·{" "}
                              {money(candidate.totalAmount)} VND
                            </Typography>
                            <Button
                              sx={{ mt: 1 }}
                              size="small"
                              variant="outlined"
                              fullWidth
                              disabled={loading}
                              onClick={() =>
                                requestConfirm(
                                  selectedItem,
                                  { batchId: candidate.id },
                                  "Xác nhận đợt thanh toán thủ công",
                                  `Xác nhận giao dịch ${selectedItem.bankTransactionNo || "không có mã"} số tiền ${money(selectedItem.creditAmount)} VND lúc ${formatTransactionDate(selectedItem.transactionDate)} cho ${candidate.batchNo} — ${candidate.student.code} — ${candidate.student.fullName} và tạo biên lai?`,
                                  candidate.confirmationToken,
                                )
                              }
                            >
                              Chọn đợt này
                            </Button>
                          </Box>
                        ))}
                      {candidateView === "GROUP" &&
                        filteredDrawerGroupCandidates.map((group) => (
                          <Box
                            key={group.confirmationToken}
                            sx={{
                              p: 1.5,
                              borderRadius: 2,
                              bgcolor: "background.paper",
                              border: "1px solid",
                              borderColor: "primary.light",
                            }}
                          >
                            <Typography variant="body2" fontWeight={700}>
                              {group.batches
                                .map((batch) => batch.batchNo)
                                .join(" + ")}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Học sinh:{" "}
                              {group.batches[0]?.student.fullName ||
                                "Chưa xác định"}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {group.batches.length} batch ·{" "}
                              {money(group.totalAmount)} VND
                            </Typography>
                            <Button
                              sx={{ mt: 1 }}
                              size="small"
                              variant="contained"
                              fullWidth
                              disabled={loading}
                              onClick={() =>
                                requestConfirm(
                                  selectedItem,
                                  { batchIds: group.batchIds },
                                  "Xác nhận gộp nhiều đợt thanh toán",
                                  `Xác nhận giao dịch ${selectedItem.bankTransactionNo || "không có mã"} số tiền ${money(selectedItem.creditAmount)} VND cho học sinh ${group.batches[0]?.student.fullName || "chưa xác định"}, gồm ${group.batches.map((batch) => batch.batchNo).join(", ")} và tạo payment/biên lai cho từng đợt?`,
                                  group.confirmationToken,
                                )
                              }
                            >
                              Chọn nhóm này
                            </Button>
                          </Box>
                        ))}
                      {((candidateView === "SINGLE" &&
                        !filteredDrawerCandidates.length) ||
                        (candidateView === "GROUP" &&
                          !filteredDrawerGroupCandidates.length)) && (
                        <Alert severity="info">
                          Không tìm thấy phương án phù hợp với từ khóa.
                        </Alert>
                      )}
                    </Stack>
                  ) : (
                    <Alert severity="info">
                      Không tìm thấy đợt thanh toán cùng số tiền.
                    </Alert>
                  )}
                </Stack>
              ) : (
                <Stack
                  spacing={1}
                  sx={{ py: 5 }}
                  alignItems="center"
                  textAlign="center"
                >
                  <Typography variant="subtitle2">
                    Chọn một giao dịch để xem chi tiết
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Danh sách ứng viên và thao tác xác nhận sẽ hiển thị tại đây.
                  </Typography>
                </Stack>
              )}
            </Box>
          </Drawer>
        )}
      </Paper>
      <ConfirmDialog
        open={!!pendingConfirmation}
        title={pendingConfirmation?.title || "Xác nhận đối soát"}
        message={
          pendingConfirmation?.message ||
          "Bạn có chắc chắn muốn thực hiện thao tác này không?"
        }
        onConfirm={() => void confirm()}
        onCancel={() => setPendingConfirmation(null)}
        isLoading={loading}
      />
      <ConfirmDialog
        open={bulkConfirmationOpen}
        title="Xác nhận giao dịch khớp tự động"
        message={`Hệ thống đã khớp chính xác ${autoMatchedItems.length} giao dịch theo mã đợt, tài khoản ngân hàng và số tiền. Xác nhận để tạo payment và biên lai cho tất cả giao dịch này?`}
        confirmLabel="Xác nhận tất cả"
        cancelLabel="Kiểm tra lại"
        confirmColor="success"
        onConfirm={() => void confirmAllAutoMatched()}
        onCancel={() => setBulkConfirmationOpen(false)}
        isLoading={loading}
      />
      <ConfirmDialog
        open={resetDialogOpen}
        title="Bắt đầu phiên đối soát mới"
        message="Kết quả chưa xác nhận trong phiên hiện tại sẽ bị xóa khỏi màn hình. Các payment đã xác nhận vẫn được giữ nguyên. Bạn có muốn tiếp tục?"
        confirmLabel="Bắt đầu phiên mới"
        cancelLabel="Quay lại"
        confirmColor="primary"
        onConfirm={resetSession}
        onCancel={() => setResetDialogOpen(false)}
      />
      {Snackbar}
    </Stack>
  );
}
