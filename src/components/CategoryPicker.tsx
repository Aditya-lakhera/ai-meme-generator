import type { Category, CategoryId } from "../types.ts";
import { CATEGORIES } from "../data/categories.ts";

type CategoryPickerProps = {
  activeCategory: CategoryId | null;
  disabled: boolean;
  onSelect: (id: CategoryId) => void;
};

type CategoryCardProps = {
  category: Category;
  isActive: boolean;
  isDisabled: boolean;
  onSelect: (id: CategoryId) => void;
};

function CategoryCard({ category, isActive, isDisabled, onSelect }: CategoryCardProps) {
  return (
    <button
      type="button"
      className={isActive ? "category-card category-card--active" : "category-card"}
      disabled={isDisabled}
      aria-pressed={isActive}
      onClick={() => onSelect(category.id)}
    >
      <span className="category-card__emoji" aria-hidden="true">
        {category.emoji}
      </span>
      <span className="category-card__label">{category.label}</span>
      <span className="category-card__blurb">{category.blurb}</span>
    </button>
  );
}

export default function CategoryPicker({ activeCategory, disabled, onSelect }: CategoryPickerProps) {
  return (
    <section className="category-picker">
      <h2 className="category-picker__group-label">Meme categories</h2>
      <div className="category-grid">
        {CATEGORIES.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            isActive={activeCategory === category.id}
            isDisabled={disabled}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}