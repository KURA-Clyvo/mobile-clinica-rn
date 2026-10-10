import React, { createContext, useContext } from 'react';

/**
 * Estado "fontes prontas" do app, publicado pelo `_layout.tsx` (único dono do `useFonts`).
 * A abertura (BR-CLI-T04, PLANO_BRANDING §2b) cobre "fontes e sessão": `index.tsx` só a
 * desmonta quando as DUAS coisas estão prontas, para a primeira tela nunca nascer em fonte
 * de sistema. "Pronta" = carregou, falhou ou estourou o prazo do `_layout` (nunca trava).
 * Sem provider o valor é `true` (testes e telas isoladas não esperam fonte).
 */
const FontesProntasContext = createContext<boolean>(true);

export const FontesProntasProvider = FontesProntasContext.Provider;

export function useFontesProntas(): boolean {
  return useContext(FontesProntasContext);
}
