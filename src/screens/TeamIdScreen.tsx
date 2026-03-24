import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { colors, fontFamily, fontWeights, fontSizes, contentPadding } from '../theme';
import { ScreenHeader, LoadingText } from '../components';
import { createFplApiClient } from '../data/fplApiClient';
import { createLocalCache } from '../data/localCache';

const apiClient = createFplApiClient();
const cache = createLocalCache();

interface TeamIdScreenProps {
  onLinked: (teamId: number) => void;
  onSkip: () => void;
}

export const TeamIdScreen: React.FC<TeamIdScreenProps> = ({ onLinked, onSkip }) => {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim();
    const id = Number(trimmed);

    if (!trimmed || isNaN(id) || id <= 0 || !Number.isInteger(id)) {
      setError('ENTER A VALID TEAM ID (NUMBERS ONLY)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiClient.getManagerSquad(id);
      await cache.setTeamId(id);
      onLinked(id);
    } catch {
      setError('TEAM ID NOT RECOGNISED. CHECK AND TRY AGAIN.');
    } finally {
      setLoading(false);
    }
  }, [input, onLinked]);

  return (
    <View style={styles.outerFrame}>
      <View style={styles.innerViewport}>
        <ScreenHeader title="LINK TEAM" />
        <View style={styles.body}>
          <Text style={styles.heading}>ENTER YOUR FPL TEAM ID</Text>
          <Text style={styles.hint}>
            FIND IT IN THE FPL APP UNDER MY TEAM {'>'} GAMEWEEK HISTORY URL
          </Text>

          <TextInput
            style={[
              styles.input,
              focused && styles.inputFocused,
            ]}
            value={input}
            onChangeText={setInput}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="TEAM ID"
            placeholderTextColor={colors.blueMid}
            keyboardType="number-pad"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            accessibilityLabel="FPL Team ID"
            accessibilityHint="Enter your Fantasy Premier League team ID number"
          />

          {error && <Text style={styles.error}>{error}</Text>}

          {loading ? (
            <View style={styles.loadingWrap}>
              <LoadingText text="VALIDATING..." />
            </View>
          ) : (
            <TouchableOpacity
              style={styles.button}
              onPress={handleSubmit}
              accessibilityRole="button"
              accessibilityLabel="Link team"
            >
              <Text style={styles.buttonText}>LINK TEAM</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.skipButton}
            onPress={onSkip}
            accessibilityRole="button"
            accessibilityLabel="Skip linking team"
          >
            <Text style={styles.skipText}>SKIP -- USE WITHOUT TEAM ID</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerFrame: {
    flex: 1,
    borderWidth: 4,
    borderColor: colors.gold,
    backgroundColor: colors.bgBase,
  },
  innerViewport: {
    flex: 1,
    borderWidth: 3,
    borderColor: colors.blueMid,
  },
  body: {
    flex: 1,
    backgroundColor: colors.bgBase,
    padding: contentPadding,
    justifyContent: 'center',
  },
  heading: {
    fontFamily,
    fontSize: fontSizes.screenTitle,
    fontWeight: fontWeights.bold,
    color: colors.gold,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  hint: {
    fontFamily,
    fontSize: fontSizes.bodySecondary,
    fontWeight: fontWeights.normal,
    color: colors.blueLight,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  input: {
    backgroundColor: colors.bgSurface,
    borderWidth: 2,
    borderColor: colors.blueMid,
    fontFamily,
    fontSize: fontSizes.bodyPrimary,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlign: 'center',
    textTransform: 'uppercase',
    minHeight: 44,
  },
  inputFocused: {
    borderColor: colors.gold,
  },
  error: {
    fontFamily,
    fontSize: fontSizes.bodySecondary,
    fontWeight: fontWeights.bold,
    color: colors.red,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: 8,
  },
  loadingWrap: {
    alignItems: 'center',
    marginTop: 16,
  },
  button: {
    backgroundColor: colors.bgSurface,
    borderWidth: 2,
    borderColor: colors.gold,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 16,
    minHeight: 44,
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily,
    fontSize: fontSizes.bodyPrimary,
    fontWeight: fontWeights.bold,
    color: colors.gold,
    textTransform: 'uppercase',
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  skipText: {
    fontFamily,
    fontSize: fontSizes.bodySecondary,
    fontWeight: fontWeights.normal,
    color: colors.blueLight,
    textTransform: 'uppercase',
  },
});
