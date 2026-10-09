// FT-07, fix wave G2 (m-1). A tela `pacientes/[id].tsx` traduz erro de
// upload em mensagem humana (400/413/genérica) e decide se oferece câmera
// (nunca na web) — nenhum dos dois tinha teste antes desta fix wave (g2-
// ft07.md, M8: mutações J e K sobreviviam, `EXIT=0`, `1151/1151`).
//   J — trocar `apiError.status === 413` por `=== 999` (a mensagem de 413
//       nunca aparece, mesmo com status 413 real)
//   K — trocar `Platform.OS === 'web'` por `=== 'nenhum'` (câmera oferecida
//       na web, que não tem fluxo de câmera nativo confiável)
import React from 'react';
import { simularFeedback } from './helpers_feedback';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Platform } from 'react-native';
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
  tutores: [{ idTutor: 10, nmTutor: 'Carlos Mendes', dsVinculo: 'PROPRIETARIO', stPrincipal: true }],
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

let fb: ReturnType<typeof simularFeedback>;
beforeEach(() => {
  fb = simularFeedback();
});
afterEach(() => fb.dispose());

describe('PatientDetailScreen — mensagem de erro do upload de foto (m-1, fix wave G2)', () => {
  it('MORDIDA J — 413 mostra "imagem grande demais", não a mensagem genérica nem a de 400', async () => {
    setPlatform('web');
    mockUploadFalhandoCom(413);
    const { getByTestId } = wrap(<PatientDetailScreen />);

    await act(async () => {
      fireEvent.press(getByTestId('btn-foto'));
    });

    await waitFor(() =>
      expect(fb.avisos).toContainEqual({
        titulo: 'Foto do pet',
        mensagem: 'Essa imagem é grande demais. Tente uma foto menor.',
      }),
    );
  });

  it('400 mostra "não foi possível processar essa imagem"', async () => {
    setPlatform('web');
    mockUploadFalhandoCom(400);
    const { getByTestId } = wrap(<PatientDetailScreen />);

    await act(async () => {
      fireEvent.press(getByTestId('btn-foto'));
    });

    await waitFor(() =>
      expect(fb.avisos).toContainEqual({
        titulo: 'Foto do pet',
        mensagem: 'Não foi possível processar essa imagem. Tente outra foto.',
      }),
    );
  });

  it('status desconhecido (nem 400 nem 413) mostra a mensagem genérica', async () => {
    setPlatform('web');
    mockUploadFalhandoCom(500);
    const { getByTestId } = wrap(<PatientDetailScreen />);

    await act(async () => {
      fireEvent.press(getByTestId('btn-foto'));
    });

    await waitFor(() =>
      expect(fb.avisos).toContainEqual({
        titulo: 'Foto do pet',
        mensagem: 'Não foi possível enviar a foto. Tente novamente.',
      }),
    );
  });

  it('sucesso mostra o toast "Foto atualizada"', async () => {
    setPlatform('web');
    const mutate = jest.fn(
      (_vars: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.(),
    );
    mockUseUploadFotoPet.mockReturnValue({ mutate, isPending: false });
    const { getByTestId } = wrap(<PatientDetailScreen />);

    await act(async () => {
      fireEvent.press(getByTestId('btn-foto'));
    });

    await waitFor(() =>
      expect(fb.toasts).toContainEqual({ tipo: 'sucesso', texto: 'Foto atualizada' }),
    );
  });
});

describe('PatientDetailScreen — câmera nunca oferecida na web (m-1, fix wave G2)', () => {
  it('MORDIDA K — na WEB, tocar em "Foto" vai direto pra galeria, SEM mostrar a escolha com opção de Câmera', async () => {
    setPlatform('web');
    mockUploadFalhandoCom(undefined);
    const { getByTestId } = wrap(<PatientDetailScreen />);

    await act(async () => {
      fireEvent.press(getByTestId('btn-foto'));
    });

    // Nenhuma ESCOLHA (escolher()) é mostrado na web — a única chamada
    // possível é a de RESULTADO do upload (que aqui nem chega a acontecer
    // antes desta asserção, porque queremos capturar o instante da escolha).
    // Verificação direta: a galeria foi acionada sem nenhum diálogo prévio.
    await waitFor(() => expect(mockRequestMediaLibraryPermissions).toHaveBeenCalled());
    expect(fb.escolhas).toHaveLength(0);
    expect(mockLaunchCamera).not.toHaveBeenCalled();
  });

  it('controle positivo — no NATIVO, tocar em "Foto" oferece Galeria/Câmera (e Cancelar do host)', async () => {
    setPlatform('ios');
    mockUploadFalhandoCom(undefined);
    const { getByTestId } = wrap(<PatientDetailScreen />);

    fireEvent.press(getByTestId('btn-foto'));

    await waitFor(() => expect(fb.escolhas).toHaveLength(1));
    expect(fb.escolhas[0]).toEqual({
      titulo: 'Foto do pet',
      mensagem: 'Escolha a origem da imagem',
      opcoes: [
        { id: 'galeria', rotulo: 'Galeria' },
        { id: 'camera', rotulo: 'Câmera' },
      ],
    });
  });

  it('no NATIVO, escolher "Câmera" abre a câmera e não a galeria', async () => {
    setPlatform('ios');
    mockUploadFalhandoCom(undefined);
    fb.responder({ escolher: 'camera' });
    const { getByTestId } = wrap(<PatientDetailScreen />);

    fireEvent.press(getByTestId('btn-foto'));

    await waitFor(() => expect(mockRequestCameraPermissions).toHaveBeenCalled());
    expect(mockRequestMediaLibraryPermissions).not.toHaveBeenCalled();
  });
});

// FT-08: o header do detalhe usa a variante 1080 (dsFotoUrl), nunca a thumb
// 256 (regra A5 do backlog — lista usa a thumb, detalhe usa a 1080).
describe('PatientDetailScreen — avatar com foto real (FT-08)', () => {
  const FOTO_1080 =
    'https://kura-clinica.vercel.app/proxy/clinica/api/v1/fotos/clinica/1/pet/1/uuid_1080.webp?exp=1&sig=a';
  const FOTO_256 =
    'https://kura-clinica.vercel.app/proxy/clinica/api/v1/fotos/clinica/1/pet/1/uuid_256.webp?exp=1&sig=b';

  it('passa a variante 1080 (dsFotoUrl) para o portrait do header — mordida: trocar por dsFotoThumbUrl faz esta asserção falhar', () => {
    mockUsePetDetail.mockReturnValue({
      data: { ...MOCK_PET, dsFotoUrl: FOTO_1080, dsFotoThumbUrl: FOTO_256 },
      isLoading: false,
      isError: false,
    });
    const { getByTestId } = wrap(<PatientDetailScreen />);
    const foto = getByTestId('kc-pet-portrait-foto');
    // `source` é normalizado em array pelo expo-image e carrega também
    // `cacheKey` (KCPetPortrait.test.tsx testa isso em detalhe) — aqui só
    // importa QUAL variante (1080 x 256) chegou no `uri`.
    expect(foto.props.source[0].uri).toBe(FOTO_1080);
  });

  it('sem foto, o header continua mostrando a ilustração (sem regressão da FT-07)', () => {
    mockUsePetDetail.mockReturnValue({ data: MOCK_PET, isLoading: false, isError: false });
    const { queryByTestId } = wrap(<PatientDetailScreen />);
    expect(queryByTestId('kc-pet-portrait-foto')).toBeNull();
  });
});
