import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('FoodSnap ErrorBoundary caught:', error, info);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FBF8F3] text-[#1E241E] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-[#E6DFD3] rounded-3xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-[#1E241E]">Something went wrong</h2>
            <p className="text-sm text-[#5A6558] leading-relaxed">
              FoodSnap encountered an unexpected issue while loading your view. You can reload to continue scanning.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full min-h-[44px] px-5 py-2.5 rounded-xl bg-[#D95D24] hover:bg-[#C24E1A] text-white text-sm font-semibold transition-colors"
            >
              Reload FoodSnap
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
