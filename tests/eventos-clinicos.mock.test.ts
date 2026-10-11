// BR-CLI-T08 — o mock de confirmar SOAP tem de aceitar o corpo como OBJETO (o interceptor de mock
// entrega `config.data` já parseado) e como string JSON. Antes: SyntaxError "[object Object]".
import type { InternalAxiosRequestConfig } from 'axios';
import { confirmarSoap } from '../src/mocks/eventos-clinicos.mock';

const SOAP = { s: 'S final', o: 'O final', a: null, p: 'P final' };
const cfg = (data: unknown) => ({ data }) as unknown as InternalAxiosRequestConfig;

describe('mock confirmarSoap', () => {
  it('aceita o corpo como objeto', async () => {
    const r = await confirmarSoap(cfg(SOAP));
    expect(r.soap).toEqual(SOAP);
    expect(r.stSoapConfirmado).toBe(true);
  });
  it('aceita o corpo como string JSON', async () => {
    const r = await confirmarSoap(cfg(JSON.stringify(SOAP)));
    expect(r.soap).toEqual(SOAP);
  });
});
