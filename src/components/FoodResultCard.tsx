import { Check, Leaf, RotateCcw, Utensils } from 'lucide-react';
import type { FoodAnalysis } from '../types';

interface FoodResultCardProps {
  imageUrl: string;
  analysis: FoodAnalysis;
  savedLabel?: string;
  onClear: () => void;
  clearButtonLabel?: string;
}

export function FoodResultCard({
  imageUrl,
  analysis,
  savedLabel,
  onClear,
  clearButtonLabel = 'Scan Another Food',
}: FoodResultCardProps) {
  const totalMacroGrams =
    Math.max(1, analysis.proteinGrams + analysis.carbsGrams + analysis.fatGrams);
  const proteinPct = Math.round((analysis.proteinGrams / totalMacroGrams) * 100);
  const carbsPct = Math.round((analysis.carbsGrams / totalMacroGrams) * 100);
  const fatPct = Math.max(0, 100 - proteinPct - carbsPct);

  return (
    <div className="space-y-6">
      {/* Top Hero Card: Photo + Identified Food Name & Description */}
      <div className="bg-white border border-[#E6DFD3] rounded-3xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-5 relative bg-[#F4EFE6] min-h-[240px] lg:min-h-[320px]">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={analysis.foodName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover aspect-[4/3] lg:aspect-auto"
              />
            ) : (
              <div className="w-full h-full min-h-[240px] flex flex-col items-center justify-center gap-2 text-[#5A6558] p-6">
                <Utensils className="w-8 h-8 text-[#D95D24]" />
                <span className="text-sm font-medium">{analysis.foodName}</span>
              </div>
            )}
          </div>

          <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-3">
              {/* Unboxed typographic metadata */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#5A6558]">
                <span className="text-[#2F7A4D]">{analysis.cuisineOrCategory}</span>
                <span aria-hidden="true">·</span>
                <span>Est. {analysis.servingSize}</span>
                {savedLabel && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{savedLabel}</span>
                  </>
                )}
              </div>

              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#1E241E] [text-wrap:balance]">
                {analysis.foodName}
              </h2>

              <p className="text-[15px] sm:text-base text-[#5A6558] leading-relaxed">
                {analysis.description}
              </p>
            </div>

            {/* Clear / Scan Another Food CTA on Desktop */}
            <div className="pt-4 border-t border-[#EFE9DD] flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-[#5A6558]">
                Estimated values based on visual portion analysis
              </span>
              <button
                type="button"
                onClick={onClear}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#D95D24] hover:bg-[#C24E1A] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D95D24]"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{clearButtonLabel}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Nutrition + Ingredients Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Estimated Nutrition Information */}
        <section
          aria-label="Estimated Nutrition Information"
          className="lg:col-span-6 bg-white border border-[#E6DFD3] rounded-3xl p-6 sm:p-7 space-y-6"
        >
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="font-display text-lg font-bold text-[#1E241E]">
              Estimated Nutrition
            </h3>
            <span className="text-xs text-[#5A6558]">{analysis.servingSize}</span>
          </div>

          {/* Primary Calorie Readout */}
          <div className="bg-[#FFF4EB] border border-[#F8DAC2] rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-medium text-[#7A4424]">Total Energy</div>
              <div className="font-mono-num text-3xl sm:text-4xl font-semibold text-[#1E241E] mt-0.5">
                {analysis.calories}
                <span className="text-base font-sans font-medium text-[#5A6558] ml-1.5">
                  kcal
                </span>
              </div>
            </div>
            <div className="text-right text-xs text-[#5A6558] space-y-1">
              <div>Macro split by weight</div>
              <div className="font-mono-num text-[#1E241E] font-medium">
                P {proteinPct}% · C {carbsPct}% · F {fatPct}%
              </div>
            </div>
          </div>

          {/* Macro Split Bar */}
          <div className="space-y-2">
            <div
              className="h-2.5 w-full rounded-full overflow-hidden flex bg-[#F4EFE6]"
              aria-hidden="true"
            >
              <div
                className="bg-[#2F7A4D] h-full transition-all duration-300"
                style={{ width: `${proteinPct}%` }}
              />
              <div
                className="bg-[#F58A4B] h-full transition-all duration-300"
                style={{ width: `${carbsPct}%` }}
              />
              <div
                className="bg-[#A3C9A8] h-full transition-all duration-300"
                style={{ width: `${fatPct}%` }}
              />
            </div>

            {/* 4 Macro Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="rounded-2xl bg-[#EBF7EE] p-3.5">
                <div className="text-xs font-medium text-[#2F7A4D]">Protein</div>
                <div className="font-mono-num text-xl font-semibold text-[#1E241E] mt-1">
                  {analysis.proteinGrams}g
                </div>
              </div>
              <div className="rounded-2xl bg-[#FFF4EB] p-3.5">
                <div className="text-xs font-medium text-[#B84A17]">Carbs</div>
                <div className="font-mono-num text-xl font-semibold text-[#1E241E] mt-1">
                  {analysis.carbsGrams}g
                </div>
              </div>
              <div className="rounded-2xl bg-[#F4EFE6] p-3.5">
                <div className="text-xs font-medium text-[#5A6558]">Fat</div>
                <div className="font-mono-num text-xl font-semibold text-[#1E241E] mt-1">
                  {analysis.fatGrams}g
                </div>
              </div>
              <div className="rounded-2xl bg-[#EBF7EE] p-3.5">
                <div className="text-xs font-medium text-[#2F7A4D]">Fiber</div>
                <div className="font-mono-num text-xl font-semibold text-[#1E241E] mt-1">
                  {analysis.fiberGrams}g
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Possible Ingredients & Highlights */}
        <section
          aria-label="Possible Ingredients"
          className="lg:col-span-6 bg-white border border-[#E6DFD3] rounded-3xl p-6 sm:p-7 space-y-6"
        >
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="font-display text-lg font-bold text-[#1E241E]">
              Possible Ingredients
            </h3>
            <span className="font-mono-num text-xs text-[#5A6558]">
              {analysis.ingredients.length} detected
            </span>
          </div>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2.5">
            {analysis.ingredients.map((ingredient, idx) => (
              <li
                key={`${ingredient}-${idx}`}
                className="flex items-start gap-2.5 py-1.5 border-b border-[#F3EEE4] last:border-b-0 text-sm text-[#1E241E]"
              >
                <span className="mt-0.5 w-5 h-5 rounded-md bg-[#EBF7EE] text-[#2F7A4D] flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                </span>
                <span className="leading-snug">{ingredient}</span>
              </li>
            ))}
          </ul>

          {analysis.healthHighlights.length > 0 && (
            <div className="pt-4 border-t border-[#EFE9DD] space-y-2.5">
              <h4 className="text-xs font-semibold text-[#2F7A4D]">
                Nutritional Notes
              </h4>
              <ul className="space-y-2">
                {analysis.healthHighlights.map((note, idx) => (
                  <li
                    key={`${note}-${idx}`}
                    className="flex items-start gap-2.5 text-sm text-[#5A6558]"
                  >
                    <Leaf className="w-4 h-4 text-[#2F7A4D] mt-0.5 shrink-0" />
                    <span className="leading-snug">{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
