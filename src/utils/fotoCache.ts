/**
 * FT-08 (KURA_BACKLOG_FOTO_PET.md §0, regra A7): a chave de cache do
 * `expo-image` tem que ser o CAMINHO da URL da foto, sem a query string.
 *
 * O caminho servido pela FT-04 (`/api/v1/fotos/clinica/{idClinica}/pet/
 * {idPet}/{uuid}_{256|1080}.{ext}`) é imutável — o `uuid` só muda quando a
 * clínica troca a foto (FT-03). A query (`?exp=...&sig=...`) é a assinatura
 * HMAC da FT-02/FT-04, com validade de 24h (`Foto:ValidadeUrlHoras`) — ela
 * muda a cada renovação da URL mesmo que a foto continue sendo a mesma. O
 * DTO (`PetResponse.dsFotoUrl`/`dsFotoThumbUrl`) não expõe a chave bruta
 * (`DS_FOTO_CHAVE`) — só a URL assinada — então a `cacheKey` precisa ser
 * DERIVADA da URL aqui, não recebida pronta do backend.
 *
 * Usar a URL inteira (com query) como `cacheKey` baixaria a foto de novo a
 * cada expiração da assinatura, mesmo sem a foto ter mudado — o oposto do
 * que a regra A7 pede ("foto baixada uma vez por aparelho").
 *
 * FT-08, fix wave G2 (G2-7): "baixada uma vez por aparelho" vale SÓ NO
 * NATIVO. Na WEB, o `expo-image` ignora `cacheKey`/`cachePolicy` por
 * completo (medido em `node_modules/expo-image/src/web/`: `cacheKey` não
 * aparece em nenhum arquivo do bundle web; `cachePolicy` só é lido em
 * `useHeaders`, e só quando `source.headers` existe, que não é o nosso
 * caso) — o `<img src>` recebe a URL COMPLETA e o cache é o HTTP do
 * navegador, chaveado pela URL inteira. Como o `.NET`/Java emitem `exp`
 * novo a cada resposta do DTO (`GeradorUrlFotoPet`), na web cada refetch do
 * pet baixa a foto de novo, mesmo sem ela ter mudado.
 */
export function derivarCacheKeyFoto(url: string): string {
  const indiceQuery = url.indexOf('?');
  return indiceQuery === -1 ? url : url.slice(0, indiceQuery);
}
