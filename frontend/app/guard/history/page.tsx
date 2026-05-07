"use client";

import { useEffect, useMemo, useState } from "react";

import { Panel } from "@/components/dashboard/panels";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardPageHeader } from "@/components/layout/DashboardPageHeader";
import EntryDeskHeader from "@/components/entry-desk/entry-desk-header";
import AppDataGrid, {
  GridColDef,
  type GridRenderCellParams,
} from "@/components/ui/app-data-grid";
import { apiFetch, resolveApiAssetUrl } from "@/lib/api";
import { useAuthGuard } from "@/lib/use-auth-guard";

interface VisitHistoryItem {
  visit_id: number;
  visitor_id: number;
  visitor_name: string;
  visitor_phone?: string;
  visitor_email?: string;
  company?: string;
  photo_url?: string;
  host_employee_id?: number | null;
  purpose?: string;
  created_at?: string | null;
  checkin_time?: string | null;
  checkout_time?: string | null;
  status: string;
}

export default function ReceptionHistoryPage() {
  const user = useAuthGuard({ allowedRoles: ["guard", "admin", "superadmin"] });
  const [history, setHistory] = useState<VisitHistoryItem[]>([]);
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  type VisitHistoryValueGetterParams = { row: VisitHistoryItem };

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case "approved":
        return "border-emerald-300/60 bg-emerald-500/15 text-emerald-400";
      case "pending":
        return "border-amber-300/60 bg-amber-500/15 text-amber-400";
      case "rejected":
        return "border-red-300/60 bg-red-500/15 text-red-400";
      case "IN":
        return "border-orange-500/50 bg-orange-500/20 text-orange-400 font-bold shadow-[0_0_10px_rgba(249,115,22,0.15)]";
      case "OUT":
        return "border-sky-500/50 bg-sky-500/20 text-sky-400 font-bold shadow-[0_0_10px_rgba(14,165,233,0.15)]";
      default:
        return "border-[var(--border-1)] bg-[var(--surface-2)] text-[var(--text-2)]";
    }
  };
  const statusLabel = (status: string) => {
    if (status === "checked_in" || status === "IN") return "IN";
    if (status === "checked_out" || status === "OUT") return "OUT";
    return status.replace(/_/g, " ");
  };
  const statusOptions = ["approved", "pending", "rejected", "IN", "OUT"];

  useEffect(() => {
    if (!user) return;
    void loadHistory();
  }, [user]);

  async function loadHistory() {
    setLoading(true);
    try {
      const data = await apiFetch<VisitHistoryItem[]>("/visit/history");
      const mappedData = data.map(item => ({
        ...item,
        status: item.status === "checked_in" ? "IN" : item.status === "checked_out" ? "OUT" : item.status
      }));
      setHistory(mappedData);
      setMessage("");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load history");
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }

  const historyWithPhotos = useMemo(() => {
    return [...history]
      .sort((a, b) => b.visit_id - a.visit_id)
      .map((item) => ({
        ...item,
        photo: resolveApiAssetUrl(item.photo_url),
      }));
  }, [history]);

  const columns: GridColDef<VisitHistoryItem & { photo?: string | null }>[] = [
    {
      field: "photo",
      headerName: "Photo",
      width: 104,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<VisitHistoryItem & { photo?: string | null }>) =>
        params.value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <button
            type="button"
            onClick={() => setPreviewPhoto(params.value as string)}
            className="group h-10 w-10 overflow-hidden rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)]"
          >
            <img
              src={params.value as string}
              alt={params.row.visitor_name}
              className="h-10 w-10 object-cover transition group-hover:scale-105"
            />
          </button>
        ) : (
          <div className="h-10 w-10 rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)]" />
        ),
    },
    {
      field: "visitor_name",
      headerName: "Visitor",
      flex: 1,
      minWidth: 190,
      renderCell: (params: GridRenderCellParams<VisitHistoryItem>) => (
        <span className="block truncate">{params.row.visitor_name}</span>
      ),
    },
    {
      field: "purpose",
      headerName: "Purpose",
      type: "string",
      flex: 1,
      minWidth: 160,
      valueGetter: ((params: VisitHistoryValueGetterParams) =>
        String(params?.row?.purpose ?? "").trim().toLowerCase()),
      renderCell: (params: GridRenderCellParams<VisitHistoryItem>) => (
        <span className="block truncate">{String(params?.row?.purpose ?? "").trim() || "-"}</span>
      ),
    },
    {
      field: "status",
      headerName: "Status",
      type: "singleSelect",
      valueOptions: statusOptions,
      width: 150,
      minWidth: 150,
      filterable: true,
      valueFormatter: ((value) =>
        statusLabel(String(value ?? ""))),
      renderCell: (params: GridRenderCellParams<VisitHistoryItem>) => (
        <div className="min-w-0">
          <span className={`inline-flex max-w-full items-center rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap ${statusBadgeClass(params?.row?.status ?? "")}`}>
            <span className="truncate">
              {statusLabel(String(params?.row?.status ?? "-"))}
            </span>
          </span>
        </div>
      ),
    },
    {
      field: "checkin_time",
      headerName: "IN",
      flex: 1,
      minWidth: 180,
      filterable: false,
      valueGetter: ((params: VisitHistoryValueGetterParams) => params?.row?.checkin_time ?? null),
      valueFormatter: ((value) =>
        value ? new Date(value as string).toLocaleString() : "-"),
      renderCell: (params: GridRenderCellParams<VisitHistoryItem>) => (
        <span className="block truncate">
          {params?.row?.checkin_time ? new Date(params.row.checkin_time).toLocaleString() : "-"}
        </span>
      ),
    },
    {
      field: "checkout_time",
      headerName: "OUT",
      flex: 1,
      minWidth: 180,
      filterable: false,
      valueGetter: ((params: VisitHistoryValueGetterParams) => params?.row?.checkout_time ?? null),
      valueFormatter: ((value) =>
        value ? new Date(value as string).toLocaleString() : "-"),
      renderCell: (params: GridRenderCellParams<VisitHistoryItem>) => (
        <span className="block truncate">
          {params?.row?.checkout_time ? new Date(params.row.checkout_time).toLocaleString() : "-"}
        </span>
      ),
    },
    {
      field: "created_at",
      headerName: "Created",
      width: 140,
      minWidth: 140,
      filterable: true,
      valueGetter: ((params: VisitHistoryValueGetterParams) => params?.row?.created_at ?? null),
      valueFormatter: ((value) =>
        value ? new Date(value as string).toLocaleDateString() : "-"),
      renderCell: (params: GridRenderCellParams<VisitHistoryItem>) => (
        <span className="block truncate">{params?.row?.created_at ? new Date(params.row.created_at).toLocaleDateString() : "-"}</span>
      ),
    },
    {
      field: "company",
      headerName: "Company",
      flex: 1,
      minWidth: 150,
      filterable: false,
      valueGetter: ((params: VisitHistoryValueGetterParams) => params?.row?.company ?? "-"),
      renderCell: (params: GridRenderCellParams<VisitHistoryItem>) => (
        <span className="block truncate">{String(params.row.company ?? "-")}</span>
      ),
    },
    {
      field: "visitor_email",
      headerName: "Email",
      flex: 1,
      minWidth: 210,
      filterable: false,
      valueGetter: ((params: VisitHistoryValueGetterParams) => params?.row?.visitor_email ?? "-"),
      renderCell: (params: GridRenderCellParams<VisitHistoryItem>) => (
        <span className="block truncate">{String(params.row.visitor_email ?? "-")}</span>
      ),
    },
    {
      field: "visitor_phone",
      headerName: "Phone",
      width: 140,
      minWidth: 140,
      filterable: false,
      valueGetter: ((params: VisitHistoryValueGetterParams) => params?.row?.visitor_phone ?? "-"),
      renderCell: (params: GridRenderCellParams<VisitHistoryItem>) => (
        <span className="block truncate">{String(params.row.visitor_phone ?? "-")}</span>
      ),
    },
  ];

  if (!user) return null;

  return (
    <DashboardLayout user={user}>
      <DashboardPageHeader title="Visit History" subtitle="Review recent visits with timestamps and photos." />
      <div className="space-y-3">
        <EntryDeskHeader
          title="Visit History"
          subtitle="Track IN and OUT with captured photos."
        />

        <Panel title="History (Photo)" className="overflow-hidden">
          <AppDataGrid
            rows={historyWithPhotos}
            columns={columns}
            getRowId={(row) => row.visit_id}
            loading={loading}
            searchPlaceholder="Search visitor, purpose, status..."
            initialState={{
              columns: {
                columnVisibilityModel: {
                  purpose: true,
                  checkin_time: true,
                  checkout_time: true,
                  company: false,
                  visitor_email: false,
                  visitor_phone: false,
                },
              },
            }}
            localeText={{
              noRowsLabel: message ? message : "No visit history found.",
            }}
          />
        </Panel>
      </div>
      {previewPhoto ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--modal-overlay)] backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)] shadow-[var(--shadow-1)]">
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              className="absolute right-4 top-4 rounded-full border border-[var(--border-1)] bg-[var(--surface-2)] p-2 text-[var(--text-2)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text-1)]"
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <div className="p-6">
              <img src={previewPhoto} alt="Visitor" className="h-full w-full rounded-xl object-cover" />
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
