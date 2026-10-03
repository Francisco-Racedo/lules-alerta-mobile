import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, Text } from 'react-native';
// Importamos el hook para calcular los bordes físicos del celular
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeScreen from '../screens/HomeScreen';

const Tab = createBottomTabNavigator();

const PlaceholderScreen = ({ title }: { title: string }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text style={{ fontSize: 20, color: '#333' }}>{title}</Text>
  </View>
);

export default function AppNavigator() {
  const insets = useSafeAreaInsets(); // Obtenemos las medidas del marco del teléfono

  // Calculamos la altura dinámica: 60px base + el espacio de los botones de Android
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
          height: tabBarHeight, // Altura dinámica
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8, // Empujamos los íconos hacia arriba
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