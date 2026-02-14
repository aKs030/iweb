import React from 'https://esm.sh/react@19.2.3';

/**
 * Gallery Icon Components
 * @version 2.0.0 - Optimized for 3D Gallery
 */

const createIcon =
  (paths) =>
  ({ size = 20, className = '' } = {}) =>
    React.createElement(
      'svg',
      {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: '2',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        className,
      },
      paths,
    );

export const X_Icon = createIcon(
  React.createElement(
    React.Fragment,
    null,
    React.createElement('line', { x1: '18', y1: '6', x2: '6', y2: '18' }),
    React.createElement('line', { x1: '6', y1: '6', x2: '18', y2: '18' }),
  ),
);
