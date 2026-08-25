# CQ-10 — Inventário de KPIs de gestão vs. dado real no `.NET`/Oracle

> Task de pesquisa/documentação, sem código de tela. Objetivo: para os 6 KPIs de mercado listados no
> backlog, decidir se dá pra construir um painel de gestão real (`dashboard.tsx` hoje só mostra 4
> contadores de hoje, sem série temporal nem comparação — ver `consultasHoje`/`pacientesAtendidos`/
> `alertasAtivos`/`teleorientacoes` em
> `mobile-clinica-rn/src/app/(app)/dashboard.tsx:260-282`) sem inventar dado que o backend não tem.
>
> Fonte verificada: `backend-clinica-dotnet-git` @ `5ba131c` (branch `main`), leitura apenas — 25
> tabelas confirmadas via `grep -n "ToTable(" src/Kura.Infrastructure/Persistence/Configurations/*.cs`
> (`AGENDAMENTO`, `ALERTA_TEMPERATURA`, `CLINICA`, `CONSENTIMENTO`, `CONSULTA`, `CONTA_TUTOR`,
> `DISPOSITIVO_IOT`, `DOCUMENTO`, `ESPECIE`, `EVENTO_CLINICO`, `EXAME`, `INTERACAO_CANAL`,
> `INVITE_TUTOR`, `LEITURA_TEMPERATURA`, `MEDICAMENTO`, `NOTIFICACAO`, `PET`, `PRESCRICAO`, `RACA`,
> `TIPO_EVENTO`, `TRIAGEM_LUNA`, `TUTOR`, `TUTOR_PET`, `VACINA`, `VETERINARIO`) — nenhuma tabela de
> faturamento, pagamento ou estoque entre elas.
>
> Vereditos possíveis: **DISPONÍVEL** (calculável hoje com endpoint/dado existente, sem tocar o
> `.NET`) · **DERIVÁVEL** (dado existe no Oracle, falta endpoint que exponha) · **AUSENTE** (não
> existe coluna/tabela/cálculo possível com o schema atual).
>
> **Correção pós-revisão G2 (rodada 1):** a primeira versão deste documento classificou o KPI 1
> (no-show) como AUSENTE por ter investigado só dentro do `.NET`, sem notar que `AGENDAMENTO` é
> tabela do backend **Java** (`AgendaController.cs:9` já documenta isso) e que o próprio app já
> registra, em comentário, os 6 valores reais de `ST_STATUS` do schema Java — incluindo
> `NAO_COMPARECEU`. Corrigido para DISPONÍVEL nesta versão (seção 1). A revisão também achou uma
> citação errada (não o veredito) no KPI 5 e um raciocínio de custo errado no KPI 4 — ambos
> corrigidos abaixo, com nota indicando o que mudou.

## Tabela-resumo

| # | KPI de mercado | Dado que existe hoje (citação) | Veredito |
|---|---|---|---|
| 1 | Taxa de no-show | `dsStatus` cru (pré-tradução) do `GET /api/v1/agenda` pode valer `NAO_COMPARECEU` — ver seção 1 para a cadeia completa de citações | **DISPONÍVEL** (com ressalva de escrita não verificada) |
| 2 | Taxa de ocupação da agenda | Numerador existe (`AGENDAMENTO.DT_AGENDAMENTO`/`NR_DURACAO_MINUTOS`), denominador (capacidade/horário de expediente) não existe em nenhuma tabela | **AUSENTE** |
| 3 | Receita por atendimento / ticket médio | Nenhuma tabela de fatura/pagamento/preço entre as 25 tabelas do schema | **AUSENTE** |
| 4 | Retenção e retorno de cliente | `AGENDAMENTO.ID_TUTOR`/`ID_PET` existem na tabela, mas `AgendamentoItemDto` (o DTO exposto por `/agenda`) só traz `NmTutor` (nome, não id) — ver seção 4 | **DERIVÁVEL** |
| 5 | Tempo médio de espera | `EventoClinico`/`Consulta` têm `DtCriacao`/`DtAtualizacao` (auditoria do ORM) além do timestamp de domínio, mas nenhum é "hora de chegada" nem "hora de início de atendimento" — ver seção 5 | **AUSENTE** |
| 6 | Giro de estoque | `MEDICAMENTO` é catálogo puro (`Medicamento.cs:1-8`), sem coluna de quantidade em nenhuma tabela | **AUSENTE** |

## 1. Taxa de no-show — DISPONÍVEL (com ressalva)

**Erro da primeira versão deste documento:** eu tinha classificado este KPI como AUSENTE citando
`AtualizarStatusAgendamentoValidator.cs:10-12` (que só aceita `"REALIZADO"`/`"CANCELADO"` no
**PATCH** de atualização de status) e `AgendaService.cs:16` (`StatusFinais`). Isso está correto
sobre o que aquele validator aceita **na escrita**, mas eu tratei esse validator como se fosse a
fonte de verdade sobre todos os valores que a coluna `ST_STATUS` pode assumir — e não é. O próprio
`AgendaController.cs:9` documenta que `AGENDAMENTO` é "tabela gerenciada pelo backend Java"; o
`.NET` é consumidor de leitura/atualização parcial dessa tabela, não o dono do schema completo. Eu
investiguei a pergunta inteiramente dentro do `.NET` e não recuei pra verificar se havia mais
valores possíveis do lado de quem realmente escreve a maioria dos agendamentos.

A revisão G2 (achado do maestro, reproduzido por ele antes de devolver a task) achou a resposta no
próprio repo do app, onde eu deveria ter olhado: **três comentários preservam o schema real da
tabela Java**, citando a constraint `CHK_AGEND_STATUS`:

- `mobile-clinica-rn/src/services/agenda.service.ts:32-35` — "Valores reais possíveis de ST_STATUS
  (ver CHK_AGEND_STATUS em backend-tutor-java V1__initial_schema.sql, tabela compartilhada
  AGENDAMENTO): `'INTENCAO' | 'AGENDADO' | 'CONFIRMADO' | 'REALIZADO' | 'CANCELADO' |
  'NAO_COMPARECEU'`."
- `mobile-clinica-rn/src/services/dashboard.service.ts:47-51` — mesmo comentário, duplicado.
- `mobile-clinica-rn/src/mocks/agenda.mock.ts:24` — referencia o mesmo mapeamento.

`NAO_COMPARECEU` é, portanto, um valor real e documentado de `ST_STATUS` — só não é um valor que a
rota `PATCH /agendamentos/{id}/status` deste `.NET` está autorizada a **escrever** (ela só cobre a
transição operacional REALIZADO/CANCELADO feita pela clínica no app; qual fluxo do lado Java marca
no-show não foi investigado — fora do escopo desta pesquisa, que é sobre o app da clínica).

**O caminho de leitura já existe hoje, sem tocar `.NET`:**

1. `GET /api/v1/agenda` → `AgendaController.GetAgenda` → `AgendaService.GetAgendaAsync` →
   `AgendaReadRepository.GetByIntervaloAsync` (`AgendaReadRepository.cs:20-26`) — o `Where` filtra
   só por `IdClinica`/intervalo de data/veterinário opcional, **sem nenhum filtro de `StStatus`** —
   qualquer valor gravado na coluna passa.
2. `AgendaService.cs:89` — `DsStatus = a.StStatus ?? string.Empty` — o valor cru da coluna vai pro
   DTO sem transformação.
3. No app, `agenda.service.ts:21` (`AgendamentoItemApiDto.dsStatus: string`) recebe esse valor cru.
   A tradução com perda só acontece dentro de `mapAgendamentoItem` (`agenda.service.ts:58-63`), que
   chama `translateStatus()` (linha 54-55) — e a tabela de tradução (`STATUS_TRANSLATION_TABLE`,
   linhas 45-52) colapsa `NAO_COMPARECEU -> 'CANCELADA'` (linha 51), descartando a distinção antes
   de qualquer tela ver o valor original. `dashboard.service.ts:61-68` faz exatamente o mesmo
   colapso para o endpoint de dashboard.

Ou seja: um KPI de no-show é calculável **hoje, inteiramente no app**, interceptando
`AgendamentoItemApiDto.dsStatus` **antes** de `translateStatus()` rodar (ou lendo a resposta crua de
`GET /api/v1/agenda` diretamente) e contando `dsStatus === 'NAO_COMPARECEU'` sobre o total de
agendamentos do período. Não precisa de nenhuma mudança no `.NET`.

**Ressalva que precisa ficar explícita, não é overclaim pro lado oposto:** `backend-tutor-java` não
está clonado nesta máquina (nem em nenhuma sessão deste ciclo até agora) — a existência de
`NAO_COMPARECEU` no `CHECK` constraint é conhecida por **fonte secundária** (os comentários citados
acima em `agenda.service.ts`/`dashboard.service.ts`, que descrevem o schema Java; ninguém abriu
`V1__initial_schema.sql` nesta sessão). Não dá pra confirmar, só por este repo, **se algum fluxo
real hoje de fato grava `NAO_COMPARECEU`** na coluna, ou se esse é um valor que existe no `CHECK`
mas nunca é escrito na prática (mesma classe de risco do achado `StEncaminhadoVet` da CQ-09 — campo
real, mas potencialmente vazio). O veredito desta task é
sobre **calculabilidade** ("dá pra calcular com o que existe"), não sobre **volume real dos dados**
("os dados de hoje têm massa suficiente pra o KPI significar algo") — essa segunda pergunta cabe à
CQ-11, com acesso ao Java ou a um Oracle populado, antes de prometer o gráfico ao usuário final.

## 2. Taxa de ocupação da agenda — AUSENTE

O numerador existe: `Agendamento.DtAgendamento` + `NrDuracaoMinutos` (`Agendamento.cs:11-12`) dão
quantos minutos de agenda foram ocupados num período, filtrável por `StStatus`. O problema é o
denominador — "ocupação" exige saber quanta capacidade total existia (horário de expediente da
clínica, agenda de cada veterinário, duração de slot padrão) para dividir o ocupado pelo disponível.
Nenhuma dessas informações existe: `Clinica.cs:1-18` e `Veterinario.cs:1-17` não têm nenhum campo de
horário/expediente/jornada. Busquei `horario|expediente|capacidade|slot|jornada|disponibilidade` em
todo `src/` e os únicos hits são falsos-positivos não relacionados a agenda (comentário sobre
`HealthCheckExtensions.cs` mencionando "disponibilidade" de infraestrutura). Sem capacidade
declarada em lugar nenhum, não dá pra calcular uma taxa — só uma contagem bruta de agendamentos, que
não é "ocupação".

## 3. Receita por atendimento / ticket médio — AUSENTE

Confirmado por busca exaustiva, não copiado da suspeita do `CLAUDE.md`. `grep -rli` por
`fatura|pagamento|receita|valor.*consulta|preco|preço|financeiro|cobranca` em `src/` só retorna
`Program.cs` (comentário sobre licença MIT mencionando "receita anual" da empresa, nada a ver com
domínio clínico) e dois arquivos de health check com a palavra "disponibilidade" —nenhum hit real.
As 25 tabelas do schema (listadas no topo deste doc, via `ToTable()` em
`src/Kura.Infrastructure/Persistence/Configurations/*.cs`) não incluem nada como `FATURA`,
`PAGAMENTO` ou `COBRANCA`. Também confirmei campo a campo: `Consulta.cs:1-13`, `Prescricao.cs:1-11`
e `Agendamento.cs:1-36` não têm nenhuma coluna monetária (`valor`, `preco`, `vl_*`). Não existe
nenhum jeito de calcular receita ou ticket médio com o schema atual — é gap de modelo, não de
endpoint.

## 4. Retenção e retorno de cliente — DERIVÁVEL

**Correção pós-revisão G2:** minha primeira versão descrevia o bloqueio como "falta endpoint que
agregue", como se fosse preciso construir uma rota de agregação do zero. A revisão apontou — e
confirmei lendo o DTO real — que o bloqueio é mais barato que isso: **a rota de leitura já existe e
já devolve as linhas**, só falta um campo no DTO e a consulta hoje é limitada a uma janela curta.

`Agendamento` tem `IdTutor` e `IdPet` como FK nullable na tabela (`Agendamento.cs:7-8`, mapeadas
para `ID_PET`/`ID_TUTOR` em `AgendamentoConfiguration.cs:22-23,25-26`) — o dado de vínculo existe no
Oracle. `GET /api/v1/agenda` (`AgendaController.cs`) já expõe as linhas de agendamento com
`Include(a => a.Tutor)` (`AgendaReadRepository.cs:22`). O problema é que o DTO que sai desse
endpoint, `AgendamentoItemDto`
(`src/Kura.Application/DTOs/Agenda/AgendaResponseDto.cs:10-22`), só traz `NmTutor`/`NmPet` (nome em
texto) — **não traz `IdTutor` nem `IdPet`**. Nome não é chave confiável pra agrupar (dois tutores
podem ter o mesmo nome) — sem o id, não dá pra montar "quantos agendamentos por tutor" de forma
correta a partir da resposta atual. Some a isso o teto de 31 dias por chamada
(`AgendaService.cs:43-44`, `"Intervalo máximo de 31 dias"`, documentado também no parâmetro
`dataFim` de `AgendaController.cs`) — retenção normalmente olha janelas de meses, então mesmo com o
id disponível seria necessário paginar várias chamadas de 31 dias pra montar o histórico completo.

Ou seja, o que falta **não é** "construir um endpoint de agregação do zero" — é (a) adicionar
`IdTutor`/`IdPet` ao `AgendamentoItemDto` existente (mudança pequena e localizada: DTO + mapeamento
em `AgendaService.ToItemDto`) e (b) o app fazer múltiplas chamadas de 31 dias pra cobrir a janela de
retenção desejada, ou o `.NET` ganhar uma rota sem teto de 31 dias para esse caso de uso. É bem mais
barato que um endpoint de agregação novo — relevante para a maestra decidir prioridade frente aos
outros candidatos. Continua DERIVÁVEL (não DISPONÍVEL) porque, mesmo sendo barato, ainda exige uma
mudança no `.NET` (o DTO atual não tem o id).

## 5. Tempo médio de espera — AUSENTE (citação corrigida, veredito mantido)

**Correção pós-revisão G2:** eu tinha escrito que `EventoClinico`/`Consulta` têm "só um timestamp
único" cada (`DtEvento`/`DtConsulta`). Isso é **falso** e a revisão pegou certo: as duas entidades
herdam de `EntidadeBase` (`EntidadeBase.cs:7-8`), que já traz `DtCriacao`/`DtAtualizacao` — colunas
Oracle reais, mapeadas em `ConsultaConfiguration.cs:49-54` (`DT_CRIACAO`/`DT_ATUALIZACAO`) e
`EventoClinicoConfiguration.cs:73-78` (idem). Então `Consulta` tem 3 timestamps (`DtConsulta` +
`DtCriacao` + `DtAtualizacao`), e `EventoClinico` também tem 3 (`DtEvento` + `DtCriacao` +
`DtAtualizacao`) — não 1. O erro era de contagem/citação, não de veredito: preciso explicar por que
esses 3 timestamps **não servem** pro KPI, em vez de fingir que só existe 1.

`DtCriacao`/`DtAtualizacao` são carimbos de auditoria do ORM/registro — hora em que a **linha no
banco** foi criada ou alterada pela última vez (poderia ser o instante em que o veterinário salvou o
prontuário no sistema, dias depois do atendimento, ou o instante de qualquer edição posterior) — não
a hora em que o **paciente** chegou à clínica nem a hora em que o atendimento **de fato começou**.
`DtEvento`/`DtConsulta` são a data/hora de domínio do evento clínico, também um valor único, sem par.
Nenhum dos 3 é um "check-in" observado no mundo real.

O restante do raciocínio da primeira versão continua válido e verificado: `NrDuracaoMinutos`
(`Agendamento.cs:12`) é duração **planejada** no momento de marcar a consulta, não medida. Os únicos
timestamps reais de sessão são `DtInicioSessao`/`DtFimSessao` (`Agendamento.cs:30-31`), exclusivos
de teleconsulta: `DtInicioSessao` é setado em `TeleconsultaService.cs:51` no momento em que a sala
de vídeo é criada — mede duração da chamada, não "tempo que o paciente esperou antes de ser
atendido". `DtFimSessao` nunca é atribuído em nenhum lugar do código de aplicação (`grep -rn
"DtFimSessao" src/`, filtrando migrations, só retorna entidade + configuração EF + migrations — é
coluna morta hoje). Nenhuma tabela do schema (a lista de 25 no topo deste documento) tem um par real
de "hora de chegada" × "hora de início de atendimento" pra consulta presencial — só carimbos de
auditoria de registro e uma duração planejada. Sem esse par, tempo de espera continua não
calculável.

## 6. Giro de estoque — AUSENTE

`Medicamento.cs:1-8` tem só `NmMedicamento`, `DsPrincipioAtivo`, `DsApresentacao` — é um catálogo de
referência (nome, princípio ativo, apresentação farmacêutica), sem nenhum campo de quantidade,
lote ou movimentação. `Prescricao.cs:1-11` (que referencia `Medicamento` via `IdMedicamento`) tem
`DsPosologia` e `NrDuracaoDias` — quantos dias de tratamento, não quantas unidades foram
dispensadas do estoque físico. `grep -rli "estoque|quantidade|nr_qtd|qtd_estoque"` em `src/` (fora
migrations) não retornou nenhum arquivo. `grep -rli "estoque"` em `migrations-sql/` e em
`src/Kura.Infrastructure/Migrations/*.cs` também não retornou nada. Nenhuma das 25 tabelas do schema
é de estoque/inventário. Não há controle de quantidade em lugar nenhum do modelo — giro de estoque
não é calculável nem de forma aproximada.
