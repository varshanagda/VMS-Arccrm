"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import PhotoCapture from "@/components/entry-desk/photo-capture";
import { Panel } from "@/components/dashboard/panels";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardPageHeader } from "@/components/layout/DashboardPageHeader";
import CustomSelect from "@/components/ui/custom-select";
import { useToast } from "@/components/ui/toast";
import { apiFetch, resolveApiAssetUrl } from "@/lib/api";
import { useAuthGuard } from "@/lib/use-auth-guard";

type VisitDetail = {
  visit_id?: number | null;
  visitor_id: number;
  visitor_name: string;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  purpose?: string | null;
  host_name?: string | null;
  photo_url?: string | null;
  status: string;
  created_at: string;
  qr_code?: string | null;
  source?: string | null;
  qr_expiry?: string | null;
};

type VisitStatusResult = {
  visit_id: number;
  visitor_id: number;
  visitor_name: string;
  host_name?: string | null;
  status: string;
  created_at: string;
};

type AvailableIdCard = { id: number; id_number: string };

function areAvailableCardsEqual(a: AvailableIdCard[], b: AvailableIdCard[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].id_number !== b[i].id_number) return false;
  }
  return true;
}

function getStatusTone(detail: VisitDetail | null) {
  if (!detail) {
    return {
      panelClass: "border-red-400/30 bg-red-500/10 text-red-700 dark:text-red-200",
      badgeClass: "border-red-400/40 bg-red-500/15 text-red-700 dark:text-red-200",
      label: "Invalid Scan",
      description: "No visitor record was resolved from this QR scan.",
      canCheckIn: false,
    };
  }

  const now = Date.now();
  const expiryMs = detail.qr_expiry ? Date.parse(detail.qr_expiry) : null;
  const isExpired = detail.source === "qr_invite" && Number.isFinite(expiryMs) && expiryMs !== null && expiryMs <= now;

  if (isExpired || detail.status === "rejected" || detail.status === "checked_out" || detail.status === "auto_checked_out") {
    return {
      panelClass: "border-red-400/30 bg-red-500/10 text-red-700 dark:text-red-200",
      badgeClass: "border-red-400/40 bg-red-500/15 text-red-700 dark:text-red-200",
      label: isExpired ? "QR Expired" : "Check-in Blocked",
      description: isExpired ? "This invite has expired." : `This visit is ${detail.status.replace(/_/g, " ")}.`,
      canCheckIn: false,
    };
  }

  if (detail.status === "checked_in") {
    return {
      panelClass: "border-amber-400/30 bg-amber-500/10 text-amber-700 dark:text-amber-100",
      badgeClass: "border-amber-400/40 bg-amber-500/15 text-amber-700 dark:text-amber-100",
      label: "Already Checked In",
      description: "This visitor is already checked in.",
      canCheckIn: false,
    };
  }

  if (detail.status !== "approved") {
    return {
      panelClass: "border-red-400/30 bg-red-500/10 text-red-700 dark:text-red-200",
      badgeClass: "border-red-400/40 bg-red-500/15 text-red-700 dark:text-red-200",
      label: "Approval Pending",
      description: "This visitor is not approved for check-in yet.",
      canCheckIn: false,
    };
  }

  return {
    panelClass: "border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-100",
    badgeClass: "border-emerald-400/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-100",
    label: "Valid Scan",
    description: "Visitor is ready for photo verification and check-in.",
    canCheckIn: true,
  };
}

function ReceptionQrVisitorContent() {
  const user = useAuthGuard({ allowedRoles: ["guard", "admin", "superadmin"] });
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pushToast } = useToast();

  const queryVisitId = useMemo(() => {
    const value = searchParams.get("visit_id");
    const parsed = value ? Number(value) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [searchParams]);
  const qrCode = searchParams.get("code");

  const [detail, setDetail] = useState<VisitDetail | null>(null);
  const [statusResult, setStatusResult] = useState<VisitStatusResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [policyAccepted, setPolicyAccepted] = useState(true);
  const [idNumber, setIdNumber] = useState("");
  const [idCardSelection, setIdCardSelection] = useState("");
  const [customIdNumber, setCustomIdNumber] = useState("");
  const [idCardLoading, setIdCardLoading] = useState(false);
  const [availableCards, setAvailableCards] = useState<AvailableIdCard[]>([]);

  const statusTone = useMemo(() => getStatusTone(detail), [detail]);

  const fetchAvailableCards = useCallback(async () => {
    setIdCardLoading(true);
    try {
      const data = await apiFetch<AvailableIdCard[]>("/id-cards/available");
      const next = data ?? [];
      setAvailableCards((prev) => (areAvailableCardsEqual(prev, next) ? prev : next));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load ID cards";
      pushToast({ title: "ID cards unavailable", description: message, variant: "error" });
    } finally {
      setIdCardLoading(false);
    }
  }, [pushToast]);

  const fetchVisitDetail = useCallback(async () => {
    if (qrCode) {
      setLoading(true);
      setError("");
      try {
        const detailData = await apiFetch<VisitDetail>(`/qr-visitor/details?code=${encodeURIComponent(qrCode)}`);
        setDetail(detailData);
        setStatusResult({
          visit_id: detailData.visit_id ?? 0,
          visitor_id: detailData.visitor_id,
          visitor_name: detailData.visitor_name,
          host_name: detailData.host_name ?? null,
          status: detailData.status,
          created_at: detailData.created_at,
        });
        setPhotoUrl(resolveApiAssetUrl(detailData.photo_url) ?? "");
        if (detailData.visit_id) {
          router.replace(`/guard/qr-visitor?visit_id=${detailData.visit_id}`);
        } else {
          setLoading(false);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to resolve scanned QR";
        setError(message);
        setDetail(null);
        setStatusResult(null);
        setLoading(false);
      }
      return;
    }

    const resolvedVisitId = queryVisitId;

    if (!resolvedVisitId) {
      setError("Scan QR first to load visitor details.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const detailData = await apiFetch<VisitDetail>(`/visit/${resolvedVisitId}/details`);
      setDetail(detailData);
      setStatusResult({
        visit_id: detailData.visit_id ?? 0,
        visitor_id: detailData.visitor_id,
        visitor_name: detailData.visitor_name,
        host_name: detailData.host_name ?? null,
        status: detailData.status,
        created_at: detailData.created_at,
      });
      setPhotoUrl(resolveApiAssetUrl(detailData.photo_url) ?? "");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load visitor details";
      setError(message);
      setDetail(null);
      setStatusResult(null);
    } finally {
      setLoading(false);
    }
  }, [qrCode, queryVisitId, router]);

  useEffect(() => {
    void fetchVisitDetail();
    void fetchAvailableCards();
  }, [fetchAvailableCards, fetchVisitDetail]);

  const handleConfirmCheckin = useCallback(async () => {
    if (!detail) return;
    if (!statusTone.canCheckIn) {
      pushToast({ title: "Check-in blocked", description: statusTone.description, variant: "error" });
      return;
    }
    if (!idNumber.trim()) {
      pushToast({ title: "ID card required", description: "Select or enter an ID card number.", variant: "error" });
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch("/visit/checkin", {
        method: "POST",
        body: JSON.stringify({
          visitor_id: detail.visitor_id,
          visit_id: detail.visit_id ?? undefined,
          photo_url: photoUrl || undefined,
          id_number: idNumber.trim(),
          policy_accepted: policyAccepted,
          qr_code: detail.qr_code || qrCode || undefined,
        }),
      });
      pushToast({
        title: "Check-in completed",
        description: `${detail.visitor_name} has been checked in.`,
        variant: "success",
      });
      router.push("/guard/qr-checkin");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Check-in failed";
      pushToast({ title: "Check-in failed", description: message, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }, [detail, idNumber, photoUrl, policyAccepted, pushToast, router, statusTone]);

  if (!user) return null;

  return (
    <DashboardLayout user={user}>
      <DashboardPageHeader title="QR Visitor" subtitle="Review scanned visitor details and complete check-in." />
      <div className="space-y-6">
        <Panel title="Scan Result">
          <div className={`rounded-2xl border p-4 ${statusTone.panelClass}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em]">QR Validation</p>
                <p className="mt-2 text-lg font-semibold text-[var(--text-1)]">{statusTone.label}</p>
                <p className="mt-1 text-sm text-current/90">{error || statusTone.description}</p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone.badgeClass}`}>
                {detail?.status ? detail.status.replace(/_/g, " ") : "invalid"}
              </span>
            </div>
          </div>
        </Panel>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <Panel title="Visitor Details">
            {loading ? (
              <div className="rounded-2xl border border-[var(--border-1)] bg-[var(--surface-2)] p-6 text-sm text-[var(--text-2)]">
                Loading visitor details...
              </div>
            ) : detail && statusResult ? (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-2xl border border-[var(--border-1)] bg-[var(--surface-2)]">
                  <div className="grid grid-cols-4 gap-4 border-b border-[var(--border-1)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-3)]">
                    <span>Visitor</span>
                    <span>Host</span>
                    <span>Status</span>
                    <span>Created</span>
                  </div>
                  <div className="grid grid-cols-4 gap-4 px-4 py-4 text-sm text-[var(--text-1)]">
                    <span className="font-semibold">{detail.visitor_name}</span>
                    <span>{detail.host_name || "Unknown"}</span>
                    <span>{statusResult.status.replace(/_/g, " ")}</span>
                    <span>{new Date(statusResult.created_at).toLocaleString()}</span>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--border-1)] bg-[var(--surface-2)] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-3)]">Phone</p>
                    <p className="mt-2 text-base text-[var(--text-1)]">{detail.phone || "-"}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border-1)] bg-[var(--surface-2)] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-3)]">Email</p>
                    <p className="mt-2 text-base text-[var(--text-1)]">{detail.email || "-"}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border-1)] bg-[var(--surface-2)] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-3)]">Company</p>
                    <p className="mt-2 text-base text-[var(--text-1)]">{detail.company || "-"}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border-1)] bg-[var(--surface-2)] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-3)]">Purpose</p>
                    <p className="mt-2 text-base text-[var(--text-1)]">{detail.purpose || "-"}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-sm text-red-700 dark:text-red-200">
                {error || "No visitor details found for this QR scan."}
              </div>
            )}
          </Panel>

          <Panel title="Photo And Check-In">
            <div className="space-y-5">
              <PhotoCapture value={photoUrl} onChange={setPhotoUrl} />

              <div className="flex flex-col">
                <label className="mb-2 text-sm text-[var(--text-2)]">ID Card</label>
                <CustomSelect
                  className="h-11 w-full m-0"
                  options={[
                    { value: "", label: idCardLoading ? "Loading ID cards..." : "Select ID card" },
                    ...availableCards.map(card => ({ value: card.id_number, label: card.id_number })),
                    { value: "__custom__", label: "Custom" }
                  ]}
                  value={idCardSelection}
                  onChange={(value) => {
                    setIdCardSelection(value);
                    if (value === "__custom__") {
                      setCustomIdNumber("");
                      setIdNumber("");
                      return;
                    }
                    setCustomIdNumber("");
                    setIdNumber(value);
                  }}
                />
              </div>

              {idCardSelection === "__custom__" ? (
                <div className="flex flex-col">
                  <label className="mb-2 text-sm text-[var(--text-2)]">Custom ID Card Number</label>
                  <input
                    className="h-11 w-full rounded-md border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm text-[var(--text-1)] outline-none transition placeholder:text-[var(--text-3)] focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 box-border leading-none"
                    placeholder="Enter ID card number"
                    value={customIdNumber}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCustomIdNumber(value);
                      setIdNumber(value);
                    }}
                  />
                </div>
              ) : null}

              <label className="flex items-center gap-2 text-sm text-[var(--text-2)]">
                <input
                  type="checkbox"
                  checked={policyAccepted}
                  onChange={(e) => setPolicyAccepted(e.target.checked)}
                  className="h-4 w-4 rounded border border-[var(--border-1)] bg-[var(--surface-2)] accent-[var(--accent)]"
                />
                Policy agreement accepted
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/guard/qr-checkin"
                  className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)] px-4 py-2 text-sm font-semibold text-[var(--text-1)] transition hover:bg-[var(--surface-3)]"
                >
                  Back To Scan
                </Link>
                <button
                  type="button"
                  onClick={handleConfirmCheckin}
                  disabled={submitting || !detail || !statusTone.canCheckIn}
                  className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Checking in..." : "Confirm & Check-In"}
                </button>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function ReceptionQrVisitorPage() {
  return (
    <Suspense fallback={null}>
      <ReceptionQrVisitorContent />
    </Suspense>
  );
}
