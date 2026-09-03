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
    // Idem: src/app/(app)/consulta/[idPet].tsx.
    consulta: (idPet: number) => `/consulta/${idPet}` as Href,
    // idAgendamento é opcional: sem ele (entrada ad-hoc via ficha do pet) a tela não
    // consegue chamar api/v1/teleconsulta (exige um agendamento real no .NET).
    // Rota dinâmica (src/app/(app)/teleorientacao/[idPet].tsx), cast documentado como acima.
    teleorientacao: (idPet: number, idAgendamento?: number) =>
      (idAgendamento
        ? `/teleorientacao/${idPet}?idAgendamento=${idAgendamento}`
        : `/teleorientacao/${idPet}`) as Href,
    // Idem: src/app/(app)/receituario/[idPet].tsx.
    receituario: (idPet: number) => `/receituario/${idPet}` as Href,
    luna: '/luna',
    settings: '/settings',
    // FM-02: src/app/(app)/usuarios/index.tsx, tela restrita a GESTOR
    // (useRequireGestor). Ponto de entrada: settings.tsx, seção "Time".
    usuarios: '/usuarios',
    // FM-05: src/app/(app)/servicos-preco/index.tsx, tela restrita a GESTOR
    // (useRequireGestor, mesmo padrão de `usuarios` acima). Ponto de
    // entrada: settings.tsx, seção "Financeiro".
    servicosPreco: '/servicos-preco',
  },
} as const;
