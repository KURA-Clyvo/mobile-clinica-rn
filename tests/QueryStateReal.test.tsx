// BR-CLI-T03 fix wave (M-2, M-3) — QueryState com React Query v5 REAL (não objeto à mão) e o
// retry do ErrorState `compacto`.
import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ThemeProvider } from '../src/theme';
import { QueryState } from '../src/components/feedback/QueryState';
import { ErrorState } from '../src/components/feedback/ErrorState';

const clientes: QueryClient[] = [];
function Tela({ fn, enabled = true, k }: { fn: () => Promise<string[]>; enabled?: boolean; k: string }) {
  const q = useQuery({ queryKey: [k], queryFn: fn, enabled, retry: false });
  return (
    <QueryState query={q} empty={<Text>VAZIO</Text>} errorTitle="ERRO">
      {(d) => <Text>{`ITENS:${d.join(',')}`}</Text>}
    </QueryState>
  );
}
function montar(el: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clientes.push(client);
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>{el}</ThemeProvider>
    </QueryClientProvider>,
  );
}
afterEach(() => clientes.splice(0).forEach((c) => c.clear()));

describe('QueryState x React Query real', () => {
  it('M-2: query desabilitada (enabled:false) não fica em skeleton eterno nem afirma vazio/erro', () => {
    const fn = jest.fn(async () => ['a']);
    const r = montar(<Tela fn={fn} enabled={false} k="m2" />);
    expect(r.queryAllByTestId('skeleton')).toHaveLength(0);
    expect(r.queryByText('VAZIO')).toBeNull();
    expect(r.queryByText('ERRO')).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it('controle: query habilitada mostra skeleton enquanto carrega e depois o conteúdo', async () => {
    let resolver: (v: string[]) => void = () => {};
    const fn = jest.fn(() => new Promise<string[]>((res) => (resolver = res)));
    const r = montar(<Tela fn={fn} k="m2c" />);
    expect(r.queryAllByTestId('skeleton').length).toBeGreaterThan(0);
    resolver(['x']);
    await waitFor(() => expect(r.getByText('ITENS:x')).toBeTruthy());
  });

  it('falha real => ErrorState; "Tentar de novo" refaz e mostra o conteúdo', async () => {
    let n = 0;
    const fn = jest.fn(async () => {
      n++;
      if (n === 1) throw new Error('rede');
      return ['b'];
    });
    const r = montar(<Tela fn={fn} k="err" />);
    await waitFor(() => expect(r.getByText('ERRO')).toBeTruthy());
    expect(r.queryByText('VAZIO')).toBeNull();
    fireEvent.press(r.getByTestId('error-state-retry'));
    await waitFor(() => expect(r.getByText('ITENS:b')).toBeTruthy());
  });
});

describe('ErrorState compacto', () => {
  it('M-3: "Tentar de novo" chama onRetry (a mutação onPress={() => {}} não sobrevive)', () => {
    const onRetry = jest.fn();
    const r = render(
      <ThemeProvider>
        <ErrorState compacto titulo="Falhou" onRetry={onRetry} testID="compacto" />
      </ThemeProvider>,
    );
    expect(r.getByText('Falhou.')).toBeTruthy();
    fireEvent.press(r.getByTestId('compacto-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
