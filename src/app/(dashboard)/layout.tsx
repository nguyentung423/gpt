"use client";

import dynamic from "next/dynamic";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Menu, Sparkles } from "lucide-react";

const MobileSidebarMenu = dynamic(
  () =>
    import("@/components/mobile-sidebar-menu").then(
      (mod) => mod.MobileSidebarMenu,
    ),
  {
    ssr: false,
    loading: () => (
      <Button type="button" variant="outline" size="icon" disabled>
        <Menu className="h-4 w-4" />
      </Button>
    ),
  },
);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen overflow-x-hidden bg-muted/40">
      <aside className="hidden shrink-0 md:block">
        <Sidebar />
      </aside>

      <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4 md:p-6">
        <div className="mb-3 flex items-center justify-between md:hidden">
          <MobileSidebarMenu />

          <div className="flex items-center gap-2 pr-1 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            PremiumShop
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}
