import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

interface AnalyzeFoodBody {
  imageBase64?: unknown;
  mimeType?: unknown;
}

interface RawGeminiFoodResult {
  isFood?: boolean;
  notFoodReason?: string;
  foodName?: string;
  cuisineOrCategory?: string;
  description?: string;
  servingSize?: string;
  calories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  fiberGrams?: number;
  ingredients?: string[];
  healthHighlights?: string[];
}

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function clampNumber(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }
  return Math.round(Math.min(max, Math.max(min, value)));
}

function sanitizeStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim().slice(0, maxLength))
    .slice(0, maxItems);
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/analyze-food', async (req, res) => {
    try {
      const body = req.body as AnalyzeFoodBody;
      const rawBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';
      const rawMimeType = typeof body.mimeType === 'string' ? body.mimeType.trim() : 'image/jpeg';

      if (!rawBase64) {
        res.status(400).json({ error: 'No captured food photo was received.' });
        return;
      }

      const cleanedBase64 = rawBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
      const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
      const mimeType = allowedMimeTypes.has(rawMimeType) ? rawMimeType : 'image/jpeg';

      const ai = getGenAIClient();

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanedBase64,
              },
            },
            {
              text:
                'Analyze this photo carefully. Identify whether it depicts food, a meal, snack, dessert, or beverage. ' +
                'If it is food or drink, provide the dish name, category/cuisine, a clear appetizing description of what is visible, ' +
                'estimated serving size for the visible portion, estimated nutrition values (calories, protein, carbs, fat, fiber), ' +
                'a list of likely visible and base ingredients, and 2 to 4 concise nutrition highlights. ' +
                'If the image does not show food or drink, set isFood to false and explain briefly in notFoodReason.',
            },
          ],
        },
        config: {
          systemInstruction:
            'You are a culinary nutrition analyst for FoodSnap. Be accurate, practical, and honest about portion estimates. ' +
            'Never invent food when none is visible in the image. Keep descriptions natural, concise, and helpful.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isFood: {
                type: Type.BOOLEAN,
                description: 'True if the photo contains recognizable food or drink, false otherwise.',
              },
              notFoodReason: {
                type: Type.STRING,
                description: 'Brief explanation if isFood is false.',
              },
              foodName: {
                type: Type.STRING,
                description: 'Identified food or dish name.',
              },
              cuisineOrCategory: {
                type: Type.STRING,
                description: 'Short cuisine or meal category such as Mediterranean Bowl, Bakery Pastry, or Pasta.',
              },
              description: {
                type: Type.STRING,
                description: '2-3 sentence description of the dish, visible ingredients, and preparation.',
              },
              servingSize: {
                type: Type.STRING,
                description: 'Estimated visible portion size, e.g. 1 plate (~350g).',
              },
              calories: {
                type: Type.NUMBER,
                description: 'Estimated total calories (kcal) for the pictured serving.',
              },
              proteinGrams: {
                type: Type.NUMBER,
                description: 'Estimated protein in grams.',
              },
              carbsGrams: {
                type: Type.NUMBER,
                description: 'Estimated carbohydrates in grams.',
              },
              fatGrams: {
                type: Type.NUMBER,
                description: 'Estimated fat in grams.',
              },
              fiberGrams: {
                type: Type.NUMBER,
                description: 'Estimated dietary fiber in grams.',
              },
              ingredients: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'List of possible visible and key base ingredients.',
              },
              healthHighlights: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '2 to 4 concise nutritional highlights.',
              },
            },
            required: [
              'isFood',
              'foodName',
              'cuisineOrCategory',
              'description',
              'servingSize',
              'calories',
              'proteinGrams',
              'carbsGrams',
              'fatGrams',
              'fiberGrams',
              'ingredients',
              'healthHighlights',
            ],
          },
        },
      });

      const rawText = response.text?.trim();
      if (!rawText) {
        res.status(502).json({ error: 'Gemini returned an empty response. Please try snapping the dish again.' });
        return;
      }

      let parsed: RawGeminiFoodResult;
      try {
        parsed = JSON.parse(rawText) as RawGeminiFoodResult;
      } catch {
        res.status(502).json({ error: 'Could not parse AI recognition response. Please try again.' });
        return;
      }

      if (!parsed.isFood) {
        res.status(422).json({
          error:
            (typeof parsed.notFoodReason === 'string' && parsed.notFoodReason.trim()) ||
            'No food or drink was detected in this photo. Please point the camera directly at a meal.',
        });
        return;
      }

      const ingredients = sanitizeStringArray(parsed.ingredients, 25, 80);
      const healthHighlights = sanitizeStringArray(parsed.healthHighlights, 8, 160);

      const analysis = {
        foodName: (typeof parsed.foodName === 'string' && parsed.foodName.trim().slice(0, 140)) || 'Identified Meal',
        cuisineOrCategory:
          (typeof parsed.cuisineOrCategory === 'string' && parsed.cuisineOrCategory.trim().slice(0, 80)) || 'Fresh Dish',
        description:
          (typeof parsed.description === 'string' && parsed.description.trim().slice(0, 800)) ||
          'Freshly captured dish analyzed by FoodSnap.',
        servingSize:
          (typeof parsed.servingSize === 'string' && parsed.servingSize.trim().slice(0, 80)) || '1 standard serving',
        calories: clampNumber(parsed.calories, 0, 10000),
        proteinGrams: clampNumber(parsed.proteinGrams, 0, 1000),
        carbsGrams: clampNumber(parsed.carbsGrams, 0, 1000),
        fatGrams: clampNumber(parsed.fatGrams, 0, 1000),
        fiberGrams: clampNumber(parsed.fiberGrams, 0, 500),
        ingredients: ingredients.length > 0 ? ingredients : ['Mixed fresh ingredients'],
        healthHighlights,
      };

      res.json({ analysis });
    } catch (error) {
      console.error('FoodSnap /api/analyze-food error:', error);
      const message = error instanceof Error ? error.message : 'Unexpected error analyzing food photo.';
      const status = message.includes('PERMISSION_DENIED') || message.includes('API_KEY_INVALID') ? 403 : 500;
      res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FoodSnap server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start FoodSnap server:', err);
  process.exit(1);
});
