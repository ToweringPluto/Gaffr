import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { fontFamily, fontWeights, fontSizes } from '../theme/typography';

interface CaptainCardProps {
  playerName: string;
  fixture: string;
  score: number;
  isTopPick?: boolean;
  tags?: React.ReactNode;
}

export const CaptainCard: React.FC<CaptainCardProps> = ({
  playerName,
  fixture,
  score,
  isTopPick,
  tags,
}) => {
  return (
    <View
      style={[
        styles.container,
        isTopPick ? styles.borderTopPick : styles.borderDefault,
      ]}
    >
      <View style={styles.left}>
        <Text style={styles.playerName}>{playerName.toUpperCase()}</Text>
        <Text style={styles.fixture}>{fixture.toUpperCase()}</Text>
        {tags != null && <View style={styles.tagsRow}>{tags}</View>}
      </View>
      <View style={styles.right}>
        <Text
          style={[
            styles.score,
            { color: isTopPick ? colors.gold : '#c8d8e8' },
          ]}
        >
          {score}
        </Text>
        <Text style={styles.scoreLabel}>SCORE</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgSurface,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  borderDefault: {
    borderWidth: 2,
    borderColor: colors.blueMid,
  },
  borderTopPick: {
    borderWidth: 2,
    borderColor: colors.gold,
  },
  left: {
    flex: 1,
  },
  playerName: {
    fontFamily,
    fontSize: 9,
    fontWeight: fontWeights.bold,
    color: '#e8e8e8',
    textTransform: 'uppercase',
  },
  fixture: {
    fontFamily,
    fontSize: fontSizes.statLabel,
    fontWeight: fontWeights.normal,
    color: colors.blueLight,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  right: {
    alignItems: 'center',
  },
  score: {
    fontFamily,
    fontSize: 16,
    fontWeight: fontWeights.bold,
  },
  scoreLabel: {
    fontFamily,
    fontSize: fontSizes.statLabel,
    fontWeight: fontWeights.normal,
    color: colors.blueLight,
  },
});
