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

// FM-04 — achado nº 3 do brief: buildAppointments() reconstruía a lista do
// ZERO a cada chamada, então um PATCH em modo mock não sobrevivia ao refetch
// seguinte (a mudança "revertia" na tela, na frente de quem estivesse vendo a
// demo — o modo mock é justamente o caminho que a demo usa por padrão,
// EXPO_PUBLIC_USE_MOCKS=true em .env.example). `_store` é preenchido uma
// única vez (lazy, na primeira chamada) e passa a ser a fonte de verdade
// tanto para `agenda()` (leitura) quanto para `atualizarStatus()` (escrita) —
// o PATCH grava, o GET seguinte lê o que foi gravado.
let _store: AgendamentoItemApiDto[] | null = null;

function getStore(): AgendamentoItemApiDto[] {
  if (!_store) {
    _store = buildAppointments();
  }
  return _store;
}

// Exportado só para teste: `_store` é module-level e o registro de módulos
// do Jest é por ARQUIVO de teste, não por `it()` — sem isto, um PATCH num
// teste vazaria estado para o próximo teste do mesmo arquivo.
export function __resetStoreParaTeste(): void {
  _store = null;
}

export async function agenda(config: InternalAxiosRequestConfig): Promise<AgendaApiResponseDto> {
  const params = config.params as { dataInicio?: string; dataFim?: string } | undefined;
  const all = getStore();

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

// FM-04: primeiro handler de PATCH deste repo. Persiste no MESMO `_store` que
// `agenda()` lê — é o que resolve o achado nº 3 (mock stateless).
//
// Só o conflito de concorrência (409) é simulado como erro aqui — é o único
// caso que o brief pede para o app tratar explicitamente (achado nº 5).
// Validação de máquina de estados (422) fica só do lado real do .NET:
// replicá-la aqui duplicaria TRANSICOES_PERMITIDAS (agenda.service.ts) e
// arriscaria divergir dela em silêncio sem que nenhum teste pegasse — o
// próprio app já decide quais botões oferecer a partir da MESMA tabela
// (getTransicoesPermitidas) antes de disparar o PATCH, então uma transição
// inválida não deveria chegar até aqui pelo fluxo normal da UI.
export async function atualizarStatus(
  config: InternalAxiosRequestConfig,
): Promise<AgendamentoItemApiDto> {
  const match = config.url?.match(/\/agendamentos\/(\d+)\/status$/);
  const idAgendamento = match ? Number(match[1]) : 0;
  const body = JSON.parse((config.data as string) ?? '{}') as {
    dsStatus?: string;
    nrVersion?: number;
    dsObservacao?: string;
  };

  const store = getStore();
  const item = store.find((a) => a.idAgendamento === idAgendamento);
  if (!item) {
    return Promise.reject({
      status: 404,
      code: 'NOT_FOUND',
      message: `Agendamento ${idAgendamento} não encontrado`,
    });
  }

  if (typeof body.nrVersion === 'number' && body.nrVersion !== item.nrVersion) {
    return Promise.reject({
      status: 409,
      code: 'CONFLITO_CONCORRENCIA',
      message: `Agendamento ${idAgendamento} foi atualizado por outro processo. Releia antes de tentar de novo.`,
    });
  }

  item.dsStatus = body.dsStatus ?? item.dsStatus;
  item.nrVersion = item.nrVersion + 1;

  return { ...item };
}
