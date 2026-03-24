import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { fontFamily, fontWeights, fontSizes } from '../theme/typography';

interface StatItem {
  value: string;
  label: string;
  color?: string;
}

interface StatTrioProps {
  items: StatItem[];
}

export const StatTrio: React.FC<StatTrioProps> = ({ items }) => {
  return (
    <View style={styles.container}>
      {items.map((item, index) => (
        <View key={index} style={styles.cell}>
          <Text
            style={[
              styles.value,
              { color: item.color ?? colors.textPrimary },
            ]}
          >
            {item.value}
          </Text>
          <Text style={styles.label}>{item.label.toUpperCase()}</Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 4,
  },
  cell: {
    flex: 1,
    backgroundColor: colors.bgSurface,
    borderWidth: 2,
    borderColor: colors.blueMid,
    paddingVertical: 5,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  value: {
    fontFamily,
    fontSize: fontSizes.statValueSmall,
    fontWeight: fontWeights.bold,
  },
  label: {
    fontFamily,
    fontSize: fontSizes.statLabel,
    fontWeight: fontWeights.normal,
    color: colors.blueLight,
    textTransform: 'uppercase',
    marginTop: 2,
  },
});
