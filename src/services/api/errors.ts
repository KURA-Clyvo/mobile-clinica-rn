import type { AxiosError } from 'axios';
import type { ApiError } from '../../types/api';

export function normalizeError(err: unknown): ApiError {
  const axiosErr = err as AxiosError<{
    code?: string;
    message?: string;
    details?: Record<string, string[]>;
    // FM-02: o .NET real nunca devolve { code, message, details } — devolve
    // RFC 7807 ({ type, title, status, traceId }) em erro de negócio, ou o
    // ValidationProblemDetails padrão do ASP.NET ({ type, title, status,
    // errors }) em 400 de FluentValidation. Os mocks é que respondem no
    // shape { code, message } direto (já no formato que a UI consome), sem
    // passar por esta função — por isso os dois pares `??` abaixo tentam o
    // shape de mock PRIMEIRO (retrocompatível) e caem pro shape real do
    // .NET só se o de mock estiver ausente. Sem este fallback, todo 4xx do
    // .NET real caía no genérico do axios ("Request failed with status code
    // 422") em vez da mensagem de negócio real (ex.: "A clínica ficaria sem
    // nenhum gestor ativo."). Ver tests/errors.test.ts.
    type?: string;
    title?: string;
    errors?: Record<string, string[]>;
  }>;

  if (axiosErr.isAxiosError) {
    if (axiosErr.response) {
      const { status, data } = axiosErr.response;
      return {
        status,
        code: data?.code ?? data?.type ?? `HTTP_${status}`,
        message: data?.message ?? data?.title ?? axiosErr.message,
        details: data?.details ?? data?.errors,
      };
    }
    return {
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Sem conexão. Verifique sua internet e tente novamente.',
    };
  }

  return {
    status: -1,
    code: 'UNKNOWN_ERROR',
    message: String(err),
  };
}
