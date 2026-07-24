export const ROUTES = {
  login: '/login',
  app: {
    dashboard: '/(app)/dashboard',
    agenda: '/(app)/agenda',
    pacientes: '/(app)/pacientes',
    pacienteDetalhe: (id: number) => `/(app)/pacientes/${id}` as const,
    consulta: (idPet: number) => `/(app)/consulta/${idPet}` as const,
    // idAgendamento é opcional: sem ele (entrada ad-hoc via ficha do pet) a tela não
    // consegue chamar api/v1/teleconsulta (exige um agendamento real no .NET).
    teleorientacao: (idPet: number, idAgendamento?: number) =>
      idAgendamento
        ? `/(app)/teleorientacao/${idPet}?idAgendamento=${idAgendamento}`
        : `/(app)/teleorientacao/${idPet}`,
    receituario: (idPet: number) => `/(app)/receituario/${idPet}` as const,
    luna: '/(app)/luna',
    settings: '/(app)/settings',
  },
} as const;
