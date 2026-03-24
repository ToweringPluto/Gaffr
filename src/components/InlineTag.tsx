import React from 'react';
import { Text, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { fontFamily, fontWeights } from '../theme/typography';

type TagVariant = 'positive' | 'warning' | 'negative' | 'info' | 'captain';

interface InlineTagProps {
  label: string;
  variant: TagVariant;
}

const VARIANT_STYLES: Record<TagVariant, { container: ViewStyle; text: TextStyle }> = {
  positive: {
    container: {
      backgroundColor: colors.greenBg,
      borderWidth: 1,
      borderColor: colors.green,
    },
    text: { color: colors.green },
  },
  warning: {
    container: {
      backgroundColor: colors.goldBg,
      borderWidth: 1,
      borderColor: colors.gold,
    },
    text: { color: colors.gold },
  },
  negative: {
    container: {
      backgroundColor: colors.redBg,
      borderWidth: 1,
      borderColor: colors.red,
    },
    text: { color: colors.red },
  },
  info: {
    container: {
      backgroundColor: colors.bgSurface,
      borderWidth: 1,
      borderColor: colors.blueLight,
    },
    text: { color: colors.blueLight },
  },
  captain: {
    container: {
      backgroundColor: colors.gold,
      paddingHorizontal: 3,
    },
    text: { color: colors.bgBase },
  },
};

export const InlineTag: React.FC<InlineTagProps> = ({ label, variant }) => {
  const variantStyle = VARIANT_STYLES[variant];

  return (
    <Text
      style={[
        styles.base,
        variantStyle.container,
        variantStyle.text,
      ]}
    >
      {label.toUpperCase()}
    </Text>
  );
};

const styles = StyleSheet.create({
  base: {
    fontFamily,
    fontSize: 7,
    fontWeight: fontWeights.bold,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
});
