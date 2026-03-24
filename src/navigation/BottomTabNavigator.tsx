import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';
import { DashboardScreen } from '../screens/DashboardScreen';
import { FixturesScreen } from '../screens/FixturesScreen';
import { SquadScreen } from '../screens/SquadScreen';
import { ChipsScreen } from '../screens/ChipsScreen';
import { colors, fontFamily, fontWeights, fontSizes, borders } from '../theme';

export type BottomTabParamList = {
  Home: undefined;
  Fix: undefined;
  Squad: undefined;
  Chips: undefined;
};

const Tab = createBottomTabNavigator<BottomTabParamList>();

const TAB_ORDER: (keyof BottomTabParamList)[] = ['Home', 'Fix', 'Squad', 'Chips'];

const TAB_LABELS: Record<string, string> = {
  Home: 'HOME',
  Fix: 'FIX',
  Squad: 'SQUAD',
  Chips: 'CHIPS',
};

const PIP_SIZE = 4;
const SWIPE_THRESHOLD = 50;

function SwipeableScreen({ children }: { children: React.ReactNode }) {
  const navigation = useNavigation<any>();

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-SWIPE_THRESHOLD, SWIPE_THRESHOLD])
    .onEnd((event) => {
      const state = navigation.getState();
      if (!state) return;
      const currentIndex = state.index;

      if (event.translationX < -SWIPE_THRESHOLD && currentIndex < TAB_ORDER.length - 1) {
        navigation.navigate(TAB_ORDER[currentIndex + 1]);
      } else if (event.translationX > SWIPE_THRESHOLD && currentIndex > 0) {
        navigation.navigate(TAB_ORDER[currentIndex - 1]);
      }
    });

  return (
    <GestureDetector gesture={swipeGesture}>
      <View style={styles.swipeContainer}>{children}</View>
    </GestureDetector>
  );
}

function SwipeableDashboard() {
  return (
    <SwipeableScreen>
      <DashboardScreen />
    </SwipeableScreen>
  );
}

function SwipeableFixtures() {
  return (
    <SwipeableScreen>
      <FixturesScreen />
    </SwipeableScreen>
  );
}

function SwipeableSquad() {
  return (
    <SwipeableScreen>
      <SquadScreen />
    </SwipeableScreen>
  );
}

function SwipeableChips() {
  return (
    <SwipeableScreen>
      <ChipsScreen />
    </SwipeableScreen>
  );
}

const CustomTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  return (
    <View style={styles.tabBar}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const label = TAB_LABELS[route.name] ?? route.name;
        const pipColor = isFocused ? colors.gold : colors.blueMid;
        const labelColor = isFocused ? colors.gold : colors.blueMid;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={label}
            onPress={onPress}
            style={styles.tabItem}
          >
            <View style={[styles.pip, { backgroundColor: pipColor }]} />
            <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export const BottomTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: 'none',
      }}
    >
      <Tab.Screen name="Home" component={SwipeableDashboard} />
      <Tab.Screen name="Fix" component={SwipeableFixtures} />
      <Tab.Screen name="Squad" component={SwipeableSquad} />
      <Tab.Screen name="Chips" component={SwipeableChips} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  swipeContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: colors.bgHeader,
    borderTopWidth: borders.navTop.borderTopWidth,
    borderTopColor: borders.navTop.borderTopColor,
    paddingTop: 6,
    paddingBottom: 10,
  },
  tabItem: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  pip: {
    width: PIP_SIZE,
    height: PIP_SIZE,
  },
  label: {
    fontFamily,
    fontSize: fontSizes.navLabel,
    fontWeight: fontWeights.normal,
    textTransform: 'uppercase',
  },
});
