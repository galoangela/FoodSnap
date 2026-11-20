import { useCallback, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Clock,
  Leaf,
  LogIn,
  LogOut,
  RotateCcw,
  Sparkles,
  Utensils,
} from 'lucide-react';
import { CameraViewfinder } from './components/CameraViewfinder';
import { FoodResultCard } from './components/FoodResultCard';
import { HistoryView } from './components/HistoryView';
import { Logo } from './components/Logo';
import { useScanHistory } from './hooks/useScanHistory';
import type { AppTab, FoodAnalysis } from './types';
import type { CapturedPhoto } from './utils/image';

type ScanStage = 'idle' | 'camera' | 'analyzing' | 'result' | 'error';

export default function App() {
  const {
    user,
    authBusy,
    authError,
    scans,
    historyLoading,
    saveScan,
    deleteScan,
    clearAllHistory,
    signInWithGoogle,
    signOutUser,
  } = useScanHistory();

  const [activeTab, setActiveTab] = useState<AppTab>('scan');
  const [scanStage, setScanStage] = useState<ScanStage>('idle');
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string>('');
  const [currentAnalysis, setCurrentAnalysis] = useState<FoodAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string>('');
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const handleOpenCamera = useCallback(() => {
    setActiveTab('scan');
    setAnalysisError('');
    setScanStage('camera');
  }, []);

  const handleClearScan = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setCapturedPhotoUrl('');
    setCurrentAnalysis(null);
    setAnalysisError('');
    setScanStage('idle');
  }, []);

  const handlePhotoCaptured = useCallback(
    async (photo: CapturedPhoto) => {
      setCapturedPhotoUrl(photo.analysisDataUrl);
      setCurrentAnalysis(null);
      setAnalysisError('');
      setScanStage('analyzing');

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch('/api/analyze-food', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            imageBase64: photo.analysisBase64,
            mimeType: photo.mimeType,
          }),
        });

        const data = (await res.json().catch(() => ({}))) as {
          analysis?: FoodAnalysis;
          error?: string;
        };

        if (!res.ok || !data.analysis) {
          throw new Error(
            data.error || 'Could not analyze this food photo. Please try taking another shot.',
          );
        }

        setCurrentAnalysis(data.analysis);
        setScanStage('result');

        // Persist to Firestore (when signed in) or local device history
        await saveScan(data.analysis, photo.thumbnailDataUrl);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setAnalysisError(
          err instanceof Error
            ? err.message
            : 'Unable to reach Gemini food recognition right now. Please try again.',
        );
        setScanStage('error');
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [saveScan],
  );

  return (
    <div className="min-h-screen bg-[#FBF8F3] text-[#1E241E] flex flex-col">
      {/* Top Bar — 3-Zone Contract on Desktop, Compact <=56px Header on Mobile */}
      <header className="sticky top-0 z-30 h-14 md:h-16 bg-[#FBF8F3]/95 backdrop-blur-md border-b border-[#E6DFD3]">
        <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('scan');
              if (scanStage === 'camera') setScanStage('idle');
            }}
            className="text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D95D24] rounded-xl whitespace-nowrap shrink-0"
          >
            <Logo size="sm" />
          </button>

          {/* Zone 2: Clean Text Navigation Links (Desktop) */}
          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-8 text-sm font-medium"
          >
            <button
              type="button"
              onClick={() => setActiveTab('scan')}
              className={`min-h-[44px] px-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'scan'
                  ? 'border-[#D95D24] text-[#1E241E] font-semibold'
                  : 'border-transparent text-[#5A6558] hover:text-[#1E241E]'
              }`}
            >
              Scanner
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`min-h-[44px] px-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'history'
                  ? 'border-[#D95D24] text-[#1E241E] font-semibold'
                  : 'border-transparent text-[#5A6558] hover:text-[#1E241E]'
              }`}
            >
              History ({scans.length})
            </button>
          </nav>

          {/* Zone 3: Single Account Action */}
          <div className="flex items-center shrink-0">
            {user ? (
              <button
                type="button"
                disabled={authBusy}
                onClick={signOutUser}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E6DFD3] bg-white hover:bg-[#F4EFE6] text-xs sm:text-sm font-medium text-[#1E241E] inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                title={user.displayName || 'Signed in'}
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User avatar'}
                    referrerPolicy="no-referrer"
                    className="w-5 h-5 rounded-full object-cover"
                  />
                ) : null}
                <span className="max-w-[100px] truncate hidden sm:inline">
                  {user.displayName?.split(' ')[0] || 'Account'}
                </span>
                <LogOut className="w-4 h-4 text-[#5A6558]" />
              </button>
            ) : (
              <button
                type="button"
                disabled={authBusy}
                onClick={signInWithGoogle}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-[#E6DFD3] bg-white hover:bg-[#FFF4EB] text-xs sm:text-sm font-medium text-[#1E241E] inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <LogIn className="w-4 h-4 text-[#D95D24]" />
                <span>{authBusy ? 'Signing in…' : 'Sign in'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-24 md:pb-12">
        {authError && (
          <div
            role="alert"
            className="mb-6 bg-[#FFF1E6] border border-[#F5C5A3] rounded-2xl px-4 py-3 text-sm text-[#7A3514] flex items-center gap-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-[#D95D24]" />
            <span>{authError}</span>
          </div>
        )}

        {activeTab === 'history' ? (
          <HistoryView
            scans={scans}
            loading={historyLoading}
            user={user}
            authBusy={authBusy}
            onSignIn={signInWithGoogle}
            onDeleteScan={deleteScan}
            onClearAll={clearAllHistory}
            onGoToScanner={() => {
              handleClearScan();
              setActiveTab('scan');
            }}
          />
        ) : (
          <div className="space-y-8">
            {/* Stage 1: Welcome Home Screen */}
            {scanStage === 'idle' && (
              <>
                <section className="bg-white border border-[#E6DFD3] rounded-3xl overflow-hidden">
                  <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
                    {/* Left Welcome Column */}
                    <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between gap-8">
                      <div className="space-y-5">
                        <Logo size="lg" />

                        <div className="space-y-3">
                          <h1 className="font-display text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-[#1E241E] leading-[1.12] [text-wrap:balance]">
                            Welcome to FoodSnap. Know what’s on your plate in seconds.
                          </h1>
                          <p className="text-[15px] sm:text-base text-[#5A6558] leading-relaxed max-w-xl">
                            Point your camera at any meal, snack, or drink. FoodSnap identifies the dish, lists likely ingredients, and estimates calories and macros right away.
                          </p>
                        </div>
                      </div>

                      {/* Primary Camera Action */}
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={handleOpenCamera}
                            className="w-full sm:w-auto min-h-[52px] px-7 py-3.5 rounded-2xl bg-[#D95D24] hover:bg-[#C24E1A] active:scale-[0.98] text-white text-base font-semibold inline-flex items-center justify-center gap-2.5 transition-all whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D95D24]"
                          >
                            <Camera className="w-5 h-5" />
                            <span>Take Food Photo</span>
                          </button>

                          {scans.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setActiveTab('history')}
                              className="w-full sm:w-auto min-h-[52px] px-5 py-3.5 rounded-2xl bg-[#EBF7EE] hover:bg-[#DCF0E1] text-[#2F7A4D] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
                            >
                              <Clock className="w-4 h-4" />
                              <span>View History ({scans.length})</span>
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-[#5A6558]">
                          Live camera recognition · Instant ingredients &amp; nutrition breakdown
                        </p>
                      </div>
                    </div>

                    {/* Right Editorial Food Visual */}
                    <div className="lg:col-span-5 relative bg-[#F4EFE6] min-h-[220px] sm:min-h-[280px] lg:min-h-full">
                      {!heroImgFailed ? (
                        <img
                          src="/src/assets/images/foodsnap_hero_bowl_1795192226171.jpg"
                          alt="Fresh avocado, roasted sweet potato, and quinoa grain bowl"
                          referrerPolicy="no-referrer"
                          onError={() => setHeroImgFailed(true)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full min-h-[240px] bg-gradient-to-br from-[#FFF4EB] via-[#FBF8F3] to-[#EBF7EE] flex flex-col items-center justify-center p-8 text-center gap-3">
                          <Utensils className="w-10 h-10 text-[#D95D24]" />
                          <span className="font-display font-bold text-lg text-[#1E241E]">
                            Fresh Meal Recognition
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {/* 3 Clean Feature Highlights (Cream / Soft Orange / Light Green) */}
                <section
                  aria-label="How FoodSnap works"
                  className="grid grid-cols-1 sm:grid-cols-3 gap-4"
                >
                  <div className="bg-[#FFF4EB] border border-[#F8DAC2] rounded-2xl p-5 space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-white text-[#D95D24] flex items-center justify-center">
                      <Camera className="w-5 h-5" />
                    </div>
                    <h2 className="font-display text-base font-bold text-[#1E241E]">
                      1. Snap Your Meal
                    </h2>
                    <p className="text-sm text-[#5A6558] leading-relaxed">
                      Open the camera viewfinder and capture any homemade plate, restaurant dish, or snack.
                    </p>
                  </div>

                  <div className="bg-[#EBF7EE] border border-[#CBE7D2] rounded-2xl p-5 space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-white text-[#2F7A4D] flex items-center justify-center">
                      <Leaf className="w-5 h-5" />
                    </div>
                    <h2 className="font-display text-base font-bold text-[#1E241E]">
                      2. Spot Ingredients
                    </h2>
                    <p className="text-sm text-[#5A6558] leading-relaxed">
                      AI inspects the dish to identify the food name, description, and likely ingredients.
                    </p>
                  </div>

                  <div className="bg-white border border-[#E6DFD3] rounded-2xl p-5 space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-[#F4EFE6] text-[#1E241E] flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-[#D95D24]" />
                    </div>
                    <h2 className="font-display text-base font-bold text-[#1E241E]">
                      3. Track Nutrition
                    </h2>
                    <p className="text-sm text-[#5A6558] leading-relaxed">
                      Review estimated calories, protein, carbs, fat, and fiber, saved in your scan history.
                    </p>
                  </div>
                </section>
              </>
            )}

            {/* Stage 2: Live Camera Viewfinder */}
            {scanStage === 'camera' && (
              <CameraViewfinder
                onCapture={handlePhotoCaptured}
                onClose={() => setScanStage('idle')}
              />
            )}

            {/* Stage 3: Analyzing with Gemini AI */}
            {scanStage === 'analyzing' && (
              <div className="bg-white border border-[#E6DFD3] rounded-3xl overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-12 items-center">
                  <div className="md:col-span-5 bg-[#F4EFE6] aspect-[4/3] md:aspect-auto md:h-80 overflow-hidden">
                    {capturedPhotoUrl ? (
                      <img
                        src={capturedPhotoUrl}
                        alt="Captured food photo being analyzed"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="md:col-span-7 p-6 sm:p-10 space-y-5">
                    <div className="w-12 h-12 rounded-2xl bg-[#FFF4EB] text-[#D95D24] flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full border-2 border-[#D95D24] border-t-transparent animate-spin" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="font-display text-2xl font-bold text-[#1E241E]">
                        Analyzing your food…
                      </h2>
                      <p className="text-sm sm:text-base text-[#5A6558] leading-relaxed">
                        Gemini AI is identifying the dish, estimating portion size, and breaking down possible ingredients and nutrition.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearScan}
                      className="min-h-[44px] px-4 py-2 rounded-xl border border-[#E6DFD3] bg-white hover:bg-[#F4EFE6] text-sm font-medium text-[#5A6558] transition-colors"
                    >
                      Cancel Scan
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Stage 4: Error State */}
            {scanStage === 'error' && (
              <div className="bg-white border border-[#E6DFD3] rounded-3xl overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-12 items-center">
                  <div className="md:col-span-5 bg-[#F4EFE6] aspect-[4/3] md:aspect-auto md:h-80 overflow-hidden">
                    {capturedPhotoUrl ? (
                      <img
                        src={capturedPhotoUrl}
                        alt="Captured photo"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="md:col-span-7 p-6 sm:p-10 space-y-5">
                    <div className="w-12 h-12 rounded-2xl bg-[#FFF1E6] text-[#D95D24] flex items-center justify-center">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="font-display text-2xl font-bold text-[#1E241E]">
                        Could not recognize food
                      </h2>
                      <p className="text-sm sm:text-base text-[#5A6558] leading-relaxed">
                        {analysisError}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleOpenCamera}
                        className="min-h-[48px] px-5 py-2.5 rounded-xl bg-[#D95D24] hover:bg-[#C24E1A] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Retake Photo</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleClearScan}
                        className="min-h-[48px] px-5 py-2.5 rounded-xl border border-[#E6DFD3] bg-white hover:bg-[#F4EFE6] text-sm font-medium text-[#1E241E] inline-flex items-center gap-2 transition-colors"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Clear</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Stage 5: Food Recognition Result */}
            {scanStage === 'result' && currentAnalysis && (
              <FoodResultCard
                imageUrl={capturedPhotoUrl}
                analysis={currentAnalysis}
                savedLabel={user ? 'Saved to cloud history' : 'Saved to device history'}
                onClear={handleClearScan}
                clearButtonLabel="Scan Another Food"
              />
            )}
          </div>
        )}
      </main>

      {/* Mobile Bottom Tab Bar — Ergonomic Thumb Zone */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 pb-safe bg-[#FBF8F3]/95 backdrop-blur-md border-t border-[#E6DFD3]"
      >
        <div className="grid grid-cols-2 h-full max-w-md mx-auto">
          <button
            type="button"
            onClick={() => setActiveTab('scan')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
              activeTab === 'scan' ? 'text-[#D95D24]' : 'text-[#5A6558]'
            }`}
          >
            <Camera className="w-5 h-5" />
            <span className="text-[11px] font-semibold tracking-tight">Scanner</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
              activeTab === 'history' ? 'text-[#D95D24]' : 'text-[#5A6558]'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span className="text-[11px] font-semibold tracking-tight">
              History ({scans.length})
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
}
