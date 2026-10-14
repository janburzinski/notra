const ICONS = [
  { name: "leaf", tags: "nature plant eco", d: "M5 19c0-8 5-14 14-14 0 9-6 14-14 14Z M5 19l8-8" },
  { name: "sprout", tags: "plant grow nature", d: "M7 14h10l-1.5 7h-7Z M12 14V8 M12 8c0-3 2-5 5-5 0 3-2 5-5 5Z M12 10c0-2.5-1.8-4-4.5-4 0 2.5 1.8 4 4.5 4Z" },
  { name: "heart", tags: "like love favorite", d: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z" },
  { name: "star", tags: "favorite rating", d: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" },
  { name: "sparkles", tags: "magic ai new", d: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z" },
  { name: "sun", tags: "light day weather", d: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4" },
  { name: "moon", tags: "dark night weather", d: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" },
  { name: "cloud", tags: "weather sync upload", d: "M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18Z" },
  { name: "bolt", tags: "fast power energy", d: "M13 2 4 14h7l-1 8 9-12h-7Z" },
  { name: "bell", tags: "notification alert", d: "M6 16v-5a6 6 0 0 1 12 0v5l2 2H4Z M10 21h4" },
  { name: "home", tags: "house start", d: "M4 11 12 4l8 7 M6 9.5V20h12V9.5 M10 20v-5h4v5" },
  { name: "search", tags: "find magnifier", d: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z M20 20l-4-4" },
  { name: "camera", tags: "photo image", d: "M4 8h3l2-3h6l2 3h3v11H4Z M12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" },
  { name: "mail", tags: "email message inbox", d: "M3 6h18v12H3Z M3 7l9 6 9-6" },
  { name: "coffee", tags: "cup break drink", d: "M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5Z M16 11h1.5a2.5 2.5 0 0 1 0 5H16 M8 3v3 M12 3v3" },
  { name: "rocket", tags: "launch ship start", d: "M12 3c4 2 6 6 5 11l-2 3H9l-2-3C6 9 8 5 12 3Z M12 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z M9 17l-2 4 M15 17l2 4" },
];

const SIZES = [16, 24, 32, 48];

const Glyph = ({ d, size = 24, stroke = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

export const IconSearch = ({ initial = "leaf" }) => {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(initial);
  const [size, setSize] = useState(48);
  const q = query.trim().toLowerCase();
  const results = ICONS.filter((icon) => !q || icon.name.includes(q) || icon.tags.includes(q));
  const current = ICONS.find((icon) => icon.name === selected) ?? ICONS[0];

  return (
    <div className="pm-widget pm-search not-prose">
      <label className="pm-search-field">
        <span className="pm-sr-only">Search icons</span>
        <Glyph d={ICONS[11].d} size={18} />
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try “weather” or “plant”" />
        <span className="pm-count" aria-live="polite">{results.length} of {ICONS.length}</span>
      </label>
      <div className="pm-search-body">
        <ul className="pm-grid" aria-label="Icons">
          {results.map((icon) => (
            <li key={icon.name}>
              <button type="button" className="pm-tile" aria-pressed={icon.name === current.name} title={icon.name} onClick={() => setSelected(icon.name)}>
                <Glyph d={icon.d} />
                <span>{icon.name}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="pm-empty">No icon matches “{query}”. We draw new ones every month.</li>}
        </ul>
        <div className="pm-preview">
          <div className="pm-stage" data-testid="preview">
            <Glyph d={current.d} size={size} />
          </div>
          <div className="pm-sizes" role="group" aria-label="Preview size">
            {SIZES.map((value) => (
              <button key={value} type="button" aria-pressed={value === size} onClick={() => setSize(value)}>
                {value}
              </button>
            ))}
          </div>
          <button type="button" className="pm-icon-name" data-copy={`<${current.name}-icon />`} title="Copy the component tag">
            {`<${current.name}-icon />`}
          </button>
        </div>
      </div>
    </div>
  );
};
