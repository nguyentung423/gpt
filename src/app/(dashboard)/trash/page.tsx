"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, RotateCcw } from "lucide-react";

type TrashWorkspace = {
  id: string;
  name: string;
  account_id: string;
  deleted_at: string;
  deleted_customers_count: number;
};

type TrashCustomer = {
  id: string;
  name: string;
  email: string;
  start_date: string;
  deleted_at: string;
  workspace: {
    id: string;
    name: string;
    account_id: string;
  } | null;
};

export default function TrashPage() {
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<TrashWorkspace[]>([]);
  const [customers, setCustomers] = useState<TrashCustomer[]>([]);

  const fetchTrash = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/trash");
      const data = await res.json();
      if (res.ok) {
        setWorkspaces(data.workspaces || []);
        setCustomers(data.customers || []);
      }
    } catch (err) {
      console.error("Failed to load trash:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrash();
  }, []);

  const restoreItem = async (type: "workspace" | "customer", id: string) => {
    const key = `${type}:${id}`;
    setRestoring(key);
    try {
      const res = await fetch("/api/trash", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(`Lỗi: ${data.error || "Không thể khôi phục"}`);
      } else {
        fetchTrash();
      }
    } catch {
      alert("Không thể khôi phục");
    } finally {
      setRestoring(null);
    }
  };

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
        <h1 className="text-3xl font-bold tracking-tight">Thùng rác</h1>
        <p className="text-muted-foreground">
          Khôi phục khách hàng hoặc workspace đã xóa mềm.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workspace đã xóa</CardTitle>
        </CardHeader>
        <CardContent>
          {workspaces.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Chưa có workspace nào trong thùng rác.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên</TableHead>
                  <TableHead>Account ID</TableHead>
                  <TableHead>Số khách đã ẩn</TableHead>
                  <TableHead>Thời gian xóa</TableHead>
                  <TableHead className="text-right">Khôi phục</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspaces.map((ws) => {
                  const key = `workspace:${ws.id}`;
                  return (
                    <TableRow key={ws.id}>
                      <TableCell className="font-medium">{ws.name}</TableCell>
                      <TableCell>
                        <code className="text-xs">{ws.account_id}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {ws.deleted_customers_count} khách
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(ws.deleted_at).toLocaleString("vi-VN")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={restoring === key}
                          onClick={() => restoreItem("workspace", ws.id)}
                        >
                          {restoring === key ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="mr-2 h-4 w-4" />
                          )}
                          Khôi phục
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Khách hàng đã xóa</CardTitle>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Chưa có khách hàng nào trong thùng rác.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Ngày mua</TableHead>
                  <TableHead>Thời gian xóa</TableHead>
                  <TableHead className="text-right">Khôi phục</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => {
                  const key = `customer:${customer.id}`;
                  return (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">
                        {customer.name}
                      </TableCell>
                      <TableCell>{customer.email}</TableCell>
                      <TableCell>
                        {customer.workspace
                          ? customer.workspace.name ||
                            customer.workspace.account_id
                          : "Workspace đã bị xóa"}
                      </TableCell>
                      <TableCell>{customer.start_date}</TableCell>
                      <TableCell>
                        {new Date(customer.deleted_at).toLocaleString("vi-VN")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={restoring === key}
                          onClick={() => restoreItem("customer", customer.id)}
                        >
                          {restoring === key ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="mr-2 h-4 w-4" />
                          )}
                          Khôi phục
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
