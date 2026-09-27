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
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: mockBack }),
}));

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

    await waitFor(() => expect(getByTestId('convite-qrcode')).toBeTruthy());
    expect(queryByTestId('convite-sem-link')).toBeNull();
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
