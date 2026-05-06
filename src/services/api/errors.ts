import type { AxiosError } from 'axios';
import type { ApiError } from '../../types/api';

export function normalizeError(err: unknown): ApiError {
  const axiosErr = err as AxiosError<{ code?: string; message?: string; details?: Record<string, string[]> }>;

  if (axiosErr.isAxiosError) {
    if (axiosErr.response) {
      const { status, data } = axiosErr.response;
      return {
        status,
        code: data?.code ?? `HTTP_${status}`,
        message: data?.message ?? axiosErr.message,
        details: data?.details,
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
