"use client";

import { useState, useEffect } from "react";
import { CustomersTable } from "@/components/customers-table";
import type { CustomerWithWorkspace, Workspace } from "@/lib/types/database";
import { Loader2 } from "lucide-react";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerWithWorkspace[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async (runSync = false) => {
    setLoading(true);
    try {
      // Fetch workspaces + customers in parallel (hiện data ngay)
      const [wsRes, custRes] = await Promise.all([
        fetch("/api/workspaces"),
        fetch("/api/customers"),
      ]);

      const wsData = await wsRes.json();
      const custData = await custRes.json();

      const allWorkspaces: Workspace[] = wsData.workspaces || [];
      if (wsRes.ok) setWorkspaces(allWorkspaces);
      if (custRes.ok) setCustomers(custData.customers || []);

      // Sync chạy ngầm sau khi đã hiện data
      if (runSync) {
        const activeWs = allWorkspaces.filter((ws) => ws.status === "active");
        const BATCH_SIZE = 5;

        // Không block UI — sync xong tự refresh data
        (async () => {
          for (let i = 0; i < activeWs.length; i += BATCH_SIZE) {
            const batch = activeWs.slice(i, i + BATCH_SIZE);
            await Promise.allSettled(
              batch.map((ws) =>
                fetch(`/api/workspaces/${ws.id}/sync`, { method: "POST" }),
              ),
            );
          }
          // Sau khi sync xong, fetch lại customers để cập nhật
          const freshRes = await fetch("/api/customers");
          const freshData = await freshRes.json();
          if (freshRes.ok) setCustomers(freshData.customers || []);
        })();
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true); // Initial load with sync
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Khách hàng</h1>
        <p className="text-muted-foreground">
          Quản lý danh sách khách hàng đăng ký ChatGPT Business
        </p>
      </div>

      <CustomersTable
        customers={customers}
        workspaces={workspaces}
        onRefresh={() => fetchData(false)}
      />
    </div>
  );
}
