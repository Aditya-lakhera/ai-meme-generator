type SpinnerProps = {
  label?: string;
};

export default function Spinner({ label = "Cooking up memes…" }: SpinnerProps) {
  return (
    <div className="spinner" role="status" aria-live="polite">
      <span className="spinner__ring" aria-hidden="true" />
      <span className="spinner__label">{label}</span>
    </div>
  );
}