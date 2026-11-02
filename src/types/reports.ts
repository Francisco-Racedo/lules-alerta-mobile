export type ReportStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'DISMISSED';

export type ReportLocation = {
  type: 'Point';
  coordinates: [number, number];
};

export type ReportHistoryEvent = {
  id: string;
  previousStatus?: ReportStatus | null;
  newStatus: ReportStatus;
  comment?: string | null;
  changedAt: string;
};

export type ReportResolution = {
  description: string;
  imageUrl?: string | null;
  images?: string[] | null;
  resolvedAt: string;
};

export type ReportItem = {
  id: string;
  category: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt?: string;
  address?: string | null;
  description: string;
  imageUrl?: string | null;
  images?: string[] | null;
  location?: ReportLocation | null;
  latitude?: number | null;
  longitude?: number | null;
  isArchived?: boolean;
  archivedAt?: string | null;
  history?: ReportHistoryEvent[] | null;
  resolution?: ReportResolution | null;
};
