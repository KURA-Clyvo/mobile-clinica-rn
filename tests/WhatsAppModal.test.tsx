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
  tipo: 'receituario' as const,
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

  it('calls enviarWhatsApp with {telefone, mensagem, tipo} matching the Luna contract', () => {
    const { getByTestId } = wrap(
      <WhatsAppModal {...BASE_PROPS} mensagemDefault="Mensagem de teste" />,
    );
    fireEvent.press(getByTestId('btn-enviar-whatsapp'));
    expect(mockMutate).toHaveBeenCalledWith(
      { telefone: '11999990001', mensagem: 'Mensagem de teste', tipo: 'receituario' },
      expect.any(Object),
    );
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

  it('calls onClose when close button is pressed', () => {
    const { getByTestId } = wrap(<WhatsAppModal {...BASE_PROPS} />);
    fireEvent.press(getByTestId('btn-fechar-whatsapp'));
    expect(mockOnClose).toHaveBeenCalled();
  });
});
