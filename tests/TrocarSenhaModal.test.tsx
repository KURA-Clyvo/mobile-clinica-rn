import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { TrocarSenhaModal } from '../src/components/domain/TrocarSenhaModal';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mockMutateTrocarSenha = jest.fn();
jest.mock('@hooks/useUsuariosClinica', () => ({
  useTrocarSenhaUsuarioClinica: () => ({ mutate: mockMutateTrocarSenha, isPending: false }),
}));

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('TrocarSenhaModal', () => {
  it('mostra o e-mail do usuário alvo', () => {
    const { getByText } = wrap(
      <TrocarSenhaModal visible onClose={jest.fn()} usuarioId={1} dsEmail="ativo@kura.vet" />,
    );
    expect(getByText('ativo@kura.vet')).toBeTruthy();
  });

  it('rejeita senha curta sem chamar a mutação', async () => {
    const { getByTestId, findByText } = wrap(
      <TrocarSenhaModal visible onClose={jest.fn()} usuarioId={1} dsEmail="ativo@kura.vet" />,
    );
    fireEvent.changeText(getByTestId('input-nova-senha'), '123');
    await act(async () => {
      fireEvent.press(getByTestId('btn-confirmar-trocar-senha'));
    });
    expect(await findByText('A senha precisa ter pelo menos 6 caracteres')).toBeTruthy();
    expect(mockMutateTrocarSenha).not.toHaveBeenCalled();
  });

  it('salvar chama a mutação com {id, req}, e fecha o modal com sucesso', async () => {
    const onClose = jest.fn();
    mockMutateTrocarSenha.mockImplementation((_vars, { onSuccess }) => onSuccess());
    const { getByTestId } = wrap(
      <TrocarSenhaModal visible onClose={onClose} usuarioId={7} dsEmail="ativo@kura.vet" />,
    );
    fireEvent.changeText(getByTestId('input-nova-senha'), 'novaSenha123');
    await act(async () => {
      fireEvent.press(getByTestId('btn-confirmar-trocar-senha'));
    });
    expect(mockMutateTrocarSenha).toHaveBeenCalledWith(
      { id: 7, req: { dsSenha: 'novaSenha123' } },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('um erro (400 senha inválida) aparece via Alert, e o modal NÃO fecha', async () => {
    const onClose = jest.fn();
    const spyAlert = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    mockMutateTrocarSenha.mockImplementation((_vars, { onError }) =>
      onError({ status: 400, code: 'SENHA_INVALIDA', message: 'A senha precisa ter pelo menos 6 caracteres.' }),
    );
    const { getByTestId } = wrap(
      <TrocarSenhaModal visible onClose={onClose} usuarioId={7} dsEmail="ativo@kura.vet" />,
    );
    fireEvent.changeText(getByTestId('input-nova-senha'), 'abcdef');
    await act(async () => {
      fireEvent.press(getByTestId('btn-confirmar-trocar-senha'));
    });
    await waitFor(() =>
      expect(spyAlert).toHaveBeenCalledWith('Erro', 'A senha precisa ter pelo menos 6 caracteres.'),
    );
    expect(onClose).not.toHaveBeenCalled();
    spyAlert.mockRestore();
  });
});
