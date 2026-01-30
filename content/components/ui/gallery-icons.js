/* global React */

/**
 * Gallery Icon Components
 * Extracted from gallery-app.js for better reusability
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
        className,
      },
      paths,
    );

export const Heart = createIcon(
  React.createElement('path', {
    d: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  }),
);

export const X_Icon = createIcon(
  React.createElement(
    React.Fragment,
    null,
    React.createElement('line', { x1: '18', y1: '6', x2: '6', y2: '18' }),
    React.createElement('line', { x1: '6', y1: '6', x2: '18', y2: '18' }),
  ),
);

export const ChevronLeft = createIcon(
  React.createElement('polyline', { points: '15 18 9 12 15 6' }),
);

export const ChevronRight = createIcon(
  React.createElement('polyline', { points: '9 18 15 12 9 6' }),
);

export const ZoomIn = createIcon(
  React.createElement(
    React.Fragment,
    null,
    React.createElement('circle', { cx: '11', cy: '11', r: '8' }),
    React.createElement('line', {
      x1: '21',
      y1: '21',
      x2: '16.65',
      y2: '16.65',
    }),
    React.createElement('line', { x1: '11', y1: '8', x2: '11', y2: '14' }),
    React.createElement('line', { x1: '8', y1: '11', x2: '14', y2: '11' }),
  ),
);

export const ZoomOut = createIcon(
  React.createElement(
    React.Fragment,
    null,
    React.createElement('circle', { cx: '11', cy: '11', r: '8' }),
    React.createElement('line', {
      x1: '21',
      y1: '21',
      x2: '16.65',
      y2: '16.65',
    }),
    React.createElement('line', { x1: '8', y1: '11', x2: '14', y2: '11' }),
  ),
);

export const Download = createIcon(
  React.createElement(
    React.Fragment,
    null,
    React.createElement('path', {
      d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
    }),
    React.createElement('polyline', { points: '7 10 12 15 17 10' }),
    React.createElement('line', { x1: '12', y1: '15', x2: '12', y2: '3' }),
  ),
);

export const Grid2x2 = createIcon(
  React.createElement(
    React.Fragment,
    null,
    React.createElement('rect', { x: '3', y: '3', width: '7', height: '7' }),
    React.createElement('rect', { x: '14', y: '3', width: '7', height: '7' }),
    React.createElement('rect', { x: '14', y: '14', width: '7', height: '7' }),
    React.createElement('rect', { x: '3', y: '14', width: '7', height: '7' }),
  ),
);

export const Grid3x3 = createIcon(
  React.createElement(
    React.Fragment,
    null,
    React.createElement('rect', { x: '3', y: '3', width: '5', height: '5' }),
    React.createElement('rect', { x: '10', y: '3', width: '5', height: '5' }),
    React.createElement('rect', { x: '17', y: '3', width: '5', height: '5' }),
    React.createElement('rect', { x: '3', y: '10', width: '5', height: '5' }),
    React.createElement('rect', { x: '10', y: '10', width: '5', height: '5' }),
    React.createElement('rect', { x: '17', y: '10', width: '5', height: '5' }),
    React.createElement('rect', { x: '3', y: '17', width: '5', height: '5' }),
    React.createElement('rect', { x: '10', y: '17', width: '5', height: '5' }),
    React.createElement('rect', { x: '17', y: '17', width: '5', height: '5' }),
  ),
);

export const Search = createIcon(
  React.createElement(
    React.Fragment,
    null,
    React.createElement('circle', { cx: '11', cy: '11', r: '8' }),
    React.createElement('line', {
      x1: '21',
      y1: '21',
      x2: '16.65',
      y2: '16.65',
    }),
  ),
);

export const Share2 = createIcon(
  React.createElement(
    React.Fragment,
    null,
    React.createElement('circle', { cx: '18', cy: '5', r: '3' }),
    React.createElement('circle', { cx: '6', cy: '12', r: '3' }),
    React.createElement('circle', { cx: '18', cy: '19', r: '3' }),
    React.createElement('line', {
      x1: '8.59',
      y1: '13.51',
      x2: '15.42',
      y2: '17.49',
    }),
    React.createElement('line', {
      x1: '15.41',
      y1: '6.51',
      x2: '8.59',
      y2: '10.49',
    }),
  ),
);

export const Play = createIcon(
  React.createElement('polygon', { points: '5 3 19 12 5 21 5 3' }),
);

export const Pause = createIcon(
  React.createElement(
    React.Fragment,
    null,
    React.createElement('rect', { x: '6', y: '4', width: '4', height: '16' }),
    React.createElement('rect', { x: '14', y: '4', width: '4', height: '16' }),
  ),
);

export const Info = createIcon(
  React.createElement(
    React.Fragment,
    null,
    React.createElement('circle', { cx: '12', cy: '12', r: '10' }),
    React.createElement('line', { x1: '12', y1: '16', x2: '12', y2: '12' }),
    React.createElement('line', { x1: '12', y1: '8', x2: '12.01', y2: '8' }),
  ),
);
