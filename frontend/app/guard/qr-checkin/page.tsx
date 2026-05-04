"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Panel } from "@/components/dashboard/panels";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardPageHeader } from "@/components/layout/DashboardPageHeader";
import AppDataGrid, {
  GridColDef,
  type GridRenderCellParams,
} from "@/components/ui/app-data-grid";
import CustomSelect from "@/components/ui/custom-select";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { useAuthGuard } from "@/lib/use-auth-guard";

type VisitStatusRow = {
  visit_id: number;
  visitor_id: number;
  visitor_name: string;
  host_name?: string;
  status: string;
  created_at?: string | null;
  approval_email_sent?: boolean | null;
  approval_email_error?: string | null;
  email_status?: string;
};

type VisitStatusResult = VisitStatusRow;

type AvailableIdCard = { id: number; id_number: string };

function areVisitStatusListsEqual(a: VisitStatusRow[], b: VisitStatusRow[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i];
    const right = b[i];
    if (
      left.visit_id !== right.visit_id ||
      left.visitor_id !== right.visitor_id ||
      left.visitor_name !== right.visitor_name ||
      left.host_name !== right.host_name ||
      left.status !== right.status ||
      left.approval_email_sent !== right.approval_email_sent ||
      left.approval_email_error !== right.approval_email_error
    ) {
      return false;
    }
  }
  return true;
}

function areAvailableCardsEqual(a: AvailableIdCard[], b: AvailableIdCard[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i];
    const right = b[i];
    if (left.id !== right.id || left.id_number !== right.id_number) return false;
  }
  return true;
}

export default function ReceptionQrCheckinPage() {
  const { pushToast } = useToast();
  const user = useAuthGuard({ allowedRoles: ["guard", "admin", "superadmin"] });

  const [qrCode, setQrCode] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [idCardSelection, setIdCardSelection] = useState("");
  const [customIdNumber, setCustomIdNumber] = useState("");
  const [policyAccepted, setPolicyAccepted] = useState(false);

  const [message, setMessage] = useState<string>("");
  const [visitorStatus, setVisitorStatus] = useState<string>("");
  const [resolvedVisitorId, setResolvedVisitorId] = useState<number | null>(null);
  const [visitorDetail, setVisitorDetail] = useState<{
    name: string;
    phone?: string;
    company?: string;
    status?: string;
  } | null>(null);

  const [visitList, setVisitList] = useState<VisitStatusRow[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case "approved":
        return "border-emerald-400/20 bg-emerald-500/10 text-emerald-300";
      case "pending":
        return "border-amber-300/60 bg-amber-500/15 text-amber-400";
      case "rejected":
        return "border-red-300/60 bg-red-500/15 text-red-400";
      case "checked_in":
        return "border-orange-300/60 bg-orange-500/15 text-orange-400";
      case "checked_out":
        return "border-slate-300/60 bg-slate-500/15 text-slate-400";
      default:
        return "border-[var(--border-1)] bg-[var(--surface-2)] text-[var(--text-2)]";
    }
  };
  const statusLabel = useCallback((status: string) => status.replace(/_/g, " "), []);
  const statusOptions = useMemo(() => ["approved", "pending", "rejected", "checked_in", "checked_out"], []);
  const [idCardLoading, setIdCardLoading] = useState(false);
  const [availableCards, setAvailableCards] = useState<AvailableIdCard[]>([]);
  const [resendLoading, setResendLoading] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);

  const cardFetchInFlightRef = useRef(false);
  const cardsLoadedRef = useRef(false);
  const skipStatusResetRef = useRef(false);
  const statusMapRef = useRef<Record<number, string>>({});
  const statusMapReadyRef = useRef(false);

  const fetchVisitList = useCallback(
    async (options: { showToast?: boolean; showLoading?: boolean } = {}) => {
      const showToast = options.showToast ?? false;
      const showLoading = options.showLoading ?? false;
      if (showLoading) setListLoading(true);
      try {
        const data = await apiFetch<VisitStatusRow[]>("/visits/list");
        const next = data ?? [];
        if (statusMapReadyRef.current) {
          const nextMap: Record<number, string> = {};
          next.forEach((visit) => {
            nextMap[visit.visit_id] = visit.status;
            const prevStatus = statusMapRef.current[visit.visit_id];
            if (prevStatus && prevStatus !== visit.status) {
              if (visit.status === "approved") {
                pushToast({
                  title: "Approved by host",
                  description: `${visit.visitor_name} is approved.`,
                  variant: "success",
                });
              } else if (visit.status === "rejected") {
                pushToast({
                  title: "Rejected by host",
                  description: `${visit.visitor_name} was rejected.`,
                  variant: "error",
                });
              }
            }
          });
          statusMapRef.current = nextMap;
        } else {
          statusMapRef.current = next.reduce<Record<number, string>>((acc, visit) => {
            acc[visit.visit_id] = visit.status;
            return acc;
          }, {});
          statusMapReadyRef.current = true;
        }
        setVisitList((prev) => (areVisitStatusListsEqual(prev, next) ? prev : next));
        if (showToast) {
          pushToast({
            title: "Status refreshed",
            description: "Visitor approval statuses updated.",
            variant: "success",
          });
        }
      } catch (err) {
        if (showToast) {
          const errorMessage =
            err instanceof Error ? err.message : typeof err === "string" ? err : "Failed to load visitors";
          pushToast({ title: "Failed to refresh", description: errorMessage, variant: "error" });
        }
      } finally {
        if (showLoading) setListLoading(false);
      }
    },
    [pushToast]
  );

  const fetchAvailableCards = useCallback(
    async (options: { showToast?: boolean; showLoading?: boolean; force?: boolean } = {}) => {
      const showToast = options.showToast ?? false;
      const showLoading = options.showLoading ?? showToast;
      const force = options.force ?? false;

      if (cardFetchInFlightRef.current) return;
      if (!force && cardsLoadedRef.current && !showToast && !showLoading) return;

      cardFetchInFlightRef.current = true;
      if (showLoading) setIdCardLoading(true);
      try {
        const data = await apiFetch<AvailableIdCard[]>("/id-cards/available");
        const next = data ?? [];
        setAvailableCards((prev) => (areAvailableCardsEqual(prev, next) ? prev : next));
        cardsLoadedRef.current = true;

        if (showToast) {
          pushToast({
            title: "ID cards updated",
            description: "Available ID cards refreshed.",
            variant: "success",
          });
        }
      } catch (err) {
        if (showToast) {
          const errorMessage =
            err instanceof Error ? err.message : typeof err === "string" ? err : "Failed to load ID cards";
          pushToast({ title: "Failed to refresh", description: errorMessage, variant: "error" });
        }
      } finally {
        cardFetchInFlightRef.current = false;
        if (showLoading) setIdCardLoading(false);
      }
    },
    [pushToast]
  );

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      fetchVisitList({ showToast: true, showLoading: true }),
      fetchAvailableCards({ showLoading: true, force: true }),
    ]);
  }, [fetchAvailableCards, fetchVisitList]);

  const handleResendApprovalEmail = useCallback(
    async (visitId: number) => {
      setResendLoading((prev) => (prev[visitId] ? prev : { ...prev, [visitId]: true }));
      try {
        const result = await apiFetch<{ sent: boolean }>("/visitor/resend-approval", {
          method: "POST",
          body: JSON.stringify({ visit_id: visitId }),
        });

        if (result?.sent) {
          pushToast({
            title: "Email sent",
            description: "Approval email resent to the host.",
            variant: "success",
          });
          await fetchVisitList();
          return;
        }

        pushToast({
          title: "Email not sent",
          description: "Approval email could not be resent.",
          variant: "error",
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : typeof err === "string" ? err : "Failed to resend approval email";
        pushToast({ title: "Email not sent", description: errorMessage, variant: "error" });
      } finally {
        setResendLoading((prev) => {
          if (!prev[visitId]) return prev;
          const next = { ...prev };
          delete next[visitId];
          return next;
        });
      }
    },
    [fetchVisitList, pushToast]
  );

  const handleLoadVisit = useCallback((visit: VisitStatusRow) => {
    skipStatusResetRef.current = true;
    setQrCode(String(visit.visitor_id));
    setMessage("");
    setResolvedVisitorId(visit.visitor_id);
    setVisitorStatus(visit.status ?? "");
    setVisitorDetail({
      name: visit.visitor_name,
      phone: undefined,
      company: visit.host_name,
      status: visit.status,
    });
  }, []);

  async function handleQrCheckin(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    if (!idNumber.trim()) {
      const msg = "Select an ID card number.";
      setMessage(msg);
      pushToast({ title: "ID card required", description: msg, variant: "error" });
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/visit/checkin", {
        method: "POST",
        body: JSON.stringify({
          visitor_id: resolvedVisitorId ?? Number(qrCode),
          id_number: idNumber,
          policy_accepted: policyAccepted,
        }),
      });
      setMessage("QR check-in completed.");
      pushToast({
        title: "Check-in completed",
        description: "QR check-in successful.",
        variant: "success",
      });
      setQrCode("");
      setIdNumber("");
      setIdCardSelection("");
      setCustomIdNumber("");
      setVisitorDetail(null);
      setVisitorStatus("");
      setResolvedVisitorId(null);

      void fetchAvailableCards();
      void fetchVisitList();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "QR check-in failed";
      setMessage(errorMessage);
      pushToast({
        title: "Check-in failed",
        description: errorMessage,
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  const handleStatusCheck = useCallback(
    async (options: { showToast?: boolean; showLoading?: boolean } = {}) => {
      const showToast = options.showToast ?? true;
      const showLoading = options.showLoading ?? showToast;
      if (!qrCode) return;
      if (showToast) setMessage("");
      if (showLoading) setLoading(true);
      try {
        const data = await apiFetch<VisitStatusResult>(`/visits/status?code=${encodeURIComponent(qrCode)}`);
        setVisitorDetail((prev) => {
          const next = {
            name: data.visitor_name,
            phone: undefined,
            company: data.host_name,
            status: data.status,
          };
          if (!prev) return next;
          return prev.name === next.name && prev.company === next.company && prev.status === next.status ? prev : next;
        });
        setVisitorStatus((prev) => (prev === (data.status ?? "") ? prev : data.status ?? ""));
        setResolvedVisitorId((prev) => (prev === data.visitor_id ? prev : data.visitor_id));
        if (showToast) {
          if (data.status === "approved") {
            pushToast({ title: "Approved by host", description: "You can check-in this visitor.", variant: "success" });
          } else if (data.status === "rejected") {
            pushToast({ title: "Rejected by host", description: "Do not proceed with check-in.", variant: "error" });
          } else {
            pushToast({ title: "Pending approval", description: "Wait for host response.", variant: "info" });
          }
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : typeof err === "string" ? err : "Failed to fetch status";
        if (showToast) {
          setMessage(errorMessage);
          setVisitorDetail(null);
          setVisitorStatus("");
          pushToast({ title: "Status check failed", description: errorMessage, variant: "error" });
        }
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [pushToast, qrCode]
  );

  const visitRows = useMemo(() => {
    return [...visitList]
      .sort((a, b) => b.visit_id - a.visit_id)
      .map((visit) => {
        const emailSent = visit.approval_email_sent === true;
        const emailNotSent = visit.approval_email_sent === false || Boolean(visit.approval_email_error);
        const emailStatus = emailSent
          ? "Email sent"
          : emailNotSent
            ? `Email not sent${visit.approval_email_error ? `: ${visit.approval_email_error}` : ""}`
            : "Email pending";
        const visitWithAliases = visit as VisitStatusRow & {
          host?: { name?: string | null } | null;
          hostName?: string | null;
          host_employee_name?: string | null;
          visitorName?: string | null;
        };
        return {
          ...visit,
          host_name:
            visitWithAliases.host_name ??
            visitWithAliases.hostName ??
            visitWithAliases.host_employee_name ??
            visitWithAliases.host?.name ??
            "",
          visitor_name: visitWithAliases.visitor_name ?? visitWithAliases.visitorName ?? "",
          status_label: statusLabel(visit.status),
          email_status: emailStatus,
        };
      });
  }, [visitList, statusLabel]);

  const visitColumns: GridColDef<VisitStatusRow & { status_label?: string; email_status?: string }>[] = useMemo(
    () => [
      {
        field: "visitor_name",
        headerName: "Visitor",
        type: "string",
        flex: 1,
        minWidth: 170,
        filterable: true,
        valueGetter: (params: { row: VisitStatusRow }) => {
          const row = params?.row as VisitStatusRow & { visitorName?: string | null };
          const value = row?.visitor_name ?? row?.visitorName ?? "";
          return String(value ?? "").trim().toLowerCase();
        },
        getQuickFilterText: (params: { value?: unknown }) =>
          String(params?.value ?? "").toLowerCase(),
        renderCell: (params: GridRenderCellParams<VisitStatusRow>) => (
          <p className="font-semibold text-[var(--text-1)]">{params.row.visitor_name}</p>
        ),
      },
      {
        field: "host_name",
        headerName: "Host",
        type: "string",
        flex: 1,
        minWidth: 160,
        filterable: true,
        valueGetter: (params: { row: VisitStatusRow }) => {
          const row = params?.row as VisitStatusRow & {
            hostName?: string | null;
            host_employee_name?: string | null;
            host?: { name?: string | null } | null;
          };
          const value =
            row?.host_name ??
            row?.hostName ??
            row?.host_employee_name ??
            row?.host?.name ??
            "";
          return String(value ?? "").trim().toLowerCase();
        },
        valueFormatter: (_value, row) =>
          String((row as VisitStatusRow | undefined)?.host_name ?? "Unknown"),
        getApplyQuickFilterFn: (value) => {
          if (!value || !value.trim()) return null;
          const search = value.toLowerCase();
          return (params) => String(params?.row?.host_name ?? "Unknown").toLowerCase().includes(search);
        },
        getQuickFilterText: (params: { value?: unknown }) => String(params?.value ?? "").toLowerCase(),
        renderCell: (params: GridRenderCellParams<VisitStatusRow>) => (
          <span>{params?.row?.host_name ?? "Unknown"}</span>
        ),
      },
      {
        field: "status",
        headerName: "Status",
        type: "singleSelect",
        valueOptions: statusOptions,
        flex: 1,
        minWidth: 200,
        filterable: true,
        valueFormatter: (value) =>
          statusLabel(String(value ?? "")),
        getQuickFilterText: (params: { row?: VisitStatusRow & { status_label?: string } }) => {
          const row = params?.row as VisitStatusRow & { status_label?: string };
          const raw = row?.status ?? "";
          const label = row?.status_label ?? "";
          return `${raw} ${label}`.toLowerCase();
        },
        renderCell: (params: GridRenderCellParams<VisitStatusRow>) => {
          const row = params.row as VisitStatusRow & { email_status?: string };
          return (
            <div className="flex flex-col gap-1 py-2">
              <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(row.status)}`}>
                {statusLabel(row.status)}
              </span>
            </div>
          );
        },
      },
      {
        field: "email_status",
        headerName: "Email Status",
        flex: 1,
        minWidth: 180,
        filterable: false,
        valueGetter: (params: { row: VisitStatusRow }) => params?.row?.email_status ?? "-",
      },
      {
        field: "created_at",
        headerName: "Created",
        flex: 1,
        minWidth: 180,
        filterable: true,
        valueGetter: (params: { row: VisitStatusRow }) => params?.row?.created_at ?? null,
        valueFormatter: (value) =>
          value ? new Date(value as string).toLocaleDateString() : "-",
        renderCell: (params: GridRenderCellParams<VisitStatusRow>) => (
          <span>{params?.row?.created_at ? new Date(params.row.created_at).toLocaleDateString() : "-"}</span>
        ),
      },
      {
        field: "actions",
        headerName: "Action",
        flex: 1,
        minWidth: 220,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params: GridRenderCellParams<VisitStatusRow>) => {
          const row = params.row as VisitStatusRow;
          const emailSent = row.approval_email_sent === true;
          const canResend = row.status === "pending" && !emailSent;
          const resendBusy = Boolean(resendLoading[row.visit_id]);
          return (
            <div className="flex items-center gap-2 py-2">
              <button
                type="button"
                onClick={() => handleLoadVisit(row)}
                disabled={row.status === "checked_in" || row.status === "checked_out" || row.status === "auto_checked_out"}
                className="rounded-md border border-[var(--border-1)] bg-transparent px-3 py-1.5 text-xs font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] disabled:opacity-60"
              >
                Load
              </button>
              {canResend ? (
                <button
                  type="button"
                  onClick={() => handleResendApprovalEmail(row.visit_id)}
                  disabled={resendBusy}
                  className="rounded-md border border-[var(--border-1)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--text-1)] hover:bg-[var(--surface-3)] disabled:opacity-60"
                >
                  {resendBusy ? "Sending..." : "Resend Email"}
                </button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [handleLoadVisit, handleResendApprovalEmail, resendLoading, statusLabel, statusOptions]
  );

  useEffect(() => {
    void fetchVisitList({ showLoading: true });
    void fetchAvailableCards({ showLoading: true });
  }, [fetchAvailableCards, fetchVisitList]);

  useEffect(() => {
    if (!user) return;
    const token = getAccessToken();
    if (!token) return;
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8005";
    const source = new EventSource(`${baseUrl}/events/visits?token=${encodeURIComponent(token)}`);
    source.onmessage = () => {
      void fetchVisitList();
    };
    source.onerror = () => {
      source.close();
    };
    return () => {
      source.close();
    };
  }, [fetchVisitList, user]);

  useEffect(() => {
    if (!qrCode) return;
    if (skipStatusResetRef.current) {
      skipStatusResetRef.current = false;
      return;
    }
    setVisitorDetail(null);
    setVisitorStatus("");
    setResolvedVisitorId(null);
  }, [qrCode]);

  // Listen for real-time status updates from DashboardLayout
  useEffect(() => {
    const handleUpdate = () => {
      void fetchVisitList();
    };
    window.addEventListener("visitor-status-updated", handleUpdate);
    return () => window.removeEventListener("visitor-status-updated", handleUpdate);
  }, [fetchVisitList]);

  if (!user) return null;

  return (
    <DashboardLayout user={user}>
      <DashboardPageHeader title="Check-in" subtitle="Scan or paste a QR code to complete a check-in." />
      <div className="space-y-6">
        <Panel title="Check-in">
          <form className="flex flex-col sm:flex-row sm:items-center gap-4" onSubmit={handleQrCheckin}>
            <input
              className="flex-1 w-full sm:w-auto h-11 rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 box-border leading-none"
              placeholder="Visitor ID / phone / email / QR code"
              value={qrCode}
              onChange={(e) => setQrCode(e.target.value)}
              required
            />
            <div className="relative shrink-0 w-full sm:w-[220px]">
              <CustomSelect
                className="h-11 m-0 w-full"
                options={[
                  { value: "", label: idCardLoading ? "Loading ID cards..." : "Select ID card" },
                  ...availableCards.map(card => ({ value: card.id_number, label: card.id_number })),
                  { value: "__custom__", label: "Custom" }
                ]}
                value={idCardSelection}
                onChange={(value) => {
                  setIdCardSelection(value);
                  if (value === "__custom__") {
                    setIdNumber("");
                    setCustomIdNumber("");
                  } else {
                    setCustomIdNumber("");
                    setIdNumber(value);
                  }
                }}
              />
            </div>
            {idCardSelection === "__custom__" ? (
              <input
                className="w-full sm:w-[200px] h-11 shrink-0 rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 box-border leading-none"
                placeholder="Enter ID card number"
                value={customIdNumber}
                onChange={(e) => {
                  const value = e.target.value;
                  setCustomIdNumber(value);
                  setIdNumber(value);
                }}
                required
              />
            ) : null}
            <button
              type="button"
              onClick={() => handleStatusCheck({ showToast: true, showLoading: true })}
              disabled={loading}
              className="h-11 flex items-center justify-center shrink-0 whitespace-nowrap rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm font-semibold text-[var(--text-1)] transition hover:bg-[var(--surface-3)] disabled:opacity-60 box-border leading-none"
            >
              Check Status
            </button>
            <button
              type="submit"
              disabled={loading || visitorStatus !== "approved"}
              className="h-11 flex items-center justify-center shrink-0 whitespace-nowrap rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-fg)] shadow-sm transition hover:brightness-95 disabled:opacity-60 box-border leading-none"
            >
              {loading ? "Checking in..." : "Check-in"}
            </button>
          </form>

          <label className="mt-3 flex items-center gap-2 text-sm text-[var(--text-2)]">
            <input
              type="checkbox"
              checked={policyAccepted}
              onChange={(e) => setPolicyAccepted(e.target.checked)}
              className="h-4 w-4 rounded border border-[var(--border-1)] bg-[var(--surface-2)] accent-[var(--accent)]"
            />
            Policy agreement accepted
          </label>

          {visitorDetail ? (
            <div className="mt-4 rounded-xl border border-[var(--border-1)] bg-[var(--surface-2)] p-4 text-sm text-[var(--text-2)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-3)]">Host Response</p>
                  <p className="mt-1 text-base font-semibold text-[var(--text-1)]">{visitorDetail.name}</p>
                  <p className="text-xs text-[var(--text-3)]">Host: {visitorDetail.company ?? "Unknown"}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(visitorStatus)}`}>
                  {visitorStatus === "approved"
                    ? "Approved by Host"
                    : visitorStatus === "rejected"
                      ? "Rejected by Host"
                      : "Pending Host Response"}
                </span>
              </div>
              {visitorStatus === "rejected" ? (
                <p className="mt-3 text-xs text-red-300">This visit has been rejected by the host.</p>
              ) : null}
            </div>
          ) : null}
          {message ? <p className="mt-3 text-sm text-[var(--text-2)]">{message}</p> : null}
        </Panel>

        <Panel
          title="Visitor Approval Status"
          action={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={listLoading || idCardLoading}
                className="rounded-md border border-[var(--border-1)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--text-1)] transition hover:bg-[var(--surface-3)] disabled:opacity-60"
              >
                {listLoading || idCardLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          }
        >
          <AppDataGrid
            rows={visitRows}
            columns={visitColumns}
            getRowId={(row) => row.visit_id}
            loading={listLoading}
            searchPlaceholder="Search visitor, host, status..."
            rowHeight={76}
            initialState={{
              columns: { columnVisibilityModel: { host_name: true, email_status: false } },
            }}
          />
          <p className="mt-3 text-xs text-[var(--text-3)]">Check-in is enabled only when status is approved.</p>
        </Panel>
      </div>
    </DashboardLayout>
  );
}
