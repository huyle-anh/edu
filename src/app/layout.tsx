import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";
import { AppThemeProvider } from "@/components/providers/AppThemeProvider";
import { LocalizationWrapper } from "@/components/providers/LocalizationWrapper";

export const metadata: Metadata = {
  title: "EduCenter - Quản lý đào tạo",
  description: "Nền tảng quản lý trung tâm đào tạo",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({
  children,
}: RootLayoutProps): ReactElement {
  return (
    <html lang="vi">
      <body>
        <LocalizationWrapper>
          <AppThemeProvider>{children}</AppThemeProvider>
        </LocalizationWrapper>
      </body>
    </html>
  );
}
