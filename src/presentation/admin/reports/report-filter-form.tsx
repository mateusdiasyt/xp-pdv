"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ReportPeriod } from "@/application/reports/report-service";

type ReportFilterFormProps = {
  selectedPeriod: ReportPeriod;
  customStartDate: string;
  customEndDate: string;
};

type PeriodOption = {
  value: ReportPeriod;
  label: string;
};

const periodOptions: PeriodOption[] = [
  { value: "1d", label: "1 dia" },
  { value: "7d", label: "7 dias" },
  { value: "15d", label: "15 dias" },
  { value: "30d", label: "30 dias" },
  { value: "3m", label: "3 meses" },
  { value: "6m", label: "6 meses" },
  { value: "1y", label: "1 ano" },
  { value: "custom", label: "Personalizado" },
];

const weekdayLabels = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"];

function parseDateInput(value: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function buildCalendarDays(monthCursor: Date) {
  const firstDayOfMonth = startOfMonth(monthCursor);
  const mondayBasedWeekday = (firstDayOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(firstDayOfMonth);
  gridStart.setDate(gridStart.getDate() - mondayBasedWeekday);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

function normalizeRange(start: Date, end: Date) {
  if (start <= end) {
    return { start, end };
  }

  return { start: end, end: start };
}

function inRange(day: Date, start: Date, end: Date) {
  return day >= start && day <= end;
}

export function ReportFilterForm({
  selectedPeriod,
  customStartDate,
  customEndDate,
}: ReportFilterFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const calendarContainerRef = useRef<HTMLDivElement>(null);
  const [period, setPeriod] = useState<ReportPeriod>(selectedPeriod);
  const [rangeStart, setRangeStart] = useState(customStartDate);
  const [rangeEnd, setRangeEnd] = useState(customEndDate);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pendingStart, setPendingStart] = useState<Date | null>(null);
  const [monthCursor, setMonthCursor] = useState<Date>(
    parseDateInput(customStartDate) ?? new Date(),
  );

  useEffect(() => {
    setPeriod(selectedPeriod);
  }, [selectedPeriod]);

  useEffect(() => {
    setRangeStart(customStartDate);
    setRangeEnd(customEndDate);
  }, [customStartDate, customEndDate]);

  useEffect(() => {
    if (!calendarOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (!calendarContainerRef.current) {
        return;
      }

      if (event.target instanceof Node && !calendarContainerRef.current.contains(event.target)) {
        setCalendarOpen(false);
        setPendingStart(null);
      }
    }

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [calendarOpen]);

  const resolvedStartDate = useMemo(() => parseDateInput(rangeStart), [rangeStart]);
  const resolvedEndDate = useMemo(() => parseDateInput(rangeEnd), [rangeEnd]);
  const calendarDays = useMemo(() => buildCalendarDays(monthCursor), [monthCursor]);
  const isCustom = period === "custom";

  const selectionStart = pendingStart ?? resolvedStartDate;
  const selectionEnd = pendingStart ?? resolvedEndDate;

  function submitForm() {
    formRef.current?.requestSubmit();
  }

  function handlePeriodChange(nextPeriod: ReportPeriod) {
    setPeriod(nextPeriod);
    if (nextPeriod !== "custom") {
      setCalendarOpen(false);
      setPendingStart(null);
    }

    requestAnimationFrame(submitForm);
  }

  function clearFilters() {
    router.push("/admin/reports");
  }

  function toggleCalendar() {
    const anchorDate = parseDateInput(rangeStart) ?? new Date();
    setMonthCursor(startOfMonth(anchorDate));
    setPendingStart(null);
    setCalendarOpen((current) => !current);
  }

  function handlePickDay(day: Date) {
    if (!pendingStart) {
      setPendingStart(day);
      return;
    }

    const { start, end } = normalizeRange(pendingStart, day);
    setRangeStart(toDateInputValue(start));
    setRangeEnd(toDateInputValue(end));
    setPendingStart(null);
    setCalendarOpen(false);
    requestAnimationFrame(submitForm);
  }

  function currentRangeLabel() {
    if (!resolvedStartDate || !resolvedEndDate) {
      return "Selecione o intervalo";
    }

    if (isSameDay(resolvedStartDate, resolvedEndDate)) {
      return formatShortDate(resolvedStartDate);
    }

    return `${formatShortDate(resolvedStartDate)} - ${formatShortDate(resolvedEndDate)}`;
  }

  return (
    <form ref={formRef} method="GET" className="grid gap-3 md:grid-cols-[260px_auto_44px]">
      <input type="hidden" name="startDate" value={rangeStart} />
      <input type="hidden" name="endDate" value={rangeEnd} />

      <div className="relative">
        <select
          name="period"
          className="admin-native-select w-full pr-9"
          value={period}
          onChange={(event) => handlePeriodChange(event.target.value as ReportPeriod)}
        >
          {periodOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {isCustom ? (
        <div ref={calendarContainerRef} className="relative z-40 w-[360px] max-w-full">
          <button
            type="button"
            onClick={toggleCalendar}
            className="inline-flex h-10 w-full items-center justify-between rounded-xl border border-border/80 bg-background/85 px-3 text-left text-sm font-medium text-foreground shadow-sm transition-colors hover:border-border hover:bg-muted/55"
          >
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              {currentRangeLabel()}
            </span>
          </button>

          {calendarOpen ? (
            <div className="absolute left-0 top-12 z-[80] w-[360px] max-w-[92vw] rounded-2xl border border-border/80 bg-card/95 p-3 shadow-2xl shadow-black/45 backdrop-blur">
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMonthCursor((current) => addMonths(current, -1))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 bg-background/60 text-muted-foreground transition-colors hover:border-border hover:bg-muted/60 hover:text-foreground"
                  aria-label="Mes anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="text-sm font-semibold text-foreground">
                  {monthCursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                </div>
                <button
                  type="button"
                  onClick={() => setMonthCursor((current) => addMonths(current, 1))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 bg-background/60 text-muted-foreground transition-colors hover:border-border hover:bg-muted/60 hover:text-foreground"
                  aria-label="Proximo mes"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {weekdayLabels.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day) => {
                  const sameMonth = day.getMonth() === monthCursor.getMonth();
                  const today = isSameDay(day, new Date());
                  const isStart = selectionStart ? isSameDay(day, selectionStart) : false;
                  const isEnd = selectionEnd ? isSameDay(day, selectionEnd) : false;
                  const hasRange = selectionStart && selectionEnd;
                  const isInsideRange =
                    hasRange && selectionStart && selectionEnd
                      ? inRange(day, selectionStart, selectionEnd)
                      : false;

                  const roundedClass =
                    isStart && isEnd
                      ? "rounded-lg"
                      : isStart
                        ? "rounded-l-lg rounded-r-sm"
                        : isEnd
                          ? "rounded-r-lg rounded-l-sm"
                          : "rounded-sm";

                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => handlePickDay(day)}
                      className={[
                        "h-9 text-sm transition-colors",
                        roundedClass,
                        isInsideRange
                          ? "bg-primary/20 text-primary-foreground"
                          : "text-foreground hover:bg-muted/55",
                        isStart || isEnd ? "bg-primary text-primary-foreground hover:bg-primary/90" : "",
                        !sameMonth ? "text-muted-foreground/35" : "",
                        today && !isStart && !isEnd ? "ring-1 ring-primary/45" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                {pendingStart
                  ? `Inicio: ${formatShortDate(pendingStart)}. Selecione a data final.`
                  : "Clique no inicio e depois no fim do intervalo."}
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex h-10 w-[360px] max-w-full items-center rounded-xl border border-dashed border-border/70 bg-background/35 px-3 text-sm text-muted-foreground">
          Intervalo automatico para o periodo selecionado
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={clearFilters}
        aria-label="Limpar filtros"
        title="Limpar filtros"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </form>
  );
}
