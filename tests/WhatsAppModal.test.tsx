import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ThemeProvider } from '../src/theme';
import { WhatsAppModal } from '../src/components/domain/WhatsAppModal';

const mockMutate = jest.fn();
const mockOnClose = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@hooks/useEventosClinicos', () => ({
  useEnviarWhatsApp: jest.fn(),
}));

import { useEnviarWhatsApp } from '../src/hooks/useEventosClinicos';

const mockUseEnviarWhatsApp = useEnviarWhatsApp as jest.Mock;

const BASE_PROPS = {
  visible: true,
  onClose: mockOnClose,
  nmPet: 'Thor',
  nmTutor: 'Carlos Mendes',
  dsTelefone: '11999990001',
};

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseEnviarWhatsApp.mockReturnValue({ mutate: mockMutate, isPending: false });
});

describe('WhatsAppModal', () => {
  it('does not render content when visible=false', () => {
    const { queryByTestId } = wrap(<WhatsAppModal {...BASE_PROPS} visible={false} />);
    expect(queryByTestId('message-input')).toBeNull();
  });

  it('renders tutor name and pet name', () => {
    const { getByTestId } = wrap(<WhatsAppModal {...BASE_PROPS} />);
    expect(getByTestId('recipient-tutor').props.children).toBe('Carlos Mendes');
    expect(getByTestId('recipient-pet').props.children).toBe('Thor');
  });

  it('pre-fills message with default template when no mensagemDefault given', () => {
    const { getByTestId } = wrap(<WhatsAppModal {...BASE_PROPS} />);
    const input = getByTestId('message-input');
    expect(input.props.value).toContain('Carlos Mendes');
    expect(input.props.value).toContain('Thor');
  });

  it('pre-fills message with mensagemDefault when provided', () => {
    const { getByTestId } = wrap(
      <WhatsAppModal {...BASE_PROPS} mensagemDefault="Mensagem customizada" />,
    );
    expect(getByTestId('message-input').props.value).toBe('Mensagem customizada');
  });

  it('updates char count as user types', () => {
    const { getByTestId } = wrap(
      <WhatsAppModal {...BASE_PROPS} mensagemDefault="" />,
    );
    fireEvent.changeText(getByTestId('message-input'), 'Hello');
    expect(getByTestId('char-count').props.children).toBe('5/500');
  });

  it('does not send when message is empty (button disabled)', () => {
    const { getByTestId } = wrap(
      <WhatsAppModal {...BASE_PROPS} mensagemDefault="" />,
    );
    fireEvent.changeText(getByTestId('message-input'), '');
    fireEvent.press(getByTestId('btn-enviar-whatsapp'));
    expect(mockMutate).not.toHaveBeenCalled();
  });

  // E16 (LU-09) — mordida: o corpo real da Luna é {para, mensagem}, não
  // {telefone, tipo} (contrato antigo, nunca declarado por whatsapp.py). Prova de
  // mordida no relatório da task: revertendo o corpo desta chamada para
  // {telefone: dsTelefone, mensagem, tipo: undefined} este teste falha nominalmente
  // (toHaveBeenCalledWith não bate); com {para, mensagem} ele passa.
  it('calls enviarWhatsApp with {para, mensagem} matching the real Luna contract (E16)', () => {
    const { getByTestId } = wrap(
      <WhatsAppModal {...BASE_PROPS} mensagemDefault="Mensagem de teste" />,
    );
    fireEvent.press(getByTestId('btn-enviar-whatsapp'));
    expect(mockMutate).toHaveBeenCalledWith(
      { para: '11999990001', mensagem: 'Mensagem de teste' },
      expect.any(Object),
    );
    const corpoEnviado = mockMutate.mock.calls[0][0] as Record<string, unknown>;
    expect('telefone' in corpoEnviado).toBe(false);
    expect('tipo' in corpoEnviado).toBe(false);
  });

  it('calls onClose after successful send', () => {
    mockMutate.mockImplementation(
      (_req: unknown, { onSuccess }: { onSuccess: (r: { status: string }) => void }) =>
        onSuccess({ status: 'enviado' }),
    );
    const { getByTestId } = wrap(
      <WhatsAppModal {...BASE_PROPS} mensagemDefault="Mensagem" />,
    );
    fireEvent.press(getByTestId('btn-enviar-whatsapp'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows a degraded alert and does not close when Luna is offline (status indisponivel)', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    mockMutate.mockImplementation(
      (_req: unknown, { onSuccess }: { onSuccess: (r: { status: string }) => void }) =>
        onSuccess({ status: 'indisponivel' }),
    );
    const { getByTestId } = wrap(
      <WhatsAppModal {...BASE_PROPS} mensagemDefault="Mensagem" />,
    );
    fireEvent.press(getByTestId('btn-enviar-whatsapp'));
    expect(alertSpy).toHaveBeenCalledWith('Luna indisponível', expect.any(String));
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  // LU-09 fix wave 1 (item 3, lu-09-revisao.md G2-4): quando o service DISTINGUE a
  // falha real de envio (502, `result.motivo` presente — a Luna está de pé, o Twilio
  // rejeitou o envio), o título NÃO pode dizer "Luna indisponível" — mordida: revertendo
  // o `else if (result.motivo)` para o `else` único antigo, este teste falha nominalmente
  // (título volta a ser "Luna indisponível" mesmo com motivo presente).
  it('shows a distinct, honest title for a real send failure (502, motivo present) — does NOT say "Luna indisponível"', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    mockMutate.mockImplementation(
      (_req: unknown, { onSuccess }: { onSuccess: (r: { status: string; motivo?: string }) => void }) =>
        onSuccess({
          status: 'indisponivel',
          motivo: 'A Luna não conseguiu enviar a mensagem agora (falha no envio pelo WhatsApp).',
        }),
    );
    const { getByTestId } = wrap(
      <WhatsAppModal {...BASE_PROPS} mensagemDefault="Mensagem" />,
    );
    fireEvent.press(getByTestId('btn-enviar-whatsapp'));
    expect(alertSpy).toHaveBeenCalledWith(
      'Falha ao enviar mensagem',
      'A Luna não conseguiu enviar a mensagem agora (falha no envio pelo WhatsApp).',
    );
    const tituloUsado = alertSpy.mock.calls[0]![0];
    expect(tituloUsado).not.toBe('Luna indisponível');
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('calls onClose when close button is pressed', () => {
    const { getByTestId } = wrap(<WhatsAppModal {...BASE_PROPS} />);
    fireEvent.press(getByTestId('btn-fechar-whatsapp'));
    expect(mockOnClose).toHaveBeenCalled();
  });
});
