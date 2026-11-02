import type { ReportItem } from '../types/reports';

export type ReportFormLocation = {
  latitude: number;
  longitude: number;
};

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  MainTabs: undefined;
  ReportForm: {
    category: string;
    location: ReportFormLocation;
  };
  EditProfile: undefined;
  DetalleReporte: {
    report: ReportItem;
  };
};
