import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ThemeProvider } from '../src/theme';
import { AgendamentoStatusMenu } from '../src/components/domain/AgendamentoStatusMenu';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockMutate = jest.fn();
const mockOnClose = jest.fn();

jest.mock('@hooks/useAgenda', () => ({
  useAtualizarStatusAgendamento: jest.fn(),
}));

import { useAtualizarStatusAgendamento } from '../src/hooks/useAgenda';
const mockUseAtualizarStatus = useAtualizarStatusAgendamento as jest.Mock;

jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

const BASE_PROPS = {
  visible: true,
  onClose: mockOnClose,
  idAgendamento: 42,
  nrVersion: 1,
  nmPet: 'Thor',
};

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAtualizarStatus.mockReturnValue({ mutate: mockMutate, isPending: false, variables: undefined });
});

describe('AgendamentoStatusMenu — state machine drives the offered actions', () => {
  // FM-04, prova de mordida (achado nº 2 do brief): antes desta task, o app
  // nunca calculava transições a partir do status — não havia menu nenhum,
  // então "REALIZADO não oferece ação" e "AGENDADO oferece os 4 destinos"
  // não existiam como comportamento verificável. Estes casos exercitam
  // getTransicoesPermitidas() de verdade (não mockado).
  it('AGENDADO (bucket AGENDADA) offers all 4 destinations', () => {
    const { getByTestId } = wrap(
      <AgendamentoStatusMenu {...BASE_PROPS} dsStatusOrigem="AGENDADO" />,
    );
    expect(getByTestId('btn-status-CONFIRMADO')).toBeTruthy();
    expect(getByTestId('btn-status-REALIZADO')).toBeTruthy();
    expect(getByTestId('btn-status-CANCELADO')).toBeTruthy();
    expect(getByTestId('btn-status-NAO_COMPARECEU')).toBeTruthy();
  });

  it('CONFIRMADO offers 3 destinations, without an option to re-confirm', () => {
    const { getByTestId, queryByTestId } = wrap(
      <AgendamentoStatusMenu {...BASE_PROPS} dsStatusOrigem="CONFIRMADO" />,
    );
    expect(getByTestId('btn-status-REALIZADO')).toBeTruthy();
    expect(getByTestId('btn-status-CANCELADO')).toBeTruthy();
    expect(getByTestId('btn-status-NAO_COMPARECEU')).toBeTruthy();
    expect(queryByTestId('btn-status-CONFIRMADO')).toBeNull();
  });

  // A prova central do achado nº 2: um agendamento REALIZADO (estado
  // terminal) não oferece NENHUMA ação — sem isto, o veterinário poderia
  // "desfazer" um atendimento já concluído, o que o backend .NET recusaria
  // de qualquer forma (422, StatusFinais) mas nunca deveria chegar a
  // aparecer como opção na tela.
  it('REALIZADO (terminal) offers no action at all', () => {
    const { queryByTestId, getByTestId } = wrap(
      <AgendamentoStatusMenu {...BASE_PROPS} dsStatusOrigem="REALIZADO" />,
    );
    expect(queryByTestId('btn-status-CONFIRMADO')).toBeNull();
    expect(queryByTestId('btn-status-REALIZADO')).toBeNull();
    expect(queryByTestId('btn-status-CANCELADO')).toBeNull();
    expect(queryByTestId('btn-status-NAO_COMPARECEU')).toBeNull();
    expect(getByTestId('status-menu-empty')).toBeTruthy();
  });

  it('does not render content when visible=false', () => {
    const { queryByTestId } = wrap(
      <AgendamentoStatusMenu {...BASE_PROPS} visible={false} dsStatusOrigem="AGENDADO" />,
    );
    expect(queryByTestId('btn-status-CONFIRMADO')).toBeNull();
  });
});

describe('AgendamentoStatusMenu — firing the mutation', () => {
  it('pressing a destination calls mutate with idAgendamento/dsStatus/nrVersion', () => {
    const { getByTestId } = wrap(
      <AgendamentoStatusMenu {...BASE_PROPS} nrVersion={7} dsStatusOrigem="AGENDADO" />,
    );
    fireEvent.press(getByTestId('btn-status-CONFIRMADO'));
    expect(mockMutate).toHaveBeenCalledWith(
      { idAgendamento: 42, dsStatus: 'CONFIRMADO', nrVersion: 7 },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it('closes the menu on success', () => {
    const { getByTestId } = wrap(
      <AgendamentoStatusMenu {...BASE_PROPS} dsStatusOrigem="AGENDADO" />,
    );
    fireEvent.press(getByTestId('btn-status-REALIZADO'));
    const [, callbacks] = mockMutate.mock.calls[0];
    callbacks.onSuccess();
    expect(mockOnClose).toHaveBeenCalled();
  });

  // FM-04, achado nº 5 do brief: 409 (conflito de concorrência otimista)
  // precisa de tratamento visível, não silêncio — o usuário tem que saber
  // que a lista está velha.
  it('shows a distinct alert for 409 (concurrency conflict) and closes the menu', () => {
    const { getByTestId } = wrap(
      <AgendamentoStatusMenu {...BASE_PROPS} dsStatusOrigem="AGENDADO" />,
    );
    fireEvent.press(getByTestId('btn-status-REALIZADO'));
    const [, callbacks] = mockMutate.mock.calls[0];
    callbacks.onError({ status: 409, code: 'CONFLITO_CONCORRENCIA', message: 'stale' });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Agendamento desatualizado',
      expect.stringContaining('recarregada'),
    );
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows a generic alert with the server message for non-409 errors', () => {
    const { getByTestId } = wrap(
      <AgendamentoStatusMenu {...BASE_PROPS} dsStatusOrigem="AGENDADO" />,
    );
    fireEvent.press(getByTestId('btn-status-CANCELADO'));
    const [, callbacks] = mockMutate.mock.calls[0];
    callbacks.onError({ status: 422, code: 'TRANSICAO_INVALIDA', message: 'Transição inválida' });

    expect(Alert.alert).toHaveBeenCalledWith('Não foi possível atualizar', 'Transição inválida');
    expect(mockOnClose).toHaveBeenCalled();
  });
});
