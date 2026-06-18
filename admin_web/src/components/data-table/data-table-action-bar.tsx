import { m } from "@/locale/paraglide/messages";
import type { Table } from "@tanstack/react-table";
import { IconLoader2, IconX } from "@tabler/icons-react";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger, } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
interface DataTableActionBarProps<TData> extends React.ComponentProps<"div"> {
    table: Table<TData>;
    visible?: boolean;
    portalContainer?: Element | DocumentFragment | null;
}
function DataTableActionBar<TData>({ table, visible: visibleProp, portalContainer: portalContainerProp, children, className, ...props }: DataTableActionBarProps<TData>) {
    const [mounted, setMounted] = React.useState(false);
    React.useLayoutEffect(() => {
        setMounted(true);
    }, []);
    React.useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                table.toggleAllRowsSelected(false);
            }
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [table]);
    const portalContainer = portalContainerProp ?? (mounted ? globalThis.document?.body : null);
    if (!portalContainer)
        return null;
    const visible = visibleProp ?? table.getFilteredSelectedRowModel().rows.length > 0;
    if (!visible)
        return null;
    return ReactDOM.createPortal(<div role="toolbar" aria-orientation="horizontal" className={cn("fixed inset-x-0 bottom-6 z-50 mx-auto flex w-fit flex-wrap items-center justify-center gap-2 rounded-md border bg-background p-2 text-foreground shadow-sm animate-in fade-in-0 slide-in-from-bottom-5", className)} {...props}>
      {children}
    </div>, portalContainer);
}
interface DataTableActionBarActionProps extends React.ComponentProps<typeof Button> {
    tooltip?: string;
    isPending?: boolean;
}
function DataTableActionBarAction({ size = "sm", tooltip, isPending, disabled, className, children, ...props }: DataTableActionBarActionProps) {
    const trigger = (<Button variant="secondary" size={size} className={cn("gap-1.5 border border-secondary bg-secondary/50 hover:bg-secondary/70 [&>svg]:size-3.5", size === "icon" ? "size-7" : "h-7", className)} disabled={disabled || isPending} {...props}>
      {isPending ? <IconLoader2 className="size-3.5 animate-spin"/> : children}
    </Button>);
    if (!tooltip)
        return trigger;
    return (<Tooltip>
      <TooltipTrigger render={(triggerProps) => (<Button {...triggerProps} variant="secondary" size={size} className={cn("gap-1.5 border border-secondary bg-secondary/50 hover:bg-secondary/70 [&>svg]:size-3.5", size === "icon" ? "size-7" : "h-7", className)} disabled={disabled || isPending} {...props}>
            {isPending ? <IconLoader2 className="size-3.5 animate-spin"/> : children}
          </Button>)}/>
      <TooltipContent sideOffset={6} className="border bg-accent font-semibold text-foreground dark:bg-zinc-900 [&>span]:hidden">
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>);
}
interface DataTableActionBarSelectionProps<TData> {
    table: Table<TData>;
}
function DataTableActionBarSelection<TData>({ table, }: DataTableActionBarSelectionProps<TData>) {
    const onClearSelection = React.useCallback(() => {
        table.toggleAllRowsSelected(false);
    }, [table]);
    return (<div className="flex h-7 items-center rounded-md border pr-1 pl-2.5">
      <span className="whitespace-nowrap text-xs">
        {table.getFilteredSelectedRowModel().rows.length} {m.common_table_selected()}
      </span>
      <Separator orientation="vertical" className="mr-1 ml-2 h-4 self-auto!"/>
      <Tooltip>
        <TooltipTrigger render={(triggerProps) => (<Button {...triggerProps} variant="ghost" size="icon" className="size-5" onClick={onClearSelection}>
              <IconX className="size-3.5"/>
            </Button>)}/>
        <TooltipContent sideOffset={10} className="flex items-center gap-2 border bg-accent px-2 py-1 font-semibold text-foreground dark:bg-zinc-900 [&>span]:hidden">
          <p>{m.common_table_clear_selection()}</p>
          <kbd className="select-none rounded border bg-background px-1.5 py-px font-mono font-normal text-[0.7rem] text-foreground shadow-xs">
            <abbr title="Escape" className="no-underline">
              Esc
            </abbr>
          </kbd>
        </TooltipContent>
      </Tooltip>
    </div>);
}
export { DataTableActionBar, DataTableActionBarAction, DataTableActionBarSelection, };
