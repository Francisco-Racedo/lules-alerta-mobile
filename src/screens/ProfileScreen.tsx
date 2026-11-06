import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image, ActivityIndicator, ScrollView, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { AuthUser, getCurrentUser, getAssetUrl } from '../services/auth';
import {
  unregisterDeviceForPushNotifications,
} from '../services/pushNotifications';

type ProfileNavigation = {
  navigate: (screen: 'EditProfile') => void;
  reset: (state: { index: number; routes: { name: string }[] }) => void;
};

export default function ProfileScreen({ navigation }: { navigation: ProfileNavigation }) {
  const insets = useSafeAreaInsets();
  const [userData, setUserData] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  useFocusEffect(
    React.useCallback(() => {
      const loadUserData = async () => {
        try {
          if (!hasLoadedRef.current) {
            setLoading(true);
          }
          // 1. Carga inmediata local para evitar esperas
          const data = await AsyncStorage.getItem('userData');
          if (data) {
            setUserData(JSON.parse(data) as AuthUser);
          }

          // 2. Sincronización silenciosa en segundo plano con el backend
          const token = await AsyncStorage.getItem('userToken');
          if (token) {
            const freshUser = await getCurrentUser(token);
            if (freshUser) {
              setUserData(freshUser);
              await AsyncStorage.setItem('userData', JSON.stringify(freshUser));
            }
          }
        } catch (error) {
          console.error('Error al cargar datos del usuario', error);
        } finally {
          setLoading(false);
          hasLoadedRef.current = true;
        }
      };
      void loadUserData();
    }, [])
  );

  const handleCall = async (phone: string) => {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    if (!cleanPhone) return;
    const url = `tel:${cleanPhone}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(`tel:${phone}`);
      }
    } catch (error) {
      console.error('Error al realizar llamada de emergencia:', error);
    }
  };

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
            const token = await AsyncStorage.getItem('userToken');
            try {
              if (token) {
                await unregisterDeviceForPushNotifications(token);
              }
            } catch (error) {
              console.error('Error al desactivar las notificaciones push.', error);
            } finally {
              await AsyncStorage.removeItem('userToken');
              await AsyncStorage.removeItem('userData');
            }
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
    return { uri: getAssetUrl(userData.fotoPerfil) };
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E63946" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 28, 44) }
        ]} 
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.profileHero}>
        <View style={styles.avatarWrapper}>
          {userData?.fotoPerfil ? (
            <Image source={renderAvatarSource()} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Ionicons name="person" size={50} color="#264653" />
            </View>
          )}
        </View>
        
        <Text style={styles.name}>{userData?.nombre || 'Sin nombre registrado'}</Text>
        <Text style={styles.documentText}>DNI {userData?.dni || 'Sin DNI registrado'}</Text>
        
        <View style={styles.profileStatus}>
          <Ionicons name="shield-checkmark" size={14} color="#10B981" />
          <Text style={styles.profileStatusText}>Ciudadano Verificado</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.cardTitleRow}>
          <View style={[styles.cardTitleIcon, styles.personalIcon]}>
            <Ionicons name="person-outline" size={18} color="#1D70B8" />
          </View>
          <Text style={styles.sectionTitle}>Información personal</Text>
        </View>
        <ProfileRow icon="call-outline" label="Teléfono personal" value={userData?.telefono || 'Sin teléfono registrado'} />
        <View style={styles.rowDivider} />
        <ProfileRow icon="mail-outline" label="Correo electrónico" value={userData?.email || 'Sin correo registrado'} />
        <View style={styles.rowDivider} />
        <ProfileRow icon="location-outline" label="Dirección registrada" value={userData?.direccion || 'Sin dirección registrada'} />
        <View style={styles.rowDivider} />
        <ProfileRow icon="navigate-outline" label="Barrio" value={userData?.barrio || 'Sin barrio registrado'} />
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
          label="Contacto de emergencia"
          value={userData?.contactoEmergenciaNombre || 'Sin contacto de emergencia'}
        />
        <View style={styles.rowDivider} />
        <ProfileRow
          icon="call-outline"
          label="Teléfono de emergencia"
          value={userData?.contactoEmergenciaTelefono || 'Sin teléfono de emergencia'}
          onPressAction={userData?.contactoEmergenciaTelefono ? () => handleCall(userData.contactoEmergenciaTelefono!) : undefined}
          actionIcon={userData?.contactoEmergenciaTelefono ? 'call' : undefined}
        />
        <View style={styles.rowDivider} />
        <ProfileRow
          icon="document-text-outline"
          label="Ficha médica / Alergias"
          value={userData?.datosMedicos || 'Sin datos médicos registrados'}
          multiline
        />
      </View>

      <TouchableOpacity 
        style={styles.editButton} 
        onPress={() => navigation.navigate('EditProfile')}
        activeOpacity={0.85}
      >
        <Ionicons name="create-outline" size={20} color="#fff" style={styles.buttonIcon} />
        <Text style={styles.buttonText}>EDITAR PERFIL</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.logoutButton} 
        onPress={handleLogout}
        activeOpacity={0.85}
      >
        <Ionicons name="log-out-outline" size={20} color="#DC2626" style={styles.buttonIcon} />
        <Text style={styles.logoutText}>CERRAR SESIÓN</Text>
      </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileRow({
  icon,
  label,
  value,
  multiline = false,
  onPressAction,
  actionIcon,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  multiline?: boolean;
  onPressAction?: () => void;
  actionIcon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={18} color="#1D70B8" />
      </View>
      <View style={styles.infoTextContainer}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoText} numberOfLines={multiline ? 4 : 1}>
          {value}
        </Text>
      </View>
      {onPressAction && actionIcon ? (
        <TouchableOpacity 
          style={styles.rowActionBtn} 
          onPress={onPressAction} 
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`Llamar a ${label}`}
        >
          <Ionicons name={actionIcon} size={16} color="#E63946" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  
  profileHero: { 
    alignItems: 'center', 
    backgroundColor: '#264653', 
    borderRadius: 24, 
    paddingTop: 24, 
    paddingBottom: 22, 
    marginBottom: 16, 
    elevation: 4, 
    shadowColor: '#264653', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.18, 
    shadowRadius: 8 
  },
  avatarWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  avatarImage: { width: 100, height: 100, borderRadius: 50, borderWidth: 3.5, borderColor: '#fff' },
  avatarFallback: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#E9F5F4', alignItems: 'center', justifyContent: 'center', borderWidth: 3.5, borderColor: '#fff' },
  name: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 12, letterSpacing: -0.3, textTransform: 'capitalize' },
  documentText: { fontSize: 14, color: '#DDEBEA', fontWeight: '600', marginTop: 4 },
  profileStatus: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5, marginTop: 12 },
  profileStatusText: { fontSize: 12, color: '#A7F3D0', fontWeight: '800', marginLeft: 5, letterSpacing: 0.2 },
  
  infoCard: { 
    backgroundColor: '#fff', 
    borderRadius: 18, 
    padding: 16, 
    marginBottom: 14, 
    borderWidth: 1, 
    borderColor: '#ECEFF1', 
    elevation: 2, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.04, 
    shadowRadius: 5 
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardTitleIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  personalIcon: { backgroundColor: '#EBF3FC' },
  emergencyIcon: { backgroundColor: '#FEF2F2' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1E293B', letterSpacing: -0.2 },
  
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, width: '100%' },
  infoIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  infoTextContainer: { flex: 1, marginLeft: 12 },
  infoLabel: { fontSize: 11, color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  infoText: { fontSize: 14, color: '#1E293B', fontWeight: '600', lineHeight: 20 },
  rowDivider: { height: 1, backgroundColor: '#F1F5F9', marginLeft: 46, marginVertical: 2 },
  rowActionBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  
  editButton: { 
    backgroundColor: '#1D70B8', 
    flexDirection: 'row', 
    borderRadius: 14, 
    height: 52, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 12, 
    marginTop: 6,
    elevation: 2, 
    shadowColor: '#1D70B8', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 4 
  },
  logoutButton: { 
    backgroundColor: '#FEF2F2', 
    borderWidth: 1, 
    borderColor: '#FECACA', 
    flexDirection: 'row', 
    borderRadius: 14, 
    height: 52, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 8 
  },
  buttonIcon: { marginRight: 8 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  logoutText: { color: '#DC2626', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
});