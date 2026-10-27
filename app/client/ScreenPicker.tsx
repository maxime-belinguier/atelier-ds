import { useEffect, useRef, useState } from 'react';

// Sélecteur d'écran pensé pour une longue liste : écran courant visible,
// précédent / suivant, et une liste filtrable au clavier.
export default function ScreenPicker({
  screens,
  value,
  onChange,
}: {
  screens: { id: string; label: string; description: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const index = Math.max(
    0,
    screens.findIndex((s) => s.id === value),
  );
  const current = screens[index];
  const q = query.trim().toLowerCase();
  const list = q
    ? screens.filter(
        (s) =>
          s.label.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q),
      )
    : screens;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    addEventListener('mousedown', onDown);
    return () => removeEventListener('mousedown', onDown);
  }, [open]);

  function choose(id: string) {
    onChange(id);
    setOpen(false);
    setQuery('');
    trigger.current?.focus();
  }
  function focusOption(delta: number) {
    const options = [
      ...(root.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []),
    ];
    const at = options.indexOf(document.activeElement as HTMLElement);
    options[Math.min(options.length - 1, Math.max(0, at + delta))]?.focus();
  }

  return (
    <div
      className="screen-picker"
      ref={root}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        className="picker-step"
        aria-label="Écran précédent"
        disabled={index === 0}
        onClick={() => onChange(screens[index - 1].id)}
      >
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <button
        ref={trigger}
        className="picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Écran affiché : ${current.label}`}
        onClick={() => setOpen(!open)}
      >
        <span className="picker-count">
          {index + 1}/{screens.length}
        </span>
        <strong>{current.label}</strong>
        <span className="picker-chevron">
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>
      <button
        className="picker-step"
        aria-label="Écran suivant"
        disabled={index === screens.length - 1}
        onClick={() => onChange(screens[index + 1].id)}
      >
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
      {open && (
        <div className="picker-pop">
          <input
            type="search"
            aria-label="Rechercher un écran"
            placeholder="Rechercher un écran"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                focusOption(1);
              }
              if (e.key === 'Enter' && list[0]) {
                e.preventDefault();
                choose(list[0].id);
              }
            }}
          />
          <ul role="listbox" aria-label="Écrans">
            {list.map((s) => (
              <li
                key={s.id}
                role="option"
                tabIndex={-1}
                aria-selected={s.id === value}
                onClick={() => choose(s.id)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    focusOption(1);
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    focusOption(-1);
                  }
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    choose(s.id);
                  }
                }}
              >
                <strong>{s.label}</strong>
                <span>{s.description}</span>
              </li>
            ))}
            {!list.length && (
              <li className="picker-empty">Aucun écran ne correspond.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
