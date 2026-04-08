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
 * @property {any} [image] - Image object
 * @property {Array<{name: string, alternateName?: string}>} [knowsLanguage] - Known languages
 * @property {string[]} jobTitle - Job titles
 * @property {string} email - Contact email
 * @property {string} areaServed - Service area
 * @property {GeoCoordinates} geo - Geographic coordinates
 * @property {string[]} sameAs - Social media URLs
 * @property {ContactPoint[]} contactPoint - Contact points
 * @property {string} telephone - Phone number
 * @property {string} [licensePage] - License page URL
 * @property {string} [copyrightHolder] - Copyright holder name
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
 * @typedef {{ '@type': string, '@id': string, name?: string, url?: string, description?: string, [key: string]: any }} SchemaNode
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
 * Shared Style Types
 */

/**
 * Overlay Types
 */

/**
 * @typedef {'none'|'menu'|'search'|'robot-chat'} OverlayMode
 */

/**
 * @typedef {Object} OverlayCloseOptions
 * @property {OverlayMode} [mode] - Overlay mode requesting the close action
 * @property {string} [reason] - Close trigger such as `escape` or `programmatic`
 * @property {boolean} [restoreFocus] - Whether focus should be restored after close
 */

/**
 * @callback OverlayCloseHandler
 * @param {OverlayCloseOptions} [options]
 * @returns {void|Promise<void>}
 */

/**
 * @callback OverlayElementListResolver
 * @returns {HTMLElement[]}
 */

/**
 * @callback OverlayElementResolver
 * @returns {HTMLElement|null}
 */

/**
 * @typedef {'getInteractiveRoots'|'getFocusTrapRoots'} OverlayRootResolverName
 */

/**
 * @typedef {'getPrimaryFocusTarget'|'getRestoreFocusTarget'} OverlayFocusResolverName
 */

/**
 * @typedef {Object} OverlayController
 * @property {OverlayCloseHandler} [close] - Close handler for the active overlay
 * @property {OverlayElementListResolver} [getInteractiveRoots] - Elements that remain interactive while the overlay is active
 * @property {OverlayElementListResolver} [getFocusTrapRoots] - Elements that participate in focus trapping
 * @property {OverlayElementResolver} [getPrimaryFocusTarget] - Preferred initial focus target
 * @property {OverlayElementResolver} [getRestoreFocusTarget] - Preferred focus target after close
 */

/**
 * @typedef {string[]} CssUrlList
 */

/**
 * @typedef {Object} MenuState
 * @property {boolean} isOpen - Menu open state
 * @property {HTMLElement|null} activeLink - Currently active link
 * @property {string} currentTitle - Current menu title
 * @property {string} currentSubtitle - Current menu subtitle
 */

/**
 * @typedef {Object} DOMCache
 * @property {HTMLElement} [container] - Container element
 * @property {HTMLElement} [backdrop] - Chat backdrop element
 * @property {HTMLElement} [window] - Chat window element
 * @property {HTMLElement} [floatWrapper] - Float wrapper element
 * @property {HTMLElement} [bubble] - Bubble element
 * @property {HTMLElement} [bubbleText] - Bubble text element
 * @property {HTMLElement} [bubbleClose] - Bubble close button
 * @property {HTMLElement} [messages] - Messages container
 * @property {HTMLElement} [inputArea] - Input area container
 * @property {HTMLInputElement} [input] - Input element
 * @property {HTMLButtonElement} [sendBtn] - Send button
 * @property {HTMLElement} [avatar] - Avatar element
 * @property {SVGElement} [svg] - SVG element
 * @property {SVGElement} [eyes] - Robot eyes SVG element
 * @property {SVGElement} [antenna] - Robot antenna SVG element
 * @property {SVGElement} [flame] - Robot flame SVG element
 * @property {NodeListOf<SVGElement>} [lids] - Robot eyelid elements
 * @property {NodeListOf<SVGElement>} [pupils] - Robot pupil elements
 * @property {SVGElement} [legs] - Robot legs SVG element
 * @property {{left: Element|null, right: Element|null}} [arms] - Robot arms
 * @property {HTMLElement} [particles] - Particles element
 * @property {HTMLElement} [thinking] - Thinking indicator element
 * @property {SVGElement} [magnifyingGlass] - Magnifying glass element
 * @property {HTMLElement} [mouth] - Mouth element
 * @property {HTMLElement} [closeBtn] - Chat close button element
 * @property {HTMLButtonElement|null} [memoryBtn] - Header action: open user settings + memories
 * @property {HTMLButtonElement|null} [stopBtn] - Composer action: stop active AI response
 * @property {HTMLElement|null} [namePrompt] - Inline name prompt inside chat stream
 * @property {HTMLElement|null} [namePromptTitle] - Name prompt title element
 * @property {HTMLElement|null} [namePromptCopy] - Name prompt copy element
 * @property {HTMLElement|null} [namePromptFeedback] - Name prompt feedback element
 * @property {HTMLButtonElement|null} [nameDismissBtn] - Name prompt dismiss button
 * @property {HTMLButtonElement|null} [nameSaveBtn] - Name prompt save button
 * @property {HTMLInputElement|null} [nameInput] - Name prompt input field
 * @property {HTMLInputElement|null} [imageUploadInput] - Hidden image upload input
 * @property {HTMLButtonElement|null} [imageBtn] - Composer image picker button
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
 * @property {Array<{target: EventTarget, event: string, handler: EventListenerOrEventListenerObject}>} dom - DOM listeners
 */

/**
 * @typedef {'hero'|'features'|'about'|'footer'|'projects'|'gallery'|'videos'|'blog'|'contact'|'legal'|'home'|'default'} PageContext
 */

/**
 * @typedef {'night-owl'|'sleepy'|'energetic'|'relaxed'|'enthusiastic'|'normal'} RobotMood
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
 * @property {string} title - Result title
 * @property {string} url - Result URL
 * @property {string} [description] - Result description
 * @property {string} [category] - Result category
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

// This file contains JSDoc type definitions only
export {};
