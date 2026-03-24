import { useWindowDimensions } from 'react-native';

const TABLET_BREAKPOINT = 768;

interface ResponsiveInfo {
  isTablet: boolean;
  width: number;
  columns: number;
}

export function useResponsive(): ResponsiveInfo {
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  return {
    isTablet,
    width,
    columns: isTablet ? 2 : 1,
  };
}
