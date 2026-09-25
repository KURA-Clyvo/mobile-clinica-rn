// FT-07, fix wave G2 (m-1). A tela `pacientes/[id].tsx` traduz erro de
// upload em mensagem humana (400/413/genérica) e decide se oferece câmera
// (nunca na web) — nenhum dos dois tinha teste antes desta fix wave (g2-
// ft07.md, M8: mutações J e K sobreviviam, `EXIT=0`, `1151/1151`).
//   J — trocar `apiError.status === 413` por `=== 999` (a mensagem de 413
//       nunca aparece, mesmo com status 413 real)
//   K — trocar `Platform.OS === 'web'` por `=== 'nenhum'` (câmera oferecida
//       na web, que não tem fluxo de câmera nativo confiável)
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Platform, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ThemeProvider } from '../src/theme';
import PatientDetailScreen from '../src/app/(app)/pacientes/[id]';
import { useAuthStore } from '../src/store/authStore';
import type { PetResponse, TimelineEventResponse } from '../src/types/api';

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ id: '1' })),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock('react-native-safe-area-context', () => {
  const ReactLocal = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, style }: { children: React.ReactNode; style?: unknown }) =>
      ReactLocal.createElement(View, { style }, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const mockUseWindowDimensions = jest.fn(() => ({ width: 400, height: 800, scale: 1, fontScale: 1 }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockUseWindowDimensions(),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));

// Mesmo achado documentado em tests/PatientDetailScreen.test.tsx: sem mockar
// useUploadFotoPet aqui, a tela quebra com "useUploadFotoPet is not a
// function" em todo teste.
jest.mock('@hooks/usePetDetail', () => ({ usePetDetail: jest.fn(), useUploadFotoPet: jest.fn() }));
jest.mock('@hooks/usePetTimeline', () => ({ usePetTimeline: jest.fn() }));

import { usePetDetail, useUploadFotoPet } from '../src/hooks/usePetDetail';
import { usePetTimeline } from '../src/hooks/usePetTimeline';

const mockUsePetDetail = usePetDetail as jest.Mock;
const mockUseUploadFotoPet = useUploadFotoPet as jest.Mock;
const mockUsePetTimeline = usePetTimeline as jest.Mock;
const mockRequestMediaLibraryPermissions = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
const mockRequestCameraPermissions = ImagePicker.requestCameraPermissionsAsync as jest.Mock;
const mockLaunchImageLibrary = ImagePicker.launchImageLibraryAsync as jest.Mock;
const mockLaunchCamera = ImagePicker.launchCameraAsync as jest.Mock;

const MOCK_PET: PetResponse = {
  id: 1,
  nmPet: 'Thor',
  nmEspecie: 'Cão',
  nmRaca: 'Labrador Retriever',
  dtNascimento: '2020-03-15T00:00:00.000Z',
  sgSexo: 'M',
  sgPorte: 'G',
  tutores: [{ id: 10, nmTutor: 'Carlos Mendes', dsTelefone: '11999990001', dsEmail: 'carlos@e.com' }],
};

const MOCK_EVENTS: TimelineEventResponse[] = [];

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

const MOCK_VET_LOGADO = {
  id: 7,
  nmVeterinario: 'Dra. Ana Souza',
  nrCRMV: 'SP-99999',
  dsEmail: 'ana@kuraclinica.com.br',
};

function logarComoVeterinario() {
  useAuthStore.setState({
    token: 'tok',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    email: MOCK_VET_LOGADO.dsEmail,
    tpPerfil: 'VETERINARIO',
    usuario: MOCK_VET_LOGADO,
  });
}

const plataformaOriginal = Platform.OS;

function setPlatform(os: 'web' | 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

beforeEach(() => {
  jest.clearAllMocks();
  logarComoVeterinario();
  mockUseWindowDimensions.mockReturnValue({ width: 400, height: 800, scale: 1, fontScale: 1 });
  mockUsePetDetail.mockReturnValue({ data: MOCK_PET, isLoading: false, isError: false });
  mockUsePetTimeline.mockReturnValue({ data: MOCK_EVENTS, isLoading: false });
  mockRequestMediaLibraryPermissions.mockResolvedValue({ granted: true });
  mockRequestCameraPermissions.mockResolvedValue({ granted: true });
  mockLaunchImageLibrary.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'picker://foto.jpg', width: 800, height: 600 }],
  });
  mockLaunchCamera.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'camera://foto.jpg', width: 800, height: 600 }],
  });
});

afterEach(() => {
  Object.defineProperty(Platform, 'OS', { value: plataformaOriginal, configurable: true });
});

// Cria um mock de useUploadFotoPet cujo `mutate` chama onError com o `status`
// dado — simula a mutation rejeitando exatamente como um erro real do
// apiClient chegaria em `enviarFoto` (errors.ts normaliza para `ApiError`
// com `.status` numérico).
function mockUploadFalhandoCom(status: number | undefined) {
  const mutate = jest.fn(
    (_vars: unknown, opts?: { onError?: (erro: unknown) => void }) => {
      opts?.onError?.({ status });
    },
  );
  mockUseUploadFotoPet.mockReturnValue({ mutate, isPending: false });
  return mutate;
}

describe('PatientDetailScreen — mensagem de erro do upload de foto (m-1, fix wave G2)', () => {
  it('MORDIDA J — 413 mostra "imagem grande demais", não a mensagem genérica nem a de 400', async () => {
    setPlatform('web');
    mockUploadFalhandoCom(413);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { getByTestId } = wrap(<PatientDetailScreen />);

    await act(async () => {
      fireEvent.press(getByTestId('btn-foto'));
    });

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('', 'Essa imagem é grande demais. Tente uma foto menor.'),
    );
  });

  it('400 mostra "não foi possível processar essa imagem"', async () => {
    setPlatform('web');
    mockUploadFalhandoCom(400);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { getByTestId } = wrap(<PatientDetailScreen />);

    await act(async () => {
      fireEvent.press(getByTestId('btn-foto'));
    });

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        '',
        'Não foi possível processar essa imagem. Tente outra foto.',
      ),
    );
  });

  it('status desconhecido (nem 400 nem 413) mostra a mensagem genérica', async () => {
    setPlatform('web');
    mockUploadFalhandoCom(500);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { getByTestId } = wrap(<PatientDetailScreen />);

    await act(async () => {
      fireEvent.press(getByTestId('btn-foto'));
    });

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('', 'Não foi possível enviar a foto. Tente novamente.'),
    );
  });

  it('sucesso mostra "Foto atualizada com sucesso."', async () => {
    setPlatform('web');
    const mutate = jest.fn(
      (_vars: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.(),
    );
    mockUseUploadFotoPet.mockReturnValue({ mutate, isPending: false });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { getByTestId } = wrap(<PatientDetailScreen />);

    await act(async () => {
      fireEvent.press(getByTestId('btn-foto'));
    });

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('', 'Foto atualizada com sucesso.'));
  });
});

describe('PatientDetailScreen — câmera nunca oferecida na web (m-1, fix wave G2)', () => {
  it('MORDIDA K — na WEB, tocar em "Foto" vai direto pra galeria, SEM mostrar Alert com opção de Câmera', async () => {
    setPlatform('web');
    mockUploadFalhandoCom(undefined);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { getByTestId } = wrap(<PatientDetailScreen />);

    await act(async () => {
      fireEvent.press(getByTestId('btn-foto'));
    });

    // Nenhum Alert.alert de ESCOLHA é mostrado na web — a única chamada
    // possível é a de RESULTADO do upload (que aqui nem chega a acontecer
    // antes desta asserção, porque queremos capturar o instante da escolha).
    // Verificação direta: a galeria foi acionada sem nenhum diálogo prévio.
    await waitFor(() => expect(mockRequestMediaLibraryPermissions).toHaveBeenCalled());
    const chamadasDeEscolha = alertSpy.mock.calls.filter(
      (chamada) => chamada[0] === 'Foto do pet',
    );
    expect(chamadasDeEscolha).toHaveLength(0);
    expect(mockLaunchCamera).not.toHaveBeenCalled();
  });

  it('controle positivo — no NATIVO, tocar em "Foto" mostra Alert com Galeria/Câmera/Cancelar', async () => {
    setPlatform('ios');
    mockUploadFalhandoCom(undefined);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { getByTestId } = wrap(<PatientDetailScreen />);

    fireEvent.press(getByTestId('btn-foto'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Foto do pet',
      'Escolha a origem da imagem',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Galeria' }),
        expect.objectContaining({ text: 'Câmera' }),
        expect.objectContaining({ text: 'Cancelar' }),
      ]),
    );
  });
});
