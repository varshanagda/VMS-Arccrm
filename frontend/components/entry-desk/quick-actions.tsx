"use client";

interface QuickActionsProps {
  onCheckIn: () => void;
  onCheckOut: () => void;
  disabled?: boolean;
}

export default function QuickActions({ onCheckIn, onCheckOut, disabled }: QuickActionsProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={onCheckIn}
        disabled={disabled}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] shadow-sm transition hover:brightness-95 disabled:opacity-60"
      >
        IN
      </button>
      <button
        type="button"
        onClick={onCheckOut}
        disabled={disabled}
        className="rounded-md border border-[var(--border-1)] bg-[var(--surface-2)] px-4 py-2 text-sm font-semibold text-[var(--text-1)] transition hover:bg-[var(--surface-3)] disabled:opacity-60"
      >
        OUT
      </button>
    </div>
  );
}
