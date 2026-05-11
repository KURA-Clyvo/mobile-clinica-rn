import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { TimelineItem } from '../src/components/domain/TimelineItem';
import type { TimelineEventResponse } from '../src/types/api';

const BASE_DATE = new Date(Date.now() - 2 * 86400000).toISOString();

function makeEvento(nmTipo: TimelineEventResponse['nmTipo'], extras?: Partial<TimelineEventResponse>): TimelineEventResponse {
  return {
    idEventoClinico: 1,
    nmTipo,
    dtEvento: BASE_DATE,
    dsObservacao: 'Observação de teste longa que pode ser truncada em duas linhas quando não está expandida.',
    nmVeterinario: 'Dr. Felipe Ferrete',
    ...extras,
  };
}

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('TimelineItem — tipos', () => {
  const TIPOS: TimelineEventResponse['nmTipo'][] = [
    'CONSULTA', 'VACINA', 'PRESCRICAO', 'EXAME', 'TELEORIENTACAO',
  ];

  it.each(TIPOS)('renders correctly for tipo %s', (nmTipo) => {
    const { getByTestId } = wrap(
      <TimelineItem evento={makeEvento(nmTipo)} />,
    );
    expect(getByTestId(`timeline-item-1`)).toBeTruthy();
  });
});

describe('TimelineItem — linha vertical', () => {
  it('shows vertical line when isLast=false (default)', () => {
    const { getByTestId } = wrap(
      <TimelineItem evento={makeEvento('CONSULTA')} isLast={false} />,
    );
    expect(getByTestId('timeline-line')).toBeTruthy();
  });

  it('hides vertical line when isLast=true', () => {
    const { queryByTestId } = wrap(
      <TimelineItem evento={makeEvento('CONSULTA')} isLast={true} />,
    );
    expect(queryByTestId('timeline-line')).toBeNull();
  });
});

describe('TimelineItem — expand/collapse', () => {
  it('text is collapsed by default (numberOfLines=2)', () => {
    const { getByTestId } = wrap(
      <TimelineItem evento={makeEvento('CONSULTA')} />,
    );
    const text = getByTestId('observacao-text');
    expect(text.props.numberOfLines).toBe(2);
  });

  it('expands on "Ver mais" press', () => {
    const { getByTestId, getByText } = wrap(
      <TimelineItem evento={makeEvento('CONSULTA')} />,
    );
    expect(getByText('Ver mais')).toBeTruthy();
    fireEvent.press(getByTestId('expand-toggle'));
    expect(getByText('Ver menos')).toBeTruthy();
    const text = getByTestId('observacao-text');
    expect(text.props.numberOfLines).toBeUndefined();
  });

  it('collapses on "Ver menos" press', () => {
    const { getByTestId, getByText } = wrap(
      <TimelineItem evento={makeEvento('CONSULTA')} />,
    );
    fireEvent.press(getByTestId('expand-toggle'));
    expect(getByText('Ver menos')).toBeTruthy();
    fireEvent.press(getByTestId('expand-toggle'));
    expect(getByText('Ver mais')).toBeTruthy();
  });
});

describe('TimelineItem — veterinario', () => {
  it('shows vet name when nmVeterinario is present', () => {
    const { getByTestId, getByText } = wrap(
      <TimelineItem evento={makeEvento('CONSULTA', { nmVeterinario: 'Dr. Ana Lima' })} />,
    );
    expect(getByTestId('vet-row')).toBeTruthy();
    expect(getByText('Dr. Ana Lima')).toBeTruthy();
  });

  it('hides vet row when nmVeterinario is absent', () => {
    const { queryByTestId } = wrap(
      <TimelineItem evento={makeEvento('CONSULTA', { nmVeterinario: undefined })} />,
    );
    expect(queryByTestId('vet-row')).toBeNull();
  });
});
