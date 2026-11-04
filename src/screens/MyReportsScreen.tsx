import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { io, type Socket } from 'socket.io-client';
import {
  BASE_URL,
  fetchWithTimeout,
  getAssetUrl,
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
  navigate: {
    (screen: 'DetalleReporte', params: { report: ReportItem }): void;
    (screen: 'Mapa'): void;
  };
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
  const [isDateModalVisible, setIsDateModalVisible] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const parsedCustomStartDate = parseDateInput(customStartDate, false);
  const parsedCustomEndDate = parseDateInput(customEndDate, true);
  const hasInvalidCustomDate =
    dateFilter === 'CUSTOM' &&
    (!parsedCustomStartDate ||
      !parsedCustomEndDate ||
      parsedCustomStartDate >= parsedCustomEndDate);

  const [tempCustomStartDate, setTempCustomStartDate] = useState('');
  const [tempCustomEndDate, setTempCustomEndDate] = useState('');
  const [tempDateFilter, setTempDateFilter] = useState<DateFilter>('ALL');

  const openDateModal = () => {
    setTempDateFilter(dateFilter);
    setTempCustomStartDate(customStartDate);
    setTempCustomEndDate(customEndDate);
    setIsDateModalVisible(true);
  };

  const applyDateFilter = () => {
    setDateFilter(tempDateFilter);
    if (tempDateFilter === 'CUSTOM') {
      setCustomStartDate(tempCustomStartDate);
      setCustomEndDate(tempCustomEndDate);
    }
    setIsDateModalVisible(false);
  };

  const resetDateFilter = () => {
    setTempDateFilter('ALL');
    setTempCustomStartDate('');
    setTempCustomEndDate('');
    setDateFilter('ALL');
    setCustomStartDate('');
    setCustomEndDate('');
    setIsDateModalVisible(false);
  };

  const getDateFilterBadge = (): string => {
    switch (dateFilter) {
      case 'TODAY':
        return 'Hoy';
      case 'LAST_7_DAYS':
        return '7d';
      case 'LAST_30_DAYS':
        return '30d';
      case 'CUSTOM':
        return 'Rango';
      case 'ALL':
      default:
        return 'Todas';
    }
  };

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

  const hasLoadedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      const showSpinner = !hasLoadedRef.current;
      void loadDataIndependently(showSpinner, false).finally(() => {
        hasLoadedRef.current = true;
      });
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

  const getCategoryConfig = (category?: string): {
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    backgroundColor: string;
  } => {
    const normalized = (category || '').trim().toLowerCase();
    if (normalized.includes('salud') || normalized.includes('médic') || normalized.includes('medic')) {
      return {
        icon: 'medkit',
        color: '#2A9D8F',
        backgroundColor: '#E6F7F5',
      };
    }
    if (normalized.includes('seguridad') || normalized.includes('polic') || normalized.includes('robo') || normalized.includes('sospecha')) {
      return {
        icon: 'shield-checkmark',
        color: '#1D70B8',
        backgroundColor: '#EBF3FC',
      };
    }
    if (normalized.includes('bombe') || normalized.includes('fuego') || normalized.includes('incendio')) {
      return {
        icon: 'flame',
        color: '#E76F51',
        backgroundColor: '#FEF4E8',
      };
    }
    if (normalized.includes('infraestructura') || normalized.includes('bache') || normalized.includes('calle') || normalized.includes('luz')) {
      return {
        icon: 'construct',
        color: '#8B572A',
        backgroundColor: '#F6EFEA',
      };
    }
    return {
      icon: 'alert-circle',
      color: '#E63946',
      backgroundColor: '#FEE4E2',
    };
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
    const categoryConfig = getCategoryConfig(item.category);

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.88}
        onPress={() => navigation.navigate('DetalleReporte', { report: item })}
      >
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.categoryBadge,
              { backgroundColor: categoryConfig.backgroundColor },
            ]}
          >
            <Ionicons
              name={categoryConfig.icon}
              size={15}
              color={categoryConfig.color}
            />
            <Text
              style={[
                styles.categoryText,
                { color: categoryConfig.color },
              ]}
              numberOfLines={1}
            >
              {item.category || 'Incidencia'}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(item.status) },
            ]}
          >
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>
              {getStatusText(item.status)}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={13} color="#8A92A6" />
          <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
        </View>

        {item.address ? (
          <View style={styles.locationRow}>
            <Ionicons name="location-sharp" size={15} color="#E63946" />
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
              source={{ uri: getAssetUrl(previewImage) }}
              style={styles.alertImage}
              resizeMode="cover"
            />

            {images.length > 1 ? (
              <View style={styles.imageCountBadge}>
                <Ionicons name="images" size={13} color="#fff" />
                <Text style={styles.imageCountText}>
                  {images.length} fotos
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          <Text style={styles.cardFooterText}>Ver detalle y seguimiento</Text>
          <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyComponent = () => {
    if (searchText.trim().length > 0) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="search-outline" size={30} color="#64748B" />
          </View>
          <Text style={styles.emptyTitle}>Sin coincidencias</Text>
          <Text style={styles.emptyText}>
            No encontramos reportes para "{searchText.trim()}".
          </Text>
          <TouchableOpacity
            style={styles.emptyActionButton}
            onPress={() => setSearchText('')}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyActionButtonText}>Limpiar búsqueda</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (hasInvalidCustomDate) {
      return (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: '#FEE4E2' }]}>
            <Ionicons name="calendar-outline" size={30} color="#B42318" />
          </View>
          <Text style={styles.emptyTitle}>Rango de fechas inválido</Text>
          <Text style={styles.emptyText}>
            Verifica el formato AAAA-MM-DD y que el inicio sea anterior al fin.
          </Text>
          <TouchableOpacity
            style={styles.emptyActionButton}
            onPress={openDateModal}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyActionButtonText}>Corregir fechas</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (dateFilter !== 'ALL') {
      return (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: '#EEF2F6' }]}>
            <Ionicons name="calendar-outline" size={30} color="#264653" />
          </View>
          <Text style={styles.emptyTitle}>Sin reportes en este período</Text>
          <Text style={styles.emptyText}>
            No tienes incidencias registradas en el período seleccionado.
          </Text>
          <TouchableOpacity
            style={styles.emptyActionButton}
            onPress={resetDateFilter}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyActionButtonText}>Ver todas las fechas</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (filter !== 'TODOS') {
      const statusTitle = filter === 'ARCHIVED' ? 'archivados' : getStatusText(filter).toLowerCase();
      return (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: '#F1F5F9' }]}>
            <Ionicons name="folder-open-outline" size={30} color="#64748B" />
          </View>
          <Text style={styles.emptyTitle}>No hay reportes {statusTitle}</Text>
          <Text style={styles.emptyText}>
            No tienes incidencias registradas con este estado actualmente.
          </Text>
          <TouchableOpacity
            style={styles.emptyActionButton}
            onPress={() => setFilter('TODOS')}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyActionButtonText}>Ver todos los reportes</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyIconCircle, { backgroundColor: '#EBF3FC' }]}>
          <Ionicons name="shield-checkmark-outline" size={36} color="#1D70B8" />
        </View>
        <Text style={styles.emptyTitle}>Aún no tienes reportes</Text>
        <Text style={styles.emptyText}>
          Cuando crees una alerta o emergencia ciudadana en Lules, podrás seguir aquí el estado y resolución de las autoridades.
        </Text>
        <TouchableOpacity
          style={[styles.emptyActionButton, styles.emptyCreateButton]}
          onPress={() => navigation.navigate('Mapa')}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle-outline" size={17} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.emptyCreateButtonText}>Crear mi primer reporte</Text>
        </TouchableOpacity>
      </View>
    );
  };

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
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Mis Reportes</Text>
            <Text style={styles.headerSubtitle}>
              {activeAlerts.length + archivedAlerts.length > 0
                ? `${activeAlerts.length} activos · ${archivedAlerts.length} archivados`
                : 'Historial de incidencias'}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.dateFilterTrigger,
              dateFilter !== 'ALL' && styles.dateFilterTriggerActive,
            ]}
            onPress={openDateModal}
            activeOpacity={0.8}
            accessibilityLabel="Filtrar por fecha"
          >
            <Ionicons
              name="calendar-outline"
              size={16}
              color={dateFilter !== 'ALL' ? '#fff' : '#264653'}
            />
            <Text
              style={[
                styles.dateFilterTriggerText,
                dateFilter !== 'ALL' && styles.dateFilterTriggerTextActive,
              ]}
            >
              {getDateFilterBadge()}
            </Text>
            {dateFilter !== 'ALL' ? (
              <View style={styles.dateFilterActiveDot} />
            ) : null}
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color="#777" />
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Buscar por categoría, dirección..."
            placeholderTextColor="#8A8F98"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchText.length > 0 ? (
            <TouchableOpacity
              onPress={() => setSearchText('')}
              accessibilityLabel="Limpiar búsqueda"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color="#777" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.filterBar}>
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
              activeOpacity={0.75}
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

      <Modal
        visible={isDateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDateModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsDateModalVisible(false)}
        >
          <Pressable
            style={[
              styles.modalSheet,
              { paddingBottom: Math.max(insets.bottom + 16, 32) },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Filtrar por Fecha</Text>
                <Text style={styles.modalSubtitle}>
                  Selecciona el período de tus reportes
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsDateModalVisible(false)}
                style={styles.modalCloseButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={styles.modalScrollView}
            >
              <View style={styles.modalOptionsContainer}>
                {([
                  ['ALL', 'Todas las fechas', 'Historial completo de reportes'],
                  ['TODAY', 'Hoy', 'Reportes emitidos hoy'],
                  ['LAST_7_DAYS', 'Últimos 7 días', 'Actividad de la última semana'],
                  ['LAST_30_DAYS', 'Últimos 30 días', 'Actividad del último mes'],
                  ['CUSTOM', 'Rango personalizado', 'Filtrar entre dos fechas'],
                ] as const).map(([option, title, desc]) => {
                  const isSelected = tempDateFilter === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.modalOptionCard,
                        isSelected && styles.modalOptionCardSelected,
                      ]}
                      onPress={() => setTempDateFilter(option)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.modalOptionInfo}>
                        <Text
                          style={[
                            styles.modalOptionTitle,
                            isSelected && styles.modalOptionTitleSelected,
                          ]}
                        >
                          {title}
                        </Text>
                        <Text style={styles.modalOptionDesc}>{desc}</Text>
                      </View>
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={isSelected ? '#E63946' : '#999'}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              {tempDateFilter === 'CUSTOM' ? (
                <View style={styles.modalCustomRangeBox}>
                  <Text style={styles.modalCustomLabel}>
                    Fechas (formato AAAA-MM-DD):
                  </Text>
                  <View style={styles.modalCustomInputsRow}>
                    <TextInput
                      style={styles.modalDateInput}
                      value={tempCustomStartDate}
                      onChangeText={setTempCustomStartDate}
                      placeholder="Desde AAAA-MM-DD"
                      placeholderTextColor="#8A8F98"
                      keyboardType="numbers-and-punctuation"
                      maxLength={10}
                    />
                    <Text style={styles.modalDateRangeSeparator}>al</Text>
                    <TextInput
                      style={styles.modalDateInput}
                      value={tempCustomEndDate}
                      onChangeText={setTempCustomEndDate}
                      placeholder="Hasta AAAA-MM-DD"
                      placeholderTextColor="#8A8F98"
                      keyboardType="numbers-and-punctuation"
                      maxLength={10}
                    />
                  </View>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalResetButton}
                onPress={resetDateFilter}
                activeOpacity={0.7}
              >
                <Text style={styles.modalResetButtonText}>Restablecer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalApplyButton}
                onPress={applyDateFilter}
                activeOpacity={0.8}
              >
                <Text style={styles.modalApplyButtonText}>Aplicar Filtro</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1D20',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6C757D',
    marginTop: 2,
    fontWeight: '500',
  },
  dateFilterTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2F6',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  dateFilterTriggerActive: {
    backgroundColor: '#E63946',
  },
  dateFilterTriggerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#264653',
    marginLeft: 5,
  },
  dateFilterTriggerTextActive: {
    color: '#fff',
  },
  dateFilterActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    marginLeft: 6,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F6F8',
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  searchInput: {
    flex: 1,
    color: '#212529',
    fontSize: 13,
    marginHorizontal: 8,
    paddingVertical: 6,
  },
  filterBar: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 2,
  },
  filterContentContainer: {
    paddingHorizontal: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F4F6F8',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#264653',
  },
  filterText: {
    fontSize: 12,
    color: '#59636E',
    fontWeight: '700',
  },
  filterTextActive: {
    color: '#fff',
  },
  filterCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    paddingHorizontal: 4,
    backgroundColor: '#E5E9EF',
  },
  filterCountActive: {
    backgroundColor: '#E63946',
  },
  filterCountText: {
    color: '#495057',
    fontSize: 10,
    fontWeight: '800',
  },
  filterCountTextActive: {
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D0D5DD',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1D20',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#6C757D',
    marginTop: 2,
  },
  modalCloseButton: {
    padding: 4,
    borderRadius: 16,
    backgroundColor: '#F4F6F8',
  },
  modalOptionsContainer: {
    marginBottom: 12,
  },
  modalOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    backgroundColor: '#FAFBFC',
    marginBottom: 8,
  },
  modalOptionCardSelected: {
    borderColor: '#E63946',
    backgroundColor: '#FFF8F8',
  },
  modalOptionInfo: {
    flex: 1,
    marginRight: 10,
  },
  modalOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#343A40',
  },
  modalOptionTitleSelected: {
    color: '#E63946',
  },
  modalOptionDesc: {
    fontSize: 11,
    color: '#6C757D',
    marginTop: 2,
  },
  modalCustomRangeBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  modalCustomLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#495057',
    marginBottom: 8,
  },
  modalCustomInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalDateInput: {
    flex: 1,
    minHeight: 38,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#CED4DA',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 12,
    color: '#212529',
  },
  modalDateRangeSeparator: {
    marginHorizontal: 8,
    color: '#6C757D',
    fontSize: 12,
    fontWeight: '700',
  },
  modalScrollView: {
    maxHeight: 380,
  },
  modalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F5',
  },
  modalResetButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#F1F3F5',
    marginRight: 8,
  },
  modalResetButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#495057',
  },
  modalApplyButton: {
    flex: 2,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#E63946',
    marginLeft: 8,
  },
  modalApplyButtonText: {
    fontSize: 14,
    fontWeight: '700',
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
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 18,
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#EEF2F6',
  },
  emptyActionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  emptyCreateButton: {
    backgroundColor: '#E63946',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyCreateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
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
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ECEFF1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    flexShrink: 1,
    marginRight: 8,
  },
  categoryText: {
    fontWeight: '800',
    marginLeft: 6,
    fontSize: 12,
    flexShrink: 1,
    letterSpacing: -0.2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    marginRight: 5,
  },
  statusText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  dateText: {
    fontSize: 12,
    color: '#718096',
    marginLeft: 5,
    fontWeight: '500',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 2,
  },
  addressText: {
    fontSize: 13,
    color: '#2D3748',
    fontWeight: '600',
    marginLeft: 5,
    flex: 1,
  },
  descriptionText: {
    fontSize: 13,
    color: '#4A5568',
    lineHeight: 19,
    marginBottom: 10,
  },
  imagePreviewContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
  },
  alertImage: {
    width: '100%',
    height: 170,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  imageCountBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  imageCountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cardFooterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
});
