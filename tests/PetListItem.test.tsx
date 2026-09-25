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

  // FT-08 (regra A5 do backlog): a LISTA usa a thumb (256), nunca a 1080.
  it('passa dsFotoThumbUrl (256) para o portrait — mordida: trocar por dsFotoUrl faz esta asserção falhar', () => {
    const FOTO_256 = 'https://kura-clinica.vercel.app/proxy/clinica/api/v1/fotos/clinica/1/pet/1/uuid_256.webp?exp=1&sig=b';
    const FOTO_1080 = 'https://kura-clinica.vercel.app/proxy/clinica/api/v1/fotos/clinica/1/pet/1/uuid_1080.webp?exp=1&sig=a';
    const petComFoto: PetResponse = { ...PET_LABRADOR, dsFotoUrl: FOTO_1080, dsFotoThumbUrl: FOTO_256 };
    const { getByTestId } = wrap(<PetListItem pet={petComFoto} onPress={jest.fn()} />);
    const foto = getByTestId('kc-pet-portrait-foto');
    expect(foto.props.source).toEqual([{ uri: FOTO_256 }]);
  });

  it('sem foto, continua mostrando a ilustração (sem regressão)', () => {
    const { queryByTestId } = wrap(<PetListItem pet={PET_LABRADOR} onPress={jest.fn()} />);
    expect(queryByTestId('kc-pet-portrait-foto')).toBeNull();
  });
});
