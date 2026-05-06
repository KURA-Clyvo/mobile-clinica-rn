import type { InternalAxiosRequestConfig } from 'axios';
import type {
  DashboardHojeResponse,
  AlertaResponse,
  RecentAppointmentResponse,
} from '../types/api';

export async function hoje(_config: InternalAxiosRequestConfig): Promise<DashboardHojeResponse> {
  return {
    metrics: {
      nrConsultasHoje: 8,
      nrPacientesAtendidos: 6,
      nrAlertasAtivos: 3,
      nrTeleorientacoes: 2,
    },
    dailySummary: {
      dsResumo: 'Dia moderado. 3 alertas críticos pendentes de revisão. 2 retornos agendados para amanhã.',
      dtUltimaAtualizacao: new Date().toISOString(),
    },
  };
}

export async function alertas(_config: InternalAxiosRequestConfig): Promise<AlertaResponse[]> {
  const now = new Date();
  return [
    {
      id: 1,
      dsTipoAlerta: 'VACINA_VENCIDA',
      dsMensagem: 'Vacina antirrábica de Mel venceu há 5 dias',
      idPet: 3,
      nmPet: 'Mel',
      dtCriacao: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 2,
      dsTipoAlerta: 'RETORNO_PENDENTE',
      dsMensagem: 'Retorno pós-cirúrgico de Thor pendente há 3 dias',
      idPet: 1,
      nmPet: 'Thor',
      dtCriacao: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 3,
      dsTipoAlerta: 'EXAME_CRITICO',
      dsMensagem: 'Resultado de hemograma de Bolinha requer atenção imediata',
      idPet: 7,
      nmPet: 'Bolinha',
      dtCriacao: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 4,
      dsTipoAlerta: 'IOT_TEMPERATURA',
      dsMensagem: 'Temperatura do sensor IoT da Sala 2 acima do limite (26°C)',
      dtCriacao: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    },
    {
      id: 5,
      dsTipoAlerta: 'VACINA_VENCIDA',
      dsMensagem: 'V10 de Nina vence em 2 dias',
      idPet: 5,
      nmPet: 'Nina',
      dtCriacao: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

export async function recentes(_config: InternalAxiosRequestConfig): Promise<RecentAppointmentResponse[]> {
  const now = new Date();
  return [
    {
      id: 101,
      nmPet: 'Thor',
      nmTutor: 'Carlos Mendes',
      dtAgendamento: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
      nmTipoConsulta: 'Consulta de Retorno',
      sgStatus: 'AGENDADA',
    },
    {
      id: 102,
      nmPet: 'Mel',
      nmTutor: 'Patrícia Souza',
      dtAgendamento: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      nmTipoConsulta: 'Vacinação',
      sgStatus: 'AGENDADA',
    },
    {
      id: 103,
      nmPet: 'Max',
      nmTutor: 'Roberto Lima',
      dtAgendamento: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
      nmTipoConsulta: 'Consulta Geral',
      sgStatus: 'EM_ANDAMENTO',
    },
    {
      id: 104,
      nmPet: 'Simba',
      nmTutor: 'Ana Paula Rodrigues',
      dtAgendamento: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      nmTipoConsulta: 'Teleorientação',
      sgStatus: 'CONCLUIDA',
    },
    {
      id: 105,
      nmPet: 'Bolinha',
      nmTutor: 'João Ferreira',
      dtAgendamento: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
      nmTipoConsulta: 'Exame Pré-operatório',
      sgStatus: 'CANCELADA',
    },
  ];
}
