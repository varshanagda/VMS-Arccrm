"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { Panel } from "@/components/dashboard/panels";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardPageHeader } from "@/components/layout/DashboardPageHeader";
import EntryDeskHeader from "@/components/entry-desk/entry-desk-header";
import AppDataGrid, {
  GridColDef,
  type GridRenderCellParams,
} from "@/components/ui/app-data-grid";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api";
import { useAuthGuard } from "@/lib/use-auth-guard";

interface VisitHistoryItem {
  visit_id: number;
  id_number?: string | null;
  visitor_name: string;
  status: string;
  created_at?: string | null;
  checkin_time?: string | null;
}

export default function ManualCheckoutPage() {
  const user = useAuthGuard({ allowedRoles: ["guard", "admin", "superadmin"] });
  const { pushToast } = useToast();
  const [idCardNumber, setIdCardNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<VisitHistoryItem[]>([]);
  const [checkoutCandidate, setCheckoutCandidate] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!user) return;
    void loadHistory();
  }, [user]);

  async function loadHistory() {
    setLoading(true);
    try {
      const data = await apiFetch<VisitHistoryItem[]>("/visit/history");
      setHistory(data);
    } catch (err) {
      pushToast({
        title: "Failed to load history",
        description:
          err instanceof Error ? err.message : "Failed to load history",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function submitCheckout(idNumber: string) {
    setLoading(true);
    try {
      await apiFetch("/visit/checkout", {
        method: "POST",
        body: JSON.stringify({ id_number: idNumber }),
      });
      pushToast({
        title: "Visitor checked out",
        description: `ID card ${idNumber} was checked out successfully.`,
        variant: "success",
      });
      setIdCardNumber("");
      setCheckoutCandidate(null);
      await loadHistory();
    } catch (err) {
      pushToast({
        title: "Check-out failed",
        description: err instanceof Error ? err.message : "Check-out failed",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleCheckout(e: FormEvent) {
    e.preventDefault();
    const normalizedId = idCardNumber.trim();
    if (!normalizedId) return;
    setCheckoutCandidate(normalizedId);
  }

  const checkedInRows = useMemo(
    () =>
      history
        .filter((item) => item.status === "checked_in")
        .sort((a, b) => b.visit_id - a.visit_id),
    [history],
  );

  type VisitHistoryValueGetterParams = {
    row: VisitHistoryItem;
    id?: unknown;
    index: number;
  };

  const columns: GridColDef<VisitHistoryItem>[] = useMemo(
    () => [
      {
        field: "sr_no",
        headerName: "Sr. No.",
        width: 90,
        sortable: false,
        filterable: false,
        valueGetter: (params: VisitHistoryValueGetterParams) => {
          return params.index + 1;
        },
        renderCell: (params: GridRenderCellParams<VisitHistoryItem>) => {
          return params.index + 1;
        },
      },
      {
        field: "visitor_name",
        headerName: "Visitor",
        flex: 1,
        minWidth: 180,
        filterable: true,
      },
      {
        field: "checkin_time",
        headerName: "Check-in",
        flex: 1,
        minWidth: 180,
        filterable: false,
        valueGetter: (params: VisitHistoryValueGetterParams) =>
          params?.row?.checkin_time ?? null,
        valueFormatter: (value) =>
          value ? new Date(value as string).toLocaleString() : "-",
      },
      {
        field: "id_number",
        headerName: "ID Card",
        width: 150,
        filterable: false,
        valueGetter: (params: VisitHistoryValueGetterParams) =>
          params?.row?.id_number ?? "-",
        renderCell: (params: GridRenderCellParams<VisitHistoryItem>) => (
          <span className="block truncate">
            {String(params.row.id_number ?? "-")}
          </span>
        ),
      },
      {
        field: "actions",
        headerName: "Action",
        width: 140,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params: GridRenderCellParams<VisitHistoryItem>) => (
          <button
            type="button"
            disabled={loading}
            onClick={() => setIdCardNumber(String(params.row.id_number ?? ""))}
            className="rounded-md border border-[var(--border-1)] bg-[var(--surface-2)] px-3 py-1 text-xs text-[var(--text-1)] hover:bg-[var(--surface-3)] disabled:opacity-60"
          >
            Load
          </button>
        ),
      },
      {
        field: "created_at",
        headerName: "Created",
        flex: 1,
        minWidth: 180,
        filterable: true,
        valueGetter: (params: VisitHistoryValueGetterParams) =>
          params?.row?.created_at ?? null,
        valueFormatter: (value) =>
          value ? new Date(value as string).toLocaleDateString() : "-",
        renderCell: (params: GridRenderCellParams<VisitHistoryItem>) => (
          <span>
            {params?.row?.created_at
              ? new Date(params.row.created_at).toLocaleDateString()
              : "-"}
          </span>
        ),
      },
    ],
    [loading],
  );

  if (!user) return null;

  return (
    <DashboardLayout user={user}>
      <DashboardPageHeader
        title="Checkout"
        subtitle="Check out visitors by ID card when needed."
      />
      <div className="space-y-3">
        <EntryDeskHeader
          title="Checkout"
          subtitle="Use the assigned ID card number to complete check-out quickly."
        />

        <Panel title="Check-out by ID Card">
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={handleCheckout}
          >
            <input
              className="w-full rounded-md border border-[var(--border-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)]"
              placeholder="ID Card Number"
              value={idCardNumber}
              onChange={(e) => setIdCardNumber(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="whitespace-nowrap rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] shadow-sm transition hover:brightness-95 disabled:opacity-60"
            >
              {loading ? "Checking out..." : "Check-out"}
            </button>
          </form>
        </Panel>

        <Panel title="Currently Checked In">
          <AppDataGrid
            rows={checkedInRows}
            columns={columns}
            getRowId={(row) => row.visit_id}
            loading={loading && checkedInRows.length === 0}
            searchPlaceholder="Search visitor or visit ID..."
            localeText={{
              noRowsLabel: loading
                ? "Loading checked-in visitors..."
                : "No checked-in visitors found.",
            }}
          />
        </Panel>
      </div>
      {checkoutCandidate ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)] p-6 shadow-[var(--shadow-1)]">
            <h2 className="text-lg font-semibold text-[var(--text-1)]">
              Confirm check-out
            </h2>
            <p className="mt-2 text-sm text-[var(--text-3)]">
              Check out the visitor using ID card{" "}
              <span className="font-semibold text-[var(--text-1)]">
                {checkoutCandidate}
              </span>
              ?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCheckoutCandidate(null)}
                disabled={loading}
                className="rounded-md border border-[var(--border-1)] bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--text-1)] hover:bg-[var(--surface-3)] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitCheckout(checkoutCandidate)}
                disabled={loading}
                className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] shadow-sm transition hover:brightness-95 disabled:opacity-60"
              >
                {loading ? "Checking out..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
