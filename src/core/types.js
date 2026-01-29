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

export {};
