"use client";

import { Check, Search } from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { FormSubmitButton } from "@/components/admin/form-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/presentation/admin/common/action-state";
import { createComandaAction } from "@/presentation/admin/pdv/actions";

type CustomerOption = {
  id: string;
  fullName: string;
  documentType: "CPF" | "RG";
  documentNumber: string;
};

type CreateComandaFormProps = {
  customers: CustomerOption[];
  presetNumber?: number;
  lockNumber?: boolean;
  onSuccess?: () => void;
};

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function CreateComandaForm({
  customers,
  presetNumber,
  lockNumber = false,
  onSuccess,
}: CreateComandaFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(createComandaAction, initialActionState);
  const [isWalkIn, setIsWalkIn] = useState(customers.length === 0);
  const [walkInName, setWalkInName] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
  const handledSuccessRef = useRef(false);

  useEffect(() => {
    if (state.status !== "success") {
      handledSuccessRef.current = false;
      return;
    }

    if (handledSuccessRef.current) {
      return;
    }

    handledSuccessRef.current = true;

    const closeTimeout = window.setTimeout(() => {
      onSuccess?.();
    }, 0);
    const refreshTimeout = window.setTimeout(() => {
      router.refresh();
    }, 220);

    return () => {
      window.clearTimeout(closeTimeout);
      window.clearTimeout(refreshTimeout);
    };
  }, [onSuccess, router, state.status]);

  const filteredCustomers = useMemo(() => {
    const normalizedQuery = customerQuery.trim().toLowerCase();
    const normalizedQueryDigits = normalizeDigits(customerQuery);

    return customers
      .filter((customer) => {
        if (!normalizedQuery) {
          return true;
        }

        const matchesName = customer.fullName.toLowerCase().includes(normalizedQuery);
        const matchesDocument = normalizeDigits(customer.documentNumber).includes(normalizedQueryDigits);

        return matchesName || (normalizedQueryDigits.length > 0 && matchesDocument);
      })
      .slice(0, 8);
  }, [customerQuery, customers]);

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) ?? null;

  function handleWalkInChange(nextValue: boolean) {
    setIsWalkIn(nextValue);

    if (nextValue) {
      setSelectedCustomerId("");
      setCustomerQuery("");
      setIsCustomerSearchOpen(false);
    } else {
      setWalkInName("");
    }
  }

  function handleCustomerSelect(customer: CustomerOption) {
    setSelectedCustomerId(customer.id);
    setCustomerQuery(customer.fullName);
    setIsCustomerSearchOpen(false);
  }

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-3">
      <div className="space-y-2">
        <Label htmlFor="number">Numero da comanda</Label>
        <Input
          key={`number-${presetNumber ?? "manual"}-${lockNumber ? "locked" : "free"}`}
          id="number"
          name="number"
          type="number"
          min={1}
          max={999}
          placeholder="1 a 999"
          defaultValue={presetNumber ? String(presetNumber) : ""}
          readOnly={lockNumber}
          required
        />
        {lockNumber ? (
          <p className="text-xs text-muted-foreground">
            Numero definido pelo slot escolhido no mapa de comandas.
          </p>
        ) : null}
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="customerSearch">Cliente</Label>
        <input type="hidden" name="customerId" value={selectedCustomerId} />
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
          <Input
            id="customerSearch"
            value={customerQuery}
            onChange={(event) => {
              setCustomerQuery(event.target.value);
              setSelectedCustomerId("");
              setIsCustomerSearchOpen(true);
            }}
            onFocus={() => {
              if (!isWalkIn) {
                setIsCustomerSearchOpen(true);
              }
            }}
            onBlur={() => {
              window.setTimeout(() => setIsCustomerSearchOpen(false), 120);
            }}
            placeholder="Buscar cliente ou CPF"
            className="pl-9"
            disabled={isWalkIn}
            autoComplete="off"
          />

          {!isWalkIn && isCustomerSearchOpen ? (
            <div className="absolute left-0 right-0 top-[calc(100%+0.55rem)] z-20 overflow-hidden rounded-[1.25rem] border border-border/80 bg-popover/96 shadow-2xl shadow-black/30 backdrop-blur">
              <div className="admin-scrollbar max-h-72 overflow-y-auto p-2">
                {filteredCustomers.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-muted-foreground">Nenhum cliente encontrado.</div>
                ) : (
                  filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-background/55"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleCustomerSelect(customer)}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{customer.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {customer.documentType}: {customer.documentNumber}
                        </p>
                      </div>
                      {selectedCustomerId === customer.id ? <Check className="h-4 w-4 text-primary" /> : null}
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
        {!isWalkIn && selectedCustomer ? (
          <p className="text-xs text-muted-foreground">
            {selectedCustomer.documentType}: {selectedCustomer.documentNumber}
          </p>
        ) : null}
        {customers.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Sem clientes ativos no cadastro. Use comanda avulsa ou cadastre clientes na aba Clientes.
          </p>
        ) : null}
      </div>

      {isWalkIn ? (
        <div className="space-y-2 md:col-span-3">
          <Label htmlFor="walkInName">Nome da comanda</Label>
          <Input
            id="walkInName"
            name="customerName"
            value={walkInName}
            onChange={(event) => setWalkInName(event.target.value)}
            placeholder="Ex.: Mesa 4, Joao, Aniversario"
            maxLength={120}
          />
        </div>
      ) : (
        <input type="hidden" name="customerName" value="" />
      )}

      <label className="inline-flex items-center gap-2 text-sm text-foreground md:col-span-3">
        <input
          type="checkbox"
          name="isWalkIn"
          checked={isWalkIn}
          onChange={(event) => handleWalkInChange(event.target.checked)}
          className="h-4 w-4 rounded border-border bg-background"
        />
        Comanda avulsa (sem cliente cadastrado)
      </label>

      <div className="md:col-span-3">
        <FormSubmitButton>Criar comanda</FormSubmitButton>
        <ActionFeedback state={state} />
      </div>
    </form>
  );
}
