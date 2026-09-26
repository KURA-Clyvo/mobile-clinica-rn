import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { KCPetPortrait, PetPalette } from '../src/components/primitives/KCPetPortrait';

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

const PALETTES: PetPalette[] = [
  'lab', 'siam', 'border', 'poodle', 'persa', 'srd', 'golden', 'husky',
];

describe('KCPetPortrait', () => {
  describe('palette snapshots', () => {
    PALETTES.forEach((palette) => {
      it(`renders ${palette} palette`, () => {
        const { toJSON } = wrap(<KCPetPortrait palette={palette} />);
        expect(toJSON()).toMatchSnapshot();
      });
    });
  });

  it('renders all 8 palettes without crash', () => {
    PALETTES.forEach((palette) => {
      expect(() => wrap(<KCPetPortrait palette={palette} />)).not.toThrow();
    });
  });

  it('applies size to container dimensions', () => {
    const { getByTestId } = wrap(<KCPetPortrait palette="lab" size={64} />);
    const portrait = getByTestId('kc-pet-portrait');
    const flat = StyleSheet.flatten(portrait.props.style);
    expect(flat.width).toBe(64);
    expect(flat.height).toBe(64);
  });

  it('uses default size 88 when size not provided', () => {
    const { getByTestId } = wrap(<KCPetPortrait palette="golden" />);
    const portrait = getByTestId('kc-pet-portrait');
    const flat = StyleSheet.flatten(portrait.props.style);
    expect(flat.width).toBe(88);
    expect(flat.height).toBe(88);
  });

  it('borderRadius equals half of size', () => {
    const { getByTestId } = wrap(<KCPetPortrait palette="husky" size={100} />);
    const portrait = getByTestId('kc-pet-portrait');
    const flat = StyleSheet.flatten(portrait.props.style);
    expect(flat.borderRadius).toBe(50);
  });

  it('renders ring decorative border when ring=true', () => {
    const { getByTestId } = wrap(<KCPetPortrait palette="border" ring />);
    const portrait = getByTestId('kc-pet-portrait');
    const flat = StyleSheet.flatten(portrait.props.style);
    expect(flat.borderWidth).toBe(2);
  });

  it('renders without ring when ring=false (default)', () => {
    const { getByTestId } = wrap(<KCPetPortrait palette="lab" />);
    const portrait = getByTestId('kc-pet-portrait');
    const flat = StyleSheet.flatten(portrait.props.style);
    expect(flat.borderWidth).toBeUndefined();
  });

  // FT-08 — ramo com foto real (dsFotoUrl/dsFotoThumbUrl, FT-04). Literais
  // próprios aqui (regra do ciclo: não importar do módulo testado nem do
  // helper de cacheKey para montar o esperado).
  describe('foto real (FT-08)', () => {
    const FOTO_URL =
      'https://kura-clinica.vercel.app/proxy/clinica/api/v1/fotos/clinica/1/pet/2/uuid-fixo_1080.webp?exp=1790000000&sig=deadbeef';
    const CACHE_KEY_ESPERADA =
      'https://kura-clinica.vercel.app/proxy/clinica/api/v1/fotos/clinica/1/pet/2/uuid-fixo_1080.webp';

    it('com fotoUrl, renderiza a imagem real em vez da ilustração', () => {
      const { getByTestId, queryByTestId } = wrap(
        <KCPetPortrait palette="lab" fotoUrl={FOTO_URL} />,
      );
      expect(getByTestId('kc-pet-portrait-foto')).toBeTruthy();
      expect(queryByTestId('LinearGradient')).toBeNull();
    });

    it('sem fotoUrl, mantém a ilustração e não renderiza a imagem', () => {
      const { getByTestId, queryByTestId } = wrap(<KCPetPortrait palette="lab" />);
      expect(getByTestId('LinearGradient')).toBeTruthy();
      expect(queryByTestId('kc-pet-portrait-foto')).toBeNull();
    });

    it('usa a URL completa (com query) como source.uri', () => {
      const { getByTestId } = wrap(<KCPetPortrait palette="lab" fotoUrl={FOTO_URL} />);
      const foto = getByTestId('kc-pet-portrait-foto');
      // expo-image normaliza `source` para array internamente
      // (resolveSources) mesmo recebendo um objeto único.
      expect(foto.props.source).toEqual([{ uri: FOTO_URL, cacheKey: CACHE_KEY_ESPERADA }]);
    });

    it('cacheKey (dentro de source) é a URL SEM a query string — mordida: usar a URL completa faz esta asserção falhar', () => {
      const { getByTestId } = wrap(<KCPetPortrait palette="lab" fotoUrl={FOTO_URL} />);
      const foto = getByTestId('kc-pet-portrait-foto');
      // `cacheKey` é campo de `ImageSource` (dentro de `source`), não prop
      // solta do componente `<Image>` do expo-image.
      const cacheKey = foto.props.source[0].cacheKey;
      expect(cacheKey).toBe(CACHE_KEY_ESPERADA);
      expect(cacheKey).not.toContain('sig=');
      expect(cacheKey).not.toContain('exp=');
    });

    it('usa cachePolicy de disco e contentFit cover', () => {
      const { getByTestId } = wrap(<KCPetPortrait palette="lab" fotoUrl={FOTO_URL} />);
      const foto = getByTestId('kc-pet-portrait-foto');
      expect(foto.props.cachePolicy).toBe('disk');
      expect(foto.props.contentFit).toBe('cover');
    });

    it('onError volta para a ilustração — mordida: remover o fallback faz este teste falhar', () => {
      const { getByTestId, queryByTestId } = wrap(
        <KCPetPortrait palette="lab" fotoUrl={FOTO_URL} />,
      );
      const foto = getByTestId('kc-pet-portrait-foto');
      // Shape de `NativeSyntheticEvent<ImageErrorEventData>`: o wrapper do
      // expo-image (`withDeprecatedNativeEvent`) acessa `event.nativeEvent`
      // diretamente.
      fireEvent(foto, 'error', { nativeEvent: { error: 'falha ao carregar' } } as never);
      expect(queryByTestId('kc-pet-portrait-foto')).toBeNull();
      expect(getByTestId('LinearGradient')).toBeTruthy();
    });

    it('accessibilityLabel com o nome do pet no ramo COM foto', () => {
      // getByTestId, não getByLabelText: com o fix do G2-4 a `<Image>` TAMBÉM
      // carrega `accessibilityLabel` (ver describe G2-4 abaixo) — o RTL, ao
      // contrário de um leitor de tela real, não sabe que o `accessible` do
      // container absorve o filho, e `getByLabelText` acharia 2 elementos.
      const { getByTestId } = wrap(<KCPetPortrait palette="lab" fotoUrl={FOTO_URL} nome="Thor" />);
      expect(getByTestId('kc-pet-portrait').props.accessibilityLabel).toBe('Foto de Thor');
    });

    it('accessibilityLabel com o nome do pet no ramo SEM foto — G2-5: "Avatar de X", não "Foto de X" (não existe foto nenhuma)', () => {
      const { getByTestId } = wrap(<KCPetPortrait palette="lab" nome="Bolinha" />);
      const label = getByTestId('kc-pet-portrait').props.accessibilityLabel;
      expect(label).toBe('Avatar de Bolinha');
      expect(label).not.toBe('Foto de Bolinha');
    });

    it('sem nome, nenhum accessibilityLabel é definido (compatibilidade com os snapshots antigos)', () => {
      const { getByTestId } = wrap(<KCPetPortrait palette="lab" />);
      const portrait = getByTestId('kc-pet-portrait');
      expect(portrait.props.accessibilityLabel).toBeUndefined();
    });

    // G2-2: o reset de `erroFoto` quando a `fotoUrl` muda não tinha teste —
    // mordida: remover o `useEffect([fotoUrl])` passa verde (C11 do G2,
    // `184 passed`, `EXIT=0`). Cenário real: URL expira, o `onError` dispara,
    // o pet é recarregado com uma URL nova (uuid/exp/sig diferentes) — sem o
    // reset o avatar ficaria preso na ilustração mesmo com a foto nova válida.
    it('G2-2 — após onError, uma NOVA fotoUrl reseta erroFoto e volta a tentar a imagem', () => {
      const FOTO_2 =
        'https://kura-clinica.vercel.app/proxy/clinica/api/v1/fotos/clinica/1/pet/2/uuid-novo_1080.webp?exp=1790099999&sig=novasig';
      const { getByTestId, queryByTestId, rerender } = wrap(
        <KCPetPortrait palette="lab" fotoUrl={FOTO_URL} />,
      );
      const foto1 = getByTestId('kc-pet-portrait-foto');
      fireEvent(foto1, 'error', { nativeEvent: { error: 'expirou' } } as never);
      expect(queryByTestId('kc-pet-portrait-foto')).toBeNull();
      expect(getByTestId('LinearGradient')).toBeTruthy();

      rerender(<ThemeProvider><KCPetPortrait palette="lab" fotoUrl={FOTO_2} /></ThemeProvider>);

      const foto2 = getByTestId('kc-pet-portrait-foto');
      expect(foto2.props.source).toEqual([
        { uri: FOTO_2, cacheKey: 'https://kura-clinica.vercel.app/proxy/clinica/api/v1/fotos/clinica/1/pet/2/uuid-novo_1080.webp' },
      ]);
    });

    // G2-4: acessibilidade real, não só a letra do brief. (a) o CONTAINER
    // precisa ser `accessible` para o leitor de tela anunciar o avatar UMA
    // VEZ; sem isso ele desce nos filhos e tenta ler cada um. (b) a `<Image>`
    // precisa de `accessibilityLabel` (medido: `ExpoImage.tsx:59,103` funde
    // `alt`/`accessibilityLabel` no MESMO prop final no nativo; no
    // `react-native-web` ele vira o `alt` do `<img>`) para a web não gerar
    // `<img>` sem texto alternativo.
    describe('G2-4 — acessibilidade (container `accessible` + accessibilityLabel na imagem)', () => {
      it('ramo COM foto: container é accessible, role "image", e a Image recebe o mesmo rótulo — mordida: remover `accessible` faz esta asserção falhar', () => {
        const { getByTestId } = wrap(<KCPetPortrait palette="lab" fotoUrl={FOTO_URL} nome="Thor" />);
        const portrait = getByTestId('kc-pet-portrait');
        expect(portrait.props.accessible).toBe(true);
        expect(portrait.props.accessibilityRole).toBe('image');
        expect(portrait.props.accessibilityLabel).toBe('Foto de Thor');
        const foto = getByTestId('kc-pet-portrait-foto');
        expect(foto.props.accessibilityLabel).toBe('Foto de Thor');
      });

      it('ramo SEM foto: container é accessible com role "image" e o rótulo "Avatar de X"', () => {
        const { getByTestId } = wrap(<KCPetPortrait palette="lab" nome="Bolinha" />);
        const portrait = getByTestId('kc-pet-portrait');
        expect(portrait.props.accessible).toBe(true);
        expect(portrait.props.accessibilityRole).toBe('image');
        expect(portrait.props.accessibilityLabel).toBe('Avatar de Bolinha');
      });

      it('sem nome, `accessible`/`accessibilityRole` continuam undefined (não muda os 8 snapshots)', () => {
        const { getByTestId } = wrap(<KCPetPortrait palette="lab" />);
        const portrait = getByTestId('kc-pet-portrait');
        expect(portrait.props.accessible).toBeUndefined();
        expect(portrait.props.accessibilityRole).toBeUndefined();
      });

      // NÃO É MORDIDA — é uma nota de medição sobre o LIMITE da ferramenta de
      // teste, não do componente. Num leitor de tela real, `accessible=true`
      // no container faz iOS/Android tratarem a subárvore como UM elemento
      // opaco: o `accessibilityLabel` da `<Image>` filha deixa de ser
      // alcançável individualmente (comportamento documentado do RN, não
      // reproduzível em jsdom/react-test-renderer). O RTL não simula essa
      // fusão — `getAllByLabelText` aqui acha os 2 nós (container + Image)
      // porque compara props isoladamente, sem entender `accessible`/`role`.
      // NÃO VERIFICADO com leitor de tela real.
      it('RTL (ao contrário de um leitor de tela real) enxerga 2 nós com o mesmo rótulo — limite da ferramenta, não do componente', () => {
        const { getAllByLabelText } = wrap(<KCPetPortrait palette="lab" fotoUrl={FOTO_URL} nome="Thor" />);
        expect(getAllByLabelText('Foto de Thor')).toHaveLength(2);
      });
    });
  });
});
