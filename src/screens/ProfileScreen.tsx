import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

export default function ProfileScreen({ navigation }: any) {
  const [userData, setUserData] = useState<any>(null);

  useFocusEffect(
    React.useCallback(() => {
      const loadUserData = async () => {
        try {
          const data = await AsyncStorage.getItem('userData');
          if (data) {
            setUserData(JSON.parse(data));
          }
        } catch (error) {
          console.error('Error al cargar datos del usuario', error);
        }
      };
      loadUserData();
    }, [])
  );

  const handleLogout = async () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que deseas salir de tu cuenta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Salir', 
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('userToken');
            await AsyncStorage.removeItem('userData');
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          }
        }
      ]
    );
  };

  // NUEVA FUNCIÓN: Procesa la URL de la imagen. 
  // (Asegúrate de que la IP sea la correcta de tu servidor)
  const renderAvatarSource = () => {
    if (!userData?.fotoPerfil) return undefined;
    if (userData.fotoPerfil.startsWith('file')) return { uri: userData.fotoPerfil };
    return { uri: `http://192.168.100.131:3000${userData.fotoPerfil}` };
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {/* IMPLEMENTACIÓN DE FOTO: Condicional para mostrar la foto real o el ícono por defecto */}
        {userData?.fotoPerfil ? (
          <Image source={renderAvatarSource()} style={styles.avatarImage} />
        ) : (
          <Ionicons name="person-circle-outline" size={100} color="#E63946" />
        )}
        
        <Text style={styles.name}>{userData?.nombre || 'ESPERANDO NOMBRE...'}</Text>
        
        {/* Lógica del DNI intacta */}
        <Text style={{ fontSize: 16, color: '#666', fontWeight: 'bold', marginTop: 8 }}>
          DNI: {userData?.dni ? userData.dni : 'Sin DNI registrado'}
        </Text>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Ionicons name="call-outline" size={24} color="#666" />
          {/* Lógica del teléfono intacta */}
          <Text style={styles.infoText} numberOfLines={1}>{userData?.telefono || 'ESPERANDO TELÉFONO...'}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <Ionicons name="shield-checkmark-outline" size={24} color="#666" />
          <Text style={styles.infoText} numberOfLines={1}>Cuenta Ciudadana Verificada</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.editButton} 
        onPress={() => navigation.navigate('EditProfile')}
      >
        <Ionicons name="pencil-outline" size={24} color="#fff" style={styles.buttonIcon} />
        <Text style={styles.buttonText}>EDITAR PERFIL</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={24} color="#E63946" style={styles.buttonIcon} />
        <Text style={styles.logoutText}>CERRAR SESIÓN</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { alignItems: 'center', marginTop: 40, marginBottom: 30 },
  
  // NUEVO ESTILO: Formato de la fotografía de perfil
  avatarImage: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#fff' },
  
  name: { fontSize: 24, fontWeight: 'bold', color: '#333', marginTop: 10, textTransform: 'capitalize' },
  infoCard: { backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 15, padding: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, marginBottom: 40 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, width: '100%' },
  infoText: { fontSize: 16, color: '#333', marginLeft: 15, flex: 1 },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 5 },
  editButton: { backgroundColor: '#333', flexDirection: 'row', marginHorizontal: 20, borderRadius: 10, height: 55, alignItems: 'center', justifyContent: 'center', marginBottom: 15, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3 },
  logoutButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E63946', flexDirection: 'row', marginHorizontal: 20, borderRadius: 10, height: 55, alignItems: 'center', justifyContent: 'center', elevation: 1 },
  buttonIcon: { marginRight: 10 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  logoutText: { color: '#E63946', fontSize: 16, fontWeight: 'bold' }
});