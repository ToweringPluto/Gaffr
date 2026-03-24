import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { fontFamily, fontWeights } from '../theme/typography';

interface DeadlineBarProps {
  countdown: string;
  isUrgent?: boolean;
}

export const DeadlineBar: React.FC<DeadlineBarProps> = ({
  countdown,
  isUrgent,
}) => {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isUrgent) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: false,
          }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(0);
    }
  }, [isUrgent, pulseAnim]);

  const countdownColor = isUrgent
    ? pulseAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.red, colors.deadlinePulse],
      })
    : colors.deadlinePulse;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>DEADLINE</Text>
      <Animated.Text style={[styles.countdown, { color: countdownColor }]}>
        {countdown.toUpperCase()}
      </Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.redBg,
    borderWidth: 2,
    borderColor: colors.red,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontFamily,
    fontSize: 8,
    fontWeight: fontWeights.normal,
    color: colors.red,
  },
  countdown: {
    fontFamily,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    color: colors.deadlinePulse,
  },
});
