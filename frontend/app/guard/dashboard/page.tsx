"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Panel, StatGrid, StatusList, type StatItem } from "@/components/dashboard/panels";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardPageHeader } from "@/components/layout/DashboardPageHeader";
import Pagination from "@/components/ui/pagination";
import { API_BASE_URL, apiFetch, resolveApiAssetUrl } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { useAuthGuard } from "@/lib/use-auth-guard";

type VisitHistoryItem = {
  visit_id: number;
  visitor_id: number;
  visitor_name: string;
  visitor_phone?: string | null;
  visitor_email?: string | null;
  company?: string | null;
  photo_url?: string | null;
  host_employee_id?: number | null;
  purpose?: string | null;
  checkin_time?: string | null;
  checkout_time?: string | null;
  status: string;
  qr_code?: string | null;
};

export default function ReceptionDashboard() {
  const router = useRouter();
  const user = useAuthGuard({ allowedRoles: ["guard", "admin", "superadmin"] });
  const [history, setHistory] = useState<VisitHistoryItem[]>([]);
  const [hostMap, setHostMap] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [modalKey, setModalKey] = useState<"pending" | "approved" | "checked_in" | "checked_out" | null>(null);
  const [modalPage, setModalPage] = useState(1);
  const [modalPageSize, setModalPageSize] = useState(5);
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

  const loadData = useCallback(
    async (isInitial = false) => {
      if (isInitial) setLoading(true);
      try {
        const [historyData, hostData] = await Promise.all([
          apiFetch<VisitHistoryItem[]>("/visit/history"),
          apiFetch<Array<{ id: number; name: string }>>("/employees/hosts"),
        ]);

        setHistory((prev) => {
          const next = (historyData ?? []).map(item => ({
            ...item,
            status: item.status === "checked_in" ? "IN" : item.status === "checked_out" ? "OUT" : item.status
          }));
          return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
        });

        const map: Record<number, string> = {};
        (hostData ?? []).forEach((host) => {
          map[host.id] = host.name;
        });
        setHostMap((prev) => {
          return JSON.stringify(prev) === JSON.stringify(map) ? prev : map;
        });
      } catch {
        // Keep old data on transient network error, no need to wipe out the screen
      } finally {
        if (isInitial) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!user) return;
    void loadData(true);
  }, [loadData, user]);

  useEffect(() => {
    if (!user) return;
    const token = getAccessToken();
    if (!token) return;
    const source = new EventSource(`${API_BASE_URL}/events/visits?token=${encodeURIComponent(token)}`);

    source.onmessage = () => {
      void loadData();
    };
    source.onerror = () => {
      source.close();
    };
    return () => {
      source.close();
    };
  }, [loadData, user]);

  const stats = useMemo<StatItem[]>(() => {
    const todayKey = new Date().toDateString();
    const isToday = (value?: string | null) =>
      value ? new Date(value).toDateString() === todayKey : false;
    const checkinsToday = history.filter((item) => isToday(item.checkin_time)).length;
    const checkoutsToday = history.filter((item) => isToday(item.checkout_time)).length;
    const pending = history.filter((item) => item.status === "pending").length;
    const checkedInNow = history.filter((item) => item.status === "IN").length;
    return [
      { label: "IN", value: String(checkinsToday), delta: "Today", color: "orange" },
      { label: "OUT", value: String(checkoutsToday), delta: "Today", color: "sky" },
      { label: "Pending Approval", value: String(pending), delta: "Awaiting host", color: "amber" },
      { label: "IN Now", value: String(checkedInNow), delta: "Live", color: "orange" },
    ] as StatItem[];
  }, [history]);

  const queueItems = useMemo(() => {
    return [...history]
      .sort((a, b) => b.visit_id - a.visit_id)
      .slice(0, 5)
      .map((item) => ({
        title: item.visitor_name,
        subtitle: `${item.purpose ?? "Visit"} · Host: ${item.host_employee_id ? hostMap[item.host_employee_id] ?? "Unknown" : "Unassigned"
          }`,
        image: resolveApiAssetUrl(item.photo_url),
        visit_id: item.visit_id,
        visitor_id: item.visitor_id,
        status: item.status,
      }));
  }, [history, hostMap]);

  const checklistItems = useMemo(() => {
    const pending = history.filter((item) => item.status === "pending").length;
    const approved = history.filter((item) => item.status === "approved").length;
    const checkedIn = history.filter((item) => item.status === "IN").length;
    const checkedOut = history.filter((item) => item.status === "OUT").length;
    return [
      { key: "pending" as const, label: "Pending approvals", count: pending },
      { key: "approved" as const, label: "Approved arrivals waiting", count: approved },
      { key: "checked_in" as const, label: "Currently IN", count: checkedIn },
      { key: "checked_out" as const, label: "OUT", count: checkedOut },
    ];
  }, [history]);

  const modalTitle = useMemo(() => {
    if (modalKey === "pending") return "Pending Approvals";
    if (modalKey === "approved") return "Approved Visitors";
    if (modalKey === "checked_in") return "Currently IN";
    if (modalKey === "checked_out") return "OUT Visitors";
    return "";
  }, [modalKey]);

  const modalRows = useMemo(() => {
    if (!modalKey) return [];
    return history
      .filter((item) => item.status === modalKey)
      .sort((a, b) => b.visit_id - a.visit_id);
  }, [history, modalKey]);

  const modalTotalPages = Math.max(1, Math.ceil(modalRows.length / modalPageSize));
  const modalPagedRows = useMemo(() => {
    const start = (modalPage - 1) * modalPageSize;
    return modalRows.slice(start, start + modalPageSize);
  }, [modalRows, modalPage, modalPageSize]);

  useEffect(() => {
    setModalPage(1);
  }, [modalKey, modalPageSize]);

  useEffect(() => {
    if (modalPage > modalTotalPages) {
      setModalPage(modalTotalPages);
    }
  }, [modalPage, modalTotalPages]);

  if (!user) return null;

  return (
    <DashboardLayout user={user}>
      <DashboardPageHeader
        title="Reception Dashboard"
        subtitle="Manage IN/OUT, appointment flow, and visitor desk operations in real time."
      />
      <div className="mt-6">
        <StatGrid items={stats} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.75fr_0.95fr]">
        <Panel
          title="Front Desk Queue"
          action={
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-[var(--text-3)]">
                {loading ? "Updating..." : "Live"}
              </span>
              <Link
                href="/guard/visitors"
                className="rounded-md border border-[var(--border-1)] bg-[var(--surface-2)] px-3 py-1 text-xs font-semibold text-[var(--text-1)] transition hover:bg-[var(--surface-3)]"
              >
                View all
              </Link>
            </div>
          }
        >
          <StatusList
            items={queueItems}
            onItemClick={(item) => {
              if (!item.visit_id && !item.visitor_id) return;
              const params = new URLSearchParams();
              if (item.visit_id) params.set("visitId", String(item.visit_id));
              if (item.visitor_id) params.set("visitorId", String(item.visitor_id));
              router.push(`/guard/visitors?${params.toString()}`);
            }}
          />
        </Panel>

        <div className="space-y-6 xl:sticky xl:top-20 self-start">
          <Panel title="Today’s Checklist">
          <ul className="space-y-3 text-sm text-[var(--text-2)]">
            {checklistItems.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => setModalKey(item.key)}
                  className="flex w-full items-center justify-between rounded-xl border border-[var(--border-1)] bg-[var(--surface-2)] px-3 py-2 text-left text-[var(--text-2)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-3)] hover:text-[var(--text-1)]"
                >
                  <span>{item.label}</span>
                  <span className="rounded-full border border-[var(--border-1)] bg-[var(--surface-1)] px-2.5 py-0.5 text-xs font-semibold text-[var(--text-1)]">
                    {item.count}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
        </div>
      </div>

      {modalKey ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--modal-overlay)] backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-[var(--border-1)] bg-[var(--surface-1)] shadow-[var(--shadow-1)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-1)] px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-3)]">Today’s Checklist</p>
                <h3 className="text-xl font-semibold text-[var(--text-1)]">{modalTitle}</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalKey(null)}
                className="rounded-full border border-[var(--border-1)] bg-[var(--surface-2)] p-2.5 text-[var(--text-2)] shadow-[var(--shadow-1)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text-1)]"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto px-6 py-5">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="text-[var(--text-3)]">
                      <th className="pb-3 pr-4 font-semibold uppercase tracking-[0.18em] text-[var(--text-3)]">
                        Visitor
                      </th>
                      <th className="pb-3 pr-4 font-semibold uppercase tracking-[0.18em] text-[var(--text-3)]">
                        Phone
                      </th>
                      <th className="pb-3 pr-4 font-semibold uppercase tracking-[0.18em] text-[var(--text-3)]">
                        Host
                      </th>
                      <th className="pb-3 pr-4 font-semibold uppercase tracking-[0.18em] text-[var(--text-3)]">
                        Visit Time
                      </th>
                      <th className="pb-3 font-semibold uppercase tracking-[0.18em] text-[var(--text-3)]">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-[var(--text-1)]">
                    {modalPagedRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-[var(--text-3)]">
                          No visitors found for this status.
                        </td>
                      </tr>
                    ) : (
                      modalPagedRows.map((item) => (
                        <tr
                          key={item.visit_id}
                          className="border-t border-[var(--border-1)] transition hover:bg-[var(--surface-2)]"
                        >
                          <td className="py-4 pr-4 font-semibold text-[var(--text-1)]">{item.visitor_name}</td>
                          <td className="py-4 pr-4">{item.visitor_phone ?? "—"}</td>
                          <td className="py-4 pr-4">
                            {item.host_employee_id ? hostMap[item.host_employee_id] ?? "Unknown" : "Unassigned"}
                          </td>
                          <td className="py-4 pr-4">
                            {item.checkin_time
                              ? new Date(item.checkin_time).toLocaleString()
                              : item.checkout_time
                              ? new Date(item.checkout_time).toLocaleString()
                              : "—"}
                          </td>
                          <td className="py-4">
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(
                                item.status
                              )}`}
                            >
                              {item.status === "IN" ? "IN" : item.status === "OUT" ? "OUT" : item.status.replace("_", " ")}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-5">
                <Pagination
                  page={modalPage}
                  totalItems={modalRows.length}
                  pageSize={modalPageSize}
                  onPageChange={setModalPage}
                  onPageSizeChange={setModalPageSize}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
