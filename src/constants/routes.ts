import type { Href } from 'expo-router';

// Formas canônicas SEM o segmento de grupo `(app)`: grupo é organização de
// arquivo dentro de src/app/, não faz parte da URL. O expo-router aceita as
// duas formas (com e sem o grupo) para as mesmas telas, mas só uma é a URL
// que o app efetivamente usa/expõe — ver task CQ-03 (dev VsClaude,
// KURA_BACKLOG_CLINICA_1) para a medição que encontrou as duas formas
// respondendo 200 com conteúdo idêntico no export web.
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
  },
} as const;
