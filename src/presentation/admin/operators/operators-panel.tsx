"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { UserRound, UserRoundPlus } from "lucide-react";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { FormSubmitButton } from "@/components/admin/form-submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/presentation/admin/common/action-state";
import { createOperatorAction } from "@/presentation/admin/operators/actions";

type OperatorView = {
  id: string;
  name: string;
  email: string;
  roleName: string;
  status: string;
};

type OperatorsPanelProps = {
  operators: OperatorView[];
  canManage: boolean;
};

function isOperatorView(value: unknown): value is OperatorView {
  return Boolean(value && typeof value === "object" && "id" in value && "name" in value && "email" in value);
}

function CreateOperatorForm({ onCreated }: { onCreated: (operator: OperatorView) => void }) {
  const [state, formAction] = useActionState(createOperatorAction, initialActionState);

  useEffect(() => {
    if (state.status === "success" && isOperatorView(state.data)) {
      onCreated(state.data);
    }
  }, [onCreated, state]);

  return (
    <form action={formAction} className="grid gap-3 lg:grid-cols-[minmax(180px,1fr)_minmax(220px,1fr)_minmax(150px,0.7fr)_auto] lg:items-end">
      <div className="space-y-1.5">
        <Label htmlFor="operator-name">Nome</Label>
        <Input id="operator-name" name="name" placeholder="Nome do operador" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="operator-email">Email</Label>
        <Input id="operator-email" name="email" type="email" placeholder="operador@xp.local" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="operator-password">Senha</Label>
        <Input id="operator-password" name="password" type="password" placeholder="Min. 8 caracteres" required />
      </div>
      <FormSubmitButton>Cadastrar</FormSubmitButton>
      <div className="lg:col-span-4">
        <ActionFeedback state={state} />
      </div>
    </form>
  );
}

export function OperatorsPanel({ operators, canManage }: OperatorsPanelProps) {
  const [localOperators, setLocalOperators] = useState(operators);
  const [showForm, setShowForm] = useState(operators.length === 0);

  const handleCreated = useCallback((operator: OperatorView) => {
    setLocalOperators((currentOperators) => [
      operator,
      ...currentOperators.filter((currentOperator) => currentOperator.id !== operator.id),
    ]);
    setShowForm(false);
  }, []);

  return (
    <div className="space-y-4">
      {canManage ? (
        <section className="rounded-[1.35rem] border border-border/75 bg-card/86 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-primary/35 bg-primary/12 text-primary">
                <UserRoundPlus className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Novo operador</p>
                <p className="text-xs text-muted-foreground">Usado na abertura do caixa.</p>
              </div>
            </div>
            {localOperators.length > 0 ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setShowForm((current) => !current)}>
                {showForm ? "Ocultar" : "Cadastrar"}
              </Button>
            ) : null}
          </div>
          {showForm ? (
            <div className="mt-4">
              <CreateOperatorForm onCreated={handleCreated} />
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {localOperators.length === 0 ? (
          <div className="rounded-[1.25rem] border border-dashed border-border/75 bg-background/32 p-4 text-sm text-muted-foreground">
            Nenhum operador cadastrado.
          </div>
        ) : (
          localOperators.map((operator) => (
            <article key={operator.id} className="rounded-[1.25rem] border border-border/75 bg-card/82 p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-border/75 bg-background/48 text-muted-foreground">
                  <UserRound className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{operator.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{operator.email}</p>
                  <p className="mt-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-primary">
                    {operator.roleName}
                  </p>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
