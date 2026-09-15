export type CategoryId = "bollywood" | "cartoon" | "viral-songs" | "sports";

export type Category = {
  id: CategoryId;
  label: string;
  emoji: string;
  blurb: string;
};

export type Meme = {
  id: string;
  imageUrl: string;
  caption: string;
};
