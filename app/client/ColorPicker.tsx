import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

// Sélecteur de couleur de l'atelier : HEX d'abord, zone saturation /
// luminosité, teinte, couleurs récentes et couleurs du DS. Il ne fait que
// proposer une valeur : l'enregistrement passe toujours par le diff.

type Hsv = { h: number; s: number; v: number };

function hexToHsv(hex: string): Hsv {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}
function hsvToHex({ h, s, v }: Hsv) {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return (
    '#' +
    [f(5), f(3), f(1)]
      .map((x) =>
        Math.round(x * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
      .toUpperCase()
  );
}
// Accepte « 4782e1 », « #4782E1 » ou la forme courte « #48E ».
export function normalizeHex(raw: string) {
  let v = raw.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(v))
    v = v
      .split('')
      .map((c) => c + c)
      .join('');
  return /^[0-9a-fA-F]{6}$/.test(v) ? '#' + v.toUpperCase() : undefined;
}

// Formats d'affichage : la valeur enregistrée reste toujours en HEX.
type Mode = 'hex' | 'rgb' | 'hsl';
const modes: Mode[] = ['hex', 'rgb', 'hsl'];
function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex([r, g, b]: number[]) {
  return (
    '#' +
    [r, g, b]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}
function hexToHsl(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((x) => x / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  const { h } = hexToHsv(hex);
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}
function hslToHex([h, s, l]: number[]) {
  const sat = s / 100;
  const lig = l / 100;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(
      (lig - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255,
    );
  };
  return rgbToHex([f(0), f(8), f(4)]);
}

const recentKey = 'ds-studio-recent-colors';
function readRecent(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(recentKey) || '[]');
    return Array.isArray(saved)
      ? saved
          .filter((c) => typeof c === 'string' && normalizeHex(c))
          .slice(0, 10)
      : [];
  } catch {
    return [];
  }
}
function pushRecent(hex: string) {
  try {
    const next = [hex, ...readRecent().filter((c) => c !== hex)].slice(0, 10);
    localStorage.setItem(recentKey, JSON.stringify(next));
  } catch {
    /* Confort seulement. */
  }
}

export default function ColorPicker({
  label,
  value,
  initial,
  palette,
  paletteLabel = 'Dans ton DS',
  onChange,
  onClose,
}: {
  label: string;
  value: string;
  initial: string;
  palette: { label: string; value: string }[];
  paletteLabel?: string;
  onChange: (hex: string) => void;
  onClose: () => void;
}) {
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [text, setText] = useState(value);
  const [mode, setMode] = useState<Mode>(() => {
    try {
      const m = localStorage.getItem('ds-studio-color-mode');
      return modes.includes(m as Mode) ? (m as Mode) : 'hex';
    } catch {
      return 'hex';
    }
  });
  const [recent] = useState(readRecent);
  const root = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const hexInput = useRef<HTMLInputElement>(null);
  const last = useRef(value);

  useEffect(() => {
    hexInput.current?.select();
    if (!hexInput.current)
      root.current
        ?.querySelector<HTMLInputElement>('.cp-fields input')
        ?.focus();
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) close();
    };
    addEventListener('mousedown', onDown);
    return () => removeEventListener('mousedown', onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close() {
    if (last.current !== initial) pushRecent(last.current);
    onClose();
  }
  function emit(hex: string, next?: Hsv) {
    last.current = hex;
    setText(hex);
    if (next) setHsv(next);
    onChange(hex);
  }
  function fromHsv(next: Hsv) {
    setHsv(next);
    emit(hsvToHex(next));
  }
  function pick(e: { clientX: number; clientY: number }) {
    const r = area.current!.getBoundingClientRect();
    const s = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const v = 1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    fromHsv({ ...hsv, s, v });
  }
  function onAreaKey(e: KeyboardEvent) {
    const step = e.shiftKey ? 0.1 : 0.01;
    const d: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    if (!d[e.key]) return;
    e.preventDefault();
    fromHsv({
      ...hsv,
      s: Math.min(1, Math.max(0, hsv.s + d[e.key][0])),
      v: Math.min(1, Math.max(0, hsv.v + d[e.key][1])),
    });
  }
  const swatch = (c: { label?: string; value: string }) => (
    <button
      key={c.value + (c.label ?? '')}
      className="cp-swatch"
      style={{ background: c.value }}
      title={c.label ? `${c.label} · ${c.value}` : c.value}
      aria-label={`Utiliser ${c.value}${c.label ? ` (${c.label})` : ''}`}
      onClick={() => emit(c.value, hexToHsv(c.value))}
    />
  );
  const eyeDropper = (
    window as unknown as {
      EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> };
    }
  ).EyeDropper;
  const dsColors = palette.filter(
    (c, i) => palette.findIndex((x) => x.value === c.value) === i,
  );

  return (
    <div
      ref={root}
      className="color-picker"
      role="dialog"
      aria-label={`Couleur : ${label}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          close();
        }
      }}
    >
      <div className="cp-hex-row">
        <span className="cp-preview" style={{ background: last.current }} />
        <div className="cp-hex">
          <button
            className="cp-mode"
            aria-label={`Format ${mode.toUpperCase()}, changer de format`}
            title="Changer de format : HEX, RGB, HSL"
            onClick={() => {
              const next = modes[(modes.indexOf(mode) + 1) % modes.length];
              setMode(next);
              try {
                localStorage.setItem('ds-studio-color-mode', next);
              } catch {
                /* Confort seulement. */
              }
            }}
          >
            {mode.toUpperCase()}
          </button>
          {mode === 'hex' ? (
            <input
              ref={hexInput}
              aria-label={`Code HEX : ${label}`}
              value={text}
              maxLength={7}
              spellCheck={false}
              onChange={(e) => {
                setText(e.target.value);
                const hex = normalizeHex(e.target.value);
                if (hex) {
                  last.current = hex;
                  setHsv(hexToHsv(hex));
                  onChange(hex);
                }
              }}
              onBlur={() => setText(last.current)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') close();
              }}
            />
          ) : (
            <div className="cp-fields">
              {(mode === 'rgb'
                ? hexToRgb(last.current)
                : hexToHsl(last.current)
              ).map((n, i) => {
                const meta =
                  mode === 'rgb'
                    ? [
                        ['R', 'Rouge', 255],
                        ['G', 'Vert', 255],
                        ['B', 'Bleu', 255],
                      ][i]
                    : [
                        ['H', 'Teinte (degrés)', 359],
                        ['S', 'Saturation (%)', 100],
                        ['L', 'Luminosité (%)', 100],
                      ][i];
                return (
                  <input
                    key={`${mode}${i}${n}`}
                    type="number"
                    aria-label={meta[1] as string}
                    title={meta[1] as string}
                    min={0}
                    max={meta[2] as number}
                    defaultValue={n}
                    onBlur={(e) => {
                      const all =
                        mode === 'rgb'
                          ? hexToRgb(last.current)
                          : hexToHsl(last.current);
                      all[i] = Math.min(
                        meta[2] as number,
                        Math.max(0, Math.round(Number(e.target.value) || 0)),
                      );
                      const hex =
                        mode === 'rgb' ? rgbToHex(all) : hslToHex(all);
                      emit(hex, hexToHsv(hex));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')
                        (e.target as HTMLInputElement).blur();
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
        {eyeDropper && (
          <button
            className="cp-icon"
            aria-label="Prélever une couleur à l’écran"
            title="Pipette"
            onClick={async () => {
              try {
                const r = await new eyeDropper().open();
                const hex = normalizeHex(r.sRGBHex);
                if (hex) emit(hex, hexToHsv(hex));
              } catch {
                /* Annulé par l'utilisateur. */
              }
            }}
          >
            <svg
              aria-hidden="true"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m2 22 1-1h3l9-9" />
              <path d="M3 21v-3l9-9" />
              <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" />
            </svg>
          </button>
        )}
      </div>
      <div
        ref={area}
        className="cp-area"
        role="slider"
        tabIndex={0}
        aria-label="Saturation et luminosité"
        aria-valuetext={`Saturation ${Math.round(hsv.s * 100)} %, luminosité ${Math.round(hsv.v * 100)} %`}
        style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pick(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons) pick(e);
        }}
        onKeyDown={onAreaKey}
      >
        <span
          className="cp-thumb"
          style={{
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
            background: last.current,
          }}
        />
      </div>
      <input
        type="range"
        className="cp-hue"
        aria-label="Teinte"
        min={0}
        max={359}
        value={Math.round(hsv.h)}
        onChange={(e) => fromHsv({ ...hsv, h: Number(e.target.value) })}
      />
      {recent.length > 0 && (
        <div className="cp-group">
          <p>Récentes</p>
          <div className="cp-swatches">
            {recent.map((c) => swatch({ value: c }))}
          </div>
        </div>
      )}
      <div className="cp-group">
        <p>{paletteLabel}</p>
        <div className="cp-swatches">{dsColors.map(swatch)}</div>
      </div>
      {last.current !== initial && (
        <button
          className="cp-revert"
          onClick={() => emit(initial, hexToHsv(initial))}
        >
          Revenir à {initial}
        </button>
      )}
    </div>
  );
}
