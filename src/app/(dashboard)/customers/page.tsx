"use client";

import { useEffect, useState } from "react";
import { CustomersTable } from "@/components/customers-table";
import type { CustomerWithWorkspace, Workspace } from "@/lib/types/database";
import { Loader2 } from "lucide-react";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerWithWorkspace[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [wsRes, custRes] = await Promise.all([
        fetch("/api/workspaces", { cache: "no-store" }),
        fetch("/api/customers", { cache: "no-store" }),
      ]);

      const wsData = await wsRes.json();
      const custData = await custRes.json();

      if (wsRes.ok) setWorkspaces((wsData.workspaces as Workspace[]) || []);
      if (custRes.ok) setCustomers(custData.customers || []);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
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
          Tập trung quản lý dữ liệu và gia hạn 1 tháng nhanh gọn.
        </p>
      </div>

      <CustomersTable
        customers={customers}
        workspaces={workspaces}
        onRefresh={fetchData}
      />
    </div>
  );
}
