"use client";

import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import GroupIcon from "@mui/icons-material/Group";
import PaymentIcon from "@mui/icons-material/Payment";
import ReceiptIcon from "@mui/icons-material/Receipt";
import SchoolIcon from "@mui/icons-material/School";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DatePickerField } from "@/components/shared/forms/DatePickerField";
import { unwrapApiResponse } from "@/lib/api-client";

interface DashboardStats {
  totalFeeAmount: number;
  totalRevenue: number;
  totalDebt: number;
  totalCollected: number;
  cashCollected: number;
  bankTransferCollected: number;
  activeClasses: number;
  activeStudents: number;
  overdueFees: number;
  pendingBatches: number;
}

type StatCardProps = {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
  loading: boolean;
  color?: "primary" | "success" | "warning" | "error" | "info";
};

const money = (value: number) =>
  `${new Intl.NumberFormat("vi-VN").format(Number(value))} ₫`;

function StatCard({
  icon,
  title,
  value,
  subtitle,
  loading,
  color = "primary",
}: StatCardProps) {
  return (
    <Card sx={{ height: "100%", minHeight: 132 }}>
      <CardContent sx={{ height: "100%", p: { xs: 2, md: 2.25 }, display: "flex", alignItems: "center" }}>
        <Stack direction="row" spacing={1.75} alignItems="flex-start">
          <Box
            sx={{
              width: 44,
              height: 44,
              flexShrink: 0,
              borderRadius: 2.5,
              display: "grid",
              placeItems: "center",
              bgcolor: `${color}.light`,
              color: `${color}.main`,
            }}
          >
            {icon}
          </Box>
          <Box minWidth={0} flex={1}>
            <Typography variant="body2" color="text.secondary" noWrap>
              {title}
            </Typography>
            {loading ? (
              <Skeleton width="80%" height={34} />
            ) : (
              <Typography
                variant="h6"
                fontWeight={800}
                noWrap
                sx={{ mt: 0.25 }}
              >
                {value}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" noWrap>
              {subtitle}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function QuickLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Button
      component={Link}
      href={href}
      variant="outlined"
      endIcon={<ArrowForwardIcon fontSize="small" />}
      startIcon={icon}
      fullWidth
      sx={{ justifyContent: "space-between", bgcolor: "background.paper", borderColor: "divider", "&:hover": { bgcolor: "action.hover" } }}
    >
      {label}
    </Button>
  );
}

function SummaryMetric({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <Box sx={{ minWidth: 0, p: 1.25, borderRadius: 2, bgcolor: "background.default", border: "1px solid", borderColor: "divider" }}>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: "text.secondary" }}>
        {icon}
        <Typography variant="caption" noWrap>{label}</Typography>
      </Stack>
      {loading ? (
        <Skeleton width="85%" height={28} />
      ) : (
        <Typography variant="body1" fontWeight={800} noWrap sx={{ color: "text.primary", mt: 0.5 }}>{value}</Typography>
      )}
    </Box>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedDateFrom, setAppliedDateFrom] = useState("");
  const [appliedDateTo, setAppliedDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (appliedDateFrom) params.set("dateFrom", appliedDateFrom);
      if (appliedDateTo) params.set("dateTo", appliedDateTo);
      const response = await fetch(`/api/dashboard/stats?${params}`);

      if (!response.ok) throw new Error("Không thể tải dữ liệu dashboard");
      setStats(await unwrapApiResponse<DashboardStats>(response));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể tải dữ liệu dashboard",
      );
    } finally {
      setLoading(false);
    }
  }, [appliedDateFrom, appliedDateTo]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setAppliedDateFrom("");
    setAppliedDateTo("");
  };

  const applyFilters = () => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setError("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc");
      return;
    }
    setError(null);
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
  };

  const collectedByMethod = (stats?.cashCollected ?? 0) + (stats?.bankTransferCollected ?? 0);
  const cashShare = collectedByMethod > 0 ? (stats?.cashCollected ?? 0) / collectedByMethod * 100 : 0;
  const transferShare = collectedByMethod > 0 ? (stats?.bankTransferCollected ?? 0) / collectedByMethod * 100 : 0;

  return (
    <Stack spacing={{ xs: 2, md: 2.5 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
      >
        <Box>
          <Typography
            variant="h4"
            component="h1"
            fontWeight={800}
            sx={{ mt: 0.25 }}
          >
            Tổng quan
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Theo dõi tài chính, học phí và công việc cần xử lý.
          </Typography>
        </Box>
        <Chip icon={<CalendarMonthOutlinedIcon />} label={appliedDateFrom || appliedDateTo ? `${appliedDateFrom || "..."} – ${appliedDateTo || "..."}` : "Tất cả thời gian"} variant="outlined" color="primary" />
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(270px, 0.8fr) minmax(0, 2.2fr)" }, gap: 2.5, alignItems: "start" }}>
        <Stack spacing={2}>
          <Card>
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
              <Typography fontWeight={800}>Khoảng thời gian</Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.75 }}>
                Áp dụng cho doanh thu đã thu; công nợ và số lượng là số hiện tại.
              </Typography>
              <Stack spacing={1.25}>
                <DatePickerField label="Từ ngày" value={dateFrom} onChange={setDateFrom} textFieldProps={{ size: "small" }} />
                <DatePickerField
                  label="Đến ngày"
                  value={dateTo}
                  onChange={setDateTo}
                  textFieldProps={{
                    size: "small",
                    error: Boolean(dateFrom && dateTo && dateFrom > dateTo),
                    helperText: dateFrom && dateTo && dateFrom > dateTo
                      ? "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc"
                      : undefined,
                  }}
                />
                <Stack direction="row" spacing={1}>
                  <Button fullWidth variant="contained" onClick={applyFilters}>Áp dụng</Button>
                  <Button fullWidth variant="outlined" onClick={clearFilters} disabled={!dateFrom && !dateTo}>Xóa lọc</Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
          <Card>
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
              <Typography variant="h6" fontWeight={750}>Cần theo dõi</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.75 }}>Các việc đang chờ xử lý.</Typography>
              <Stack spacing={1}>
                <QuickLink href="/admin/bank-reconciliation" label="Đối soát ngân hàng" icon={<AccountBalanceIcon />} />
                <QuickLink href="/admin/tuition-fees/payment-history" label={`Đợt thu chờ xử lý (${stats?.pendingBatches ?? 0})`} icon={<PaymentIcon />} />
                <QuickLink href="/admin/tuition-fees" label={`Học phí quá hạn (${stats?.overdueFees ?? 0})`} icon={<WarningAmberIcon />} />
              </Stack>
            </CardContent>
          </Card>
        </Stack>

        <Stack spacing={2}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
            <StatCard icon={<CheckCircleOutlineOutlinedIcon />} title="Đã thu trong kỳ" value={money(stats?.totalCollected ?? 0)} subtitle="Thanh toán thành công" loading={loading} color="success" />
            <StatCard icon={<PaymentIcon />} title="Công nợ hiện tại" value={money(stats?.totalDebt ?? 0)} subtitle="Chưa thanh toán hoặc quá hạn" loading={loading} color="warning" />
          </Box>

          <Card>
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
                <Box>
                  <Typography variant="h6" fontWeight={750}>Phân bổ khoản thu</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>Theo phương thức thanh toán trong kỳ.</Typography>
                </Box>
                <Chip icon={<CalendarMonthOutlinedIcon />} label={appliedDateFrom || appliedDateTo ? `${appliedDateFrom || "…"} – ${appliedDateTo || "…"}` : "Tất cả thời gian"} variant="outlined" size="small" />
              </Stack>
              <Box sx={{ mt: 2.25 }}>
                <Box sx={{ height: 12, display: "flex", overflow: "hidden", borderRadius: 10, bgcolor: "action.hover" }}>
                  <Box sx={{ width: `${cashShare}%`, bgcolor: "#3188f5", transition: "width 200ms ease" }} />
                  <Box sx={{ width: `${transferShare}%`, bgcolor: "#19aa83", transition: "width 200ms ease" }} />
                </Box>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(4, minmax(0,1fr))" }, gap: 1.5, mt: 2 }}>
                  <SummaryMetric icon={<AccountBalanceWalletIcon />} label="Tiền mặt" value={money(stats?.cashCollected ?? 0)} loading={loading} />
                  <SummaryMetric icon={<AccountBalanceIcon />} label="Chuyển khoản" value={money(stats?.bankTransferCollected ?? 0)} loading={loading} />
                  <SummaryMetric icon={<ReceiptIcon />} label="Tổng phải thu" value={money(stats?.totalFeeAmount ?? 0)} loading={loading} />
                  <SummaryMetric icon={<SchoolIcon />} label="Lớp hoạt động" value={String(stats?.activeClasses ?? 0)} loading={loading} />
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
            <StatCard icon={<WarningAmberIcon />} title="Học phí quá hạn" value={String(stats?.overdueFees ?? 0)} subtitle="Khoản cần nhắc thu" loading={loading} color="warning" />
            <StatCard icon={<GroupIcon />} title="Học viên hoạt động" value={String(stats?.activeStudents ?? 0)} subtitle="Đang theo học" loading={loading} />
          </Box>

          <Card sx={{ bgcolor: "secondary.light", borderColor: "divider" }}>
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
              <Typography variant="h6" fontWeight={750}>Bắt đầu công việc</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4, mb: 1.75 }}>Truy cập nhanh các nghiệp vụ thu học phí thường dùng.</Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <QuickLink href="/admin/tuition-fees/payment" label="Thu học phí" icon={<PaymentIcon />} />
                <QuickLink href="/admin/tuition-fees/notice-management" label="Thông báo & đợt thu" icon={<AccountBalanceIcon />} />
                <QuickLink href="/admin/receipts" label="Xem biên lai" icon={<ReceiptIcon />} />
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </Stack>
  );
}
