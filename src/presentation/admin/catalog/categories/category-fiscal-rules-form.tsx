"use client";

import { Loader2, Save } from "lucide-react";
import { type FormEvent, useState } from "react";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialActionState, type ActionState } from "@/presentation/admin/common/action-state";
import { updateCategoryFiscalRulesAction } from "@/presentation/admin/catalog/categories/actions";

type CategoryFiscalRulesFormProps = {
  categoryId: string;
  fiscalCfop?: string | null;
  fiscalCsosn?: string | null;
  fiscalIcmsOrigin?: string | null;
};

export function CategoryFiscalRulesForm({
  categoryId,
  fiscalCfop,
  fiscalCsosn,
  fiscalIcmsOrigin,
}: CategoryFiscalRulesFormProps) {
  const [state, setState] = useState<ActionState>(initialActionState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setState(initialActionState);

    try {
      const result = await updateCategoryFiscalRulesAction(new FormData(event.currentTarget));
      setState(result);

      if (result.status === "success") {
        window.location.reload();
      }
    } catch {
      setState({
        status: "error",
        message: "Nao foi possivel salvar a regra fiscal. Se o problema persistir, contate o Mateus.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input type="hidden" name="categoryId" value={categoryId} />
      <div className="grid min-w-[320px] gap-2 sm:grid-cols-[74px_74px_62px_auto]">
        <Input
          aria-label="CFOP padrao"
          name="fiscalCfop"
          defaultValue={fiscalCfop ?? ""}
          placeholder="CFOP"
          inputMode="numeric"
          maxLength={4}
          className="h-8 text-xs"
        />
        <Input
          aria-label="CSOSN padrao"
          name="fiscalCsosn"
          defaultValue={fiscalCsosn ?? ""}
          placeholder="CSOSN"
          inputMode="numeric"
          maxLength={3}
          className="h-8 text-xs"
        />
        <Input
          aria-label="Origem ICMS"
          name="fiscalIcmsOrigin"
          defaultValue={fiscalIcmsOrigin ?? ""}
          placeholder="Origem"
          inputMode="numeric"
          maxLength={1}
          className="h-8 text-xs"
        />
        <Button type="submit" variant="outline" size="sm" className="gap-1.5" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Salvar
        </Button>
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}
