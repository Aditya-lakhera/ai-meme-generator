import { useCallback, useState } from "react";
import type { CategoryId, Meme } from "../types.ts";
import { generateMemes } from "../api/memes.ts";

export function useMemeGenerator() {
  const [memes, setMemes] = useState<Meme[]>([]);
  const [activeCategory, setActiveCategory] = useState<CategoryId | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = useCallback(async (category: CategoryId) => {
    setLoading(true);
    setError("");
    setActiveCategory(category);
    try {
      const result = await generateMemes(category);
      setMemes(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  return { memes, activeCategory, loading, error, generate };
}