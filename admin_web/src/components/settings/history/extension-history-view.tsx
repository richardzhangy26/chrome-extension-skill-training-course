import { m } from '@/locale/paraglide/messages';
import { getLocale } from '@/lib/locale';
import { useEffect, useMemo, useState } from 'react';
import { deleteMyHistory, getMyHistory } from '@/api/extension-history';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { AgentLogSessionInput } from '@/lib/agent-log-schema';
import {
  buildHistoryDownloadFilename,
  buildTrainingMetaSummary,
  getSessionName,
} from '@/lib/extension-history-filename';
import { buildBulkHistoryZipEntries, getHistoryAiRoleName, getRecentPreviewEntries } from './extension-history-utils';
import { cn } from '@/lib/utils';
import { strToU8, zipSync } from 'fflate';
import {
  IconCalendar,
  IconChevronDown,
  IconChevronUp,
  IconDownload,
  IconSearch,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import type { DateRange } from 'react-day-picker';
import { toast } from 'sonner';

const getStepName = (s: AgentLogSessionInput, entry: AgentLogSessionInput['entries'][number]) =>
  entry.stepName || s.stepNameMapping?.[entry.stepId] || entry.stepId || m.settings_history_unknown_step();

const getLocaleCode = () => (getLocale() === 'zh' ? 'zh-CN' : 'en-US');

const PREVIEW_ENTRY_LIMIT = 5;

const padDatePart = (value: number) => value.toString().padStart(2, '0');

const buildBulkHistoryZipFilename = (date = new Date()) =>
  `插件历史-${date.getFullYear()}${padDatePart(date.getMonth() + 1)}${padDatePart(date.getDate())}-${padDatePart(date.getHours())}${padDatePart(date.getMinutes())}.zip`;

const getDateRangeBounds = (range: DateRange | undefined) => {
  if (!range?.from) {
    return { from: null, to: null };
  }

  const from = new Date(range.from);
  from.setHours(0, 0, 0, 0);

  const to = new Date(range.to ?? range.from);
  to.setHours(23, 59, 59, 999);

  return { from: from.getTime(), to: to.getTime() };
};

const matchesUpdatedDate = (session: AgentLogSessionInput, range: DateRange | undefined) => {
  const { from, to } = getDateRangeBounds(range);
  if (from == null || to == null) {
    return true;
  }
  return session.updatedAt >= from && session.updatedAt <= to;
};

const buildLogText = (s: AgentLogSessionInput, formatTime: (ms: number) => string): string => {
  const lines: string[] = [
    m.settings_history_log_title(),
    `${m.settings_history_log_created_at()}: ${formatTime(s.createdAt)}`,
    `${m.settings_history_task_name()}: ${getSessionName(s)}`,
    `task_id: ${s.taskId}`,
    '='.repeat(60),
  ];

  for (const entry of s.entries) {
    const roundInfo = entry.round ? ` | ${m.settings_history_round_label({ round: entry.round })}` : '';
    lines.push(
      `Step: ${getStepName(s, entry)} | step_id: ${entry.stepId}${roundInfo} | ${m.settings_history_source_label()}: ${entry.source}`,
    );
    if (entry.userText) {
      lines.push(`${m.settings_history_user_label()}: ${entry.userText}`);
    }
    if (entry.aiText) {
      lines.push(`${getHistoryAiRoleName(entry)}: ${entry.aiText}`);
    }
    lines.push('-'.repeat(40));
  }
  return lines.join('\n');
};

const downloadLogText = (s: AgentLogSessionInput, formatTime: (ms: number) => string) => {
  const blob = new Blob([buildLogText(s, formatTime)], {
    type: 'text/plain;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = buildHistoryDownloadFilename(s);
  link.click();
  URL.revokeObjectURL(url);
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export function ExtensionHistoryView() {
  const [loaded, setLoaded] = useState(false);
  const [sessions, setSessions] = useState<AgentLogSessionInput[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const localeCode = getLocaleCode();
  const formatTime = useMemo(
    () =>
      new Intl.DateTimeFormat(localeCode, {
        dateStyle: 'medium',
        timeStyle: 'medium',
      }).format,
    [localeCode],
  );
  const formatDate = useMemo(
    () =>
      new Intl.DateTimeFormat(localeCode, {
        dateStyle: 'medium',
      }).format,
    [localeCode],
  );

  useEffect(() => {
    getMyHistory()
      .then(({ sessions: rows }) => {
        const sorted = [...rows].sort((a, b) => b.updatedAt - a.updatedAt);
        setSessions(sorted);
        setActiveId(sorted[0]?.id ?? null);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const filteredSessions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return sessions.filter(s => {
      const searchableText = [getSessionName(s), buildTrainingMetaSummary(s)]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase();
      const matchesName = query === '' || searchableText.includes(query);
      return matchesName && matchesUpdatedDate(s, dateRange);
    });
  }, [sessions, search, dateRange]);
  const filteredSessionIds = useMemo(() => new Set(filteredSessions.map(session => session.id)), [filteredSessions]);
  const selectedSessions = useMemo(
    () => filteredSessions.filter(session => selectedIds.has(session.id)),
    [filteredSessions, selectedIds],
  );
  const selectedCount = selectedSessions.length;
  const allFilteredSelected = filteredSessions.length > 0 && selectedCount === filteredSessions.length;

  useEffect(() => {
    if (activeId && filteredSessions.some(session => session.id === activeId)) {
      return;
    }
    setActiveId(filteredSessions[0]?.id ?? null);
  }, [activeId, filteredSessions]);

  useEffect(() => {
    setSelectedIds(current => {
      const next = new Set([...current].filter(id => filteredSessionIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [filteredSessionIds]);

  useEffect(() => {
    setDetailsOpen(false);
  }, [activeId]);

  const active = filteredSessions.find(s => s.id === activeId) ?? null;
  const activeMetaSummary = active ? buildTrainingMetaSummary(active) : '';
  const activeEntries = active
    ? detailsOpen
      ? active.entries
      : getRecentPreviewEntries(active, PREVIEW_ENTRY_LIMIT)
    : [];
  const activeEntriesTitle =
    active && !detailsOpen ? m.settings_history_preview_title({ count: activeEntries.length }) : null;
  const deleteCount = deleteTargetIds.length;
  const hasFilters = search.trim() !== '' || dateRange?.from != null || dateRange?.to != null;
  const dateLabel = dateRange?.from
    ? dateRange.to
      ? `${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}`
      : formatDate(dateRange.from)
    : m.settings_history_date_filter();

  const clearFilters = () => {
    setSearch('');
    setDateRange(undefined);
  };

  const toggleSelected = (sessionId: string, checked: boolean) => {
    setSelectedIds(current => {
      const next = new Set(current);
      if (checked) {
        next.add(sessionId);
      } else {
        next.delete(sessionId);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filteredSessions.map(session => session.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDownload = () => {
    if (selectedSessions.length === 0) {
      return;
    }

    setDownloadingZip(true);
    try {
      const zipEntries = buildBulkHistoryZipEntries(
        selectedSessions,
        session => buildLogText(session, formatTime),
        buildHistoryDownloadFilename,
      );
      const zipBuffer = zipSync(
        Object.fromEntries(Object.entries(zipEntries).map(([filename, content]) => [filename, strToU8(content)])),
      );
      downloadBlob(new Blob([zipBuffer], { type: 'application/zip' }), buildBulkHistoryZipFilename());
      toast.success(
        m.settings_history_bulk_download_success({
          count: selectedSessions.length,
        }),
      );
    } catch {
      toast.error(m.settings_history_bulk_download_error());
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleDelete = async () => {
    if (deleteTargetIds.length === 0) {
      return;
    }

    setDeleting(true);
    try {
      const idsToDelete = [...deleteTargetIds];
      const deleteIdSet = new Set(idsToDelete);
      await deleteMyHistory({ data: { sessionIds: idsToDelete } });
      setSessions(prev => prev.filter(s => !deleteIdSet.has(s.id)));
      setSelectedIds(prev => {
        const next = new Set(prev);
        for (const id of idsToDelete) {
          next.delete(id);
        }
        return next;
      });
      setDeleteTargetIds([]);
      toast.success(
        idsToDelete.length > 1
          ? m.settings_history_bulk_delete_success({
              count: idsToDelete.length,
            })
          : m.settings_history_delete_success(),
      );
    } catch {
      toast.error(
        deleteTargetIds.length > 1 ? m.settings_history_bulk_delete_error() : m.settings_history_delete_error(),
      );
    } finally {
      setDeleting(false);
    }
  };

  if (!loaded) {
    return <p className="text-muted-foreground text-sm">{m.common_loading()}</p>;
  }
  if (sessions.length === 0) {
    return <p className="text-muted-foreground text-sm">{m.settings_history_no_history()}</p>;
  }

  return (
    <div className="flex max-w-6xl flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <IconSearch className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={m.settings_history_search_placeholder()}
            className="pl-8"
          />
        </div>

        <Popover>
          <PopoverTrigger
            render={props => (
              <Button {...props} variant="outline" className="justify-start">
                <IconCalendar className="size-4" />
                {dateLabel}
              </Button>
            )}
          />
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar autoFocus captionLayout="dropdown" mode="range" selected={dateRange} onSelect={setDateRange} />
          </PopoverContent>
        </Popover>

        {hasFilters ? (
          <Button variant="ghost" onClick={clearFilters}>
            <IconX className="size-4" />
            {m.settings_history_clear_filters()}
          </Button>
        ) : null}
      </div>

      {filteredSessions.length === 0 ? (
        <p className="text-muted-foreground text-sm">{m.settings_history_no_results()}</p>
      ) : (
        <>
          <div className="bg-muted/40 flex flex-col gap-2 rounded-md border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="text-muted-foreground">{m.settings_history_selected_count({ count: selectedCount })}</div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={allFilteredSelected} onClick={selectAllFiltered}>
                {m.settings_history_select_all_filtered({
                  count: filteredSessions.length,
                })}
              </Button>
              <Button type="button" variant="ghost" disabled={selectedCount === 0} onClick={clearSelection}>
                {m.settings_history_clear_selection()}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={selectedCount === 0 || downloadingZip}
                onClick={handleBulkDownload}>
                <IconDownload className="size-4" />
                {downloadingZip ? m.settings_history_bulk_downloading() : m.settings_history_bulk_download_zip()}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={selectedCount === 0 || deleting}
                onClick={() => setDeleteTargetIds(selectedSessions.map(session => session.id))}>
                <IconTrash className="size-4" />
                {m.settings_history_bulk_delete()}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:h-[calc(100vh-16rem)] lg:min-h-[32rem] lg:flex-row">
            <ul className="w-full space-y-1 pr-1 lg:max-h-full lg:w-80 lg:shrink-0 lg:overflow-y-auto">
              {filteredSessions.map(s => {
                const metaSummary = buildTrainingMetaSummary(s);
                const selected = selectedIds.has(s.id);
                return (
                  <li
                    key={s.id}
                    className={cn(
                      'flex gap-2 rounded-md border p-2 transition-colors',
                      activeId === s.id ? 'border-primary bg-muted' : 'border-border hover:bg-muted/60',
                    )}>
                    <Checkbox
                      checked={selected}
                      onCheckedChange={checked => toggleSelected(s.id, Boolean(checked))}
                      aria-label={m.settings_history_select_record({
                        name: getSessionName(s),
                      })}
                      className="mt-1"
                    />
                    <button
                      type="button"
                      onClick={() => setActiveId(s.id)}
                      aria-pressed={activeId === s.id}
                      className="min-w-0 flex-1 text-left text-sm">
                      <div className="font-medium">{getSessionName(s)}</div>
                      {metaSummary ? <div className="text-muted-foreground text-xs">{metaSummary}</div> : null}
                      <div className="text-muted-foreground text-xs">{formatTime(s.updatedAt)}</div>
                      <div className="text-muted-foreground text-xs">
                        {m.settings_history_entries_count({
                          count: s.entries.length,
                        })}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="min-w-0 flex-1 rounded-md border p-4 lg:max-h-full lg:overflow-y-auto">
              {active ? (
                <>
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{getSessionName(active)}</div>
                      {activeMetaSummary ? (
                        <div className="text-muted-foreground text-xs">{activeMetaSummary}</div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        aria-expanded={detailsOpen}
                        onClick={() => setDetailsOpen(open => !open)}>
                        {detailsOpen ? <IconChevronUp className="size-4" /> : <IconChevronDown className="size-4" />}
                        {detailsOpen ? m.settings_history_collapse_details() : m.settings_history_expand_details()}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => downloadLogText(active, formatTime)}>
                        <IconDownload className="size-4" />
                        {m.settings_history_download_txt()}
                      </Button>
                      <Button type="button" variant="destructive" onClick={() => setDeleteTargetIds([active.id])}>
                        <IconTrash className="size-4" />
                        {m.settings_history_delete()}
                      </Button>
                    </div>
                  </div>
                  {activeEntriesTitle ? (
                    <div className="text-muted-foreground mb-2 text-xs">{activeEntriesTitle}</div>
                  ) : null}
                  {activeEntries.length > 0 ? (
                    <div className="space-y-3 text-sm">
                      {activeEntries.map((entry, i) => (
                        <div key={`${entry.timestamp}_${i}`} className="bg-muted rounded-md p-2">
                          <div className="text-muted-foreground text-xs">
                            {getStepName(active, entry)} · {entry.source}
                          </div>
                          {entry.userText ? (
                            <p className="mt-1 whitespace-pre-wrap">
                              {m.settings_history_user_label()}: {entry.userText}
                            </p>
                          ) : null}
                          {entry.aiText ? (
                            <p className="mt-1 whitespace-pre-wrap">
                              {getHistoryAiRoleName(entry)}: {entry.aiText}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">{m.settings_history_no_entries()}</p>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground text-sm">{m.settings_history_select_session()}</p>
              )}
            </div>
          </div>
        </>
      )}

      <AlertDialog
        open={deleteCount > 0}
        onOpenChange={open => {
          if (!open && !deleting) {
            setDeleteTargetIds([]);
          }
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteCount > 1
                ? m.settings_history_bulk_delete_confirm_title({
                    count: deleteCount,
                  })
                : m.settings_history_delete_confirm_title()}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCount > 1
                ? m.settings_history_bulk_delete_confirm_description({
                    count: deleteCount,
                  })
                : m.settings_history_delete_confirm_description()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTargetIds([])} disabled={deleting}>
              {m.settings_history_delete_cancel()}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? m.settings_history_deleting() : m.settings_history_delete_confirm()}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
