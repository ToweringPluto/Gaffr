import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, fontWeights } from '../theme';

export const ChipsScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>CHIPS</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily,
    fontSize: 13,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    textTransform: 'uppercase',
  },
});
