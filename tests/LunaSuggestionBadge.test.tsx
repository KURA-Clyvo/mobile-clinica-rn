// LU-10 (KURA_BACKLOG_LUNA_AI, achado N4) — cobertura isolada do componente
// depois da correção: o badge deixou de importar `mocks/luna.mock` e passou a
// receber o rascunho SOAP REAL por prop (`draftText`, vindo de
// `useEnviarTranscricao` → `soap.{s,o,a,p}` na tela real, ver
// `src/app/(app)/consulta/[idPet].tsx`). Critério de aceite literal do brief:
// sem rascunho → 0 badges; com rascunho → texto igual ao do rascunho, NUNCA o
// do mock; campo vazio → sem badge daquele campo; confirmação ao substituir
// texto digitado mantida.
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { LunaSuggestionBadge } from '../src/components/domain/LunaSuggestionBadge';

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

// Texto fixo que `mocks/luna.mock.ts::SOAP_SUGESTOES` devolvia para o campo S —
// usado só para provar que o badge NUNCA produz este texto, mesmo por
// coincidência (mordida do critério "nunca o do mock").
const TEXTO_DO_MOCK_ANTIGO = 'Tutor relata apatia há 2 dias e diminuição do apetite.';
const RASCUNHO_REAL = 'Paciente com hiporexia leve, sem vômitos, hidratado.';

describe('LunaSuggestionBadge (LU-10, pós-correção)', () => {
  it('sem rascunho (draftText undefined) — 0 badges', () => {
    const { queryByTestId } = wrap(
      <LunaSuggestionBadge campo="S" onSugest={jest.fn()} />,
    );
    expect(queryByTestId('luna-badge-S')).toBeNull();
  });

  it('rascunho null (campo que a transcrição não preencheu) — 0 badges', () => {
    const { queryByTestId } = wrap(
      <LunaSuggestionBadge campo="O" draftText={null} onSugest={jest.fn()} />,
    );
    expect(queryByTestId('luna-badge-O')).toBeNull();
  });

  it('rascunho vazio/só espaço — 0 badges (campo vazio não renderiza)', () => {
    const { queryByTestId } = wrap(
      <LunaSuggestionBadge campo="A" draftText="   " onSugest={jest.fn()} />,
    );
    expect(queryByTestId('luna-badge-A')).toBeNull();
  });

  it('com rascunho não-vazio — o badge renderiza', () => {
    const { getByTestId } = wrap(
      <LunaSuggestionBadge campo="P" draftText={RASCUNHO_REAL} onSugest={jest.fn()} />,
    );
    expect(getByTestId('luna-badge-P')).toBeTruthy();
  });

  it('texto do rótulo é "Usar rascunho da Luna" (não finge gerar nada)', () => {
    const { getByText } = wrap(
      <LunaSuggestionBadge campo="S" draftText={RASCUNHO_REAL} onSugest={jest.fn()} />,
    );
    expect(getByText('Usar rascunho da Luna')).toBeTruthy();
  });

  it('campo vazio (sem currentText): tocar aplica o rascunho REAL imediatamente, sem Alert', () => {
    const onSugest = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = wrap(
      <LunaSuggestionBadge campo="S" draftText={RASCUNHO_REAL} onSugest={onSugest} />,
    );
    fireEvent.press(getByTestId('luna-badge-S'));
    expect(onSugest).toHaveBeenCalledWith(RASCUNHO_REAL);
    expect(onSugest).not.toHaveBeenCalledWith(TEXTO_DO_MOCK_ANTIGO);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  // Mordida direta do critério "nunca o texto do mock": mesmo com um rascunho
  // real DIFERENTE do texto que o mock antigo devolvia para o campo S, o
  // resultado aplicado é o rascunho — nunca `TEXTO_DO_MOCK_ANTIGO`, mesmo que
  // o componente ainda importasse (por regressão) `mocks/luna.mock`.
  it('dois rascunhos diferentes produzem dois textos aplicados diferentes — não há valor fixo', () => {
    const onSugest1 = jest.fn();
    const onSugest2 = jest.fn();
    const { getByTestId, rerender } = wrap(
      <LunaSuggestionBadge campo="S" draftText="Primeiro rascunho" onSugest={onSugest1} />,
    );
    fireEvent.press(getByTestId('luna-badge-S'));
    expect(onSugest1).toHaveBeenCalledWith('Primeiro rascunho');

    rerender(
      <ThemeProvider>
        <LunaSuggestionBadge campo="S" draftText="Segundo rascunho, bem diferente" onSugest={onSugest2} />
      </ThemeProvider>,
    );
    fireEvent.press(getByTestId('luna-badge-S'));
    expect(onSugest2).toHaveBeenCalledWith('Segundo rascunho, bem diferente');
  });

  it('texto já digitado presente: mostra Alert de confirmação antes de substituir', () => {
    const onSugest = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { getByTestId } = wrap(
      <LunaSuggestionBadge
        campo="S"
        draftText={RASCUNHO_REAL}
        currentText="Texto que o vet já digitou"
        onSugest={onSugest}
      />,
    );
    fireEvent.press(getByTestId('luna-badge-S'));
    expect(alertSpy).toHaveBeenCalledWith(
      'Substituir texto atual?',
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancelar' }),
        expect.objectContaining({ text: 'Substituir' }),
      ]),
    );
    // Sem confirmar (Cancelar), o texto não é substituído.
    expect(onSugest).not.toHaveBeenCalled();
  });

  it('confirmando a substituição no Alert aplica o rascunho real', () => {
    const onSugest = jest.fn();
    jest.spyOn(Alert, 'alert').mockImplementationOnce((_title, _msg, buttons) => {
      const substituir = buttons?.find((b) => b.text === 'Substituir');
      substituir?.onPress?.();
    });
    const { getByTestId } = wrap(
      <LunaSuggestionBadge
        campo="S"
        draftText={RASCUNHO_REAL}
        currentText="Texto que o vet já digitou"
        onSugest={onSugest}
      />,
    );
    fireEvent.press(getByTestId('luna-badge-S'));
    expect(onSugest).toHaveBeenCalledWith(RASCUNHO_REAL);
  });

  // LU-10 (ruling do Felipe, 15/09): badge só aparece quando serve para
  // algo. `currentText === draftText` (o vet não mexeu, ou já restaurou)
  // não tem nada a restaurar — o badge some.
  it('currentText igual ao draftText — badge fica oculto (nada para restaurar)', () => {
    const { queryByTestId } = wrap(
      <LunaSuggestionBadge
        campo="S"
        draftText={RASCUNHO_REAL}
        currentText={RASCUNHO_REAL}
        onSugest={jest.fn()}
      />,
    );
    expect(queryByTestId('luna-badge-S')).toBeNull();
  });

  it('currentText diferente do draftText — badge aparece normalmente', () => {
    const { getByTestId } = wrap(
      <LunaSuggestionBadge
        campo="S"
        draftText={RASCUNHO_REAL}
        currentText="Texto diferente do rascunho"
        onSugest={jest.fn()}
      />,
    );
    expect(getByTestId('luna-badge-S')).toBeTruthy();
  });

  it('cancelando o Alert NÃO chama onSugest', () => {
    const onSugest = jest.fn();
    jest.spyOn(Alert, 'alert').mockImplementationOnce((_title, _msg, buttons) => {
      const cancelar = buttons?.find((b) => b.text === 'Cancelar');
      cancelar?.onPress?.();
    });
    const { getByTestId } = wrap(
      <LunaSuggestionBadge
        campo="S"
        draftText={RASCUNHO_REAL}
        currentText="Texto que o vet já digitou"
        onSugest={onSugest}
      />,
    );
    fireEvent.press(getByTestId('luna-badge-S'));
    expect(onSugest).not.toHaveBeenCalled();
  });
});
