"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { daysLeft } from "@/lib/utils";

interface DataCustomer {
  id: string;
  name: string;
  email: string;
  start_date: string;
  created_at: string;
}

const renderRemaining = (customer: DataCustomer) => {
  const remaining = daysLeft(customer.start_date, false);

  if (remaining < 0) {
    return <Badge variant="destructive">Hết hạn</Badge>;
  }

  if (remaining <= 3) {
    return <span className="font-semibold text-red-600">{remaining} ngày</span>;
  }

  if (remaining <= 7) {
    return <span className="font-medium text-amber-600">{remaining} ngày</span>;
  }

  return <span className="text-green-600">{remaining} ngày</span>;
};

export default function DataPage() {
  const [customers, setCustomers] = useState<DataCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    email: "",
    start_date: "",
  });

  const fetchDataCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/data");
      const data = await res.json();

      if (res.ok) {
        setCustomers((data.customers as DataCustomer[]) || []);
      } else {
        alert(`Lỗi: ${data.error || "Không thể tải Data"}`);
      }
    } catch (err) {
      console.error("Failed to load Data module:", err);
      alert("Không thể tải Data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDataCustomers();
  }, []);

  const handleAdd = async () => {
    const name = newCustomer.name.trim();
    const email = newCustomer.email.trim().toLowerCase();
    const startDate = newCustomer.start_date.trim();

    if (!name || !email || !startDate) {
      alert("Vui lòng nhập đủ tên, email và ngày mua");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, start_date: startDate }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(`Lỗi: ${data.error || "Không thể thêm khách"}`);
        return;
      }

      const created = data.customer as DataCustomer;
      setCustomers((prev) => [created, ...prev]);
      setNewCustomer({ name: "", email: "", start_date: "" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/data/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        alert(`Lỗi: ${data.error || "Không thể xóa khách"}`);
        return;
      }

      setCustomers((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setDeletingId(null);
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
        <h1 className="text-3xl font-bold tracking-tight">Data</h1>
        <p className="text-muted-foreground">
          Module riêng để lưu khách thủ công, tách biệt hoàn toàn với Customers.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-lg font-semibold">Thêm khách vào Data</h2>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Input
              placeholder="Tên khách"
              value={newCustomer.name}
              onChange={(e) =>
                setNewCustomer((prev) => ({ ...prev, name: e.target.value }))
              }
            />
            <Input
              type="email"
              placeholder="Email khách"
              value={newCustomer.email}
              onChange={(e) =>
                setNewCustomer((prev) => ({ ...prev, email: e.target.value }))
              }
            />
            <Input
              type="date"
              value={newCustomer.start_date}
              onChange={(e) =>
                setNewCustomer((prev) => ({
                  ...prev,
                  start_date: e.target.value,
                }))
              }
            />
            <Button type="button" onClick={handleAdd} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Thêm khách
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-lg font-semibold">Dữ liệu khách hàng</h2>
            <Badge variant="secondary">{customers.length} khách</Badge>
          </div>

          {customers.length === 0 ? (
            <div className="py-8 text-sm text-muted-foreground">
              Chưa có khách hàng nào.
            </div>
          ) : (
            <>
              <div className="space-y-2 sm:hidden">
                {customers.map((customer) => (
                  <div
                    key={customer.id}
                    className="rounded-lg border bg-background p-3"
                  >
                    <div className="mb-1 text-sm text-muted-foreground">
                      {customer.email}
                    </div>
                    <div className="mb-1 font-medium">{customer.name}</div>
                    <div className="mb-1 text-sm text-muted-foreground">
                      Ngày mua: {customer.start_date}
                    </div>
                    <div className="text-sm">{renderRemaining(customer)}</div>
                  </div>
                ))}
              </div>

              <div className="hidden w-full overflow-x-auto sm:block">
                <Table className="min-w-150">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mail khách</TableHead>
                      <TableHead>Tên khách</TableHead>
                      <TableHead>Ngày mua</TableHead>
                      <TableHead>Thời gian còn lại</TableHead>
                      <TableHead className="text-right">Xóa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="max-w-80 truncate">
                          {customer.email}
                        </TableCell>
                        <TableCell className="font-medium">
                          {customer.name}
                        </TableCell>
                        <TableCell>{customer.start_date}</TableCell>
                        <TableCell>{renderRemaining(customer)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            disabled={deletingId === customer.id}
                            onClick={() => handleDelete(customer.id)}
                          >
                            {deletingId === customer.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
