import type { Confidence } from '../learning/progress';
import { InlineHtml } from './Html';

export interface ChoiceOption {
  html: string;
  correct?: boolean;
  why?: string;
  mono?: boolean;
}

export interface OptionListProps {
  options: ChoiceOption[];
  selected: number[];
  revealed: boolean;
  multi?: boolean;
  onToggle: (index: number) => void;
}

export function OptionList({ options, selected, revealed, multi, onToggle }: OptionListProps) {
  return (
    <div class="options" role={multi ? 'group' : 'radiogroup'}>
      {options.map((option, i) => {
        const isSelected = selected.includes(i);
        let cls = 'option';
        if (option.mono) cls += ' mono-option';
        if (revealed) {
          if (option.correct) cls += ' correct';
          else if (isSelected) cls += ' wrong';
          else cls += ' dim';
        } else if (isSelected) cls += ' selected';
        return (
          <button
            key={i}
            type="button"
            class={cls}
            role={multi ? 'checkbox' : 'radio'}
            aria-checked={isSelected}
            disabled={revealed}
            onClick={() => onToggle(i)}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              {option.mono ? option.html : <InlineHtml html={option.html} />}
              {revealed && option.why && (isSelected || option.correct) && (
                <span class="why" dangerouslySetInnerHTML={{ __html: option.why }} />
              )}
            </span>
            {revealed && option.correct && <span aria-hidden="true">✓</span>}
            {revealed && !option.correct && isSelected && <span aria-hidden="true">✗</span>}
          </button>
        );
      })}
    </div>
  );
}

const LEVELS: { value: Confidence; label: string }[] = [
  { value: 0, label: 'Geraten' },
  { value: 1, label: 'Ziemlich sicher' },
  { value: 2, label: 'Ganz sicher' },
];

export function ConfidencePicker({
  value,
  onChange,
  disabled,
}: {
  value: Confidence | undefined;
  onChange: (c: Confidence) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <div class="small muted" style={{ marginBottom: '4px' }}>
        Wie sicher bist du?
      </div>
      <div class="confidence" role="radiogroup" aria-label="Sicherheit">
        {LEVELS.map((l) => (
          <button
            key={l.value}
            type="button"
            role="radio"
            aria-checked={value === l.value}
            disabled={disabled}
            class={value === l.value ? 'selected' : ''}
            onClick={() => onChange(l.value)}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Hypercorrection() {
  return (
    <div class="banner warn">
      <strong>Sicher – aber falsch.</strong> Genau solche Irrtümer lohnen sich: Lies die Erklärung
      und benenne für dich, welche Annahme nicht gestimmt hat. Das Thema kommt in der Wiederholung
      erneut.
    </div>
  );
}
