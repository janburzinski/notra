export const BeforeAfter = ({ before, after, beforeLabel = "Before", afterLabel = "After", alt = "" }) => {
  const [position, setPosition] = useState(50);

  return (
    <figure className="pm-widget pm-compare not-prose">
      <div className="pm-compare-stage" style={{ "--pos": `${position}%` }}>
        <img src={before} alt={alt ? `${beforeLabel}: ${alt}` : ""} />
        <img src={after} alt={alt ? `${afterLabel}: ${alt}` : ""} className="pm-compare-after" />
        <span className="pm-compare-line" aria-hidden="true" />
        <span className="pm-compare-tag pm-compare-tag-before">{beforeLabel}</span>
        <span className="pm-compare-tag pm-compare-tag-after">{afterLabel}</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={position}
        onChange={(event) => setPosition(Number(event.target.value))}
        aria-label={`Show more of ${beforeLabel.toLowerCase()} or ${afterLabel.toLowerCase()}`}
      />
    </figure>
  );
};
