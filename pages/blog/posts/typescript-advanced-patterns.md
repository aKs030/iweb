---
id: typescript-advanced-patterns
title: TypeScript Advanced Patterns für robusteren Code
date: 2026-02-10
category: Webdesign
author: Abdulkerim Sesli
image: /content/assets/img/og/og-typescript-800.svg
imageAlt: TypeScript Advanced Patterns für robusteren Code - Artikelbild
excerpt: Fortgeschrittene TypeScript-Patterns: Conditional Types, Template Literals, Branded Types und mehr. Typsicherheit auf dem nächsten Level.
seoDescription: Fortgeschrittene TypeScript-Patterns: Conditional Types, Template Literals, Branded Types und mehr. Typsicherheit auf dem nächsten Level. Mit Verweisen auf Bilder, Videos und die Hauptseite für bessere Auffindbarkeit in der Google-Suche.
keywords: TypeScript, Advanced Types, Conditional Types, Template Literal Types, Branded Types, Robuster Code, Bilder, Videos, Hauptseite
readTime: 7 min
relatedHome: /
relatedGallery: /gallery/
relatedVideos: /videos/
---

## TypeScript Mastery: Von Basic zu Advanced Patterns

TypeScript bietet weit mehr als nur Type Annotations. Advanced Patterns ermöglichen präzisere Typen, bessere Inferenz und robusteren Code.

### Conditional Types: Logik im Typsystem

Conditional Types erlauben Typ-Entscheidungen basierend auf Bedingungen:

```typescript
type IsString<T> = T extends string ? true : false;

type A = IsString<string>; // true
type B = IsString<number>; // false
```

**Praktischer Anwendungsfall**: API-Response-Typen basierend auf Request-Parametern:

```typescript
type ApiResponse<T extends 'user' | 'post'> = T extends 'user' ? User : Post;

const fetchData = async <T extends 'user' | 'post'>(
  type: T,
): Promise<ApiResponse<T>> => {
  const response = await fetch(`/api/${type}`);
  return response.json();
};

// TypeScript weiß: result ist User
const result = await fetchData('user');
```

Der Return-Type ändert sich basierend auf dem Parameter. Keine Type Assertions nötig.

### Template Literal Types: String-Manipulation im Typsystem

Template Literals ermöglichen dynamische String-Typen:

```typescript
type EventName<T extends string> = `on${Capitalize<T>}`;

type ClickEvent = EventName<'click'>; // 'onClick'
type HoverEvent = EventName<'hover'>; // 'onHover'
```

**CSS-in-JS mit Typsicherheit**:

```typescript
type CSSProperty = 'margin' | 'padding' | 'border';
type CSSDirection = 'top' | 'right' | 'bottom' | 'left';
type CSSPropertyWithDirection = `${CSSProperty}-${CSSDirection}`;

// 'margin-top' | 'margin-right' | ... | 'border-left'
const style: Record<CSSPropertyWithDirection, string> = {
  'margin-top': '10px',
  'padding-left': '20px',
  // TypeScript erzwingt alle Kombinationen
};
```

Typos in Property-Namen? Unmöglich. TypeScript kennt alle gültigen Kombinationen.

### Mapped Types: Typ-Transformationen

Mapped Types transformieren bestehende Typen:

```typescript
type Readonly<T> = {
  readonly [P in keyof T]: T[P];
};

type Optional<T> = {
  [P in keyof T]?: T[P];
};

type Nullable<T> = {
  [P in keyof T]: T[P] | null;
};
```

**Praktisch**: API-Response-Typen aus Request-Typen ableiten:

```typescript
type User = {
  id: number;
  name: string;
  email: string;
};

type UserUpdate = Partial<Omit<User, 'id'>>;
// { name?: string; email?: string; }
```

Update-Requests brauchen keine ID und alle Felder sind optional. Ein Typ, keine Duplikation.

### Branded Types: Primitive Typen unterscheidbar machen

Branded Types verhindern Verwechslungen zwischen gleichen Primitives:

```typescript
type UserId = number & { __brand: 'UserId' };
type ProductId = number & { __brand: 'ProductId' };

const createUserId = (id: number): UserId => id as UserId;
const createProductId = (id: number): ProductId => id as ProductId;

const getUser = (id: UserId) => {
  /* ... */
};
const getProduct = (id: ProductId) => {
  /* ... */
};

const userId = createUserId(123);
const productId = createProductId(456);

getUser(userId); // ✓ OK
getUser(productId); // ✗ Error: Type 'ProductId' not assignable
```

Beide sind `number`, aber TypeScript unterscheidet sie. Keine versehentlichen Verwechslungen mehr.

### Discriminated Unions: Type-Safe State Machines

Discriminated Unions modellieren Zustände präzise:

```typescript
type LoadingState = { status: 'loading' };
type SuccessState<T> = { status: 'success'; data: T };
type ErrorState = { status: 'error'; error: Error };

type AsyncState<T> = LoadingState | SuccessState<T> | ErrorState;

const handleState = <T>(state: AsyncState<T>) => {
  switch (state.status) {
    case 'loading':
      return 'Loading...';
    case 'success':
      return state.data; // TypeScript weiß: data existiert
    case 'error':
      return state.error.message; // TypeScript weiß: error existiert
  }
};
```

Kein `data` im Loading-State, kein `error` im Success-State. TypeScript erzwingt korrekte Zugriffe.

### Recursive Types: Verschachtelte Strukturen typisieren

Recursive Types für Baumstrukturen oder verschachtelte Objekte:

```typescript
type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

const data: JSONValue = {
  name: 'John',
  age: 30,
  hobbies: ['reading', 'coding'],
  address: {
    city: 'Berlin',
    coordinates: [52.52, 13.405],
  },
};
```

Beliebig verschachtelte JSON-Strukturen sind typsicher. Keine `any` nötig.

**Pfad-Typen für verschachtelte Objekte**:

```typescript
type PathsToStringProps<T> = T extends string
  ? []
  : {
      [K in Extract<keyof T, string>]: [K, ...PathsToStringProps<T[K]>];
    }[Extract<keyof T, string>];

type User = {
  profile: {
    name: string;
    settings: {
      theme: string;
    };
  };
};

type UserPaths = PathsToStringProps<User>;
// ['profile', 'name'] | ['profile', 'settings', 'theme']
```

Typsichere Pfade zu allen String-Properties. Perfekt für Form-Libraries oder State-Management.

### Utility Types: TypeScript's eingebaute Helfer

TypeScript bietet viele eingebaute Utility Types:

**Pick und Omit** für Typ-Subsets:

```typescript
type User = {
  id: number;
  name: string;
  email: string;
  password: string;
};

type PublicUser = Omit<User, 'password'>;
type UserCredentials = Pick<User, 'email' | 'password'>;
```

**ReturnType und Parameters** für Funktions-Typen:

```typescript
const fetchUser = async (id: number) => {
  return { id, name: 'John' };
};

type FetchUserReturn = ReturnType<typeof fetchUser>;
// Promise<{ id: number; name: string; }>

type FetchUserParams = Parameters<typeof fetchUser>;
// [id: number]
```

Typen aus Funktionen ableiten statt duplizieren. Single Source of Truth.

### Type Guards: Runtime-Checks mit Typ-Narrowing

Type Guards kombinieren Runtime-Checks mit Typ-Inferenz:

```typescript
const isString = (value: unknown): value is string => {
  return typeof value === 'string';
};

const processValue = (value: unknown) => {
  if (isString(value)) {
    return value.toUpperCase(); // TypeScript weiß: value ist string
  }
  return 'Not a string';
};
```

**User-Defined Type Guards** für komplexe Typen:

```typescript
type User = { type: 'user'; name: string };
type Admin = { type: 'admin'; name: string; permissions: string[] };

const isAdmin = (user: User | Admin): user is Admin => {
  return user.type === 'admin';
};

const greet = (user: User | Admin) => {
  if (isAdmin(user)) {
    console.log(
      `Admin ${user.name} with ${user.permissions.length} permissions`,
    );
  } else {
    console.log(`User ${user.name}`);
  }
};
```

TypeScript versteht: Nach dem Guard ist `user` definitiv `Admin`.

### Const Assertions: Präzisere Literal Types

Const Assertions machen Typen spezifischer:

```typescript
// Ohne const assertion
const config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
};
// Type: { apiUrl: string; timeout: number; }

// Mit const assertion
const config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
} as const;
// Type: { readonly apiUrl: 'https://api.example.com'; readonly timeout: 5000; }
```

Literal Types statt breite Primitives. Perfekt für Konfigurationen und Enums.

**Tuple Types mit const**:

```typescript
const point = [10, 20] as const;
// Type: readonly [10, 20]

const coordinates = [10, 20];
// Type: number[]
```

Tuple statt Array. TypeScript kennt Länge und exakte Werte.

### Generics mit Constraints: Flexible aber sichere Typen

Generics mit Constraints kombinieren Flexibilität und Sicherheit:

```typescript
const getProperty = <T, K extends keyof T>(obj: T, key: K): T[K] => {
  return obj[key];
};

const user = { name: 'John', age: 30 };
const name = getProperty(user, 'name'); // Type: string
const age = getProperty(user, 'age'); // Type: number
const invalid = getProperty(user, 'invalid'); // Error
```

`K extends keyof T` garantiert: `key` existiert in `obj`. Keine Runtime-Errors.

**Multiple Constraints**:

```typescript
const merge = <T extends object, U extends object>(obj1: T, obj2: U): T & U => {
  return { ...obj1, ...obj2 };
};

const result = merge({ a: 1 }, { b: 2 });
// Type: { a: number; } & { b: number; }
```

Beide Parameter müssen Objekte sein. Return-Type ist Intersection beider.

#### Takeaways:

- Conditional Types ermöglichen Typ-Logik basierend auf Bedingungen.
- Template Literal Types bieten String-Manipulation im Typsystem.
- Branded Types verhindern Verwechslungen zwischen gleichen Primitives.
- Discriminated Unions modellieren State Machines typsicher.
- Recursive Types typisieren verschachtelte Strukturen ohne `any`.
- Type Guards kombinieren Runtime-Checks mit Typ-Narrowing.
- Const Assertions machen Typen präziser und readonly.

🔗 Ebenfalls interessant: Im Artikel „Web Components: Die Zukunft" zeige ich, wie TypeScript mit Web Components kombiniert wird.

👉 Möchten Sie TypeScript-Best-Practices in Ihrem Projekt etablieren? Ich unterstütze Sie bei Code-Reviews und Architektur-Entscheidungen.
