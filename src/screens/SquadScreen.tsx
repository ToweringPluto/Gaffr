import React, { useState, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  RefreshControl,
  Text,
  TouchableOpacity,
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
  PlayerRow,
  SectionHeading,
  InlineTag,
  TransferRow,
  StatTrio,
  LoadingText,
} from '../components';
import { useBootstrap } from '../hooks/useBootstrap';
import { useFixtures } from '../hooks/useFixtures';
import { useSquad } from '../hooks/useSquad';
import {
  rankByForm,
  filterByPosition,
  filterByPrice,
  getFormTrend,
  getGameweekBreakdown,
} from '../domain/playerFormRanker';
import {
  suggestTransfersOut,
  suggestTransfersIn,
  projectPointsGain,
} from '../domain/transferSuggester';
import {
  calculateProjectedGain,
  isHitJustified,
  calculateMultiTransferHit,
} from '../domain/transferHitCalculator';
import {
  predictPriceChange,
  getSellAlerts,
  getBuyUrgency,
} from '../domain/priceChangePredictor';
import { createLocalCache } from '../data/localCache';
import { useResponsive } from '../hooks/useResponsive';
import type {
  Position,
  RankedPlayer,
  Player,
  GameweekPoints,
  TransferSuggestion,
  PricePrediction,
  SellAlert,
} from '../models';

const cache = createLocalCache();
const POSITIONS: Position[] = ['GKP', 'DEF', 'MID', 'FWD'];
const PRICE_MIN = 35;
const PRICE_MAX = 160;
const PRICE_STEP = 5;

type ViewMode = 'players' | 'transfers';

export const SquadScreen: React.FC = () => {
  const bootstrap = useBootstrap();
  const fixturesHook = useFixtures();
  const [teamId, setTeamId] = useState<number | null>(null);
  const squad = useSquad(
    teamId,
    bootstrap.data?.players,
    bootstrap.data?.currentGameweek,
  );

  const [viewMode, setViewMode] = useState<ViewMode>('players');
  const [positionFilter, setPositionFilter] = useState<Position | null>(null);
  const [priceMin, setPriceMin] = useState<number>(PRICE_MIN);
  const [priceMax, setPriceMax] = useState<number>(PRICE_MAX);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const { isTablet } = useResponsive();

  // Load stored team ID
  React.useEffect(() => {
    cache.getTeamId().then((id) => setTeamId(id));
  }, []);

  const isLoading = bootstrap.loading || fixturesHook.loading || squad.loading;
  const currentGw = bootstrap.data?.currentGameweek ?? null;
  const allPlayers = bootstrap.data?.players ?? [];
  const fixtures = fixturesHook.data ?? [];
  const squadData = squad.data?.squad ?? null;

  const onRefresh = useCallback(async () => {
    await Promise.all([
      bootstrap.refresh(),
      fixturesHook.refresh(),
      squad.refresh(),
    ]);
  }, [bootstrap, fixturesHook, squad]);

  // --- Players View Data ---
  const rankedPlayers = useMemo(() => {
    if (allPlayers.length === 0) return [];
    return rankByForm(allPlayers, 4);
  }, [allPlayers]);

  const filteredPlayers = useMemo(() => {
    let result = rankedPlayers;
    if (positionFilter) {
      result = filterByPosition(result, positionFilter);
    }
    result = filterByPrice(result, priceMin, priceMax);
    return result;
  }, [rankedPlayers, positionFilter, priceMin, priceMax]);

  const selectedPlayer = useMemo(() => {
    if (selectedPlayerId === null) return null;
    return allPlayers.find((p) => p.id === selectedPlayerId) ?? null;
  }, [allPlayers, selectedPlayerId]);

  const selectedBreakdown = useMemo((): GameweekPoints[] => {
    if (!selectedPlayer) return [];
    return getGameweekBreakdown(selectedPlayer, 10);
  }, [selectedPlayer]);

  // --- Transfers View Data ---
  const transfersOut = useMemo((): TransferSuggestion[] => {
    if (!squadData || fixtures.length === 0) return [];
    return suggestTransfersOut(squadData, fixtures).slice(0, 5);
  }, [squadData, fixtures]);

  const transfersIn = useMemo((): TransferSuggestion[] => {
    if (!squadData || fixtures.length === 0 || allPlayers.length === 0) return [];
    // Suggest for each position, take top 3 per position
    const suggestions: TransferSuggestion[] = [];
    for (const pos of POSITIONS) {
      const budget = squadData.budget;
      const posResults = suggestTransfersIn(pos, budget, fixtures, allPlayers);
      suggestions.push(...posResults.slice(0, 3));
    }
    return suggestions.sort((a, b) => b.score - a.score).slice(0, 8);
  }, [squadData, fixtures, allPlayers]);

  // Price predictions (simple: compare current ownership as "previous" minus small delta)
  const pricePredictions = useMemo((): PricePrediction[] => {
    return allPlayers.map((p) => ({
      playerId: p.id,
      direction: predictPriceChange(p, p.ownershipPercentage),
      predictedChange: 1,
    }));
  }, [allPlayers]);

  const sellAlerts = useMemo((): SellAlert[] => {
    if (!squadData) return [];
    return getSellAlerts(squadData, pricePredictions);
  }, [squadData, pricePredictions]);

  const freeTransfers = squadData?.freeTransfers ?? 0;
  const showHitCalculator = freeTransfers === 0 && squadData !== null;

  // Hit calculator for top transfer suggestion
  const hitResult = useMemo(() => {
    if (!showHitCalculator || transfersOut.length === 0 || transfersIn.length === 0) return null;
    const outPlayer = transfersOut[0].playerOut;
    const inPlayer = transfersIn[0].playerIn;
    if (!outPlayer) return null;
    const projGain = calculateProjectedGain(outPlayer, inPlayer, 3);
    return {
      hitCost: 4,
      projectedGain: projGain,
      net: projGain - 4,
      justified: isHitJustified(projGain, 4),
    };
  }, [showHitCalculator, transfersOut, transfersIn]);

  const getFormTagVariant = (trend: string): 'positive' | 'info' | 'negative' => {
    if (trend === 'rising') return 'positive';
    if (trend === 'falling') return 'negative';
    return 'info';
  };

  const formatCost = (cost: number): string => `${(cost / 10).toFixed(1)}`;

  return (
    <View style={styles.outerFrame}>
      <View style={styles.innerViewport}>
        <ScreenHeader title="SQUAD" gameweek={currentGw ?? undefined} />
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
          {isLoading && !bootstrap.data ? (
            <View style={styles.loadingContainer}>
              <LoadingText />
            </View>
          ) : (
            <>
              {/* View Mode Toggle */}
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    viewMode === 'players' && styles.toggleBtnActive,
                  ]}
                  onPress={() => setViewMode('players')}
                  accessibilityRole="button"
                  accessibilityLabel="Show players view"
                >
                  <Text
                    style={[
                      styles.toggleText,
                      viewMode === 'players' && styles.toggleTextActive,
                    ]}
                  >
                    PLAYERS
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    viewMode === 'transfers' && styles.toggleBtnActive,
                  ]}
                  onPress={() => setViewMode('transfers')}
                  accessibilityRole="button"
                  accessibilityLabel="Show transfers view"
                >
                  <Text
                    style={[
                      styles.toggleText,
                      viewMode === 'transfers' && styles.toggleTextActive,
                    ]}
                  >
                    TRANSFERS
                  </Text>
                </TouchableOpacity>
              </View>

              {viewMode === 'players' ? (
                <>
                  {/* Position Filters */}
                  <View style={styles.filterRow}>
                    <TouchableOpacity
                      style={[
                        styles.filterBtn,
                        positionFilter === null && styles.filterBtnActive,
                      ]}
                      onPress={() => setPositionFilter(null)}
                      accessibilityRole="button"
                      accessibilityLabel="Show all positions"
                    >
                      <Text
                        style={[
                          styles.filterText,
                          positionFilter === null && styles.filterTextActive,
                        ]}
                      >
                        ALL
                      </Text>
                    </TouchableOpacity>
                    {POSITIONS.map((pos) => (
                      <TouchableOpacity
                        key={pos}
                        style={[
                          styles.filterBtn,
                          positionFilter === pos && styles.filterBtnActive,
                        ]}
                        onPress={() =>
                          setPositionFilter(positionFilter === pos ? null : pos)
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`Filter by ${pos}`}
                      >
                        <Text
                          style={[
                            styles.filterText,
                            positionFilter === pos && styles.filterTextActive,
                          ]}
                        >
                          {pos}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Price Filter */}
                  <View style={styles.priceFilterRow}>
                    <Text style={styles.priceLabel}>PRICE</Text>
                    <TouchableOpacity
                      style={styles.priceBtn}
                      onPress={() => setPriceMin(Math.max(PRICE_MIN, priceMin - PRICE_STEP))}
                      accessibilityRole="button"
                      accessibilityLabel="Decrease minimum price"
                    >
                      <Text style={styles.priceBtnText}>{'--'}</Text>
                    </TouchableOpacity>
                    <Text style={styles.priceValue}>
                      {formatCost(priceMin)} - {formatCost(priceMax)}
                    </Text>
                    <TouchableOpacity
                      style={styles.priceBtn}
                      onPress={() => setPriceMax(Math.min(PRICE_MAX, priceMax + PRICE_STEP))}
                      accessibilityRole="button"
                      accessibilityLabel="Increase maximum price"
                    >
                      <Text style={styles.priceBtnText}>{'++'}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Player Detail (10-GW Breakdown) */}
                  {selectedPlayer && (
                    <View style={styles.detailCard}>
                      <View style={styles.detailHeader}>
                        <Text style={styles.detailName}>
                          {selectedPlayer.name.toUpperCase()}
                        </Text>
                        <TouchableOpacity
                          onPress={() => setSelectedPlayerId(null)}
                          accessibilityRole="button"
                          accessibilityLabel="Close player detail"
                          style={styles.closeBtn}
                        >
                          <Text style={styles.closeBtnText}>[X]</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.detailMeta}>
                        <Text style={styles.detailMetaText}>
                          {selectedPlayer.position} -- {formatCost(selectedPlayer.cost)}M -- {selectedPlayer.totalPoints} PTS
                        </Text>
                        <InlineTag
                          label={getFormTrend(selectedPlayer)}
                          variant={getFormTagVariant(getFormTrend(selectedPlayer))}
                        />
                      </View>
                      <SectionHeading title="10-GW BREAKDOWN" />
                      <View style={styles.breakdownGrid}>
                        {selectedBreakdown.map((gw) => (
                          <View key={gw.gameweek} style={styles.breakdownCell}>
                            <Text style={styles.breakdownGw}>GW{gw.gameweek}</Text>
                            <Text
                              style={[
                                styles.breakdownPts,
                                {
                                  color:
                                    gw.points >= 6
                                      ? colors.green
                                      : gw.points <= 1
                                        ? colors.red
                                        : colors.textPrimary,
                                },
                              ]}
                            >
                              {gw.points}
                            </Text>
                            <Text style={styles.breakdownMin}>{gw.minutes}M</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Ranked Player List */}
                  <SectionHeading title="PLAYER FORM" />
                  {filteredPlayers.length === 0 ? (
                    <Text style={styles.emptyText}>NO PLAYERS MATCH FILTERS</Text>
                  ) : (
                    filteredPlayers.slice(0, 50).map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => setSelectedPlayerId(p.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`View details for ${p.name}`}
                        style={styles.touchTarget}
                      >
                        <PlayerRow
                          name={p.name}
                          status={
                            p.chanceOfPlaying !== null && p.chanceOfPlaying < 75
                              ? 'doubt'
                              : 'playing'
                          }
                          rightBadge={
                            <View style={styles.playerRightGroup}>
                              <InlineTag
                                label={p.formTrend}
                                variant={getFormTagVariant(p.formTrend)}
                              />
                              <Text style={styles.formValue}>
                                {p.form.toFixed(1)}
                              </Text>
                            </View>
                          }
                        />
                      </TouchableOpacity>
                    ))
                  )}
                </>
              ) : (
                <>
                  {/* === TRANSFERS VIEW === */}

                  {/* Responsive grid for tablet: transfers + targets side by side */}
                  <View style={isTablet ? styles.tabletGrid : undefined}>
                    <View style={isTablet ? styles.tabletColumn : undefined}>
                      {/* Hit Calculator */}
                      {showHitCalculator && hitResult && (
                        <View style={styles.section}>
                          <SectionHeading title="HIT CALCULATOR" />
                          <StatTrio
                            items={[
                              {
                                value: `-${hitResult.hitCost}`,
                                label: 'HIT COST',
                                color: colors.red,
                              },
                              {
                                value: `+${hitResult.projectedGain.toFixed(1)}`,
                                label: 'PROJ GAIN',
                                color: colors.green,
                              },
                              {
                                value: `${hitResult.net > 0 ? '+' : ''}${hitResult.net.toFixed(1)}`,
                                label: 'NET',
                                color: hitResult.justified ? colors.green : colors.red,
                              },
                            ]}
                          />
                          <View style={styles.hitVerdict}>
                            <InlineTag
                              label={hitResult.justified ? 'HIT JUSTIFIED' : 'HIT NOT RECOMMENDED'}
                              variant={hitResult.justified ? 'positive' : 'negative'}
                            />
                          </View>
                        </View>
                      )}

                      {/* Transfer Suggestions Out */}
                      {transfersOut.length > 0 && (
                        <View style={styles.section}>
                          <SectionHeading title="SUGGESTED TRANSFERS" />
                          {transfersOut.slice(0, 5).map((t, i) => {
                            if (!t.playerOut) return null;
                            const replacement = transfersIn.find(
                              (r) => r.playerIn.position === t.playerOut!.position,
                            );
                            if (!replacement) return null;
                            const gain = projectPointsGain(
                              t.playerOut,
                              replacement.playerIn,
                              4,
                            );
                            return (
                              <TransferRow
                                key={`transfer-${i}`}
                                playerOut={t.playerOut.name}
                                playerIn={replacement.playerIn.name}
                                projectedGain={`${gain > 0 ? '+' : ''}${gain.toFixed(1)}`}
                              />
                            );
                          })}
                        </View>
                      )}

                      {/* Price Change Alerts */}
                      {sellAlerts.length > 0 && (
                        <View style={styles.section}>
                          <SectionHeading title="PRICE ALERTS" />
                          {sellAlerts.map((alert) => (
                            <View key={alert.player.id} style={styles.priceAlertRow}>
                              <View style={styles.alertDot} />
                              <Text style={styles.priceAlertName}>
                                {alert.player.name.toUpperCase()}
                              </Text>
                              <InlineTag label="FALLING" variant="negative" />
                              <Text style={styles.priceAlertValue}>
                                {formatCost(alert.currentSellingPrice)}M {'>> '}
                                {formatCost(alert.predictedSellingPrice)}M
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>

                    <View style={isTablet ? styles.tabletColumn : undefined}>
                      {/* Buy Urgency on Transfer In suggestions */}
                      {transfersIn.length > 0 && (
                        <View style={styles.section}>
                          <SectionHeading title="TOP TARGETS" />
                          {transfersIn.slice(0, 6).map((t) => {
                            const pred = pricePredictions.find(
                              (p) => p.playerId === t.playerIn.id,
                            );
                            const urgency =
                              pred && pred.direction === 'rising'
                                ? getBuyUrgency(t.playerIn, pred)
                                : null;
                            return (
                              <View key={t.playerIn.id} style={styles.targetRow}>
                                <PlayerRow
                                  name={t.playerIn.name}
                                  status="playing"
                                  rightBadge={
                                    <View style={styles.playerRightGroup}>
                                      {urgency && (
                                        <InlineTag
                                          label={`RISING ${urgency.urgency.toUpperCase()}`}
                                          variant="positive"
                                        />
                                      )}
                                      <Text style={styles.targetScore}>
                                        {t.score.toFixed(1)}
                                      </Text>
                                    </View>
                                  }
                                />
                              </View>
                            );
                          })}
                        </View>
                      )}

                      {!squadData && !squad.loading && (
                        <View style={styles.section}>
                          <Text style={styles.emptyText}>
                            LINK YOUR FPL TEAM ID FOR TRANSFER SUGGESTIONS
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </>
              )}

              {/* Errors */}
              {bootstrap.error && (
                <Text style={styles.errorText}>{bootstrap.error.toUpperCase()}</Text>
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
  // View mode toggle
  toggleRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  toggleBtn: {
    flex: 1,
    backgroundColor: colors.bgSurface,
    borderWidth: 2,
    borderColor: colors.blueMid,
    paddingVertical: 6,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  toggleBtnActive: {
    borderColor: colors.gold,
  },
  toggleText: {
    fontFamily,
    fontSize: fontSizes.bodyPrimary,
    fontWeight: fontWeights.bold,
    color: colors.blueMid,
    textTransform: 'uppercase',
  },
  toggleTextActive: {
    color: colors.gold,
  },
  // Position filters
  filterRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 6,
  },
  filterBtn: {
    flex: 1,
    backgroundColor: colors.bgSurface,
    borderWidth: 2,
    borderColor: colors.blueMid,
    paddingVertical: 4,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  filterBtnActive: {
    borderColor: colors.gold,
  },
  filterText: {
    fontFamily,
    fontSize: fontSizes.badge,
    fontWeight: fontWeights.bold,
    color: colors.blueMid,
    textTransform: 'uppercase',
  },
  filterTextActive: {
    color: colors.gold,
  },
  // Price filter
  priceFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  priceLabel: {
    fontFamily,
    fontSize: fontSizes.statLabel,
    fontWeight: fontWeights.normal,
    color: colors.blueLight,
    textTransform: 'uppercase',
  },
  priceBtn: {
    backgroundColor: colors.bgSurface,
    borderWidth: 2,
    borderColor: colors.blueMid,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceBtnText: {
    fontFamily,
    fontSize: fontSizes.bodyPrimary,
    fontWeight: fontWeights.bold,
    color: colors.gold,
  },
  priceValue: {
    fontFamily,
    fontSize: fontSizes.bodySecondary,
    fontWeight: fontWeights.normal,
    color: colors.blueLight,
    flex: 1,
    textAlign: 'center',
  },
  // Player detail card
  detailCard: {
    backgroundColor: colors.bgSurface,
    borderWidth: 2,
    borderColor: colors.gold,
    padding: 8,
    marginBottom: 8,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailName: {
    fontFamily,
    fontSize: fontSizes.screenTitle,
    fontWeight: fontWeights.bold,
    color: colors.textTitle,
    textTransform: 'uppercase',
  },
  closeBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontFamily,
    fontSize: fontSizes.bodyPrimary,
    fontWeight: fontWeights.bold,
    color: colors.red,
  },
  detailMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  detailMetaText: {
    fontFamily,
    fontSize: fontSizes.bodySecondary,
    fontWeight: fontWeights.normal,
    color: colors.blueLight,
    textTransform: 'uppercase',
  },
  breakdownGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  breakdownCell: {
    backgroundColor: colors.bgRaised,
    borderWidth: 2,
    borderColor: colors.blueMid,
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: 'center',
    minWidth: 48,
  },
  breakdownGw: {
    fontFamily,
    fontSize: fontSizes.statLabel,
    fontWeight: fontWeights.normal,
    color: colors.blueLight,
    textTransform: 'uppercase',
  },
  breakdownPts: {
    fontFamily,
    fontSize: fontSizes.statValueSmall,
    fontWeight: fontWeights.bold,
  },
  breakdownMin: {
    fontFamily,
    fontSize: fontSizes.statLabel,
    fontWeight: fontWeights.normal,
    color: colors.blueMid,
    textTransform: 'uppercase',
  },
  // Player list
  touchTarget: {
    minHeight: 44,
    justifyContent: 'center',
  },
  playerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  formValue: {
    fontFamily,
    fontSize: fontSizes.bodySecondary,
    fontWeight: fontWeights.normal,
    color: colors.blueLight,
  },
  // Transfer section
  hitVerdict: {
    marginTop: 4,
    alignItems: 'flex-start',
  },
  priceAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.bgSurface,
  },
  alertDot: {
    width: 8,
    height: 8,
    backgroundColor: colors.red,
  },
  priceAlertName: {
    fontFamily,
    fontSize: fontSizes.bodyPrimary,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    textTransform: 'uppercase',
    flex: 1,
  },
  priceAlertValue: {
    fontFamily,
    fontSize: fontSizes.bodySecondary,
    fontWeight: fontWeights.normal,
    color: colors.red,
  },
  targetRow: {
    minHeight: 44,
    justifyContent: 'center',
  },
  targetScore: {
    fontFamily,
    fontSize: fontSizes.bodySecondary,
    fontWeight: fontWeights.normal,
    color: colors.blueLight,
  },
  emptyText: {
    fontFamily,
    fontSize: fontSizes.bodyPrimary,
    fontWeight: fontWeights.bold,
    color: colors.blueLight,
    textAlign: 'center',
    paddingVertical: 20,
    textTransform: 'uppercase',
  },
  errorText: {
    fontFamily,
    fontSize: fontSizes.bodySecondary,
    fontWeight: fontWeights.normal,
    color: colors.red,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  tabletGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  tabletColumn: {
    flex: 1,
  },
});
