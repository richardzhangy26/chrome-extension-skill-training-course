import { m } from "@/locale/paraglide/messages";
import type { Column, ColumnMeta, Table } from "@tanstack/react-table";
import { IconCalendar, IconCheck, IconSelector, IconFilter, IconTrash, } from "@tabler/icons-react";
import { parseAsStringEnum, useQueryState } from "nuqs";
import * as React from "react";
import { DataTableRangeFilter } from "@/components/data-table/data-table-range-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger, } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { dataTableConfig } from "@/components/data-table/config/data-table";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { getDefaultFilterOperator, getFilterOperators } from "@/components/data-table/lib/data-table";
import { formatDate } from "@/components/data-table/lib/format";
import { generateId } from "@/components/data-table/lib/id";
import { getFiltersStateParser } from "@/components/data-table/lib/parsers";
import { cn } from "@/lib/utils";
import type { ExtendedColumnFilter, FilterOperator, JoinOperator, } from "@/components/data-table/types/data-table";
const DEBOUNCE_MS = 300;
const THROTTLE_MS = 50;
const FILTER_SHORTCUT_KEY = "f";
const REMOVE_FILTER_SHORTCUTS = ["backspace", "delete"];
interface DataTableFilterListProps<TData> extends React.ComponentProps<typeof PopoverContent> {
    table: Table<TData>;
    debounceMs?: number;
    throttleMs?: number;
    shallow?: boolean;
}
export function DataTableFilterList<TData>({ table, debounceMs = DEBOUNCE_MS, throttleMs = THROTTLE_MS, shallow = true, ...props }: DataTableFilterListProps<TData>) {
    const id = React.useId();
    const labelId = React.useId();
    const descriptionId = React.useId();
    const [open, setOpen] = React.useState(false);
    const addButtonRef = React.useRef<HTMLButtonElement>(null);
    const columns = React.useMemo(() => {
        return table
            .getAllColumns()
            .filter((column) => column.columnDef.enableColumnFilter);
    }, [table]);
    const [filters, setFilters] = useQueryState(table.options.meta?.queryKeys?.filters ?? "filters", getFiltersStateParser<TData>(columns.map((field) => field.id))
        .withDefault([])
        .withOptions({
        clearOnDefault: true,
        shallow,
        throttleMs,
    }));
    const debouncedSetFilters = useDebouncedCallback(setFilters, debounceMs);
    const [joinOperator, setJoinOperator] = useQueryState(table.options.meta?.queryKeys?.joinOperator ?? "", parseAsStringEnum(["and", "or"]).withDefault("and").withOptions({
        clearOnDefault: true,
        shallow,
    }));
    const onFilterAdd = React.useCallback(() => {
        const column = columns[0];
        if (!column)
            return;
        debouncedSetFilters([
            ...filters,
            {
                id: column.id as Extract<keyof TData, string>,
                value: "",
                variant: column.columnDef.meta?.variant ?? "text",
                operator: getDefaultFilterOperator(column.columnDef.meta?.variant ?? "text"),
                filterId: generateId({ length: 8 }),
            },
        ]);
    }, [columns, filters, debouncedSetFilters]);
    const onFilterUpdate = React.useCallback((filterId: string, updates: Partial<Omit<ExtendedColumnFilter<TData>, "filterId">>) => {
        debouncedSetFilters((prevFilters) => {
            const updatedFilters = prevFilters.map((filter) => {
                if (filter.filterId === filterId) {
                    return { ...filter, ...updates } as ExtendedColumnFilter<TData>;
                }
                return filter;
            });
            return updatedFilters;
        });
    }, [debouncedSetFilters]);
    const onFilterRemove = React.useCallback((filterId: string) => {
        const updatedFilters = filters.filter((filter) => filter.filterId !== filterId);
        void setFilters(updatedFilters);
        requestAnimationFrame(() => {
            addButtonRef.current?.focus();
        });
    }, [filters, setFilters]);
    const onFiltersReset = React.useCallback(() => {
        void setFilters(null);
        void setJoinOperator("and");
    }, [setFilters, setJoinOperator]);
    React.useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (event.target instanceof HTMLInputElement ||
                event.target instanceof HTMLTextAreaElement ||
                (event.target instanceof HTMLElement &&
                    event.target.contentEditable === "true")) {
                return;
            }
            if (event.key.toLowerCase() === FILTER_SHORTCUT_KEY &&
                (event.ctrlKey || event.metaKey) &&
                event.shiftKey) {
                event.preventDefault();
                setOpen((prev) => !prev);
            }
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);
    const onTriggerKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (REMOVE_FILTER_SHORTCUTS.includes(event.key.toLowerCase()) &&
            filters.length > 0) {
            event.preventDefault();
            onFilterRemove(filters[filters.length - 1]?.filterId ?? "");
        }
    }, [filters, onFilterRemove]);
    return (<Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={(triggerProps) => (<Button {...triggerProps} variant="outline" size="sm" className="font-normal" onKeyDown={onTriggerKeyDown}>
            <IconFilter className="text-muted-foreground"/>
            {m.common_table_filter()}
            {filters.length > 0 && (<Badge variant="secondary" className="h-[18.24px] rounded-[3.2px] px-[5.12px] font-mono font-normal text-[10.4px]">
                {filters.length}
              </Badge>)}
          </Button>)}/>
      <PopoverContent aria-describedby={descriptionId} aria-labelledby={labelId} className="flex w-full flex-col gap-3.5 p-4 sm:min-w-[380px]" {...props}>
        <div className="flex flex-col gap-1">
          <h4 id={labelId} className="font-medium leading-none">
            {filters.length > 0 ? m.common_table_filters() : m.common_table_no_filters_applied()}
          </h4>
          <p id={descriptionId} className={cn("text-muted-foreground text-sm", filters.length > 0 && "sr-only")}>
            {filters.length > 0
            ? m.common_table_modify_filters_hint() : m.common_table_add_filters_hint()}
          </p>
        </div>
        {filters.length > 0 ? (<ul className="flex max-h-[300px] flex-col gap-2 overflow-y-auto p-1">
            {filters.map((filter, index) => (<DataTableFilterItem<TData> key={filter.filterId} filter={filter} index={index} filterItemId={`${id}-filter-${filter.filterId}`} joinOperator={joinOperator} setJoinOperator={setJoinOperator} columns={columns} onFilterUpdate={onFilterUpdate} onFilterRemove={onFilterRemove}/>))}
          </ul>) : null}
        <div className="flex w-full items-center gap-2">
          <Button size="sm" className="rounded" ref={addButtonRef} onClick={onFilterAdd}>
            {m.common_table_add_filter()}
          </Button>
          {filters.length > 0 ? (<Button variant="outline" size="sm" className="rounded" onClick={onFiltersReset}>
              {m.common_table_reset_filters()}
            </Button>) : null}
        </div>
      </PopoverContent>
    </Popover>);
}
interface DataTableFilterItemProps<TData> {
    filter: ExtendedColumnFilter<TData>;
    index: number;
    filterItemId: string;
    joinOperator: JoinOperator;
    setJoinOperator: (value: JoinOperator) => void;
    columns: Column<TData>[];
    onFilterUpdate: (filterId: string, updates: Partial<Omit<ExtendedColumnFilter<TData>, "filterId">>) => void;
    onFilterRemove: (filterId: string) => void;
}
function DataTableFilterItem<TData>({ filter, index, filterItemId, joinOperator, setJoinOperator, columns, onFilterUpdate, onFilterRemove, }: DataTableFilterItemProps<TData>) {
    const [showFieldSelector, setShowFieldSelector] = React.useState(false);
    const [showOperatorSelector, setShowOperatorSelector] = React.useState(false);
    const [showValueSelector, setShowValueSelector] = React.useState(false);
    const column = columns.find((column) => column.id === filter.id);
    const joinOperatorListboxId = `${filterItemId}-join-operator-listbox`;
    const fieldListboxId = `${filterItemId}-field-listbox`;
    const operatorListboxId = `${filterItemId}-operator-listbox`;
    const inputId = `${filterItemId}-input`;
    const columnMeta = column?.columnDef.meta;
    const filterOperators = getFilterOperators(filter.variant);
    const onItemKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLLIElement>) => {
        if (event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLTextAreaElement) {
            return;
        }
        if (showFieldSelector || showOperatorSelector || showValueSelector) {
            return;
        }
        if (REMOVE_FILTER_SHORTCUTS.includes(event.key.toLowerCase())) {
            event.preventDefault();
            onFilterRemove(filter.filterId);
        }
    }, [
        filter.filterId,
        showFieldSelector,
        showOperatorSelector,
        showValueSelector,
        onFilterRemove,
    ]);
    if (!column)
        return null;
    return (<li id={filterItemId} tabIndex={-1} className="flex items-center gap-2" onKeyDown={onItemKeyDown}>
      <div className="min-w-[72px] text-center">
        {index === 0 ? (<span className="text-muted-foreground text-sm">{m.common_table_where()}</span>) : index === 1 ? (<Select value={joinOperator} onValueChange={(value: string | null) => {
                if (value === "and" || value === "or") {
                    setJoinOperator(value);
                }
            }}>
            <SelectTrigger aria-label={m.common_table_select_join_operator()} aria-controls={joinOperatorListboxId} className="h-8 rounded lowercase data-size:h-8">
              <SelectValue placeholder={joinOperator}/>
            </SelectTrigger>
            <SelectContent id={joinOperatorListboxId} className="lowercase">
              {dataTableConfig.joinOperators.map((jo) => (<SelectItem key={jo} value={jo}>
                  {jo}
                </SelectItem>))}
            </SelectContent>
          </Select>) : (<span className="text-muted-foreground text-sm">
            {joinOperator}
          </span>)}
      </div>
      <Popover open={showFieldSelector} onOpenChange={setShowFieldSelector}>
        <PopoverTrigger render={(triggerProps) => (<Button {...triggerProps} aria-controls={fieldListboxId} variant="outline" size="sm" className="w-32 justify-between rounded font-normal">
              <span className="truncate">
                {columns.find((c) => c.id === filter.id)?.columnDef
                .meta?.label ?? m.common_table_select_field()}
              </span>
              <IconSelector className="opacity-50"/>
            </Button>)}/>
        <PopoverContent id={fieldListboxId} align="start" className="w-40 p-0">
          <Command>
            <CommandInput placeholder={m.common_table_search_fields()}/>
            <CommandList>
              <CommandEmpty>{m.common_table_no_fields_found()}</CommandEmpty>
              <CommandGroup>
                {columns.map((col) => (<CommandItem key={col.id} value={col.id} onSelect={(value) => {
                onFilterUpdate(filter.filterId, {
                    id: value as Extract<keyof TData, string>,
                    variant: col.columnDef.meta?.variant ?? "text",
                    operator: getDefaultFilterOperator(col.columnDef.meta?.variant ?? "text"),
                    value: "",
                });
                setShowFieldSelector(false);
            }}>
                    <span className="truncate">
                      {col.columnDef.meta?.label}
                    </span>
                    <IconCheck className={cn("ml-auto", col.id === filter.id ? "opacity-100" : "opacity-0")}/>
                  </CommandItem>))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Select open={showOperatorSelector} onOpenChange={setShowOperatorSelector} value={filter.operator} onValueChange={(value: string | null) => {
            if (!value)
                return;
            const op = value as FilterOperator;
            onFilterUpdate(filter.filterId, {
                operator: op,
                value: op === "isEmpty" || op === "isNotEmpty"
                    ? ""
                    : filter.value,
            });
        }}>
        <SelectTrigger aria-controls={operatorListboxId} className="h-8 w-32 rounded lowercase data-size:h-8">
          <div className="truncate">
            <SelectValue placeholder={filter.operator}/>
          </div>
        </SelectTrigger>
        <SelectContent id={operatorListboxId}>
          {filterOperators.map((operator) => (<SelectItem key={operator.value} value={operator.value} className="lowercase">
              {operator.label}
            </SelectItem>))}
        </SelectContent>
      </Select>
      <div className="min-w-36 flex-1">
        {onFilterInputRender({
            filter,
            inputId,
            column,
            columnMeta,
            onFilterUpdate,
            showValueSelector,
            setShowValueSelector,
        })}
      </div>
      <Button aria-controls={filterItemId} variant="outline" size="icon" className="size-8 rounded" onClick={() => onFilterRemove(filter.filterId)}>
        <IconTrash />
      </Button>
    </li>);
}
function onFilterInputRender<TData>({ filter, inputId, column, columnMeta, onFilterUpdate, showValueSelector, setShowValueSelector, }: {
    filter: ExtendedColumnFilter<TData>;
    inputId: string;
    column: Column<TData>;
    columnMeta?: ColumnMeta<TData, unknown>;
    onFilterUpdate: (filterId: string, updates: Partial<Omit<ExtendedColumnFilter<TData>, "filterId">>) => void;
    showValueSelector: boolean;
    setShowValueSelector: (value: boolean) => void;
}) {
    if (filter.operator === "isEmpty" || filter.operator === "isNotEmpty") {
        return (<div id={inputId} role="status" aria-label={`${columnMeta?.label} filter is ${filter.operator === "isEmpty" ? "empty" : "not empty"}`} aria-live="polite" className="h-8 w-full rounded border bg-transparent dark:bg-input/30"/>);
    }
    switch (filter.variant) {
        case "text":
        case "number":
        case "range": {
            if ((filter.variant === "range" && filter.operator === "isBetween") ||
                filter.operator === "isBetween") {
                return (<DataTableRangeFilter filter={filter} column={column} inputId={inputId} onFilterUpdate={onFilterUpdate}/>);
            }
            const isNumber = filter.variant === "number" || filter.variant === "range";
            return (<Input id={inputId} type={isNumber ? "number" : filter.variant} aria-label={`${columnMeta?.label} filter value`} aria-describedby={`${inputId}-description`} inputMode={isNumber ? "numeric" : undefined} placeholder={columnMeta?.placeholder ?? m.common_table_enter_value()} className="h-8 w-full rounded" defaultValue={typeof filter.value === "string" ? filter.value : undefined} onChange={(event) => onFilterUpdate(filter.filterId, {
                    value: event.target.value,
                })}/>);
        }
        case "boolean": {
            if (Array.isArray(filter.value))
                return null;
            const inputListboxId = `${inputId}-listbox`;
            return (<Select open={showValueSelector} onOpenChange={setShowValueSelector} value={typeof filter.value === "string" ? filter.value : "true"} onValueChange={(value: string | null) => {
                    if (value) {
                        onFilterUpdate(filter.filterId, { value });
                    }
                }}>
          <SelectTrigger id={inputId} aria-controls={inputListboxId} aria-label={`${columnMeta?.label} boolean filter`} className="h-8 w-full rounded data-size:h-8">
            <SelectValue placeholder={filter.value ? m.common_table_bool_true() : m.common_table_bool_false()}/>
          </SelectTrigger>
          <SelectContent id={inputListboxId}>
            <SelectItem value="true">{m.common_table_bool_true()}</SelectItem>
            <SelectItem value="false">{m.common_table_bool_false()}</SelectItem>
          </SelectContent>
        </Select>);
        }
        case "select":
        case "multiSelect": {
            const inputListboxId = `${inputId}-listbox`;
            const options = columnMeta?.options ?? [];
            const multiple = filter.variant === "multiSelect";
            const selectedValues = multiple
                ? Array.isArray(filter.value)
                    ? filter.value
                    : []
                : typeof filter.value === "string"
                    ? [filter.value]
                    : [];
            const selectedOptions = options.filter((option) => selectedValues.includes(option.value));
            return (<Popover open={showValueSelector} onOpenChange={setShowValueSelector}>
          <PopoverTrigger render={(triggerProps) => (<Button {...triggerProps} id={inputId} aria-controls={inputListboxId} aria-label={`${columnMeta?.label} filter value${multiple ? "s" : ""}`} variant="outline" size="sm" className="w-full rounded font-normal">
                {selectedOptions.length === 0 ? (columnMeta?.placeholder ??
                        (multiple ? m.common_table_select_options() : m.common_table_select_option())) : (<span className="truncate">
                    {selectedOptions.length > 1
                            ? `${selectedOptions.length} ${m.common_table_selected()}`
                            : selectedOptions[0]?.label}
                  </span>)}
              </Button>)}/>
          <PopoverContent id={inputListboxId} className="w-[200px] p-0">
            <Command>
              <CommandInput aria-label={`Search ${columnMeta?.label} options`} placeholder={columnMeta?.placeholder ?? m.common_table_search_options()}/>
              <CommandList>
                <CommandEmpty>{m.common_table_no_options_found()}</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => {
                    const isSelected = selectedValues.includes(option.value);
                    return (<CommandItem key={option.value} value={option.value} onSelect={() => {
                            const value = multiple
                                ? isSelected
                                    ? selectedValues.filter((v) => v !== option.value)
                                    : [...selectedValues, option.value]
                                : option.value;
                            onFilterUpdate(filter.filterId, { value });
                        }}>
                        {option.icon && <option.icon />}
                        <span>{option.label}</span>
                        {multiple && (<IconCheck className={cn("ml-auto", isSelected ? "opacity-100" : "opacity-0")}/>)}
                        {option.count && (<span className="ml-auto font-mono text-xs">
                            {option.count}
                          </span>)}
                      </CommandItem>);
                })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>);
        }
        case "date":
        case "dateRange": {
            const inputListboxId = `${inputId}-listbox`;
            const dateValue = Array.isArray(filter.value)
                ? filter.value.filter(Boolean)
                : [filter.value, filter.value].filter(Boolean);
            const displayValue = filter.operator === "isBetween" && dateValue.length === 2
                ? `${formatDate(new Date(Number(dateValue[0])))} - ${formatDate(new Date(Number(dateValue[1])))}`
                : dateValue[0]
                    ? formatDate(new Date(Number(dateValue[0])))
                    : m.common_table_pick_date();
            return (<Popover open={showValueSelector} onOpenChange={setShowValueSelector}>
          <PopoverTrigger render={(triggerProps) => (<Button {...triggerProps} id={inputId} aria-controls={inputListboxId} aria-label={`${columnMeta?.label} date filter`} variant="outline" size="sm" className={cn("w-full justify-start rounded text-left font-normal", !filter.value && "text-muted-foreground")}>
                <IconCalendar />
                <span className="truncate">{displayValue}</span>
              </Button>)}/>
          <PopoverContent id={inputListboxId} align="start" className="w-auto p-0">
            {filter.operator === "isBetween" ? (<Calendar aria-label={`Select ${columnMeta?.label} date range`} autoFocus captionLayout="dropdown" mode="range" selected={dateValue.length === 2
                        ? {
                            from: new Date(Number(dateValue[0])),
                            to: new Date(Number(dateValue[1])),
                        }
                        : {
                            from: new Date(),
                            to: new Date(),
                        }} onSelect={(date) => {
                        onFilterUpdate(filter.filterId, {
                            value: date
                                ? [
                                    (date.from?.getTime() ?? "").toString(),
                                    (date.to?.getTime() ?? "").toString(),
                                ]
                                : [],
                        });
                    }}/>) : (<Calendar aria-label={`Select ${columnMeta?.label} date`} autoFocus captionLayout="dropdown" mode="single" selected={dateValue[0] ? new Date(Number(dateValue[0])) : undefined} onSelect={(date) => {
                        onFilterUpdate(filter.filterId, {
                            value: (date?.getTime() ?? "").toString(),
                        });
                    }}/>)}
          </PopoverContent>
        </Popover>);
        }
        default:
            return null;
    }
}
