import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ForbiddenPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <Card className="w-full max-w-lg border-zinc-200/80 shadow-lg shadow-zinc-900/5">
        <CardHeader>
          <CardTitle>Acesso nao autorizado</CardTitle>
          <CardDescription>
            Seu usuario nao possui permissao para acessar esta area administrativa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/login"
            className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground"
          >
            Voltar para login
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
