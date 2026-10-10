import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { QueryState } from '../src/components/feedback/QueryState';
import { Skeleton } from '../src/components/feedback/Skeleton';
import { ErrorState } from '../src/components/feedback/ErrorState';
import { touchTarget } from '../src/theme/tokens';
import { StyleSheet } from 'react-native';

type Q<T> = { data: T | undefined; isLoading: boolean; isError: boolean; refetch: () => unknown };
const q = <T,>(o: Partial<Q<T>>): Q<T> => ({
  data: undefined,
  isLoading: false,
  isError: false,
  refetch: jest.fn(),
  ...o,
});

function montar(query: Q<string[]>, extra: { isEmpty?: (d: string[]) => boolean } = {}) {
  return render(
    <ThemeProvider>
      <QueryState query={query} empty={<Text>VAZIO-VERDADEIRO</Text>} errorTitle="Erro X" {...extra}>
        {(d) => <Text>{`ITENS:${d.join(',')}`}</Text>}
      </QueryState>
    </ThemeProvider>,
  );
}

describe('QueryState', () => {
  it('isLoading => skeleton, nunca vazio', () => {
    const { getAllByTestId, queryByText } = montar(q({ isLoading: true }));
    expect(getAllByTestId('skeleton').length).toBeGreaterThan(0);
    expect(queryByText('VAZIO-VERDADEIRO')).toBeNull();
  });

  it('isError sem dado => ErrorState com "Tentar de novo" que chama refetch; nunca a frase de vazio', () => {
    const refetch = jest.fn();
    const { getByText, queryByText, getByTestId } = montar(q({ isError: true, refetch }));
    expect(getByText('Erro X')).toBeTruthy();
    expect(queryByText('VAZIO-VERDADEIRO')).toBeNull();
    fireEvent.press(getByTestId('error-state-retry'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('dado vazio (array vazio, default) => empty', () => {
    const { getByText } = montar(q({ data: [] }));
    expect(getByText('VAZIO-VERDADEIRO')).toBeTruthy();
  });

  it('isEmpty customizado decide o vazio', () => {
    const { getByText } = montar(q({ data: ['a'] }), { isEmpty: () => true });
    expect(getByText('VAZIO-VERDADEIRO')).toBeTruthy();
  });

  it('dado => children(data), sem faixa', () => {
    const { getByText, queryByTestId } = montar(q({ data: ['a', 'b'] }));
    expect(getByText('ITENS:a,b')).toBeTruthy();
    expect(queryByTestId('query-state-salvos')).toBeNull();
  });

  it('cache + isError => children(data) + faixa "Mostrando dados salvos" com Tentar de novo, sem opacity', () => {
    const refetch = jest.fn();
    const { getByText, getByTestId, queryByText, toJSON } = montar(q({ data: ['a'], isError: true, refetch }));
    expect(getByText('ITENS:a')).toBeTruthy();
    expect(getByTestId('query-state-salvos')).toBeTruthy();
    expect(getByText(/Mostrando dados salvos/)).toBeTruthy();
    expect(queryByText('Erro X')).toBeNull();
    // nada esmaecido: nenhum opacity < 1 (o KCButton emite opacity:1 por si; isso não conta).
    expect(JSON.stringify(toJSON())).not.toMatch(/"opacity":0(\.\d+)?[,}]/);
    fireEvent.press(getByTestId('query-state-salvos-retry'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('Skeleton / ErrorState', () => {
  it('Skeleton: variantes e contagem', () => {
    const l = render(<ThemeProvider><Skeleton variant="list" count={3} /></ThemeProvider>);
    expect(l.getAllByTestId('skeleton')).toHaveLength(3);
    const c = render(<ThemeProvider><Skeleton variant="card" /></ThemeProvider>);
    expect(c.getAllByTestId('skeleton')).toHaveLength(1);
    const n = render(<ThemeProvider><Skeleton variant="line" count={2} /></ThemeProvider>);
    expect(n.getAllByTestId('skeleton')).toHaveLength(2);
  });

  it('ErrorState: texto não culpa a internet; botão >= 44px', () => {
    const { getByTestId, queryByText } = render(
      <ThemeProvider><ErrorState onRetry={() => undefined} /></ThemeProvider>,
    );
    expect(queryByText(/internet|conexão/i)).toBeNull();
    const h = StyleSheet.flatten(getByTestId('error-state-retry').props.style)?.height;
    expect(h).toBeGreaterThanOrEqual(touchTarget.min);
  });
});
