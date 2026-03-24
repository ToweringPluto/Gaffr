import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { fontFamily, fontWeights } from '../theme/typography';

interface TransferRowProps {
  playerOut: string;
  playerIn: string;
  projectedGain: string;
}

export const TransferRow: React.FC<TransferRowProps> = ({
  playerOut,
  playerIn,
  projectedGain,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.outBadge}>OUT</Text>
        <Text style={styles.playerName}>{playerOut.toUpperCase()}</Text>
      </View>
      <Text style={styles.connector}>{'>> REPLACE WITH'}</Text>
      <View style={styles.row}>
        <Text style={styles.inBadge}>IN</Text>
        <Text style={styles.playerName}>{playerIn.toUpperCase()}</Text>
        <Text style={styles.gain}>{projectedGain}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: colors.bgSurface,
    paddingVertical: 5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  outBadge: {
    fontFamily,
    fontSize: 7,
    fontWeight: fontWeights.bold,
    color: colors.red,
    backgroundColor: colors.redBg,
    borderWidth: 1,
    borderColor: colors.red,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  inBadge: {
    fontFamily,
    fontSize: 7,
    fontWeight: fontWeights.bold,
    color: colors.green,
    backgroundColor: colors.greenBg,
    borderWidth: 1,
    borderColor: colors.green,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  playerName: {
    fontFamily,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    color: '#c8d8e8',
    textTransform: 'uppercase',
    flex: 1,
  },
  connector: {
    fontFamily,
    fontSize: 8,
    fontWeight: fontWeights.normal,
    color: colors.gold,
    textAlign: 'center',
    paddingVertical: 3,
  },
  gain: {
    fontFamily,
    fontSize: 9,
    fontWeight: fontWeights.normal,
    color: colors.green,
  },
});
