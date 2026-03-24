import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fdrColors, bgwColors, dgwColors } from '../theme/fdrColors';
import { fontFamily, fontWeights } from '../theme/typography';

interface FdrBoxProps {
  rating: number;
  label: string;
  isBgw?: boolean;
  isDgw?: boolean;
}

export const FdrBox: React.FC<FdrBoxProps> = ({
  rating,
  label,
  isBgw,
  isDgw,
}) => {
  let colorSpec;
  if (isBgw) {
    colorSpec = bgwColors;
  } else if (isDgw) {
    colorSpec = dgwColors;
  } else {
    colorSpec = fdrColors[rating] ?? fdrColors[3];
  }

  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor: colorSpec.background,
          borderColor: colorSpec.borderText,
        },
      ]}
    >
      <Text style={[styles.label, { color: colorSpec.borderText }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    width: 26,
    height: 20,
    borderWidth: 2,
    borderStyle: 'solid',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily,
    fontSize: 7,
    fontWeight: fontWeights.bold,
  },
});
