"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardPageHeader } from "@/components/layout/DashboardPageHeader";
import AppDataGrid, { GridColDef, type GridRenderCellParams } from "@/components/ui/app-data-grid";
import { API_BASE_URL, apiFetch } from "@/lib/api";
import { useAuthGuard } from "@/lib/use-auth-guard";

type VisitHistoryItem = {
  visit_id: number;
  visitor_id: number;
  visitor_name: string;
  id_number?: string | null;
  visitor_phone?: string | null;
  visitor_email?: string | null;
  company?: string | null;
  photo_url?: string | null;
  host_employee_id?: number | null;
  purpose?: string | null;
  created_at?: string | null;
  checkin_time?: string | null;
  checkout_time?: string | null;
  status: string;
};

type HistoryRow = VisitHistoryItem & {
  status_label: string;
  photo: string | null;
};

type ColumnOption = {
  key: string;
  label: string;
};

const defaultVisibleColumns = [
  "sr_no",
  "visitor_name",
  "status",
  "created_at",
  "purpose",
  "checkin_time",
];

type TableColumnToggleProps = {
  columns: ColumnOption[];
  visibleColumns: string[];
  defaultVisibleColumns: string[];
  onToggle: (field: string) => void;
};

function TableColumnToggle({ columns, visibleColumns, defaultVisibleColumns, onToggle }: TableColumnToggleProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const hasCustomSelection =
    visibleColumns.length !== defaultVisibleColumns.length ||
    defaultVisibleColumns.some((column) => !visibleColumns.includes(column));
  const isActive = open || hasCustomSelection;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={`inline-flex min-h-[42px] items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${
          isActive
            ? "border-[var(--accent)] bg-[var(--nav-active-bg)] text-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]"
            : "border-[var(--border-1)] bg-[var(--surface-2)] text-[var(--text-2)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)]"
        }`}
        onClick={() => setOpen((current) => !current)}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
          <path d="M4 7h16M7 12h10M10 17h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Columns
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-2 w-[min(16rem,calc(100vw-2rem))] rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)]/100 p-2 shadow-[0_18px_45px_rgba(15,23,42,0.42)] backdrop-blur-xl">
          <div className="mb-2 px-2 pt-1 text-[11px] uppercase tracking-[0.2em] text-[var(--text-3)]">Visible columns</div>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {columns.map((column) => {
              const isVisible = visibleColumns.includes(column.key);
              return (
                <label
                  key={column.key}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm text-[var(--text-1)] hover:bg-[var(--surface-2)]"
                >
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={() => onToggle(column.key)}
                    className={`h-4 w-4 rounded border accent-[var(--accent)] ${
                      isVisible ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/20" : "border-[var(--border-1)]"
                    }`}
                  />
                  <span>{column.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EmployeeVisitorsContent() {
  const user = useAuthGuard({ allowedRoles: ["employee"] });
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [selectedVisitId, setSelectedVisitId] = useState<number | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(defaultVisibleColumns);
  const currentView = searchParams.get("view") ?? "all";

  const getDisplayStatus = useCallback((status: string) => status, []);

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
      case "auto_checked_out":
        return "border-sky-500/50 bg-sky-500/20 text-sky-400 font-bold shadow-[0_0_10px_rgba(14,165,233,0.15)]";
      default:
        return "border-[var(--border-1)] bg-[var(--surface-2)] text-[var(--text-2)]";
    }
  };

  const statusLabel = useCallback((status: string) => {
    if (status === "checked_in" || status === "IN") return "IN";
    if (status === "checked_out" || status === "OUT") return "OUT";
    return status.replace(/_/g, " ");
  }, []);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const historyData = await apiFetch<VisitHistoryItem[]>("/employees/me/visitors");
      const enrichedRows = [...(historyData ?? [])]
        .sort((a, b) => b.visit_id - a.visit_id)
        .map((item) => ({
          ...item,
          status: item.status === "checked_in" ? "IN" : item.status === "checked_out" ? "OUT" : item.status,
          status_label: statusLabel(item.status === "checked_in" ? "IN" : item.status === "checked_out" ? "OUT" : item.status),
          photo: item.photo_url ? (item.photo_url.startsWith("http") ? item.photo_url : `${API_BASE_URL}${item.photo_url}`) : null,
        }));
      setRows(enrichedRows);
    } finally {
      setIsLoading(false);
    }
  }, [statusLabel, user]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const viewConfig = useMemo(() => {
    switch (currentView) {
      case "pending":
        return {
          title: "Pending Approvals",
          subtitle: "Review only pending visitors assigned to you.",
          noRowsLabel: "No pending visitors found.",
          statuses: ["pending"],
        };
      case "approved":
        return {
          title: "Approved Visitors",
          subtitle: "Review approved visitors assigned to you.",
          noRowsLabel: "No approved visitors found.",
          statuses: ["approved"],
        };
      case "rejected":
        return {
          title: "Rejected Visitors",
          subtitle: "Review rejected visitors assigned to you.",
          noRowsLabel: "No rejected visitors found.",
          statuses: ["rejected"],
        };
      default:
        return {
          title: "My Visitor",
          subtitle: "Review only the visitors assigned to you.",
          noRowsLabel: "No visitors found.",
          statuses: null,
        };
    }
  }, [currentView]);

  const displayRows = useMemo(() => {
    if (!viewConfig.statuses) return rows;
    return rows.filter((row) => viewConfig.statuses?.includes(row.status));
  }, [rows, viewConfig.statuses]);

  const selectedRow = useMemo(() => {
    if (displayRows.length === 0) return null;
    return displayRows.find((item) => item.visit_id === selectedVisitId) ?? displayRows[0];
  }, [displayRows, selectedVisitId]);

  const allColumnOptions = useMemo<ColumnOption[]>(
    () => [
      { key: "sr_no", label: "Sr. No." },
      { key: "visitor_name", label: "Visitor" },
      { key: "id_number", label: "ID Card" },
      { key: "status", label: "Status" },
      { key: "checkin_time", label: "IN" },
      { key: "created_at", label: "Created" },
      { key: "company", label: "Company" },
      { key: "visitor_email", label: "Email" },
      { key: "visitor_phone", label: "Phone" },
      { key: "purpose", label: "Purpose" },
    ],
    []
  );

  const visibleColumnModel = useMemo(
    () => Object.fromEntries(allColumnOptions.map((column) => [column.key, visibleColumns.includes(column.key)])),
    [allColumnOptions, visibleColumns]
  );

  type HistoryValueGetterParams = {
    row: HistoryRow;
    api?: { getRowIndexRelativeToVisibleRows: (id: unknown) => number };
    id?: unknown;
  };

  const listColumns: GridColDef<HistoryRow>[] = useMemo(
    () => [
      {
        field: "sr_no",
        headerName: "Sr. No.",
        width: 90,
        filterable: false,
        valueGetter: (params: HistoryValueGetterParams) => (params?.api ? params.api.getRowIndexRelativeToVisibleRows(params.id) + 1 : ""),
        renderCell: (params: GridRenderCellParams<HistoryRow>) => (params?.api ? params.api.getRowIndexRelativeToVisibleRows(params.id) + 1 : ""),
      },
      { field: "visitor_name", headerName: "Visitor", flex: 1, minWidth: 210, filterable: true },
      { field: "id_number", headerName: "ID Card", flex: 0.8, minWidth: 140, filterable: false },
      {
        field: "status",
        headerName: "Status",
        type: "singleSelect",
        valueOptions: ["approved", "pending", "rejected", "IN", "OUT", "auto_checked_out"],
        width: 180,
        minWidth: 180,
        filterable: true,
        valueFormatter: (value) => statusLabel(getDisplayStatus(String(value ?? ""))),
        renderCell: (params: GridRenderCellParams<HistoryRow>) => (
          <div className="min-w-0">
            <span className={`inline-flex max-w-full items-center rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap ${statusBadgeClass(getDisplayStatus(String(params.row.status ?? "")))}`}>
              <span className="truncate">{statusLabel(getDisplayStatus(String(params.row.status ?? "")))}</span>
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
        valueGetter: (params: HistoryValueGetterParams) => params?.row?.checkin_time ?? null,
        valueFormatter: (value) => (value ? new Date(value as string).toLocaleString() : "-"),
        renderCell: (params: GridRenderCellParams<HistoryRow>) => <span>{params.row.checkin_time ? new Date(params.row.checkin_time).toLocaleString() : "-"}</span>,
      },
      {
        field: "created_at",
        headerName: "Created",
        flex: 0.9,
        minWidth: 165,
        filterable: true,
        valueGetter: (params: HistoryValueGetterParams) => params?.row?.created_at ?? null,
        valueFormatter: (value) => (value ? new Date(value as string).toLocaleDateString() : "-"),
        renderCell: (params: GridRenderCellParams<HistoryRow>) => <span>{params.row.created_at ? new Date(params.row.created_at).toLocaleDateString() : "-"}</span>,
      },
      { field: "company", headerName: "Company", flex: 1, minWidth: 160, filterable: false },
      { field: "visitor_email", headerName: "Email", flex: 1, minWidth: 200, filterable: false },
      { field: "visitor_phone", headerName: "Phone", flex: 0.8, minWidth: 140, filterable: false },
      {
        field: "purpose",
        headerName: "Purpose",
        flex: 1,
        minWidth: 180,
        filterable: true,
        valueGetter: (params: HistoryValueGetterParams) => String(params?.row?.purpose ?? "").trim().toLowerCase(),
        renderCell: (params: GridRenderCellParams<HistoryRow>) => <span>{String(params.row.purpose ?? "").trim() || "-"}</span>,
      },
    ],
    [getDisplayStatus, statusLabel]
  );

  const handleToggleColumn = useCallback((field: string) => {
    setVisibleColumns((current) => (current.includes(field) ? current.filter((item) => item !== field) : [...current, field]));
  }, []);

  const detailPanel = selectedRow ? (
    <>
      <div className="flex h-[61px] items-center justify-between border-b border-white/10 px-4">
        <p className="text-sm font-semibold text-[var(--text-1)]">Visitor Details</p>
        <button
          type="button"
          onClick={() => setDetailsOpen(false)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-2)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text-1)]"
          aria-label="Close visitor details"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="h-full overflow-y-auto p-4">
        <div className="rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)] p-5 shadow-[var(--shadow-1)]">
          <div className="flex flex-wrap items-center gap-4">
            {selectedRow.photo ? (
              <button type="button" onClick={() => setPreviewPhoto(selectedRow.photo)} className="group h-12 w-12 overflow-hidden rounded-full border border-[var(--border-1)] bg-[var(--surface-2)]">
                <img src={selectedRow.photo} alt={selectedRow.visitor_name} className="h-12 w-12 object-cover transition group-hover:scale-105" />
              </button>
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-1)] bg-[var(--surface-3)] text-sm font-semibold text-[var(--text-1)]">
                {selectedRow.visitor_name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-[180px]">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-3)]">Visitor</p>
              <p className="text-xl font-semibold tracking-tight text-[var(--text-1)]">{selectedRow.visitor_name}</p>
              <p className="truncate text-sm text-[var(--text-2)]">{selectedRow.visitor_email ?? "—"}</p>
            </div>
            <span className={`ml-auto rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusBadgeClass(getDisplayStatus(selectedRow.status))}`}>
              {statusLabel(getDisplayStatus(selectedRow.status))}
            </span>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1"><p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-3)]">Phone</p><p className="text-base text-[var(--text-1)]">{selectedRow.visitor_phone ?? "—"}</p></div>
            <div className="space-y-1"><p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-3)]">ID Card</p><p className="text-base text-[var(--text-1)]">{selectedRow.id_number ?? "—"}</p></div>
            <div className="space-y-1"><p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-3)]">Purpose</p><p className="text-base text-[var(--text-1)]">{selectedRow.purpose ?? "—"}</p></div>
            <div className="space-y-1"><p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-3)]">Company</p><p className="text-base text-[var(--text-1)]">{selectedRow.company ?? "—"}</p></div>
            <div className="space-y-1"><p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-3)]">IN</p><p className="text-base text-[var(--text-1)]">{selectedRow.checkin_time ? new Date(selectedRow.checkin_time).toLocaleString() : "—"}</p></div>
            <div className="space-y-1"><p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-3)]">OUT</p><p className="text-base text-[var(--text-1)]">{selectedRow.checkout_time ? new Date(selectedRow.checkout_time).toLocaleString() : "—"}</p></div>
          </div>
        </div>
      </div>
    </>
  ) : null;

  if (!user) return null;

  return (
    <DashboardLayout user={user}>
      <DashboardPageHeader title={viewConfig.title} subtitle={viewConfig.subtitle} />
      <section className="overflow-hidden rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)] p-4 shadow-[var(--shadow-1)] sm:p-5">
        <div className="relative">
          <AppDataGrid
            headerAction={<TableColumnToggle columns={allColumnOptions} visibleColumns={visibleColumns} defaultVisibleColumns={defaultVisibleColumns} onToggle={handleToggleColumn} />}
            rows={displayRows}
            columns={listColumns}
            getRowId={(row) => row.visit_id}
            loading={isLoading}
            searchPlaceholder={currentView === "all" ? "Search visitor, status, purpose..." : `Search ${viewConfig.title.toLowerCase()}...`}
            showSearch
            showColumns={false}
            showFilters
            showExport={false}
            showPagination
            onFiltersOpenChange={(open) => {
              if (open) setDetailsOpen(false);
            }}
            onFilterToggle={(open) => {
              if (open) setDetailsOpen(false);
            }}
            sidePanelOpen={detailsOpen}
            sidePanelContent={detailPanel}
            sidePanelWidth={380}
            columnVisibilityModel={visibleColumnModel}
            rowSelection
            disableRowSelectionOnClick={false}
            rowSelectionModel={selectedVisitId ? [selectedVisitId] : []}
            onRowSelectionModelChange={(model) => {
              const nextId = model[0] ? Number(model[0]) : null;
              if (nextId && nextId === selectedVisitId && detailsOpen) {
                setDetailsOpen(false);
                return;
              }
              setSelectedVisitId(nextId);
              if (nextId) setDetailsOpen(true);
            }}
            initialState={{ pagination: { paginationModel: { page: 0, pageSize: 10 } } }}
            localeText={{ noRowsLabel: isLoading ? "Loading visitors..." : viewConfig.noRowsLabel }}
          />
        </div>
      </section>
      {previewPhoto ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--modal-overlay)] p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)] shadow-[var(--shadow-1)]">
            <button type="button" onClick={() => setPreviewPhoto(null)} className="absolute right-4 top-4 rounded-full border border-[var(--border-1)] bg-[var(--surface-2)] p-2 text-[var(--text-2)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text-1)]" aria-label="Close">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
            <div className="p-6"><img src={previewPhoto} alt="Visitor" className="h-full w-full rounded-xl object-cover" /></div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}

export default function EmployeeVisitorListPage() {
  return (
    <Suspense fallback={null}>
      <EmployeeVisitorsContent />
    </Suspense>
  );
}
