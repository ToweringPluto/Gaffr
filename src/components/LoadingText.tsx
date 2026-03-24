import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { fontFamily, fontWeights } from '../theme/typography';
import { colors } from '../theme/colors';

interface LoadingTextProps {
  text?: string;
}

export const LoadingText: React.FC<LoadingTextProps> = ({
  text = 'LOADING...',
}) => {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.Text style={[styles.text, { opacity }]}>
      {text.toUpperCase()}
    </Animated.Text>
  );
};

const styles = StyleSheet.create({
  text: {
    fontFamily,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
});
