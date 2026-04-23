import { Icon as MuiIcon } from '@mui/material';
import type { CSSProperties } from 'react';

interface CategoryIconProps {
  icon?: string | null;
  color?: string | null;
  size?: number;
}

/**
 * Visual badge for a category. Reuses the .cat class from global.css and
 * renders a Material Icons glyph (matches existing category.icon storage).
 */
export default function CategoryIcon({
  icon,
  color,
  size = 32,
}: CategoryIconProps) {
  const style: CSSProperties = {
    width: size,
    height: size,
  };
  if (color) {
    (style as Record<string, string>)['--cat-color'] = color;
  }
  const glyphSize = Math.round(size * 0.5);
  return (
    <div className="cat" style={style}>
      {icon ? (
        <MuiIcon
          sx={{
            fontSize: glyphSize,
            color: color ?? 'var(--accent)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {icon}
        </MuiIcon>
      ) : (
        <span
          aria-hidden
          style={{
            position: 'relative',
            zIndex: 1,
            fontSize: glyphSize * 0.8,
            color: color ?? 'var(--accent)',
          }}
        >
          ¥
        </span>
      )}
    </div>
  );
}
