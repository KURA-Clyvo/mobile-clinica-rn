import { derivarCacheKeyFoto } from '../src/utils/fotoCache';

describe('derivarCacheKeyFoto', () => {
  it('remove a query string da URL', () => {
    const url = 'https://kura-clinica.vercel.app/proxy/clinica/api/v1/fotos/clinica/1/pet/2/abc123_1080.webp?exp=1790000000&sig=deadbeef';
    expect(derivarCacheKeyFoto(url)).toBe(
      'https://kura-clinica.vercel.app/proxy/clinica/api/v1/fotos/clinica/1/pet/2/abc123_1080.webp',
    );
  });

  it('devolve a URL sem alteração quando não há query string', () => {
    const url = 'https://kura-clinica.vercel.app/proxy/clinica/api/v1/fotos/clinica/1/pet/2/abc123_256.webp';
    expect(derivarCacheKeyFoto(url)).toBe(url);
  });

  it('duas URLs com a mesma chave e assinaturas diferentes geram a MESMA cacheKey', () => {
    const chaveBase = 'https://kura-clinica.vercel.app/proxy/clinica/api/v1/fotos/clinica/1/pet/2/abc123_1080.webp';
    const urlAssinaturaA = `${chaveBase}?exp=1790000000&sig=aaaa`;
    const urlAssinaturaB = `${chaveBase}?exp=1790086400&sig=bbbb`;
    expect(derivarCacheKeyFoto(urlAssinaturaA)).toBe(derivarCacheKeyFoto(urlAssinaturaB));
  });

  it('remove só a partir do primeiro "?", mesmo que o valor de algum parâmetro contenha outro "?"', () => {
    const url = 'https://exemplo.com/foto.jpg?sig=a%3Fb';
    expect(derivarCacheKeyFoto(url)).toBe('https://exemplo.com/foto.jpg');
  });
});
