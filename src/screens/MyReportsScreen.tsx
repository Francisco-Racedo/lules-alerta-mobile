import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Image, TouchableOpacity, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

export default function MyReportsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  
  // Mantenemos estados separados para evitar cruces
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [archivedAlerts, setArchivedAlerts] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('TODOS');

  const BASE_URL = 'http://192.168.100.131:3000';

  const loadData = async () => {
    try {
      const storedData = await AsyncStorage.getItem('userData');
      if (!storedData) return;
      
      const user = JSON.parse(storedData);
      
      // 1. Buscamos los reportes activos (Secuencial para evitar SocketException)
      const resActive = await fetch(`${BASE_URL}/alerts/user/${user.id}?page=1&limit=50&archived=false`);
      if (resActive.ok) {
        const jsonActive = await resActive.json();
        setActiveAlerts(jsonActive.data || []);
      }

      // 2. Buscamos los reportes archivados
      const resArchived = await fetch(`${BASE_URL}/alerts/user/${user.id}?page=1&limit=50&archived=true`);
      if (resArchived.ok) {
        const jsonArchived = await resArchived.json();
        setArchivedAlerts(jsonArchived.data || []);
      }
    } catch (error) {
      console.error('Error obteniendo reportes:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, []) // Sin dependencias: solo se ejecuta al enfocar la pantalla
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleFilterChange = (selectedFilter: string) => {
    // Cambio instantáneo de pestaña. Cero peticiones de red, cero parpadeos.
    setFilter(selectedFilter);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return '#F4A261'; // Naranja
      case 'IN_PROGRESS': return '#2A9D8F'; // Verde agua
      case 'RESOLVED': return '#264653'; // Azul oscuro
      case 'DISMISSED': return '#E63946'; // Rojo
      default: return '#666';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PENDING': return 'PENDIENTE';
      case 'IN_PROGRESS': return 'EN CURSO';
      case 'RESOLVED': return 'RESUELTO';
      case 'DISMISSED': return 'DESCARTADO';
      default: return status.toUpperCase();
    }
  };

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      day: '2-digit', month: 'short', year: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    };
    return new Date(dateString).toLocaleDateString('es-ES', options);
  };

  const getDisplayedAlerts = () => {
    if (filter === 'ARCHIVED') return archivedAlerts;
    if (filter === 'TODOS') return activeAlerts;
    return activeAlerts.filter(item => item.status === filter);
  };

  const currentAlerts = getDisplayedAlerts();

  const renderAlertCard = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.9} 
      onPress={() => navigation.navigate('DetalleReporte', { report: item })}
    >
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
        <Image source={{ uri: `${BASE_URL}${item.imageUrl}` }} style={styles.alertImage} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mis Reportes</Text>
        <Text style={styles.headerSubtitle}>Historial de incidencias enviadas</Text>
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15 }}>
          {['TODOS', 'PENDING', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED', 'ARCHIVED'].map((f) => (
            <TouchableOpacity 
              key={f} 
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => handleFilterChange(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === 'TODOS' ? 'TODOS' : f === 'ARCHIVED' ? 'ARCHIVADOS' : getStatusText(f)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#E63946" />
        </View>
      ) : (
        <FlatList
          data={currentAlerts}
          keyExtractor={(item) => item.id}
          renderItem={renderAlertCard}
          contentContainerStyle={[styles.listContainer, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#E63946']} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={60} color="#ccc" />
              <Text style={styles.emptyText}>No hay reportes en esta categoría.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { padding: 20, backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, zIndex: 10 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  headerSubtitle: { fontSize: 14, color: '#666', marginTop: 5 },
  filterContainer: { backgroundColor: '#fff', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f0f0f0', marginRight: 10 },
  filterChipActive: { backgroundColor: '#333' },
  filterText: { fontSize: 13, color: '#666', fontWeight: 'bold' },
  filterTextActive: { color: '#fff' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, flex: 1 },
  emptyText: { fontSize: 16, color: '#666', marginTop: 15, textAlign: 'center' },
  listContainer: { padding: 15, paddingTop: 15, flexGrow: 1 },
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