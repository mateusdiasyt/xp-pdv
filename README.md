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

## Gameplay - liberacao de TV

O sistema pode liberar a TV diretamente pelo proprio `xp-pdv`, sem precisar hospedar um backend separado.

Estacoes padrao do projeto:

- `tv-01` = TV 01 - PS5
- `tv-02` = TV 02 - Simulador

Configuracao recomendada para operar no mesmo link do PDV:

- APK da TV: `Backend URL` = URL publica do PDV, por exemplo `https://xp-pdv.vercel.app`
- APK da TV: na primeira abertura, selecione a estacao (`TV 01 - PS5` ou `TV 02 - Simulador`)
- Vercel: `XP_GATEWAY_INTEGRATION_KEY` = chave usada se algum cliente externo chamar a rota de liberacao
- Vercel: `XP_TV_DEVICE_KEY` = opcional; se existir, o APK precisa enviar no header `x-device-key`

Rotas internas usadas pelo APK:

```http
GET https://xp-pdv.vercel.app/api/integrations/tv/status?stationId=tv-01
x-device-key: {XP_TV_DEVICE_KEY opcional}
```

Resposta quando a TV esta liberada:

```json
{
  "stationId": "tv-01",
  "status": "ACTIVE",
  "saleId": "cm...",
  "saleNumber": "VEN-...",
  "planCode": "SIMULADOR-10",
  "unlockedUntil": "2026-05-14T20:40:00.000Z",
  "remainingSeconds": 582,
  "serverTime": "2026-05-14T20:30:18.000Z"
}
```

Resposta durante a preparacao de 30 segundos:

```json
{
  "stationId": "tv-01",
  "status": "PREPARING",
  "saleId": "cm...",
  "saleNumber": "VEN-...",
  "planCode": "PS5-20",
  "serviceStartsAt": "2026-05-14T20:30:48.000Z",
  "preparationRemainingSeconds": 24,
  "releasedUntil": "2026-05-14T20:50:48.000Z",
  "remainingSeconds": 1200,
  "serverTime": "2026-05-14T20:30:24.000Z"
}
```

Resposta quando nao existe sessao ativa:

```json
{
  "stationId": "tv-01",
  "status": "LOCKED",
  "remainingSeconds": 0
}
```

Se no futuro houver um XP Gateway separado, configure:

- `XP_GATEWAY_BASE_URL` = URL base do backend do XP Gateway
- `XP_GATEWAY_INTEGRATION_KEY` = chave enviada no header `x-integration-key`
- `XP_GATEWAY_TIMEOUT_MS` = timeout da chamada em ms (padrao `8000`)
- `XP_GATEWAY_RETRY_MAX` = quantidade de retentativas em timeout/5xx (padrao `2`)

Se `XP_GATEWAY_BASE_URL` estiver vazio, `internal`, `self`, `same-app` ou ainda com o placeholder `https://URL-DO-SEU-GATEWAY`, o sistema usa automaticamente a liberacao interna do proprio PDV.

Fluxo operacional:

1. Cadastre um produto como `Gameplay` em `Admin > Produtos`.
2. Informe o `Codigo do plano`, a duracao em minutos e o preco de venda.
3. No PDV, use `Venda rapida`, adicione o produto de gameplay e selecione a TV/estacao no resumo do pedido.
4. Ao finalizar a venda, o sistema cria a venda, emite/processa a NFC-e normalmente e registra a liberacao no proprio banco do PDV.
5. A TV entra em `PREPARING` por 30 segundos para o cliente sentar e se preparar.
6. Depois dos 30 segundos, o tempo vendido comeca a contar e o APK destrava a TV ate o horario retornado.
7. Enquanto uma estacao estiver em preparacao ou em uso, o PDV bloqueia nova venda para a mesma TV.

Controle manual pela aba `Admin > Servicos`:

- Cada estacao possui acoes rapidas para liberar sem venda fiscal vinculada.
- Tempos disponiveis: `15 min`, `30 min`, `45 min`, `1h` e `Livre`.
- `Livre` mantem a TV liberada ate alguem clicar em `Encerrar tempo`.
- `Encerrar tempo` finaliza a sessao ativa da estacao, mesmo quando ela veio de uma venda normal, e a TV volta ao bloqueio na proxima consulta do APK.
- Liberacao manual nao cria venda, nao emite NFC-e e nao altera o caixa; ela serve apenas para operacao/controle da estacao.

Compatibilidade com gateway externo:

```http
POST {XP_GATEWAY_BASE_URL}/api/integrations/pdv/release
x-integration-key: {XP_GATEWAY_INTEGRATION_KEY}
```

8. A falha do gateway externo nao cancela a venda nem bloqueia a NFC-e. O status fica na aba `Admin > Servicos`.
9. Use `Reenviar liberacao` para reprocessar uma venda com status `PENDENTE_ENVIO` ou `FALHA_ENVIO`.

Idempotencia:
- cada liberacao usa o `saleId` interno da venda;
- a tabela `GameplayRelease` possui `saleId` unico;
- se uma venda ja estiver `LIBERADA`, o reenvio nao duplica a liberacao.

Validação:

```bash
npm run test
npm run build
```

## Painel fiscal para contabilidade

Nova aba `Admin > Fiscal`:
- filtra vendas por periodo, status e busca textual;
- mostra chave, numero/serie e status fiscal de cada venda;
- permite baixar XML da NFC-e por venda via rota segura do sistema (`/api/fiscal/sales/[saleId]/xml`), sem expor token da Focus no navegador.

## Apuracao semanal de servicos (NFS-e municipal)

Servicos como PS5, simulador e sinuca nao entram na NFC-e de produtos. Eles ficam separados para emissao manual de NFS-e no portal da Prefeitura/GestaoISS.

Fluxo operacional:

1. Cadastre o produto como `Gameplay` ou `Servico manual`.
2. Informe o CNAE correto:
   - `9329804` para jogos eletronicos recreativos.
   - `9329803` para sinuca, bilhar e similares.
3. Venda normalmente no PDV, inclusive junto com produtos fisicos.
4. O sistema emite NFC-e apenas para os produtos fisicos da venda.
5. O valor dos servicos aparece em `Admin > NFS-e Servicos`, separado por CNAE e periodo.
6. Ao fim da semana, emita a NFS-e no portal `https://fozdoiguacupr.gestaoiss.com.br/`.
7. Depois de emitir, informe o numero da NFS-e no painel para marcar aqueles servicos como apurados.

Observacao fiscal:
- O sistema registra e separa os valores para facilitar a contabilidade, mas a emissao da NFS-e continua sendo feita no portal municipal.
- A venda mista fica com dois tratamentos: produtos na NFC-e e servicos na apuracao semanal de NFS-e.

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
