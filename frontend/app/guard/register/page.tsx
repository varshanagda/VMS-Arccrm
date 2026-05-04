"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Panel } from "@/components/dashboard/panels";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardPageHeader } from "@/components/layout/DashboardPageHeader";
import EntryDeskHeader from "@/components/entry-desk/entry-desk-header";
import HostSearch, { HostEmployee } from "@/components/entry-desk/host-search";
import PhotoCapture from "@/components/entry-desk/photo-capture";
import CustomSelect from "@/components/ui/custom-select";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api";
import { useAuthGuard } from "@/lib/use-auth-guard";

interface VisitorCreatePayload {
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  visitor_type?: string;
  host_employee?: number | null;
  purpose?: string;
  photo_url?: string;
  valid_from?: string;
  valid_to?: string;
}

interface VisitorOut {
  id: number;
  visit_id?: number;
  email_sent?: boolean | null;
  email_error?: string | null;
}

const steps = ["Visitor Info", "Photo", "Host"];


function StepIndicator({ stepIndex, current }: { stepIndex: number; current: number }) {
  if (stepIndex < current) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-semibold text-[var(--accent-fg)]">
        ✓
      </div>
    );
  }
  if (stepIndex === current) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-semibold text-[var(--accent-fg)]">
        {stepIndex + 1}
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-1)] text-sm text-[var(--text-3)]">
      {stepIndex + 1}
    </div>
  );
}

export default function ReceptionRegisterPage() {
  const user = useAuthGuard({ allowedRoles: ["guard", "admin", "superadmin"] });
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pushToast } = useToast();
  
  const initialStep = Number(searchParams.get("step")) || 0;
  const [step, setStep] = useState(initialStep);

  useEffect(() => {
    const currentStepParam = searchParams.get("step");
    if (String(step) !== currentStepParam) {
      router.replace(`?step=${step}`);
    }
  }, [step, router, searchParams]);
  const [purposeOption, setPurposeOption] = useState("Meeting");
  const [customPurpose, setCustomPurpose] = useState("");
  const [visitorTypeOption, setVisitorTypeOption] = useState("Guest");
  const [customVisitorType, setCustomVisitorType] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [selectedHost, setSelectedHost] = useState<HostEmployee | null>(null);

  const [register, setRegister] = useState<VisitorCreatePayload>(() => {
    return {
      name: "",
      phone: "",
      email: "",
      company: "",
      visitor_type: "Guest",
      host_employee: null,
      purpose: "Meeting",
      photo_url: "",
      valid_from: "",
      valid_to: "",
    };
  });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^\d{10}$/;

  function validateStep(targetStep: number) {
    const nextErrors: Record<string, string> = {};
    if (targetStep === 0) {
      if (!register.name?.trim()) nextErrors.name = "Visitor name is required.";
      if (register.email && !emailRegex.test(register.email.trim())) nextErrors.email = "Enter a valid email.";
      if (register.phone && !phoneRegex.test(register.phone.trim())) nextErrors.phone = "Enter a valid 10-digit phone number.";
      if (!register.purpose?.trim()) nextErrors.purpose = "Purpose is required.";
      if (!register.valid_from) nextErrors.valid_from = "Valid from date is required.";
      if (!register.valid_to) nextErrors.valid_to = "Valid to date is required.";
    }
    if (targetStep === 1) {
      if (!register.photo_url) nextErrors.photo_url = "Photo is required.";
    }
    if (targetStep === 2) {
      if (!register.host_employee) nextErrors.host_employee = "Please select a host.";
    }
    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function goNext() {
    if (!validateStep(step)) return;
    setStep((prev) => Math.min(prev + 1, steps.length - 1));
  }

  function goBack() {
    setFormErrors({});
    setStep((prev) => Math.max(prev - 1, 0));
  }

  async function handleRegister() {
    if (!validateStep(2)) return;
    setLoading(true);
    try {
      const payload = {
        ...register,
        host_employee: register.host_employee ? Number(register.host_employee) : null,
        valid_from: register.valid_from ? new Date(register.valid_from).toISOString() : undefined,
        valid_to: register.valid_to ? new Date(register.valid_to).toISOString() : undefined,
      };
      const created = await apiFetch<VisitorOut>("/visitor/create", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      pushToast({
        title: "Visitor registered",
        description: "Awaiting host approval.",
        variant: "success",
      });
      if (created.email_sent === false && created.visit_id) {
        pushToast({
          title: "Email not sent",
          description: created.email_error ?? "Host approval email failed.",
          variant: "error",
          actionLabel: "Resend email",
          onAction: async () => {
            try {
              await apiFetch("/visitor/resend-approval", {
                method: "POST",
                body: JSON.stringify({ visit_id: created.visit_id }),
              });
              pushToast({
                title: "Email resent",
                description: "Approval email sent to host.",
                variant: "success",
              });
            } catch (err) {
              const errorMessage = err instanceof Error ? err.message : "Resend failed";
              pushToast({
                title: "Resend failed",
                description: errorMessage,
                variant: "error",
              });
            }
          },
        });
      }
      setRegister({
        name: "",
        phone: "",
        email: "",
        company: "",
        visitor_type: "Guest",
        host_employee: null,
        purpose: "Meeting",
        photo_url: "",
        valid_from: "",
        valid_to: "",
      });
      setPurposeOption("Meeting");
      setCustomPurpose("");
      setVisitorTypeOption("Guest");
      setCustomVisitorType("");
      setStep(0);
      router.push("/guard/qr-checkin");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Registration failed";
      pushToast({
        title: "Registration failed",
        description: errorMessage,
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  const progressWidth = useMemo(() => `${((step + 1) / steps.length) * 100}%`, [step]);

  if (!user) return null;

  return (
    <DashboardLayout user={user}>
      <DashboardPageHeader title="Register Visitor" subtitle="Multi-step visitor registration for reception." />
      <div className="space-y-6">
        <EntryDeskHeader
          title="Visitor Registration"
          subtitle="Complete each step and submit the visitor."
        />

        <Panel title="Registration Wizard">
          <div className="mb-4 h-1 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
            <div className="h-full bg-[var(--accent)] transition-all" style={{ width: progressWidth }} />
          </div>
          <div className="flex flex-wrap items-center gap-6">
            {steps.map((label, idx) => (
              <div key={label} className="flex items-center gap-3">
                <StepIndicator stepIndex={idx} current={step} />
                <span className={idx === step ? "text-[var(--text-1)]" : "text-[var(--text-3)]"}>{label}</span>
              </div>
            ))}
          </div>

          <div className="mt-6">
            {step === 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col">
                  <label className="mb-2 text-sm text-[var(--text-2)]">Visitor Name</label>
                  <input
                    className="h-11 w-full rounded-md border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm text-[var(--text-1)] outline-none transition placeholder:text-[var(--text-3)] focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 box-border leading-none"
                    value={register.name}
                    onChange={(e) => setRegister((prev) => ({ ...prev, name: e.target.value }))}
                  />
                  {formErrors.name ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.name}</p> : null}
                </div>
                <div className="flex flex-col">
                  <label className="mb-2 text-sm text-[var(--text-2)]">Phone</label>
                  <input
                    className="h-11 w-full rounded-md border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm text-[var(--text-1)] outline-none transition placeholder:text-[var(--text-3)] focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 box-border leading-none"
                    value={register.phone}
                    onChange={(e) => setRegister((prev) => ({ ...prev, phone: e.target.value }))}
                  />
                  {formErrors.phone ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.phone}</p> : null}
                </div>
                <div className="flex flex-col">
                  <label className="mb-2 text-sm text-[var(--text-2)]">Email</label>
                  <input
                    className="h-11 w-full rounded-md border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm text-[var(--text-1)] outline-none transition placeholder:text-[var(--text-3)] focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 box-border leading-none"
                    value={register.email}
                    onChange={(e) => setRegister((prev) => ({ ...prev, email: e.target.value }))}
                  />
                  {formErrors.email ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.email}</p> : null}
                </div>
                <div className="flex flex-col">
                  <label className="mb-2 text-sm text-[var(--text-2)]">Company</label>
                  <input
                    className="h-11 w-full rounded-md border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm text-[var(--text-1)] outline-none transition placeholder:text-[var(--text-3)] focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 box-border leading-none"
                    value={register.company}
                    onChange={(e) => setRegister((prev) => ({ ...prev, company: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="mb-2 text-sm text-[var(--text-2)]">Visitor Type</label>
                  <CustomSelect
                    className="h-11 w-full m-0"
                    options={["Guest", "Vendor", "Contractor", "Interview", "Delivery", "Custom"].map(opt => ({ value: opt, label: opt }))}
                    value={visitorTypeOption}
                    onChange={(value) => {
                      setVisitorTypeOption(value);
                      if (value !== "Custom") {
                        setCustomVisitorType("");
                        setRegister((prev) => ({ ...prev, visitor_type: value }));
                      } else {
                        setRegister((prev) => ({ ...prev, visitor_type: "" }));
                      }
                    }}
                  />
                </div>
                {visitorTypeOption === "Custom" ? (
                  <div className="flex flex-col">
                    <label className="mb-2 text-sm text-[var(--text-2)]">Custom Visitor Type</label>
                    <input
                      className="h-11 w-full rounded-md border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm text-[var(--text-1)] outline-none transition placeholder:text-[var(--text-3)] focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 box-border leading-none"
                      value={customVisitorType}
                      onChange={(e) => {
                        const value = e.target.value;
                        setCustomVisitorType(value);
                        setRegister((prev) => ({ ...prev, visitor_type: value }));
                      }}
                      placeholder="Enter visitor type"
                    />
                  </div>
                ) : null}
                <div className="flex flex-col">
                  <label className="mb-2 text-sm text-[var(--text-2)]">Purpose</label>
                  <CustomSelect
                    className="h-11 w-full m-0"
                    options={["Meeting", "Interview", "Delivery", "Maintenance", "Vendor", "Custom"].map(opt => ({ value: opt, label: opt }))}
                    value={purposeOption}
                    onChange={(value) => {
                      setPurposeOption(value);
                      if (value !== "Custom") {
                        setCustomPurpose("");
                        setRegister((prev) => ({ ...prev, purpose: value }));
                      } else {
                        setRegister((prev) => ({ ...prev, purpose: "" }));
                      }
                    }}
                  />
                  {formErrors.purpose ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.purpose}</p> : null}
                </div>
                {purposeOption === "Custom" ? (
                  <div className="flex flex-col md:col-span-2">
                    <label className="mb-2 text-sm text-[var(--text-2)]">Custom Purpose</label>
                    <input
                      className="h-11 w-full rounded-md border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm text-[var(--text-1)] outline-none transition placeholder:text-[var(--text-3)] focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 box-border leading-none"
                      value={customPurpose}
                      onChange={(e) => {
                        const value = e.target.value;
                        setCustomPurpose(value);
                        setRegister((prev) => ({ ...prev, purpose: value }));
                      }}
                      placeholder="Enter purpose"
                    />
                  </div>
                ) : null}

                <div className="flex flex-col">
                  <label className="mb-2 text-sm text-[var(--text-2)]">Valid From</label>
                  <input
                    type="datetime-local"
                    className="h-11 w-full rounded-md border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm text-[var(--text-1)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 box-border leading-none"
                    value={register.valid_from}
                    onChange={(e) => setRegister((prev) => ({ ...prev, valid_from: e.target.value }))}
                  />
                  {formErrors.valid_from ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.valid_from}</p> : null}
                </div>
                <div className="flex flex-col">
                  <label className="mb-2 text-sm text-[var(--text-2)]">Valid To</label>
                  <input
                    type="datetime-local"
                    className="h-11 w-full rounded-md border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm text-[var(--text-1)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 box-border leading-none"
                    value={register.valid_to}
                    onChange={(e) => setRegister((prev) => ({ ...prev, valid_to: e.target.value }))}
                  />
                  {formErrors.valid_to ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.valid_to}</p> : null}
                </div>

                <div className="md:col-span-2 flex justify-end mt-2">
                  <button
                    type="button"
                    onClick={goNext}
                    className="rounded-lg bg-[var(--accent)] px-6 py-2 h-11 text-sm font-semibold text-[var(--accent-fg)] shadow-sm transition hover:brightness-95 flex items-center box-border"
                  >
                    Next →
                  </button>
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-4">
                <PhotoCapture
                  value={register.photo_url}
                  onChange={(value) => setRegister((prev) => ({ ...prev, photo_url: value }))}
                />
                {formErrors.photo_url ? <p className="text-sm text-red-600 dark:text-red-400">{formErrors.photo_url}</p> : null}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={goBack}
                    className="rounded-lg bg-[var(--accent)] px-6 py-2 text-sm font-semibold text-[var(--accent-fg)] shadow-sm transition hover:brightness-95"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    className="rounded-lg bg-[var(--accent)] px-6 py-2 text-sm font-semibold text-[var(--accent-fg)] shadow-sm transition hover:brightness-95"
                  >
                    Next →
                  </button>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <HostSearch
                  value={register.host_employee ?? null}
                  onChange={(value) => setRegister((prev) => ({ ...prev, host_employee: value }))}
                  onSelectHost={setSelectedHost}
                />
                <p className="text-xs text-[var(--text-3)]">
                  Selected host email: {selectedHost?.email ?? "None"}
                </p>
                {formErrors.host_employee ? <p className="text-sm text-red-600 dark:text-red-400">{formErrors.host_employee}</p> : null}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={goBack}
                    className="rounded-lg bg-[var(--accent)] px-6 py-2 text-sm font-semibold text-[var(--accent-fg)] shadow-sm transition hover:brightness-95"
                  >
                    ← Back
                  </button>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={goNext}
                      className="rounded-lg bg-[var(--accent)] px-6 py-2 text-sm font-semibold text-[var(--accent-fg)] shadow-sm transition hover:brightness-95"
                    >
                      Next →
                    </button>
                    <button
                      type="button"
                      onClick={handleRegister}
                      disabled={loading}
                      className="rounded-lg bg-[var(--accent)] px-6 py-2 text-sm font-semibold text-[var(--accent-fg)] shadow-sm transition hover:brightness-95 disabled:opacity-60"
                    >
                      {loading ? "Registering..." : "Register"}
                      {loading ? <span className="ml-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--accent-fg)]/30 border-t-[var(--accent-fg)]" /> : null}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

          </div>
        </Panel>
      </div>
    </DashboardLayout>
  );
}
