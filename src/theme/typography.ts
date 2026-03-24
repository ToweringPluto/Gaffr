/**
 * gaffr Retro Arcade — Typography
 * One font. No exceptions. Courier New, Courier, monospace.
 * All sizes are plain numbers for React Native (no 'px' units).
 */

export const fontFamily = "'Courier New', Courier, monospace" as const;

export const fontSizes = {
  logo: 16,
  screenTitle: 13,
  sectionHeading: 9,
  bodyPrimary: 10,
  bodySecondary: 8,
  statValueLarge: 22,
  statValueSmall: 16,
  statLabel: 7,
  badge: 7,
  navLabel: 7,
} as const;

export const fontWeights = {
  bold: '900' as const,
  normal: '400' as const,
};

export const typeStyles = {
  logo: {
    fontFamily,
    fontSize: fontSizes.logo,
    fontWeight: fontWeights.bold,
    color: '#e8c832',
    letterSpacing: 2,
  },
  screenTitle: {
    fontFamily,
    fontSize: fontSizes.screenTitle,
    fontWeight: fontWeights.bold,
    color: '#e8e8e8',
  },
  sectionHeading: {
    fontFamily,
    fontSize: fontSizes.sectionHeading,
    fontWeight: fontWeights.bold,
    color: '#e8c832',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  bodyPrimary: {
    fontFamily,
    fontSize: fontSizes.bodyPrimary,
    fontWeight: fontWeights.bold,
    color: '#c8d8e8',
  },
  bodySecondary: {
    fontFamily,
    fontSize: fontSizes.bodySecondary,
    fontWeight: fontWeights.normal,
    color: '#7ec8e3',
  },
  statValue: {
    fontFamily,
    fontSize: fontSizes.statValueSmall,
    fontWeight: fontWeights.bold,
  },
  statLabel: {
    fontFamily,
    fontSize: fontSizes.statLabel,
    fontWeight: fontWeights.normal,
    color: '#7ec8e3',
    textTransform: 'uppercase' as const,
  },
  badge: {
    fontFamily,
    fontSize: fontSizes.badge,
    fontWeight: fontWeights.bold,
  },
  navLabelInactive: {
    fontFamily,
    fontSize: fontSizes.navLabel,
    fontWeight: fontWeights.normal,
    color: '#2a4a6b',
    textTransform: 'uppercase' as const,
  },
  navLabelActive: {
    fontFamily,
    fontSize: fontSizes.navLabel,
    fontWeight: fontWeights.normal,
    color: '#e8c832',
    textTransform: 'uppercase' as const,
  },
} as const;
