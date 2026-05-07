import type { InternalAxiosRequestConfig } from 'axios';
import type { AgendamentoResponse } from '../types/api';

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

function buildAppointments(): AgendamentoResponse[] {
  const monday = getMonday(new Date());
  const vet = { id: 1, nmVeterinario: 'Dr. Felipe Ferrete', nrCRMV: 'SP-12345' };

  return [
    // Segunda
    { id: 1, dtInicio: makeDate(monday, 0, 8), nrDuracaoMinutos: 30, sgStatus: 'CONCLUIDA', pet: { id: 1, nmPet: 'Thor', nmEspecie: 'Cão', nmRaca: 'Labrador' }, tutor: { id: 1, nmTutor: 'Carlos Mendes', dsTelefone: '11987654321' }, veterinario: vet },
    { id: 2, dtInicio: makeDate(monday, 0, 9), nrDuracaoMinutos: 45, sgStatus: 'CONCLUIDA', pet: { id: 2, nmPet: 'Mel', nmEspecie: 'Cão', nmRaca: 'Poodle' }, tutor: { id: 2, nmTutor: 'Patrícia Souza', dsTelefone: '11976543210' }, veterinario: vet },
    { id: 3, dtInicio: makeDate(monday, 0, 14), nrDuracaoMinutos: 30, sgStatus: 'AGENDADA', pet: { id: 3, nmPet: 'Max', nmEspecie: 'Cão', nmRaca: 'Pastor Alemão' }, tutor: { id: 3, nmTutor: 'Roberto Lima', dsTelefone: '11965432109' }, veterinario: vet },
    // Terça
    { id: 4, dtInicio: makeDate(monday, 1, 8, 30), nrDuracaoMinutos: 30, sgStatus: 'CONCLUIDA', pet: { id: 4, nmPet: 'Simba', nmEspecie: 'Gato', nmRaca: 'Siamês' }, tutor: { id: 4, nmTutor: 'Ana Paula Rodrigues', dsTelefone: '11954321098' }, veterinario: vet },
    { id: 5, dtInicio: makeDate(monday, 1, 10), nrDuracaoMinutos: 60, sgStatus: 'AGENDADA', pet: { id: 5, nmPet: 'Nina', nmEspecie: 'Cão', nmRaca: 'Golden Retriever' }, tutor: { id: 5, nmTutor: 'Fernanda Costa', dsTelefone: '11943210987' }, veterinario: vet },
    { id: 6, dtInicio: makeDate(monday, 1, 15), nrDuracaoMinutos: 30, sgStatus: 'AGENDADA', pet: { id: 6, nmPet: 'Bob', nmEspecie: 'Cão', nmRaca: 'Beagle' }, tutor: { id: 6, nmTutor: 'Lucas Ferreira', dsTelefone: '11932109876' }, veterinario: vet },
    // Quarta
    { id: 7, dtInicio: makeDate(monday, 2, 9), nrDuracaoMinutos: 30, sgStatus: 'EM_ANDAMENTO', pet: { id: 7, nmPet: 'Bolinha', nmEspecie: 'Cão', nmRaca: 'SRD' }, tutor: { id: 7, nmTutor: 'João Ferreira', dsTelefone: '11921098765' }, veterinario: vet },
    { id: 8, dtInicio: makeDate(monday, 2, 11), nrDuracaoMinutos: 45, sgStatus: 'AGENDADA', pet: { id: 8, nmPet: 'Luna', nmEspecie: 'Gato', nmRaca: 'Persa' }, tutor: { id: 8, nmTutor: 'Mariana Alves', dsTelefone: '11910987654' }, veterinario: vet },
    { id: 9, dtInicio: makeDate(monday, 2, 16), nrDuracaoMinutos: 30, sgStatus: 'AGENDADA', pet: { id: 9, nmPet: 'Rex', nmEspecie: 'Cão', nmRaca: 'Rottweiler' }, tutor: { id: 9, nmTutor: 'Pedro Henrique', dsTelefone: '11909876543' }, veterinario: vet },
    // Quinta
    { id: 10, dtInicio: makeDate(monday, 3, 8), nrDuracaoMinutos: 60, sgStatus: 'AGENDADA', pet: { id: 10, nmPet: 'Mimi', nmEspecie: 'Gato', nmRaca: 'Maine Coon' }, tutor: { id: 10, nmTutor: 'Sofia Martins', dsTelefone: '11898765432' }, veterinario: vet },
    { id: 11, dtInicio: makeDate(monday, 3, 14, 30), nrDuracaoMinutos: 30, sgStatus: 'CANCELADA', pet: { id: 11, nmPet: 'Toby', nmEspecie: 'Cão', nmRaca: 'Shih Tzu' }, tutor: { id: 11, nmTutor: 'Gabriela Lima', dsTelefone: '11887654321' }, veterinario: vet, dsObservacao: 'Tutor cancelou por viagem' },
    // Sexta
    { id: 12, dtInicio: makeDate(monday, 4, 9, 30), nrDuracaoMinutos: 45, sgStatus: 'AGENDADA', pet: { id: 12, nmPet: 'Nala', nmEspecie: 'Gato', nmRaca: 'Bengal' }, tutor: { id: 12, nmTutor: 'Ricardo Moura', dsTelefone: '11876543210' }, veterinario: vet },
    { id: 13, dtInicio: makeDate(monday, 4, 11), nrDuracaoMinutos: 30, sgStatus: 'AGENDADA', pet: { id: 13, nmPet: 'Spike', nmEspecie: 'Cão', nmRaca: 'Bulldog Francês' }, tutor: { id: 13, nmTutor: 'Isabela Santos', dsTelefone: '11865432109' }, veterinario: vet },
    // Sábado
    { id: 14, dtInicio: makeDate(monday, 5, 8), nrDuracaoMinutos: 30, sgStatus: 'AGENDADA', pet: { id: 14, nmPet: 'Coco', nmEspecie: 'Cão', nmRaca: 'Yorkshire' }, tutor: { id: 14, nmTutor: 'Thiago Nascimento', dsTelefone: '11854321098' }, veterinario: vet },
    { id: 15, dtInicio: makeDate(monday, 5, 9, 30), nrDuracaoMinutos: 30, sgStatus: 'AGENDADA', pet: { id: 15, nmPet: 'Pingo', nmEspecie: 'Gato', nmRaca: 'SRD' }, tutor: { id: 15, nmTutor: 'Camila Ribeiro', dsTelefone: '11843210987' }, veterinario: vet },
    // Domingo: sem consultas
  ];
}

export async function agenda(config: InternalAxiosRequestConfig): Promise<AgendamentoResponse[]> {
  const params = config.params as { dataInicio?: string; dataFim?: string } | undefined;
  const all = buildAppointments();

  if (!params?.dataInicio || !params?.dataFim) return all;

  const start = new Date(params.dataInicio + 'T00:00:00');
  const end = new Date(params.dataFim + 'T23:59:59');

  return all.filter((a) => {
    const dt = new Date(a.dtInicio);
    return dt >= start && dt <= end;
  });
}
