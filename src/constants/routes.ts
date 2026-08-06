import type { Href } from 'expo-router';

export const ROUTES = {
  login: '/login',
  app: {
    dashboard: '/(app)/dashboard',
    agenda: '/(app)/agenda',
    pacientes: '/(app)/pacientes',
    // Rota é estaticamente conhecida (src/app/(app)/pacientes/[id].tsx); o expo-router
    // não tipa segmentos dinâmicos via template literal, só o helper `Href` cobre o alvo.
    pacienteDetalhe: (id: number) => `/(app)/pacientes/${id}` as Href,
    // Idem: src/app/(app)/consulta/[idPet].tsx.
    consulta: (idPet: number) => `/(app)/consulta/${idPet}` as Href,
    // idAgendamento é opcional: sem ele (entrada ad-hoc via ficha do pet) a tela não
    // consegue chamar api/v1/teleconsulta (exige um agendamento real no .NET).
    // Rota dinâmica (src/app/(app)/teleorientacao/[idPet].tsx), cast documentado como acima.
    teleorientacao: (idPet: number, idAgendamento?: number) =>
      (idAgendamento
        ? `/(app)/teleorientacao/${idPet}?idAgendamento=${idAgendamento}`
        : `/(app)/teleorientacao/${idPet}`) as Href,
    // Idem: src/app/(app)/receituario/[idPet].tsx.
    receituario: (idPet: number) => `/(app)/receituario/${idPet}` as Href,
    luna: '/(app)/luna',
    settings: '/(app)/settings',
  },
} as const;
