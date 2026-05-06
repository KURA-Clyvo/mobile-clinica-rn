export const ROUTES = {
  login: '/login',
  app: {
    dashboard: '/(app)/dashboard',
    agenda: '/(app)/agenda',
    pacientes: '/(app)/pacientes',
    pacienteDetalhe: (id: number) => `/(app)/pacientes/${id}` as const,
    consulta: (idPet: number) => `/(app)/consulta/${idPet}` as const,
    teleorientacao: (idPet: number) => `/(app)/teleorientacao/${idPet}` as const,
    receituario: (idPet: number) => `/(app)/receituario/${idPet}` as const,
    luna: '/(app)/luna',
    settings: '/(app)/settings',
  },
} as const;
