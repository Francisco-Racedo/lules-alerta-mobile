import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';
import AppNavigator from './src/navigation/AppNavigator';

// Configuración personalizada para aumentar el tamaño en un ~15%
const toastConfig = {
  success: (props: any) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: '#2A9D8F', height: 75, width: '95%', borderRadius: 10, elevation: 4 }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ fontSize: 17, fontWeight: 'bold', color: '#333' }}
      text2Style={{ fontSize: 14, color: '#666' }}
    />
  ),
  error: (props: any) => (
    <ErrorToast
      {...props}
      style={{ borderLeftColor: '#E63946', height: 75, width: '95%', borderRadius: 10, elevation: 4 }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ fontSize: 17, fontWeight: 'bold', color: '#333' }}
      text2Style={{ fontSize: 14, color: '#666' }}
    />
  )
};

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
      {/* Pasamos la configuración personalizada al componente raíz */}
      <Toast config={toastConfig} /> 
    </SafeAreaProvider>
  );
}