import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { fontFamily, fontSizes, fontWeights } from '../theme/typography';

interface ScreenHeaderProps {
  title?: string;
  showLogo?: boolean;
  gameweek?: string | number;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  showLogo,
  gameweek,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 8) }]}>
      <View style={styles.left}>
        {showLogo ? (
          <Text style={styles.logo}>gaffr</Text>
        ) : title ? (
          <Text style={styles.title}>{title.toUpperCase()}</Text>
        ) : null}
      </View>
      {gameweek != null && (
        <View style={styles.gwBadge}>
          <Text style={styles.gwText}>GW{gameweek}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgHeader,
    borderBottomWidth: 3,
    borderBottomColor: colors.gold,
    paddingHorizontal: 10,
    paddingBottom: 8,
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flex: 1,
  },
  logo: {
    fontFamily,
    fontSize: fontSizes.logo,
    fontWeight: fontWeights.bold,
    color: colors.gold,
    letterSpacing: 2,
  },
  title: {
    fontFamily,
    fontSize: fontSizes.screenTitle,
    fontWeight: fontWeights.bold,
    color: '#e8e8e8',
  },
  gwBadge: {
    backgroundColor: colors.bgBase,
    borderWidth: 2,
    borderColor: colors.blueLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  gwText: {
    fontFamily,
    fontSize: 10,
    fontWeight: fontWeights.normal,
    color: colors.blueLight,
  },
});
