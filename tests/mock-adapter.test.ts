import { resolveMock } from '../src/services/api/mock-adapter';
import type { InternalAxiosRequestConfig } from 'axios';

function makeConfig(url: string, method = 'GET'): InternalAxiosRequestConfig {
  return { url, method, headers: {} } as InternalAxiosRequestConfig;
}

describe('mock-adapter', () => {
  it('resolves /auth/login', async () => {
    const res = await resolveMock(makeConfig('/auth/login', 'POST'));
    expect(res.status).toBe(200);
    const data = res.data as { accessToken: string; expiresAt: string };
    expect(data.accessToken).toContain('kura_mock_jwt');
    expect(data.expiresAt).toBeDefined();
  });

  it('resolves /dashboard/hoje', async () => {
    const res = await resolveMock(makeConfig('/dashboard/hoje'));
    const data = res.data as { metrics: { nrConsultasHoje: number } };
    expect(data.metrics.nrConsultasHoje).toBe(8);
  });

  it('resolves /dashboard/alertas with 5 items', async () => {
    const res = await resolveMock(makeConfig('/dashboard/alertas'));
    const data = res.data as unknown[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(5);
  });

  it('resolves /dashboard/recentes with 5 items', async () => {
    const res = await resolveMock(makeConfig('/dashboard/recentes'));
    const data = res.data as unknown[];
    expect(data.length).toBe(5);
  });

  it('resolves /pets list', async () => {
    const res = await resolveMock(makeConfig('/pets'));
    const data = res.data as unknown[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(12);
  });

  it('resolves /pets/1', async () => {
    const res = await resolveMock(makeConfig('/pets/1'));
    const data = res.data as { id: number; nmPet: string };
    expect(data.id).toBe(1);
    expect(data.nmPet).toBe('Thor');
  });

  it('rejects /pets/999 with 404', async () => {
    await expect(resolveMock(makeConfig('/pets/999'))).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('resolves /pets/1/timeline', async () => {
    const res = await resolveMock(makeConfig('/pets/1/timeline'));
    const data = res.data as unknown[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('resolves /pets/999/timeline as empty array (edge case)', async () => {
    const res = await resolveMock(makeConfig('/pets/999/timeline'));
    expect(res.data).toEqual([]);
  });

  it('resolves /eventos-clinicos/consultas', async () => {
    const res = await resolveMock(makeConfig('/eventos-clinicos/consultas', 'POST'));
    const data = res.data as { idEventoClinico: number; idConsulta: number };
    expect(data.idEventoClinico).toBeDefined();
    expect(data.idConsulta).toBeDefined();
  });

  it('resolves /medicamentos', async () => {
    const res = await resolveMock(makeConfig('/medicamentos'));
    const data = res.data as { items: unknown[]; totalItems: number };
    expect(data.items.length).toBe(10);
    expect(data.totalItems).toBe(10);
  });

  it('resolves /luna/health', async () => {
    const res = await resolveMock(makeConfig('/luna/health'));
    const data = res.data as { sgStatus: string };
    expect(data.sgStatus).toBe('UP');
  });

  it('resolves /luna/whatsapp/enviar', async () => {
    const res = await resolveMock(makeConfig('/luna/whatsapp/enviar', 'POST'));
    const data = res.data as { sgStatus: string };
    expect(data.sgStatus).toBe('ENVIADO');
  });

  it('resolves /luna/triagens/relatorio', async () => {
    const res = await resolveMock(makeConfig('/luna/triagens/relatorio'));
    const data = res.data as { nrTotalTriagens: number };
    expect(data.nrTotalTriagens).toBeGreaterThan(0);
  });

  it('throws descriptive error for unknown route', async () => {
    await expect(resolveMock(makeConfig('/unknown/route'))).rejects.toThrow(
      'No mock for GET /unknown/route',
    );
  });

  it('simulates latency of ~300ms', async () => {
    const start = Date.now();
    await resolveMock(makeConfig('/dashboard/hoje'));
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(280);
  });

  it('alerta sem idPet is present in alertas', async () => {
    const res = await resolveMock(makeConfig('/dashboard/alertas'));
    const data = res.data as Array<{ idPet?: number; dsTipoAlerta: string }>;
    const semPet = data.find((a) => a.idPet === undefined);
    expect(semPet).toBeDefined();
    expect(semPet?.dsTipoAlerta).toBe('IOT_TEMPERATURA');
  });

  it('pet com tutores vazios exists (Bolinha, id=7)', async () => {
    const res = await resolveMock(makeConfig('/pets/7'));
    const data = res.data as { tutores: unknown[] };
    expect(data.tutores).toEqual([]);
  });
});
