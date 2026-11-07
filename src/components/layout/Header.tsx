"use client";

import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import MenuOutlinedIcon from "@mui/icons-material/MenuOutlined";
import {
  Autocomplete,
  Avatar,
  Box,
  Breadcrumbs,
  IconButton,
  InputAdornment,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import { useState, useTransition, type ReactElement } from "react";
import { usePathname, useRouter } from "next/navigation";
import { logoutAction } from "@/server-actions/auth.actions";
import type { SessionUser } from "@/types/auth";
import { adminNavigationItems } from "@/components/layout/Sidebar";
import { useAppColorMode } from "@/components/providers/AppThemeProvider";

type HeaderProps = {
  user: SessionUser;
  onToggleSidebar: () => void;
};

export function Header({ user, onToggleSidebar }: HeaderProps): ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const { mode, toggleColorMode } = useAppColorMode();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [isLoggingOut, startLogoutTransition] = useTransition();
  const open = Boolean(anchorEl);
  const detailRoutes: Array<[RegExp, string]> = [
    [/^\/admin\/classes\/[^/]+\/students$/, "Học viên trong lớp"],
    [/^\/admin\/classes\/[^/]+\/tuition$/, "Học phí lớp"],
    [/^\/admin\/classes\/[^/]+$/, "Chi tiết lớp"],
    [/^\/admin\/tuition-fees\/[^/]+\/edit$/, "Sửa học phí"],
    [/^\/admin\/tuition-fees\/payment-history\/[^/]+$/, "Chi tiết đợt thu"],
    [/^\/admin\/tuition-fees\/[^/]+$/, "Chi tiết học phí"],
  ];
  const detailPageTitle = detailRoutes.find(([route]) => route.test(pathname))?.[1];
  const pageRoutes: Array<[string, string]> = [
    ["/admin", "Tổng quan"],
    ["/admin/students", "Học viên"],
    ["/admin/classes", "Lớp học"],
    ["/admin/teachers", "Giáo viên"],
    ["/admin/subjects", "Môn học"],
    ["/admin/tuition-fees/notice-management", "Thông báo & đợt thu"],
    ["/admin/tuition-fees/payment-history", "Lịch sử thanh toán"],
    ["/admin/tuition-fees/payment", "Thu học phí"],
    ["/admin/tuition-fees", "Các khoản học phí"],
    ["/admin/receipts", "Biên lai"],
    ["/admin/bank-reconciliation", "Đối soát ngân hàng"],
    ["/admin/bank-accounts", "Tài khoản nhận tiền"],
    ["/admin/reports", "Báo cáo"],
    ["/admin/users", "Người dùng"],
  ];
  const exactPageTitle = pageRoutes.find(([href]) => pathname === href)?.[1];
  const parentPageTitle = pageRoutes
    .filter(([href]) => href !== "/admin" && pathname.startsWith(`${href}/`))
    .sort(([left = ""], [right = ""]) => right.length - left.length)[0]?.[1] ?? "EduCenter";
  const pageTitle = exactPageTitle ?? detailPageTitle ?? parentPageTitle;

  const initials = user.fullName
    .split(" ")
    .filter((token) => token.length > 0)
    .slice(0, 2)
    .map((token) => token[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <Box
      component="header"
      sx={{
        height: 72,
        px: { xs: 1.5, md: 3 },
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: mode === "dark" ? "rgba(16,27,36,0.94)" : "rgba(255,255,255,0.92)",
        backdropFilter: "blur(16px)",
        position: "sticky",
        top: 0,
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5} minWidth={0}>
        <IconButton onClick={onToggleSidebar} aria-label="Mở hoặc thu gọn menu" sx={{ bgcolor: "action.hover", "&:hover": { bgcolor: "action.selected" } }}>
          <MenuOutlinedIcon />
        </IconButton>
        <Box minWidth={0}>
          <Breadcrumbs separator="/" aria-label="Đường dẫn" sx={{ "& .MuiBreadcrumbs-separator": { mx: 0.75, color: "text.disabled" } }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} noWrap>EduCenter</Typography>
            <Typography variant="body2" color="text.primary" fontWeight={750} noWrap>{pageTitle}</Typography>
          </Breadcrumbs>
          <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", md: "block" }, mt: 0.125 }}>
            Trung tâm quản lý đào tạo và học phí
          </Typography>
        </Box>
      </Stack>

      <Autocomplete
        options={adminNavigationItems}
        getOptionLabel={(option) => option.label}
        onChange={(_, option) => {
          if (option) router.push(option.href);
        }}
        autoHighlight
        clearOnBlur
        sx={{
          display: { xs: "none", sm: "block" },
          width: { sm: 170, md: 240, lg: 300, xl: 380 },
          mx: { md: 2, lg: 4 },
          flex: "0 1 380px",
          "& .MuiOutlinedInput-root": {
            border: 0,
            borderRadius: 10,
            bgcolor: "action.hover",
            py: 0.1,
            pl: 1.5,
            "& fieldset": { border: 0 },
            "&:hover, &.Mui-focused": { bgcolor: "action.selected" },
          },
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Tìm chức năng"
            inputProps={{ ...params.inputProps, "aria-label": "Tìm trang quản lý" }}
            InputProps={{
              ...params.InputProps,
              startAdornment: <InputAdornment position="start"><SearchOutlinedIcon fontSize="small" color="action" /></InputAdornment>,
            }}
          />
        )}
      />

      <Stack direction="row" alignItems="center" spacing={1.5}>
        <IconButton
          onClick={toggleColorMode}
          aria-label={mode === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
          title={mode === "dark" ? "Giao diện sáng" : "Giao diện tối"}
        >
          {mode === "dark" ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
        </IconButton>
        <Box textAlign="right" sx={{ display: { xs: "none", sm: "block" } }}>
          <Typography variant="body2" fontWeight={600}>
            {user.fullName}
          </Typography>
        </Box>
        <IconButton onClick={(event) => setAnchorEl(event.currentTarget)} size="small" aria-label="Mở menu tài khoản">
          <Avatar sx={{ width: 38, height: 38, bgcolor: "primary.main", fontWeight: 700 }}>{initials}</Avatar>
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={() => setAnchorEl(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <MenuItem
            onClick={() => {
              setAnchorEl(null);
              startLogoutTransition(async () => {
                await logoutAction();
              });
            }}
            disabled={isLoggingOut}
          >
            <ListItemIcon>
              <LogoutOutlinedIcon fontSize="small" />
            </ListItemIcon>
            {isLoggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
          </MenuItem>
        </Menu>
      </Stack>
    </Box>
  );
}
