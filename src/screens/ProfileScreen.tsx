import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { AuthUser, BASE_URL } from '../services/auth';

export default function ProfileScreen({ navigation }: any) {
  const [userData, setUserData] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      const loadUserData = async () => {
        try {
          setLoading(true);
          const data = await AsyncStorage.getItem('userData');
          if (data) {
            setUserData(JSON.parse(data) as AuthUser);
          }
        } catch (error) {
          console.error('Error al cargar datos del usuario', error);
        } finally {
          setLoading(false);
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

  const renderAvatarSource = () => {
    if (!userData?.fotoPerfil) return undefined;
    if (userData.fotoPerfil.startsWith('file')) return { uri: userData.fotoPerfil };
    return { uri: `${BASE_URL}${userData.fotoPerfil}` };
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E63946" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.profileHero}>
        {userData?.fotoPerfil ? (
          <Image source={renderAvatarSource()} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarFallback}>
            <Ionicons name="person" size={52} color="#264653" />
          </View>
        )}
        
        <Text style={styles.name}>{userData?.nombre || 'Sin nombre registrado'}</Text>
        
        <Text style={styles.documentText}>DNI: {userData?.dni || 'Sin DNI registrado'}</Text>
        <View style={styles.profileStatus}>
          <Ionicons name="checkmark-circle" size={16} color="#B7E4C7" />
          <Text style={styles.profileStatusText}>Cuenta verificada</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.cardTitleRow}>
          <View style={[styles.cardTitleIcon, styles.personalIcon]}>
            <Ionicons name="person-outline" size={18} color="#264653" />
          </View>
          <Text style={styles.sectionTitle}>Información personal</Text>
        </View>
        <ProfileRow icon="call-outline" value={userData?.telefono || 'Sin teléfono registrado'} />
        <ProfileRow icon="mail-outline" value={userData?.email || 'Sin correo registrado'} />
        <ProfileRow icon="location-outline" value={userData?.direccion || 'Sin dirección registrada'} />
        <ProfileRow icon="navigate-outline" value={userData?.barrio || 'Sin barrio registrado'} />
      </View>

      <View style={styles.infoCard}>
        <View style={styles.cardTitleRow}>
          <View style={[styles.cardTitleIcon, styles.emergencyIcon]}>
            <Ionicons name="medkit-outline" size={18} color="#E63946" />
          </View>
          <Text style={styles.sectionTitle}>Datos para emergencias</Text>
        </View>
        <ProfileRow
          icon="person-outline"
          value={userData?.contactoEmergenciaNombre || 'Sin contacto de emergencia'}
        />
        <ProfileRow
          icon="call-outline"
          value={userData?.contactoEmergenciaTelefono || 'Sin teléfono de emergencia'}
        />
        <ProfileRow
          icon="medkit-outline"
          value={userData?.datosMedicos || 'Sin datos médicos registrados'}
          multiline
        />
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
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileRow({
  icon,
  value,
  multiline = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={19} color="#52757A" />
      </View>
      <Text style={styles.infoText} numberOfLines={multiline ? 3 : 1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  profileHero: { alignItems: 'center', backgroundColor: '#264653', borderRadius: 24, paddingTop: 24, paddingBottom: 22, marginBottom: 18, elevation: 5, shadowColor: '#264653', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  avatarImage: { width: 104, height: 104, borderRadius: 52, borderWidth: 4, borderColor: '#fff' },
  avatarFallback: { width: 104, height: 104, borderRadius: 52, backgroundColor: '#E9F5F4', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#fff' },
  name: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginTop: 12, textTransform: 'capitalize' },
  documentText: { fontSize: 15, color: '#DDEBEA', fontWeight: '600', marginTop: 6 },
  profileStatus: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6, marginTop: 12 },
  profileStatusText: { fontSize: 12, color: '#B7E4C7', fontWeight: '700', marginLeft: 5 },
  infoCard: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#E7EEF0', elevation: 3, shadowColor: '#264653', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 5 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  cardTitleIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  personalIcon: { backgroundColor: '#E9F5F4' },
  emergencyIcon: { backgroundColor: '#FFF0ED' },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, width: '100%' },
  infoIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F3F6F7', alignItems: 'center', justifyContent: 'center' },
  infoText: { fontSize: 15, color: '#263238', marginLeft: 12, flex: 1, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#264653' },
  editButton: { backgroundColor: '#E63946', flexDirection: 'row', borderRadius: 14, height: 56, alignItems: 'center', justifyContent: 'center', marginBottom: 12, elevation: 3, shadowColor: '#E63946', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 5 },
  logoutButton: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E63946', flexDirection: 'row', borderRadius: 14, height: 54, alignItems: 'center', justifyContent: 'center' },
  buttonIcon: { marginRight: 10 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  logoutText: { color: '#E63946', fontSize: 16, fontWeight: 'bold' }
});