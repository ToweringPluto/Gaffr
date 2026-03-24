import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { fontFamily, fontWeights } from '../theme/typography';

interface ChipCardProps {
  chipName: string;
  targetGameweek?: string;
  isUsed?: boolean;
}

export const ChipCard: React.FC<ChipCardProps> = ({
  chipName,
  targetGameweek,
  isUsed,
}) => {
  return (
    <View style={[styles.container, isUsed ? styles.borderUsed : styles.borderAvailable]}>
      <Text
        style={[
          styles.chipName,
          isUsed ? styles.chipNameUsed : styles.chipNameAvailable,
          isUsed && styles.strikethrough,
        ]}
      >
        {chipName.toUpperCase()}
      </Text>
      {targetGameweek != null && (
        <Text style={styles.targetGw}>{targetGameweek.toUpperCase()}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgSurface,
    paddingHorizontal: 6,
    paddingVertical: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  borderAvailable: {
    borderWidth: 2,
    borderColor: colors.purple,
  },
  borderUsed: {
    borderWidth: 2,
    borderColor: colors.blueMid,
  },
  chipName: {
    fontFamily,
    fontSize: 8,
    fontWeight: fontWeights.bold,
    textTransform: 'uppercase',
  },
  chipNameAvailable: {
    color: colors.purple,
  },
  chipNameUsed: {
    color: colors.blueMid,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
  targetGw: {
    fontFamily,
    fontSize: 8,
    fontWeight: fontWeights.normal,
    color: colors.gold,
  },
});
