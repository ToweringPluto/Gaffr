import React, { useState, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { colors, fontFamily, fontWeights, fontSizes, contentPadding } from '../theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionHeading } from '../components/SectionHeading';
import { LoadingText } from '../components/LoadingText';
import { FdrBox } from '../components/FdrBox';
import { useBootstrap } from '../hooks/useBootstrap';
import { useFixtures } from '../hooks/useFixtures';
import {
  getUpcomingFixtures,
  sortTeamsByDifficulty,
  getTeamFixtureSchedule,
} from '../domain/fixtureAnalyser';
import type { FixturesByTeam, FixtureDetail, TeamSchedule } from '../models';

const GW_COUNT = 6;

export const FixturesScreen: React.FC = () => {
  const bootstrap = useBootstrap();
  const fixtures = useFixtures();
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loading = bootstrap.loading || fixtures.loading;
  const error = bootstrap.error || fixtures.error;

  const currentGameweek = bootstrap.data?.currentGameweek ?? 1;

  const sortedTeams = useMemo<FixturesByTeam[]>(() => {
    if (!bootstrap.data || !fixtures.data) return [];
    const upcoming = getUpcomingFixtures(
      fixtures.data,
      bootstrap.data.teams,
      currentGameweek,
      GW_COUNT,
    );
    return sortTeamsByDifficulty(upcoming);
  }, [bootstrap.data, fixtures.data, currentGameweek]);

  const gwColumns = useMemo<number[]>(() => {
    const cols: number[] = [];
    for (let i = 0; i < GW_COUNT; i++) {
      cols.push(currentGameweek + i);
    }
    return cols;
  }, [currentGameweek]);

  const teamSchedule = useMemo<TeamSchedule | null>(() => {
    if (selectedTeamId == null || !fixtures.data || !bootstrap.data) return null;
    return getTeamFixtureSchedule(selectedTeamId, fixtures.data, bootstrap.data.teams);
  }, [selectedTeamId, fixtures.data, bootstrap.data]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([bootstrap.refresh(), fixtures.refresh()]);
    setRefreshing(false);
  }, [bootstrap, fixtures]);

  const handleTeamPress = useCallback((teamId: number) => {
    setSelectedTeamId((prev) => (prev === teamId ? null : teamId));
  }, []);

  if (loading && !refreshing) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="FIXTURES" gameweek={currentGameweek} />
        <View style={styles.centered}>
          <LoadingText />
        </View>
      </View>
    );
  }

  if (error && sortedTeams.length === 0) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="FIXTURES" gameweek={currentGameweek} />
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error.toUpperCase()}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="FIXTURES" gameweek={currentGameweek} />
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
          />
        }
      >
        {error ? <Text style={styles.staleText}>{error.toUpperCase()}</Text> : null}

        <SectionHeading title="NEXT 6 GAMEWEEKS" />

        {/* GW column headers */}
        <View style={styles.gridHeaderRow}>
          <View style={styles.teamNameCell} />
          {gwColumns.map((gw) => (
            <View key={gw} style={styles.gwHeaderCell}>
              <Text style={styles.gwHeaderText}>GW{gw}</Text>
            </View>
          ))}
        </View>

        {/* Team rows */}
        {sortedTeams.map((team) => (
          <TeamRow
            key={team.teamId}
            team={team}
            gwColumns={gwColumns}
            isSelected={selectedTeamId === team.teamId}
            onPress={handleTeamPress}
          />
        ))}

        {/* Team detail view */}
        {selectedTeamId != null && teamSchedule != null && (
          <TeamDetailView schedule={teamSchedule} />
        )}
      </ScrollView>
    </View>
  );
};

// --- TeamRow ---

interface TeamRowProps {
  team: FixturesByTeam;
  gwColumns: number[];
  isSelected: boolean;
  onPress: (teamId: number) => void;
}

const TeamRow: React.FC<TeamRowProps> = React.memo(
  ({ team, gwColumns, isSelected, onPress }) => {
    const fixturesByGw = useMemo(() => {
      const map = new Map<number, FixtureDetail[]>();
      for (const f of team.fixtures) {
        const list = map.get(f.gameweek) ?? [];
        list.push(f);
        map.set(f.gameweek, list);
      }
      return map;
    }, [team.fixtures]);

    // Check if team has any BGW or DGW in the range
    const hasBgw = team.fixtures.some((f) => f.isBgw);
    const hasDgw = team.fixtures.some((f) => f.isDgw);

    return (
      <TouchableOpacity
        style={[styles.teamRow, isSelected && styles.teamRowSelected]}
        onPress={() => onPress(team.teamId)}
        activeOpacity={0.7}
      >
        <View style={styles.teamNameCell}>
          <Text style={styles.teamNameText} numberOfLines={1}>
            {team.teamName.toUpperCase()}
          </Text>
          <View style={styles.indicatorRow}>
            {hasBgw && (
              <View style={styles.bgwIndicator}>
                <Text style={styles.bgwIndicatorText}>BGW</Text>
              </View>
            )}
            {hasDgw && (
              <View style={styles.dgwIndicator}>
                <Text style={styles.dgwIndicatorText}>DGW</Text>
              </View>
            )}
          </View>
        </View>
        {gwColumns.map((gw) => {
          const gwFixtures = fixturesByGw.get(gw) ?? [];
          return (
            <View key={gw} style={styles.fixtureCell}>
              {gwFixtures.length === 0 ? (
                <FdrBox rating={0} label="BGW" isBgw />
              ) : (
                gwFixtures.map((f, idx) => {
                  const label = f.isBgw
                    ? 'BGW'
                    : `${f.opponent}${f.isHome ? '' : ''}`;
                  return (
                    <FdrBox
                      key={`${gw}-${idx}`}
                      rating={f.difficulty}
                      label={label}
                      isBgw={f.isBgw}
                      isDgw={f.isDgw}
                    />
                  );
                })
              )}
            </View>
          );
        })}
      </TouchableOpacity>
    );
  },
);

// --- TeamDetailView ---

interface TeamDetailViewProps {
  schedule: TeamSchedule;
}

const TeamDetailView: React.FC<TeamDetailViewProps> = ({ schedule }) => {
  return (
    <View style={styles.detailContainer}>
      <SectionHeading title={`${schedule.teamName} SCHEDULE`} />
      {schedule.fixtures.map((f, idx) => (
        <View key={idx} style={styles.detailRow}>
          <Text style={styles.detailGw}>GW{f.gameweek}</Text>
          <FdrBox
            rating={f.difficulty}
            label={f.isBgw ? 'BGW' : f.opponent}
            isBgw={f.isBgw}
            isDgw={f.isDgw}
          />
          <Text style={styles.detailOpponent}>
            {f.isBgw ? 'NO FIXTURE' : `${f.opponent.toUpperCase()} ${f.isHome ? '(H)' : '(A)'}`}
          </Text>
          <Text style={styles.detailFdr}>
            {f.isBgw ? 'BGW' : `FDR ${f.difficulty}`}
          </Text>
          {f.isDgw && (
            <View style={styles.dgwTag}>
              <Text style={styles.dgwTagText}>DGW</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
};

// --- Styles ---

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: contentPadding,
    paddingBottom: 20,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontFamily,
    fontSize: fontSizes.bodyPrimary,
    fontWeight: fontWeights.bold,
    color: colors.red,
    textTransform: 'uppercase',
  },
  staleText: {
    fontFamily,
    fontSize: fontSizes.bodySecondary,
    fontWeight: fontWeights.normal,
    color: colors.amberDim,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  // Grid header
  gridHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    marginTop: 4,
  },
  teamNameCell: {
    width: 70,
    paddingRight: 4,
  },
  gwHeaderCell: {
    flex: 1,
    alignItems: 'center',
  },
  gwHeaderText: {
    fontFamily,
    fontSize: fontSizes.badge,
    fontWeight: fontWeights.normal,
    color: colors.blueLight,
    textTransform: 'uppercase',
  },
  // Team row
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.bgSurface,
    minHeight: 44,
  },
  teamRowSelected: {
    borderBottomColor: colors.gold,
    borderBottomWidth: 2,
  },
  teamNameText: {
    fontFamily,
    fontSize: fontSizes.bodySecondary,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    textTransform: 'uppercase',
  },
  indicatorRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 1,
  },
  bgwIndicator: {
    backgroundColor: colors.redBg,
    borderWidth: 1,
    borderColor: colors.red,
    paddingHorizontal: 2,
    paddingVertical: 0,
  },
  bgwIndicatorText: {
    fontFamily,
    fontSize: 5,
    fontWeight: fontWeights.bold,
    color: colors.red,
    textTransform: 'uppercase',
  },
  dgwIndicator: {
    backgroundColor: '#0a1a2a',
    borderWidth: 1,
    borderColor: colors.green,
    paddingHorizontal: 2,
    paddingVertical: 0,
  },
  dgwIndicatorText: {
    fontFamily,
    fontSize: 5,
    fontWeight: fontWeights.bold,
    color: colors.green,
    textTransform: 'uppercase',
  },
  // Fixture cell
  fixtureCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  // Detail view
  detailContainer: {
    marginTop: 8,
    backgroundColor: colors.bgSurface,
    borderWidth: 2,
    borderColor: colors.blueMid,
    padding: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.bgBase,
  },
  detailGw: {
    fontFamily,
    fontSize: fontSizes.bodySecondary,
    fontWeight: fontWeights.bold,
    color: colors.blueLight,
    width: 30,
    textTransform: 'uppercase',
  },
  detailOpponent: {
    fontFamily,
    fontSize: fontSizes.bodyPrimary,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    flex: 1,
    textTransform: 'uppercase',
  },
  detailFdr: {
    fontFamily,
    fontSize: fontSizes.bodySecondary,
    fontWeight: fontWeights.normal,
    color: colors.blueLight,
    textTransform: 'uppercase',
  },
  dgwTag: {
    backgroundColor: '#0a1a2a',
    borderWidth: 1,
    borderColor: colors.green,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  dgwTagText: {
    fontFamily,
    fontSize: fontSizes.badge,
    fontWeight: fontWeights.bold,
    color: colors.green,
    textTransform: 'uppercase',
  },
});
