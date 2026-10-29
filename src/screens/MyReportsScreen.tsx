import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

type ReportItem = {
  id: string;
  category?: string;
  status?: string;
  createdAt?: string;
  address?: string;
  description?: string;
  imageUrl?: string | null;
  images?: string[] | null;
};

type ReportsResponse = {
  data: ReportItem[];
  total?: number;
  currentPage?: number;
  lastPage?: number;
};

const BASE_URL = 'http://192.168.100.131:3000';
const REQUEST_TIMEOUT_MS = 8000;

const isReportItem = (value: unknown): value is ReportItem => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as { id?: unknown };
  return typeof item.id === 'string' && item.id.length > 0;
};

const parseReportsResponse = (value: unknown): ReportsResponse => {
  if (!value || typeof value !== 'object') {
    throw new Error('La respuesta del servidor no tiene un formato válido.');
  }

  const response = value as { data?: unknown };

  if (!Array.isArray(response.data) || !response.data.every(isReportItem)) {
    throw new Error('La lista de reportes recibida no es válida.');
  }

  return {
    data: response.data,
  };
};

const fetchWithTimeout = async (
  url: string,
  timeoutMs: number,
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('La solicitud superó el tiempo de espera.');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

export default function MyReportsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const [activeAlerts, setActiveAlerts] = useState<ReportItem[]>([]);
  const [archivedAlerts, setArchivedAlerts] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState('TODOS');

  const loadData = useCallback(
    async (showLoadingIndicator: boolean, isRefresh: boolean) => {
      if (showLoadingIndicator) {
        setLoading(true);
      }

      if (isRefresh) {
        setRefreshing(true);
      }

      setErrorMessage(null);

      try {
        const storedData = await AsyncStorage.getItem('userData');

        if (!storedData) {
          throw new Error('No se encontró la información del usuario.');
        }

        let user: { id?: unknown };

        try {
          user = JSON.parse(storedData) as { id?: unknown };
        } catch {
          throw new Error('La información local del usuario no es válida.');
        }

        if (typeof user.id !== 'string' || user.id.length === 0) {
          throw new Error('El usuario almacenado no tiene un identificador válido.');
        }

                const activeResponse = await fetchWithTimeout(
          `${BASE_URL}/alerts/user/${user.id}?page=1&limit=50&archived=false`,
          REQUEST_TIMEOUT_MS,
        );

        if (!activeResponse.ok) {
          throw new Error(
            `No se pudieron cargar los reportes activos (${activeResponse.status}).`,
          );
        }

        const activeJson: unknown = await activeResponse.json();
        const activeData = parseReportsResponse(activeJson);

                const archivedResponse = await fetchWithTimeout(
          `${BASE_URL}/alerts/user/${user.id}?page=1&limit=50&archived=true`,
          REQUEST_TIMEOUT_MS,
        );

        if (!archivedResponse.ok) {
          throw new Error(
            `No se pudieron cargar los reportes archivados (${archivedResponse.status}).`,
          );
        }

        const archivedJson: unknown = await archivedResponse.json();
        const archivedData = parseReportsResponse(archivedJson);

        setActiveAlerts(activeData.data);
        setArchivedAlerts(archivedData.data);
      } catch {
  setErrorMessage(
    'No pudimos cargar tus reportes en este momento. Inténtalo nuevamente.',
  );
} finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      void loadData(true, false);
    }, [loadData]),
  );

  const onRefresh = () => {
    if (loading || refreshing) {
      return;
    }

    void loadData(false, true);
  };

  const handleRetry = () => {
    void loadData(true, false);
  };

  const handleFilterChange = (selectedFilter: string) => {
    setFilter(selectedFilter);
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'PENDING':
        return '#F4A261';
      case 'IN_PROGRESS':
        return '#2A9D8F';
      case 'RESOLVED':
        return '#264653';
      case 'DISMISSED':
        return '#E63946';
      default:
        return '#666';
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'PENDING':
        return 'PENDIENTE';
      case 'IN_PROGRESS':
        return 'EN CURSO';
      case 'RESOLVED':
        return 'RESUELTO';
      case 'DISMISSED':
        return 'DESCARTADO';
      default:
        return status ? status.toUpperCase() : 'SIN ESTADO';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) {
      return 'Fecha no disponible';
    }

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return 'Fecha no disponible';
    }

    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    };

    return date.toLocaleDateString('es-ES', options);
  };

  const getImageList = (item: ReportItem) => {
    if (Array.isArray(item.images) && item.images.length > 0) {
      return item.images.filter(
        (image): image is string =>
          typeof image === 'string' && image.length > 0,
      );
    }

    return item.imageUrl ? [item.imageUrl] : [];
  };

  const getDisplayedAlerts = () => {
    if (filter === 'ARCHIVED') {
      return archivedAlerts;
    }

    if (filter === 'TODOS') {
      return activeAlerts;
    }

    return activeAlerts.filter((item) => item.status === filter);
  };

  const currentAlerts = getDisplayedAlerts();

  const renderErrorBanner = () => {
    if (!errorMessage || currentAlerts.length === 0) {
      return null;
    }

    return (
      <View style={styles.inlineErrorContainer}>
        <Ionicons
          name="alert-circle-outline"
          size={22}
          color="#B42318"
        />
        <View style={styles.inlineErrorContent}>
          <Text style={styles.inlineErrorTitle}>
            No se pudo actualizar la información
          </Text>
          <Text style={styles.inlineErrorText}>
            No se pudo completar la actualización. Inténtalo nuevamente.
          </Text>
          <TouchableOpacity
            style={styles.inlineRetryButton}
            onPress={handleRetry}
            disabled={loading || refreshing}
          >
            <Text style={styles.inlineRetryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderAlertCard = ({ item }: { item: ReportItem }) => {
    const images = getImageList(item);
    const previewImage = images[0];

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('DetalleReporte', { report: item })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.categoryBadge}>
            <Ionicons name="warning" size={16} color="#E63946" />
            <Text style={styles.categoryText}>
              {item.category || 'Sin categoría'}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(item.status) },
            ]}
          >
            <Text style={styles.statusText}>
              {getStatusText(item.status)}
            </Text>
          </View>
        </View>

        <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>

        {item.address ? (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={16} color="#666" />
            <Text style={styles.addressText} numberOfLines={2}>
              {item.address}
            </Text>
          </View>
        ) : null}

        {item.description ? (
          <Text style={styles.descriptionText} numberOfLines={3}>
            {item.description}
          </Text>
        ) : null}

        {previewImage ? (
          <View style={styles.imagePreviewContainer}>
            <Image
              source={{ uri: `${BASE_URL}${previewImage}` }}
              style={styles.alertImage}
            />

            {images.length > 1 ? (
              <View style={styles.imageCountBadge}>
                <Ionicons name="images-outline" size={14} color="#fff" />
                <Text style={styles.imageCountText}>
                  {images.length} fotos
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-text-outline" size={60} color="#ccc" />
      <Text style={styles.emptyText}>
        No hay reportes en esta categoría.
      </Text>
    </View>
  );

  const renderErrorScreen = () => (
    <View style={styles.errorContainer}>
      <Ionicons name="cloud-offline-outline" size={64} color="#E63946" />
      <Text style={styles.errorTitle}>
        No se pudieron cargar tus reportes
      </Text>
      <Text style={styles.errorText}>
        No pudimos cargar tus reportes en este momento. Comprueba tu conexión e inténtalo nuevamente.
      </Text>

      <TouchableOpacity
        style={styles.retryButton}
        onPress={handleRetry}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.retryButtonText}>Reintentar</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'left', 'right']}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mis Reportes</Text>
        <Text style={styles.headerSubtitle}>
          Historial de incidencias enviadas
        </Text>
      </View>

      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContentContainer}
        >
          {[
            'TODOS',
            'PENDING',
            'IN_PROGRESS',
            'RESOLVED',
            'DISMISSED',
            'ARCHIVED',
          ].map((filterOption) => (
            <TouchableOpacity
              key={filterOption}
              style={[
                styles.filterChip,
                filter === filterOption && styles.filterChipActive,
              ]}
              onPress={() => handleFilterChange(filterOption)}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === filterOption && styles.filterTextActive,
                ]}
              >
                {filterOption === 'TODOS'
                  ? 'TODOS'
                  : filterOption === 'ARCHIVED'
                    ? 'ARCHIVADOS'
                    : getStatusText(filterOption)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#E63946" />
        </View>
      ) : errorMessage && currentAlerts.length === 0 ? (
        renderErrorScreen()
      ) : (
        <FlatList
          data={currentAlerts}
          keyExtractor={(item) => item.id}
          renderItem={renderAlertCard}
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: insets.bottom + 120 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#E63946']}
            />
          }
          ListHeaderComponent={renderErrorBanner}
          ListEmptyComponent={renderEmptyComponent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  filterContainer: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterContentContainer: {
    paddingHorizontal: 15,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 10,
  },
  filterChipActive: {
    backgroundColor: '#333',
  },
  filterText: {
    fontSize: 13,
    color: '#666',
    fontWeight: 'bold',
  },
  filterTextActive: {
    color: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    flex: 1,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 15,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  errorTitle: {
    color: '#333',
    fontSize: 19,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 18,
  },
  errorText: {
    color: '#666',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
  },
  errorDetails: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
  retryButton: {
    backgroundColor: '#E63946',
    borderRadius: 22,
    paddingHorizontal: 28,
    paddingVertical: 12,
    marginTop: 22,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  inlineErrorContainer: {
    flexDirection: 'row',
    backgroundColor: '#FEE4E2',
    borderRadius: 10,
    marginBottom: 15,
    padding: 12,
  },
  inlineErrorContent: {
    flex: 1,
    marginLeft: 10,
  },
  inlineErrorTitle: {
    color: '#B42318',
    fontSize: 14,
    fontWeight: 'bold',
  },
  inlineErrorText: {
    color: '#7A271A',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  inlineRetryButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  inlineRetryButtonText: {
    color: '#B42318',
    fontSize: 13,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 15,
    paddingTop: 15,
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffe6e6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    flexShrink: 1,
  },
  categoryText: {
    color: '#E63946',
    fontWeight: 'bold',
    marginLeft: 5,
    fontSize: 12,
    flexShrink: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginLeft: 8,
  },
  statusText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  dateText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 10,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  addressText: {
    fontSize: 14,
    color: '#444',
    marginLeft: 5,
    flex: 1,
  },
  descriptionText: {
    fontSize: 14,
    color: '#333',
    fontStyle: 'italic',
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 8,
  },
  imagePreviewContainer: {
    position: 'relative',
  },
  alertImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  imageCountBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  imageCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 5,
  },
});