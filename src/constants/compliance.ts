export const CFMV_TELEORIENTACAO_BANNER = {
  titulo: 'Sessão de Teleorientação · CFMV 1.465/2022',
  corpo:
    'Esta é uma sessão de TELEORIENTAÇÃO. Modalidade prevista na Resolução CFMV nº ' +
    '1.465/2022 que fornece orientações e encaminhamentos baseados em vínculo prévio com o tutor responsável.',
  ressalvas: [
    'NÃO substitui consulta presencial.',
    'NÃO permite emissão de diagnóstico definitivo.',
    'NÃO permite prescrição de medicamentos controlados.',
    'A sessão é gravada para fins de prontuário.',
  ],
  identificacaoVet: (nmVet: string, nrCRMV: string) =>
    `Médico-Veterinário responsável: ${nmVet} — CRMV ${nrCRMV}`,
} as const;
