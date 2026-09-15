import { useState } from "react";
import type { Meme } from "../types.ts";
import MemeCard from "./MemeCard.tsx";
import MemeModal from "./MemeModal.tsx";

type MemeGalleryProps = {
  memes: Meme[];
};

export default function MemeGallery({ memes }: MemeGalleryProps) {
  const [selected, setSelected] = useState<Meme | null>(null);

  return (
    <>
      <section className="gallery" aria-label="Generated memes">
        {memes.map((meme) => (
          <MemeCard key={meme.id} meme={meme} onOpen={setSelected} />
        ))}
      </section>
      {selected && <MemeModal meme={selected} onClose={() => setSelected(null)} />}
    </>
  );
}