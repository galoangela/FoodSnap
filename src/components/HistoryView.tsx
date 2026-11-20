import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  ChevronRight,
  Search,
  Trash2,
  Utensils,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { FoodScanRecord } from '../types';
import { FoodResultCard } from './FoodResultCard';

interface HistoryViewProps {
  scans: FoodScanRecord[];
  loading: boolean;
  user: User | null;
  authBusy: boolean;
  onSignIn: () => void;
  onDeleteScan: (scanId: string) => Promise<void>;
  onClearAll: () => Promise<void>;
  onGoToScanner: () => void;
}

function formatScanTime(ms: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(ms));
  } catch {
    return '';
  }
}

function formatTodayLabel(date: Date): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return 'Today';
  }
}

function isSameLocalDay(timestampMs: number, referenceDate: Date): boolean {
  if (!Number.isFinite(timestampMs)) return false;
  const d = new Date(timestampMs);
  return (
    d.getFullYear() === referenceDate.getFullYear() &&
    d.getMonth() === referenceDate.getMonth() &&
    d.getDate() === referenceDate.getDate()
  );
}

export function HistoryView({
  scans,
  loading,
  user,
  authBusy,
  onSignIn,
  onDeleteScan,
  onClearAll,
  onGoToScanner,
}: HistoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const selectedScan = useMemo(
    () => scans.find((s) => s.id === selectedScanId) || null,
    [scans, selectedScanId],
  );

  const filteredScans = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return scans;
    return scans.filter(
      (s) =>
        s.foodName.toLowerCase().includes(q) ||
        s.cuisineOrCategory.toLowerCase().includes(q) ||
        s.ingredients.some((ing) => ing.toLowerCase().includes(q)),
    );
  }, [scans, searchQuery]);

  const avgCalories = useMemo(() => {
    if (scans.length === 0) return 0;
    const sum = scans.reduce((acc, item) => acc + item.calories, 0);
    return Math.round(sum / scans.length);
  }, [scans]);

  const dailySummary = useMemo(() => {
    const now = new Date();
    const todayScans = scans.filter((item) => isSameLocalDay(item.createdAtMs, now));
    const totals = todayScans.reduce(
      (acc, item) => ({
        calories: acc.calories + (Number.isFinite(item.calories) ? item.calories : 0),
        proteinGrams: acc.proteinGrams + (Number.isFinite(item.proteinGrams) ? item.proteinGrams : 0),
        carbsGrams: acc.carbsGrams + (Number.isFinite(item.carbsGrams) ? item.carbsGrams : 0),
        fatGrams: acc.fatGrams + (Number.isFinite(item.fatGrams) ? item.fatGrams : 0),
        fiberGrams: acc.fiberGrams + (Number.isFinite(item.fiberGrams) ? item.fiberGrams : 0),
      }),
      { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0, fiberGrams: 0 },
    );

    const totalMacroGrams = totals.proteinGrams + totals.carbsGrams + totals.fatGrams;
    const proteinPct = totalMacroGrams > 0 ? Math.round((totals.proteinGrams / totalMacroGrams) * 100) : 0;
    const carbsPct = totalMacroGrams > 0 ? Math.round((totals.carbsGrams / totalMacroGrams) * 100) : 0;
    const fatPct = totalMacroGrams > 0 ? Math.max(0, 100 - proteinPct - carbsPct) : 0;

    return {
      dateLabel: formatTodayLabel(now),
      mealCount: todayScans.length,
      calories: Math.round(totals.calories),
      proteinGrams: Math.round(totals.proteinGrams),
      carbsGrams: Math.round(totals.carbsGrams),
      fatGrams: Math.round(totals.fatGrams),
      fiberGrams: Math.round(totals.fiberGrams),
      proteinPct,
      carbsPct,
      fatPct,
    };
  }, [scans]);

  if (selectedScan) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedScanId(null)}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#E6DFD3] hover:bg-[#F4EFE6] text-sm font-medium text-[#1E241E] inline-flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to History</span>
          </button>

          <button
            type="button"
            disabled={deletingId === selectedScan.id}
            onClick={async () => {
              setDeletingId(selectedScan.id);
              try {
                await onDeleteScan(selectedScan.id);
                setSelectedScanId(null);
              } finally {
                setDeletingId(null);
              }
            }}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-[#E6DFD3] bg-white hover:bg-[#FFF1E6] text-sm font-medium text-[#B84A17] inline-flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            <span>{deletingId === selectedScan.id ? 'Deleting…' : 'Delete Scan'}</span>
          </button>
        </div>

        <FoodResultCard
          imageUrl={selectedScan.thumbnailDataUrl}
          analysis={selectedScan}
          savedLabel={formatScanTime(selectedScan.createdAtMs)}
          onClear={onGoToScanner}
          clearButtonLabel="Scan Another Food"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header & Unboxed Summary Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[#E6DFD3]">
        <div className="space-y-1">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1E241E]">
            Food Scan History
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-[#5A6558]">
            <span className="font-mono-num text-[#1E241E] font-medium">{scans.length}</span>
            <span>{scans.length === 1 ? 'meal scanned' : 'meals scanned'}</span>
            {scans.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>Avg</span>
                <span className="font-mono-num text-[#2F7A4D] font-medium">
                  {avgCalories} kcal
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {scans.length > 0 && !confirmClearAll && (
            <button
              type="button"
              onClick={() => setConfirmClearAll(true)}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-[#E6DFD3] bg-white hover:bg-[#FFF1E6] text-sm font-medium text-[#5A6558] hover:text-[#B84A17] transition-colors whitespace-nowrap shrink-0"
            >
              Clear History
            </button>
          )}
          {confirmClearAll && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  await onClearAll();
                  setConfirmClearAll(false);
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#D95D24] hover:bg-[#C24E1A] text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                Confirm Clear All
              </button>
              <button
                type="button"
                onClick={() => setConfirmClearAll(false)}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E6DFD3] bg-white text-sm font-medium text-[#5A6558] whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cloud Sync Prompt when signed out */}
      {!user && (
        <div className="bg-[#EBF7EE] border border-[#CBE7D2] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-[#1E241E]">
              Sync your food scans across devices
            </h2>
            <p className="text-xs sm:text-sm text-[#3E5845]">
              Scans are saved on this device now. Sign in with Google to back them up to your account.
            </p>
          </div>
          <button
            type="button"
            disabled={authBusy}
            onClick={onSignIn}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#2F7A4D] hover:bg-[#25633E] text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            {authBusy ? 'Signing in…' : 'Sign in with Google'}
          </button>
        </div>
      )}

      {/* Daily Nutrition Summary (Current Day) */}
      {!loading && (
        <section
          aria-label="Daily nutrition summary"
          className="bg-white border border-[#E6DFD3] rounded-3xl p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-[#1E241E]">
                Today’s Summary
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-[#5A6558] mt-0.5">
                <span>{dailySummary.dateLabel}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num font-medium text-[#1E241E]">
                  {dailySummary.mealCount}
                </span>
                <span>{dailySummary.mealCount === 1 ? 'food scanned today' : 'foods scanned today'}</span>
              </div>
            </div>

            {dailySummary.mealCount > 0 && (
              <div className="text-xs text-[#5A6558]">
                Macro split:{' '}
                <span className="font-mono-num font-medium text-[#1E241E]">
                  P {dailySummary.proteinPct}% · C {dailySummary.carbsPct}% · F {dailySummary.fatPct}%
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* Total Calories Today */}
            <div className="lg:col-span-4 bg-[#FFF4EB] border border-[#F8DAC2] rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
              <div className="text-xs font-medium text-[#7A4424]">Total Calories Today</div>
              <div className="font-mono-num text-3xl font-semibold text-[#1E241E] mt-1">
                {dailySummary.calories}
                <span className="text-sm font-sans font-medium text-[#5A6558] ml-1.5">
                  kcal
                </span>
              </div>
            </div>

            {/* Total Macronutrients Today */}
            <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl bg-[#EBF7EE] p-3.5 sm:p-4">
                <div className="text-xs font-medium text-[#2F7A4D]">Protein</div>
                <div className="font-mono-num text-xl sm:text-2xl font-semibold text-[#1E241E] mt-1">
                  {dailySummary.proteinGrams}g
                </div>
              </div>
              <div className="rounded-2xl bg-[#FFF4EB] p-3.5 sm:p-4">
                <div className="text-xs font-medium text-[#B84A17]">Carbs</div>
                <div className="font-mono-num text-xl sm:text-2xl font-semibold text-[#1E241E] mt-1">
                  {dailySummary.carbsGrams}g
                </div>
              </div>
              <div className="rounded-2xl bg-[#F4EFE6] p-3.5 sm:p-4">
                <div className="text-xs font-medium text-[#5A6558]">Fat</div>
                <div className="font-mono-num text-xl sm:text-2xl font-semibold text-[#1E241E] mt-1">
                  {dailySummary.fatGrams}g
                </div>
              </div>
              <div className="rounded-2xl bg-[#EBF7EE] p-3.5 sm:p-4">
                <div className="text-xs font-medium text-[#2F7A4D]">Fiber</div>
                <div className="font-mono-num text-xl sm:text-2xl font-semibold text-[#1E241E] mt-1">
                  {dailySummary.fiberGrams}g
                </div>
              </div>
            </div>
          </div>

          {dailySummary.mealCount > 0 ? (
            <div
              className="h-2 w-full rounded-full overflow-hidden flex bg-[#F4EFE6]"
              aria-hidden="true"
            >
              <div
                className="bg-[#2F7A4D] h-full transition-all duration-300"
                style={{ width: `${dailySummary.proteinPct}%` }}
              />
              <div
                className="bg-[#F58A4B] h-full transition-all duration-300"
                style={{ width: `${dailySummary.carbsPct}%` }}
              />
              <div
                className="bg-[#A3C9A8] h-full transition-all duration-300"
                style={{ width: `${dailySummary.fatPct}%` }}
              />
            </div>
          ) : (
            <p className="text-xs text-[#5A6558]">
              No foods scanned today yet. Snap a meal to start building today’s nutrition total.
            </p>
          )}
        </section>
      )}

      {/* Search Filter */}
      {scans.length > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 text-[#5A6558] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search dishes, categories, or ingredients…"
            aria-label="Search food scan history"
            className="w-full min-h-[44px] pl-11 pr-4 py-2.5 rounded-2xl bg-white border border-[#E6DFD3] text-sm text-[#1E241E] placeholder:text-[#7D877B] focus:outline-none focus:border-[#D95D24]"
          />
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white border border-[#E6DFD3] rounded-3xl p-8 text-center text-sm text-[#5A6558]">
          Loading your food scan history…
        </div>
      )}

      {/* Empty State */}
      {!loading && scans.length === 0 && (
        <div className="bg-white border border-[#E6DFD3] rounded-3xl p-8 sm:p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#FFF1E6] text-[#D95D24] flex items-center justify-center mx-auto">
            <Utensils className="w-6 h-6" />
          </div>
          <div className="max-w-sm mx-auto space-y-1.5">
            <h2 className="font-display text-xl font-bold text-[#1E241E]">
              No meals scanned yet
            </h2>
            <p className="text-sm text-[#5A6558] leading-relaxed">
              Open the camera to snap your first dish. FoodSnap will identify the ingredients and nutrition details and save them here.
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToScanner}
            className="min-h-[48px] px-6 py-3 rounded-xl bg-[#D95D24] hover:bg-[#C24E1A] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
          >
            <Camera className="w-4 h-4" />
            <span>Take Food Photo</span>
          </button>
        </div>
      )}

      {/* No Search Matches */}
      {!loading && scans.length > 0 && filteredScans.length === 0 && (
        <div className="bg-white border border-[#E6DFD3] rounded-3xl p-8 text-center space-y-2">
          <p className="text-sm font-medium text-[#1E241E]">
            No scanned meals matched “{searchQuery}”.
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="min-h-[44px] px-4 py-2 text-sm font-semibold text-[#D95D24] hover:underline"
          >
            Clear search filter
          </button>
        </div>
      )}

      {/* Scan History Grid / Rows */}
      {!loading && filteredScans.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredScans.map((scan) => (
            <div
              key={scan.id}
              className="group bg-white border border-[#E6DFD3] hover:border-[#D95D24]/50 rounded-2xl p-3.5 sm:p-4 flex items-center gap-3.5 transition-colors"
            >
              <button
                type="button"
                onClick={() => setSelectedScanId(scan.id)}
                className="flex-1 min-w-0 flex items-center gap-3.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D95D24] rounded-xl"
              >
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#F4EFE6] border border-[#EFE9DD] shrink-0 flex items-center justify-center">
                  {scan.thumbnailDataUrl ? (
                    <img
                      src={scan.thumbnailDataUrl}
                      alt={scan.foodName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Utensils className="w-5 h-5 text-[#D95D24]" />
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="text-xs font-medium text-[#2F7A4D] truncate">
                    {scan.cuisineOrCategory}
                  </div>
                  <h3 className="font-display text-base font-bold text-[#1E241E] truncate">
                    {scan.foodName}
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#5A6558]">
                    <span className="font-mono-num font-semibold text-[#D95D24]">
                      {scan.calories} kcal
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num">P {scan.proteinGrams}g</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{formatScanTime(scan.createdAtMs)}</span>
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-[#8A9488] group-hover:text-[#D95D24] transition-colors shrink-0" />
              </button>

              <button
                type="button"
                aria-label={`Delete ${scan.foodName}`}
                disabled={deletingId === scan.id}
                onClick={async (e) => {
                  e.stopPropagation();
                  setDeletingId(scan.id);
                  try {
                    await onDeleteScan(scan.id);
                  } finally {
                    setDeletingId(null);
                  }
                }}
                className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-[#8A9488] hover:text-[#B84A17] hover:bg-[#FFF1E6] transition-colors shrink-0 disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
