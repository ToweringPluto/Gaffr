/**
 * gaffr Retro Arcade — Colour Tokens
 * All colours hardcoded. No CSS variable theming. Always dark.
 */

export const colors = {
  // Core backgrounds
  bgBase: '#0a1628',
  bgSurface: '#0d2137',
  bgHeader: '#1e3a5f',
  bgRaised: '#162840',

  // Accent — Gold (Primary)
  gold: '#e8c832',
  goldDim: '#a08a1a',
  goldBg: '#2a1e00',

  // Accent — Neon Green (Secondary)
  green: '#39ff14',
  greenDim: '#1a7a08',
  greenBg: '#0a2a0a',
  greenBorder: '#1a5a0a',

  // Status
  red: '#e84848',
  redBg: '#2a0a0a',
  amberDim: '#d97706',
  blueLight: '#7ec8e3',
  blueMid: '#2a4a6b',
  purple: '#AFA9EC',
  purpleBg: '#1a1240',

  // Text
  textPrimary: '#c8d8e8',
  textTitle: '#e8e8e8',
  deadlinePulse: '#ff6b6b',
} as const;

export type ColorToken = keyof typeof colors;
