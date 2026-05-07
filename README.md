# Guilda Maia - ERP + Guild Platform (Fundacao V1)

Base profissional da plataforma web com foco em:

- painel administrativo real;
- autenticacao e autorizacao por perfil/permissao;
- schema inicial ERP (usuarios, categorias, fornecedores, produtos e estoque);
- arquitetura escalavel em camadas para evolucao de ERP + Guilda.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS + shadcn/ui
- Prisma ORM
- PostgreSQL
- NextAuth (credenciais, sessao JWT)

## Setup local

1. Instalar dependencias:

```bash
npm install
```

2. Criar `.env` a partir do exemplo:

```bash
copy .env.example .env
```

3. Ajustar `DATABASE_URL` no `.env`.

4. Gerar cliente Prisma e sincronizar schema no banco (Neon):

```bash
npm run db:generate
npm run db:push
```

5. Popular dados iniciais (roles, permissoes, admin):

```bash
npm run db:seed
```

6. Iniciar aplicacao:

```bash
npm run dev
```

## Deploy automatico (GitHub + Vercel)

1. Conectar o repositório GitHub ao projeto no Vercel.
2. Configurar variáveis de ambiente no Vercel:
   - `DATABASE_URL` (Neon)
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` (URL publica do projeto no Vercel)
   - `DEFAULT_ADMIN_EMAIL` (opcional)
   - `DEFAULT_ADMIN_PASSWORD` (opcional)
3. Fazer push na branch monitorada (ex.: `master` ou `main`) para acionar deploy automatico.

## Credenciais iniciais

- Email padrao: `admin@guildamaia.com`
- Senha padrao: `Admin123!`

Pode sobrescrever com:

- `DEFAULT_ADMIN_EMAIL`
- `DEFAULT_ADMIN_PASSWORD`

## NFC-e (Focus NFe)

Para emissao automatica no fechamento da venda/comanda, configure no ambiente:

- `FOCUS_NFE_ENV` = `homologacao` ou `producao`
- `FOCUS_NFE_TOKEN_HOMOLOG`
- `FOCUS_NFE_TOKEN_PROD`
- `FOCUS_NFCE_CNPJ_EMITENTE`
- `FOCUS_NFCE_NCM_PADRAO` (fallback opcional quando algum produto estiver sem NCM)

Observacao sobre ambiente fiscal:
- O painel agora possui um seletor em `Admin > Personalizacao > Ambiente fiscal NFC-e`.
- O valor salvo no painel tem prioridade sobre `FOCUS_NFE_ENV`.
- Se nao existir configuracao salva, o sistema usa `FOCUS_NFE_ENV` como fallback.

Campos opcionais (com padrao no codigo):

- `FOCUS_NFCE_CFOP_PADRAO` (padrao `5102`)
- `FOCUS_NFCE_ICMS_ORIGEM_PADRAO` (padrao `0`)
- `FOCUS_NFCE_ICMS_CST_PADRAO` (padrao `102`)
- `FOCUS_NFCE_UNIDADE_PADRAO` (padrao `UN`)
- `FOCUS_NFCE_NATUREZA_OPERACAO` (padrao `VENDA AO CONSUMIDOR`)
- `FOCUS_NFCE_LOCAL_DESTINO` (padrao `1`)
- `FOCUS_NFCE_PRESENCA_COMPRADOR` (padrao `1`)
- `FOCUS_NFCE_INDICADOR_IE_DESTINATARIO` (padrao `9`)
- `FOCUS_NFCE_INFO_ADICIONAL` (opcional)

Observacao: o sistema usa o NCM cadastrado em cada produto no catalogo. O NCM padrao entra apenas como fallback.

## Painel fiscal para contabilidade

Nova aba `Admin > Fiscal`:
- filtra vendas por periodo, status e busca textual;
- mostra chave, numero/serie e status fiscal de cada venda;
- permite baixar XML da NFC-e por venda via rota segura do sistema (`/api/fiscal/sales/[saleId]/xml`), sem expor token da Focus no navegador.

## Modulos implementados na fundacao

- Dashboard administrativo base
- Usuarios e permissoes
- Categorias
- Fornecedores
- Produtos
- Estoque (movimentacoes com trilha auditavel)
- Caixa (abertura, sangria e fechamento)
- PDV (vendas, pagamento dividido e cancelamento com retorno de estoque)

## Estrutura arquitetural

```
src/
  app/                    # Rotas e layouts
  domain/                 # Contratos e validacoes de dominio
  application/            # Casos de uso e servicos
  infrastructure/         # Repositorios e persistencia
  presentation/           # Server actions e adaptacao de UI
  components/             # Componentes reutilizaveis (admin + shadcn)
  lib/                    # Auth, prisma client e utilitarios
```

## Qualidade

Comandos de validacao:

```bash
npm run lint
npm run build
```
