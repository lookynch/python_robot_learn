export function SkipFading({ onSkip }: { onSkip: () => void }) {
  return (
    <button class="btn small ghost" style={{ alignSelf: 'flex-start' }} onClick={onSkip}>
      Kann ich schon → direkt zur Aufgabe
    </button>
  );
}
