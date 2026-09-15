import type { CategoryId, Meme } from "../types.ts";

export async function generateMemes(category: CategoryId): Promise<Meme[]> {
  const response = await fetch("/api/memes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ category }),
  });

  if (!response.ok) {
    throw new Error("Couldn't generate memes. Please try again.");
  }

  const data = (await response.json()) as { memes: Meme[] };
  return data.memes;
}