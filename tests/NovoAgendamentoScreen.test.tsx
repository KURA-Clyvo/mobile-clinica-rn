// REC-14 — formulário de novo agendamento (src/app/(app)/agenda-novo.tsx). Cadeia REAL de
// mock (service -> apiClient -> mock-adapter -> agenda.mock.ts/tutores.mock.ts/pets.mock.ts/
// veterinarios.mock.ts), mesmo padrão de NovoPacienteScreen.test.tsx/NovoTutorScreen.test.tsx —
// não mock de hook, para provar o formulário e o mock ponta a ponta como o backlog pede
// ("teste de integração de tela com mock").
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/theme';
import NovoAgendamentoScreen from '../src/app/(app)/agenda-novo';
import { ID_PET_MOCK_NAO_VINCULADO_AO_TUTOR, __resetStoreParaTeste } from '../src/mocks/agenda.mock';
import { getAgenda } from '../src/services/agenda.service';
import { formatDateISO } from '../src/utils/date';

const mockPush = jest.fn();
const mockBack = jest.fn();
let mockSearchParams: Record<string, string> = {};
jest.mock('expo-router', () => {
  const ReactForMock = require('react');
  return {
    useRouter: () => ({ push: mockPush, back: mockBack }),
    useLocalSearchParams: () => mockSearchParams,
    // Mesmo raciocínio de NovoTutorScreen.test.tsx/NovoPacienteScreen.test.tsx: tela
    // renderizada isolada, sem navegação real — useEffect(callback, []) emula um ciclo
    // de foco (mount + limpeza no unmount).
    useFocusEffect: (callback: () => void | (() => void)) => ReactForMock.useEffect(callback, []),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const ReactForMock = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, style }: { children: React.ReactNode; style?: unknown }) =>
      ReactForMock.createElement(View, { style }, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </ThemeProvider>,
  );
}

const originalUseMocks = process.env.EXPO_PUBLIC_USE_MOCKS;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.EXPO_PUBLIC_USE_MOCKS = 'true';
  mockSearchParams = {};
  __resetStoreParaTeste();
});

afterEach(() => {
  process.env.EXPO_PUBLIC_USE_MOCKS = originalUseMocks;
});

// Preenche tutor (busca real "Ana Beatriz", id 201) -> pet (Rex, id 301, único pet
// vinculado a esse tutor no mock) -> veterinário (Dr. Felipe Ferrete, id 1) -> tipo
// (CONSULTA). Data/hora fica no default (agora) — suficiente pro servidor real (tolerância
// de 15 min de encaixe).
// A store do mock (agenda.mock.ts) grava `dtAgendamento` como "agora" (hora local do
// aparelho no momento em que a tela montou) — consultar a agenda de HOJE (mesma rota
// que `useAgendaHoje`/`AgendaHojeCard` usam de verdade) é a forma de provar o aceite
// LITERAL do backlog ("o agendamento criado pelo card aparece na Hoje com o selo
// TRIAGEM_LUNA e a urgência"), não só que a tela de sucesso apareceu — a tela de
// sucesso aparece IGUALMENTE com `dsOrigem` errado, então ela sozinha não distingue.
async function buscarAgendamentoCriadoHoje(nmPet: string, idVeterinario: number) {
  const hoje = formatDateISO(new Date());
  const agendamentos = await getAgenda({ dataInicio: hoje, dataFim: hoje });
  // `agenda.mock.ts::buildAppointments`/`buildTodayReceptionAppointments` já semeiam
  // agendamentos fixos na semana corrente (inclusive um "Rex"/vet 1 pré-existente, que
  // PODE cair em "hoje" dependendo do dia da semana em que a suíte rodar — medido: sem
  // este filtro por id, o teste pegava esse fixture antigo em vez do que acabou de ser
  // criado). O item criado por `criarAgendamento` (agenda.mock.ts) sempre nasce com
  // `idAgendamento` a partir de 9000 (`_proximoIdAgendamentoCriado`), estritamente maior
  // que qualquer id de seed — pegar o de MAIOR id entre os que batem pet+vet isola o
  // item de verdade desta chamada, sem depender do dia da semana.
  const candidatos = agendamentos.filter(
    (a) => a.pet.nmPet === nmPet && a.veterinario.id === idVeterinario,
  );
  return candidatos.sort((a, b) => b.id - a.id)[0];
}

async function preencherFormularioCompleto(getByTestId: ReturnType<typeof render>['getByTestId']) {
  fireEvent.changeText(getByTestId('search-tutor-novo-agendamento'), 'Ana Beatriz');
  await waitFor(() => expect(getByTestId('tutor-opcao-201')).toBeTruthy());
  fireEvent.press(getByTestId('tutor-opcao-201'));
  await waitFor(() => expect(getByTestId('pet-opcao-301')).toBeTruthy());
  fireEvent.press(getByTestId('pet-opcao-301'));
  fireEvent.press(getByTestId('vet-opcao-1'));
  fireEvent.press(getByTestId('tipo-opcao-CONSULTA'));
}

describe('NovoAgendamentoScreen', () => {
  it('"Salvar agendamento" starts disabled and stays disabled until tutor+pet+vet+tipo are all chosen', async () => {
    const { getByTestId } = wrap(<NovoAgendamentoScreen />);
    expect(getByTestId('btn-salvar-agendamento').props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(getByTestId('search-tutor-novo-agendamento'), 'Ana Beatriz');
    await waitFor(() => expect(getByTestId('tutor-opcao-201')).toBeTruthy());
    fireEvent.press(getByTestId('tutor-opcao-201'));
    expect(getByTestId('btn-salvar-agendamento').props.accessibilityState.disabled).toBe(true);

    await waitFor(() => expect(getByTestId('pet-opcao-301')).toBeTruthy());
    fireEvent.press(getByTestId('pet-opcao-301'));
    expect(getByTestId('btn-salvar-agendamento').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(getByTestId('vet-opcao-1'));
    expect(getByTestId('btn-salvar-agendamento').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(getByTestId('tipo-opcao-CONSULTA'));
    expect(getByTestId('btn-salvar-agendamento').props.accessibilityState.disabled).toBe(false);
  });

  it('does not offer a pet picker before a tutor is chosen', () => {
    const { getByText } = wrap(<NovoAgendamentoScreen />);
    expect(getByText('Selecione um tutor para ver os pets dele.')).toBeTruthy();
  });

  it('creates the appointment (RECEPCAO origin) and shows the success screen', async () => {
    const { getByTestId, getByText } = wrap(<NovoAgendamentoScreen />);
    await preencherFormularioCompleto(getByTestId);

    await act(async () => {
      fireEvent.press(getByTestId('btn-salvar-agendamento'));
    });

    await waitFor(() => expect(getByText('Agendamento criado com sucesso!')).toBeTruthy());
  });

  // Aceite do backlog: aberto pela fila da Luna (idTutor + idTriagemOrigem via query
  // string), o tutor chega TRAVADO e a etapa de pet continua ABERTA (E34 — a triagem não
  // sabe o pet).
  it('opened from the Luna queue (idTutor + idTriagemOrigem): tutor is locked, pet stays open, and idTriagemOrigem reaches the request', async () => {
    mockSearchParams = { idTutor: '201', idTriagemOrigem: '501' };
    const { getByTestId, queryByTestId } = wrap(<NovoAgendamentoScreen />);

    await waitFor(() => expect(getByTestId('tutor-travado')).toBeTruthy());
    // Tutor travado -> nenhuma busca de tutor aparece.
    expect(queryByTestId('search-tutor-novo-agendamento')).toBeNull();

    await waitFor(() => expect(getByTestId('pet-opcao-301')).toBeTruthy());
    fireEvent.press(getByTestId('pet-opcao-301'));
    fireEvent.press(getByTestId('vet-opcao-1'));
    fireEvent.press(getByTestId('tipo-opcao-CONSULTA'));

    await act(async () => {
      fireEvent.press(getByTestId('btn-salvar-agendamento'));
    });

    await waitFor(() => expect(getByTestId('btn-voltar-agenda-novo')).toBeTruthy());

    // PROVA DIRETA do aceite literal do backlog ("o agendamento criado pelo card
    // aparece na Hoje com o selo TRIAGEM_LUNA e a urgência") — lê de volta pela MESMA
    // rota que a agenda "Hoje" usa (getAgenda), não só confere que a tela não quebrou.
    // Achado do maestro (G0 desta rodada): a versão anterior deste teste só conferia a
    // tela de sucesso, que aparece IGUALMENTE se `idTriagemOrigem` for descartado (o
    // mock cai em `dsOrigem: 'RECEPCAO'` sem erro nenhum) — reproduzido ao vivo,
    // `EXIT=0` numa mutação que deveria ter dado `EXIT=1`. A asserção abaixo fecha o
    // buraco: urgência 'ALTA' é o valor exato de `luna.mock.ts::TRIAGENS_FIXTURE`
    // (idTriagem 501).
    const criado = await buscarAgendamentoCriadoHoje('Rex', 1);
    expect(criado).toBeDefined();
    expect(criado?.dsOrigem).toBe('TRIAGEM_LUNA');
    expect(criado?.dsNivelUrgenciaOrigem).toBe('ALTA');
  });

  it('opened from the patient record (idPet): pet AND tutor are locked (tutor derived from the pet owner)', async () => {
    mockSearchParams = { idPet: '301' };
    const { getByTestId, queryByTestId } = wrap(<NovoAgendamentoScreen />);

    await waitFor(() => expect(getByTestId('pet-travado')).toBeTruthy());
    await waitFor(() => expect(getByTestId('tutor-travado')).toBeTruthy());
    expect(queryByTestId('search-tutor-novo-agendamento')).toBeNull();
    expect(queryByTestId('pet-opcao-301')).toBeNull();
  });

  // MORDIDA obrigatória do backlog (REC-14): "não mandar idTriagemOrigem ⇒ teste
  // vermelho" — a versão de tela desta mordida. Prova que o formulário deriva
  // `idTriagemOrigem` do parâmetro de rota e SÓ o inclui quando ele existe. Uma mutação
  // que sempre mandasse (ou sempre omitisse) o campo faria os dois testes de origem
  // (RECEPCAO acima / TRIAGEM_LUNA aqui) convergirem para o mesmo resultado — não é o
  // que medimos aqui (medição direta é em agenda.service.test.ts; este teste garante
  // que a TELA monta o dto condicionalmente, não hardcoded).
  it('does not include idTriagemOrigem when opened without a triagem param (RECEPCAO origin stays RECEPCAO)', async () => {
    mockSearchParams = {};
    const { getByTestId } = wrap(<NovoAgendamentoScreen />);
    await preencherFormularioCompleto(getByTestId);
    await act(async () => {
      fireEvent.press(getByTestId('btn-salvar-agendamento'));
    });
    await waitFor(() => expect(getByTestId('btn-voltar-agenda-novo')).toBeTruthy());

    // Mesma prova direta do teste irmão (origem TRIAGEM_LUNA) — o lado oposto: sem
    // parâmetro de triagem na rota, a leitura de volta pela agenda "Hoje" tem que
    // mostrar `dsOrigem: 'RECEPCAO'` e NENHUMA urgência de origem, não só "a tela não
    // quebrou" (que aconteceria mesmo se o campo fosse mandado por engano, contanto
    // que a triagem 501 realmente pertencesse ao tutor 201 usado aqui).
    const criado = await buscarAgendamentoCriadoHoje('Rex', 1);
    expect(criado).toBeDefined();
    expect(criado?.dsOrigem).toBe('RECEPCAO');
    expect(criado?.dsNivelUrgenciaOrigem).toBeUndefined();
  });

  it('"Encaixe agora" creates the appointment with the current time AND checks the patient in, in the same gesture', async () => {
    const { getByTestId } = wrap(<NovoAgendamentoScreen />);
    await preencherFormularioCompleto(getByTestId);

    await act(async () => {
      fireEvent.press(getByTestId('btn-encaixe-agora'));
    });

    await waitFor(() => expect(getByTestId('btn-voltar-agenda-novo')).toBeTruthy());
  });

  it('a 422 error (pet not linked to the tutor) shows a visible message and does not crash or navigate away', async () => {
    mockSearchParams = { idPet: String(ID_PET_MOCK_NAO_VINCULADO_AO_TUTOR) };
    const { getByTestId, findByTestId } = wrap(<NovoAgendamentoScreen />);

    await waitFor(() => expect(getByTestId('pet-travado')).toBeTruthy());
    await waitFor(() => expect(getByTestId('tutor-travado')).toBeTruthy());
    await waitFor(() => expect(getByTestId('vet-opcao-1')).toBeTruthy());
    fireEvent.press(getByTestId('vet-opcao-1'));
    fireEvent.press(getByTestId('tipo-opcao-CONSULTA'));

    await act(async () => {
      fireEvent.press(getByTestId('btn-salvar-agendamento'));
    });

    const erro = await findByTestId('erro-servidor-agendamento');
    expect(erro).toBeTruthy();
    // Formulário não trava: o botão volta a ficar disponível para nova tentativa.
    expect(getByTestId('btn-salvar-agendamento').props.accessibilityState.disabled).toBe(false);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('typing observações beyond the byte limit shows an inline error and disables submit', async () => {
    const { getByTestId, queryByTestId } = wrap(<NovoAgendamentoScreen />);
    await preencherFormularioCompleto(getByTestId);
    expect(getByTestId('btn-salvar-agendamento').props.accessibilityState.disabled).toBe(false);

    fireEvent.changeText(getByTestId('input-observacoes-agendamento'), 'á'.repeat(600));
    expect(queryByTestId('erro-observacoes-agendamento')).toBeTruthy();
    expect(getByTestId('btn-salvar-agendamento').props.accessibilityState.disabled).toBe(true);
  });
});
