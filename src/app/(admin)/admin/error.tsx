"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

type AdminErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AdminError({ error, reset }: AdminErrorProps) {
  useEffect(() => {
    console.error("Admin route error:", error);
  }, [error]);

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
      <h2 className="text-lg font-semibold text-rose-800">Falha ao carregar area administrativa</h2>
      <p className="mt-2 text-sm text-rose-700">
        Tente novamente. Se o problema persistir, valide variaveis de ambiente e conexao com banco.
      </p>
      <p className="mt-2 text-xs text-rose-700/80">
        Diagnostico rapido: acesse <span className="font-mono">/api/health</span>
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-rose-700/80">
          Digest: <span className="font-mono">{error.digest}</span>
        </p>
      ) : null}
      <Button className="mt-4" variant="destructive" onClick={reset} type="button">
        Tentar novamente
      </Button>
    </div>
  );
}
