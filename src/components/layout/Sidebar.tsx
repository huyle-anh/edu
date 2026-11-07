"use client";

import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import ClassOutlinedIcon from "@mui/icons-material/ClassOutlined";
import ReceiptOutlinedIcon from "@mui/icons-material/ReceiptOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import CallSplitOutlinedIcon from "@mui/icons-material/CallSplitOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";

import {
  Box,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement } from "react";
type SidebarItem = {
  label: string;
  href: string;
  icon: ReactElement;
  section: "Tổng quan" | "Đào tạo" | "Tài chính" | "Hệ thống";
};

export const adminNavigationItems: SidebarItem[] = [
  {
    label: "Tổng quan",
    href: "/admin",
    icon: <HomeOutlinedIcon fontSize="small" />,
    section: "Tổng quan",
  },
  {
    label: "Học viên",
    href: "/admin/students",
    icon: <GroupOutlinedIcon fontSize="small" />,
    section: "Đào tạo",
  },
  {
    label: "Lớp học",
    href: "/admin/classes",
    icon: <ClassOutlinedIcon fontSize="small" />,
    section: "Đào tạo",
  },
  {
    label: "Điểm danh",
    href: "/teacher/attendance",
    icon: <FactCheckOutlinedIcon fontSize="small" />,
    section: "Đào tạo",
  },
  {
    label: "Lịch điểm danh",
    href: "/teacher/attendance/calendar",
    icon: <CalendarMonthOutlinedIcon fontSize="small" />,
    section: "Đào tạo",
  },
  {
    label: "Giáo viên",
    href: "/admin/teachers",
    icon: <SchoolOutlinedIcon fontSize="small" />,
    section: "Đào tạo",
  },
  {
    label: "Môn học",
    href: "/admin/subjects",
    icon: <ClassOutlinedIcon fontSize="small" />,
    section: "Đào tạo",
  },
  {
    label: "Các khoản học phí",
    href: "/admin/tuition-fees",
    icon: <AccountBalanceWalletOutlinedIcon fontSize="small" />,
    section: "Tài chính",
  },
  {
    label: "Thu học phí",
    href: "/admin/tuition-fees/payment",
    icon: <PaymentsOutlinedIcon fontSize="small" />,
    section: "Tài chính",
  },
  {
    label: "Thông báo & đợt thu",
    href: "/admin/tuition-fees/notice-management",
    icon: <CallSplitOutlinedIcon fontSize="small" />,
    section: "Tài chính",
  },
  {
    label: "Lịch sử thanh toán",
    href: "/admin/tuition-fees/payment-history",
    icon: <HistoryOutlinedIcon fontSize="small" />,
    section: "Tài chính",
  },
  {
    label: "Biên lai",
    href: "/admin/receipts",
    icon: <ReceiptOutlinedIcon fontSize="small" />,
    section: "Tài chính",
  },
  {
    label: "Đối soát ngân hàng",
    href: "/admin/bank-reconciliation",
    icon: <AccountBalanceOutlinedIcon fontSize="small" />,
    section: "Tài chính",
  },
  {
    label: "Báo cáo",
    href: "/admin/reports",
    icon: <AssessmentOutlinedIcon fontSize="small" />,
    section: "Tài chính",
  },
  {
    label: "Tài khoản nhận tiền",
    href: "/admin/bank-accounts",
    icon: <AccountBalanceOutlinedIcon fontSize="small" />,
    section: "Tài chính",
  },
  {
    label: "Người dùng",
    href: "/admin/users",
    icon: <ManageAccountsOutlinedIcon fontSize="small" />,
    section: "Hệ thống",
  },
];

const teacherAttendanceNavigationItem: SidebarItem = {
  label: "Điểm danh",
  href: "/teacher/attendance",
  icon: <FactCheckOutlinedIcon fontSize="small" />,
  section: "Đào tạo",
};

const teacherAttendanceCalendarNavigationItem: SidebarItem = {
  label: "Lịch điểm danh",
  href: "/teacher/attendance/calendar",
  icon: <CalendarMonthOutlinedIcon fontSize="small" />,
  section: "Đào tạo",
};

type SidebarProps = {
  collapsed?: boolean;
  onNavigate?: () => void;
  teacherMode?: boolean;
};

export function Sidebar({ collapsed = false, onNavigate, teacherMode = false }: SidebarProps): ReactElement {
  const pathname = usePathname();
  const navigationItems = teacherMode
    ? [teacherAttendanceNavigationItem, teacherAttendanceCalendarNavigationItem]
    : adminNavigationItems;
  const activeHref = navigationItems
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((left, right) => right.href.length - left.href.length)[0]?.href;

  return (
    <Box
      sx={{
        width: collapsed ? 76 : 280,
        height: "100dvh",
        minHeight: 0,
        bgcolor: "background.paper",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "width 180ms ease",
      }}
    >
      {/* Logo */}
      <Box sx={{ px: collapsed ? 1.5 : 2.5, py: 2.5 }}>
        <Stack direction="row" spacing={1.25} alignItems="center" justifyContent={collapsed ? "center" : "flex-start"}>
          <Box sx={{ width: 38, height: 38, display: "grid", placeItems: "center", flexShrink: 0 }} aria-hidden="true">
            <svg width="34" height="34" viewBox="0 0 40 40" fill="none">
              <path d="M6 7c8-4 16 1 28 1v6c-11 0-20-5-28 1V7Z" fill="#A7EDD8" />
              <path d="M6 17c8-5 17 1 28 1v6c-11 0-19-5-28 1v-8Z" fill="#55D5A9" />
              <path d="M6 27c8-4 17 1 28 1v6c-11 0-19-4-28 1v-8Z" fill="#21B887" />
            </svg>
          </Box>
          <Box sx={{ display: collapsed ? "none" : "block", minWidth: 0 }}>
            <Typography
              variant="subtitle1"
              fontWeight={800}
              color="text.primary"
              lineHeight={1.1}
            >
              EduCenter
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Quản lý đào tạo
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Divider />

      {/* Menu */}
      <List
        sx={{
          px: collapsed ? 1 : 1.5,
          py: 2,
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          overscrollBehavior: "contain",
          scrollbarGutter: "stable",
        }}
      >
        {navigationItems.map((item, index) => {
          const selected = item.href === activeHref;
          const previousSection = index > 0 ? navigationItems[index - 1]?.section : null;

          const button = (
            <ListItemButton
              component={Link}
              href={item.href}
              selected={selected}
              onClick={onNavigate}
              aria-current={selected ? "page" : undefined}
              sx={{
                position: "relative",
                borderRadius: 1.5,
                mb: 0.5,
                minHeight: 44,
                px: collapsed ? 1.25 : 1.5,
                justifyContent: collapsed ? "center" : "flex-start",
                color: "text.secondary",
                "& .MuiListItemIcon-root": { color: "inherit" },
                "&.Mui-selected": {
                  bgcolor: "primary.light",
                  color: "primary.dark",
                  "&:hover": { bgcolor: "primary.light" },
                },
                "&:hover": { bgcolor: "action.hover", color: "text.primary" },
              }}
            >
              <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, justifyContent: "center" }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                sx={{ display: collapsed ? "none" : "block" }}
                primaryTypographyProps={{
                  fontSize: 13.5,
                  fontWeight: selected ? 700 : 500,
                  noWrap: true,
                }}
              />
            </ListItemButton>
          );

          return (
            <Box key={item.href}>
              {!collapsed && item.section !== "Tổng quan" && item.section !== previousSection && (
                <Typography
                  variant="overline"
                  color="text.secondary"
                  sx={{
                    display: "block",
                    px: 1.5,
                    mt: index === 0 ? 0 : 2.5,
                    mb: 0.75,
                    letterSpacing: "0.09em",
                    fontWeight: 700,
                  }}
                >
                  {item.section}
                </Typography>
              )}
              {collapsed ? <Tooltip title={item.label} placement="right">{button}</Tooltip> : button}
            </Box>
          );
        })}
      </List>
    </Box>
  );
}
