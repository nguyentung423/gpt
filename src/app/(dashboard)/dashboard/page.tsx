"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Building2,
  AlertTriangle,
  Loader2,
  Copy,
  Ban,
  ShieldAlert,
  Eye,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface WarningCustomer {
  id: string;
  name: string;
  email: string;
  is_trial: boolean;
  expiry_date: string;
  remaining: number;
  workspace?: { name: string } | null;
}

interface UnknownCustomer {
  id: string;
  email: string;
  created_at: string;
  workspace?: { name: string } | null;
}

interface Stats {
  totalCustomers: number;
  totalWorkspaces: number;
  activeWorkspaces: number;
  expiredCount: number;
  expiringIn1Day: number;
  expiringIn3Days: number;
}

export default function DashboardPage() {
  const [warningList, setWarningList] = useState<WarningCustomer[]>([]);
  const [unknownList, setUnknownList] = useState<UnknownCustomer[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalCustomers: 0,
    totalWorkspaces: 0,
    activeWorkspaces: 0,
    expiredCount: 0,
    expiringIn1Day: 0,
    expiringIn3Days: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/dashboard");
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Không thể tải dashboard");

        setStats(
          data.stats || {
            totalCustomers: 0,
            totalWorkspaces: 0,
            activeWorkspaces: 0,
            expiredCount: 0,
            expiringIn1Day: 0,
            expiringIn3Days: 0,
          },
        );
        setWarningList(data.warningList || []);
        setUnknownList(data.unknownList || []);
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const copyRenewMessage = (c: WarningCustomer) => {
    const remaining = c.remaining;
    const expiryDate = formatDate(c.expiry_date);

    let urgency: string;
    if (remaining < 0) {
      urgency = `đã hết hạn ${Math.abs(remaining)} ngày trước`;
    } else if (remaining === 0) {
      urgency = "hết hạn HÔM NAY";
    } else {
      urgency = `sẽ hết hạn sau ${remaining} ngày (${expiryDate})`;
    }

    const message = `Xin chào ${c.name},

Tài khoản ChatGPT Business của bạn ${urgency}.

📧 Email: ${c.email}
📅 Ngày hết hạn: ${expiryDate}

Vui lòng gia hạn để tiếp tục sử dụng dịch vụ. Liên hệ mình nếu cần hỗ trợ nhé!

— PremiumShop.tech`;

    navigator.clipboard.writeText(message);
    alert("Đã copy tin nhắn nhắc gia hạn!");
  };

  const handleDismissAlert = async (customerId: string) => {
    try {
      await fetch(`/api/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_unknown: false }),
      });
      setUnknownList((prev) => prev.filter((c) => c.id !== customerId));
    } catch {
      // ignore
    }
  };

  const handleDismissAllAlerts = async () => {
    const unknowns = unknownList;
    try {
      await Promise.all(
        unknowns.map((c) =>
          fetch(`/api/customers/${c.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_unknown: false }),
          }),
        ),
      );
      setUnknownList([]);
    } catch {
      // ignore
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
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Tổng quan về hệ thống ChatGPT Business
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tổng khách hàng
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCustomers}</div>
            <p className="text-xs text-muted-foreground">Trong hệ thống</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workspaces</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.activeWorkspaces}/{stats.totalWorkspaces}
            </div>
            <p className="text-xs text-muted-foreground">Đang hoạt động</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Cảnh báo 1 ngày
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats.expiringIn1Day}
            </div>
            <p className="text-xs text-muted-foreground">
              Còn 1 ngày hoặc hôm nay
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sắp hết hạn</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats.expiringIn3Days}
            </div>
            <p className="text-xs text-muted-foreground">Còn 2-3 ngày</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Đã hết hạn</CardTitle>
            <Ban className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.expiredCount}
            </div>
            <p className="text-xs text-muted-foreground">Cần gia hạn</p>
          </CardContent>
        </Card>
      </div>

      {/* Security Alerts — Email lạ tự add vào workspace */}
      {unknownList.length > 0 && (
        <Card className="border-red-300 bg-red-50/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg text-red-700">
                <ShieldAlert className="h-5 w-5" />
                Cảnh báo bảo mật ({unknownList.length} email lạ)
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDismissAllAlerts}
              >
                <Eye className="h-3 w-3 mr-1" />
                Đã xem tất cả
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {unknownList.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-red-200 bg-white p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="destructive" className="shrink-0">
                      Lạ
                    </Badge>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{c.email}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.workspace?.name ?? "N/A"} ·{" "}
                        {new Date(c.created_at).toLocaleDateString("vi-VN")}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 ml-2 text-muted-foreground"
                    onClick={() => handleDismissAlert(c.id)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Đã xem
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expiry Warning List */}
      {warningList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Cảnh báo hết hạn ({warningList.length} khách)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {warningList.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {c.remaining < 0 ? (
                      <Badge variant="destructive" className="shrink-0">
                        Hết hạn {Math.abs(c.remaining)}d
                      </Badge>
                    ) : c.remaining === 0 ? (
                      <Badge
                        variant="destructive"
                        className="shrink-0 animate-pulse"
                      >
                        Hôm nay
                      </Badge>
                    ) : c.remaining <= 3 ? (
                      <Badge className="shrink-0 bg-orange-500">
                        Còn {c.remaining}d
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="shrink-0 bg-yellow-100 text-yellow-700"
                      >
                        Còn {c.remaining}d
                      </Badge>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {c.name}
                        {c.is_trial && (
                          <span className="ml-1 text-xs text-orange-500">
                            (Trial)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.email} · {c.workspace?.name ?? "N/A"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 ml-2"
                    onClick={() => copyRenewMessage(c)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Nhắc gia hạn
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {warningList.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Không có khách hàng nào sắp hết hạn trong 3 ngày tới
          </CardContent>
        </Card>
      )}
    </div>
  );
}
