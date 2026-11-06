import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, ActivityIndicator, DeviceEventEmitter, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BASE_URL,
  clearSession,
  fetchWithTimeout,
  getCurrentUser,
} from '../services/auth';
import { registerDeviceForPushNotifications } from '../services/pushNotifications';

import HomeScreen from '../screens/HomeScreen';
import ReportFormScreen from '../screens/ReportFormScreen';
import LoginScreen from '../screens/LoginScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ProfileScreen from '../screens/ProfileScreen';
// 1. Nueva importación agregada
import EditProfileScreen from '../screens/EditProfileScreen';
import MyReportsScreen from '../screens/MyReportsScreen';
import NoticesScreen from '../screens/NoticesScreen';
import DetalleReporteScreen from '../screens/DetalleReporteScreen';
import type { RootStackParamList } from './navigation.types';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

const PlaceholderScreen = ({ title }: { title: string }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text style={{ fontSize: 20, color: '#333' }}>{title}</Text>
  </View>
);

function TabNavigator() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 62 + insets.bottom;
  const [unreadNotices, setUnreadNotices] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;

    const fetchUnread = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (!token) return;

        const [noticesRes, readRes] = await Promise.all([
          fetchWithTimeout(`${BASE_URL}/notices`),
          fetchWithTimeout(`${BASE_URL}/notices/read`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (noticesRes.ok && readRes.ok && isMounted) {
          const notices: unknown = await noticesRes.json();
          const readIds: unknown = await readRes.json();
          if (Array.isArray(notices) && Array.isArray(readIds)) {
            const readSet = new Set(readIds);
            const unread = notices.filter((n: { id: string }) => !readSet.has(n.id)).length;
            setUnreadNotices(unread);
          }
        }
      } catch {
        // Silencioso
      }
    };

    void fetchUnread();
    const sub = DeviceEventEmitter.addListener('noticesReadUpdated', () => {
      void fetchUnread();
    });

    return () => {
      isMounted = false;
      sub.remove();
    };
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#264653',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: -0.2,
          marginTop: -2,
        },
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          elevation: 10,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowOffset: { width: 0, height: -3 },
          shadowRadius: 8,
          height: tabBarHeight,
          paddingTop: 6,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
        },
        tabBarIcon: ({ color, focused }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'help-outline';
          if (route.name === 'Mapa') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Mis Reportes') {
            iconName = focused ? 'file-tray-full' : 'file-tray-full-outline';
          } else if (route.name === 'Avisos') {
            iconName = focused ? 'notifications' : 'notifications-outline';
          } else if (route.name === 'Perfil') {
            iconName = focused ? 'person' : 'person-outline';
          }
          return <Ionicons name={iconName} size={24} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Mapa" component={HomeScreen} />
      <Tab.Screen name="Mis Reportes" component={MyReportsScreen} />
      <Tab.Screen 
        name="Avisos" 
        component={NoticesScreen} 
        options={{
          tabBarBadge: unreadNotices > 0 ? unreadNotices : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#DC2626',
            color: '#fff',
            fontSize: 10,
            fontWeight: '800',
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            lineHeight: 16,
            marginTop: 2,
          },
        }}
      />
      <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] =
    useState<keyof RootStackParamList>('Login');

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const userToken = await AsyncStorage.getItem('userToken');

        if (!userToken) {
          return;
        }

        const currentUser = await getCurrentUser(userToken);

        if (!currentUser) {
          await clearSession();
          return;
        }

        await AsyncStorage.setItem(
          'userData',
          JSON.stringify(currentUser),
        );
        setInitialRoute('MainTabs');
        void registerDeviceForPushNotifications(userToken).catch((error) => {
          console.error('Error al registrar el dispositivo para notificaciones push.', error);
        });
      } catch {
        setInitialRoute('Login');
      } finally {
        setIsLoading(false);
      }
    };

    checkLoginStatus();
  }, []);

  // Pantalla de carga mientras se verifica la memoria del dispositivo
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' }}>
        <ActivityIndicator size="large" color="#E63946" />
      </View>
    );
  }

  return (
    <Stack.Navigator initialRouteName={initialRoute}>
      
      {/* 1. Flujo de Autenticación */}
      <Stack.Screen 
        name="Login" 
        component={LoginScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="Register" 
        component={RegisterScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ headerShown: false }}
      />

      {/* 2. Aplicación Principal (Protegida) */}
      <Stack.Screen 
        name="MainTabs" 
        component={TabNavigator} 
        options={{ headerShown: false }} 
      />
      
      {/* 3. Formularios y Modales */}
      <Stack.Screen 
        name="ReportForm" 
        component={ReportFormScreen} 
        options={{ 
          headerShown: false,
          presentation: 'modal'
        }} 
      />
      
      {/* 2. Nueva pantalla de edición de perfil registrada */}
      <Stack.Screen 
        name="EditProfile" 
        component={EditProfileScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="DetalleReporte" 
        component={DetalleReporteScreen} 
        options={{ headerShown: false }} 
      />
    </Stack.Navigator>
  );
}