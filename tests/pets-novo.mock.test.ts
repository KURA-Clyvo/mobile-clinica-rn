// REC-04 — G4b (regra v5): o mock é o 2º consumidor do contrato de
// `POST /api/v1/pets` (PetCreateWireDto). Testa a cadeia REAL de mock
// (service -> apiClient -> mock-adapter -> pets.mock.ts/tutores.mock.ts),
// sem jest.mock de nenhum dos 3, mesmo padrão de
// fm02-mordida-veterinario-sem-ficha.test.tsx / NovoTutorScreen.test.tsx.
//
// Arquivo PRÓPRIO (não somado a tests/mock-adapter.test.ts) de propósito:
// `pets.mock.ts::PETS` é um array de módulo mutado por `.push()` — o Jest
// isola módulos por ARQUIVO de teste, então criar pets aqui nunca contamina
// a asserção `length === 12` de "resolves /pets list" em mock-adapter.test.ts
// (arquivo diferente, registro de módulo diferente).
import { resolveMock } from '../src/services/api/mock-adapter';
import { __resetTutoresParaTeste } from '../src/mocks/tutores.mock';
import type { InternalAxiosRequestConfig } from 'axios';
import type { PetCreateWireDto, PetResponse, TutorComInviteWireDto } from '../src/types/api';

function makeConfig(
  url: string,
  method: string,
  data?: unknown,
): InternalAxiosRequestConfig {
  return {
    url,
    method,
    headers: {},
    data: data !== undefined ? JSON.stringify(data) : undefined,
  } as InternalAxiosRequestConfig;
}

beforeEach(() => {
  __resetTutoresParaTeste();
});

const TUTOR_VALIDO = {
  nmTutor: 'Ana Beatriz',
  nrCpf: '98765432100',
  dsEmail: 'ana.nova@example.com',
  nrTelefone: '5511987654321',
  stAvisoPrivacidadeInformado: true,
};

async function seedTutor(): Promise<number> {
  const res = await resolveMock(makeConfig('/tutores', 'POST', TUTOR_VALIDO));
  return (res.data as TutorComInviteWireDto).id;
}

const PET_VALIDO: Omit<PetCreateWireDto, 'idTutor'> = {
  idEspecie: 1,
  idRaca: 1,
  nmPet: 'Rex',
  dtNascimento: '2022-01-01T00:00:00.000Z',
  sgSexo: 'M',
  sgPorte: 'M',
  stPrincipal: true,
  dsVinculo: 'PROPRIETARIO',
};

describe('mock — POST /api/v1/pets (REC-04, G4b: modo mock não lança)', () => {
  it('cria o pet vinculado a um tutor existente e o devolve com o tutor no shape correto', async () => {
    const idTutor = await seedTutor();

    const res = await resolveMock(
      makeConfig('/pets', 'POST', { ...PET_VALIDO, idTutor }),
    );

    expect(res.status).toBe(200);
    const pet = res.data as PetResponse;
    expect(pet.nmPet).toBe('Rex');
    expect(pet.nmEspecie).toBe('Cão');
    expect(pet.nmRaca).toBe('Labrador');
    expect(pet.tutores).toHaveLength(1);
    expect(pet.tutores[0]!.idTutor).toBe(idTutor);
    expect(pet.tutores[0]!.nmTutor).toBe('Ana Beatriz');
    expect(pet.tutores[0]!.dsVinculo).toBe('PROPRIETARIO');
    expect(pet.tutores[0]!.stPrincipal).toBe(true);
  });

  // MORDIDA (aceite REC-04): "pet criado sem vínculo ao tutor" do lado do
  // mock — idTutor inexistente/omitido nunca cria o pet, sempre rejeita
  // (404), espelhando `PetService.CreateAsync` real
  // (EntidadeNaoEncontradaException("Tutor", dto.IdTutor)).
  it('MORDIDA: idTutor inexistente rejeita com 404 e NÃO cria o pet (sem vínculo, sem pet)', async () => {
    await expect(
      resolveMock(makeConfig('/pets', 'POST', { ...PET_VALIDO, idTutor: 999999 })),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('CONTROLE POSITIVO — a lista /pets segue funcionando depois da rejeição (a rota POST/GET não colidiu)', async () => {
    const resLista = await resolveMock(makeConfig('/pets', 'GET'));
    expect(Array.isArray(resLista.data)).toBe(true);
  });

  it('rejeita com 400 quando um campo obrigatório é inválido (mesma validação de PetCreateValidator.cs)', async () => {
    const idTutor = await seedTutor();
    await expect(
      resolveMock(makeConfig('/pets', 'POST', { ...PET_VALIDO, idTutor, sgSexo: 'X' })),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('mock — GET /api/v1/tutores?busca= (REC-04, busca de tutor existente)', () => {
  it('busca por nome (substring, case-insensitive) encontra o tutor semeado', async () => {
    await seedTutor();
    // GET usa `params`, não `data` — monta a config como o axios real faria.
    const resComBusca = await resolveMock({
      ...makeConfig('/tutores', 'GET'),
      params: { busca: 'beatriz' },
    });
    const nomes = (resComBusca.data as { nmTutor: string }[]).map((t) => t.nmTutor);
    expect(nomes).toContain('Ana Beatriz');
    // CONTROLE: busca sem match nenhum devolve lista vazia, não lança.
    const semMatch = await resolveMock({
      ...makeConfig('/tutores', 'GET'),
      params: { busca: 'zzz-inexistente' },
    });
    expect(semMatch.data).toEqual([]);
  });
});
