import type { AlertaResponse, TimelineEventResponse } from './api';
import type { StatusAgendamentoApp } from '../utils/statusAgendamento';

export interface Tutor {
  id: number;
  nome: string;
  telefone: string;
  email: string;
}

export interface Pet {
  id: number;
  nome: string;
  especie: string;
  raca: string;
  dataNascimento: Date;
  sexo: 'M' | 'F';
  porte: 'P' | 'M' | 'G' | 'GG';
  tutores: Tutor[];
}

export interface Alerta {
  id: number;
  tipo: AlertaResponse['dsTipoAlerta'];
  mensagem: string;
  idPet?: number;
  nomePet?: string;
  criadoEm: Date;
}

export interface EventoTimeline {
  id: number;
  tipo: TimelineEventResponse['nmTipo'];
  data: Date;
  observacao: string;
  nomeVeterinario?: string;
}

export interface DashboardHoje {
  consultasHoje: number;
  pacientesAtendidos: number;
  alertasAtivos: number;
  teleorientacoes: number;
  resumo: string;
  ultimaAtualizacao: Date;
}

export interface Agendamento {
  id: number;
  inicio: Date;
  duracaoMinutos: number;
  // FM-04: referencia StatusAgendamentoApp — mesma fonte única de
  // AgendamentoResponse/RecentAppointmentResponse.sgStatus (api.ts). Só para
  // mapAgendamentoDto continuar atribuível; não é usado por nenhuma tela hoje.
  status: StatusAgendamentoApp;
  pet: {
    id: number;
    nome: string;
    especie: string;
    raca: string;
  };
  tutor: {
    id: number;
    nome: string;
    telefone: string;
  };
  veterinario: {
    id: number;
    nome: string;
    crmv: string;
  };
  observacao?: string;
}

export interface Medicamento {
  id: number;
  nome: string;
  principioAtivo: string;
  concentracao: string;
  apresentacao: string;
}

export interface Veterinario {
  id: number;
  nome: string;
  crmv: string;
  email: string;
  telefone?: string;
  fotoUrl?: string;
  especialidade?: string;
  bio?: string;
}
