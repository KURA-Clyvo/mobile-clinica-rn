// REC-03 — mordidas obrigatórias (c), (d) e (e) do brief, exercitando a
// cadeia REAL de mock (service -> apiClient -> mock-adapter ->
// tutores.mock.ts), sem jest.mock de nenhum dos 3 (mesmo padrão de
// fm02-mordida-veterinario-sem-ficha.test.tsx).
import React from 'react';
import { Alert, Linking } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/theme';
import NovoTutorScreen from '../src/app/(app)/tutores/novo';
import {
  __resetTutoresParaTeste,
  CPF_MOCK_DUPLICADO,
  CPF_MOCK_SEM_LINK,
} from '../src/mocks/tutores.mock';

const mockBack = jest.fn();
jest.mock('expo-router', () => {
  const ReactForMock = require('react');
  return {
    useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: mockBack }),
    // G2 (C-1): `novo.tsx` agora usa `useFocusEffect` pra zerar o estado no blur —
    // este teste renderiza a tela ISOLADA (sem navegação real, sem blur/foco de
    // verdade), então `useEffect(callback, [])` é uma emulação razoável de "um
    // ciclo de foco" (roda no mount, roda a limpeza no unmount). O comportamento
    // de navegação REAL (perder foco, reentrar) é coberto por
    // tests/NovoTutorScreen.navigation.test.tsx, que NÃO mocka expo-router.
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
  process.env.EXPO_PUBLIC_USE_MOCKS = 'true';
  __resetTutoresParaTeste();
});

afterEach(() => {
  process.env.EXPO_PUBLIC_USE_MOCKS = originalUseMocks;
  jest.clearAllMocks();
});

function preencherFormularioValido(
  getByTestId: ReturnType<typeof render>['getByTestId'],
  overrides: { nrCpf?: string; dsEmail?: string } = {},
) {
  fireEvent.changeText(getByTestId('input-nome-tutor'), 'Ana Beatriz');
  fireEvent.changeText(getByTestId('input-cpf-tutor'), overrides.nrCpf ?? '98765432100');
  fireEvent.changeText(
    getByTestId('input-email-tutor'),
    overrides.dsEmail ?? 'ana.nova@example.com',
  );
  fireEvent.changeText(getByTestId('input-telefone-tutor'), '11987654321');
}

// REC-04 — depois que o tutor é criado, a tela avança para a etapa "Cadastrar
// pet" (PetForm) ANTES de mostrar o convite. Espécie/raça/sexo/porte já vêm
// pré-selecionados (1ª opção de cada — ver PetForm.tsx), só o nome do pet é
// obrigatório: preencher e submeter é o suficiente pra completar o
// encadeamento nos testes que precisam chegar até o convite.
async function preencherEEnviarPetValido(getByTestId: ReturnType<typeof render>['getByTestId']) {
  await waitFor(() => expect(getByTestId('input-nome-pet')).toBeTruthy());
  fireEvent.changeText(getByTestId('input-nome-pet'), 'Rex');
  await act(async () => {
    fireEvent.press(getByTestId('btn-salvar-pet'));
  });
}

describe('NovoTutorScreen — mordida (c): sem aceite, botão desabilitado / não chama o service', () => {
  it('o botão salvar nasce desabilitado e não dispara o cadastro sem o checkbox marcado', async () => {
    const { getByTestId } = wrap(<NovoTutorScreen />);

    preencherFormularioValido(getByTestId);

    const botao = getByTestId('btn-salvar-tutor');
    expect(botao.props.accessibilityState.disabled).toBe(true);

    await act(async () => {
      fireEvent.press(botao);
    });

    // Não navegou para a tela de convite — se tivesse chamado o service e
    // recebido sucesso, o QR ou o aviso "sem link" apareceriam.
    expect(() => getByTestId('convite-qrcode')).toThrow();
    expect(() => getByTestId('convite-sem-link')).toThrow();
  });

  it('CONTROLE POSITIVO — marcando o aceite o botão habilita e o cadastro completa', async () => {
    const { getByTestId } = wrap(<NovoTutorScreen />);

    preencherFormularioValido(getByTestId);
    fireEvent.press(getByTestId('checkbox-aviso-privacidade'));

    const botao = getByTestId('btn-salvar-tutor');
    expect(botao.props.accessibilityState.disabled).toBe(false);

    await act(async () => {
      fireEvent.press(botao);
    });

    // REC-04: o convite NÃO aparece ainda — a próxima etapa é "Cadastrar
    // pet" (encadeamento tutor -> pet -> convite).
    await preencherEEnviarPetValido(getByTestId);

    await waitFor(() => expect(getByTestId('convite-qrcode')).toBeTruthy());
  });
});

describe('NovoTutorScreen — mordida (d): 409/500 do cadastro mostram mensagem genérica', () => {
  it('CPF duplicado (409) nunca mostra o CPF nem "outra clínica" no Alert', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByTestId } = wrap(<NovoTutorScreen />);

    preencherFormularioValido(getByTestId, { nrCpf: CPF_MOCK_DUPLICADO });
    fireEvent.press(getByTestId('checkbox-aviso-privacidade'));

    await act(async () => {
      fireEvent.press(getByTestId('btn-salvar-tutor'));
    });

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    const chamada = alertSpy.mock.calls[0];
    expect(chamada).toBeDefined();
    const [, mensagem] = chamada!;
    expect(mensagem).not.toContain(CPF_MOCK_DUPLICADO);
    expect(mensagem).not.toContain('outra clínica');
    expect(mensagem).toContain('Não foi possível cadastrar o tutor');

    // Não avançou para a tela de convite.
    expect(() => getByTestId('convite-qrcode')).toThrow();
  });
});

describe('NovoTutorScreen — mordida (e): dsLinkConvite null vira explicação, sem QR', () => {
  it('CPF sentinela "sem link" mostra o texto explicativo e nenhum QR Code', async () => {
    const { getByTestId, queryByTestId } = wrap(<NovoTutorScreen />);

    preencherFormularioValido(getByTestId, { nrCpf: CPF_MOCK_SEM_LINK });
    fireEvent.press(getByTestId('checkbox-aviso-privacidade'));

    await act(async () => {
      fireEvent.press(getByTestId('btn-salvar-tutor'));
    });
    await preencherEEnviarPetValido(getByTestId);

    await waitFor(() => expect(getByTestId('convite-sem-link')).toBeTruthy());
    expect(queryByTestId('convite-qrcode')).toBeNull();
    expect(queryByTestId('btn-enviar-whatsapp')).toBeNull();
    expect(queryByTestId('btn-copiar-link')).toBeNull();
  });

  it('CONTROLE POSITIVO — CPF normal mostra o QR e não o aviso de "sem link"', async () => {
    const { getByTestId, queryByTestId } = wrap(<NovoTutorScreen />);

    preencherFormularioValido(getByTestId);
    fireEvent.press(getByTestId('checkbox-aviso-privacidade'));

    await act(async () => {
      fireEvent.press(getByTestId('btn-salvar-tutor'));
    });
    await preencherEEnviarPetValido(getByTestId);

    await waitFor(() => expect(getByTestId('convite-qrcode')).toBeTruthy());
    expect(queryByTestId('convite-sem-link')).toBeNull();
  });
});

// G2b (m7, Minor): telefone com mais de 15 dígitos precisa ser barrado pelo zod (COM
// mensagem visível), não silenciosamente truncado pela máscara — a máscara em si já não
// trunca mais (tests/telefone.test.ts), aqui é a INTEGRAÇÃO: o formulário de fato recusa
// submeter, e o service nunca é chamado.
describe('NovoTutorScreen — mordida m7: telefone acima do teto é barrado pelo zod', () => {
  it('16 dígitos (sem +) -> mostra o erro de validação e NÃO chama o service', async () => {
    const { getByTestId, queryByText } = wrap(<NovoTutorScreen />);

    preencherFormularioValido(getByTestId);
    // Sobrescreve o telefone válido com um de 16 dígitos — 1 acima do teto do zod (<=15).
    fireEvent.changeText(getByTestId('input-telefone-tutor'), '1'.repeat(16));
    fireEvent.press(getByTestId('checkbox-aviso-privacidade'));

    await act(async () => {
      fireEvent.press(getByTestId('btn-salvar-tutor'));
    });

    expect(queryByText('Informe um telefone válido, com DDD')).toBeTruthy();
    // Não avançou para a tela de convite — o service nunca foi chamado.
    expect(() => getByTestId('convite-qrcode')).toThrow();
    expect(() => getByTestId('convite-sem-link')).toThrow();
  });

  it('CONTROLE POSITIVO — 15 dígitos (exatamente no teto) passa e completa o cadastro', async () => {
    const { getByTestId } = wrap(<NovoTutorScreen />);

    preencherFormularioValido(getByTestId);
    // Com '+' — sem ele, 15 dígitos não bate em NENHUM ramo de
    // NormalizadorTelefone.cs (só reconhece 10/11 ou 12/13 sem '+'; 15
    // exige DDI explícito, ramo 1) e o MOCK rejeitaria com 422. O teto do
    // zod é sobre TOTAL de dígitos, não sobre a forma — este é o caso onde
    // 15 dígitos é uma entrada REALMENTE válida.
    fireEvent.changeText(getByTestId('input-telefone-tutor'), `+${'1'.repeat(15)}`);
    fireEvent.press(getByTestId('checkbox-aviso-privacidade'));

    await act(async () => {
      fireEvent.press(getByTestId('btn-salvar-tutor'));
    });
    await preencherEEnviarPetValido(getByTestId);

    await waitFor(() => expect(getByTestId('convite-qrcode')).toBeTruthy());
  });
});

describe('NovoTutorScreen — "Enviar pelo WhatsApp" usa link normalizado (mordida b, integrada)', () => {
  it('abre o wa.me com o número normalizado e a mensagem codificada', async () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    const { getByTestId } = wrap(<NovoTutorScreen />);

    preencherFormularioValido(getByTestId);
    fireEvent.press(getByTestId('checkbox-aviso-privacidade'));

    await act(async () => {
      fireEvent.press(getByTestId('btn-salvar-tutor'));
    });
    await preencherEEnviarPetValido(getByTestId);

    await waitFor(() => expect(getByTestId('convite-qrcode')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByTestId('btn-enviar-whatsapp'));
    });

    expect(openURLSpy).toHaveBeenCalledTimes(1);
    const chamada = openURLSpy.mock.calls[0];
    expect(chamada).toBeDefined();
    const [url] = chamada!;
    expect(url).toMatch(/^https:\/\/wa\.me\/5511987654321\?text=/);
  });
});

// REC-04 — aceite central do encadeamento: "Convite aparece só no fim do
// encadeamento, uma vez". As mordidas (c)/(e)/m7/wa.me acima já EXERCITAM a
// ordem correta (todas fazem: tutor -> pet -> convite), mas nenhuma delas
// afirma EXPLICITAMENTE que o convite está AUSENTE enquanto a etapa "pet"
// está em cena — este describe faz essa afirmação de propósito, com mordida
// própria (mutação real: pular a etapa "pet").
describe('NovoTutorScreen — REC-04: convite aparece só no FIM do encadeamento (tutor -> pet -> convite), uma vez', () => {
  it('depois de criar o tutor, mostra o formulário de PET, NUNCA o convite — só depois de salvar o pet é que o convite aparece', async () => {
    const { getByTestId, queryByTestId } = wrap(<NovoTutorScreen />);

    preencherFormularioValido(getByTestId);
    fireEvent.press(getByTestId('checkbox-aviso-privacidade'));
    await act(async () => {
      fireEvent.press(getByTestId('btn-salvar-tutor'));
    });

    // ETAPA "PET": o convite ainda NÃO existe nesta árvore.
    await waitFor(() => expect(getByTestId('input-nome-pet')).toBeTruthy());
    expect(queryByTestId('convite-qrcode')).toBeNull();
    expect(queryByTestId('convite-sem-link')).toBeNull();

    fireEvent.changeText(getByTestId('input-nome-pet'), 'Rex');
    await act(async () => {
      fireEvent.press(getByTestId('btn-salvar-pet'));
    });

    // ETAPA "CONVITE": só agora aparece, e o formulário de pet sumiu — uma
    // única exibição, no fim.
    await waitFor(() => expect(getByTestId('convite-qrcode')).toBeTruthy());
    expect(queryByTestId('input-nome-pet')).toBeNull();
  });
});
