import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { UsuarioClinicaFormModal } from '../src/components/domain/UsuarioClinicaFormModal';
import type { UsuarioClinicaResponse, VeterinarioResponse } from '../src/types/api';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mockMutateCriar = jest.fn();
const mockMutateAtualizar = jest.fn();
jest.mock('@hooks/useUsuariosClinica', () => ({
  useCriarUsuarioClinica: () => ({ mutate: mockMutateCriar, isPending: false }),
  useAtualizarUsuarioClinica: () => ({ mutate: mockMutateAtualizar, isPending: false }),
}));

const VET_1: VeterinarioResponse = {
  id: 1,
  nmVeterinario: 'Dr. Felipe Ferrete',
  nrCRMV: 'SP-12345',
  dsEmail: 'felipe@kura.vet',
};
const VET_2: VeterinarioResponse = {
  id: 2,
  nmVeterinario: 'Dra. Camila Rocha',
  nrCRMV: 'SP-67890',
  dsEmail: 'camila@kura.vet',
};

const USUARIO_EXISTENTE: UsuarioClinicaResponse = {
  id: 5,
  idClinica: 1,
  idVeterinario: 1,
  dsEmail: 'existente@kura.vet',
  tpPerfil: 'GESTOR',
  stAtiva: true,
  dtCriacao: '2026-08-01T10:00:00Z',
  dtAtualizacao: null,
};

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('UsuarioClinicaFormModal — modo criação', () => {
  it('inicia com campos vazios, papel VETERINARIO e senha visível', () => {
    const { getByTestId, queryByTestId } = wrap(
      <UsuarioClinicaFormModal visible onClose={jest.fn()} usuario={null} veterinarios={[VET_1, VET_2]} />,
    );
    expect(getByTestId('input-email-usuario').props.value).toBe('');
    expect(queryByTestId('input-senha-usuario')).toBeTruthy();
    expect(getByTestId('chip-papel-veterinario').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('option-veterinario-nenhum').props.accessibilityState.selected).toBe(true);
  });

  it('rejeita e-mail inválido e senha curta sem chamar a mutação', async () => {
    const { getByTestId, findByText } = wrap(
      <UsuarioClinicaFormModal visible onClose={jest.fn()} usuario={null} veterinarios={[]} />,
    );
    fireEvent.changeText(getByTestId('input-email-usuario'), 'nao-e-email');
    fireEvent.changeText(getByTestId('input-senha-usuario'), '123');

    await act(async () => {
      fireEvent.press(getByTestId('btn-salvar-usuario'));
    });

    expect(await findByText('Informe um e-mail válido')).toBeTruthy();
    expect(await findByText('A senha precisa ter pelo menos 6 caracteres')).toBeTruthy();
    expect(mockMutateCriar).not.toHaveBeenCalled();
  });

  it('envia o corpo exato ao criar, com o idVeterinario escolhido', async () => {
    const onClose = jest.fn();
    mockMutateCriar.mockImplementation((_req, { onSuccess }) => onSuccess());
    const { getByTestId } = wrap(
      <UsuarioClinicaFormModal visible onClose={onClose} usuario={null} veterinarios={[VET_1, VET_2]} />,
    );

    fireEvent.changeText(getByTestId('input-email-usuario'), 'novo@kura.vet');
    fireEvent.changeText(getByTestId('input-senha-usuario'), 'senha123');
    fireEvent.press(getByTestId('chip-papel-gestor'));
    fireEvent.press(getByTestId(`option-veterinario-${VET_2.id}`));

    await act(async () => {
      fireEvent.press(getByTestId('btn-salvar-usuario'));
    });

    expect(mockMutateCriar).toHaveBeenCalledWith(
      { dsEmail: 'novo@kura.vet', dsSenha: 'senha123', tpPerfil: 'GESTOR', idVeterinario: VET_2.id },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('um erro de negócio (422) aparece via Alert, e o modal NÃO fecha', async () => {
    const onClose = jest.fn();
    const spyAlert = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    mockMutateCriar.mockImplementation((_req, { onError }) =>
      onError({ status: 422, code: 'EMAIL_EM_USO', message: 'Este e-mail já está em uso nesta clínica.' }),
    );

    const { getByTestId } = wrap(
      <UsuarioClinicaFormModal visible onClose={onClose} usuario={null} veterinarios={[]} />,
    );
    fireEvent.changeText(getByTestId('input-email-usuario'), 'dup@kura.vet');
    fireEvent.changeText(getByTestId('input-senha-usuario'), 'senha123');

    await act(async () => {
      fireEvent.press(getByTestId('btn-salvar-usuario'));
    });

    expect(spyAlert).toHaveBeenCalledWith('Erro', 'Este e-mail já está em uso nesta clínica.');
    expect(onClose).not.toHaveBeenCalled();
    spyAlert.mockRestore();
  });
});

describe('UsuarioClinicaFormModal — modo edição', () => {
  it('pré-preenche e-mail/papel/ficha do usuário e NÃO mostra campo de senha', () => {
    const { getByTestId, queryByTestId } = wrap(
      <UsuarioClinicaFormModal
        visible
        onClose={jest.fn()}
        usuario={USUARIO_EXISTENTE}
        veterinarios={[VET_1, VET_2]}
      />,
    );
    expect(getByTestId('input-email-usuario').props.value).toBe('existente@kura.vet');
    expect(getByTestId('chip-papel-gestor').props.accessibilityState.selected).toBe(true);
    expect(getByTestId(`option-veterinario-${VET_1.id}`).props.accessibilityState.selected).toBe(true);
    expect(queryByTestId('input-senha-usuario')).toBeNull();
  });

  it('salvar chama atualizar com {id, req}, SEM dsSenha no corpo', async () => {
    mockMutateAtualizar.mockImplementation((_vars, { onSuccess }) => onSuccess());
    const { getByTestId } = wrap(
      <UsuarioClinicaFormModal
        visible
        onClose={jest.fn()}
        usuario={USUARIO_EXISTENTE}
        veterinarios={[VET_1]}
      />,
    );

    await act(async () => {
      fireEvent.press(getByTestId('btn-salvar-usuario'));
    });

    expect(mockMutateAtualizar).toHaveBeenCalledWith(
      {
        id: USUARIO_EXISTENTE.id,
        req: { dsEmail: 'existente@kura.vet', tpPerfil: 'GESTOR', idVeterinario: VET_1.id },
      },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
    const [reqEnviado] = mockMutateAtualizar.mock.calls[0]!;
    expect(reqEnviado.req).not.toHaveProperty('dsSenha');
  });
});
