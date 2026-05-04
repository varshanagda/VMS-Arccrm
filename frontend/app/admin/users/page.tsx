"use client";

import { useEffect, useMemo, useState } from "react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardPageHeader } from "@/components/layout/DashboardPageHeader";
import AppDataGrid, {
  GridColDef,
  type GridRenderCellParams,
} from "@/components/ui/app-data-grid";
import { apiFetch } from "@/lib/api";
import { useAuthGuard } from "@/lib/use-auth-guard";

type EmployeeRow = {
  id: number;
  name: string;
  email?: string | null;
  department?: string | null;
  role?: string | null;
};

export default function UserManagementPage() {
  const user = useAuthGuard({ allowedRoles: ["admin", "superadmin"] });
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const data = await apiFetch<EmployeeRow[]>("/employees/hosts");
        if (!mounted) return;
        setRows(data ?? []);
      } catch {
        if (!mounted) return;
        setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [user]);

  const roleOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.role).filter(Boolean))).sort() as string[],
    [rows]
  );

  const deptOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.department ?? "General").filter(Boolean))).sort() as string[],
    [rows]
  );

  const columns: GridColDef<EmployeeRow>[] = useMemo(
    () => [
      {
        field: "name",
        headerName: "Name",
        flex: 1,
        minWidth: 160,
        filterable: true,
        renderCell: (params: GridRenderCellParams<EmployeeRow>) => (
          <span className="block truncate font-medium">{String(params.row.name ?? "-")}</span>
        ),
      },
      {
        field: "role",
        headerName: "Role",
        flex: 1,
        minWidth: 140,
        filterable: true,
        type: "singleSelect",
        valueOptions: roleOptions,
        renderCell: (params: GridRenderCellParams<EmployeeRow>) => (
          <span className="capitalize">{String(params.row.role ?? "-")}</span>
        ),
      },
      {
        field: "department",
        headerName: "Department",
        flex: 1,
        minWidth: 140,
        filterable: true,
        type: "singleSelect",
        valueOptions: deptOptions,
        renderCell: (params: GridRenderCellParams<EmployeeRow>) => (
          <span>{String(params.row.department ?? "General")}</span>
        ),
      },
    ],
    [roleOptions, deptOptions]
  );

  if (!user) return null;

  return (
    <DashboardLayout user={user}>
      <DashboardPageHeader
        title="User Management"
        subtitle="Manage internal access and roles."
      />

      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)] shadow-[var(--shadow-1)]">
        <div className="flex-1 overflow-x-auto min-h-[400px]">
          <AppDataGrid
            rows={rows}
            columns={columns}
            getRowId={(row) => row.id}
            loading={loading}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
