import type { AxiosError } from 'axios';
import { normalizeError } from '../src/services/api/errors';

// FM-02 — mordida obrigatória: o .NET real devolve RFC 7807
// ({ type, title, status, traceId }) em erro de negócio (RegraDeNegocioException)
// e o ValidationProblemDetails padrão do ASP.NET ({ type, title, status, errors })
// em 400 de FluentValidation — NENHUM dos dois tem `code`/`message`/`details`.
// Antes deste fix, normalizeError só lia code/message/details e todo 4xx real
// caía no genérico do axios ("Request failed with status code 422"), nunca na
// frase de negócio real. Reverter o `??` de errors.ts para o par antigo
// (`data?.code`, `data?.message`, `data?.details`) faz este teste falhar.
function makeAxiosError(status: number, data: unknown): AxiosError {
  return {
    isAxiosError: true,
    name: 'AxiosError',
    message: `Request failed with status code ${status}`,
    response: { status, data, statusText: '', headers: {}, config: {} as never },
    toJSON: () => ({}),
  } as unknown as AxiosError;
}

describe('normalizeError', () => {
  it('usa title/type do corpo RFC 7807 real do .NET quando code/message estão ausentes', () => {
    const err = makeAxiosError(422, {
      type: 'RegraDeNegocioException',
      title: 'A clínica ficaria sem nenhum gestor ativo.',
      status: 422,
      traceId: '00-abc-def-00',
    });

    const result = normalizeError(err);

    expect(result.status).toBe(422);
    expect(result.message).toBe('A clínica ficaria sem nenhum gestor ativo.');
    expect(result.code).toBe('RegraDeNegocioException');
    // NÃO pode ser a mensagem genérica do axios
    expect(result.message).not.toBe('Request failed with status code 422');
  });

  it('usa errors (ValidationProblemDetails) como details quando details está ausente', () => {
    const err = makeAxiosError(400, {
      type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
      title: 'One or more validation errors occurred.',
      status: 400,
      errors: { dsEmail: ['O e-mail é obrigatório.'] },
    });

    const result = normalizeError(err);

    expect(result.message).toBe('One or more validation errors occurred.');
    expect(result.details).toEqual({ dsEmail: ['O e-mail é obrigatório.'] });
  });

  it('continua preferindo o shape de mock ({ code, message, details }) quando presente — retrocompatibilidade', () => {
    const err = makeAxiosError(422, {
      code: 'EMAIL_EM_USO',
      message: 'Este e-mail já está em uso nesta clínica.',
      details: { dsEmail: ['duplicado'] },
      // corpo de mock não carrega type/title, mas se carregasse, code/message
      // teriam que vencer mesmo assim — não testado aqui pra não miscelar
      // os dois casos.
    });

    const result = normalizeError(err);

    expect(result.code).toBe('EMAIL_EM_USO');
    expect(result.message).toBe('Este e-mail já está em uso nesta clínica.');
    expect(result.details).toEqual({ dsEmail: ['duplicado'] });
  });
});
