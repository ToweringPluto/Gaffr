/**
 * gaffr Retro Arcade — Border Specs
 * No border-radius above 4. No box-shadow, text-shadow, filter, or gradients.
 * All widths are plain numbers for React Native.
 */

import { colors } from './colors';

export const MAX_BORDER_RADIUS = 4;

export const borders = {
  outerFrame: {
    borderWidth: 4,
    borderColor: colors.gold,
    borderStyle: 'solid' as const,
  },
  innerViewport: {
    borderWidth: 3,
    borderColor: colors.blueMid,
    borderStyle: 'solid' as const,
  },
  headerBottom: {
    borderBottomWidth: 3,
    borderBottomColor: colors.gold,
  },
  cardDefault: {
    borderWidth: 2,
    borderColor: colors.blueMid,
    borderStyle: 'solid' as const,
  },
  cardActive: {
    borderWidth: 2,
    borderColor: colors.gold,
    borderStyle: 'solid' as const,
  },
  cardAlert: {
    borderWidth: 2,
    borderColor: colors.red,
    borderStyle: 'solid' as const,
  },
  cardPositive: {
    borderWidth: 2,
    borderColor: colors.green,
    borderStyle: 'solid' as const,
  },
  cardChip: {
    borderWidth: 2,
    borderColor: colors.purple,
    borderStyle: 'solid' as const,
  },
  divider: {
    borderBottomWidth: 2,
    borderBottomColor: colors.blueMid,
  },
  sectionHeadingLeft: {
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
  },
  fdrBox: {
    borderWidth: 2,
    borderStyle: 'solid' as const,
  },
  navTop: {
    borderTopWidth: 3,
    borderTopColor: colors.blueMid,
  },
} as const;
