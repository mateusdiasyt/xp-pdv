export function roleSlugToLabel(roleSlug: string) {
  if (roleSlug === "administrador") {
    return "Administrador";
  }

  if (roleSlug === "gerente") {
    return "Gerente";
  }

  if (roleSlug === "financeiro") {
    return "Financeiro";
  }

  if (roleSlug === "caixa") {
    return "Caixa";
  }

  if (roleSlug === "operador") {
    return "Operador";
  }

  return "Usuario";
}
