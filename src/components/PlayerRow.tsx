import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { fontFamily, fontWeights } from '../theme/typography';

type PlayerStatus = 'playing' | 'blank' | 'doubt' | 'dgw';

interface PlayerRowProps {
  name: string;
  status: PlayerStatus;
  rightValue?: string;
  rightBadge?: React.ReactNode;
}

const STATUS_COLORS: Record<PlayerStatus, string> = {
  playing: colors.green,
  blank: colors.red,
  doubt: colors.gold,
  dgw: colors.purple,
};

export const PlayerRow: React.FC<PlayerRowProps> = ({
  name,
  status,
  rightValue,
  rightBadge,
}) => {
  return (
    <View style={styles.container}>
      <View
        style={[styles.statusDot, { backgroundColor: STATUS_COLORS[status] }]}
      />
      <Text style={styles.name}>{name.toUpperCase()}</Text>
      {rightBadge != null
        ? rightBadge
        : rightValue != null && (
            <Text style={styles.rightValue}>{rightValue.toUpperCase()}</Text>
          )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.bgSurface,
    minHeight: 44,
  },
  statusDot: {
    width: 8,
    height: 8,
  },
  name: {
    fontFamily,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    color: '#c8d8e8',
    textTransform: 'uppercase',
    flex: 1,
  },
  rightValue: {
    fontFamily,
    fontSize: 8,
    fontWeight: fontWeights.normal,
    color: colors.blueLight,
  },
});
