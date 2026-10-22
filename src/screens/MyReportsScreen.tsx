import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

export default function MyReportsScreen() {
  const insets = useSafeAreaInsets();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      fetchMyAlerts();
    }, [])
  );

  const fetchMyAlerts = async () => {
    try {
      setLoading(true);
      const storedData = await AsyncStorage.getItem('userData');
      if (!storedData) return;
      
      const user = JSON.parse(storedData);
      
      // ⚠️ REEMPLAZA ESTA IP POR LA TUYA REAL (ej. 192.168.100.131)
      const BASE_URL = 'http://192.168.100.131:3000'; 
      const response = await fetch(`${BASE_URL}/alerts/user/${user.id}`);
      
      if (response.ok) {
        const data = await response.json();
        setAlerts(data);
      }
    } catch (error) {
      console.error('Error obteniendo reportes:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return '#F4A261'; 
      case 'IN_PROGRESS': return '#2A9D8F'; 
      case 'RESOLVED': return '#264653'; 
      default: return '#666';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PENDING': return 'Pendiente';
      case 'IN_PROGRESS': return 'En Curso';
      case 'RESOLVED': return 'Resuelto';
      default: return status;
    }
  };

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      day: '2-digit', month: 'short', year: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    };
    return new Date(dateString).toLocaleDateString('es-ES', options);
  };

  const renderAlertCard = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.categoryBadge}>
          <Ionicons name="warning" size={16} color="#E63946" />
          <Text style={styles.categoryText}>{item.category}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
        </View>
      </View>

      <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
      
      {item.address && (
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={16} color="#666" />
          <Text style={styles.addressText} numberOfLines={2}>{item.address}</Text>
        </View>
      )}

      {item.description ? (
        <Text style={styles.descriptionText} numberOfLines={3}>{item.description}</Text>
      ) : null}

      {item.imageUrl && (
        <Image 
          // ⚠️ CORRECCIÓN DE LA FOTO: Apuntamos directamente al servidor estático de NestJS con la IP real
          source={{ uri: `http://192.168.100.131:3000${item.imageUrl}` }} 
          style={styles.alertImage} 
        />
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mis Reportes</Text>
        <Text style={styles.headerSubtitle}>Historial de incidencias enviadas</Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#E63946" />
        </View>
      ) : alerts.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="document-text-outline" size={60} color="#ccc" />
          <Text style={styles.emptyText}>No has enviado ningún reporte aún.</Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => item.id}
          renderItem={renderAlertCard}
          contentContainerStyle={[styles.listContainer, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { padding: 20, backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  headerSubtitle: { fontSize: 14, color: '#666', marginTop: 5 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { fontSize: 16, color: '#666', marginTop: 15, textAlign: 'center' },
  listContainer: { padding: 15 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 15, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  categoryBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffe6e6', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  categoryText: { color: '#E63946', fontWeight: 'bold', marginLeft: 5, fontSize: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusText: { color: '#fff', fontWeight: 'bold', fontSize: 10, textTransform: 'uppercase' },
  dateText: { fontSize: 12, color: '#888', marginBottom: 10 },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  addressText: { fontSize: 14, color: '#444', marginLeft: 5, flex: 1 },
  descriptionText: { fontSize: 14, color: '#333', fontStyle: 'italic', marginBottom: 10, backgroundColor: '#f9f9f9', padding: 10, borderRadius: 8 },
  alertImage: { width: '100%', height: 180, borderRadius: 8, marginTop: 5, backgroundColor: '#eee' },
});