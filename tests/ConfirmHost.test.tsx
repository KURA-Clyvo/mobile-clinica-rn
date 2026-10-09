import React from 'react';
import { Modal, Platform, Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { ConfirmHost } from '../src/components/feedback/ConfirmHost';
import { ToastProvider, useToast } from '../src/components/feedback/Toast';
import { avisar, confirmar, escolher } from '../src/components/feedback/confirmar';

function montar(ui: React.ReactNode = null) {
  return render(
    <ThemeProvider>
      <ToastProvider>
        {ui}
        <ConfirmHost />
      </ToastProvider>
    </ThemeProvider>,
  );
}

describe('confirmar() sem host montado', () => {
  it('falha segura: resolve false (a ação decisória NÃO acontece) e avisar resolve', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(confirmar({ titulo: 'x', verbo: 'Sim' })).resolves.toBe(false);
    await expect(avisar({ titulo: 'x' })).resolves.toBeUndefined();
    await expect(escolher({ titulo: 'x', opcoes: [] })).resolves.toBeNull();
  });
});

describe('ConfirmHost', () => {
  it('mostra título, mensagem e o VERBO da ação; confirmar resolve true', async () => {
    const { getByText, getByTestId, queryByTestId } = montar();
    let r: Promise<boolean>;
    act(() => {
      r = confirmar({ titulo: 'Desativar serviço?', mensagem: 'Some da tabela.', verbo: 'Desativar' });
    });
    await waitFor(() => getByTestId('confirm-dialog'));
    expect(getByText('Desativar serviço?')).toBeTruthy();
    expect(getByText('Some da tabela.')).toBeTruthy();
    expect(getByText('Desativar')).toBeTruthy();
    expect(getByText('Cancelar')).toBeTruthy();
    expect(getByTestId('confirm-dialog').props.accessibilityRole).toBe('alertdialog');
    await act(async () => {
      fireEvent.press(getByTestId('confirm-ok'));
    });
    await expect(r!).resolves.toBe(true);
    expect(queryByTestId('confirm-dialog')).toBeNull();
  });

  it('Cancelar resolve false', async () => {
    const { getByTestId } = montar();
    let r: Promise<boolean>;
    act(() => {
      r = confirmar({ titulo: 'Sair?', verbo: 'Sair', destrutivo: true });
    });
    await waitFor(() => getByTestId('confirm-dialog'));
    await act(async () => {
      fireEvent.press(getByTestId('confirm-cancelar'));
    });
    await expect(r!).resolves.toBe(false);
  });

  it('destrutivo usa o botão danger (texto na cor danger); não destrutivo, não', async () => {
    const { getByTestId, getByText } = montar();
    const cor = (n: string) => {
      const estilo = getByText(n).props.style as unknown;
      const lista = ([] as unknown[]).concat(estilo).flat(5) as { color?: string }[];
      return lista.find((s) => s && s.color)?.color;
    };
    act(() => void confirmar({ titulo: 'a', verbo: 'Apagar', destrutivo: true }));
    await waitFor(() => getByTestId('confirm-ok'));
    const dangerCor = cor('Apagar');
    expect(dangerCor).toBeDefined();
    await act(async () => {
      fireEvent.press(getByTestId('confirm-cancelar'));
    });
    act(() => void confirmar({ titulo: 'b', verbo: 'Salvar' }));
    await waitFor(() => getByTestId('confirm-ok'));
    expect(cor('Salvar')).not.toBe(dangerCor);
  });

  it('avisar mostra "Entendi" e resolve', async () => {
    const { getByTestId, getByText } = montar();
    let r: Promise<void>;
    act(() => {
      r = avisar({ titulo: 'Erro', mensagem: 'Falhou.' });
    });
    await waitFor(() => getByTestId('confirm-dialog'));
    expect(getByText('Falhou.')).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByTestId('confirm-ok'));
    });
    await expect(r!).resolves.toBeUndefined();
  });

  it('pedidos simultâneos entram em fila, na ordem', async () => {
    const { getByTestId, getByText } = montar();
    let r1: Promise<boolean>;
    let r2: Promise<boolean>;
    act(() => {
      r1 = confirmar({ titulo: 'Primeiro', verbo: 'Ok' });
      r2 = confirmar({ titulo: 'Segundo', verbo: 'Ok' });
    });
    await waitFor(() => getByText('Primeiro'));
    await act(async () => {
      fireEvent.press(getByTestId('confirm-ok'));
    });
    await expect(r1!).resolves.toBe(true);
    await waitFor(() => getByText('Segundo'));
    await act(async () => {
      fireEvent.press(getByTestId('confirm-cancelar'));
    });
    await expect(r2!).resolves.toBe(false);
  });

  // M-4: o Esc do web é tratado SÓ pelo `onRequestClose` do Modal (o RNW chama no keyup).
  // Um listener próprio de keydown cancelaria 2 pedidos da fila com um único Esc.
  it('Esc/voltar (onRequestClose) cancela só o pedido do topo; o seguinte continua na tela', async () => {
    const { getByTestId, getByText, UNSAFE_getByType } = montar();
    let r1: Promise<boolean>;
    let r2: Promise<boolean>;
    act(() => {
      r1 = confirmar({ titulo: 'Primeiro?', verbo: 'Sim' });
      r2 = confirmar({ titulo: 'Segundo?', verbo: 'Sim' });
    });
    await waitFor(() => getByTestId('confirm-dialog'));
    expect(getByText('Primeiro?')).toBeTruthy();
    await act(async () => {
      UNSAFE_getByType(Modal).props.onRequestClose();
    });
    await expect(r1!).resolves.toBe(false);
    expect(getByText('Segundo?')).toBeTruthy(); // não foi cancelado junto
    let r2Resolvido = false;
    void r2!.then(() => {
      r2Resolvido = true;
    });
    await act(async () => undefined);
    expect(r2Resolvido).toBe(false);
  });

  it('web: o host NÃO registra listener próprio de teclado (evita Esc em dobro)', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const add = jest.fn();
    (globalThis as unknown as { document: unknown }).document = {
      addEventListener: add,
      removeEventListener: () => undefined,
    };
    const { getByTestId } = montar();
    act(() => {
      void confirmar({ titulo: 'Sair?', verbo: 'Sair' });
    });
    await waitFor(() => getByTestId('confirm-dialog'));
    expect(add).not.toHaveBeenCalled();
    delete (globalThis as unknown as { document?: unknown }).document;
  });

  // M-3: alertdialog (WAI-ARIA APG) — foco inicial no menos destrutivo (Cancelar) e nenhum
  // elemento sem nome na ordem de Tab. O RNW foca o 1º focável do Modal: o scrim não pode ser.
  it('foco inicial no Cancelar: scrim fora da ordem de foco e do leitor de tela; Cancelar vem antes do OK', async () => {
    const { getByTestId } = montar();
    act(() => {
      void confirmar({ titulo: 'Sair?', verbo: 'Sair', destrutivo: true });
    });
    await waitFor(() => getByTestId('confirm-dialog'));
    const scrim = getByTestId('confirm-scrim');
    expect(scrim.props.focusable).toBe(false);
    expect(scrim.props.accessible).toBe(false);
    expect(scrim.props.importantForAccessibility).toBe('no');
    const ordem = getByTestId('confirm-dialog')
      .findAll((n) => typeof n.props.testID === 'string' && /^confirm-(cancelar|ok)$/.test(n.props.testID))
      .map((n) => n.props.testID as string);
    expect([...new Set(ordem)]).toEqual(['confirm-cancelar', 'confirm-ok']);
  });

  it('rotuloCancelar troca o texto do botão de recusa (canvas: "Continuar conectado")', async () => {
    const { getByTestId, getByText, queryByText } = montar();
    act(() => {
      void confirmar({ titulo: 'Sair da conta?', verbo: 'Sair da conta', rotuloCancelar: 'Continuar conectado' });
    });
    await waitFor(() => getByTestId('confirm-dialog'));
    expect(getByText('Continuar conectado')).toBeTruthy();
    expect(queryByText('Cancelar')).toBeNull();
  });
});

describe('Toast', () => {
  afterEach(() => jest.useRealTimers());

  function Disparador() {
    const toast = useToast();
    return (
      <Text testID="go" onPress={() => toast.show({ tipo: 'sucesso', texto: 'Serviço desativado' })}>
        go
      </Text>
    );
  }

  it('aparece com o texto, live region polite, e some sozinho em ~4s', () => {
    jest.useFakeTimers();
    const { getByTestId, queryByTestId, getByText } = montar(<Disparador />);
    act(() => {
      fireEvent.press(getByTestId('go'));
    });
    expect(getByText('Serviço desativado')).toBeTruthy();
    expect(getByTestId('toast').props.accessibilityLiveRegion).toBe('polite');
    act(() => {
      jest.advanceTimersByTime(3900);
    });
    expect(queryByTestId('toast')).not.toBeNull();
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(queryByTestId('toast')).toBeNull();
  });
});
