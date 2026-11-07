"use client";

import { Box, Drawer, useMediaQuery, useTheme } from "@mui/material";
import { useState, type ReactElement, type ReactNode } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import type { SessionUser } from "@/types/auth";

type AppLayoutProps = {
  user: SessionUser;
  children: ReactNode;
};

export function AppLayout({ user, children }: AppLayoutProps): ReactElement {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"), { noSsr: true });
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleSidebar = () => {
    if (isDesktop) {
      setDesktopCollapsed((previous) => !previous);
      return;
    }

    setMobileOpen((previous) => !previous);
  };

  const sidebar = (
    <Sidebar
      collapsed={isDesktop && desktopCollapsed}
      onNavigate={() => setMobileOpen(false)}
      teacherMode={Boolean(user.teacherId)}
    />
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* Desktop sidebar - only visible on lg+ screens */}
      <Box
        sx={{
          display: { xs: "none", lg: "block" },
          width: desktopCollapsed ? 76 : 280,
          height: "100vh",
          position: "sticky",
          top: 0,
          alignSelf: "flex-start",
          flexShrink: 0,
          overflow: "hidden",
          transition: "width 200ms ease",
          backgroundColor: "background.paper",
          borderRight: 1,
          borderColor: "divider",
          boxShadow: "4px 0 24px rgba(30, 45, 80, 0.025)",
        }}
      >
        {sidebar}
      </Box>

      {/* Mobile drawer */}
      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        PaperProps={{
          sx: {
            width: 280,
            height: "100dvh",
            overflow: "hidden",
          },
        }}
      >
        <Sidebar onNavigate={() => setMobileOpen(false)} teacherMode={Boolean(user.teacherId)} />
      </Drawer>

      {/* Main content */}
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Header user={user} onToggleSidebar={toggleSidebar} />
        <Box
          component="main"
          sx={{
            minHeight: "calc(100vh - 72px)",
            px: { xs: 1.5, sm: 2.5, lg: 4, xl: 5 },
            py: { xs: 2, md: 3 },
            bgcolor: "background.default",
          }}
        >
          <Box sx={{ width: "100%", maxWidth: 1680, mx: "auto" }}>{children}</Box>
        </Box>
      </Box>
    </Box>
  );
}
