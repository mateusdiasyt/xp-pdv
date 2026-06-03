"use client";

import { useEffect, useRef, useState } from "react";

type ServiceCountdownProps = {
  durationMinutes: number;
  planCode: string;
  releasedUntil?: string | null;
  serviceStartsAt?: string | null;
};

declare global {
  interface Window {
    __PDV_MODAL_OPEN__?: boolean;
  }
}

const SECOND_IN_MS = 1000;
const MINUTE_IN_MS = 60 * SECOND_IN_MS;

function formatRemaining(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / SECOND_IN_MS));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function parseTime(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function isPdvModalOpen() {
  return window.__PDV_MODAL_OPEN__ === true;
}

export function ServicesAutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  void intervalMs;

  return null;
}

export function ServiceCountdown({
  durationMinutes,
  planCode,
  releasedUntil,
  serviceStartsAt,
}: ServiceCountdownProps) {
  const [now, setNow] = useState(() => Date.now());
  const refreshedAfterEndRef = useRef(false);
  const endTime = parseTime(releasedUntil);
  const startTime = parseTime(serviceStartsAt) ?? now;
  const isFreeMode = durationMinutes === 0 || planCode === "MANUAL-LIVRE";

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), SECOND_IN_MS);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!endTime || isFreeMode || endTime > now || refreshedAfterEndRef.current || isPdvModalOpen()) {
      return;
    }

    refreshedAfterEndRef.current = true;
    const timeout = window.setTimeout(() => window.location.reload(), 800);
    return () => window.clearTimeout(timeout);
  }, [endTime, isFreeMode, now]);

  if (!endTime) {
    return null;
  }

  if (isFreeMode) {
    return (
      <div className="mt-4 rounded-2xl border border-emerald-300/35 bg-emerald-400/10 p-3">
        <p className="text-[0.65rem] font-black uppercase tracking-[0.22em] text-emerald-100">Tempo liberado</p>
        <p className="mt-1 text-2xl font-black text-foreground">Livre</p>
        <p className="text-xs text-muted-foreground">Sem contador. Encerre manualmente quando o cliente sair.</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-emerald-950/70">
          <div className="h-full w-full rounded-full bg-emerald-300" />
        </div>
      </div>
    );
  }

  const isPreparing = startTime > now;
  const targetTime = isPreparing ? startTime : endTime;
  const remaining = targetTime - now;
  const totalDuration = Math.max(MINUTE_IN_MS, endTime - startTime);
  const elapsed = Math.max(0, Math.min(totalDuration, now - startTime));
  const progress = isPreparing ? 0 : Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));
  const isEnded = remaining <= 0 && !isPreparing;

  return (
    <div className="mt-4 rounded-2xl border border-border/70 bg-background/60 p-3 shadow-inner">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[0.65rem] font-black uppercase tracking-[0.22em] text-muted-foreground">
            {isPreparing ? "Preparação" : "Tempo restante"}
          </p>
          <p className="mt-1 font-mono text-3xl font-black text-foreground tabular-nums">
            {isEnded ? "00:00" : formatRemaining(remaining)}
          </p>
        </div>
        <span className="rounded-full border border-border/70 px-3 py-1 text-xs font-bold text-muted-foreground">
          {isPreparing ? "Cliente se preparando" : isEnded ? "Encerrando" : "Rodando"}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            isPreparing ? "bg-amber-300" : isEnded ? "bg-rose-400" : "bg-emerald-300"
          }`}
          style={{ width: `${isEnded ? 100 : progress}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {isPreparing
          ? "O tempo de jogo ainda não começou."
          : isEnded
            ? "Tempo encerrado. Atualizando disponibilidade..."
            : "Acompanhe aqui para evitar venda duplicada."}
      </p>
    </div>
  );
}
