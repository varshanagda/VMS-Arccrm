"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useAuthGuard } from "@/lib/use-auth-guard";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardPageHeader } from "@/components/layout/DashboardPageHeader";
import { TodaysChecklistPanel, type VisitChecklistRow } from "@/components/dashboard/todays-checklist";
import PhotoPreviewModal from "@/components/ui/photo-preview-modal";
import { API_BASE_URL, apiFetch, resolveApiAssetUrl } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

type AdminDashboardSummary = {
  visitors_today: number;
  checked_in_visitors: number;
  checked_out_visitors: number;
  pending_approvals: number;
  recent_visits: Array<{
    visit_id: number;
    visitor_name: string;
    photo_url?: string | null;
    host_name?: string | null;
    purpose?: string | null;
    checkin_time?: string | null;
    checkout_time?: string | null;
    status: string;
  }>;
};

function statusBadgeClass(status: string) {
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
}

export default function AdminDashboard() {
  const user = useAuthGuard({ allowedRoles: ["admin", "superadmin"] });
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const [history, setHistory] = useState<VisitChecklistRow[]>([]);
  const [hostMap, setHostMap] = useState<Record<number, string>>({});

  const loadSummary = useCallback(async (isInitial = false) => {
    if (isInitial) setSummaryLoading(true);
    try {
      const data = await apiFetch<AdminDashboardSummary>("/admin/dashboard/summary");
      setSummaryError(null);
      setSummary((prev) => {
        if (!prev) return data;
        return JSON.stringify(prev) === JSON.stringify(data) ? prev : data;
      });
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Failed to refresh dashboard data");
    } finally {
      if (isInitial) setSummaryLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const [historyData, hostData] = await Promise.all([
        apiFetch<VisitChecklistRow[]>("/visit/history"),
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
      // Keep old data on transient network error
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadSummary(true);
    void loadHistory();
  }, [loadHistory, loadSummary, user]);

  useEffect(() => {
    if (!user) return;
    const token = getAccessToken();
    if (!token) return;
    const source = new EventSource(`${API_BASE_URL}/events/visits?token=${encodeURIComponent(token)}`);

    source.onmessage = () => {
      void loadSummary();
      void loadHistory();
    };
    source.onerror = () => {
      source.close();
    };
    return () => {
      source.close();
    };
  }, [loadHistory, loadSummary, user]);

  const stats = useMemo(() => {
    const visitorsToday = summary?.visitors_today ?? 0;
    const checkedInVisitors = summary?.checked_in_visitors ?? 0;
    const checkedOutVisitors = summary?.checked_out_visitors ?? 0;
    const pendingApprovals = summary?.pending_approvals ?? 0;
    return [
      { label: "Visitors Today", value: String(visitorsToday), change: "Today", color: "text-emerald-400", bg: "bg-emerald-500/15" },
      { label: "IN", value: String(checkedInVisitors), change: "Live", color: "text-orange-400", bg: "bg-orange-500/15" },
      { label: "OUT", value: String(checkedOutVisitors), change: "Today", color: "text-sky-400", bg: "bg-sky-500/15" },
      { label: "Pending Approvals", value: String(pendingApprovals), change: "Awaiting host", color: "text-amber-400", bg: "bg-amber-500/15" },
    ] as const;
  }, [summary]);

  const recentVisitors = useMemo(() => {
    const formatTime = (value?: string | null) => {
      if (!value) return "—";
      return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    return (summary?.recent_visits ?? []).slice(0, 5).map((item) => {
      const isCheckedOut = item.status === "checked_out";
      const visitTime = isCheckedOut ? formatTime(item.checkout_time ?? item.checkin_time) : formatTime(item.checkin_time);
      const photo = resolveApiAssetUrl(item.photo_url);
      const statusLabel = item.status === "checked_in" ? "IN" : item.status === "checked_out" ? "OUT" : item.status.replace("_", " ");
      return { name: item.visitor_name, visitTime, status: item.status, statusLabel, photo };
    });
  }, [summary]);

  if (!user) return null;

  return (
    <DashboardLayout user={user}>
      <DashboardPageHeader
        title="Dashboard Overview"
        subtitle={`Welcome back, ${user.name}. Here’s what’s happening today.`}
      />

      {/* KPI Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)] p-6 shadow-[var(--shadow-1)]"
          >
            <p className="text-sm font-medium text-[var(--text-3)]">{stat.label}</p>
            <div className="flex items-end justify-between mt-2">
              <h3 className="text-3xl font-bold text-[var(--text-1)]">{stat.value}</h3>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${stat.bg} ${stat.color}`}>
                {stat.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Visitors */}
        <section className="lg:col-span-2 rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)] p-6 shadow-[var(--shadow-1)] overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-[var(--text-1)]">Recent Visitors</h3>
            <Link
              href="/guard/visitors"
              className="text-sm font-semibold text-[var(--accent)] hover:brightness-95"
            >
              View all
            </Link>
          </div>
          <div className="space-y-4">
            {recentVisitors.length === 0 ? (
              <div className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-2)] p-4 text-sm text-[var(--text-3)]">
                {summaryLoading ? "Loading recent visitors..." : summaryError ? "Unable to load recent visitors." : "No recent visitors found."}
              </div>
            ) : (
              recentVisitors.map((row, i) => (
                <div
                  key={`${row.name}-${i}`}
                  className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-1)] bg-[var(--surface-2)]"
                >
                  <div className="flex items-center gap-4">
                    {row.photo ? (
                      <button
                        type="button"
                        onClick={() => setPreviewPhoto(row.photo ?? null)}
                        className="group h-10 w-10 overflow-hidden rounded-full border border-[var(--border-1)] bg-[var(--surface-3)]"
                        aria-label={`Preview photo for ${row.name}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={row.photo}
                          alt={row.name}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </button>
                    ) : (
                      <div className="h-10 w-10 rounded-full border border-[var(--border-1)] bg-[var(--surface-3)]" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[var(--text-1)] truncate">{row.name}</p>
                      <p className="text-xs text-[var(--text-3)] truncate">Visit time: {row.visitTime}</p>
                    </div>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(row.status)}`}>
                    {row.statusLabel}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <TodaysChecklistPanel history={history} hostMap={hostMap} />
      </div>

      {previewPhoto ? (
        <PhotoPreviewModal src={previewPhoto} alt="Visitor" onClose={() => setPreviewPhoto(null)} />
      ) : null}
    </DashboardLayout>
  );
}
