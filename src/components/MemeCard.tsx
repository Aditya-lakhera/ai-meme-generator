import type { Meme } from "../types.ts";

type MemeCardProps = {
  meme: Meme;
  onOpen: (meme: Meme) => void;
};

export default function MemeCard({ meme, onOpen }: MemeCardProps) {
  return (
    <button
      type="button"
      className="meme-card"
      aria-label={`Open meme: ${meme.caption}`}
      onClick={() => onOpen(meme)}
    >
      <img
        className="meme-card__img"
        src={meme.imageUrl}
        alt={meme.caption}
        loading="lazy"
      />
      <p className="meme-card__caption">{meme.caption}</p>
    </button>
  );
}