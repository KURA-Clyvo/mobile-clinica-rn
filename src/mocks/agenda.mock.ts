import type { InternalAxiosRequestConfig } from 'axios';
import type { AgendaApiResponseDto, AgendamentoItemApiDto } from '../services/agenda.service';

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function makeDate(base: Date, dayOffset: number, hour: number, minute = 0): string {
  const d = new Date(base);
  d.setDate(base.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

// TASK-65 (FIX_5): devolve AgendamentoItemApiDto[] (shape RAW do .NET, campos
// idAgendamento/dtAgendamento/duracaoMinutos/dsStatus) — não mais AgendamentoResponse[]
// (tipo app-facing produzido por mapAgendamentoItem). `dsStatus` usa os valores REAIS
// de ST_STATUS (CHK_AGEND_STATUS: INTENCAO/AGENDADO/CONFIRMADO/REALIZADO/CANCELADO/
// NAO_COMPARECEU — ver comentário em agenda.service.ts), não os já traduzidos
// (AGENDADA/EM_ANDAMENTO/CONCLUIDA/CANCELADA) que o mock antigo continha. `dsObservacao`
// não existe em AgendamentoItemApiDto — mapAgendamentoItem já documenta que o campo
// fica sempre undefined (o DTO real não traz observações).
function buildAppointments(): AgendamentoItemApiDto[] {
  const monday = getMonday(new Date());
  const vet = { idVeterinario: 1, nmVeterinario: 'Dr. Felipe Ferrete' };

  return [
    // Segunda
    { idAgendamento: 1, dtAgendamento: makeDate(monday, 0, 8), duracaoMinutos: 30, dsStatus: 'REALIZADO', nmPet: 'Thor', nmTutor: 'Carlos Mendes', dsTipoConsulta: 'Consulta de Retorno', nrVersion: 1, ...vet },
    { idAgendamento: 2, dtAgendamento: makeDate(monday, 0, 9), duracaoMinutos: 45, dsStatus: 'REALIZADO', nmPet: 'Mel', nmTutor: 'Patrícia Souza', dsTipoConsulta: 'Vacinação', nrVersion: 1, ...vet },
    { idAgendamento: 3, dtAgendamento: makeDate(monday, 0, 14), duracaoMinutos: 30, dsStatus: 'AGENDADO', nmPet: 'Max', nmTutor: 'Roberto Lima', dsTipoConsulta: 'Consulta Geral', nrVersion: 1, ...vet },
    // Terça
    { idAgendamento: 4, dtAgendamento: makeDate(monday, 1, 8, 30), duracaoMinutos: 30, dsStatus: 'REALIZADO', nmPet: 'Simba', nmTutor: 'Ana Paula Rodrigues', dsTipoConsulta: 'Consulta Geral', nrVersion: 1, ...vet },
    { idAgendamento: 5, dtAgendamento: makeDate(monday, 1, 10), duracaoMinutos: 60, dsStatus: 'CONFIRMADO', nmPet: 'Nina', nmTutor: 'Fernanda Costa', dsTipoConsulta: 'Check-up Anual', nrVersion: 1, ...vet },
    { idAgendamento: 6, dtAgendamento: makeDate(monday, 1, 15), duracaoMinutos: 30, dsStatus: 'AGENDADO', nmPet: 'Bob', nmTutor: 'Lucas Ferreira', dsTipoConsulta: 'Consulta Geral', nrVersion: 1, ...vet },
    // Quarta
    { idAgendamento: 7, dtAgendamento: makeDate(monday, 2, 9), duracaoMinutos: 30, dsStatus: 'CONFIRMADO', nmPet: 'Bolinha', nmTutor: 'João Ferreira', dsTipoConsulta: 'Consulta de Retorno', nrVersion: 1, ...vet },
    { idAgendamento: 8, dtAgendamento: makeDate(monday, 2, 11), duracaoMinutos: 45, dsStatus: 'AGENDADO', nmPet: 'Luna', nmTutor: 'Mariana Alves', dsTipoConsulta: 'Vacinação', nrVersion: 1, ...vet },
    { idAgendamento: 9, dtAgendamento: makeDate(monday, 2, 16), duracaoMinutos: 30, dsStatus: 'AGENDADO', nmPet: 'Rex', nmTutor: 'Pedro Henrique', dsTipoConsulta: 'Consulta Geral', nrVersion: 1, ...vet },
    // Quinta
    { idAgendamento: 10, dtAgendamento: makeDate(monday, 3, 8), duracaoMinutos: 60, dsStatus: 'AGENDADO', nmPet: 'Mimi', nmTutor: 'Sofia Martins', dsTipoConsulta: 'Check-up Anual', nrVersion: 1, ...vet },
    { idAgendamento: 11, dtAgendamento: makeDate(monday, 3, 14, 30), duracaoMinutos: 30, dsStatus: 'CANCELADO', nmPet: 'Toby', nmTutor: 'Gabriela Lima', dsTipoConsulta: 'Consulta Geral', nrVersion: 1, ...vet },
    // Sexta
    { idAgendamento: 12, dtAgendamento: makeDate(monday, 4, 9, 30), duracaoMinutos: 45, dsStatus: 'AGENDADO', nmPet: 'Nala', nmTutor: 'Ricardo Moura', dsTipoConsulta: 'Vacinação', nrVersion: 1, ...vet },
    { idAgendamento: 13, dtAgendamento: makeDate(monday, 4, 11), duracaoMinutos: 30, dsStatus: 'AGENDADO', nmPet: 'Spike', nmTutor: 'Isabela Santos', dsTipoConsulta: 'Consulta Geral', nrVersion: 1, ...vet },
    // Sábado
    { idAgendamento: 14, dtAgendamento: makeDate(monday, 5, 8), duracaoMinutos: 30, dsStatus: 'AGENDADO', nmPet: 'Coco', nmTutor: 'Thiago Nascimento', dsTipoConsulta: 'Consulta Geral', nrVersion: 1, ...vet },
    { idAgendamento: 15, dtAgendamento: makeDate(monday, 5, 9, 30), duracaoMinutos: 30, dsStatus: 'AGENDADO', nmPet: 'Pingo', nmTutor: 'Camila Ribeiro', dsTipoConsulta: 'Consulta Geral', nrVersion: 1, ...vet },
    // Domingo: sem consultas
  ];
}

export async function agenda(config: InternalAxiosRequestConfig): Promise<AgendaApiResponseDto> {
  const params = config.params as { dataInicio?: string; dataFim?: string } | undefined;
  const all = buildAppointments();

  if (!params?.dataInicio || !params?.dataFim) {
    return { dataInicio: params?.dataInicio ?? '', dataFim: params?.dataFim ?? '', agendamentos: all };
  }

  const start = new Date(params.dataInicio + 'T00:00:00');
  const end = new Date(params.dataFim + 'T23:59:59');

  const agendamentos = all.filter((a) => {
    const dt = new Date(a.dtAgendamento);
    return dt >= start && dt <= end;
  });

  return { dataInicio: params.dataInicio, dataFim: params.dataFim, agendamentos };
}
