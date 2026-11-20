export interface FoodAnalysis {
  foodName: string;
  cuisineOrCategory: string;
  description: string;
  servingSize: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number;
  ingredients: string[];
  healthHighlights: string[];
}

export interface FoodScanRecord extends FoodAnalysis {
  id: string;
  userId?: string;
  thumbnailDataUrl: string;
  createdAtMs: number;
  source: 'cloud' | 'local';
}

export type AppTab = 'scan' | 'history';
