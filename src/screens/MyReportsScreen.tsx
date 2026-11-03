import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  DeviceEventEmitter,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { io, type Socket } from 'socket.io-client';
import {
  BASE_URL,
  fetchWithTimeout,
} from '../services/auth';
import type { ReportItem, ReportStatus } from '../types/reports';

type ReportsResponse = {
  data: ReportItem[];
  total: number;
  currentPage: number;
  lastPage: number;
};

type DateFilter = 'ALL' | 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'CUSTOM';

const REPORT_CHANGED_EVENT = 'reportChanged';
const REPORTS_PAGE_SIZE = 25;
const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires';
const ARGENTINA_UTC_OFFSET_HOURS = 3;

const normalizeAddress = (address: string): string =>
  address
    .split(/\s+/)
    .filter((part, index, parts) => {
      const previousPart = parts[index - 1];
      return !previousPart || part.toLocaleLowerCase() !== previousPart.toLocaleLowerCase();
    })
    .join(' ')
    .trim();

const getArgentinaDateParts = (date: Date): {
  year: number;
  month: number;
  day: number;
} => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ARGENTINA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
};

const getArgentinaMidnight = (
  year: number,
  month: number,
  day: number,
): Date => new Date(
  Date.UTC(year, month - 1, day) +
  ARGENTINA_UTC_OFFSET_HOURS * 60 * 60 * 1000,
);

const getReportDateForFilter = (
  report: ReportItem,
  filter: string,
): string => {
  if (filter === 'ARCHIVED') {
    return report.archivedAt ?? report.createdAt;
  }

  if (filter === 'RESOLVED' && report.resolution?.resolvedAt) {
    return report.resolution.resolvedAt;
  }

  if (
    (filter === 'IN_PROGRESS' ||
      filter === 'RESOLVED' ||
      filter === 'DISMISSED') &&
    Array.isArray(report.history)
  ) {
    const statusChange = [...report.history]
      .filter((event) => event.newStatus === filter)
      .sort(
        (first, second) =>
          new Date(second.changedAt).getTime() -
          new Date(first.changedAt).getTime(),
      )[0];

    if (statusChange) {
      return statusChange.changedAt;
    }
  }

  return report.createdAt;
};

const parseDateInput = (value: string, endOfDay: boolean): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = getArgentinaMidnight(year, month, day);
  const nextDay = getArgentinaMidnight(year, month, day + 1);
  const dateParts = getArgentinaDateParts(date);

  if (
    dateParts.year !== year ||
    dateParts.month !== month ||
    dateParts.day !== day
  ) {
    return null;
  }

  return endOfDay ? nextDay : date;
};

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

  const pagination = value as {
    total?: unknown;
    currentPage?: unknown;
    lastPage?: unknown;
  };

  if (
    typeof pagination.total !== 'number' ||
    typeof pagination.currentPage !== 'number' ||
    typeof pagination.lastPage !== 'number'
  ) {
    throw new Error('La paginación de reportes recibida no es válida.');
  }

  return {
    data: response.data,
    total: pagination.total,
    currentPage: pagination.currentPage,
    lastPage: pagination.lastPage,
  };
};

type MyReportsNavigation = {
  navigate: (
    screen: 'DetalleReporte',
    params: { report: ReportItem },
  ) => void;
};

export default function MyReportsScreen({
  navigation,
}: {
  navigation: MyReportsNavigation;
}) {
  const insets = useSafeAreaInsets();

  const [activeAlerts, setActiveAlerts] = useState<ReportItem[]>([]);
  const [archivedAlerts, setArchivedAlerts] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeErrorMessage, setActiveErrorMessage] = useState<string | null>(null);
  const [archivedErrorMessage, setArchivedErrorMessage] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(0);
  const [archivedPage, setArchivedPage] = useState(0);
  const [activeLastPage, setActiveLastPage] = useState(0);
  const [archivedLastPage, setArchivedLastPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState('TODOS');
  const [searchText, setSearchText] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const parsedCustomStartDate = parseDateInput(customStartDate, false);
  const parsedCustomEndDate = parseDateInput(customEndDate, true);
  const hasInvalidCustomDate =
    dateFilter === 'CUSTOM' &&
    (!parsedCustomStartDate ||
      !parsedCustomEndDate ||
      parsedCustomStartDate >= parsedCustomEndDate);

  const loadDataIndependently = useCallback(
    async (showLoadingIndicator: boolean, isRefresh: boolean) => {
      if (showLoadingIndicator) {
        setLoading(true);
      }

      if (isRefresh) {
        setRefreshing(true);
      }

      setActiveErrorMessage(null);
      setArchivedErrorMessage(null);

      try {
        const userToken = await AsyncStorage.getItem('userToken');

        if (!userToken) {
          throw new Error('La sesión no está disponible.');
        }

        const loadCollection = async (
          archived: boolean,
          page: number,
        ): Promise<ReportsResponse> => {
          const response = await fetchWithTimeout(
            `${BASE_URL}/alerts/me?page=${page}&limit=${REPORTS_PAGE_SIZE}&archived=${archived}`,
            {
              headers: {
                Authorization: 'Bearer ' + userToken,
              },
            },
          );

          if (!response.ok) {
            throw new Error(`El servidor respondió con estado ${response.status}.`);
          }

          return parseReportsResponse(await response.json());
        };

        const [activeResult, archivedResult] = await Promise.allSettled([
          loadCollection(false, 1),
          loadCollection(true, 1),
        ]);

        if (activeResult.status === 'fulfilled') {
          setActiveAlerts(activeResult.value.data);
          setActivePage(activeResult.value.currentPage);
          setActiveLastPage(activeResult.value.lastPage);
        } else {
          setActiveErrorMessage(
            'No pudimos cargar tus reportes activos. Inténtalo nuevamente.',
          );
        }

        if (archivedResult.status === 'fulfilled') {
          setArchivedAlerts(archivedResult.value.data);
          setArchivedPage(archivedResult.value.currentPage);
          setArchivedLastPage(archivedResult.value.lastPage);
        } else {
          setArchivedErrorMessage(
            'No pudimos cargar tus reportes archivados. Inténtalo nuevamente.',
          );
        }
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : 'No pudimos validar la sesión.';
        setActiveErrorMessage(message);
        setArchivedErrorMessage(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  const loadMore = useCallback(async () => {
    if (loading || refreshing || loadingMore) {
      return;
    }

    const isArchived = filter === 'ARCHIVED';
    const currentPage = isArchived ? archivedPage : activePage;
    const lastPage = isArchived ? archivedLastPage : activeLastPage;

    if (currentPage === 0 || currentPage >= lastPage) {
      return;
    }

    setLoadingMore(true);

    try {
      const userToken = await AsyncStorage.getItem('userToken');

      if (!userToken) {
        throw new Error('La sesión no está disponible.');
      }

      const nextPage = currentPage + 1;
      const response = await fetchWithTimeout(
        `${BASE_URL}/alerts/me?page=${nextPage}&limit=${REPORTS_PAGE_SIZE}&archived=${isArchived}`,
        {
          headers: {
            Authorization: 'Bearer ' + userToken,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`El servidor respondió con estado ${response.status}.`);
      }

      const result = parseReportsResponse(await response.json());
      const appendWithoutDuplicates = (
        previous: ReportItem[],
      ): ReportItem[] => {
        const existingIds = new Set(previous.map((item) => item.id));
        return [
          ...previous,
          ...result.data.filter((item) => !existingIds.has(item.id)),
        ];
      };

      if (isArchived) {
        setArchivedAlerts(appendWithoutDuplicates);
        setArchivedPage(result.currentPage);
        setArchivedLastPage(result.lastPage);
      } else {
        setActiveAlerts(appendWithoutDuplicates);
        setActivePage(result.currentPage);
        setActiveLastPage(result.lastPage);
      }
    } catch {
      if (isArchived) {
        setArchivedErrorMessage(
          'No pudimos cargar más reportes archivados. Inténtalo nuevamente.',
        );
      } else {
        setActiveErrorMessage(
          'No pudimos cargar más reportes activos. Inténtalo nuevamente.',
        );
      }
    } finally {
      setLoadingMore(false);
    }
  }, [
    activeLastPage,
    activePage,
    archivedLastPage,
    archivedPage,
    filter,
    loading,
    loadingMore,
    refreshing,
  ]);

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;

    const connectToAlerts = async () => {
      const userToken = await AsyncStorage.getItem('userToken');

      if (!userToken || cancelled) {
        return;
      }

      socket = io(BASE_URL, {
        auth: { token: userToken },
        transports: ['websocket'],
      });

      socket.on('alert.changed', () => {
        void loadDataIndependently(false, false);
      });
    };

    void connectToAlerts();

    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [loadDataIndependently]);

  useFocusEffect(
    useCallback(() => {
      void loadDataIndependently(true, false);
    }, [loadDataIndependently]),
  );

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      REPORT_CHANGED_EVENT,
      (reportId: unknown) => {
        if (typeof reportId === 'string' && reportId.length > 0) {
          void loadDataIndependently(false, false);
        }
      },
    );

    return () => subscription.remove();
  }, [loadDataIndependently]);

  const onRefresh = () => {
    if (loading || refreshing) {
      return;
    }

    void loadDataIndependently(false, true);
  };

  const handleRetry = () => {
    void loadDataIndependently(true, false);
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
      timeZone: ARGENTINA_TIME_ZONE,
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
    const collection = filter === 'ARCHIVED' ? archivedAlerts : activeAlerts;
    const statusFilteredAlerts = filter === 'TODOS' || filter === 'ARCHIVED'
      ? collection
      : collection.filter((item) => item.status === filter);
    const now = new Date();
    const today = getArgentinaDateParts(now);
    const startOfToday = getArgentinaMidnight(
      today.year,
      today.month,
      today.day,
    );
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (dateFilter === 'TODAY') {
      startDate = startOfToday;
      endDate = getArgentinaMidnight(
        today.year,
        today.month,
        today.day + 1,
      );
    } else if (dateFilter === 'LAST_7_DAYS' || dateFilter === 'LAST_30_DAYS') {
      const daysToSubtract = dateFilter === 'LAST_7_DAYS' ? 6 : 29;
      const startDateValue = new Date(
        Date.UTC(today.year, today.month - 1, today.day - daysToSubtract),
      );
      startDate = getArgentinaMidnight(
        startDateValue.getUTCFullYear(),
        startDateValue.getUTCMonth() + 1,
        startDateValue.getUTCDate(),
      );
      endDate = getArgentinaMidnight(
        today.year,
        today.month,
        today.day + 1,
      );
    } else if (dateFilter === 'CUSTOM') {
      startDate = parsedCustomStartDate;
      endDate = parsedCustomEndDate;
    }

    const dateFilteredAlerts = hasInvalidCustomDate
      ? []
      : startDate && endDate
      ? statusFilteredAlerts.filter((item) => {
        const reportDate = getReportDateForFilter(item, filter);
        const createdAt = new Date(reportDate).getTime();
        return (
          !Number.isNaN(createdAt) &&
          createdAt >= startDate.getTime() &&
          createdAt < endDate.getTime()
        );
      })
      : statusFilteredAlerts;
    const normalizedSearch = searchText
      .trim()
      .toLocaleLowerCase('es')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (!normalizedSearch) {
      return dateFilteredAlerts;
    }

    return dateFilteredAlerts.filter((item) =>
      [item.category, item.description, item.address]
        .filter((value): value is string => Boolean(value))
        .some((value) =>
          value
            .toLocaleLowerCase('es')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .includes(normalizedSearch),
        ),
    );
  };

  const currentAlerts = getDisplayedAlerts();
  const currentCollectionError = filter === 'ARCHIVED'
    ? archivedErrorMessage
    : activeErrorMessage;

  const getFilterCount = (filterOption: string): number => {
    if (filterOption === 'ARCHIVED') {
      return archivedAlerts.length;
    }

    if (filterOption === 'TODOS') {
      return activeAlerts.length;
    }

    return activeAlerts.filter((item) => item.status === filterOption).length;
  };

  const renderErrorBanner = () => {
    if (!currentCollectionError || currentAlerts.length === 0) {
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
            {currentCollectionError}
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
              {normalizeAddress(item.address)}
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
        {hasInvalidCustomDate
          ? 'Completa correctamente el rango de fechas.'
          : searchText.trim()
          ? 'No encontramos reportes que coincidan con tu búsqueda.'
          : 'No hay reportes en esta categoría.'}
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
        {currentCollectionError || 'No pudimos cargar tus reportes en este momento.'}
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
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#777" />
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Buscar por categoría, descripción o dirección"
            placeholderTextColor="#8A8F98"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchText.length > 0 ? (
            <TouchableOpacity
              onPress={() => setSearchText('')}
              accessibilityLabel="Limpiar búsqueda"
            >
              <Ionicons name="close-circle" size={20} color="#777" />
            </TouchableOpacity>
          ) : null}
        </View>
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
              <View
                style={[
                  styles.filterCount,
                  filter === filterOption && styles.filterCountActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterCountText,
                    filter === filterOption && styles.filterCountTextActive,
                  ]}
                >
                  {getFilterCount(filterOption)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContentContainer}
          style={styles.dateFilterRow}
        >
          {([
            ['ALL', 'Todas las fechas'],
            ['TODAY', 'Hoy'],
            ['LAST_7_DAYS', '7 días'],
            ['LAST_30_DAYS', '30 días'],
            ['CUSTOM', 'Rango'],
          ] as const).map(([dateOption, label]) => (
            <TouchableOpacity
              key={dateOption}
              style={[
                styles.dateFilterChip,
                dateFilter === dateOption && styles.dateFilterChipActive,
              ]}
              onPress={() => setDateFilter(dateOption)}
            >
              <Text
                style={[
                  styles.dateFilterText,
                  dateFilter === dateOption && styles.dateFilterTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {dateFilter === 'CUSTOM' ? (
          <View>
            <View style={styles.customDateContainer}>
            <TextInput
              style={styles.dateInput}
              value={customStartDate}
              onChangeText={setCustomStartDate}
              placeholder="Desde AAAA-MM-DD"
              placeholderTextColor="#8A8F98"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
            <Text style={styles.dateSeparator}>-</Text>
            <TextInput
              style={styles.dateInput}
              value={customEndDate}
              onChangeText={setCustomEndDate}
              placeholder="Hasta AAAA-MM-DD"
              placeholderTextColor="#8A8F98"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
            </View>
            {hasInvalidCustomDate ? (
              <Text style={styles.dateValidationText}>
                Ingresa fechas válidas y asegúrate de que el inicio no sea posterior al final.
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#E63946" />
        </View>
      ) : currentCollectionError && currentAlerts.length === 0 ? (
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
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? (
            <ActivityIndicator
              style={styles.listFooter}
              size="small"
              color="#E63946"
            />
          ) : undefined}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
    borderRadius: 10,
    marginHorizontal: 15,
    marginBottom: 10,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    color: '#333',
    fontSize: 14,
    marginHorizontal: 8,
    paddingVertical: 8,
  },
  dateFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#f0f2f5',
    marginRight: 8,
  },
  dateFilterRow: {
    marginTop: 8,
  },
  dateFilterChipActive: {
    backgroundColor: '#264653',
  },
  dateFilterText: {
    color: '#59636E',
    fontSize: 12,
    fontWeight: '600',
  },
  dateFilterTextActive: {
    color: '#fff',
  },
  customDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 15,
    marginTop: 4,
  },
  dateInput: {
    flex: 1,
    minHeight: 38,
    borderWidth: 1,
    borderColor: '#D5D9DE',
    borderRadius: 8,
    paddingHorizontal: 10,
    color: '#333',
    fontSize: 12,
  },
  dateSeparator: {
    marginHorizontal: 8,
    color: '#667085',
    fontWeight: 'bold',
  },
  dateValidationText: {
    color: '#B42318',
    fontSize: 11,
    marginHorizontal: 15,
    marginTop: 4,
  },
  filterContentContainer: {
    paddingHorizontal: 15,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
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
  filterCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    paddingHorizontal: 5,
    backgroundColor: '#fff',
  },
  filterCountActive: {
    backgroundColor: '#E63946',
  },
  filterCountText: {
    color: '#666',
    fontSize: 11,
    fontWeight: 'bold',
  },
  filterCountTextActive: {
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
  listFooter: {
    marginVertical: 16,
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
