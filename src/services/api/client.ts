import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveMock } from './mock-adapter';
import { normalizeError } from './errors';

const MOCK_FLAG = '__mock';
const AUTH_TOKEN_KEY = 'KURA_AUTH_TOKEN';
const TIMEOUT_MS = 15_000;

function buildRequestInterceptor() {
  return async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
    if (process.env.EXPO_PUBLIC_USE_MOCKS === 'true') {
      return Promise.reject({ [MOCK_FLAG]: true, config });
    }
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  };
}

function buildResponseErrorInterceptor() {
  return async (error: unknown): Promise<never> => {
    const err = error as Record<string, unknown>;

    if (err[MOCK_FLAG] === true) {
      const resolved = await resolveMock(err['config'] as InternalAxiosRequestConfig);
      return resolved as never;
    }

    const axiosError = error as import('axios').AxiosError;
    if (axiosError.response?.status === 401) {
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      DeviceEventEmitter.emit('auth:logout');
    }

    return Promise.reject(normalizeError(error));
  };
}

function buildResponseSuccessInterceptor() {
  return (response: AxiosResponse): AxiosResponse => response;
}

function createInstance(baseURL: string): AxiosInstance {
  const instance = axios.create({ baseURL, timeout: TIMEOUT_MS });
  instance.interceptors.request.use(buildRequestInterceptor());
  instance.interceptors.response.use(
    buildResponseSuccessInterceptor(),
    buildResponseErrorInterceptor(),
  );
  return instance;
}

export const apiClient: AxiosInstance = createInstance(
  process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
);

export const lunaClient: AxiosInstance = createInstance(
  process.env.EXPO_PUBLIC_LUNA_BASE_URL ?? '',
);
