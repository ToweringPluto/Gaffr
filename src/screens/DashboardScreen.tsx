import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  RefreshControl,
  Text,
} from 'react-native';
import { colors, fontFamily, fontWeights, fontSizes, contentPadding } from '../theme';
import {
  ScreenHeader,
  DeadlineBar,
  StatTrio,
  PlayerRow,
  SectionHeading,
  InlineTag,
  LoadingText,
} from '../components';
import { TeamIdScreen } from './TeamIdScreen';
import { useBootstrap } from '../hooks/useBootstrap';
import { useFixtures } from '../hooks/useFixtures';
import { useSquad } from '../hooks/useSquad';
import {
  getDeadlineState,
  type DeadlineState,
} from '../domain/deadlineTimer';
import {
  checkBenchOrder,
  checkStarterInjuryRisk,
} from '../domain/benchOrderChecker';
import { detectOverlaps } from '../domain/teamOverlapDetector';
import { sortNewsByPriority, getSquadPlayerIds } from '../domain/newsProcessor';
import { useNews } from '../hooks/useNews';
import { createLocalCache } from '../data/localCache';

// Lazy import to avoid expo-notifications crash in Expo Go
const scheduleDeadlineReminderSafe = async (deadline: string) => {
  try {
    const { scheduleDeadlineReminder } = await import('../notifications/deadlineNotifier');
    await scheduleDeadlineReminder(deadline);
  } catch {
    // expo-notifications not available (e.g. Expo Go) — skip silently
  }
};

import { useResponsive } from '../hooks/useResponsive';
import type { SquadPlayer, BenchOrderWarning, HighPriorityAlert, TeamOverlap, NewsItem, NewsSeverity } from '../models';

const cache = createLocalCache();
const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const SEVERITY_DOT_COLOR: Record<NewsSeverity, string> = {
  available: colors.green,
  doubtful_75: colors.gold,
  doubtful_50: colors.gold,
  doubtful_25: colors.gold,
  injured_suspended: colors.red,
};

type TagVariant = 'positive' | 'warning' | 'negative';

const SEVERITY_TAG_VARIANT: Record<NewsSeverity, TagVariant> = {
  available: 'positive',
  doubtful_75: 'warning',
  doubtful_50: 'warning',
  doubtful_25: 'warning',
  injured_suspended: 'negative',
};

const SEVERITY_LABEL: Record<NewsSeverity, string> = {
  available: 'AVAILABLE',
  doubtful_75: 'DOUBTFUL 75%',
  doubtful_50: 'DOUBTFUL 50%',
  doubtful_25: 'DOUBTFUL 25%',
  injured_suspended: 'INJURED',
};

type PlayerStatus = 'playing' | 'blank' | 'doubt' | 'dgw';

function getPlayerStatus(
  player: SquadPlayer,
  currentGw: number,
  fixtures: { gameweek: number; homeTeamId: number; awayTeamId: number }[],
): PlayerStatus {
  // Injury / suspension
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

function formatCountdown(ds: DeadlineState): string {
  const { days, hours, minutes, seconds } = ds.countdown;
  if (ds.isLocked) return 'LOCKED';
  if (days > 0) return `${days}D ${hours}H ${minutes}M`;
  if (hours > 0) return `${hours}H ${minutes}M ${seconds}S`;
  return `${minutes}M ${seconds}S`;
}

export const DashboardScreen: React.FC = () => {
  const bootstrap = useBootstrap();
  const fixturesHook = useFixtures();
  const [teamId, setTeamId] = useState<number | null>(null);
  const [teamIdChecked, setTeamIdChecked] = useState(false);
  const [showTeamIdScreen, setShowTeamIdScreen] = useState(false);
  const squad = useSquad(
    teamId,
    bootstrap.data?.players,
    bootstrap.data?.currentGameweek,
  );
  const news = useNews();
  const [deadlineState, setDeadlineState] = useState<DeadlineState | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { isTablet } = useResponsive();

  // Load stored team ID
  useEffect(() => {
    cache.getTeamId().then((id) => {
      setTeamId(id);
      setTeamIdChecked(true);
      if (id === null) setShowTeamIdScreen(true);
    });
  }, []);

  // Deadline timer — update every second
  useEffect(() => {
    const tick = () => {
      if (bootstrap.data?.gameweeks) {
        const state = getDeadlineState(bootstrap.data.gameweeks, new Date(), TIMEZONE);
        setDeadlineState(state);
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [bootstrap.data]);

  // Schedule deadline push notification when bootstrap data is available
  useEffect(() => {
    if (bootstrap.data?.gameweeks) {
      const state = getDeadlineState(bootstrap.data.gameweeks, new Date(), TIMEZONE);
      if (state && !state.isLocked && state.deadlineUtc) {
        scheduleDeadlineReminderSafe(state.deadlineUtc);
      }
    }
  }, [bootstrap.data]);

  const isLoading = bootstrap.loading || fixturesHook.loading || squad.loading;

  const onRefresh = useCallback(async () => {
    await Promise.all([
      bootstrap.refresh(),
      fixturesHook.refresh(),
      squad.refresh(),
    ]);
  }, [bootstrap, fixturesHook, squad]);

  // Derived data
  const currentGw = bootstrap.data?.currentGameweek ?? null;
  const fixtures = fixturesHook.data ?? [];
  const squadData = squad.data?.squad ?? null;
  const chipStatus = squad.data?.chipStatus ?? [];

  const starters: SquadPlayer[] = squadData
    ? squadData.players.filter((p) => !p.isBenched)
    : [];
  const bench: SquadPlayer[] = squadData
    ? squadData.players.filter((p) => p.isBenched)
    : [];

  // Bench order warnings
  const benchWarnings: BenchOrderWarning[] =
    currentGw !== null && bench.length > 0
      ? checkBenchOrder(bench, fixtures, currentGw)
      : [];

  // High priority alerts (starter injury + blank bench replacement)
  const highAlerts: HighPriorityAlert[] =
    currentGw !== null && starters.length > 0 && bench.length > 0
      ? checkStarterInjuryRisk(starters, bench, [], fixtures, currentGw)
      : [];

  // Team overlaps
  const overlaps: TeamOverlap[] =
    currentGw !== null && squadData
      ? detectOverlaps(squadData, fixtures, currentGw)
      : [];

  // Chips remaining count
  const chipsRemaining = chipStatus.filter((c) => !c.used).length;

  // Sorted news items — squad injury news first
  const sortedNews: NewsItem[] = (() => {
    if (!news.data || news.data.length === 0) return [];
    const squadIds = squadData ? getSquadPlayerIds(squadData.players) : new Set<number>();
    return sortNewsByPriority(news.data, squadIds);
  })();

  // Show team ID entry screen if no team linked yet
  if (showTeamIdScreen && !teamId) {
    return (
      <TeamIdScreen
        onLinked={(id) => {
          setTeamId(id);
          setShowTeamIdScreen(false);
        }}
        onSkip={() => setShowTeamIdScreen(false)}
      />
    );
  }

  // Wait for team ID check before rendering
  if (!teamIdChecked) {
    return (
      <View style={styles.outerFrame}>
        <View style={styles.innerViewport}>
          <ScreenHeader showLogo />
          <View style={styles.loadingContainer}>
            <LoadingText />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.outerFrame}>
      <View style={styles.innerViewport}>
        <ScreenHeader showLogo gameweek={currentGw ?? undefined} />
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
              {/* Deadline Bar */}
              {deadlineState && !deadlineState.isLocked && (
                <DeadlineBar
                  countdown={formatCountdown(deadlineState)}
                  isUrgent={deadlineState.urgency === 'warning'}
                />
              )}
              {deadlineState?.isLocked && (
                <View style={styles.lockedBar}>
                  <Text style={styles.lockedText}>GW{deadlineState.gameweek} LOCKED</Text>
                </View>
              )}

              {/* Stat Trio — Budget / Free Transfers / Chips */}
              {squadData && (
                <View style={styles.section}>
                  <StatTrio
                    items={[
                      {
                        value: `${(squadData.budget / 10).toFixed(1)}`,
                        label: 'BUDGET',
                        color: colors.gold,
                      },
                      {
                        value: `${squadData.freeTransfers}`,
                        label: 'FREE TRANSFERS',
                        color: colors.green,
                      },
                      {
                        value: `${chipsRemaining}`,
                        label: 'CHIPS LEFT',
                        color: colors.purple,
                      },
                    ]}
                  />
                </View>
              )}

              {/* Responsive grid for tablet */}
              <View style={isTablet ? styles.tabletGrid : undefined}>
                <View style={isTablet ? styles.tabletColumn : undefined}>
                  {/* High Priority Alerts */}
                  {highAlerts.length > 0 && (
                    <View style={styles.section}>
                      <SectionHeading title="ALERTS" />
                      {highAlerts.map((alert, i) => (
                        <View key={`alert-${i}`} style={styles.alertRow}>
                          <View style={styles.alertDot} />
                          <Text style={styles.alertText}>
                            {alert.starter.name.toUpperCase()} ({alert.starter.chanceOfPlaying}%) {'>> '}
                            {alert.benchReplacement.name.toUpperCase()} (NO FIXTURE)
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Squad — Starters */}
                  {starters.length > 0 && (
                    <View style={styles.section}>
                      <SectionHeading title="STARTING XI" />
                      {starters.map((p) => (
                        <PlayerRow
                          key={p.id}
                          name={p.name}
                          status={getPlayerStatus(p, currentGw!, fixtures)}
                          rightValue={`${p.form.toFixed(1)}`}
                          rightBadge={
                            p.isCaptain ? (
                              <InlineTag label="C" variant="captain" />
                            ) : p.isViceCaptain ? (
                              <InlineTag label="VC" variant="info" />
                            ) : undefined
                          }
                        />
                      ))}
                    </View>
                  )}
                </View>

                <View style={isTablet ? styles.tabletColumn : undefined}>
                  {/* Team Overlap Warnings */}
                  {overlaps.length > 0 && (
                    <View style={styles.section}>
                      <SectionHeading title="TEAM OVERLAP" />
                      {overlaps.map((overlap, i) => (
                        <View key={`overlap-${i}`} style={styles.overlapCard}>
                          <View style={styles.overlapHeader}>
                            <InlineTag
                              label={overlap.severity === 'high' ? 'HIGH RISK' : 'OVERLAP'}
                              variant={overlap.severity === 'high' ? 'negative' : 'warning'}
                            />
                            <Text style={styles.overlapMeta}>
                              {overlap.players.length} PLAYERS -- MAX LOSS {overlap.maxPotentialLoss.toFixed(1)}
                            </Text>
                          </View>
                          {overlap.players.map((p) => (
                            <PlayerRow
                              key={p.id}
                              name={p.name}
                              status={getPlayerStatus(p, currentGw!, fixtures)}
                              rightValue={`${p.form.toFixed(1)} PTS`}
                            />
                          ))}
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Squad — Bench */}
                  {bench.length > 0 && (
                    <View style={styles.section}>
                      <SectionHeading title="BENCH" />
                      {bench.map((p) => (
                        <PlayerRow
                          key={p.id}
                          name={p.name}
                          status={getPlayerStatus(p, currentGw!, fixtures)}
                          rightValue={`${p.benchOrder}`}
                        />
                      ))}
                    </View>
                  )}

                  {/* Bench Order Warnings */}
                  {benchWarnings.length > 0 && (
                    <View style={styles.section}>
                      <SectionHeading title="BENCH ORDER" />
                      {benchWarnings.map((w, i) => (
                        <View key={`bw-${i}`} style={styles.alertRow}>
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
              </View>

              {/* News Feed */}
              {(sortedNews.length > 0 || news.error) && (
                <View style={styles.section}>
                  <SectionHeading title="NEWS" />
                  {news.error && (
                    <Text style={styles.newsUnavailableText}>
                      EXTERNAL NEWS UNAVAILABLE
                    </Text>
                  )}
                  {sortedNews.map((item, i) => (
                    <View key={`news-${i}`} style={styles.newsItem}>
                      <View style={styles.newsRow}>
                        <View
                          style={[
                            styles.newsDot,
                            { backgroundColor: SEVERITY_DOT_COLOR[item.severity] },
                          ]}
                        />
                        <Text style={styles.newsPlayerName}>
                          {item.playerName.toUpperCase()}
                        </Text>
                        <InlineTag
                          label={SEVERITY_LABEL[item.severity]}
                          variant={SEVERITY_TAG_VARIANT[item.severity]}
                        />
                      </View>
                      {item.speakerName && (
                        <Text style={styles.newsSpeaker}>
                          {item.speakerName.toUpperCase()}:
                        </Text>
                      )}
                      <Text style={styles.newsContent}>
                        {item.content.toUpperCase()}
                      </Text>
                      <Text style={styles.newsTimestamp}>
                        {item.timestamp}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* No squad linked message */}
              {!teamId && !squadData && !squad.loading && (
                <View style={styles.section}>
                  <Text style={styles.noSquadText}>
                    ENTER YOUR FPL TEAM ID TO SEE YOUR SQUAD
                  </Text>
                </View>
              )}

              {/* Error messages */}
              {bootstrap.error && (
                <View style={styles.section}>
                  <Text style={styles.errorText}>{bootstrap.error.toUpperCase()}</Text>
                </View>
              )}
              {fixturesHook.error && (
                <View style={styles.section}>
                  <Text style={styles.errorText}>{fixturesHook.error.toUpperCase()}</Text>
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
  lockedBar: {
    backgroundColor: colors.bgSurface,
    borderWidth: 2,
    borderColor: colors.blueMid,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  lockedText: {
    fontFamily,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    color: colors.blueLight,
    textTransform: 'uppercase',
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  alertDot: {
    width: 8,
    height: 8,
    backgroundColor: colors.red,
  },
  alertText: {
    fontFamily,
    fontSize: 8,
    fontWeight: fontWeights.bold,
    color: colors.red,
    flex: 1,
    textTransform: 'uppercase',
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
  overlapCard: {
    backgroundColor: colors.bgSurface,
    borderWidth: 2,
    borderColor: colors.blueMid,
    padding: 6,
    marginBottom: 4,
  },
  overlapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  overlapMeta: {
    fontFamily,
    fontSize: 7,
    fontWeight: fontWeights.normal,
    color: colors.blueLight,
    textTransform: 'uppercase',
  },
  noSquadText: {
    fontFamily,
    fontSize: fontSizes.bodyPrimary,
    fontWeight: fontWeights.bold,
    color: colors.blueLight,
    textAlign: 'center',
    paddingVertical: 20,
    textTransform: 'uppercase',
  },
  newsUnavailableText: {
    fontFamily,
    fontSize: fontSizes.bodySecondary,
    fontWeight: fontWeights.normal,
    color: colors.red,
    textTransform: 'uppercase',
    paddingVertical: 4,
  },
  newsItem: {
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.bgSurface,
  },
  newsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newsDot: {
    width: 8,
    height: 8,
  },
  newsPlayerName: {
    fontFamily,
    fontSize: fontSizes.bodyPrimary,
    fontWeight: fontWeights.bold,
    color: '#c8d8e8',
    textTransform: 'uppercase',
    flex: 1,
  },
  newsSpeaker: {
    fontFamily,
    fontSize: fontSizes.bodySecondary,
    fontWeight: fontWeights.bold,
    color: colors.gold,
    textTransform: 'uppercase',
    paddingLeft: 14,
    marginTop: 2,
  },
  newsContent: {
    fontFamily,
    fontSize: fontSizes.bodySecondary,
    fontWeight: fontWeights.normal,
    color: '#c8d8e8',
    textTransform: 'uppercase',
    paddingLeft: 14,
    marginTop: 2,
  },
  newsTimestamp: {
    fontFamily,
    fontSize: fontSizes.bodySecondary,
    fontWeight: fontWeights.normal,
    color: colors.blueLight,
    textTransform: 'uppercase',
    paddingLeft: 14,
    marginTop: 2,
  },
  errorText: {
    fontFamily,
    fontSize: fontSizes.bodySecondary,
    fontWeight: fontWeights.normal,
    color: colors.red,
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
