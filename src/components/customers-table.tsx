"use client";

import { useEffect, useMemo, useState } from "react";
import { daysLeft, todayStr } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CalendarPlus,
  Download,
  Edit3,
  FolderPlus,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CustomerWithWorkspace, Workspace } from "@/lib/types/database";

interface CustomersTableProps {
  customers: CustomerWithWorkspace[];
  workspaces: Workspace[];
  onRefresh: () => void;
}

export function CustomersTable({
  customers,
  workspaces,
  onRefresh,
}: CustomersTableProps) {
  const [localCustomers, setLocalCustomers] =
    useState<CustomerWithWorkspace[]>(customers);
  const [search, setSearch] = useState("");
  const [expiryFilter, setExpiryFilter] = useState<
    "all" | "workspaceDue3" | "workspaceDue1"
  >("all");

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addWorkspaceModalOpen, setAddWorkspaceModalOpen] = useState(false);
  const [editWorkspaceModalOpen, setEditWorkspaceModalOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addingWorkspace, setAddingWorkspace] = useState(false);
  const [updatingWorkspace, setUpdatingWorkspace] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [savingStartDateId, setSavingStartDateId] = useState<string | null>(
    null,
  );
  const [deleteWorkspaceConfirm, setDeleteWorkspaceConfirm] =
    useState<Workspace | null>(null);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(
    null,
  );
  const [deleteConfirm, setDeleteConfirm] =
    useState<CustomerWithWorkspace | null>(null);

  useEffect(() => {
    setLocalCustomers(customers);
  }, [customers]);

  const [newCustomer, setNewCustomer] = useState({
    name: "",
    email: "",
    workspace_id: "",
    start_date: todayStr(),
  });

  const [newWorkspace, setNewWorkspace] = useState({
    name: "",
    accountId: "",
    registrationDate: todayStr(),
  });

  const [editWorkspace, setEditWorkspace] = useState({
    name: "",
    accountId: "",
    registrationDate: todayStr(),
  });

  const toLocalDate = (ymd: string) => {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const workspaceDaysLeft = (createdAt: string) => {
    const registrationDate = createdAt.slice(0, 10);
    const start = toLocalDate(registrationDate);
    const expiry = new Date(start);
    expiry.setDate(expiry.getDate() + 33);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Math.round((expiry.getTime() - today.getTime()) / 86400000);
  };

  const renderWorkspaceRemaining = (createdAt: string) => {
    const remaining = workspaceDaysLeft(createdAt);

    if (remaining < 0) {
      return <Badge variant="destructive">Hết hạn workspace</Badge>;
    }

    if (remaining <= 1) {
      return (
        <Badge className="bg-red-600 text-white">Còn {remaining} ngày</Badge>
      );
    }

    if (remaining <= 3) {
      return (
        <Badge className="bg-amber-500 text-white">Còn {remaining} ngày</Badge>
      );
    }

    return <Badge variant="secondary">Còn {remaining} ngày</Badge>;
  };

  const shortAccountId = (accountId: string) => {
    if (!accountId) return "";
    if (accountId.length <= 16) return accountId;
    return `${accountId.slice(0, 6)}...${accountId.slice(-4)}`;
  };

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      alert(`Không thể copy ${label}`);
    }
  };

  const isDataWorkspace = (name?: string | null) =>
    (name || "").trim().toLowerCase() === "data";

  const filteredCustomers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return localCustomers.filter((customer) => {
      if (isDataWorkspace(customer.workspace?.name)) {
        return false;
      }

      const workspaceRemaining = customer.workspace?.created_at
        ? (() => {
            const registrationDate = customer.workspace.created_at.slice(0, 10);
            const start = toLocalDate(registrationDate);
            const expiry = new Date(start);
            expiry.setDate(expiry.getDate() + 33);

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            return Math.round((expiry.getTime() - today.getTime()) / 86400000);
          })()
        : null;

      const matchesSearch =
        keyword.length === 0 ||
        customer.name.toLowerCase().includes(keyword) ||
        customer.email.toLowerCase().includes(keyword) ||
        (customer.workspace?.name || "").toLowerCase().includes(keyword) ||
        (customer.workspace?.account_id || "").toLowerCase().includes(keyword);

      const matchesExpiry =
        expiryFilter === "all" ||
        (expiryFilter === "workspaceDue1" &&
          workspaceRemaining !== null &&
          workspaceRemaining >= 0 &&
          workspaceRemaining <= 1) ||
        (expiryFilter === "workspaceDue3" &&
          workspaceRemaining !== null &&
          workspaceRemaining >= 0 &&
          workspaceRemaining <= 3);

      return matchesSearch && matchesExpiry;
    });
  }, [localCustomers, search, expiryFilter]);

  const visibleWorkspaceList = useMemo(
    () => workspaces.filter((ws) => !isDataWorkspace(ws.name)),
    [workspaces],
  );

  const activeWorkspaces = visibleWorkspaceList.filter(
    (w) => w.status === "active",
  );

  const groupedByWorkspace = useMemo(() => {
    const map = new Map<string, CustomerWithWorkspace[]>();
    for (const customer of filteredCustomers) {
      const key = customer.workspace_id || "unknown";
      const current = map.get(key) || [];
      current.push(customer);
      map.set(key, current);
    }
    return map;
  }, [filteredCustomers]);

  const hasFilter = search.trim().length > 0 || expiryFilter !== "all";
  const visibleWorkspaces = hasFilter
    ? visibleWorkspaceList.filter(
        (ws) => (groupedByWorkspace.get(ws.id) || []).length > 0,
      )
    : visibleWorkspaceList;
  const unknownCustomers = groupedByWorkspace.get("unknown") || [];

  const openAddMember = (workspaceId: string) => {
    setNewCustomer({
      name: "",
      email: "",
      workspace_id: workspaceId,
      start_date: todayStr(),
    });
    setAddModalOpen(true);
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name || !newCustomer.email || !newCustomer.workspace_id) {
      alert("Vui lòng nhập đầy đủ thông tin");
      return;
    }

    setAdding(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCustomer.name,
          email: newCustomer.email,
          workspace_id: newCustomer.workspace_id,
          start_date: newCustomer.start_date,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setAddModalOpen(false);
        setNewCustomer({
          name: "",
          email: "",
          workspace_id: "",
          start_date: todayStr(),
        });
        onRefresh();
      } else {
        alert(`Lỗi: ${data.error}`);
      }
    } catch {
      alert("Không thể thêm khách hàng");
    } finally {
      setAdding(false);
    }
  };

  const handleAddWorkspace = async () => {
    if (!newWorkspace.accountId.trim()) {
      alert("Vui lòng nhập account ID");
      return;
    }

    setAddingWorkspace(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWorkspace.name.trim() || undefined,
          accountId: newWorkspace.accountId.trim(),
          registrationDate: newWorkspace.registrationDate,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setAddWorkspaceModalOpen(false);
        setNewWorkspace({
          name: "",
          accountId: "",
          registrationDate: todayStr(),
        });
        onRefresh();
      } else {
        alert(`Lỗi: ${data.error}`);
      }
    } catch {
      alert("Không thể thêm workspace");
    } finally {
      setAddingWorkspace(false);
    }
  };

  const handleRenew = async (customer: CustomerWithWorkspace) => {
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_date: todayStr() }),
      });

      if (res.ok) {
        onRefresh();
      } else {
        const data = await res.json();
        alert(`Lỗi: ${data.error}`);
      }
    } catch {
      alert("Không thể gia hạn");
    }
  };

  const handleDelete = async (customer: CustomerWithWorkspace) => {
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteConfirm(null);
        onRefresh();
      } else {
        const data = await res.json();
        alert(`Lỗi: ${data.error}`);
      }
    } catch {
      alert("Không thể xóa khách hàng");
    }
  };

  const handleDeleteWorkspace = async (workspace: Workspace) => {
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteWorkspaceConfirm(null);
        onRefresh();
      } else {
        const data = await res.json();
        alert(`Lỗi: ${data.error}`);
      }
    } catch {
      alert("Không thể đưa workspace vào thùng rác");
    }
  };

  const openEditWorkspace = (workspace: Workspace) => {
    setEditingWorkspace(workspace);
    setEditWorkspace({
      name: workspace.name || "",
      accountId: workspace.account_id || "",
      registrationDate: workspace.created_at.slice(0, 10),
    });
    setEditWorkspaceModalOpen(true);
  };

  const handleUpdateWorkspace = async () => {
    if (!editingWorkspace) return;

    const safeName = editWorkspace.name.trim();
    const safeAccountId = editWorkspace.accountId.trim();
    const safeRegistrationDate = editWorkspace.registrationDate.trim();

    if (!safeName || !safeAccountId || !safeRegistrationDate) {
      alert("Vui lòng nhập đầy đủ tên workspace, Account ID và ngày đăng ký");
      return;
    }

    setUpdatingWorkspace(true);
    try {
      const res = await fetch(`/api/workspaces/${editingWorkspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: safeName,
          accountId: safeAccountId,
          registrationDate: safeRegistrationDate,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setEditWorkspaceModalOpen(false);
        setEditingWorkspace(null);
        onRefresh();
      } else {
        alert(`Lỗi: ${data.error}`);
      }
    } catch {
      alert("Không thể cập nhật workspace");
    } finally {
      setUpdatingWorkspace(false);
    }
  };

  const handleUpdateStartDate = async (
    customerId: string,
    startDate: string,
  ) => {
    if (!startDate) return;

    setSavingStartDateId(customerId);
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_date: startDate }),
      });

      if (res.ok) {
        onRefresh();
      } else {
        const data = await res.json();
        alert(`Lỗi: ${data.error}`);
      }
    } catch {
      alert("Không thể cập nhật ngày mua");
    } finally {
      setSavingStartDateId(null);
    }
  };

  const handleToggleTrial = async (customer: CustomerWithWorkspace) => {
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_trial: !customer.is_trial }),
      });

      if (res.ok) {
        const data = await res.json();
        const updated = data.customer as
          | Partial<CustomerWithWorkspace>
          | undefined;

        if (updated) {
          setLocalCustomers((prev) =>
            prev.map((c) =>
              c.id === customer.id
                ? {
                    ...c,
                    ...updated,
                    // PATCH /api/customers/[id] currently returns customer row without workspace join.
                    workspace: c.workspace,
                  }
                : c,
            ),
          );
        }
      } else {
        const data = await res.json();
        alert(`Lỗi: ${data.error}`);
      }
    } catch {
      alert("Không thể cập nhật nhãn trial");
    }
  };

  const daysLeftFromExpiry = (expiryDate: string) => {
    const [y, m, d] = expiryDate.split("-").map(Number);
    const expiry = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((expiry.getTime() - today.getTime()) / 86400000);
  };

  const handleExportCustomers = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/customers/export");
      if (!res.ok) {
        let message = "Không thể xuất dữ liệu";
        try {
          const data = await res.json();
          message = data.error || message;
        } catch {
          // ignore json parse failure
        }
        alert(`Lỗi: ${message}`);
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `customers-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Không thể xuất dữ liệu");
    } finally {
      setExporting(false);
    }
  };

  const renderRemaining = (customer: CustomerWithWorkspace) => {
    const remaining = customer.expiry_date
      ? daysLeftFromExpiry(customer.expiry_date)
      : daysLeft(customer.start_date, customer.is_trial);

    if (remaining < 0) {
      return <Badge variant="destructive">Hết hạn</Badge>;
    }

    if (remaining <= 3) {
      return (
        <span className="font-semibold text-red-600">{remaining} ngày</span>
      );
    }

    if (remaining <= 7) {
      return (
        <span className="font-medium text-amber-600">{remaining} ngày</span>
      );
    }

    return <span className="text-green-600">{remaining} ngày</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:max-w-2xl">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên, email, workspace..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select
            value={expiryFilter}
            onValueChange={(value: "all" | "workspaceDue3" | "workspaceDue1") =>
              setExpiryFilter(value)
            }
          >
            <SelectTrigger className="w-full sm:w-45">
              <SelectValue placeholder="Lọc hạn workspace" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="workspaceDue1">
                Workspace còn 1 ngày (đỏ)
              </SelectItem>
              <SelectItem value="workspaceDue3">
                Workspace còn 3 ngày (vàng)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap">
          <Button
            variant="outline"
            onClick={onRefresh}
            className="flex-1 sm:flex-none"
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Làm mới
          </Button>

          <Button
            variant="outline"
            onClick={handleExportCustomers}
            disabled={exporting}
            className="flex-1 sm:flex-none"
          >
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Xuất dữ liệu
          </Button>

          <Dialog
            open={addWorkspaceModalOpen}
            onOpenChange={setAddWorkspaceModalOpen}
          >
            <DialogTrigger asChild>
              <Button variant="outline" className="flex-1 sm:flex-none">
                <FolderPlus className="mr-2 h-4 w-4" />
                Thêm workspace
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Thêm workspace</DialogTitle>
                <DialogDescription>
                  Tạo workspace thủ công ngay trong trang khách hàng.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="workspace-name">
                    Tên workspace (tùy chọn)
                  </Label>
                  <Input
                    id="workspace-name"
                    value={newWorkspace.name}
                    onChange={(e) =>
                      setNewWorkspace({
                        ...newWorkspace,
                        name: e.target.value,
                      })
                    }
                    placeholder="Workspace Premium 1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workspace-account">
                    Thông tin tài khoản (Account ID)
                  </Label>
                  <Input
                    id="workspace-account"
                    value={newWorkspace.accountId}
                    onChange={(e) =>
                      setNewWorkspace({
                        ...newWorkspace,
                        accountId: e.target.value,
                      })
                    }
                    placeholder="acc_..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workspace-date">Ngày đăng ký workspace</Label>
                  <Input
                    id="workspace-date"
                    type="date"
                    value={newWorkspace.registrationDate}
                    onChange={(e) =>
                      setNewWorkspace({
                        ...newWorkspace,
                        registrationDate: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setAddWorkspaceModalOpen(false)}
                >
                  Hủy
                </Button>
                <Button onClick={handleAddWorkspace} disabled={addingWorkspace}>
                  {addingWorkspace && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Lưu workspace
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={editWorkspaceModalOpen}
            onOpenChange={(open) => {
              setEditWorkspaceModalOpen(open);
              if (!open) setEditingWorkspace(null);
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Sửa workspace</DialogTitle>
                <DialogDescription>
                  Cập nhật tên workspace, Account ID và ngày đăng ký.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-workspace-name">Tên workspace</Label>
                  <Input
                    id="edit-workspace-name"
                    value={editWorkspace.name}
                    onChange={(e) =>
                      setEditWorkspace({
                        ...editWorkspace,
                        name: e.target.value,
                      })
                    }
                    placeholder="Workspace Premium 1"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-workspace-account">
                    Thông tin tài khoản (Account ID)
                  </Label>
                  <Input
                    id="edit-workspace-account"
                    value={editWorkspace.accountId}
                    onChange={(e) =>
                      setEditWorkspace({
                        ...editWorkspace,
                        accountId: e.target.value,
                      })
                    }
                    placeholder="acc_..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-workspace-date">
                    Ngày đăng ký workspace
                  </Label>
                  <Input
                    id="edit-workspace-date"
                    type="date"
                    value={editWorkspace.registrationDate}
                    onChange={(e) =>
                      setEditWorkspace({
                        ...editWorkspace,
                        registrationDate: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setEditWorkspaceModalOpen(false)}
                >
                  Hủy
                </Button>
                <Button
                  onClick={handleUpdateWorkspace}
                  disabled={updatingWorkspace}
                >
                  {updatingWorkspace && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Lưu thay đổi
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Thêm khách hàng</DialogTitle>
                <DialogDescription>
                  Lưu dữ liệu khách hàng thủ công để quản lý gia hạn.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="customer-name">Tên khách</Label>
                  <Input
                    id="customer-name"
                    value={newCustomer.name}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, name: e.target.value })
                    }
                    placeholder="Nguyen Van A"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer-email">Email</Label>
                  <Input
                    id="customer-email"
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, email: e.target.value })
                    }
                    placeholder="email@gmail.com"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="customer-workspace">Workspace</Label>
                    <Select
                      value={newCustomer.workspace_id}
                      onValueChange={(workspaceId) =>
                        setNewCustomer({
                          ...newCustomer,
                          workspace_id: workspaceId,
                        })
                      }
                    >
                      <SelectTrigger id="customer-workspace" disabled>
                        <SelectValue placeholder="Chọn workspace" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeWorkspaces.map((workspace) => (
                          <SelectItem key={workspace.id} value={workspace.id}>
                            {workspace.name &&
                            workspace.name !== workspace.account_id
                              ? `${workspace.name} (${shortAccountId(workspace.account_id)})`
                              : `Workspace (${shortAccountId(workspace.account_id)})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customer-start-date">Ngày bắt đầu</Label>
                    <Input
                      id="customer-start-date"
                      type="date"
                      value={newCustomer.start_date}
                      onChange={(e) =>
                        setNewCustomer({
                          ...newCustomer,
                          start_date: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setAddModalOpen(false)}
                >
                  Hủy
                </Button>
                <Button onClick={handleAddCustomer} disabled={adding}>
                  {adding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Lưu khách hàng
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {activeWorkspaces.length === 0 && (
        <Card className="border-amber-300 bg-amber-50/40">
          <CardContent className="py-4 text-amber-700">
            Chưa có workspace sẵn sàng. Hãy tạo workspace trước khi thêm khách.
          </CardContent>
        </Card>
      )}

      {visibleWorkspaces.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Không có workspace phù hợp bộ lọc hiện tại.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {visibleWorkspaces.map((workspace) => {
            const customersInWorkspace =
              groupedByWorkspace.get(workspace.id) || [];

            return (
              <Card key={workspace.id}>
                <CardContent className="pt-6">
                  <div className="mb-4 space-y-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="max-w-80 truncate text-lg font-semibold">
                            {workspace.name &&
                            workspace.name !== workspace.account_id
                              ? workspace.name
                              : `Workspace (${shortAccountId(workspace.account_id)})`}
                          </h3>
                          <Badge variant="outline" className="shrink-0">
                            ID: {shortAccountId(workspace.account_id)}
                          </Badge>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 shrink-0 px-2 text-xs"
                            onClick={() =>
                              void handleCopy(
                                workspace.account_id,
                                "Account ID",
                              )
                            }
                          >
                            Copy ID
                          </Button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">
                            Đăng ký:{" "}
                            {new Date(workspace.created_at).toLocaleDateString(
                              "vi-VN",
                            )}
                          </Badge>
                          {renderWorkspaceRemaining(workspace.created_at)}
                          <Badge variant="secondary">
                            {customersInWorkspace.length} thành viên
                          </Badge>
                        </div>
                      </div>

                      <div className="flex w-full items-center justify-end gap-2 lg:w-auto">
                        <Button
                          size="sm"
                          className="flex-1 sm:flex-none"
                          onClick={() => openAddMember(workspace.id)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Thêm thành viên
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-9 w-9"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => openEditWorkspace(workspace)}
                            >
                              <Edit3 className="mr-2 h-4 w-4" />
                              Sửa workspace
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() =>
                                setDeleteWorkspaceConfirm(workspace)
                              }
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Xóa workspace
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>

                  {customersInWorkspace.length === 0 ? (
                    <div className="py-6 text-sm text-muted-foreground">
                      Chưa có thành viên trong workspace này.
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 sm:hidden">
                        {customersInWorkspace.map((customer) => (
                          <div
                            key={customer.id}
                            className="rounded-lg border bg-background p-3"
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="truncate font-medium">
                                  {customer.name}
                                </span>
                                {customer.is_trial && (
                                  <Badge className="bg-orange-500 text-white">
                                    Trial
                                  </Badge>
                                )}
                              </div>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {renderRemaining(customer)}
                              </span>
                            </div>

                            <div className="mb-2 flex items-center gap-2">
                              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                                {customer.email}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() =>
                                  void handleCopy(customer.email, "email")
                                }
                              >
                                Copy
                              </Button>
                            </div>

                            <div className="mb-3">
                              <Input
                                type="date"
                                defaultValue={customer.start_date}
                                className="h-8"
                                disabled={savingStartDateId === customer.id}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (
                                    value &&
                                    value !== customer.start_date &&
                                    savingStartDateId !== customer.id
                                  ) {
                                    void handleUpdateStartDate(
                                      customer.id,
                                      value,
                                    );
                                  }
                                }}
                              />
                            </div>

                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRenew(customer)}
                                title="Gia hạn thêm 1 tháng từ hôm nay"
                              >
                                <CalendarPlus className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant={
                                  customer.is_trial ? "default" : "outline"
                                }
                                onClick={() => handleToggleTrial(customer)}
                                title={
                                  customer.is_trial
                                    ? "Bỏ nhãn trial (reset còn 30 ngày)"
                                    : "Gán nhãn trial (35 ngày)"
                                }
                              >
                                Trial
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => setDeleteConfirm(customer)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="hidden w-full overflow-x-auto sm:block">
                        <Table className="min-w-190">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Tên</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Ngày mua</TableHead>
                              <TableHead>Còn lại</TableHead>
                              <TableHead className="text-right">
                                Hành động
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {customersInWorkspace.map((customer) => {
                              return (
                                <TableRow key={customer.id}>
                                  <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                      <span>{customer.name}</span>
                                      {customer.is_trial && (
                                        <Badge className="bg-orange-500 text-white">
                                          Trial
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <span className="max-w-55 truncate">
                                        {customer.email}
                                      </span>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2 text-xs"
                                        onClick={() =>
                                          void handleCopy(
                                            customer.email,
                                            "email",
                                          )
                                        }
                                      >
                                        Copy
                                      </Button>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      type="date"
                                      defaultValue={customer.start_date}
                                      className="h-8 w-37"
                                      disabled={
                                        savingStartDateId === customer.id
                                      }
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        if (
                                          value &&
                                          value !== customer.start_date &&
                                          savingStartDateId !== customer.id
                                        ) {
                                          void handleUpdateStartDate(
                                            customer.id,
                                            value,
                                          );
                                        }
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    {renderRemaining(customer)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleRenew(customer)}
                                        title="Gia hạn thêm 1 tháng từ hôm nay"
                                      >
                                        <CalendarPlus className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant={
                                          customer.is_trial
                                            ? "default"
                                            : "outline"
                                        }
                                        className="px-2 sm:px-3"
                                        onClick={() =>
                                          handleToggleTrial(customer)
                                        }
                                        title={
                                          customer.is_trial
                                            ? "Bỏ nhãn trial (reset còn 30 ngày)"
                                            : "Gán nhãn trial (35 ngày)"
                                        }
                                      >
                                        <span className="sm:hidden">T</span>
                                        <span className="hidden sm:inline">
                                          Trial
                                        </span>
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-destructive"
                                        onClick={() =>
                                          setDeleteConfirm(customer)
                                        }
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {unknownCustomers.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="mb-4 flex items-center gap-2">
                  <h3 className="text-lg font-semibold">Không xác định</h3>
                  <Badge variant="secondary">
                    {unknownCustomers.length} thành viên
                  </Badge>
                </div>
                <div className="space-y-2 sm:hidden">
                  {unknownCustomers.map((customer) => {
                    return (
                      <div
                        key={customer.id}
                        className="rounded-lg border bg-background p-3"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate font-medium">
                              {customer.name}
                            </span>
                            {customer.is_trial && (
                              <Badge className="bg-orange-500 text-white">
                                Trial
                              </Badge>
                            )}
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {renderRemaining(customer)}
                          </span>
                        </div>

                        <div className="mb-2 flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                            {customer.email}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() =>
                              void handleCopy(customer.email, "email")
                            }
                          >
                            Copy
                          </Button>
                        </div>

                        <div className="mb-3">
                          <Input
                            type="date"
                            defaultValue={customer.start_date}
                            className="h-8"
                            disabled={savingStartDateId === customer.id}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (
                                value &&
                                value !== customer.start_date &&
                                savingStartDateId !== customer.id
                              ) {
                                void handleUpdateStartDate(customer.id, value);
                              }
                            }}
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant={customer.is_trial ? "default" : "outline"}
                            onClick={() => handleToggleTrial(customer)}
                            title={
                              customer.is_trial
                                ? "Bỏ nhãn trial (reset còn 30 ngày)"
                                : "Gán nhãn trial (35 ngày)"
                            }
                          >
                            Trial
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setDeleteConfirm(customer)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden w-full overflow-x-auto sm:block">
                  <Table className="min-w-190">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tên</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Ngày mua</TableHead>
                        <TableHead>Còn lại</TableHead>
                        <TableHead className="text-right">Hành động</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unknownCustomers.map((customer) => {
                        return (
                          <TableRow key={customer.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <span>{customer.name}</span>
                                {customer.is_trial && (
                                  <Badge className="bg-orange-500 text-white">
                                    Trial
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="max-w-55 truncate">
                                  {customer.email}
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs"
                                  onClick={() =>
                                    void handleCopy(customer.email, "email")
                                  }
                                >
                                  Copy
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="date"
                                defaultValue={customer.start_date}
                                className="h-8 w-30 sm:w-37"
                                disabled={savingStartDateId === customer.id}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (
                                    value &&
                                    value !== customer.start_date &&
                                    savingStartDateId !== customer.id
                                  ) {
                                    void handleUpdateStartDate(
                                      customer.id,
                                      value,
                                    );
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell>{renderRemaining(customer)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant={
                                    customer.is_trial ? "default" : "outline"
                                  }
                                  className="px-2 sm:px-3"
                                  onClick={() => handleToggleTrial(customer)}
                                  title={
                                    customer.is_trial
                                      ? "Bỏ nhãn trial (reset còn 30 ngày)"
                                      : "Gán nhãn trial (35 ngày)"
                                  }
                                >
                                  <span className="sm:hidden">T</span>
                                  <span className="hidden sm:inline">
                                    Trial
                                  </span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive"
                                  onClick={() => setDeleteConfirm(customer)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <AlertDialog
        open={!!deleteWorkspaceConfirm}
        onOpenChange={() => setDeleteWorkspaceConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              Workspace <strong>{deleteWorkspaceConfirm?.name}</strong> sẽ được
              đưa vào thùng rác. Bạn có thể khôi phục lại sau.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteWorkspaceConfirm &&
                handleDeleteWorkspace(deleteWorkspaceConfirm)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa khách hàng?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa <strong>{deleteConfirm?.name}</strong> (
              {deleteConfirm?.email})?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
