"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

import AppTableShell from "@/components/ui/app-table-shell";
import CustomSelect from "@/components/ui/custom-select";

type GridRowId = string | number;
type GridColumnVisibilityModel = Record<string, boolean>;
type GridRowSelectionModel = GridRowId[];
type GridCallbackDetails = Record<string, never>;

type GridApi = {
  getRowIndexRelativeToVisibleRows: (id: unknown) => number;
};

type GridCellParams<R> = {
  id: GridRowId;
  field: string;
  row: R;
  value: unknown;
  index: number;
  api: GridApi;
};

type GridValueGetterParams<R> = {
  id: GridRowId;
  field: string;
  row: R;
  value: unknown;
  index: number;
  api: GridApi;
};

type GridFilterItem = { field: string; value?: unknown };
type GridFilterModel = {
  items?: GridFilterItem[];
  quickFilterValues?: string[];
  logicOperator?: "and" | "or";
};

export type GridRenderCellParams<R> = GridCellParams<R>;
export type GridValueGetter<R> = (params: GridValueGetterParams<R>) => unknown;
export type GridValueFormatter<R> = (value: unknown, row?: R) => string;

export type GridColDef<R = object> = {
  field: string;
  headerName?: string;
  type?: "string" | "singleSelect";
  width?: number;
  minWidth?: number;
  flex?: number;
  sortable?: boolean;
  filterable?: boolean;
  disableColumnMenu?: boolean;
  valueOptions?: string[];
  valueGetter?: GridValueGetter<R>;
  valueFormatter?: GridValueFormatter<R>;
  renderCell?: (params: GridRenderCellParams<R>) => ReactNode;
  getQuickFilterText?: (params: { row?: R; value?: unknown; field?: string }) => unknown;
  getApplyQuickFilterFn?: (value: string) => ((params: { row?: R; value?: unknown; field?: string }) => boolean) | null;
};

type AppDataGridProps<R = object> = {
  title?: ReactNode;
  headerAction?: ReactNode;
  rows?: R[];
  columns: GridColDef<R>[];
  getRowId?: (row: R) => GridRowId;
  loading?: boolean;
  autoHeight?: boolean;
  rowHeight?: number;
  pageSizeOptions?: number[];
  initialState?: {
    columns?: {
      columnVisibilityModel?: GridColumnVisibilityModel;
    };
    pagination?: {
      paginationModel?: {
        page?: number;
        pageSize?: number;
      };
    };
  };
  sx?: CSSProperties;
  searchPlaceholder?: string;
  showSearch?: boolean;
  showColumns?: boolean;
  showFilters?: boolean;
  showExport?: boolean;
  showPagination?: boolean;
  rowSelection?: boolean;
  disableRowSelectionOnClick?: boolean;
  rowSelectionModel?: GridRowSelectionModel;
  onRowSelectionModelChange?: (model: GridRowSelectionModel) => void;
  columnVisibilityModel?: GridColumnVisibilityModel;
  onColumnVisibilityModelChange?: (model: GridColumnVisibilityModel, details?: GridCallbackDetails) => void;
  filterModel?: GridFilterModel;
  onFilterModelChange?: (model: GridFilterModel, details?: GridCallbackDetails) => void;
  onFiltersOpenChange?: (open: boolean) => void;
  onFilterToggle?: (open: boolean) => void;
  sidePanelOpen?: boolean;
  sidePanelContent?: ReactNode;
  sidePanelWidth?: number;
  localeText?: {
    noRowsLabel?: string;
  };
};

type FilterState = {
  search: string;
  fields: Record<string, string>;
  dateFrom: Record<string, string>;
  dateTo: Record<string, string>;
};

type FilterPanelProps<R> = {
  columns: GridColDef<R>[];
  filters: FilterState;
  onFiltersChange: (next: FilterState) => void;
  valueOptionsMap?: Record<string, string[]>;
  onResetFilters: () => void;
};

function normalizeValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim().toLowerCase();
}

function parseDateInput(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

function AppGridFilterPanel<R>({
  columns,
  filters,
  onFiltersChange,
  valueOptionsMap = {},
  onResetFilters,
}: FilterPanelProps<R>) {
  const allowedColumns = useMemo(
    () => columns.filter((column) => column.filterable !== false),
    [columns]
  );

  const activeCount = useMemo(() => {
    const textCount = Object.values(filters.fields).filter((value) => value.trim()).length;
    const dateCount =
      Object.values(filters.dateFrom).filter((value) => value.trim()).length +
      Object.values(filters.dateTo).filter((value) => value.trim()).length;
    const searchCount = filters.search.trim() ? 1 : 0;
    return textCount + dateCount + searchCount;
  }, [filters]);

  const getInputClass = (active: boolean) =>
    `w-full h-10 rounded-xl border bg-[var(--surface-1)] px-3 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] transition focus:outline-none focus:ring-2 ${
      active
        ? "border-[var(--focus-accent)] ring-1 ring-[var(--focus-ring)] focus:border-[var(--focus-accent)] focus:ring-[var(--focus-ring)]"
        : "border-slate-700/70 focus:border-[var(--focus-accent)] focus:ring-[var(--focus-ring)]"
    }`;

  const getLabel = useCallback(
    (field: string) => allowedColumns.find((column) => column.field === field)?.headerName ?? field,
    [allowedColumns]
  );

  const renderField = (field: string) => {
    const column = allowedColumns.find((item) => item.field === field);
    if (!column) return null;

    const label = column.headerName ?? column.field;
    const isSingleSelect = column.type === "singleSelect" && Array.isArray(column.valueOptions);
    const isPurposeField = column.field === "purpose";
    const purposeOptions = isPurposeField ? valueOptionsMap[column.field] ?? [] : [];
    const isDateField = column.field.toLowerCase().includes("date") || column.field.toLowerCase().includes("time") || column.field.toLowerCase().includes("created") || ["valid_from", "valid_to"].includes(column.field);

    if (isDateField) {
      const hasFrom = Boolean(filters.dateFrom[column.field]);
      const hasTo = Boolean(filters.dateTo[column.field]);
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="date"
            className={getInputClass(hasFrom)}
            value={filters.dateFrom[column.field] ?? ""}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                dateFrom: { ...filters.dateFrom, [column.field]: event.target.value },
              })
            }
          />
          <input
            type="date"
            className={getInputClass(hasTo)}
            value={filters.dateTo[column.field] ?? ""}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                dateTo: { ...filters.dateTo, [column.field]: event.target.value },
              })
            }
          />
        </div>
      );
    }

    if (isSingleSelect || (isPurposeField && purposeOptions.length > 0)) {
      return (
        <CustomSelect
          options={[
            { value: "", label: `All ${label}` },
            ...(isSingleSelect ? (column.valueOptions as string[]) : purposeOptions).map(opt => ({
              value: String(opt).trim().toLowerCase().replace(/\s+/g, "_"),
              label: String(opt).replace(/_/g, " ")
            }))
          ]}
          value={filters.fields[column.field] ?? ""}
          onChange={(value) => {
            onFiltersChange({
              ...filters,
              fields: { ...filters.fields, [column.field]: value },
            });
          }}
        />
      );
    }

    return (
      <input
        className={getInputClass(Boolean(filters.fields[column.field]?.trim()))}
        placeholder={`All ${label}`}
        value={filters.fields[column.field] ?? ""}
        onChange={(event) =>
          onFiltersChange({
            ...filters,
            fields: { ...filters.fields, [column.field]: event.target.value },
          })
        }
      />
    );
  };

  return (
    <div className="space-y-6 px-5 pt-5 pb-48">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-1)]">Filters</h3>
          <p className="text-xs text-[var(--text-3)]">{activeCount} active</p>
        </div>
        <button
          type="button"
          onClick={onResetFilters}
          className="h-9 rounded-lg border border-slate-700/70 bg-[var(--surface-1)] px-3 text-xs font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text-1)]"
        >
          Reset
        </button>
      </div>

      {allowedColumns.map((field) => (
        <div key={field.field} className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-3)]">
            {getLabel(field.field)}
          </p>
          {renderField(field.field)}
        </div>
      ))}
    </div>
  );
}

function DataGridToolbarButton({
  active = false,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const baseClass = "inline-flex shrink-0 items-center justify-center w-[110px] h-[40px] m-0 p-0 box-border rounded-full border border-solid text-xs font-semibold leading-none transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";
  const className = active
    ? `${baseClass} border-[var(--accent)] bg-[var(--nav-active-bg)] text-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]`
    : `${baseClass} border-[var(--border-1)] bg-[var(--surface-2)] text-[var(--text-2)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)]`;

  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}

export default function AppDataGrid<R extends object>({
  title,
  headerAction,
  rows = [],
  columns,
  getRowId,
  loading = false,
  autoHeight = true,
  rowHeight = 56,
  pageSizeOptions = [5, 10, 20, 50, 100],
  initialState,
  sx,
  searchPlaceholder = "Search",
  showSearch = true,
  showColumns = true,
  showFilters = true,
  showExport = true,
  showPagination = true,
  rowSelection,
  disableRowSelectionOnClick = true,
  rowSelectionModel,
  onRowSelectionModelChange,
  columnVisibilityModel,
  onColumnVisibilityModelChange,
  filterModel,
  onFilterModelChange,
  onFiltersOpenChange,
  onFilterToggle,
  sidePanelOpen = false,
  sidePanelContent,
  sidePanelWidth = 340,
  localeText,
}: AppDataGridProps<R>) {
  const headerCellClass =
    "overflow-hidden border-b border-[var(--border-1)] px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-2)]";
  const bodyCellClass =
    "overflow-hidden px-6 py-3 align-middle text-sm leading-6 text-[var(--text-1)]";
  const stateCellClass = "px-6 py-10 text-center text-sm text-[var(--text-3)]";

  const defaultPageSize = initialState?.pagination?.paginationModel?.pageSize ?? pageSizeOptions[0] ?? 5;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [exportActive, setExportActive] = useState(false);
  const [panelFilters, setPanelFilters] = useState<FilterState>({
    search: filterModel?.quickFilterValues?.[0] ?? "",
    fields: {},
    dateFrom: {},
    dateTo: {},
  });
  const [internalColumnVisibilityModel, setInternalColumnVisibilityModel] = useState<GridColumnVisibilityModel>(
    initialState?.columns?.columnVisibilityModel ?? {}
  );
  const [page, setPage] = useState(initialState?.pagination?.paginationModel?.page ?? 0);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const columnsMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    onFiltersOpenChange?.(filtersOpen);
  }, [filtersOpen, onFiltersOpenChange]);

  useEffect(() => {
    if (sidePanelOpen) {
      setFiltersOpen(false);
    }
  }, [sidePanelOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!columnsMenuRef.current?.contains(event.target as Node)) {
        setColumnsOpen(false);
      }
    }

    if (columnsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [columnsOpen]);

  const effectiveVisibilityModel = columnVisibilityModel ?? internalColumnVisibilityModel;
  const baselineColumnVisibilityModel = initialState?.columns?.columnVisibilityModel ?? {};

  const visibleColumns = useMemo(
    () => columns.filter((column) => effectiveVisibilityModel[column.field] !== false),
    [columns, effectiveVisibilityModel]
  );

  const hasCustomColumnSelection = useMemo(
    () =>
      columns.some(
        (column) =>
          (effectiveVisibilityModel[column.field] ?? true) !== (baselineColumnVisibilityModel[column.field] ?? true)
      ),
    [baselineColumnVisibilityModel, columns, effectiveVisibilityModel]
  );

  const filterPanelColumns = useMemo(
    () => visibleColumns.filter((column) => column.filterable !== false),
    [visibleColumns]
  );

  const hasActiveFilters = useMemo(() => {
    const hasFieldFilters = Object.values(panelFilters.fields).some((value) => value.trim());
    const hasDateFilters =
      Object.values(panelFilters.dateFrom).some((value) => value.trim()) ||
      Object.values(panelFilters.dateTo).some((value) => value.trim());
    return Boolean(panelFilters.search.trim() || hasFieldFilters || hasDateFilters);
  }, [panelFilters]);
  const hasActiveExportScope = exportActive || hasCustomColumnSelection || hasActiveFilters;

  const rowsWithId = useMemo(
    () =>
      rows.map((row, index) => ({
        row,
        id: getRowId ? getRowId(row) : (((row as { id?: GridRowId }).id ?? index) as GridRowId),
      })),
    [getRowId, rows]
  );

  const rowIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    rowsWithId.forEach((item, index) => {
      map.set(String(item.id), index);
    });
    return map;
  }, [rowsWithId]);

  const api = useMemo<GridApi>(
    () => ({
      getRowIndexRelativeToVisibleRows: (id) => rowIndexMap.get(String(id)) ?? -1,
    }),
    [rowIndexMap]
  );

  const getRawValue = useCallback(
    (column: GridColDef<R>, row: R, id: GridRowId) => {
      const index = rowIndexMap.get(String(id)) ?? -1;
      const directValue = (row as Record<string, unknown>)[column.field];
      if (column.valueGetter) {
        return column.valueGetter({
          id,
          field: column.field,
          row,
          value: directValue,
          index,
          api,
        });
      }
      return directValue;
    },
    [api, rowIndexMap]
  );

  const valueOptionsMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    filterPanelColumns.forEach((column) => {
      if (column.field !== "purpose") return;
      map[column.field] ??= new Set<string>();
      rowsWithId.forEach(({ row, id }) => {
        const value = String(getRawValue(column, row, id) ?? "").trim();
        if (value) map[column.field].add(value);
      });
    });
    return Object.fromEntries(Object.entries(map).map(([key, value]) => [key, Array.from(value).sort()]));
  }, [filterPanelColumns, getRawValue, rowsWithId]);

  const filteredRows = useMemo(() => {
    const searchTerm = panelFilters.search.trim().toLowerCase();

    return rowsWithId.filter(({ row, id }) => {
      for (const column of filterPanelColumns) {
        const field = column.field;
        const rawValue = getRawValue(column, row, id);
        const cellValue = normalizeValue(rawValue);
        const filterValue = normalizeValue(panelFilters.fields[field]);
        const isDateField = field.toLowerCase().includes("date") || field.toLowerCase().includes("time") || field.toLowerCase().includes("created") || ["valid_from", "valid_to"].includes(field);

        if (isDateField) {
          const from = parseDateInput(panelFilters.dateFrom[field] ?? "");
          const to = parseDateInput(panelFilters.dateTo[field] ?? "");
          if (from || to) {
            const cellDate = cellValue.split("t")[0];
            if (from && cellDate < from) return false;
            if (to && cellDate > to) return false;
          }
          continue;
        }

        if (!filterValue) continue;
        if (column.type === "singleSelect") {
          if (cellValue !== filterValue) return false;
        } else if (!cellValue.includes(filterValue)) {
          return false;
        }
      }

      if (!searchTerm) return true;

      const rowText = visibleColumns
        .map((column) => {
          const rawValue = getRawValue(column, row, id);
          if (column.getQuickFilterText) {
            return String(column.getQuickFilterText({ row, value: rawValue, field: column.field }) ?? "");
          }
          if (column.getApplyQuickFilterFn) {
            const matcher = column.getApplyQuickFilterFn(searchTerm);
            if (matcher?.({ row, value: rawValue, field: column.field })) {
              return searchTerm;
            }
          }
          return String(rawValue ?? "");
        })
        .join(" ")
        .toLowerCase();

      return rowText.includes(searchTerm);
    });
  }, [filterPanelColumns, getRawValue, panelFilters, rowsWithId, visibleColumns]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);

  const columnLayout = useMemo(() => {
    const fixedWidthTotal = visibleColumns.reduce((sum, column) => sum + (column.width ?? 0), 0);
    const flexColumns = visibleColumns.filter((column) => !column.width);
    const totalFlex = flexColumns.reduce((sum, column) => sum + (column.flex ?? 1), 0) || flexColumns.length || 1;

    const minTableWidth = visibleColumns.reduce((sum, column) => {
      if (column.minWidth) return sum + column.minWidth;
      if (column.width) return sum + column.width;
      return sum + 140;
    }, 0);

    const widths = Object.fromEntries(
      visibleColumns.map((column) => {
        if (column.width) {
          return [column.field, `${column.width}px`];
        }

        const flexShare = (column.flex ?? 1) / totalFlex;
        return [column.field, `max(${column.minWidth ?? 140}px, calc((100% - ${fixedWidthTotal}px) * ${flexShare}))`];
      })
    ) as Record<string, string>;

    return {
      minTableWidth,
      widths,
    };
  }, [visibleColumns]);

  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [page, safePage]);

  const pagedRows = useMemo(() => {
    if (!showPagination) return filteredRows;
    const start = safePage * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, pageSize, safePage, showPagination]);

  const activeSelection = rowSelectionModel ?? [];

  const handleFiltersChange = useCallback(
    (next: FilterState) => {
      setPanelFilters(next);
      setPage(0);
      onFilterModelChange?.(
        {
          items: [],
          logicOperator: "and",
          quickFilterValues: next.search.trim() ? [next.search.trim()] : [],
        },
        {}
      );
    },
    [onFilterModelChange]
  );

  const handleFilterToggle = useCallback(() => {
    const nextOpen = !filtersOpen;
    setFiltersOpen(nextOpen);
    onFilterToggle?.(nextOpen);
  }, [filtersOpen, onFilterToggle]);

  const handleColumnToggle = useCallback(
    (field: string) => {
      const nextModel = {
        ...effectiveVisibilityModel,
        [field]: effectiveVisibilityModel[field] === false,
      };
      if (!columnVisibilityModel) setInternalColumnVisibilityModel(nextModel);
      onColumnVisibilityModelChange?.(nextModel, {});
    },
    [columnVisibilityModel, effectiveVisibilityModel, onColumnVisibilityModelChange]
  );

  const handleExport = useCallback(() => {
    setExportActive(true);
    const header = visibleColumns.map((column) => column.headerName ?? column.field);
    const lines = filteredRows.map(({ row, id }) =>
      visibleColumns
        .map((column) => {
          const raw = getRawValue(column, row, id);
          const formatted = column.valueFormatter ? column.valueFormatter(raw, row) : String(raw ?? "");
          return `"${formatted.replace(/"/g, '""')}"`;
        })
        .join(",")
    );

    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "table-export.csv";
    link.click();
    URL.revokeObjectURL(url);
    window.setTimeout(() => {
      setExportActive(false);
    }, 1200);
  }, [filteredRows, getRawValue, visibleColumns]);

  const defaultFilterPanel = filtersOpen ? (
    <>
      <div className="flex h-[61px] items-center justify-between border-b border-white/10 px-4">
        <div>
          <p className="text-sm font-semibold text-[var(--text-1)]">Filters</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFiltersOpen(false);
            onFilterToggle?.(false);
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2 text-xs font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text-1)]"
          aria-label="Close filters"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>Close</span>
        </button>
      </div>
      <div className="h-full w-full overflow-y-auto">
        <AppGridFilterPanel
          columns={filterPanelColumns}
          filters={panelFilters}
          onFiltersChange={handleFiltersChange}
          valueOptionsMap={valueOptionsMap}
          onResetFilters={() =>
            handleFiltersChange({
              search: "",
              fields: {},
              dateFrom: {},
              dateTo: {},
            })
          }
        />
      </div>
    </>
  ) : null;

  const activePanelOpen = sidePanelOpen || filtersOpen;
  const activePanel = sidePanelOpen ? sidePanelContent : defaultFilterPanel;
  const activePanelWidth = sidePanelOpen ? sidePanelWidth : 300;

  return (
    <AppTableShell
      panelOpen={activePanelOpen}
      panel={activePanel}
      panelWidth={activePanelWidth}
      table={
        <div
          className={`flex min-w-0 flex-1 flex-col overflow-hidden ${autoHeight ? "" : "h-full"}`}
          style={sx}
        >
          {(title || headerAction || showSearch || showColumns || showFilters || showExport) ? (
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-1)] px-6 py-4">
              <div className="flex min-w-0 flex-1 items-center gap-5">
                {title ? (
                  <div className="min-w-0 shrink-0">
                    {typeof title === "string" ? (
                      <h3 className="truncate text-lg font-semibold text-[var(--text-1)]">{title}</h3>
                    ) : (
                      title
                    )}
                  </div>
                ) : null}
                {showSearch ? (
                  <div
                    className={`min-w-[220px] max-w-[360px] flex-1 rounded-xl border px-3 py-2 ${
                      panelFilters.search.trim()
                        ? "border-[var(--focus-accent)] bg-[var(--surface-2)] ring-1 ring-[var(--focus-ring)]"
                        : "border-slate-700/70 bg-[var(--surface-2)] focus-within:border-[var(--focus-accent)] focus-within:ring-2 focus-within:ring-[var(--focus-ring)]"
                    }`}
                  >
                    <input
                      value={panelFilters.search}
                      onChange={(event) =>
                        handleFiltersChange({
                          ...panelFilters,
                          search: event.target.value,
                        })
                      }
                      placeholder={searchPlaceholder}
                      className="w-full !border-none bg-transparent text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] !outline-none !ring-0"
                    />
                  </div>
                ) : null}
              </div>

              <div className="flex items-center gap-2.5">
                {headerAction}
                {showFilters && filterPanelColumns.length > 0 ? (
                  <DataGridToolbarButton
                    active={filtersOpen || hasActiveFilters}
                    onClick={handleFilterToggle}
                  >
                    Filters
                  </DataGridToolbarButton>
                ) : null}

                {showColumns ? (
                  <div className="relative flex items-center" ref={columnsMenuRef}>
                    <DataGridToolbarButton
                      active={columnsOpen || hasCustomColumnSelection}
                      onClick={() => setColumnsOpen((current) => !current)}
                    >
                      Columns
                    </DataGridToolbarButton>
                    {columnsOpen ? (
                      <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)]/100 p-2 shadow-[0_18px_45px_rgba(15,23,42,0.42)] backdrop-blur-xl">
                        {columns.map((column) => {
                          const isVisible = effectiveVisibilityModel[column.field] !== false;
                          return (
                          <label
                            key={column.field}
                            className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm text-[var(--text-1)] hover:bg-[var(--surface-2)]"
                          >
                            <input
                              type="checkbox"
                              checked={isVisible}
                              onChange={() => handleColumnToggle(column.field)}
                              className={`h-4 w-4 rounded border accent-[var(--accent)] ${
                                isVisible ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/20" : "border-[var(--border-1)]"
                              }`}
                            />
                            <span>{column.headerName ?? column.field}</span>
                          </label>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {showExport ? (
                  <DataGridToolbarButton
                    active={hasActiveExportScope}
                    onClick={handleExport}
                  >
                    Export
                  </DataGridToolbarButton>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className={`${autoHeight ? "" : "h-full"} min-w-0 overflow-x-auto overflow-y-auto`}>
            <table
              className="w-full border-collapse table-fixed"
              style={{ minWidth: `${Math.max(columnLayout.minTableWidth, 960)}px` }}
            >
              <colgroup>
                {visibleColumns.map((column) => (
                  <col key={column.field} style={{ width: columnLayout.widths[column.field] }} />
                ))}
              </colgroup>
              <thead className="bg-[var(--grid-header-bg)]">
                <tr>
                  {visibleColumns.map((column) => {
                    const style: CSSProperties = {
                      width: columnLayout.widths[column.field],
                      minWidth: column.minWidth ?? column.width ?? undefined,
                    };
                    return (
                      <th
                        key={column.field}
                        style={style}
                        className={headerCellClass}
                      >
                        <span className="block truncate">
                          {column.headerName ?? column.field}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={Math.max(visibleColumns.length, 1)} className={stateCellClass}>
                      Loading...
                    </td>
                  </tr>
                ) : pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={Math.max(visibleColumns.length, 1)} className={stateCellClass}>
                      {localeText?.noRowsLabel ?? "No rows found."}
                    </td>
                  </tr>
                ) : (
                  pagedRows.map(({ row, id }) => {
                    const isSelected = activeSelection.includes(id);
                    return (
                      <tr
                        key={String(id)}
                        onClick={() => {
                          if (rowSelection && !disableRowSelectionOnClick) {
                            onRowSelectionModelChange?.([id]);
                          }
                        }}
                        className={`border-b border-[var(--border-1)] transition hover:bg-[var(--surface-2)] ${
                          isSelected ? "bg-[var(--nav-active-bg)]" : ""
                        } ${rowSelection && !disableRowSelectionOnClick ? "cursor-pointer" : ""}`}
                        style={{ height: rowHeight }}
                      >
                        {visibleColumns.map((column) => {
                          const rawValue = getRawValue(column, row, id);
                          const displayValue = column.valueFormatter ? column.valueFormatter(rawValue, row) : rawValue;
                          const content = column.renderCell
                            ? column.renderCell({
                                id,
                                field: column.field,
                                row,
                                value: rawValue,
                                index: rowIndexMap.get(String(id)) ?? -1,
                                api,
                              })
                            : (
                                <span className="block truncate">
                                  {String(displayValue ?? "-")}
                                </span>
                              );
                          return (
                            <td key={column.field} className={bodyCellClass}>
                              <div className="min-w-0 max-w-full overflow-hidden">
                                {content}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {showPagination ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-1)] bg-[var(--surface-2)] px-6 py-4 text-sm">
              <div className="text-[var(--text-3)]">
                {filteredRows.length === 0
                  ? "0 results"
                  : `${safePage * pageSize + 1}-${Math.min((safePage + 1) * pageSize, filteredRows.length)} of ${filteredRows.length}`}
              </div>
              <div className="flex items-center gap-3">
                <div className="w-[120px]">
                  <CustomSelect
                    options={pageSizeOptions.map(opt => ({ value: String(opt), label: `${opt} / page` }))}
                    value={String(pageSize)}
                    onChange={(value) => {
                      setPageSize(Number(value));
                      setPage(0);
                    }}
                    menuPlacement="top"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(0, current - 1))}
                    disabled={safePage === 0}
                    className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text-1)] disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <span className="text-[var(--text-2)]">
                    {safePage + 1} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
                    disabled={safePage >= totalPages - 1}
                    className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text-1)] disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      }
    />
  );
}
