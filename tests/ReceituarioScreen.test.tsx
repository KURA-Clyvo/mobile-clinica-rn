import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import ReceituarioScreen from '../src/app/(app)/receituario/[idPet]';
import { useAuthStore } from '../src/store/authStore';
import { layout } from '../src/theme/tokens';

const mockBack = jest.fn();
const mockMutate = jest.fn();
const mockMutateGerarReceituario = jest.fn();
const mockMutateBaixarReceituario = jest.fn();

const MOCK_DOCUMENTO = {
  id: 1,
  idEventoClinico: 100,
  nmArquivo: 'receituario-100.pdf',
  dsTipoMime: 'application/pdf',
  dsCaminho: '/storage/documentos/receituario-100.pdf',
  nrTamanhoBytes: 15872,
};

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ idPet: '1' })),
  useRouter: () => ({ back: mockBack }),
}));

// CQ-15: ScreenContainer usa <SafeAreaView> deste módulo — o mock antigo só
// tinha `useSafeAreaInsets`, o que derrubaria o render com "Element type is
// invalid" assim que a tela passasse a importar ScreenContainer.
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, style }: { children: React.ReactNode; style?: unknown }) =>
      React.createElement(View, { style }, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

// useWindowDimensions é o que useBreakpoint()/ScreenContainer consomem.
const mockUseWindowDimensions = jest.fn(() => ({ width: 400, height: 800, scale: 1, fontScale: 1 }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockUseWindowDimensions(),
}));

function setViewport(width: number, height: number) {
  mockUseWindowDimensions.mockReturnValue({ width, height, scale: 1, fontScale: 1 });
}

jest.mock('@hooks/usePetDetail', () => ({ usePetDetail: jest.fn() }));

jest.mock('@hooks/useEventosClinicos', () => ({
  useCriarPrescricao: jest.fn(),
  useMedicamentos: jest.fn(),
  useGerarReceituario: jest.fn(),
  useBaixarReceituario: jest.fn(),
}));

const mockWhatsAppModal = jest.fn();
jest.mock('@components/domain/WhatsAppModal', () => ({
  WhatsAppModal: (props: { visible: boolean }) => {
    mockWhatsAppModal(props);
    const R = require('react');
    const { View } = require('react-native');
    return props.visible ? R.createElement(View, { testID: 'whatsapp-modal' }) : null;
  },
}));

import { usePetDetail } from '../src/hooks/usePetDetail';
import {
  useCriarPrescricao,
  useMedicamentos,
  useGerarReceituario,
  useBaixarReceituario,
} from '../src/hooks/useEventosClinicos';

const mockUsePetDetail = usePetDetail as jest.Mock;
const mockUseCriarPrescricao = useCriarPrescricao as jest.Mock;
const mockUseMedicamentos = useMedicamentos as jest.Mock;
const mockUseGerarReceituario = useGerarReceituario as jest.Mock;
const mockUseBaixarReceituario = useBaixarReceituario as jest.Mock;

const MOCK_VET = {
  id: 1,
  nmVeterinario: 'Dr. Felipe',
  nrCRMV: 'SP-12345',
  dsEmail: 'f@k.com',
};

const MOCK_PET = {
  id: 1,
  nmPet: 'Thor',
  nmEspecie: 'Cão',
  nmRaca: 'Labrador',
  dtNascimento: '2020-01-01T00:00:00.000Z',
  sgSexo: 'M',
  sgPorte: 'G',
  tutores: [{ id: 10, nmTutor: 'Carlos', dsTelefone: '11999990001', dsEmail: 'c@e.com' }],
};

const MOCK_MEDS = {
  items: [
    {
      id: 1,
      nmMedicamento: 'Amoxicilina 250mg',
      dsPrincipioAtivo: 'Amoxicilina',
      dsConcentracao: '250mg/5mL',
      dsApresentacao: 'Suspensão',
    },
    {
      id: 2,
      nmMedicamento: 'Metronidazol 400mg',
      dsPrincipioAtivo: 'Metronidazol',
      dsConcentracao: '400mg',
      dsApresentacao: 'Comprimido',
    },
  ],
  page: 1,
  pageSize: 20,
  totalItems: 2,
  totalPages: 1,
};

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  setViewport(400, 800);
  useAuthStore.setState({
    token: 'tok',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    usuario: MOCK_VET,
  });
  mockUsePetDetail.mockReturnValue({ data: MOCK_PET });
  mockUseCriarPrescricao.mockReturnValue({ mutate: mockMutate, isPending: false });
  mockUseMedicamentos.mockReturnValue({ data: MOCK_MEDS });
  mockUseGerarReceituario.mockReturnValue({ mutate: mockMutateGerarReceituario, isPending: false });
  mockMutateGerarReceituario.mockImplementation(
    (_idEventoClinico: number, opts: { onSuccess?: (doc: typeof MOCK_DOCUMENTO) => void }) =>
      opts?.onSuccess?.(MOCK_DOCUMENTO),
  );
  mockUseBaixarReceituario.mockReturnValue({ mutate: mockMutateBaixarReceituario, isPending: false });
});

function emitirReceitaComSucesso(idEventoClinico = 100) {
  mockMutate.mockImplementation(
    (_req: unknown, opts: { onSuccess?: (r: { idEventoClinico: number; idPrescricao: number }) => void }) =>
      opts?.onSuccess?.({ idEventoClinico, idPrescricao: 200 }),
  );
}

describe('ReceituarioScreen', () => {
  it('shows validation error when submitting without medication', async () => {
    const { getByTestId, getByText } = wrap(<ReceituarioScreen />);
    fireEvent.press(getByTestId('btn-emitir'));
    await waitFor(
      () => {
        expect(getByText('Selecione um medicamento')).toBeTruthy();
      },
      { timeout: 8000 },
    );
  }, 12000);

  it('shows validation error when posologia is empty after medication selected', async () => {
    const { getByTestId, getByText } = wrap(<ReceituarioScreen />);
    fireEvent.changeText(getByTestId('search-med'), 'amox');
    fireEvent.press(getByTestId('med-item-1'));
    fireEvent.press(getByTestId('btn-emitir'));
    await waitFor(() => {
      expect(getByText('Descreva a posologia')).toBeTruthy();
    });
  });

  it('shows filtered medications list when searching "amox"', () => {
    const { getByTestId, getByText, queryByText } = wrap(<ReceituarioScreen />);
    fireEvent.changeText(getByTestId('search-med'), 'amox');
    expect(getByText('Amoxicilina 250mg')).toBeTruthy();
    expect(queryByText('Metronidazol 400mg')).toBeNull();
  });

  it('shows chip with medication name after selection and hides list', () => {
    const { getByTestId, getByText, queryByTestId } = wrap(<ReceituarioScreen />);
    fireEvent.changeText(getByTestId('search-med'), 'amox');
    fireEvent.press(getByTestId('med-item-1'));
    expect(getByText('Amoxicilina 250mg')).toBeTruthy();
    expect(queryByTestId('search-med')).toBeNull();
  });

  it('calls criarPrescricao with correct payload on valid submit', async () => {
    const { getByTestId } = wrap(<ReceituarioScreen />);
    fireEvent.changeText(getByTestId('search-med'), 'amox');
    fireEvent.press(getByTestId('med-item-1'));
    fireEvent.changeText(getByTestId('field-posologia'), '1 comprimido a cada 12h');
    fireEvent.changeText(getByTestId('field-duracao'), '7');
    fireEvent.press(getByTestId('btn-emitir'));
    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          idPet: 1,
          idVeterinario: 1,
          idMedicamento: 1,
          dsPosologia: '1 comprimido a cada 12h',
          nrDuracaoDias: 7,
        }),
        expect.any(Object),
      );
    });
  });

  it('calls criarPrescricao with dsObservacao when the field is filled', async () => {
    const { getByTestId } = wrap(<ReceituarioScreen />);
    fireEvent.changeText(getByTestId('search-med'), 'amox');
    fireEvent.press(getByTestId('med-item-1'));
    fireEvent.changeText(getByTestId('field-posologia'), '1 comprimido a cada 12h');
    fireEvent.changeText(getByTestId('field-duracao'), '7');
    fireEvent.changeText(getByTestId('field-observacao'), 'Tutor deve retornar em 10 dias');
    fireEvent.press(getByTestId('btn-emitir'));
    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          dsObservacao: 'Tutor deve retornar em 10 dias',
        }),
        expect.any(Object),
      );
    });
  });

  it('shows validation error when dsObservacao exceeds 1000 characters', async () => {
    const { getByTestId, getByText } = wrap(<ReceituarioScreen />);
    fireEvent.changeText(getByTestId('search-med'), 'amox');
    fireEvent.press(getByTestId('med-item-1'));
    fireEvent.changeText(getByTestId('field-posologia'), '1 comprimido a cada 12h');
    fireEvent.changeText(getByTestId('field-duracao'), '7');
    fireEvent.changeText(getByTestId('field-observacao'), 'a'.repeat(1001));
    fireEvent.press(getByTestId('btn-emitir'));
    await waitFor(() => {
      expect(getByText('Máximo 1000 caracteres')).toBeTruthy();
    });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('emits the prescription successfully when dsObservacao is left empty', async () => {
    emitirReceitaComSucesso();
    const { getByTestId } = wrap(<ReceituarioScreen />);
    fireEvent.changeText(getByTestId('search-med'), 'amox');
    fireEvent.press(getByTestId('med-item-1'));
    fireEvent.changeText(getByTestId('field-posologia'), '1 comprimido a cada 12h');
    fireEvent.changeText(getByTestId('field-duracao'), '7');
    fireEvent.press(getByTestId('btn-emitir'));
    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ dsObservacao: '' }),
        expect.any(Object),
      );
      expect(getByTestId('success-modal')).toBeTruthy();
    });
  });

  it('shows success modal on successful prescription creation', async () => {
    emitirReceitaComSucesso();
    const { getByTestId } = wrap(<ReceituarioScreen />);
    fireEvent.changeText(getByTestId('search-med'), 'amox');
    fireEvent.press(getByTestId('med-item-1'));
    fireEvent.changeText(getByTestId('field-posologia'), '1 comprimido a cada 12h');
    fireEvent.changeText(getByTestId('field-duracao'), '7');
    fireEvent.press(getByTestId('btn-emitir'));
    await waitFor(() => {
      expect(getByTestId('success-modal')).toBeTruthy();
    });
  });

  it('opens WhatsApp modal when pressing "Enviar via WhatsApp"', async () => {
    emitirReceitaComSucesso();
    const { getByTestId } = wrap(<ReceituarioScreen />);
    fireEvent.changeText(getByTestId('search-med'), 'amox');
    fireEvent.press(getByTestId('med-item-1'));
    fireEvent.changeText(getByTestId('field-posologia'), '1 comprimido a cada 12h');
    fireEvent.changeText(getByTestId('field-duracao'), '7');
    fireEvent.press(getByTestId('btn-emitir'));
    await waitFor(() => getByTestId('btn-whatsapp'));
    fireEvent.press(getByTestId('btn-whatsapp'));
    await waitFor(() => {
      expect(getByTestId('whatsapp-modal')).toBeTruthy();
    });
  });

  it('passes tipo="receituario" and the tutor phone to WhatsAppModal', async () => {
    emitirReceitaComSucesso();
    const { getByTestId } = wrap(<ReceituarioScreen />);
    fireEvent.changeText(getByTestId('search-med'), 'amox');
    fireEvent.press(getByTestId('med-item-1'));
    fireEvent.changeText(getByTestId('field-posologia'), '1 comprimido a cada 12h');
    fireEvent.changeText(getByTestId('field-duracao'), '7');
    fireEvent.press(getByTestId('btn-emitir'));
    await waitFor(() => getByTestId('btn-whatsapp'));

    expect(mockWhatsAppModal).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'receituario', dsTelefone: '11999990001' }),
    );
  });

  it('gera o receituário em PDF ao emitir a receita e mostra a confirmação', async () => {
    emitirReceitaComSucesso();
    const { getByTestId } = wrap(<ReceituarioScreen />);
    fireEvent.changeText(getByTestId('search-med'), 'amox');
    fireEvent.press(getByTestId('med-item-1'));
    fireEvent.changeText(getByTestId('field-posologia'), '1 comprimido a cada 12h');
    fireEvent.changeText(getByTestId('field-duracao'), '7');
    fireEvent.press(getByTestId('btn-emitir'));

    await waitFor(() => {
      expect(mockMutateGerarReceituario).toHaveBeenCalledWith(100, expect.any(Object));
      expect(getByTestId('receituario-pdf-info').props.children).toContain('receituario-100.pdf');
    });
  });

  it('falha ao gerar o PDF não bloqueia o vet — mostra aviso e ainda permite concluir', async () => {
    emitirReceitaComSucesso();
    mockMutateGerarReceituario.mockImplementation(
      (_id: number, opts: { onError?: () => void }) => opts?.onError?.(),
    );
    const { getByTestId } = wrap(<ReceituarioScreen />);
    fireEvent.changeText(getByTestId('search-med'), 'amox');
    fireEvent.press(getByTestId('med-item-1'));
    fireEvent.changeText(getByTestId('field-posologia'), '1 comprimido a cada 12h');
    fireEvent.changeText(getByTestId('field-duracao'), '7');
    fireEvent.press(getByTestId('btn-emitir'));

    await waitFor(() => {
      expect(getByTestId('success-modal')).toBeTruthy();
      expect(getByTestId('receituario-pdf-indisponivel')).toBeTruthy();
    });
  });

  it('calls baixarReceituario with the generated documento when pressing "Baixar/Visualizar PDF"', async () => {
    emitirReceitaComSucesso();
    const { getByTestId } = wrap(<ReceituarioScreen />);
    fireEvent.changeText(getByTestId('search-med'), 'amox');
    fireEvent.press(getByTestId('med-item-1'));
    fireEvent.changeText(getByTestId('field-posologia'), '1 comprimido a cada 12h');
    fireEvent.changeText(getByTestId('field-duracao'), '7');
    fireEvent.press(getByTestId('btn-emitir'));
    await waitFor(() => getByTestId('btn-baixar-pdf'));

    fireEvent.press(getByTestId('btn-baixar-pdf'));

    await waitFor(() => {
      expect(mockMutateBaixarReceituario).toHaveBeenCalledWith(
        { idEventoClinico: MOCK_DOCUMENTO.idEventoClinico, documento: MOCK_DOCUMENTO },
        expect.any(Object),
      );
    });
  });

  it('does not show "Baixar/Visualizar PDF" when o PDF falhou ao gerar', async () => {
    emitirReceitaComSucesso();
    mockMutateGerarReceituario.mockImplementation(
      (_id: number, opts: { onError?: () => void }) => opts?.onError?.(),
    );
    const { getByTestId, queryByTestId } = wrap(<ReceituarioScreen />);
    fireEvent.changeText(getByTestId('search-med'), 'amox');
    fireEvent.press(getByTestId('med-item-1'));
    fireEvent.changeText(getByTestId('field-posologia'), '1 comprimido a cada 12h');
    fireEvent.changeText(getByTestId('field-duracao'), '7');
    fireEvent.press(getByTestId('btn-emitir'));

    await waitFor(() => {
      expect(getByTestId('success-modal')).toBeTruthy();
    });
    expect(queryByTestId('btn-baixar-pdf')).toBeNull();
  });

  it('shows an alert when baixarReceituario fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockMutateBaixarReceituario.mockImplementation(
      (_vars: unknown, opts: { onError?: () => void }) => opts?.onError?.(),
    );
    emitirReceitaComSucesso();
    const { getByTestId } = wrap(<ReceituarioScreen />);
    fireEvent.changeText(getByTestId('search-med'), 'amox');
    fireEvent.press(getByTestId('med-item-1'));
    fireEvent.changeText(getByTestId('field-posologia'), '1 comprimido a cada 12h');
    fireEvent.changeText(getByTestId('field-duracao'), '7');
    fireEvent.press(getByTestId('btn-emitir'));
    await waitFor(() => getByTestId('btn-baixar-pdf'));

    fireEvent.press(getByTestId('btn-baixar-pdf'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Erro', expect.stringContaining('PDF'));
    });
    alertSpy.mockRestore();
  });

  it('calls router.back() when pressing "Voltar ao paciente"', async () => {
    emitirReceitaComSucesso();
    const { getByTestId } = wrap(<ReceituarioScreen />);
    fireEvent.changeText(getByTestId('search-med'), 'amox');
    fireEvent.press(getByTestId('med-item-1'));
    fireEvent.changeText(getByTestId('field-posologia'), '1 comprimido a cada 12h');
    fireEvent.changeText(getByTestId('field-duracao'), '7');
    fireEvent.press(getByTestId('btn-emitir'));
    await waitFor(() => getByTestId('btn-voltar'));
    fireEvent.press(getByTestId('btn-voltar'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });
});

// CQ-15: prova de mordida — falha contra a tela sem ScreenContainer (o
// testID/estilo 'screen-container-content' não existe hoje), passa depois da
// adoção. Estilo declarado, não px calculado.
describe('ReceituarioScreen — ScreenContainer adoption (CQ-15)', () => {
  it('respects layout.maxContentWidth at 1440×900 (xl)', () => {
    setViewport(1440, 900);
    mockUsePetDetail.mockReturnValue({ data: MOCK_PET, isLoading: false, isError: false });
    mockUseMedicamentos.mockReturnValue({ data: [], isLoading: false });
    mockUseCriarPrescricao.mockReturnValue({ mutate: mockMutate, isPending: false });
    mockUseGerarReceituario.mockReturnValue({ mutate: mockMutateGerarReceituario, isPending: false });
    mockUseBaixarReceituario.mockReturnValue({ mutate: mockMutateBaixarReceituario, isPending: false });
    const { getByTestId } = wrap(<ReceituarioScreen />);
    const inner = getByTestId('screen-container-content');
    const flatStyle = StyleSheet.flatten(inner.props.style) as { maxWidth?: number };
    expect(flatStyle.maxWidth).toBe(layout.maxContentWidth);
  });
});
