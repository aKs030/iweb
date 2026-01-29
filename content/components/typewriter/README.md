# TypeWriter Component

Animated text typing effect with multi-line support and smart line breaking.

## Features

- ✅ Smooth typing animation
- ✅ Multi-line text support
- ✅ Smart line breaking
- ✅ Configurable speeds
- ✅ Quote shuffling
- ✅ Loop support
- ✅ Punctuation pauses
- ✅ Web Component wrapper

## Usage

### As Web Component (Recommended)

```html
<type-writer
  quotes='[{"text":"Hello World","author":"Developer"}]'
  type-speed="100"
  delete-speed="50"
  wait="3000"
  shuffle="true"
  loop="true"
>
  <div class="text" slot="text"></div>
  <div class="author" slot="author"></div>
</type-writer>

<script type="module">
  import './typewriter-web-component.js';
</script>
```

### As Class Instance

```javascript
import { TypeWriter } from './TypeWriter.js';

const typeWriter = new TypeWriter({
  textEl: document.querySelector('.text'),
  authorEl: document.querySelector('.author'),
  quotes: [
    { text: 'Hello World', author: 'Developer' },
    { text: 'Type fast, code faster', author: 'Programmer' },
  ],
  typeSpeed: 85,
  deleteSpeed: 40,
  wait: 2400,
  shuffle: true,
  loop: true,
  onBeforeType: (text) => {
    // Optional: Transform text before typing
    return text;
  },
});

// Stop typing
typeWriter.destroy();
```

### Hero Subtitle Integration

```javascript
import { initHeroSubtitle, stopHeroSubtitle } from './TypeWriter.js';

// Initialize with quotes from JSON
const typeWriter = await initHeroSubtitle({
  heroDataModule: {
    typewriterConfig: {
      typeSpeed: 100,
      deleteSpeed: 50,
    },
  },
});

// Stop animation
stopHeroSubtitle();
```

## Configuration

### TypeWriter Options

| Option         | Type        | Default  | Description              |
| -------------- | ----------- | -------- | ------------------------ |
| `textEl`       | HTMLElement | required | Text container element   |
| `authorEl`     | HTMLElement | required | Author container element |
| `quotes`       | Array       | required | Array of quote objects   |
| `typeSpeed`    | number      | 85       | Typing speed in ms       |
| `deleteSpeed`  | number      | 40       | Delete speed in ms       |
| `wait`         | number      | 2400     | Wait time after typing   |
| `shuffle`      | boolean     | true     | Shuffle quotes           |
| `loop`         | boolean     | true     | Loop quotes              |
| `onBeforeType` | Function    | null     | Callback before typing   |

### Quote Object

```typescript
{
  text: string;      // Quote text
  author?: string;   // Quote author (optional)
}
```

## Events

### hero:typingEnd

Dispatched when typing animation completes:

```javascript
document.addEventListener('hero:typingEnd', (event) => {
  console.log('Typed:', event.detail.text);
  console.log('Author:', event.detail.author);
});
```

### typewriter:loaded (Web Component)

Dispatched when Web Component initializes:

```javascript
document.addEventListener('typewriter:loaded', (event) => {
  const typeWriter = event.detail.typeWriter;
});
```

## Punctuation Pauses

The TypeWriter automatically adds natural pauses after punctuation:

- `,` - 120ms
- `.` - 300ms
- `…` - 400ms
- `!` - 250ms
- `?` - 250ms
- `;` - 180ms
- `:` - 180ms
- `—` - 220ms
- `–` - 180ms

## Smart Line Breaking

The TypeWriter includes intelligent line breaking that:

- Measures text width dynamically
- Breaks at word boundaries
- Respects container width
- Adjusts for responsive layouts

## Memory Management

The TypeWriter uses a `TimerManager` for automatic cleanup:

```javascript
const typeWriter = new TypeWriter({ ... });

// All timers are automatically cleaned up
typeWriter.destroy();
```

## CSS Variables

The TypeWriter sets CSS variables for layout:

```css
--lh-px: /* Line height in pixels */ --gap-px: /* Gap between lines */
  --lines: /* Number of lines */ --box-h: /* Total box height */;
```

## Examples

### Simple Quote Rotation

```javascript
new TypeWriter({
  textEl: document.querySelector('.quote'),
  authorEl: document.querySelector('.author'),
  quotes: [
    { text: 'Code is poetry', author: 'WordPress' },
    { text: 'Keep it simple', author: 'KISS' },
  ],
});
```

### Custom Speeds

```javascript
new TypeWriter({
  textEl: document.querySelector('.quote'),
  authorEl: document.querySelector('.author'),
  quotes: [...],
  typeSpeed: 50,    // Fast typing
  deleteSpeed: 20,  // Fast deleting
  wait: 5000        // Long pause
});
```

### No Loop

```javascript
new TypeWriter({
  textEl: document.querySelector('.quote'),
  authorEl: document.querySelector('.author'),
  quotes: [...],
  loop: false  // Type once and stop
});
```

## Browser Support

- Modern browsers with ES6+ support
- Uses `requestAnimationFrame` for smooth animations
- Requires `IntersectionObserver` for lazy loading

## Performance

- Efficient DOM updates
- RAF-based animations
- Automatic cleanup
- Memory leak prevention
