import type {
  PetResponse,
  AlertaResponse,
  TimelineEventResponse,
  AgendamentoResponse,
  MedicamentoResponse,
  VeterinarioResponse,
  DashboardHojeResponse,
} from '../types/api';
import type {
  Pet,
  Tutor,
  Alerta,
  EventoTimeline,
  Agendamento,
  Medicamento,
  Veterinario,
  DashboardHoje,
} from '../types/domain';
import type { PetPalette } from '../components/primitives/KCPetPortrait';

export function racaToPalette(raca: string): PetPalette {
  const r = raca.toLowerCase();
  if (r.includes('labrador')) return 'lab';
  if (r.includes('siam')) return 'siam';
  if (r.includes('border')) return 'border';
  if (r.includes('poodle')) return 'poodle';
  if (r.includes('persa')) return 'persa';
  if (r.includes('golden')) return 'golden';
  if (r.includes('husky')) return 'husky';
  return 'srd';
}

export function mapTutorDto(dto: {
  id: number;
  nmTutor: string;
  dsTelefone: string;
  dsEmail: string;
}): Tutor {
  return {
    id: dto.id,
    nome: dto.nmTutor,
    telefone: dto.dsTelefone,
    email: dto.dsEmail,
  };
}

export function mapPetDto(dto: PetResponse): Pet {
  return {
    id: dto.id,
    nome: dto.nmPet,
    especie: dto.nmEspecie,
    raca: dto.nmRaca,
    dataNascimento: new Date(dto.dtNascimento),
    sexo: dto.sgSexo,
    porte: dto.sgPorte,
    tutores: dto.tutores.map(mapTutorDto),
  };
}

export function mapAlertaDto(dto: AlertaResponse): Alerta {
  return {
    id: dto.id,
    tipo: dto.dsTipoAlerta,
    mensagem: dto.dsMensagem,
    idPet: dto.idPet ?? undefined,
    nomePet: dto.nmPet ?? undefined,
    criadoEm: new Date(dto.dtCriacao),
  };
}

export function mapEventoTimelineDto(dto: TimelineEventResponse): EventoTimeline {
  return {
    id: dto.idEventoClinico,
    tipo: dto.nmTipo,
    data: new Date(dto.dtEvento),
    observacao: dto.dsObservacao,
    nomeVeterinario: dto.nmVeterinario ?? undefined,
  };
}

export function mapAgendamentoDto(dto: AgendamentoResponse): Agendamento {
  return {
    id: dto.id,
    inicio: new Date(dto.dtInicio),
    duracaoMinutos: dto.nrDuracaoMinutos,
    status: dto.sgStatus,
    pet: {
      id: dto.pet.id,
      nome: dto.pet.nmPet,
      especie: dto.pet.nmEspecie,
      raca: dto.pet.nmRaca,
    },
    tutor: {
      id: dto.tutor.id,
      nome: dto.tutor.nmTutor,
      telefone: dto.tutor.dsTelefone,
    },
    veterinario: {
      id: dto.veterinario.id,
      nome: dto.veterinario.nmVeterinario,
      crmv: dto.veterinario.nrCRMV,
    },
    observacao: dto.dsObservacao ?? undefined,
  };
}

export function mapMedicamentoDto(dto: MedicamentoResponse): Medicamento {
  return {
    id: dto.id,
    nome: dto.nmMedicamento,
    principioAtivo: dto.dsPrincipioAtivo,
    concentracao: dto.dsConcentracao,
    apresentacao: dto.dsApresentacao,
  };
}

export function mapVeterinarioDto(dto: VeterinarioResponse): Veterinario {
  return {
    id: dto.id,
    nome: dto.nmVeterinario,
    crmv: dto.nrCRMV,
    email: dto.dsEmail,
    telefone: dto.dsTelefone ?? undefined,
    fotoUrl: dto.dsFotoUrl ?? undefined,
    especialidade: dto.dsEspecialidade ?? undefined,
    bio: dto.dsBio ?? undefined,
  };
}

export function mapDashboardHojeDto(dto: DashboardHojeResponse): DashboardHoje {
  return {
    consultasHoje: dto.metrics.nrConsultasHoje,
    pacientesAtendidos: dto.metrics.nrPacientesAtendidos,
    alertasAtivos: dto.metrics.nrAlertasAtivos,
    teleorientacoes: dto.metrics.nrTeleorientacoes,
    resumo: dto.dailySummary.dsResumo,
    ultimaAtualizacao: new Date(dto.dailySummary.dtUltimaAtualizacao),
  };
}
