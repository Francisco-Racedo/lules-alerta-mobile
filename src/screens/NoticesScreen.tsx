import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, 
  Modal, TextInput, ScrollView, Linking, Share, Image 
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { BASE_URL } from '../services/auth';

const BARRIOS_LULES = [
  'Todo Lules',
  'Centro',
  'Barrio Pilar',
  'La Reducción',
  'El Manantial',
  'Mercedes',
  'San Rafael',
  'Las Tipas',
  'Villa del Carmen',
  '25 de Mayo',
  '9 de Julio',
  'Belgrano',
  'San Martín',
  'La Quebrada',
];

export default function NoticesScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userBarrio, setUserBarrio] = useState<string>('');
  
  const [selectedBarrio, setSelectedBarrio] = useState<string>('Todo Lules');
  const [selectedSeverity, setSelectedSeverity] = useState<'TODOS' | 'CRITICAL' | 'WARNING' | 'INFO'>('TODOS');
  
  const [barrioModalVisible, setBarrioModalVisible] = useState(false);
  const [searchBarrio, setSearchBarrio] = useState('');

  useFocusEffect(
    React.useCallback(() => {
      loadUserAndNotices();
    }, [selectedBarrio, selectedSeverity])
  );

  const loadUserAndNotices = async () => {
    try {
      setLoading(true);
      const storedData = await AsyncStorage.getItem('userData');
      if (storedData) {
        const user = JSON.parse(storedData);
        if (user.barrio) {
          setUserBarrio(user.barrio.trim());
        }
      }

      const params = new URLSearchParams();
      if (selectedBarrio && selectedBarrio !== 'Todo Lules') {
        params.append('barrio', selectedBarrio);
      }

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const response = await fetch(`${BASE_URL}/notices${queryString}`);

      if (response.ok) {
        let data = await response.json();
        
        if (selectedSeverity !== 'TODOS') {
          data = data.filter((item: any) => item.severity === selectedSeverity);
        }

        setNotices(data);
      }
    } catch (error) {
      console.error('Error cargando avisos:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return { color: '#E63946', bg: '#ffe6e6', label: 'URGENTE', icon: 'alert-circle' as const };
      case 'WARNING':
        return { color: '#F4A261', bg: '#fff3e6', label: 'PRECAUCIÓN', icon: 'warning' as const };
      default:
        return { color: '#2A9D8F', bg: '#e6f7f5', label: 'INFORMATIVO', icon: 'information-circle' as const };
    }
  };

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
    };
    return new Date(dateString).toLocaleDateString('es-ES', options);
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleViewOnMap = (item: any) => {
    navigation.navigate('Mapa', {
      focusLocation: {
        latitude: item.latitude,
        longitude: item.longitude,
        title: item.title,
        address: item.address,
      }
    });
  };

  const handleShare = async (item: any) => {
    try {
      await Share.share({
        message: `📢 *LULES ALERTA - ${item.issuer}*\n\n*${item.title}*\n📍 Zona: ${item.barrio}${item.address ? ` (${item.address})` : ''}\n\n${item.description}`,
      });
    } catch (error) {
      console.error('Error al compartir:', error);
    }
  };

  const filteredBarriosList = BARRIOS_LULES.filter((b) =>
    b.toLowerCase().includes(searchBarrio.toLowerCase())
  );

  const renderNoticeCard = ({ item }: { item: any }) => {
    const sev = getSeverityStyles(item.severity);

    return (
      <View style={[styles.card, { borderLeftColor: sev.color }]}>
        <View style={styles.cardTopRow}>
          <View style={styles.issuerContainer}>
            <Ionicons 
              name={item.sourceType === 'OFICIAL' ? 'shield-checkmark' : 'people'} 
              size={16} 
              color={item.sourceType === 'OFICIAL' ? '#264653' : '#666'} 
            />
            <Text style={styles.issuerText}>{item.issuer}</Text>
          </View>

          <View style={[styles.severityBadge, { backgroundColor: sev.bg }]}>
            <Ionicons name={sev.icon} size={13} color={sev.color} />
            <Text style={[styles.severityText, { color: sev.color }]}>{sev.label}</Text>
          </View>
        </View>

        <Text style={styles.noticeTitle}>{item.title}</Text>
        
        <View style={styles.metaRow}>
          <View style={styles.barrioBadge}>
            <Ionicons name="location" size={12} color="#E63946" />
            <Text style={styles.barrioBadgeText}>{item.barrio}</Text>
          </View>
          <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
        </View>

        {item.address ? (
          <View style={styles.addressBox}>
            <Ionicons name="navigate-circle-outline" size={16} color="#555" />
            <Text style={styles.addressText}>{item.address}</Text>
          </View>
        ) : null}

        <Text style={styles.descriptionText}>{item.description}</Text>

        {item.imageUrl ? (
          <Image 
            source={{ uri: `${BASE_URL}${item.imageUrl}` }} 
            style={styles.noticeImage} 
          />
        ) : null}

        <View style={styles.actionsRow}>
          {item.latitude && item.longitude ? (
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleViewOnMap(item)}>
              <Ionicons name="map-outline" size={16} color="#264653" />
              <Text style={styles.actionBtnText}>Ver en Mapa</Text>
            </TouchableOpacity>
          ) : null}

          {item.contactPhone ? (
            <TouchableOpacity style={[styles.actionBtn, styles.callBtn]} onPress={() => handleCall(item.contactPhone)}>
              <Ionicons name="call-outline" size={16} color="#E63946" />
              <Text style={[styles.actionBtnText, { color: '#E63946' }]}>Llamar ({item.contactPhone})</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.shareBtn} onPress={() => handleShare(item)}>
            <Ionicons name="share-social-outline" size={16} color="#666" />
            <Text style={styles.shareBtnText}>Compartir</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Muro de Avisos</Text>
        <Text style={styles.headerSubtitle}>Comunicados oficiales y alertas de Lules</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.barrioFilterScroll}>
          <TouchableOpacity
            style={[styles.zoneChip, selectedBarrio === 'Todo Lules' && styles.zoneChipActive]}
            onPress={() => setSelectedBarrio('Todo Lules')}
          >
            <Ionicons name="globe-outline" size={14} color={selectedBarrio === 'Todo Lules' ? '#fff' : '#333'} />
            <Text style={[styles.zoneChipText, selectedBarrio === 'Todo Lules' && styles.zoneChipTextActive]}>
              Todo Lules
            </Text>
          </TouchableOpacity>

          {userBarrio ? (
            <TouchableOpacity
              style={[styles.zoneChip, selectedBarrio === userBarrio && styles.zoneChipActive]}
              onPress={() => setSelectedBarrio(userBarrio)}
            >
              <Ionicons name="home-outline" size={14} color={selectedBarrio === userBarrio ? '#fff' : '#333'} />
              <Text style={[styles.zoneChipText, selectedBarrio === userBarrio && styles.zoneChipTextActive]}>
                Mi Barrio ({userBarrio})
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[
              styles.zoneChip,
              selectedBarrio !== 'Todo Lules' && selectedBarrio !== userBarrio && styles.zoneChipActive,
            ]}
            onPress={() => setBarrioModalVisible(true)}
          >
            <Ionicons 
              name="business-outline" 
              size={14} 
              color={selectedBarrio !== 'Todo Lules' && selectedBarrio !== userBarrio ? '#fff' : '#333'} 
            />
            <Text
              style={[
                styles.zoneChipText,
                selectedBarrio !== 'Todo Lules' && selectedBarrio !== userBarrio && styles.zoneChipTextActive,
              ]}
            >
              {selectedBarrio !== 'Todo Lules' && selectedBarrio !== userBarrio
                ? `Zona: ${selectedBarrio}`
                : 'Explorar otro barrio ▼'}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.typeFilterRow}>
          {[
            { key: 'TODOS', label: 'Todos' },
            { key: 'CRITICAL', label: '🚨 Urgentes' },
            { key: 'WARNING', label: '⚠️ Precaución' },
            { key: 'INFO', label: 'ℹ️ Informativos' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.typeTab, selectedSeverity === tab.key && styles.typeTabActive]}
              onPress={() => setSelectedSeverity(tab.key as any)}
            >
              <Text style={[styles.typeTabText, selectedSeverity === tab.key && styles.typeTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#E63946" />
        </View>
      ) : notices.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="notifications-off-outline" size={60} color="#ccc" />
          <Text style={styles.emptyText}>No hay avisos activos para "{selectedBarrio}" con esta clasificación.</Text>
        </View>
      ) : (
        <FlatList
          data={notices}
          keyExtractor={(item) => item.id}
          renderItem={renderNoticeCard}
          contentContainerStyle={[styles.listContainer, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal visible={barrioModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Zona o Barrio</Text>
              <TouchableOpacity onPress={() => setBarrioModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#666" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Buscar barrio en Lules..."
              value={searchBarrio}
              onChangeText={setSearchBarrio}
            />

            <FlatList
              data={filteredBarriosList}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.barrioOption}
                  onPress={() => {
                    setSelectedBarrio(item);
                    setBarrioModalVisible(false);
                    setSearchBarrio('');
                  }}
                >
                  <Ionicons 
                    name={selectedBarrio === item ? 'radio-button-on' : 'radio-button-off'} 
                    size={20} 
                    color={selectedBarrio === item ? '#E63946' : '#888'} 
                  />
                  <Text style={[styles.barrioOptionText, selectedBarrio === item && { fontWeight: 'bold', color: '#E63946' }]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, backgroundColor: '#fff', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 3 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  headerSubtitle: { fontSize: 14, color: '#666', marginTop: 3 },
  barrioFilterScroll: { marginTop: 14, marginBottom: 10 },
  zoneChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f2f5', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#e0e0e0' },
  zoneChipActive: { backgroundColor: '#E63946', borderColor: '#E63946' },
  zoneChipText: { fontSize: 13, color: '#333', fontWeight: '600', marginLeft: 5 },
  zoneChipTextActive: { color: '#fff' },
  typeFilterRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  typeTab: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8, marginHorizontal: 2, backgroundColor: '#f8f9fa' },
  typeTabActive: { backgroundColor: '#333' },
  typeTabText: { fontSize: 12, color: '#666', fontWeight: '600' },
  typeTabTextActive: { color: '#fff' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 25 },
  emptyText: { fontSize: 15, color: '#666', marginTop: 15, textAlign: 'center' },
  listContainer: { padding: 15 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 15, borderLeftWidth: 5, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  issuerContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  issuerText: { fontSize: 12, fontWeight: '700', color: '#264653', marginLeft: 5, textTransform: 'uppercase' },
  severityBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  severityText: { fontSize: 10, fontWeight: 'bold', marginLeft: 4 },
  noticeTitle: { fontSize: 17, fontWeight: 'bold', color: '#222', marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  barrioBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff0f0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  barrioBadgeText: { fontSize: 12, fontWeight: '600', color: '#E63946', marginLeft: 3 },
  dateText: { fontSize: 12, color: '#888' },
  addressBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f4f6f8', padding: 8, borderRadius: 8, marginBottom: 10 },
  addressText: { fontSize: 13, color: '#333', fontWeight: '500', marginLeft: 6, flex: 1 },
  descriptionText: { fontSize: 14, color: '#444', lineHeight: 20, marginBottom: 12 },
  noticeImage: { width: '100%', height: 170, borderRadius: 8, marginBottom: 12 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10, flexWrap: 'wrap', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eef4f7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  callBtn: { backgroundColor: '#ffe6e6' },
  actionBtnText: { fontSize: 12, fontWeight: 'bold', color: '#264653', marginLeft: 5 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 6 },
  shareBtnText: { fontSize: 12, color: '#666', fontWeight: '600', marginLeft: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '75%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  searchInput: { backgroundColor: '#f0f2f5', borderRadius: 10, paddingHorizontal: 15, height: 45, fontSize: 15, marginBottom: 15, color: '#333' },
  barrioOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  barrioOptionText: { fontSize: 16, color: '#333', marginLeft: 12 },
});