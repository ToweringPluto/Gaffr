/**
 * gaffr Retro Arcade — Spacing
 * Base unit: 4px. All values are plain numbers for React Native.
 */

export const spacing = {
  space1: 4,
  space2: 8,
  space3: 10,
  space4: 12,
  space5: 16,
} as const;

/** Content padding applied to all screen bodies (left/right). */
export const contentPadding = spacing.space3;
