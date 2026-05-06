"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";
import CustomSelect from "@/components/ui/custom-select";

const passPurposeOptions = [
  "Meeting",
  "Interview",
  "Delivery",
  "Maintenance",
  "Vendor Visit",
  "Site Visit",
];

export interface AccessPassPayload {
  visitor_name: string;
  phone?: string;
  email?: string;
  company?: string;
  purpose: string;
  valid_from: string;
  valid_to: string;
}

export interface AccessPassResult {
  email_sent?: boolean | null;
  email_error?: string | null;
}

export const initialAccessPassPayload: AccessPassPayload = {
  visitor_name: "",
  phone: "",
  email: "",
  company: "",
  purpose: "",
  valid_from: "",
  valid_to: "",
};

interface AccessPassFormProps {
  initialValues?: AccessPassPayload;
  submitLabel?: string;
  loadingLabel?: string;
  className?: string;
  onSuccess?: (result: AccessPassResult, payload: AccessPassPayload) => void;
  onError?: (error: Error) => void;
}

export function AccessPassForm({
  initialValues,
  submitLabel = "Create Pass",
  loadingLabel = "Creating...",
  className,
  onSuccess,
  onError,
}: AccessPassFormProps) {
  const [loading, setLoading] = useState(false);
  const [passPayload, setPassPayload] = useState<AccessPassPayload>(initialValues ?? initialAccessPassPayload);

  const mergedInitialValues = useMemo(
    () => ({ ...initialAccessPassPayload, ...(initialValues ?? {}) }),
    [initialValues]
  );

  useEffect(() => {
    setPassPayload(mergedInitialValues);
  }, [mergedInitialValues]);

  function normalizeOptionalField(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  function toIsoDateTime(value: string) {
    return new Date(value).toISOString();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const created = await apiFetch<AccessPassResult>("/access-pass/create", {
        method: "POST",
        timeoutMs: 0,
        body: JSON.stringify({
          visitor_name: passPayload.visitor_name.trim(),
          phone: normalizeOptionalField(passPayload.phone),
          email: normalizeOptionalField(passPayload.email),
          company: normalizeOptionalField(passPayload.company),
          purpose: normalizeOptionalField(passPayload.purpose),
          valid_from: toIsoDateTime(passPayload.valid_from),
          valid_to: toIsoDateTime(passPayload.valid_to),
          max_visits: 10,
        }),
      });
      onSuccess?.(created, passPayload);
      setPassPayload(initialAccessPassPayload);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error("Failed to create pass"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`flex flex-col gap-6 ${className || ""}`}>
      <div className="flex flex-col">
        <label className="mb-1 text-xs text-[var(--text-2)]">Visitor Name</label>
        <input
          className="h-11 w-full rounded-md border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 box-border leading-none"
          placeholder="Visitor name"
          value={passPayload.visitor_name}
          onChange={(e) => setPassPayload((prev) => ({ ...prev, visitor_name: e.target.value }))}
          required
        />
      </div>
      <div className="flex flex-col">
        <label className="mb-1 text-xs text-[var(--text-2)]">Phone</label>
        <input
          className="h-11 w-full rounded-md border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 box-border leading-none"
          placeholder="Phone"
          value={passPayload.phone}
          onChange={(e) => setPassPayload((prev) => ({ ...prev, phone: e.target.value }))}
        />
      </div>
      <div className="flex flex-col">
        <label className="mb-1 text-xs text-[var(--text-2)]">Email</label>
        <input
          className="h-11 w-full rounded-md border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 box-border leading-none"
          placeholder="Email"
          value={passPayload.email}
          onChange={(e) => setPassPayload((prev) => ({ ...prev, email: e.target.value }))}
        />
      </div>
      <div className="flex flex-col">
        <label className="mb-1 text-xs text-[var(--text-2)]">Company</label>
        <input
          className="h-11 w-full rounded-md border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 box-border leading-none"
          placeholder="Company"
          value={passPayload.company}
          onChange={(e) => setPassPayload((prev) => ({ ...prev, company: e.target.value }))}
        />
      </div>
      <div className="flex flex-col">
        <label className="mb-1 text-xs text-[var(--text-2)]">Purpose</label>
        <CustomSelect
          className="h-11 w-full m-0"
          options={[
            { value: "", label: "Select purpose" },
            ...passPurposeOptions.map(opt => ({ value: opt, label: opt }))
          ]}
          value={passPayload.purpose}
          onChange={(value) => setPassPayload((prev) => ({ ...prev, purpose: value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col">
          <label className="mb-1 text-xs text-[var(--text-2)]">Valid From</label>
          <input
            type="datetime-local"
            className="h-11 w-full rounded-md border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm text-[var(--text-1)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 box-border leading-none"
            value={passPayload.valid_from}
            onChange={(e) => setPassPayload((prev) => ({ ...prev, valid_from: e.target.value }))}
            required
          />
        </div>
        <div className="flex flex-col">
          <label className="mb-1 text-xs text-[var(--text-2)]">Valid To</label>
          <input
            type="datetime-local"
            className="h-11 w-full rounded-md border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm text-[var(--text-1)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 box-border leading-none"
            value={passPayload.valid_to}
            onChange={(e) => setPassPayload((prev) => ({ ...prev, valid_to: e.target.value }))}
            required
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="mt-2 h-11 w-full rounded-lg bg-[var(--accent)] text-sm font-semibold text-[var(--accent-fg)] shadow-md transition hover:brightness-95 disabled:opacity-50"
      >
        {loading ? loadingLabel : submitLabel}
      </button>
    </form>
  );
}
