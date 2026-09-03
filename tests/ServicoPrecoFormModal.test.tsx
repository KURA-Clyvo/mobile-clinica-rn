import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { ServicoPrecoFormModal } from '../src/components/domain/ServicoPrecoFormModal';
import type { ServicoPrecoResponse } from '../src/types/api';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mockMutateCriar = jest.fn();
const mockMutateAtualizar = jest.fn();
jest.mock('@hooks/useServicosPreco', () => ({
  useCriarServicoPreco: () => ({ mutate: mockMutateCriar, isPending: false }),
  useAtualizarServicoPreco: () => ({ mutate: mockMutateAtualizar, isPending: false }),
}));

const SERVICO_EXISTENTE: ServicoPrecoResponse = {
  id: 5,
  idClinica: 1,
  nmServico: 'Consulta de rotina',
  vlPreco: 150.5,
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

describe('ServicoPrecoFormModal — modo criação', () => {
  it('inicia com campos vazios', () => {
    const { getByTestId } = wrap(
      <ServicoPrecoFormModal visible onClose={jest.fn()} servico={null} />,
    );
    expect(getByTestId('input-nome-servico').props.value).toBe('');
    expect(getByTestId('input-preco-servico').props.value).toBe('');
    expect(getByTestId('btn-salvar-servico')).toBeTruthy();
  });

  it('rejeita nome vazio e preço inválido sem chamar a mutação', async () => {
    const { getByTestId, findByText } = wrap(
      <ServicoPrecoFormModal visible onClose={jest.fn()} servico={null} />,
    );
    fireEvent.changeText(getByTestId('input-preco-servico'), 'abc');

    await act(async () => {
      fireEvent.press(getByTestId('btn-salvar-servico'));
    });

    expect(await findByText('Nome do serviço é obrigatório')).toBeTruthy();
    expect(await findByText('Informe um número válido')).toBeTruthy();
    expect(mockMutateCriar).not.toHaveBeenCalled();
  });

  it('rejeita preço negativo', async () => {
    const { getByTestId, findByText } = wrap(
      <ServicoPrecoFormModal visible onClose={jest.fn()} servico={null} />,
    );
    fireEvent.changeText(getByTestId('input-nome-servico'), 'Consulta de rotina');
    fireEvent.changeText(getByTestId('input-preco-servico'), '-10');

    await act(async () => {
      fireEvent.press(getByTestId('btn-salvar-servico'));
    });

    expect(await findByText('Preço não pode ser negativo')).toBeTruthy();
    expect(mockMutateCriar).not.toHaveBeenCalled();
  });

  // Mordida contra o piso de precisão do backend (ServicoPrecoCreateValidator,
  // PrecisionScale(10,2)) -- 3+ casas decimais é 400 real; o form recusa
  // ANTES de chamar a mutação.
  it('rejeita preço com mais de 2 casas decimais', async () => {
    const { getByTestId, findByText } = wrap(
      <ServicoPrecoFormModal visible onClose={jest.fn()} servico={null} />,
    );
    fireEvent.changeText(getByTestId('input-nome-servico'), 'Consulta de rotina');
    fireEvent.changeText(getByTestId('input-preco-servico'), '10.555');

    await act(async () => {
      fireEvent.press(getByTestId('btn-salvar-servico'));
    });

    expect(await findByText('Preço deve ter no máximo 2 casas decimais')).toBeTruthy();
    expect(mockMutateCriar).not.toHaveBeenCalled();
  });

  it('aceita vírgula como separador decimal (convenção pt-BR) e envia number', async () => {
    const onClose = jest.fn();
    mockMutateCriar.mockImplementation((_req, { onSuccess }) => onSuccess());
    const { getByTestId } = wrap(
      <ServicoPrecoFormModal visible onClose={onClose} servico={null} />,
    );
    fireEvent.changeText(getByTestId('input-nome-servico'), '  Consulta de rotina  ');
    fireEvent.changeText(getByTestId('input-preco-servico'), '150,50');

    await act(async () => {
      fireEvent.press(getByTestId('btn-salvar-servico'));
    });

    expect(mockMutateCriar).toHaveBeenCalledWith(
      { nmServico: 'Consulta de rotina', vlPreco: 150.5 },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ServicoPrecoFormModal — modo edição', () => {
  it('pré-preenche nome e preço do serviço', () => {
    const { getByTestId } = wrap(
      <ServicoPrecoFormModal visible onClose={jest.fn()} servico={SERVICO_EXISTENTE} />,
    );
    expect(getByTestId('input-nome-servico').props.value).toBe('Consulta de rotina');
    expect(getByTestId('input-preco-servico').props.value).toBe('150.5');
  });

  it('envia PUT com id e corpo separados', async () => {
    const onClose = jest.fn();
    mockMutateAtualizar.mockImplementation((_vars, { onSuccess }) => onSuccess());
    const { getByTestId } = wrap(
      <ServicoPrecoFormModal visible onClose={onClose} servico={SERVICO_EXISTENTE} />,
    );
    fireEvent.changeText(getByTestId('input-preco-servico'), '180');

    await act(async () => {
      fireEvent.press(getByTestId('btn-salvar-servico'));
    });

    expect(mockMutateAtualizar).toHaveBeenCalledWith(
      { id: 5, req: { nmServico: 'Consulta de rotina', vlPreco: 180 } },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('erro de negócio (422) aparece via Alert, sem fechar o modal', async () => {
    const onClose = jest.fn();
    const spyAlert = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    mockMutateAtualizar.mockImplementation((_vars, { onError }) =>
      onError({ status: 422, code: 'NOME_EM_USO', message: 'Já existe um serviço ATIVO com este nome nesta clínica.' }),
    );
    const { getByTestId } = wrap(
      <ServicoPrecoFormModal visible onClose={onClose} servico={SERVICO_EXISTENTE} />,
    );

    await act(async () => {
      fireEvent.press(getByTestId('btn-salvar-servico'));
    });

    expect(spyAlert).toHaveBeenCalledWith('Erro', 'Já existe um serviço ATIVO com este nome nesta clínica.');
    expect(onClose).not.toHaveBeenCalled();
    spyAlert.mockRestore();
  });
});

describe('ServicoPrecoFormModal — fechar', () => {
  it('botão de fechar chama onClose', () => {
    const onClose = jest.fn();
    const { getByTestId } = wrap(
      <ServicoPrecoFormModal visible onClose={onClose} servico={null} />,
    );
    fireEvent.press(getByTestId('btn-fechar-form-servico'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
