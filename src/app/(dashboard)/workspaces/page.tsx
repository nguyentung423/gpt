"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Plus,
  RefreshCcw,
  MoreHorizontal,
  Trash2,
  Users,
  Building2,
  AlertTriangle,
  Loader2,
  Key,
  RotateCw,
  ArrowRightLeft,
  UserPlus,
  Pencil,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Workspace } from "@/lib/types/database";

interface WorkspaceWithCount extends Workspace {
  customer_count?: number;
}

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<WorkspaceWithCount | null>(
    null,
  );
  const [sessionJson, setSessionJson] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [adding, setAdding] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [migrateSource, setMigrateSource] = useState<WorkspaceWithCount | null>(
    null,
  );
  const [migrateTarget, setMigrateTarget] = useState("");
  const [migrating, setMigrating] = useState(false);
  const [tokenUpdateWs, setTokenUpdateWs] = useState<WorkspaceWithCount | null>(
    null,
  );
  const [tokenJson, setTokenJson] = useState("");
  const [updatingToken, setUpdatingToken] = useState(false);
  const [reinviting, setReinviting] = useState<string | null>(null);
  const [renameWs, setRenameWs] = useState<WorkspaceWithCount | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editNoteValue, setEditNoteValue] = useState("");

  const fetchWorkspaces = async (runHealthCheck = false) => {
    setLoading(true);
    setError(null);
    try {
      // Run health check first (auto-marks dead workspaces)
      if (runHealthCheck) {
        try {
          const hcRes = await fetch("/api/workspaces/health-check", {
            method: "POST",
          });
          const hcData = await hcRes.json();
          if (hcRes.ok && hcData.dead > 0) {
            const deadNames = hcData.results
              .filter((r: { alive: boolean }) => !r.alive)
              .map((r: { name: string }) => r.name)
              .join(", ");
            alert(
              `⚠️ ${hcData.dead} workspace đã chết: ${deadNames}\nToken hết hạn hoặc bị thu hồi.`,
            );
          }
        } catch {
          // Health check failed, continue loading
        }
      }

      const res = await fetch("/api/workspaces");
      const data = await res.json();
      if (res.ok) {
        setWorkspaces(data.workspaces || []);
      } else {
        setError(data.error || "Failed to load workspaces");
      }
    } catch {
      setError("Không thể kết nối đến server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces(true); // Health check on initial load
  }, []);

  const handleAddWorkspace = async () => {
    if (!sessionJson.trim()) return;

    setAdding(true);
    try {
      // Parse session JSON from chatgpt.com /api/auth/session
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(sessionJson.trim());
      } catch {
        alert(
          "JSON không hợp lệ. Dán đúng nội dung từ chatgpt.com/api/auth/session",
        );
        setAdding(false);
        return;
      }

      const accessToken = parsed.accessToken as string;
      const sessionToken = parsed.sessionToken as string;
      const account = parsed.account as Record<string, unknown> | undefined;

      if (!accessToken || !sessionToken || !account?.id) {
        alert("Thiếu accessToken, sessionToken hoặc account.id trong JSON");
        setAdding(false);
        return;
      }

      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          sessionToken,
          accountId: account.id,
          organizationId: account.organizationId || "",
          name: workspaceName.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setAddModalOpen(false);
        setSessionJson("");
        setWorkspaceName("");
        fetchWorkspaces();
        const msg =
          data.importedMembers > 0
            ? `Đã thêm workspace "${data.workspace.name}" và import ${data.importedMembers} thành viên!`
            : `Đã thêm workspace: ${data.workspace.name}`;
        alert(msg);
      } else {
        alert(`Lỗi: ${data.error}`);
      }
    } catch {
      alert("Không thể thêm workspace");
    } finally {
      setAdding(false);
    }
  };

  const handleSync = async (workspaceId: string) => {
    setSyncing(workspaceId);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/sync`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        alert(
          `Đồng bộ thành công! Thêm: ${data.added}, Cập nhật: ${data.updated}, Xóa: ${data.removed}`,
        );
        fetchWorkspaces();
      } else {
        alert(`Lỗi đồng bộ: ${data.error}`);
      }
    } catch {
      alert("Không thể đồng bộ");
    } finally {
      setSyncing(null);
    }
  };

  const handleDelete = async (workspace: WorkspaceWithCount) => {
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (res.ok) {
        setDeleteConfirm(null);
        fetchWorkspaces();
      } else {
        alert(`Lỗi: ${data.error}`);
      }
    } catch {
      alert("Không thể xóa workspace");
    }
  };

  const handleToggleStatus = async (workspace: WorkspaceWithCount) => {
    const newStatus = workspace.status === "active" ? "dead" : "active";
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        fetchWorkspaces();
      }
    } catch {
      alert("Không thể cập nhật status");
    }
  };

  const handleMigrate = async () => {
    if (!migrateSource || !migrateTarget) return;

    setMigrating(true);
    try {
      const res = await fetch(`/api/workspaces/${migrateSource.id}/migrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_workspace_id: migrateTarget }),
      });

      const data = await res.json();

      if (res.ok) {
        const targetName =
          workspaces.find((w) => w.id === migrateTarget)?.name || "";
        let msg = `Đã chuyển ${data.migrated} khách từ "${migrateSource.name}" sang "${targetName}".`;
        msg += `\nGửi invite thành công: ${data.inviteSent}`;
        if (data.inviteFailed > 0) {
          msg += `\nGửi invite thất bại: ${data.inviteFailed}`;
          if (data.errors) {
            msg += `\n${data.errors.join("\n")}`;
          }
        }
        alert(msg);
        setMigrateSource(null);
        setMigrateTarget("");
        fetchWorkspaces();
      } else {
        alert(`Lỗi: ${data.error}`);
      }
    } catch {
      alert("Không thể chuyển workspace");
    } finally {
      setMigrating(false);
    }
  };

  const handleUpdateToken = async () => {
    if (!tokenUpdateWs || !tokenJson.trim()) return;
    setUpdatingToken(true);
    try {
      const res = await fetch(`/api/workspaces/${tokenUpdateWs.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_json: tokenJson.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        alert("✅ Token đã cập nhật! Workspace hoạt động lại.");
        setTokenUpdateWs(null);
        setTokenJson("");
        fetchWorkspaces();
      } else {
        alert(`Lỗi: ${data.error}`);
      }
    } catch {
      alert("Không thể cập nhật token");
    } finally {
      setUpdatingToken(false);
    }
  };

  const handleReinvite = async (workspace: WorkspaceWithCount) => {
    if (
      !confirm(
        `Mời lại tất cả thành viên đã bị xóa khỏi "${workspace.name}"?\nHệ thống sẽ gửi lại invite cho tất cả customer có trạng thái "removed".`,
      )
    )
      return;

    setReinviting(workspace.id);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/reinvite`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        let msg = `Mời lại thành công: ${data.invited}/${data.total}`;
        if (data.failed > 0) {
          msg += `\nThất bại: ${data.failed}`;
          if (data.errors) msg += `\n${data.errors.join("\n")}`;
        }
        if (data.invited === 0 && data.total === 0) {
          msg = "Không có thành viên nào có trạng thái 'removed' để mời lại.";
        }
        alert(msg);
        fetchWorkspaces();
      } else {
        alert(`Lỗi: ${data.error}`);
      }
    } catch {
      alert("Không thể mời lại thành viên");
    } finally {
      setReinviting(null);
    }
  };

  const handleRename = async () => {
    if (!renameWs || !renameName.trim()) return;
    setRenaming(true);
    try {
      const res = await fetch(`/api/workspaces/${renameWs.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameName.trim() }),
      });
      if (res.ok) {
        setRenameWs(null);
        setRenameName("");
        fetchWorkspaces();
      } else {
        const data = await res.json();
        alert(`Lỗi: ${data.error}`);
      }
    } catch {
      alert("Không thể đổi tên workspace");
    } finally {
      setRenaming(false);
    }
  };

  const handleSaveNote = async (workspace: WorkspaceWithCount) => {
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: editNoteValue.trim() }),
      });
      if (res.ok) {
        setEditingNote(null);
        fetchWorkspaces();
      } else {
        const data = await res.json();
        alert(`Lỗi: ${data.error}`);
      }
    } catch {
      alert("Không thể cập nhật ghi chú");
    }
  };

  const activeCount = workspaces.filter((w) => w.status === "active").length;
  const deadCount = workspaces.filter((w) => w.status === "dead").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workspaces</h1>
          <p className="text-muted-foreground">
            Quản lý các workspace ChatGPT Business
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => fetchWorkspaces(true)}
            disabled={loading}
          >
            <RefreshCcw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Làm mới
          </Button>
          <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Thêm Workspace
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Thêm Workspace mới</DialogTitle>
                <DialogDescription>
                  Dán JSON từ{" "}
                  <code className="bg-muted px-1 rounded">
                    chatgpt.com/api/auth/session
                  </code>{" "}
                  để thêm workspace và tự động import thành viên.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="ws-name">Tên workspace (tùy chọn)</Label>
                  <Input
                    id="ws-name"
                    placeholder="VD: Workspace 1"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="session-json">Session JSON</Label>
                  <textarea
                    id="session-json"
                    className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                    placeholder='{"accessToken":"eyJ...","sessionToken":"eyJ...","account":{"id":"..."}}'
                    value={sessionJson}
                    onChange={(e) => setSessionJson(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Mở{" "}
                    <a
                      href="https://chatgpt.com/api/auth/session"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      chatgpt.com/api/auth/session
                    </a>{" "}
                    → Copy toàn bộ JSON → Dán vào đây
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAddModalOpen(false);
                    setSessionJson("");
                    setWorkspaceName("");
                  }}
                >
                  Hủy
                </Button>
                <Button
                  onClick={handleAddWorkspace}
                  disabled={!sessionJson.trim() || adding}
                >
                  {adding ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Key className="mr-2 h-4 w-4" />
                  )}
                  Xác minh & Thêm
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Tổng Workspaces
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workspaces.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Đang hoạt động
            </CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {activeCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Đã chết</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{deadCount}</div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="py-4 text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : workspaces.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              Chưa có workspace nào. Thêm workspace bằng cách dán Session JSON
              từ chatgpt.com.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên</TableHead>
                  <TableHead>Account ID</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Ghi chú</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspaces.map((workspace) => (
                  <TableRow key={workspace.id}>
                    <TableCell className="font-medium">
                      {workspace.name}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {workspace.account_id}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          workspace.status === "active"
                            ? "default"
                            : "destructive"
                        }
                        className="cursor-pointer"
                        onClick={() => handleToggleStatus(workspace)}
                      >
                        {workspace.status === "active"
                          ? "Hoạt động"
                          : "Đã chết"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      {editingNote === workspace.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editNoteValue}
                            onChange={(e) => setEditNoteValue(e.target.value)}
                            className="h-7 text-xs"
                            placeholder="Nhập ghi chú..."
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveNote(workspace);
                              if (e.key === "Escape") setEditingNote(null);
                            }}
                            autoFocus
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleSaveNote(workspace)}
                          >
                            ✓
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => setEditingNote(null)}
                          >
                            ✗
                          </Button>
                        </div>
                      ) : (
                        <span
                          className="cursor-pointer text-xs text-muted-foreground hover:text-foreground truncate block"
                          title="Click để sửa ghi chú"
                          onClick={() => {
                            setEditingNote(workspace.id);
                            setEditNoteValue(workspace.note || "");
                          }}
                        >
                          {workspace.note || (
                            <span className="italic opacity-50">
                              Thêm ghi chú...
                            </span>
                          )}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(workspace.created_at), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleSync(workspace.id)}
                            disabled={syncing === workspace.id}
                          >
                            <RotateCw
                              className={`mr-2 h-4 w-4 ${syncing === workspace.id ? "animate-spin" : ""}`}
                            />
                            Đồng bộ thành viên
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setRenameWs(workspace);
                              setRenameName(workspace.name);
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Đổi tên
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleToggleStatus(workspace)}
                          >
                            {workspace.status === "active"
                              ? "Đánh dấu đã chết"
                              : "Đánh dấu hoạt động"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleReinvite(workspace)}
                            disabled={reinviting === workspace.id}
                          >
                            <UserPlus
                              className={`mr-2 h-4 w-4 ${reinviting === workspace.id ? "animate-spin" : ""}`}
                            />
                            Mời lại thành viên
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setTokenUpdateWs(workspace);
                              setTokenJson("");
                            }}
                          >
                            <Key className="mr-2 h-4 w-4" />
                            Cập nhật Token
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setMigrateSource(workspace);
                              setMigrateTarget("");
                            }}
                          >
                            <ArrowRightLeft className="mr-2 h-4 w-4" />
                            Chuyển khách sang WS khác
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteConfirm(workspace)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Xóa workspace
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirm */}
      <AlertDialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa workspace{" "}
              <strong>{deleteConfirm?.name}</strong>? Hành động này không thể
              hoàn tác.
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

      {/* Migrate Dialog */}
      <AlertDialog
        open={!!migrateSource}
        onOpenChange={() => {
          setMigrateSource(null);
          setMigrateTarget("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Chuyển khách hàng sang workspace khác
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tất cả khách hàng trong <strong>{migrateSource?.name}</strong> sẽ
              được chuyển sang workspace mới. Lời mời tham gia sẽ được gửi tự
              động. Workspace cũ sẽ được đánh dấu &quot;đã chết&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label>Chọn workspace đích</Label>
            <Select value={migrateTarget} onValueChange={setMigrateTarget}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Chọn workspace..." />
              </SelectTrigger>
              <SelectContent>
                {workspaces
                  .filter(
                    (w) => w.id !== migrateSource?.id && w.status === "active",
                  )
                  .map((ws) => (
                    <SelectItem key={ws.id} value={ws.id}>
                      {ws.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={migrating}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMigrate}
              disabled={!migrateTarget || migrating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {migrating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRightLeft className="mr-2 h-4 w-4" />
              )}
              Chuyển tất cả
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Dialog */}
      <Dialog
        open={!!renameWs}
        onOpenChange={() => {
          setRenameWs(null);
          setRenameName("");
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Đổi tên Workspace</DialogTitle>
            <DialogDescription>
              Nhập tên mới cho workspace <strong>{renameWs?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Tên workspace</Label>
            <Input
              className="mt-2"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRenameWs(null);
                setRenameName("");
              }}
              disabled={renaming}
            >
              Hủy
            </Button>
            <Button
              onClick={handleRename}
              disabled={!renameName.trim() || renaming}
            >
              {renaming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Token Update Dialog */}
      <Dialog
        open={!!tokenUpdateWs}
        onOpenChange={() => {
          setTokenUpdateWs(null);
          setTokenJson("");
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Cập nhật Token</DialogTitle>
            <DialogDescription>
              Workspace <strong>{tokenUpdateWs?.name}</strong> cần token mới.
              <br />
              Đăng nhập chatgpt.com → vào{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-sm">
                chatgpt.com/api/auth/session
              </code>{" "}
              → copy toàn bộ JSON paste vào đây.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Session JSON</Label>
            <textarea
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={6}
              placeholder='{"accessToken": "eyJ...", ...}'
              value={tokenJson}
              onChange={(e) => setTokenJson(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTokenUpdateWs(null);
                setTokenJson("");
              }}
              disabled={updatingToken}
            >
              Hủy
            </Button>
            <Button
              onClick={handleUpdateToken}
              disabled={!tokenJson.trim() || updatingToken}
            >
              {updatingToken && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Cập nhật Token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
