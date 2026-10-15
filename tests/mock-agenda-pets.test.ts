// G4 BR-CLI-G4 (achado 11): todo `idPet` que o mock de agenda devolve (semana e hoje, que alimentam
// também o dashboard) precisa existir no mock de pets -- senão "Abrir prontuário" cai em
// "Não foi possível carregar o paciente" no plano B (Nina = idPet 118).
import type { InternalAxiosRequestConfig } from 'axios';
import { agenda } from '../src/mocks/agenda.mock';
import { buscarPetArmazenadoPorId, byId } from '../src/mocks/pets.mock';

const cfg = (extra: object = {}) => ({ params: {}, url: '/pets/118', ...extra }) as unknown as InternalAxiosRequestConfig;

describe('mocks de agenda/dashboard x mock de pets', () => {
  it('todo idPet de agenda existe em pets.mock (nenhum órfão)', async () => {
    const { agendamentos } = await agenda(cfg());
    const ids = [...new Set(agendamentos.map((a) => a.idPet))].filter((id): id is number => id != null);
    expect(ids.length).toBeGreaterThan(10);
    const orfaos = ids.filter((id) => buscarPetArmazenadoPorId(id) === undefined);
    expect(orfaos).toEqual([]);
  });

  it('o pet do 1º cartão do dashboard (Nina, 118) abre a ficha, com o nome do cartão', async () => {
    const { agendamentos } = await agenda(cfg());
    const nina = agendamentos.find((a) => a.nmPet === 'Nina' && a.dsEtapaRecepcao === 'CHEGOU')!;
    expect(nina.idPet).toBe(118);
    const pet = await byId(cfg({ url: '/pets/118' }));
    expect(pet.nmPet).toBe('Nina');
  });
});
