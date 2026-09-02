import type { InternalAxiosRequestConfig } from 'axios';
import type { VeterinarioResponse } from '../types/api';

// FM-02 — fixture do GET /api/v1/veterinarios. Shape CRU do backend, o
// mesmo VeterinarioResponse usado por auth.mock.ts::mockVeterinario (ver
// veterinarios.service.ts para o raciocínio de reaproveitar o tipo sem
// tradução). Lista com 2 fichas — o suficiente para exercitar um seletor
// real (mais de 1 opção) sem inventar dado que a demo não usa em nenhum
// outro lugar.
const VETERINARIOS: VeterinarioResponse[] = [
  {
    id: 1,
    nmVeterinario: 'Dr. Felipe Ferrete',
    nrCRMV: 'SP-12345',
    dsEmail: 'felipe.ferrete@kura.vet',
    dsEspecialidade: 'Clínica geral',
  },
  {
    id: 2,
    nmVeterinario: 'Dra. Camila Rocha',
    nrCRMV: 'SP-67890',
    dsEmail: 'camila.rocha@kura.vet',
    dsEspecialidade: 'Dermatologia',
  },
];

export async function veterinarios(_config: InternalAxiosRequestConfig): Promise<VeterinarioResponse[]> {
  return VETERINARIOS;
}
