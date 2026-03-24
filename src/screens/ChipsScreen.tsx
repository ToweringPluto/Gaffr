import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  RefreshControl,
  Text,
} from 'react-native';
import {
  colors,
  fontFamily,
  fontWeights,
  fontSizes,
  contentPadding,
} from '../theme';
import {
  ScreenHeader,
  SectionHeading,
  ChipCard,
  CaptainCard,
  PlayerRow,
  InlineTag,
  LoadingText,
} from '../components';
import { useBootstrap } from '../hooks/useBootstrap';
import { useFixtures } from '../hooks/useFixtures';
import { useSquad } from '../hooks/useSquad';
import { useNews } from '../hooks/useNews';
import { createLocalCache } from '../data/localCache';
import {
  getChipStatus,
  generateChipRoadmap,
} from '../domain/chipStrategyEngine';
import {
  rankCaptainCandidates,
  recommendViceCaptain,
} from '../domain/captaincyScorer';
import {
  checkBenchOrder,
  detectBlankBenchPlayers,
} from '../domain/benchOrderChecker';
import {
  getBgwDgwPlanningView,
  type BgwSquadImpact,
  type DgwSquadImpact,
} from '../domain/bgwDgwPlanner';
import {
  detectBlankGameweeks,
  detectDoubleGameweeks,
} from '../domain/fixtureAnalyser';
import { flagSquadRotationRisks } from '../domain/rotationRiskDetector';
import {
  getStandings,
  flagDifferential,
} from '../domain/miniLeagueAnalyser';
import { useResponsive } from '../hooks/useResponsive';
import type {
  SquadPlayer,
  Fixture,
  ChipStatus as ChipStatusType,
  ChipRoadmap,
  CaptainCandidate,
  BenchOrderWarning,
  MiniLeagueStanding,
} from '../models';

const cache = createLocalCache();

type PlayerStatus = 'playing' | 'blank' | 'doubt' | 'dgw';

function getPlayerStatus(
  player: SquadPlayer,
  currentGw: number,
  fixtures: Fixture[],
): PlayerStatus {
  if (player.chanceOfPlaying !== null && player.chanceOfPlaying < 75) {
    return 'doubt';
  }
  const teamFixtures = fixtures.filter(
    (f) =>
      f.gameweek === currentGw &&
      (f.homeTeamId === player.teamId || f.awayTeamId === player.teamId),
  );
  if (teamFixtures.length === 0) return 'blank';
  if (teamFixtures.length >= 2) return 'dgw';
  return 'playing';
}

function chipDisplayName(name: string): string {
  return name.replace(/_/g, ' ');
}

export const ChipsScreen: React.FC = () => {
  const bootstrap = useBootstrap();
  const fixturesHook = useFixtures();
  const newsHook = useNews();
  const [teamId, setTeamId] = useState<number | null>(null);
  const squad = useSquad(teamId);
  const [rivals, setRivals] = useState<MiniLeagueStanding[]>([]);
  const { isTablet } = useResponsive();

  useEffect(() => {
    cache.getTeamId().then((id) => setTeamId(id));
  }, []);

  const isLoading =
    bootstrap.loading || fixturesHook.loading || squad.loading || newsHook.loading;

  const onRefresh = useCallback(async () => {
    await Promise.all([
      bootstrap.refresh(),
      fixturesHook.refresh(),
      squad.refresh(),
      newsHook.refresh(),
    ]);
  }, [bootstrap, fixturesHook, squad, newsHook]);

  const currentGw = bootstrap.data?.currentGameweek ?? null;
  const fixtures = fixturesHook.data ?? [];
  const squadData = squad.data?.squad ?? null;
  const news = newsHook.data ?? [];
  const allTeamIds = useMemo(
    () => bootstrap.data?.teams.map((t) => t.id) ?? [],
    [bootstrap.data],
  );

  // --- Chip Status & Roadmap ---
  const chipStatus: ChipStatusType[] = useMemo(() => {
    if (!squad.data) return [];
    return squad.data.chipStatus;
  }, [squad.data]);

  const chipRoadmap: ChipRoadmap | null = useMemo(() => {
    if (chipStatus.length === 0 || !squadData || fixtures.length === 0) return null;
    const bgws = detectBlankGameweeks(fixtures, allTeamIds);
    const dgws = detectDoubleGameweeks(fixtures);
    return generateChipRoadmap(chipStatus, bgws, dgws, squadData, fixtures);
  }, [chipStatus, squadData, fixtures, allTeamIds]);

  // --- Captaincy Picks ---
  const captainCandidates: CaptainCandidate[] = useMemo(() => {
    if (!squadData || fixtures.length === 0) return [];
    const congestionRisks = flagSquadRotationRisks(squadData, fixtures, []);
    const congestionTeamIds = [...new Set(congestionRisks.map((r) => r.teamId))];
    return rankCaptainCandidates(squadData, fixtures, news, [], congestionTeamIds);
  }, [squadData, fixtures, news]);

  const viceCaptain = useMemo(
    () => recommendViceCaptain(captainCandidates),
    [captainCandidates],
  );

  // --- Bench Order ---
  const bench: SquadPlayer[] = useMemo(
    () => (squadData ? squadData.players.filter((p) => p.isBenched) : []),
    [squadData],
  );

  const benchWarnings: BenchOrderWarning[] = useMemo(() => {
    if (currentGw === null || bench.length === 0) return [];
    return checkBenchOrder(bench, fixtures, currentGw);
  }, [bench, fixtures, currentGw]);

  const blankBench = useMemo(() => {
    if (currentGw === null || bench.length === 0) return [];
    return detectBlankBenchPlayers(bench, fixtures, currentGw);
  }, [bench, fixtures, currentGw]);

  // --- BGW/DGW Planning ---
  const planningView = useMemo(() => {
    if (!squadData || fixtures.length === 0 || currentGw === null) return null;
    return getBgwDgwPlanningView(squadData, fixtures, allTeamIds, currentGw);
  }, [squadData, fixtures, allTeamIds, currentGw]);

  // --- Mini-League Standings ---
  const sortedRivals = useMemo(() => getStandings(rivals), [rivals]);

  return (
    <View style={styles.outerFrame}>
      <View style={styles.innerViewport}>
        <ScreenHeader title="CHIPS" gameweek={currentGw ?? undefined} />
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={onRefresh}
              tintColor={colors.gold}
            />
          }
        >
          {isLoading && !squadData && !bootstrap.data ? (
            <View style={styles.loadingContainer}>
              <LoadingText />
            </View>
          ) : (
            <>
              {/* Responsive grid for tablet: chips + captaincy side by side */}
              <View style={isTablet ? styles.tabletGrid : undefined}>
                <View style={isTablet ? styles.tabletColumn : undefined}>
                  {/* ===== CHIP STATUS ===== */}
                  <View style={styles.section}>
                    <SectionHeading title="CHIP STATUS" />
                    {chipStatus.length > 0 ? (
                      chipStatus.map((chip) => (
                        <View key={chip.chipName} style={styles.chipRow}>
                          <ChipCard
                            chipName={chipDisplayName(chip.chipName)}
                            isUsed={chip.used}
                            targetGameweek={
                              chip.used
                                ? `GW${chip.usedGameweek}`
                                : chipRoadmap?.recommendations.find(
                                    (r) => r.chipName === chip.chipName,
                                  )?.recommendedGameweek
                                  ? `GW${chipRoadmap.recommendations.find((r) => r.chipName === chip.chipName)!.recommendedGameweek}`
                                  : undefined
                            }
                          />
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>NO CHIP DATA AVAILABLE</Text>
                    )}
                  </View>

                  {/* ===== CHIP ROADMAP ===== */}
                  {chipRoadmap && chipRoadmap.recommendations.length > 0 && (
                    <View style={styles.section}>
                      <SectionHeading title="CHIP ROADMAP" />
                      {chipRoadmap.recommendations.map((rec) => (
                        <View key={rec.chipName} style={styles.roadmapRow}>
                          <View style={styles.roadmapLeft}>
                            <Text style={styles.roadmapChip}>
                              {chipDisplayName(rec.chipName).toUpperCase()}
                            </Text>
                            <Text style={styles.roadmapReason}>
                              {rec.reason.toUpperCase()}
                            </Text>
                          </View>
                          <View style={styles.roadmapRight}>
                            <Text style={styles.roadmapGw}>GW{rec.recommendedGameweek}</Text>
                            <InlineTag
                              label={rec.confidence}
                              variant={
                                rec.confidence === 'high'
                                  ? 'positive'
                                  : rec.confidence === 'medium'
                                    ? 'warning'
                                    : 'info'
                              }
                            />
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                <View style={isTablet ? styles.tabletColumn : undefined}>
                  {/* ===== CAPTAINCY PICKS ===== */}
                  {captainCandidates.length > 0 && (
                    <View style={styles.section}>
                      <SectionHeading title="CAPTAIN PICKS" />
                      {captainCandidates.map((c, i) => (
                        <CaptainCard
                          key={c.player.id}
                          playerName={c.player.name}
                          fixture={`${c.fixture.opponent} ${c.fixture.isHome ? 'H' : 'A'}`}
                          score={Math.round(c.captaincyScore * 10) / 10}
                          isTopPick={i === 0}
                          tags={
                            <View style={styles.tagsRow}>
                              {c.isDgw && <InlineTag label="DGW" variant="positive" />}
                              {c.hasInjuryRisk && (
                                <InlineTag label="INJURY" variant="negative" />
                              )}
                              {c.hasCongestionRisk && (
                                <InlineTag label="ROTATION" variant="warning" />
                              )}
                              {c.fixture.isHome && (
                                <InlineTag label="HOME" variant="positive" />
                              )}
                            </View>
                          }
                        />
                      ))}
                      {viceCaptain && (
                        <View style={styles.vcSection}>
                          <Text style={styles.vcLabel}>VICE CAPTAIN</Text>
                          <CaptainCard
                            playerName={viceCaptain.player.name}
                            fixture={`${viceCaptain.fixture.opponent} ${viceCaptain.fixture.isHome ? 'H' : 'A'}`}
                            score={
                              Math.round(viceCaptain.captaincyScore * 10) / 10
                            }
                            tags={
                              <View style={styles.tagsRow}>
                                <InlineTag label="VC" variant="info" />
                              </View>
                            }
                          />
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>

              {/* ===== BENCH ORDER ===== */}
              {bench.length > 0 && currentGw !== null && (
                <View style={styles.section}>
                  <SectionHeading title="BENCH ORDER" />
                  {bench
                    .sort((a, b) => a.benchOrder - b.benchOrder)
                    .map((p) => {
                      const status = getPlayerStatus(p, currentGw, fixtures);
                      const isBlank = blankBench.some(
                        (bb) => bb.player.id === p.id,
                      );
                      return (
                        <PlayerRow
                          key={p.id}
                          name={p.name}
                          status={status}
                          rightValue={`${p.benchOrder}`}
                          rightBadge={
                            isBlank ? (
                              <InlineTag label="NO FIX" variant="negative" />
                            ) : undefined
                          }
                        />
                      );
                    })}
                  {benchWarnings.length > 0 && (
                    <View style={styles.warningBlock}>
                      {benchWarnings.map((w, i) => (
                        <View key={`bw-${i}`} style={styles.warningRow}>
                          <View style={styles.warningDot} />
                          <Text style={styles.warningText}>
                            {w.blankPlayer.name.toUpperCase()} (NO FIXTURE) BLOCKS{' '}
                            {w.playingPlayerBehind.name.toUpperCase()}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* ===== BGW/DGW PLANNING ===== */}
              {planningView && (
                <View style={styles.section}>
                  <SectionHeading title="BGW/DGW PLANNING" />
                  {planningView.blankGameweeks.map((bgw: BgwSquadImpact) => (
                    <View key={`bgw-${bgw.gameweek}`} style={styles.planCard}>
                      <View style={styles.planHeader}>
                        <InlineTag label="BGW" variant="negative" />
                        <Text style={styles.planGw}>GW{bgw.gameweek}</Text>
                        <Text style={styles.planCount}>
                          {bgw.affectedCount} AFFECTED
                        </Text>
                      </View>
                      {bgw.affectedPlayers.map((p) => (
                        <PlayerRow
                          key={p.id}
                          name={p.name}
                          status="blank"
                          rightValue="NO FIXTURE"
                        />
                      ))}
                    </View>
                  ))}
                  {planningView.doubleGameweeks.map((dgw: DgwSquadImpact) => (
                    <View key={`dgw-${dgw.gameweek}`} style={styles.planCard}>
                      <View style={styles.planHeader}>
                        <InlineTag label="DGW" variant="positive" />
                        <Text style={styles.planGw}>GW{dgw.gameweek}</Text>
                        <Text style={styles.planCount}>
                          {dgw.benefitingCount} BENEFIT
                        </Text>
                      </View>
                      {dgw.benefitingPlayers.map((p) => (
                        <PlayerRow
                          key={p.id}
                          name={p.name}
                          status="dgw"
                          rightValue="2 FIXTURES"
                        />
                      ))}
                    </View>
                  ))}
                  {planningView.blankGameweeks.length === 0 &&
                    planningView.doubleGameweeks.length === 0 && (
                      <Text style={styles.emptyText}>
                        NO BGW/DGW IN NEXT 4 GAMEWEEKS
                      </Text>
                    )}
                </View>
              )}

              {/* ===== MINI-LEAGUE ===== */}
              {sortedRivals.length > 0 && (
                <View style={styles.section}>
                  <SectionHeading title="MINI-LEAGUE" />
                  {sortedRivals.map((rival) => (
                    <View key={rival.managerId} style={styles.rivalRow}>
                      <Text style={styles.rivalRank}>{rival.rank}</Text>
                      <View style={styles.rivalInfo}>
                        <Text style={styles.rivalName}>
                          {rival.managerName.toUpperCase()}
                        </Text>
                        <Text style={styles.rivalMeta}>
                          {rival.totalPoints} PTS -- GW {rival.gameweekPoints}
                        </Text>
                      </View>
                      <View style={styles.rivalRight}>
                        {rival.captainId > 0 && (
                          <InlineTag label="C" variant="captain" />
                        )}
                        {squadData &&
                          rival.squad.some(
                            (p) =>
                              flagDifferential(p, sortedRivals, 20),
                          ) && (
                            <InlineTag label="DIFF" variant="info" />
                          )}
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* No squad linked */}
              {!squadData && !squad.loading && (
                <View style={styles.section}>
                  <Text style={styles.emptyText}>
                    ENTER YOUR FPL TEAM ID TO SEE CHIP STRATEGY
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
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
  },
  bodyContent: {
    padding: contentPadding,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  section: {
    marginTop: 8,
  },
  chipRow: {
    marginBottom: 4,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  // Roadmap
  roadmapRow: {
    backgroundColor: colors.bgSurface,
    borderWidth: 2,
    borderColor: colors.blueMid,
    padding: 6,
    marginBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roadmapLeft: {
    flex: 1,
  },
  roadmapChip: {
    fontFamily,
    fontSize: 9,
    fontWeight: fontWeights.bold,
    color: colors.purple,
    textTransform: 'uppercase',
  },
  roadmapReason: {
    fontFamily,
    fontSize: 7,
    fontWeight: fontWeights.normal,
    color: colors.blueLight,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  roadmapRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  roadmapGw: {
    fontFamily,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    color: colors.gold,
  },
  // Vice captain
  vcSection: {
    marginTop: 4,
  },
  vcLabel: {
    fontFamily,
    fontSize: 7,
    fontWeight: fontWeights.normal,
    color: colors.blueLight,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  // Bench warnings
  warningBlock: {
    marginTop: 4,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  warningDot: {
    width: 8,
    height: 8,
    backgroundColor: colors.gold,
  },
  warningText: {
    fontFamily,
    fontSize: 8,
    fontWeight: fontWeights.bold,
    color: colors.gold,
    flex: 1,
    textTransform: 'uppercase',
  },
  // BGW/DGW planning
  planCard: {
    backgroundColor: colors.bgSurface,
    borderWidth: 2,
    borderColor: colors.blueMid,
    padding: 6,
    marginBottom: 4,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  planGw: {
    fontFamily,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    color: colors.textTitle,
    textTransform: 'uppercase',
  },
  planCount: {
    fontFamily,
    fontSize: 8,
    fontWeight: fontWeights.normal,
    color: colors.blueLight,
    textTransform: 'uppercase',
  },
  // Mini-league
  rivalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.bgSurface,
  },
  rivalRank: {
    fontFamily,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    color: colors.gold,
    width: 20,
    textAlign: 'center',
  },
  rivalInfo: {
    flex: 1,
  },
  rivalName: {
    fontFamily,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    textTransform: 'uppercase',
  },
  rivalMeta: {
    fontFamily,
    fontSize: 7,
    fontWeight: fontWeights.normal,
    color: colors.blueLight,
    textTransform: 'uppercase',
  },
  rivalRight: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily,
    fontSize: fontSizes.bodyPrimary,
    fontWeight: fontWeights.bold,
    color: colors.blueLight,
    textAlign: 'center',
    paddingVertical: 12,
    textTransform: 'uppercase',
  },
  tabletGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  tabletColumn: {
    flex: 1,
  },
});
