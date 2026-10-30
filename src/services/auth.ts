import AsyncStorage from '@react-native-async-storage/async-storage';

export const BASE_URL = 'https://lules-alerta-api.onrender.com';
export const REQUEST_TIMEOUT_MS = 60000;
export const MAX_PASSWORD_LENGTH = 72;

export const isValidDni = (value: string): boolean =>
  /^\d{7,8}$/.test(value);

export const isValidRecoveryCode = (value: string): boolean =>
  /^\d{6}$/.test(value);

export type AuthUser = {
  id: string;
  nombre?: string;
  dni?: string;
  telefono?: string;
  fotoPerfil?: string | null;
  email?: string;
  direccion?: string;
  barrio?: string;
  contactoEmergenciaNombre?: string;
  contactoEmergenciaTelefono?: string;
  datosMedicos?: string;
};

type LoginResponse = {
  access_token: string;
  user: AuthUser;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object';

const isAuthUser = (value: unknown): value is AuthUser =>
  isRecord(value) && typeof value.id === 'string' && value.id.length > 0;

export const fetchWithTimeout = async (
  url: string,
  init: RequestInit = {},
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('La solicitud superó el tiempo de espera.');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const parseLoginResponse = (value: unknown): LoginResponse => {
  if (
    !isRecord(value) ||
    typeof value.access_token !== 'string' ||
    value.access_token.length === 0 ||
    !isAuthUser(value.user)
  ) {
    throw new Error('La respuesta de autenticación no es válida.');
  }

  return {
    access_token: value.access_token,
    user: value.user,
  };
};

export const getErrorMessage = (value: unknown): string | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (Array.isArray(value.message)) {
    const messages = value.message.filter(
      (message): message is string => typeof message === 'string',
    );
    return messages.length > 0 ? messages.join('\n') : null;
  }

  return typeof value.message === 'string' ? value.message : null;
};

export const getCurrentUser = async (
  token: string,
): Promise<AuthUser | null> => {
  const response = await fetchWithTimeout(`${BASE_URL}/users/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error('No se pudo validar la sesión.');
  }

  const data: unknown = await response.json();

  if (!isAuthUser(data)) {
    throw new Error('La respuesta de sesión no es válida.');
  }

  return data;
};

export const clearSession = async (): Promise<void> => {
  await AsyncStorage.multiRemove(['userToken', 'userData']);
};
