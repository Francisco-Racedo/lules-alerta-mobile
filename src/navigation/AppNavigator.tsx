import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import HomeScreen from '../screens/HomeScreen';
import ReportFormScreen from '../screens/ReportFormScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ProfileScreen from '../screens/ProfileScreen';
// 1. Nueva importación agregada
import EditProfileScreen from '../screens/EditProfileScreen';
import MyReportsScreen from '../screens/MyReportsScreen';
import NoticesScreen from '../screens/NoticesScreen';
import DetalleReporteScreen from '../screens/DetalleReporteScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const PlaceholderScreen = ({ title }: { title: string }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text style={{ fontSize: 20, color: '#333' }}>{title}</Text>
  </View>
);

function TabNavigator() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 60 + insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#E63946',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 0,
          elevation: 10,
          shadowColor: '#000',
          shadowOpacity: 0.1,
          shadowOffset: { width: 0, height: -2 },
          height: tabBarHeight,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
        },
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'help-outline';
          if (route.name === 'Mapa') iconName = 'map';
          else if (route.name === 'Mis Reportes') iconName = 'list';
          else if (route.name === 'Avisos') iconName = 'notifications';
          else if (route.name === 'Perfil') iconName = 'person';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Mapa" component={HomeScreen} />
      {/* AQUÍ ESTÁ LA CLAVE: Debe apuntar a MyReportsScreen para que la pestaña muestre el listado */}
      <Tab.Screen name="Mis Reportes" component={MyReportsScreen} />
      <Tab.Screen name="Avisos" component={NoticesScreen} />
      <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('Login');

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const userToken = await AsyncStorage.getItem('userToken');
        if (userToken) {
          // Si el token existe, cambiamos la ruta inicial directamente al mapa
          setInitialRoute('MainTabs');
        }
      } catch (error) {
        console.error('Error leyendo el token de sesión:', error);
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
          title: 'Detalles del Reporte',
          headerStyle: { backgroundColor: '#E63946' },
          headerTintColor: '#fff',
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