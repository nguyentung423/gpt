"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function MobileSidebarMenu() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="icon">
          <Menu className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="left-0 top-0 h-dvh w-72 max-w-[85vw] translate-x-0 translate-y-0 rounded-none border-r p-0">
        <DialogTitle className="sr-only">Mobile Navigation</DialogTitle>
        <Sidebar mobile onNavigate={() => setMobileMenuOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
