"use client";

import { useState, useMemo } from "react";
import { daysLeft, formatDate, expiryFromStart, todayStr } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { CustomerWithWorkspace, Workspace } from "@/lib/types/database";
import {
  MoreHorizontal,
  RefreshCcw,
  Copy,
  Search,
  Users,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Plus,
  Mail,
  Trash2,
  Loader2,
  UserCheck,
  Clock,
  FlaskConical,
  CalendarCheck,
} from "lucide-react";

interface CustomersTableProps {
  customers: CustomerWithWorkspace[];
  workspaces: Workspace[];
  onRefresh: () => void;
}

interface WorkspaceGroup {
  workspace: Pick<Workspace, "id" | "name" | "status"> | null;
  customers: CustomerWithWorkspace[];
}

export function CustomersTable({
  customers,
  workspaces,
  onRefresh,
}: CustomersTableProps) {
  const [search, setSearch] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] =
    useState<CustomerWithWorkspace | null>(null);
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(
    new Set(workspaces.map((w) => w.id)),
  );
  const [sending, setSending] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editDateValue, setEditDateValue] = useState("");

  // Form state for adding customer
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    email: "",
    workspace_id: "",
    start_date: new Date().toISOString().split("T")[0],
  });
  const [adding, setAdding] = useState(false);

  // Filter logic
  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const matchesSearch =
        search === "" ||
        customer.email.toLowerCase().includes(search.toLowerCase()) ||
        customer.name.toLowerCase().includes(search.toLowerCase());

      return matchesSearch;
    });
  }, [customers, search]);

  // Group customers by workspace
  const groupedByWorkspace = useMemo(() => {
    const groups: Map<string, WorkspaceGroup> = new Map();

    workspaces.forEach((ws) => {
      groups.set(ws.id, {
        workspace: { id: ws.id, name: ws.name, status: ws.status },
        customers: [],
      });
    });

    groups.set("unknown", {
      workspace: null,
      customers: [],
    });

    filteredCustomers.forEach((customer) => {
      const wsId = customer.workspace_id;
      if (groups.has(wsId)) {
        groups.get(wsId)!.customers.push(customer);
      } else {
        groups.get("unknown")!.customers.push(customer);
      }
    });

    return Array.from(groups.values()).filter((g) => g.customers.length > 0);
  }, [filteredCustomers, workspaces]);

  const toggleWorkspace = (wsId: string) => {
    setExpandedWorkspaces((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(wsId)) {
        newSet.delete(wsId);
      } else {
        newSet.add(wsId);
      }
      return newSet;
    });
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name || !newCustomer.email || !newCustomer.workspace_id) {
      alert("Vui lòng điền đầy đủ thông tin");
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
          start_date: new Date().toISOString().split("T")[0],
        });
        if (data.invited) {
          alert(`Đã thêm và gửi lời mời đến ${newCustomer.email}`);
        } else if (data.inviteError) {
          alert(
            `Đã thêm khách hàng nhưng gửi invite thất bại: ${data.inviteError}`,
          );
        } else {
          alert("Đã thêm khách hàng (không gửi được invite)");
        }
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

  const handleSendInvite = async (customer: CustomerWithWorkspace) => {
    setSending(customer.id);
    try {
      const res = await fetch(`/api/customers/${customer.id}/invite`, {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok) {
        alert(data.message || `Đã gửi lời mời đến ${customer.email}`);
        onRefresh();
      } else {
        alert(`Lỗi: ${data.error}`);
      }
    } catch {
      alert("Không thể gửi lời mời");
    } finally {
      setSending(null);
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

  const handleUpdateStartDate = async (customer: CustomerWithWorkspace) => {
    if (!editDateValue) return;
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_date: editDateValue }),
      });
      if (res.ok) {
        setEditingDate(null);
        onRefresh();
      } else {
        const data = await res.json();
        alert(`Lỗi: ${data.error}`);
      }
    } catch {
      alert("Không thể cập nhật ngày mua");
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
        onRefresh();
      } else {
        const data = await res.json();
        alert(`Lỗi: ${data.error}`);
      }
    } catch {
      alert("Không thể cập nhật trạng thái trial");
    }
  };

  const handleRenew = async (customer: CustomerWithWorkspace) => {
    const today = todayStr();
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_date: today }),
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

  const handleCopyInfo = (customer: CustomerWithWorkspace) => {
    const remaining = daysLeft(customer.start_date, customer.is_trial);
    const memberStatus =
      customer.member_status === "active"
        ? "✅ Đã kích hoạt"
        : customer.member_status === "pending"
          ? "⏳ Đang chờ"
          : "❌ Đã xóa";
    const trialLabel = customer.is_trial ? " (Trial +5 ngày)" : "";
    const message = `
📌 Thông tin tài khoản ChatGPT Business
👤 Khách hàng: ${customer.name}${trialLabel}
📧 Email: ${customer.email}
🏢 Workspace: ${customer.workspace?.name ?? "N/A"}
📅 Ngày mua: ${formatDate(customer.start_date)}
📅 Ngày hết hạn: ${formatDate(expiryFromStart(customer.start_date, customer.is_trial))}
⏰ Còn lại: ${remaining} ngày
🔘 Trạng thái: ${memberStatus}
    `.trim();

    navigator.clipboard.writeText(message);
    alert("Đã copy thông tin vào clipboard!");
  };

  const getMemberStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="default" className="bg-green-500">
            <UserCheck className="h-3 w-3 mr-1" />
            Đã kích hoạt
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Chờ xác nhận
          </Badge>
        );
      default:
        return (
          <Badge variant="destructive">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Đã xóa
          </Badge>
        );
    }
  };

  const activeWorkspaces = workspaces.filter((w) => w.status === "active");

  return (
    <div className="space-y-4">
      {/* Header with search and add button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên hoặc email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onRefresh}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Làm mới
          </Button>
          <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
            <DialogTrigger asChild>
              <Button disabled={activeWorkspaces.length === 0}>
                <Plus className="mr-2 h-4 w-4" />
                Thêm khách hàng
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Thêm khách hàng mới</DialogTitle>
                <DialogDescription>
                  Điền thông tin khách hàng. Lời mời ChatGPT Business sẽ được
                  gửi tự động.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Tên khách hàng *</Label>
                  <Input
                    id="name"
                    placeholder="Nguyễn Văn A"
                    value={newCustomer.name}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@gmail.com"
                    value={newCustomer.email}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, email: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Email này sẽ nhận lời mời tham gia ChatGPT Business
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="workspace">Workspace *</Label>
                    <Select
                      value={newCustomer.workspace_id}
                      onValueChange={(val) =>
                        setNewCustomer({ ...newCustomer, workspace_id: val })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn workspace" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeWorkspaces.map((ws) => (
                          <SelectItem key={ws.id} value={ws.id}>
                            {ws.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Ngày mua *</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={newCustomer.start_date}
                      onChange={(e) =>
                        setNewCustomer({
                          ...newCustomer,
                          start_date: e.target.value,
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Hết hạn tự động sau 30 ngày
                    </p>
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
                  Thêm khách hàng
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {activeWorkspaces.length === 0 && (
        <Card className="border-yellow-300 bg-yellow-50/50">
          <CardContent className="py-4 text-yellow-700">
            Chưa có workspace nào. Vui lòng thêm workspace trước khi thêm khách
            hàng.
          </CardContent>
        </Card>
      )}

      {/* Grouped by Workspace */}
      {groupedByWorkspace.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {search
              ? "Không tìm thấy khách hàng nào"
              : "Chưa có khách hàng nào"}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedByWorkspace.map((group) => {
            const wsId = group.workspace?.id ?? "unknown";
            const isExpanded = expandedWorkspaces.has(wsId);
            const isDead = group.workspace?.status === "dead";

            return (
              <Card
                key={wsId}
                className={isDead ? "border-red-300 bg-red-50/50" : ""}
              >
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => toggleWorkspace(wsId)}
                      className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                      <CardTitle className="text-lg flex items-center gap-2">
                        {group.workspace?.name ?? "Không xác định"}
                        {isDead && (
                          <Badge variant="destructive" className="ml-2">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Đã chết
                          </Badge>
                        )}
                        <Badge variant="secondary" className="ml-2">
                          <Users className="h-3 w-3 mr-1" />
                          {group.customers.length} khách
                        </Badge>
                      </CardTitle>
                    </button>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0">
                    <div className="rounded-lg border bg-background overflow-x-auto">
                      <Table className="table-fixed w-full">
                        <colgroup>
                          <col className="w-[20%]" />
                          <col className="w-[30%]" />
                          <col className="w-[150px]" />
                          <col className="w-[150px]" />
                          <col className="w-[100px]" />
                          <col className="w-[80px]" />
                        </colgroup>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="px-3">Tên</TableHead>
                            <TableHead className="px-3">Email</TableHead>
                            <TableHead className="px-3">Ngày mua</TableHead>
                            <TableHead className="px-3">Trạng thái</TableHead>
                            <TableHead className="px-3">Còn lại</TableHead>
                            <TableHead className="px-3 text-right">
                              Hành động
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.customers.map((customer) => {
                            const daysUntilExpiry = daysLeft(
                              customer.start_date,
                              customer.is_trial,
                            );

                            return (
                              <TableRow key={customer.id}>
                                <TableCell className="px-3 font-medium">
                                  <span className="flex items-center gap-1 truncate">
                                    <span className="truncate">
                                      {customer.name}
                                    </span>
                                    {customer.is_trial && (
                                      <Badge
                                        variant="outline"
                                        className="ml-1 shrink-0 text-xs border-orange-400 text-orange-500"
                                      >
                                        Trial
                                      </Badge>
                                    )}
                                  </span>
                                </TableCell>
                                <TableCell className="px-3">
                                  <span
                                    className="block truncate"
                                    title={customer.email}
                                  >
                                    {customer.email}
                                  </span>
                                </TableCell>
                                <TableCell className="px-3">
                                  {editingDate === customer.id ? (
                                    <div className="flex items-center gap-1">
                                      <Input
                                        type="date"
                                        value={editDateValue}
                                        onChange={(e) =>
                                          setEditDateValue(e.target.value)
                                        }
                                        className="h-7 w-36 text-xs"
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter")
                                            handleUpdateStartDate(customer);
                                          if (e.key === "Escape")
                                            setEditingDate(null);
                                        }}
                                        autoFocus
                                      />
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 w-7 p-0 text-green-600"
                                        onClick={() =>
                                          handleUpdateStartDate(customer)
                                        }
                                      >
                                        ✓
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 w-7 p-0 text-red-500"
                                        onClick={() => setEditingDate(null)}
                                      >
                                        ✕
                                      </Button>
                                    </div>
                                  ) : (
                                    <span
                                      className="cursor-pointer hover:underline hover:text-blue-600"
                                      title="Click để sửa ngày mua"
                                      onClick={() => {
                                        setEditingDate(customer.id);
                                        setEditDateValue(customer.start_date);
                                      }}
                                    >
                                      {formatDate(customer.start_date)}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="px-3">
                                  {getMemberStatusBadge(customer.member_status)}
                                </TableCell>
                                <TableCell className="px-3">
                                  {daysUntilExpiry < 0 ? (
                                    <Badge variant="destructive">Hết hạn</Badge>
                                  ) : daysUntilExpiry <= 3 ? (
                                    <span className="font-semibold text-red-600">
                                      {daysUntilExpiry} ngày
                                    </span>
                                  ) : daysUntilExpiry <= 10 ? (
                                    <span className="font-medium text-yellow-600">
                                      {daysUntilExpiry} ngày
                                    </span>
                                  ) : (
                                    <span className="text-green-600">
                                      {daysUntilExpiry} ngày
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="px-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {customer.member_status !== "active" && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          handleSendInvite(customer)
                                        }
                                        disabled={sending === customer.id}
                                        title="Gửi lại lời mời"
                                      >
                                        {sending === customer.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Mail className="h-4 w-4" />
                                        )}
                                      </Button>
                                    )}
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          className="h-8 w-8 p-0"
                                        >
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>
                                          Hành động
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleCopyInfo(customer)
                                          }
                                        >
                                          <Copy className="mr-2 h-4 w-4" />
                                          Copy thông tin
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => handleRenew(customer)}
                                        >
                                          <CalendarCheck className="mr-2 h-4 w-4" />
                                          Gia hạn (+30 ngày)
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleToggleTrial(customer)
                                          }
                                        >
                                          <FlaskConical className="mr-2 h-4 w-4" />
                                          {customer.is_trial
                                            ? "Gỡ dấu Trial"
                                            : "Đánh dấu Trial"}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          className="text-destructive"
                                          onClick={() =>
                                            setDeleteConfirm(customer)
                                          }
                                        >
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          Xóa khách hàng
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirm */}
      <AlertDialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa khách hàng?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa <strong>{deleteConfirm?.name}</strong> (
              {deleteConfirm?.email})? Người này cũng sẽ bị xóa khỏi workspace
              ChatGPT Business. Hành động này không thể hoàn tác.
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
