import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BASE_URL,
  fetchWithTimeout,
  getErrorMessage,
} from './auth';

const STORED_PUSH_TOKEN_KEY = 'pushToken';

const getProjectId = (): string | undefined =>
  Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

export const registerDeviceForPushNotifications = async (
  accessToken: string,
): Promise<boolean> => {
  if (!Device.isDevice) {
    return false;
  }

  const permissions = await Notifications.getPermissionsAsync();
  let finalStatus = permissions.status;

  if (finalStatus !== Notifications.PermissionStatus.GRANTED) {
    const requestedPermissions = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermissions.status;
  }

  if (finalStatus !== Notifications.PermissionStatus.GRANTED) {
    throw new Error('Las notificaciones están desactivadas para esta aplicación.');
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Alertas',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E63946',
    });
  }

  const projectId = getProjectId();
  if (!projectId) {
    throw new Error('La aplicación todavía no está vinculada a un proyecto EAS.');
  }

  const expoPushToken = await Notifications.getExpoPushTokenAsync({ projectId });
  const response = await fetchWithTimeout(`${BASE_URL}/notifications/push-token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token: expoPushToken.data,
      platform: Platform.OS,
    }),
  });

  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(
      getErrorMessage(data) || 'No se pudo registrar el dispositivo para notificaciones.',
    );
  }

  await AsyncStorage.setItem(STORED_PUSH_TOKEN_KEY, expoPushToken.data);
  return true;
};

export const unregisterDeviceForPushNotifications = async (
  accessToken: string,
): Promise<void> => {
  const token = await AsyncStorage.getItem(STORED_PUSH_TOKEN_KEY);
  if (!token) {
    return;
  }

  const response = await fetchWithTimeout(`${BASE_URL}/notifications/push-token`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });

  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(
      getErrorMessage(data) || 'No se pudo desactivar el dispositivo.',
    );
  }

  await AsyncStorage.removeItem(STORED_PUSH_TOKEN_KEY);
};
