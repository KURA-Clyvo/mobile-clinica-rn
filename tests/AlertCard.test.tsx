import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { AlertCard } from '../src/components/domain/AlertCard';
import type { AlertaResponse } from '../src/types/api';

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

const BASE_ALERTA: AlertaResponse = {
  id: 1,
  dsTipoAlerta: 'VACINA_VENCIDA',
  dsMensagem: 'Vacina antirrábica de Mel venceu há 5 dias',
  idPet: 3,
  nmPet: 'Mel',
  dtCriacao: new Date('2026-05-07T10:00:00').toISOString(),
};

describe('AlertCard', () => {
  it('renders the alert message', () => {
    const { getByTestId } = wrap(<AlertCard alerta={BASE_ALERTA} />);
    expect(getByTestId('alert-message').props.children).toBe(BASE_ALERTA.dsMensagem);
  });

  it('renders pet name when provided', () => {
    const { getByTestId } = wrap(<AlertCard alerta={BASE_ALERTA} />);
    expect(getByTestId('alert-pet-name').props.children).toBe('Mel');
  });

  it('renders without crash for EXAME_CRITICO type', () => {
    const alerta: AlertaResponse = {
      ...BASE_ALERTA,
      dsTipoAlerta: 'EXAME_CRITICO',
      dsMensagem: 'Resultado de hemograma requer atenção',
    };
    const { getByTestId } = wrap(<AlertCard alerta={alerta} />);
    expect(getByTestId('alert-message')).toBeTruthy();
  });

  it('renders without crash for RETORNO_PENDENTE type', () => {
    const alerta: AlertaResponse = {
      ...BASE_ALERTA,
      dsTipoAlerta: 'RETORNO_PENDENTE',
      dsMensagem: 'Retorno pós-cirúrgico pendente',
    };
    const { getByTestId } = wrap(<AlertCard alerta={alerta} />);
    expect(getByTestId('alert-message')).toBeTruthy();
  });

  it('renders IOT_TEMPERATURA without pet name using chip label', () => {
    const alerta: AlertaResponse = {
      id: 4,
      dsTipoAlerta: 'IOT_TEMPERATURA',
      dsMensagem: 'Temperatura acima do limite (26°C)',
      dtCriacao: new Date().toISOString(),
    };
    const { getByTestId, queryByTestId, getByText } = wrap(<AlertCard alerta={alerta} />);
    expect(queryByTestId('alert-pet-name')).toBeNull();
    expect(getByTestId('alert-message')).toBeTruthy();
    expect(getByText('IoT')).toBeTruthy();
  });

  it('renders formatted time from dtCriacao', () => {
    const alerta: AlertaResponse = {
      ...BASE_ALERTA,
      dtCriacao: new Date('2026-05-07T14:30:00').toISOString(),
    };
    const { getByText } = wrap(<AlertCard alerta={alerta} />);
    expect(getByText('14:30')).toBeTruthy();
  });
});
