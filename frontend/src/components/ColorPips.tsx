interface ColorPipsProps {
  colors: string[];
  size?: 'sm' | 'md' | 'lg';
}

const COLOR_MAP: Record<string, string> = {
  W: 'ms-w',
  U: 'ms-u',
  B: 'ms-b',
  R: 'ms-r',
  G: 'ms-g',
};

const SIZE_CLASSES: Record<string, string> = {
  sm: 'text-xs',
  md: '',
  lg: 'text-lg',
};

function ColorPips({ colors, size = 'md' }: ColorPipsProps) {
  const sizeClass = SIZE_CLASSES[size] || '';

  if (!colors || colors.length === 0) {
    return (
      <div className={`color-pips ${sizeClass}`}>
        <i className="ms ms-c ms-cost ms-shadow" title="Colorless" />
      </div>
    );
  }

  // Sort colors in WUBRG order
  const sortOrder = ['W', 'U', 'B', 'R', 'G'];
  const sortedColors = [...colors].sort((a, b) => {
    return sortOrder.indexOf(a) - sortOrder.indexOf(b);
  });

  return (
    <div className={`color-pips ${sizeClass}`}>
      {sortedColors.map((color, index) => {
        const manaClass = COLOR_MAP[color];
        if (!manaClass) return null;
        return (
          <i
            key={`${color}-${index}`}
            className={`ms ${manaClass} ms-cost ms-shadow`}
            title={color}
          />
        );
      })}
    </div>
  );
}

export default ColorPips;
