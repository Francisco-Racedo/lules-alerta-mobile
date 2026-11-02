import React, { useEffect, useMemo, useState } from 'react';
import { 
  View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, 
  Modal, TextInput, ScrollView, Linking, Share, Image, RefreshControl,
  DeviceEventEmitter, BackHandler
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import ImageViewer from 'react-native-image-zoom-viewer';
import { BASE_URL, fetchWithTimeout } from '../services/auth';

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
  const [allNotices, setAllNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userBarrio, setUserBarrio] = useState<string>('');
  
  const [selectedBarrio, setSelectedBarrio] = useState<string>('Todo Lules');
  const [selectedSeverity, setSelectedSeverity] = useState<'TODOS' | 'CRITICAL' | 'WARNING' | 'INFO'>('TODOS');
  const [selectedSource, setSelectedSource] = useState<'TODOS' | 'OFICIAL' | 'VECINAL'>('TODOS');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<any | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryImages, setGalleryImages] = useState<{ url: string }[]>([]);
  const [readNoticeIds, setReadNoticeIds] = useState<Set<string>>(new Set());
  
  const [barrioModalVisible, setBarrioModalVisible] = useState(false);
  const [sourceModalVisible, setSourceModalVisible] = useState(false);
  const [searchBarrio, setSearchBarrio] = useState('');

  useFocusEffect(
    React.useCallback(() => {
      void loadUserAndNotices();
    }, [selectedBarrio, selectedSource])
  );

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (galleryVisible) {
          setGalleryVisible(false);
          return true;
        }

        if (selectedNotice) {
          setSelectedNotice(null);
          return true;
        }

        if (sourceModalVisible) {
          setSourceModalVisible(false);
          return true;
        }

        if (barrioModalVisible) {
          setBarrioModalVisible(false);
          return true;
        }

        return false;
      },
    );

    return () => subscription.remove();
  }, [barrioModalVisible, galleryVisible, selectedNotice, sourceModalVisible]);

  const loadUserAndNotices = async (isRefresh = false) => {
    try {
      setLoading(true);
      setRefreshing(isRefresh);
      setErrorMessage(null);
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
      if (selectedSource !== 'TODOS') {
        params.append('sourceType', selectedSource);
      }

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const response = await fetchWithTimeout(`${BASE_URL}/notices${queryString}`);

      if (!response.ok) {
        throw new Error(`El servidor respondió con estado ${response.status}.`);
      }

      let data = await response.json();

      setAllNotices(Array.isArray(data) ? data : []);

      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        const readResponse = await fetchWithTimeout(`${BASE_URL}/notices/read`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!readResponse.ok) {
          throw new Error(`No se pudo cargar el estado de lectura (${readResponse.status}).`);
        }

        const readIds: unknown = await readResponse.json();
        if (!Array.isArray(readIds) || !readIds.every((id) => typeof id === 'string')) {
          throw new Error('La respuesta de lectura no es válida.');
        }
        setReadNoticeIds(new Set(readIds));
      }
    } catch (error) {
      console.error('Error cargando avisos:', error);
      setErrorMessage('No se pudieron cargar los avisos. Inténtalo nuevamente.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const notices = useMemo(
    () => {
      const severityNotices = selectedSeverity === 'TODOS'
        ? allNotices
        : allNotices.filter((item) => item.severity === selectedSeverity);

      if (!unreadOnly) {
        return severityNotices;
      }

      return severityNotices.filter((item) => !readNoticeIds.has(item.id));
    },
    [allNotices, readNoticeIds, selectedSeverity, unreadOnly],
  );

  const unreadNoticeCount = useMemo(
    () => allNotices.filter((item) => !readNoticeIds.has(item.id)).length,
    [allNotices, readNoticeIds],
  );

  const hasActiveFilters =
    selectedBarrio !== 'Todo Lules' ||
    selectedSeverity !== 'TODOS' ||
    selectedSource !== 'TODOS' ||
    unreadOnly;

  const emptyState = useMemo(() => {
    if (allNotices.length === 0) {
      return {
        icon: 'notifications-off-outline' as const,
        title: 'No hay avisos activos',
        message: 'En este momento no hay comunicados disponibles para consultar.',
        showClearFilters: false,
      };
    }

    if (unreadOnly && unreadNoticeCount === 0) {
      return {
        icon: 'checkmark-done-outline' as const,
        title: 'No hay avisos sin leer',
        message: 'Ya consultaste todos los avisos disponibles.',
        showClearFilters: false,
      };
    }

    return {
      icon: 'filter-outline' as const,
      title: 'No hay resultados',
      message: hasActiveFilters
        ? 'No hay avisos que coincidan con los filtros seleccionados.'
        : 'No hay avisos para mostrar en este momento.',
      showClearFilters: hasActiveFilters,
    };
  }, [
    allNotices.length,
    hasActiveFilters,
    unreadNoticeCount,
    unreadOnly,
  ]);

  const clearNoticeFilters = () => {
    setSelectedBarrio('Todo Lules');
    setSelectedSeverity('TODOS');
    setSelectedSource('TODOS');
    setUnreadOnly(false);
  };

  const openGallery = (images: string[], index: number) => {
    setGalleryImages(
      images.map((image) => ({ url: `${BASE_URL}${image}` })),
    );
    setSelectedImageIndex(index);
    setGalleryVisible(true);
  };

  useEffect(() => {
    navigation.setOptions({
      tabBarBadge:
        unreadNoticeCount > 0
          ? unreadNoticeCount > 99
            ? '99+'
            : String(unreadNoticeCount)
          : undefined,
      tabBarBadgeStyle: styles.tabBarBadge,
    });

    return () => {
      navigation.setOptions({
        tabBarBadge: undefined,
      });
    };
  }, [navigation, unreadNoticeCount]);

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

  const getExpirationStatus = (expiresAt?: string | Date | null) => {
    if (!expiresAt) {
      return null;
    }

    const expirationTime = expiresAt instanceof Date
      ? expiresAt.getTime()
      : Date.parse(expiresAt);
    const remainingTime = expirationTime - Date.now();

    if (!Number.isFinite(expirationTime) || remainingTime <= 0 || remainingTime > 24 * 60 * 60 * 1000) {
      return null;
    }

    if (remainingTime <= 60 * 60 * 1000) {
      return {
        label: `Vence en ${Math.max(1, Math.ceil(remainingTime / 60000))} min`,
        color: '#C2410C',
        backgroundColor: '#FFEDD5',
      };
    }

    return {
      label: `Vence en ${Math.ceil(remainingTime / (60 * 60 * 1000))} h`,
      color: '#B45309',
      backgroundColor: '#FEF3C7',
    };
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleViewOnMap = (item: any) => {
    const latitude = Number(item.latitude);
    const longitude = Number(item.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    const focusLocation = {
      latitude,
      longitude,
      title: item.title,
      address: item.address,
    };

    DeviceEventEmitter.emit('focusNoticeLocation', focusLocation);
    navigation.navigate('Mapa', { focusLocation });
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

  const markNoticeAsRead = async (noticeId: string) => {
    const token = await AsyncStorage.getItem('userToken');
    if (!token || readNoticeIds.has(noticeId)) {
      return;
    }

    const response = await fetchWithTimeout(`${BASE_URL}/notices/${noticeId}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`No se pudo marcar el aviso como leído (${response.status}).`);
    }

    setReadNoticeIds((current) => {
      const next = new Set(current);
      next.add(noticeId);
      return next;
    });
  };

  const filteredBarriosList = BARRIOS_LULES.filter((b) =>
    b.toLowerCase().includes(searchBarrio.toLowerCase())
  );

  const renderNoticeCard = ({ item }: { item: any }) => {
    const sev = getSeverityStyles(item.severity);
    const expiration = getExpirationStatus(item.expiresAt);
    const noticeImages = Array.isArray(item.images) && item.images.length > 0
      ? item.images
      : item.imageUrl
        ? [item.imageUrl]
        : [];

    const isUnread = !readNoticeIds.has(item.id);

    return (
      <View style={[styles.card, { borderLeftColor: sev.color }, isUnread && styles.unreadCard]}>
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

        <View style={styles.titleRow}>
          <Text style={styles.noticeTitle}>{item.title}</Text>
          {isUnread ? <Text style={styles.unreadLabel}>NUEVO</Text> : null}
        </View>
        
        <View style={styles.metaRow}>
          <View style={styles.barrioBadge}>
            <Ionicons name="location" size={12} color="#E63946" />
            <Text style={styles.barrioBadgeText}>{item.barrio}</Text>
          </View>
          <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
        </View>

        {expiration ? (
          <View style={[styles.expirationBadge, { backgroundColor: expiration.backgroundColor }]}>
            <Ionicons name="time-outline" size={13} color={expiration.color} />
            <Text style={[styles.expirationText, { color: expiration.color }]}>{expiration.label}</Text>
          </View>
        ) : null}

        {item.address ? (
          <View style={styles.addressBox}>
            <Ionicons name="navigate-circle-outline" size={16} color="#555" />
            <Text style={styles.addressText}>{item.address}</Text>
          </View>
        ) : null}

        <Text style={styles.descriptionText}>{item.description}</Text>

        {noticeImages.length > 0 ? (
          <Image 
            source={{ uri: `${BASE_URL}${noticeImages[0]}` }}
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
        <TouchableOpacity
          style={styles.detailBtn}
          onPress={() => {
            setSelectedImageIndex(0);
            setSelectedNotice(item);
            void markNoticeAsRead(item.id).catch((error) => {
              console.error('Error marcando aviso como leído:', error);
            });
          }}
        >
          <Ionicons name="open-outline" size={16} color="#264653" />
          <Text style={styles.detailBtnText}>Ver detalle completo</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Muro de Avisos</Text>
        <Text style={styles.headerSubtitle}>
          Comunicados oficiales y alertas de Lules
        </Text>

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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.severityFilterScroll}
          contentContainerStyle={styles.severityFilterContent}
        >
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
                <Text
                  numberOfLines={1}
                  style={[styles.typeTabText, selectedSeverity === tab.key && styles.typeTabTextActive]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.sourceButton, selectedSource !== 'TODOS' && styles.sourceButtonActive]}
            onPress={() => setSourceModalVisible(true)}
          >
            <Ionicons
              name="options-outline"
              size={14}
              color={selectedSource !== 'TODOS' ? '#fff' : '#264653'}
            />
            <Text style={[styles.sourceButtonText, selectedSource !== 'TODOS' && styles.sourceButtonTextActive]}>
              {selectedSource === 'TODOS' ? 'Origen' : selectedSource === 'OFICIAL' ? 'Oficial' : 'Vecinal'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.unreadFilterButton, unreadOnly && styles.unreadFilterButtonActive]}
            onPress={() => setUnreadOnly((current) => !current)}
          >
            <Ionicons
              name={unreadOnly ? 'mail-unread' : 'mail-unread-outline'}
              size={14}
              color={unreadOnly ? '#fff' : '#264653'}
            />
            <Text
              style={[
                styles.unreadFilterButtonText,
                unreadOnly && styles.unreadFilterButtonTextActive,
              ]}
            >
              Sin leer ({unreadNoticeCount})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#E63946" />
        </View>
      ) : errorMessage ? (
        <View style={styles.centerContainer}>
          <Ionicons name="cloud-offline-outline" size={60} color="#ccc" />
          <Text style={styles.emptyText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void loadUserAndNotices()}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : notices.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name={emptyState.icon} size={60} color="#ccc" />
          <Text style={styles.emptyTitle}>{emptyState.title}</Text>
          <Text style={styles.emptyText}>{emptyState.message}</Text>
          {emptyState.showClearFilters ? (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={clearNoticeFilters}
            >
              <Text style={styles.retryButtonText}>Limpiar filtros</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={notices}
          keyExtractor={(item) => item.id}
          renderItem={renderNoticeCard}
          contentContainerStyle={[styles.listContainer, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadUserAndNotices(true)}
              colors={['#E63946']}
            />
          }
        />
      )}

      <Modal
        visible={barrioModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setBarrioModalVisible(false)}
      >
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

      <Modal
        visible={sourceModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSourceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtrar por origen</Text>
              <TouchableOpacity onPress={() => setSourceModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#666" />
              </TouchableOpacity>
            </View>
            {[
              { key: 'TODOS', label: 'Todos los avisos' },
              { key: 'OFICIAL', label: 'Avisos oficiales' },
              { key: 'VECINAL', label: 'Avisos vecinales' },
            ].map((option) => (
              <TouchableOpacity
                key={option.key}
                style={styles.barrioOption}
                onPress={() => {
                  setSelectedSource(option.key as typeof selectedSource);
                  setSourceModalVisible(false);
                }}
              >
                <Ionicons
                  name={selectedSource === option.key ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={selectedSource === option.key ? '#E63946' : '#888'}
                />
                <Text style={[styles.barrioOptionText, selectedSource === option.key && { fontWeight: 'bold', color: '#E63946' }]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(selectedNotice)}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedNotice(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalle del aviso</Text>
              <TouchableOpacity onPress={() => setSelectedNotice(null)}>
                <Ionicons name="close-circle" size={28} color="#666" />
              </TouchableOpacity>
            </View>
            {selectedNotice ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                {(() => {
                  const noticeImages = Array.isArray(selectedNotice.images) && selectedNotice.images.length > 0
                    ? selectedNotice.images
                    : selectedNotice.imageUrl
                      ? [selectedNotice.imageUrl]
                      : [];
                  return noticeImages.length > 0 ? (
                    <>
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => openGallery(noticeImages, selectedImageIndex)}
                      >
                        <Image
                          source={{ uri: `${BASE_URL}${noticeImages[selectedImageIndex]}` }}
                          style={styles.detailImage}
                          resizeMode="contain"
                        />
                      </TouchableOpacity>
                      <Text style={styles.galleryHint}>
                        Toca la imagen para ampliar
                      </Text>
                      {noticeImages.length > 1 ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailRow}>
                          {noticeImages.map((imageUrl: string, index: number) => (
                            <TouchableOpacity
                              key={imageUrl}
                              onPress={() => setSelectedImageIndex(index)}
                              style={[styles.thumbnailButton, index === selectedImageIndex && styles.thumbnailButtonActive]}
                            >
                              <Image
                                source={{ uri: `${BASE_URL}${imageUrl}` }}
                                style={styles.thumbnailImage}
                                resizeMode="cover"
                              />
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      ) : null}
                    </>
                  ) : null;
                })()}
                <Text style={styles.noticeTitle}>{selectedNotice.title}</Text>
                <Text style={styles.detailIssuer}>{selectedNotice.issuer}</Text>
                <Text style={styles.detailDate}>{formatDate(selectedNotice.createdAt)}</Text>
                {(() => {
                  const expiration = getExpirationStatus(selectedNotice.expiresAt);
                  return expiration ? (
                    <View style={[styles.expirationBadge, styles.detailExpirationBadge, { backgroundColor: expiration.backgroundColor }]}>
                      <Ionicons name="time-outline" size={14} color={expiration.color} />
                      <Text style={[styles.expirationText, { color: expiration.color }]}>{expiration.label}</Text>
                    </View>
                  ) : null;
                })()}
                <Text style={styles.detailDescription}>{selectedNotice.description}</Text>
                {selectedNotice.address ? (
                  <Text style={styles.detailMeta}>Ubicación: {selectedNotice.address}</Text>
                ) : null}
                <Text style={styles.detailMeta}>Zona: {selectedNotice.barrio}</Text>
                <View style={styles.detailActions}>
                  {selectedNotice.latitude && selectedNotice.longitude ? (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => {
                        setSelectedNotice(null);
                        handleViewOnMap(selectedNotice);
                      }}
                    >
                      <Ionicons name="map-outline" size={16} color="#264653" />
                      <Text style={styles.actionBtnText}>Ver en mapa</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={styles.shareBtn} onPress={() => void handleShare(selectedNotice)}>
                    <Ionicons name="share-social-outline" size={16} color="#666" />
                    <Text style={styles.shareBtnText}>Compartir</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={galleryVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGalleryVisible(false)}
      >
        <View style={styles.galleryModal}>
          <TouchableOpacity
            style={styles.galleryCloseButton}
            onPress={() => setGalleryVisible(false)}
            accessibilityLabel="Cerrar galería"
          >
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          <ImageViewer
            imageUrls={galleryImages}
            index={selectedImageIndex}
            onChange={(index) => {
              if (typeof index === 'number') {
                setSelectedImageIndex(index);
              }
            }}
            enableSwipeDown
            onSwipeDown={() => setGalleryVisible(false)}
            backgroundColor="rgba(0,0,0,0.96)"
            style={{ width: '100%', height: '100%' }}
            useNativeDriver
            renderIndicator={(currentIndex = 0, allSize = 0) =>
              allSize > 1 ? (
                <View style={styles.galleryIndicator}>
                  <Text style={styles.galleryIndicatorText}>
                    {currentIndex} / {allSize}
                  </Text>
                </View>
              ) : (
                <View />
              )
            }
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, backgroundColor: '#fff', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 3 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  headerSubtitle: { fontSize: 14, color: '#666', flex: 1 },
  tabBarBadge: { backgroundColor: '#E63946', color: '#fff', fontSize: 10, fontWeight: '700' },
  barrioFilterScroll: { marginTop: 14, marginBottom: 10 },
  zoneChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f2f5', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#e0e0e0' },
  zoneChipActive: { backgroundColor: '#E63946', borderColor: '#E63946' },
  zoneChipText: { fontSize: 13, color: '#333', fontWeight: '600', marginLeft: 5 },
  zoneChipTextActive: { color: '#fff' },
  typeTab: { minWidth: 92, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8, marginRight: 6, backgroundColor: '#f8f9fa' },
  typeTabActive: { backgroundColor: '#333' },
  typeTabText: { fontSize: 12, color: '#666', fontWeight: '600' },
  typeTabTextActive: { color: '#fff' },
  severityFilterScroll: { marginTop: 8 },
  severityFilterContent: { alignItems: 'center', paddingRight: 4 },
  typeFilterRow: { flexDirection: 'row', alignItems: 'center' },
  sourceButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, marginLeft: 6, backgroundColor: '#eef4f7' },
  sourceButtonActive: { backgroundColor: '#264653' },
  sourceButtonText: { fontSize: 12, color: '#264653', fontWeight: '700', marginLeft: 4 },
  sourceButtonTextActive: { color: '#fff' },
  unreadFilterButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, marginLeft: 6, backgroundColor: '#eef4f7' },
  unreadFilterButtonActive: { backgroundColor: '#E63946' },
  unreadFilterButtonText: { fontSize: 12, color: '#264653', fontWeight: '700', marginLeft: 4 },
  unreadFilterButtonTextActive: { color: '#fff' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 25 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginTop: 15, textAlign: 'center' },
  emptyText: { fontSize: 15, color: '#666', marginTop: 15, textAlign: 'center' },
  retryButton: { backgroundColor: '#E63946', borderRadius: 8, paddingHorizontal: 22, paddingVertical: 10, marginTop: 16 },
  retryButtonText: { color: '#fff', fontWeight: 'bold' },
  listContainer: { padding: 15 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 15, borderLeftWidth: 5, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  unreadCard: { backgroundColor: '#fffaf0' },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  issuerContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  issuerText: { fontSize: 12, fontWeight: '700', color: '#264653', marginLeft: 5, textTransform: 'uppercase' },
  severityBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  severityText: { fontSize: 10, fontWeight: 'bold', marginLeft: 4 },
  noticeTitle: { fontSize: 17, fontWeight: 'bold', color: '#222', marginBottom: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  unreadLabel: { color: '#E63946', fontSize: 10, fontWeight: 'bold', marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  barrioBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff0f0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  barrioBadgeText: { fontSize: 12, fontWeight: '600', color: '#E63946', marginLeft: 3 },
  dateText: { fontSize: 12, color: '#888' },
  expirationBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12, marginBottom: 10 },
  detailExpirationBadge: { marginTop: 10 },
  expirationText: { fontSize: 12, fontWeight: '700', marginLeft: 4 },
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
  detailBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10, marginTop: 10 },
  detailBtnText: { color: '#264653', fontWeight: '700', marginLeft: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '75%' },
  detailModalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  detailIssuer: { color: '#264653', fontWeight: '700', marginTop: 8, textTransform: 'uppercase' },
  detailDate: { color: '#777', marginTop: 4 },
  detailDescription: { color: '#333', fontSize: 16, lineHeight: 24, marginTop: 18 },
  detailMeta: { color: '#555', marginTop: 12 },
  detailImage: { width: '100%', height: 220, marginTop: 18, borderRadius: 10 },
  galleryHint: { color: '#777', fontSize: 12, marginTop: 6, textAlign: 'center' },
  galleryModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' },
  galleryCloseButton: { position: 'absolute', top: 44, right: 20, zIndex: 2, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  galleryIndicator: { position: 'absolute', top: 52, left: 20, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.55)' },
  galleryIndicatorText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  thumbnailRow: { marginTop: 10, marginBottom: 8 },
  thumbnailButton: { marginRight: 8, borderRadius: 8, borderWidth: 2, borderColor: 'transparent' },
  thumbnailButtonActive: { borderColor: '#E63946' },
  thumbnailImage: { width: 64, height: 64, borderRadius: 6 },
  detailActions: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  searchInput: { backgroundColor: '#f0f2f5', borderRadius: 10, paddingHorizontal: 15, height: 45, fontSize: 15, marginBottom: 15, color: '#333' },
  barrioOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  barrioOptionText: { fontSize: 16, color: '#333', marginLeft: 12 },
});