import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { fontFamily, fontSizes, fontWeights } from '../theme/typography';

interface SectionHeadingProps {
  title: string;
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({ title }) => {
  return <Text style={styles.heading}>{title.toUpperCase()}</Text>;
};

const styles = StyleSheet.create({
  heading: {
    fontFamily,
    fontSize: fontSizes.sectionHeading,
    fontWeight: fontWeights.bold,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    paddingLeft: 5,
    marginTop: 6,
    marginBottom: 4,
  },
});
