"use client";

import { RecordStatus } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { type FormEvent, useState } from "react";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState, type ActionState } from "@/presentation/admin/common/action-state";
import { createCategoryAction } from "@/presentation/admin/catalog/categories/actions";

export function CreateCategoryForm() {
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
      const result = await createCategoryAction(initialActionState, new FormData(event.currentTarget));
      setState(result);

      if (result.status === "success") {
        window.location.reload();
      }
    } catch {
      setState({
        status: "error",
        message: "Nao foi possivel criar a categoria. Se o problema persistir, contate o Mateus.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" placeholder="Ex: Acessorios" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Slug</Label>
        <Input id="slug" name="slug" placeholder="acessorios" required />
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="description">Descricao</Label>
        <Textarea id="description" name="description" placeholder="Detalhes internos da categoria" rows={3} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="fiscalCfop">CFOP padrao</Label>
        <Input id="fiscalCfop" name="fiscalCfop" placeholder="5405" inputMode="numeric" maxLength={4} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="fiscalCsosn">CSOSN padrao</Label>
        <Input id="fiscalCsosn" name="fiscalCsosn" placeholder="500" inputMode="numeric" maxLength={3} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="fiscalIcmsOrigin">Origem ICMS</Label>
        <Input id="fiscalIcmsOrigin" name="fiscalIcmsOrigin" placeholder="0" inputMode="numeric" maxLength={1} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <select id="status" name="status" className="admin-native-select" defaultValue={RecordStatus.ACTIVE}>
          <option value={RecordStatus.ACTIVE}>Ativa</option>
          <option value={RecordStatus.INACTIVE}>Inativa</option>
        </select>
      </div>

      <div className="md:col-span-2">
        <Button type="submit" disabled={isSubmitting} className="gap-2">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isSubmitting ? "Salvando..." : "Criar categoria"}
        </Button>
        <ActionFeedback state={state} />
      </div>
    </form>
  );
}
