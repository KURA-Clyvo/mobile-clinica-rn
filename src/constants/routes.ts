import type { Href } from 'expo-router';

// Formas canônicas SEM o segmento de grupo `(app)`: grupo é organização de
// arquivo dentro de src/app/, não faz parte da URL. Este módulo controla só a
// URL que o APP INVOCA internamente (Link/router.push/Redirect) — não o que o
// servidor estático EXPÕE. As duas coisas são diferentes: quem emite rota é o
// roteamento por arquivo do expo-router, não este módulo, e ele continua
// emitindo as duas formas para a mesma tela. Medido 2x de forma independente
// (revisor da G2 e maestro da CQ-03, dev VsClaude, KURA_BACKLOG_CLINICA_1),
// contra o export do branch desta task: `npx expo export --platform web`
// grava `dashboard.html` E `(app)/dashboard.html` (mesmo padrão para as
// outras 7 telas do grupo), conteúdo idêntico, ambas 200 no host estático.
// Trocar todo call site para a forma sem `(app)` (o que esta task fez) muda
// só o que o app pede pra si mesmo — a superfície exposta pelo servidor
// continua tendo as duas formas antes e depois. Eliminar a forma duplicada
// exigiria mexer no roteamento por arquivo (mover as telas para fora do
// grupo, ou alguma config de export que eu não conheço) — não avaliado
// aqui, ficou registrado como observação de backlog no relatório da fix wave
// pós-G2, não implementado.
export const ROUTES = {
  login: '/login',
  app: {
    dashboard: '/dashboard',
    agenda: '/agenda',
    pacientes: '/pacientes',
    // Rota é estaticamente conhecida (src/app/(app)/pacientes/[id].tsx); o expo-router
    // não tipa segmentos dinâmicos via template literal, só o helper `Href` cobre o alvo.
    pacienteDetalhe: (id: number) => `/pacientes/${id}` as Href,
    // REC-03: src/app/(app)/tutores/novo.tsx. Ponto de entrada: botão "Novo
    // tutor" em pacientes/index.tsx.
    tutorNovo: '/tutores/novo' as Href,
    // REC-04: src/app/(app)/pacientes/novo.tsx — "Adicionar pet a partir de
    // um tutor existente" (busca + formulário de pet). Ponto de entrada:
    // botão "+ Novo" em pacientes/index.tsx (antes só um Alert).
    pacienteNovo: '/pacientes/novo' as Href,
    // Idem: src/app/(app)/consulta/[idPet].tsx. REC-12: idAgendamento
    // opcional (mesmo padrão de `teleorientacao` logo abaixo) — a linha da
    // agenda "Hoje" passa o id do agendamento pra REC-13 chamar
    // `/inicio-atendimento` UMA VEZ ao montar.
    // REC-13: `nrVersion` também opcional — o endpoint exige lock otimista
    // no corpo (`RegistrarEventoRecepcaoDto.NrVersion`) e a tela não tem
    // outro jeito de conhecer a versão atual do agendamento; a linha da
    // agenda "Hoje" já tem `a.nrVersion` em memória no momento do toque, daí
    // vir pela query string em vez de um refetch antes de navegar. Sem ele
    // (entrada sem `idAgendamento`, ou uma chamada antiga que ainda não
    // manda o 3º argumento), a REC-13 envia `nrVersion: 0` e trata QUALQUER
    // rejeição (inclusive 409, se o agendamento real já tiver avançado de
    // versão) como aviso não-bloqueante — nunca crasha, só não conclui.
    // G2 REC-13 (achado M-1): CORREÇÃO — este comentário chegou a alegar que
    // "qualquer agendamento real (nrVersion >= 1) receberia 409 sempre" com
    // o fallback `0`. Falso: `backend-tutor-java db/migration/V1__*.sql:277`
    // declara `NR_VERSION NUMBER(10) DEFAULT 0 NOT NULL`, então um
    // agendamento real recém-criado e nunca alterado ESTÁ em versão `0` — o
    // fallback teria SUCESSO nesse caso, não 409. Sem impacto de
    // comportamento hoje (nenhum call site real passa só 2 argumentos — ver
    // frente 5 do g2-rec13.md), é achado de documentação, não de código.
    consulta: (idPet: number, idAgendamento?: number, nrVersion?: number) =>
      (idAgendamento
        ? `/consulta/${idPet}?idAgendamento=${idAgendamento}` +
          (typeof nrVersion === 'number' ? `&nrVersion=${nrVersion}` : '')
        : `/consulta/${idPet}`) as Href,
    // idAgendamento é opcional: sem ele (entrada ad-hoc via ficha do pet) a tela não
    // consegue chamar api/v1/teleconsulta (exige um agendamento real no .NET).
    // Rota dinâmica (src/app/(app)/teleorientacao/[idPet].tsx), cast documentado como acima.
    teleorientacao: (idPet: number, idAgendamento?: number) =>
      (idAgendamento
        ? `/teleorientacao/${idPet}?idAgendamento=${idAgendamento}`
        : `/teleorientacao/${idPet}`) as Href,
    // Idem: src/app/(app)/receituario/[idPet].tsx.
    receituario: (idPet: number) => `/receituario/${idPet}` as Href,
    // REC-14: src/app/(app)/agenda-novo.tsx (arquivo FLAT, não pasta — — formulário de novo agendamento. Pontos de
    // entrada: botão "Novo agendamento" em agenda.tsx (sem parâmetro nenhum); botão
    // "Agendar" na ficha do paciente (`idPet` — pet já conhecido, etapa de escolha de pet
    // fica travada); botão "Agendar" do card da fila da Luna (`idTutor` +
    // `idTriagemOrigem` — a triagem NÃO sabe o pet, E34, então a etapa de pet continua
    // aberta mesmo com `idTutor` preenchido). Todos os 3 parâmetros são opcionais e
    // independentes entre si (mesmo padrão de `consulta`/`teleorientacao` acima).
    agendaNovo: (opts?: { idPet?: number; idTutor?: number; idTriagemOrigem?: number }): Href => {
      const params = new URLSearchParams();
      if (opts?.idPet) params.set('idPet', String(opts.idPet));
      if (opts?.idTutor) params.set('idTutor', String(opts.idTutor));
      if (opts?.idTriagemOrigem) params.set('idTriagemOrigem', String(opts.idTriagemOrigem));
      const qs = params.toString();
      return (`/agenda-novo${qs ? `?${qs}` : ''}`) as Href;
    },
    luna: '/luna',
    settings: '/settings',
    // FM-02: src/app/(app)/usuarios/index.tsx, tela restrita a GESTOR
    // (useRequireGestor). Ponto de entrada: settings.tsx, seção "Time".
    usuarios: '/usuarios',
    // FM-05: src/app/(app)/servicos-preco/index.tsx, tela restrita a GESTOR
    // (useRequireGestor, mesmo padrão de `usuarios` acima). Ponto de
    // entrada: settings.tsx, seção "Financeiro".
    servicosPreco: '/servicos-preco',
    // FM-08: src/app/(app)/financeiro/index.tsx, tela restrita a GESTOR
    // (useRequireGestor, mesmo padrão de `usuarios`/`servicosPreco` acima). Pontos de
    // entrada: settings.tsx (seção "Financeiro") e o link "Ver painel completo" da seção
    // financeira de dashboard.tsx.
    financeiro: '/financeiro',
  },
} as const;
