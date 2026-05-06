import type { InternalAxiosRequestConfig } from 'axios';
import type { ConsultaResponse, MedicamentoResponse, PaginatedResponse } from '../types/api';

let _eventoId = 2000;
let _consultaId = 3000;
let _prescricaoId = 4000;

export async function criarConsulta(_config: InternalAxiosRequestConfig): Promise<ConsultaResponse> {
  return {
    idEventoClinico: ++_eventoId,
    idConsulta: ++_consultaId,
  };
}

export async function criarPrescricao(_config: InternalAxiosRequestConfig): Promise<{
  idEventoClinico: number;
  idPrescricao: number;
}> {
  return {
    idEventoClinico: ++_eventoId,
    idPrescricao: ++_prescricaoId,
  };
}

const MEDICAMENTOS: MedicamentoResponse[] = [
  { id: 1, nmMedicamento: 'Amoxicilina', dsPrincipioAtivo: 'Amoxicilina triidratada', dsConcentracao: '500mg', dsApresentacao: 'Comprimido' },
  { id: 2, nmMedicamento: 'Metronidazol', dsPrincipioAtivo: 'Metronidazol', dsConcentracao: '400mg', dsApresentacao: 'Comprimido' },
  { id: 3, nmMedicamento: 'Dipirona Sódica', dsPrincipioAtivo: 'Dipirona sódica', dsConcentracao: '500mg/mL', dsApresentacao: 'Solução oral' },
  { id: 4, nmMedicamento: 'Prednisona', dsPrincipioAtivo: 'Prednisona', dsConcentracao: '20mg', dsApresentacao: 'Comprimido' },
  { id: 5, nmMedicamento: 'Enrofloxacino', dsPrincipioAtivo: 'Enrofloxacino', dsConcentracao: '50mg', dsApresentacao: 'Comprimido' },
  { id: 6, nmMedicamento: 'Ivermectina', dsPrincipioAtivo: 'Ivermectina', dsConcentracao: '1%', dsApresentacao: 'Solução injetável' },
  { id: 7, nmMedicamento: 'Omeprazol', dsPrincipioAtivo: 'Omeprazol', dsConcentracao: '20mg', dsApresentacao: 'Cápsula' },
  { id: 8, nmMedicamento: 'Furosemida', dsPrincipioAtivo: 'Furosemida', dsConcentracao: '40mg', dsApresentacao: 'Comprimido' },
  { id: 9, nmMedicamento: 'Tramadol', dsPrincipioAtivo: 'Cloridrato de tramadol', dsConcentracao: '50mg', dsApresentacao: 'Comprimido' },
  { id: 10, nmMedicamento: 'Cefalexina', dsPrincipioAtivo: 'Cefalexina monoidratada', dsConcentracao: '500mg', dsApresentacao: 'Cápsula' },
];

export async function medicamentos(
  _config: InternalAxiosRequestConfig,
): Promise<PaginatedResponse<MedicamentoResponse>> {
  return {
    items: MEDICAMENTOS,
    page: 1,
    pageSize: 20,
    totalItems: MEDICAMENTOS.length,
    totalPages: 1,
  };
}
