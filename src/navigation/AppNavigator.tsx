import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen from '../screens/HomeScreen';
import ReportFormScreen from '../screens/ReportFormScreen';
// Importamos las nuevas pantallas de seguridad
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';

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
      <Tab.Screen name="Mis Reportes">
        {() => <PlaceholderScreen title="Historial de Reportes" />}
      </Tab.Screen>
      <Tab.Screen name="Avisos">
        {() => <PlaceholderScreen title="Muro de Avisos Oficiales" />}
      </Tab.Screen>
      <Tab.Screen name="Perfil">
        {() => <PlaceholderScreen title="Configuración de Cuenta" />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    // Definimos Login como la puerta de entrada principal
    <Stack.Navigator initialRouteName="Login">
      
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
    </Stack.Navigator>
  );
}