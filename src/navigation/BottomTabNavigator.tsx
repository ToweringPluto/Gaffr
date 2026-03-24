import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
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

const TAB_LABELS: Record<string, string> = {
  Home: 'HOME',
  Fix: 'FIX',
  Squad: 'SQUAD',
  Chips: 'CHIPS',
};

const PIP_SIZE = 4;

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
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Fix" component={FixturesScreen} />
      <Tab.Screen name="Squad" component={SquadScreen} />
      <Tab.Screen name="Chips" component={ChipsScreen} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
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
