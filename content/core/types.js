/**
 * Type Definitions (JSDoc)
 * Modern type safety without TypeScript overhead
 * @version 1.0.0
 */

/**
 * @typedef {Object} PageData
 * @property {string} title - Page title
 * @property {string} description - Page description
 * @property {string} [title_en] - English title
 * @property {string} [description_en] - English description
 * @property {string} type - Schema.org type (WebPage, ProfilePage, etc.)
 * @property {string} image - OG image URL
 * @property {string} [imageWebp] - WebP version of image
 * @property {string} [imageCredit] - Image credit text
 */

/**
 * @typedef {Object} BrandData
 * @property {string} name - Brand name
 * @property {string} legalName - Legal entity name
 * @property {string[]} alternateName - Alternative names
 * @property {string} logo - Logo URL
 * @property {string[]} jobTitle - Job titles
 * @property {string} email - Contact email
 * @property {string} areaServed - Service area
 * @property {PostalAddress} address - Physical address
 * @property {GeoCoordinates} geo - Geographic coordinates
 * @property {string[]} sameAs - Social media URLs
 * @property {ContactPoint[]} contactPoint - Contact points
 * @property {string} telephone - Phone number
 * @property {string} [licensePage] - License page URL
 * @property {string} [copyrightHolder] - Copyright holder name
 */

/**
 * @typedef {Object} PostalAddress
 * @property {string} streetAddress - Street address
 * @property {string} addressLocality - City
 * @property {string} postalCode - Postal code
 * @property {string} addressCountry - Country code
 */

/**
 * @typedef {Object} GeoCoordinates
 * @property {string} latitude - Latitude
 * @property {string} longitude - Longitude
 */

/**
 * @typedef {Object} ContactPoint
 * @property {string} contactType - Type of contact
 * @property {string} email - Contact email
 * @property {string} [url] - Contact URL
 */

/**
 * @typedef {Object} SchemaNode
 * @property {string} @type - Schema.org type
 * @property {string} @id - Unique identifier
 * @property {string} [name] - Name
 * @property {string} [url] - URL
 * @property {string} [description] - Description
 */

/**
 * @typedef {Object} LoggerInstance
 * @property {function(string, ...any): void} error - Log error
 * @property {function(string, ...any): void} warn - Log warning
 * @property {function(string, ...any): void} info - Log info
 * @property {function(string, ...any): void} debug - Log debug
 */

/**
 * @typedef {Object} FetchOptions
 * @property {number} [timeout] - Request timeout in ms
 * @property {AbortSignal} [signal] - Abort signal
 * @property {RequestCredentials} [credentials] - Credentials mode
 */

/**
 * @typedef {Object} ObserverConfig
 * @property {number|number[]} [threshold] - Intersection threshold(s)
 * @property {string} [rootMargin] - Root margin
 * @property {Element} [root] - Root element
 */

/**
 * @typedef {Object} CanonicalLinks
 * @property {string} canonicalHref - Canonical URL
 * @property {string} effectiveCanonical - Effective canonical URL
 * @property {Array<{lang: string, href: string}>} alternates - Alternate language links
 * @property {string} canonicalOrigin - Canonical origin
 */

/**
 * @typedef {Object} PWAAssets
 * @property {Array<{rel: string, href: string}>} links - Link elements
 * @property {Array<{rel: string, href: string, sizes: string, type?: string}>} iconLinks - Icon links
 * @property {Array<{name: string, content: string}>} metas - Meta tags
 */

/**
 * Component Configuration Types
 */

/**
 * @typedef {Object} ComponentConfig
 * @property {string} [CSS_URL] - CSS file URL
 * @property {number} [DEBOUNCE_MS] - Debounce delay in milliseconds
 * @property {number} [ICON_CHECK_DELAY] - Icon check delay
 * @property {number} [TITLE_TRANSITION_DELAY] - Title transition delay
 */

/**
 * @typedef {Object} MenuState
 * @property {boolean} isOpen - Menu open state
 * @property {HTMLElement|null} activeLink - Currently active link
 * @property {string} currentTitle - Current menu title
 * @property {string} currentSubtitle - Current menu subtitle
 */

/**
 * @typedef {Object} RobotState
 * @property {boolean} isOpen - Chat window open state
 * @property {string} mood - Current mood state
 * @property {number} interactions - Total interactions count
 * @property {number} sessions - Total sessions count
 * @property {string[]} sectionsVisited - Visited sections
 * @property {Set<string>} easterEggFound - Found easter eggs
 */

/**
 * @typedef {Object} RobotAnalytics
 * @property {number} sessions - Total sessions
 * @property {string[]} sectionsVisited - Visited sections
 * @property {number} interactions - Total interactions
 * @property {string} lastVisit - Last visit timestamp
 */

/**
 * @typedef {Object} DOMCache
 * @property {HTMLElement} [container] - Container element
 * @property {HTMLElement} [window] - Window element
 * @property {HTMLElement} [bubble] - Bubble element
 * @property {HTMLElement} [bubbleText] - Bubble text element
 * @property {HTMLElement} [bubbleClose] - Bubble close button
 * @property {HTMLElement} [messages] - Messages container
 * @property {HTMLElement} [controls] - Controls container
 * @property {HTMLElement} [inputArea] - Input area container
 * @property {HTMLInputElement} [input] - Input element
 * @property {HTMLButtonElement} [sendBtn] - Send button
 * @property {HTMLElement} [avatar] - Avatar element
 * @property {SVGElement} [svg] - SVG element
 * @property {SVGElement} [eyes] - Robot eyes SVG element
 * @property {SVGElement} [flame] - Robot flame SVG element
 * @property {SVGElement} [legs] - Robot legs SVG element
 * @property {{left: Element|null, right: Element|null}} [arms] - Robot arms
 * @property {HTMLElement} [particles] - Particles element
 * @property {HTMLElement} [thinking] - Thinking indicator element
 * @property {HTMLElement} [closeBtn] - Close button element
 * @property {Element} [footer] - Footer element
 */

/**
 * @typedef {Object} EventListenerRegistry
 * @property {Array<{target: EventTarget, handler: EventListenerOrEventListenerObject}>} scroll - Scroll listeners
 * @property {Array<{target: EventTarget, handler: EventListenerOrEventListenerObject}>} resize - Resize listeners
 * @property {Array<{target: EventTarget, handler: EventListenerOrEventListenerObject}>} [visualViewportResize] - Visual viewport resize listeners
 * @property {Array<{target: EventTarget, handler: EventListenerOrEventListenerObject}>} [visualViewportScroll] - Visual viewport scroll listeners
 * @property {{target: EventTarget, handler: EventListenerOrEventListenerObject}|null} [inputFocus] - Input focus listener
 * @property {{target: EventTarget, handler: EventListenerOrEventListenerObject}|null} [inputBlur] - Input blur listener
 * @property {{target: EventTarget, handler: EventListenerOrEventListenerObject}|null} [heroTypingEnd] - Hero typing end listener
 * @property {Array<{target: Element, event: string, handler: EventListenerOrEventListenerObject}>} dom - DOM listeners
 */

/**
 * @typedef {Object} TimerRegistry
 * @property {Set<ReturnType<typeof setTimeout>>} timeouts - Active timeouts
 * @property {Set<ReturnType<typeof setInterval>>} intervals - Active intervals
 * @property {ReturnType<typeof setTimeout>|null} scrollTimeout - Scroll debounce timeout
 */

/**
 * @typedef {'hero'|'features'|'about'|'footer'|'projects'|'gallery'|'home'|'default'} PageContext
 */

/**
 * @typedef {'night-owl'|'sleepy'|'energetic'|'relaxed'|'enthusiastic'|'normal'} RobotMood
 */

/**
 * @typedef {Object} ChatOption
 * @property {string} text - Option text
 * @property {string} action - Action identifier
 */

/**
 * @typedef {Object} KnowledgeBaseNode
 * @property {string} text - Response text
 * @property {ChatOption[]} [options] - Available options
 * @property {string} [action] - Action to perform
 */

/**
 * @typedef {Object.<string, KnowledgeBaseNode>} KnowledgeBase
 */

/**
 * @typedef {Object} SectionData
 * @property {string} id - Section ID
 * @property {number} index - Section index
 * @property {HTMLElement} section - Section element
 */

/**
 * TypeWriter Types
 */

/**
 * @typedef {Object} TypeWriterQuote
 * @property {string} text - Quote text
 * @property {string} [author] - Quote author
 */

/**
 * @typedef {Object} TypeWriterConfig
 * @property {HTMLElement} textEl - Text container
 * @property {HTMLElement} authorEl - Author container
 * @property {TypeWriterQuote[]} quotes - Quotes array
 * @property {number} [wait] - Wait time in ms
 * @property {number} [typeSpeed] - Type speed in ms
 * @property {number} [deleteSpeed] - Delete speed in ms
 * @property {boolean} [shuffle] - Shuffle quotes
 * @property {boolean} [loop] - Loop quotes
 * @property {Function} [onBeforeType] - Before type callback
 */

/**
 * Search Types
 */

/**
 * @typedef {Object} SearchResult
 * @property {string} id - Result ID
 * @property {string} title - Result title
 * @property {string} description - Result description
 * @property {string} category - Result category
 * @property {string} url - Result URL
 * @property {string} icon - Result icon
 * @property {string[]} keywords - Search keywords
 * @property {number} priority - Search priority
 * @property {number} [score] - Search score
 */

/**
 * Timer Types
 */

/**
 * @typedef {ReturnType<typeof setTimeout>} TimerID
 * Browser timer ID (handles both number and Timeout types)
 */

/**
 * @typedef {Object} TimerManager
 * @property {Set<TimerID>} timers - Active setTimeout IDs
 * @property {Set<TimerID>} intervals - Active setInterval IDs
 * @property {function(Function, number): TimerID} setTimeout - Set timeout
 * @property {function(Function, number): TimerID} setInterval - Set interval
 * @property {function(TimerID): void} clearTimeout - Clear timeout
 * @property {function(TimerID): void} clearInterval - Clear interval
 * @property {function(): void} clearAll - Clear all timers
 */

/**
 * DOM Types
 */

/**
 * @typedef {HTMLElement & {style: CSSStyleDeclaration}} StyledHTMLElement
 * HTML Element with guaranteed style property
 */

/**
 * @typedef {HTMLElement & {dataset: DOMStringMap}} DatasetHTMLElement
 * HTML Element with guaranteed dataset property
 */

/**
 * @typedef {HTMLFormElement & {reset: () => void}} FormElement
 * Form element with reset method
 */

/**
 * Global Types
 */

/**
 * @typedef {Object} WindowWithGtag
 * @property {Function} [gtag] - Google Analytics gtag function
 */

/**
 * @typedef {Window & WindowWithGtag} GlobalWindow
 */

/**
 * @typedef {Object} Vector2
 * @property {number} x - X coordinate
 * @property {number} y - Y coordinate
 */

/**
 * @typedef {Object} GlobalThisExtended
 * @property {any} [robotCompanionTexts] - Robot companion texts
 * @property {any} [__ENV__] - Environment variables
 * @deprecated Use threeEarthState module instead of global variables
 */

/**
 * Three.js Types (minimal definitions)
 */

/**
 * @typedef {Object} ThreeMaterial
 * @property {boolean} [needsUpdate] - Material needs update flag
 * @property {Object} [uniforms] - Shader uniforms
 * @property {Function} [dispose] - Dispose method
 */

/**
 * @typedef {Object} ThreeMesh
 * @property {ThreeMaterial} material - Mesh material
 * @property {Object} userData - User data
 */

/**
 * @typedef {Object} DeviceCapabilities
 * @property {boolean} isMobile - Is mobile device
 * @property {boolean} isLowEnd - Is low-end device
 * @property {number} pixelRatio - Device pixel ratio
 * @property {boolean} supportsWebGL - Supports WebGL
 */

/**
 * Footer Types
 */

/**
 * @typedef {Object} FooterElements
 * @property {HTMLElement|null} footer - Footer element
 * @property {HTMLElement|null} footerMin - Footer minimized view
 * @property {HTMLElement|null} footerMax - Footer expanded view
 * @property {HTMLElement|null} cookieBanner - Cookie banner
 * @property {HTMLElement|null} cookieSettings - Cookie settings
 * @property {HTMLElement|null} footerContent - Footer content
 * @property {HTMLButtonElement|null} acceptBtn - Accept button
 * @property {HTMLButtonElement|null} rejectBtn - Reject button
 * @property {HTMLButtonElement|null} closeBtn - Close button
 * @property {HTMLInputElement|null} analyticsToggle - Analytics toggle
 * @property {HTMLInputElement|null} adsToggle - Ads toggle
 * @property {HTMLButtonElement|null} rejectAll - Reject all button
 * @property {HTMLButtonElement|null} acceptSelected - Accept selected button
 * @property {HTMLButtonElement|null} acceptAll - Accept all button
 */

// This file contains JSDoc type definitions
// Minimal export to make TypeScript happy
export const __types__ = true;
