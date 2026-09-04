import type { InternalAxiosRequestConfig } from 'axios';
import type {
  DashboardHojeApiDto,
  AlertaApiDto,
  AgendamentoResumoApiDto,
} from '../services/dashboard.service';

// TASK-65 (FIX_5): hoje()/alertas()/recentes() devolviam DashboardHojeResponse/
// AlertaResponse[]/RecentAppointmentResponse[] (tipos APP-FACING, produzidos por
// mapHoje/mapAlerta/mapRecente) onde getHoje()/getAlertas()/getRecentes() esperam
// o shape RAW do .NET (DashboardHojeApiDto/AlertaApiDto[]/AgendamentoResumoApiDto[]),
// que é o tipo de ENTRADA dos mappers, não o de SAÍDA. Mesma classe do B0.1
// (register()/auth.mock, mobile-tutor-rn) — `getHoje()` chegava a lançar
// TypeError (`dto.ultimosPetsAtendidos.length` em undefined); `getAlertas()`/
// `getRecentes()` não lançavam mas corrompiam os dados silenciosamente (todo
// alerta virava 'RETORNO_PENDENTE', todo agendamento recente saía com
// nmPet/nmTipoConsulta undefined).
export async function hoje(_config: InternalAxiosRequestConfig): Promise<DashboardHojeApiDto> {
  return {
    totalConsultasHoje: 8,
    totalAlertasAtivos: 3,
    totalRetornosPendentes: 2,
    ultimosPetsAtendidos: [
      { id: 1, nmPet: 'Thor', ultimoAtendimento: new Date(Date.now() - 2 * 3600_000).toISOString() },
      { id: 2, nmPet: 'Mel', ultimoAtendimento: new Date(Date.now() - 3 * 3600_000).toISOString() },
      { id: 3, nmPet: 'Simba', ultimoAtendimento: new Date(Date.now() - 5 * 3600_000).toISOString() },
      { id: 4, nmPet: 'Nina', ultimoAtendimento: new Date(Date.now() - 6 * 3600_000).toISOString() },
      { id: 5, nmPet: 'Pipoca', ultimoAtendimento: new Date(Date.now() - 7 * 3600_000).toISOString() },
      { id: 6, nmPet: 'Perola', ultimoAtendimento: new Date(Date.now() - 8 * 3600_000).toISOString() },
    ],
    proximosAgendamentos: [],
    // FM-08 — campos NOVOS (backend @ 81ac01c, task FD-17). Valores DELIBERADAMENTE
    // diferentes de `ultimosPetsAtendidos.length` (6, acima): enquanto o contador vinha
    // de `.length`, essa lista de 6 itens produzia um "6" que o backend real nunca
    // produziria (`.Take(5)` do repositório); agora que o contador tem campo próprio,
    // usar 6 aqui esconderia se alguém revertesse `mapHoje()` para a fórmula antiga —
    // o teste ficaria "verde" tanto com o fix quanto sem ele. 9 e 2 tornam os dois
    // ramos distinguíveis.
    totalPacientesAtendidosHoje: 9,
    totalTeleorientacoesHoje: 2,
  };
}

export async function alertas(_config: InternalAxiosRequestConfig): Promise<AlertaApiDto[]> {
  const now = new Date();
  return [
    { tipo: 'VACINA_VENCENDO', id: 1, dsTipoAlerta: 'PROXIMA_DOSE', dsMensagem: 'Vacina antirrábica de Mel venceu há 5 dias', dtCriacao: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString() },
    { tipo: 'VACINA_VENCENDO', id: 2, dsTipoAlerta: 'PROXIMA_DOSE', dsMensagem: 'V10 de Nina vence em 2 dias', dtCriacao: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString() },
    { tipo: 'TEMPERATURA', id: 3, dsTipoAlerta: 'ACIMA_LIMITE', dsMensagem: 'Temperatura do sensor IoT da Sala 2 acima do limite (26°C)', dtCriacao: new Date(now.getTime() - 30 * 60 * 1000).toISOString() },
    { tipo: 'TEMPERATURA', id: 4, dsTipoAlerta: 'ABAIXO_LIMITE', dsMensagem: 'Temperatura do sensor IoT da Sala 3 abaixo do limite (14°C)', dtCriacao: new Date(now.getTime() - 45 * 60 * 1000).toISOString() },
    { tipo: 'VACINA_VENCENDO', id: 5, dsTipoAlerta: 'PROXIMA_DOSE', dsMensagem: 'Antirrábica de Bolinha vence em 8 dias', dtCriacao: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString() },
  ];
}

export async function recentes(_config: InternalAxiosRequestConfig): Promise<AgendamentoResumoApiDto[]> {
  const now = new Date();
  return [
    { id: 101, nmPaciente: 'Thor', dtAgendamento: new Date(now.getTime() + 30 * 60 * 1000).toISOString(), dsServico: 'Consulta de Retorno', stStatus: 'AGENDADO' },
    { id: 102, nmPaciente: 'Mel', dtAgendamento: new Date(now.getTime() + 60 * 60 * 1000).toISOString(), dsServico: 'Vacinação', stStatus: 'INTENCAO' },
    { id: 103, nmPaciente: 'Max', dtAgendamento: new Date(now.getTime() - 45 * 60 * 1000).toISOString(), dsServico: 'Consulta Geral', stStatus: 'CONFIRMADO' },
    { id: 104, nmPaciente: 'Simba', dtAgendamento: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), dsServico: 'Teleorientação', stStatus: 'REALIZADO' },
    { id: 105, nmPaciente: 'Bolinha', dtAgendamento: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(), dsServico: 'Exame Pré-operatório', stStatus: 'CANCELADO' },
  ];
}
