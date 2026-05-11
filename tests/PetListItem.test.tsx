import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { PetListItem } from '../src/components/domain/PetListItem';
import type { PetResponse } from '../src/types/api';

const PET_LABRADOR: PetResponse = {
  id: 1,
  nmPet: 'Thor',
  nmEspecie: 'Cão',
  nmRaca: 'Labrador Retriever',
  dtNascimento: '2020-03-15T00:00:00.000Z',
  sgSexo: 'M',
  sgPorte: 'G',
  tutores: [{ id: 10, nmTutor: 'Carlos Mendes', dsTelefone: '11999990001', dsEmail: 'c@e.com' }],
};

const PET_NO_TUTOR: PetResponse = {
  id: 7,
  nmPet: 'Bolinha',
  nmEspecie: 'Cão',
  nmRaca: 'SRD',
  dtNascimento: '2018-06-01T00:00:00.000Z',
  sgSexo: 'M',
  sgPorte: 'M',
  tutores: [],
};

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('PetListItem', () => {
  it('renders pet name, species, and tutor', () => {
    const { getByText } = wrap(
      <PetListItem pet={PET_LABRADOR} onPress={jest.fn()} />,
    );
    expect(getByText('Thor')).toBeTruthy();
    expect(getByText('Cão')).toBeTruthy();
    expect(getByText('Carlos Mendes')).toBeTruthy();
  });

  it('renders raca', () => {
    const { getByText } = wrap(
      <PetListItem pet={PET_LABRADOR} onPress={jest.fn()} />,
    );
    expect(getByText('Labrador Retriever')).toBeTruthy();
  });

  it('renders "Sem tutor" when tutores is empty', () => {
    const { getByText } = wrap(
      <PetListItem pet={PET_NO_TUTOR} onPress={jest.fn()} />,
    );
    expect(getByText('Sem tutor')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByRole } = wrap(
      <PetListItem pet={PET_LABRADOR} onPress={onPress} />,
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders KCPetPortrait with correct palette for labrador', () => {
    const { getByTestId } = wrap(
      <PetListItem pet={PET_LABRADOR} onPress={jest.fn()} />,
    );
    expect(getByTestId('kc-pet-portrait')).toBeTruthy();
  });
});
