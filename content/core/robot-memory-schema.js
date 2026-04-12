const BASE_MEMORY_FIELDS = [
  {
    key: 'name',
    label: 'Name',
    category: 'identity',
    priority: 100,
    singleton: true,
  },
  {
    key: 'preference',
    label: 'Praeferenz',
    category: 'preference',
    priority: 90,
  },
  {
    key: 'occupation',
    label: 'Beruf',
    category: 'profile',
    priority: 88,
    singleton: true,
  },
  {
    key: 'company',
    label: 'Firma',
    category: 'profile',
    priority: 86,
    singleton: true,
  },
  {
    key: 'location',
    label: 'Ort',
    category: 'profile',
    priority: 84,
    singleton: true,
  },
  {
    key: 'language',
    label: 'Sprache',
    category: 'profile',
    priority: 82,
    singleton: true,
  },
  {
    key: 'interest',
    label: 'Interesse',
    category: 'interest',
    priority: 80,
  },
  {
    key: 'skill',
    label: 'Skill',
    category: 'ability',
    priority: 78,
  },
  {
    key: 'goal',
    label: 'Ziel',
    category: 'goal',
    priority: 76,
  },
  {
    key: 'project',
    label: 'Projekt',
    category: 'project',
    priority: 74,
  },
  {
    key: 'birthday',
    label: 'Geburtstag',
    category: 'identity',
    priority: 72,
    singleton: true,
  },
  {
    key: 'dislike',
    label: 'Abneigung',
    category: 'preference',
    priority: 70,
  },
  {
    key: 'availability',
    label: 'Verfuegbarkeit',
    category: 'availability',
    priority: 68,
    singleton: true,
  },
  {
    key: 'timezone',
    label: 'Zeitzone',
    category: 'availability',
    priority: 66,
    singleton: true,
  },
  {
    key: 'note',
    label: 'Notiz',
    category: 'note',
    priority: 40,
  },
];

export const DEFAULT_ROBOT_MEMORY_CATEGORY = 'note';
export const DEFAULT_ROBOT_MEMORY_PRIORITY = 20;

const ROBOT_MEMORY_FIELDS = Object.freeze(
  BASE_MEMORY_FIELDS.map((field, index) =>
    Object.freeze({
      ...field,
      rank: index,
      singleton: Boolean(field.singleton),
      memoryManager: field.memoryManager !== false,
    }),
  ),
);

const ROBOT_MEMORY_FIELD_BY_KEY = new Map(
  ROBOT_MEMORY_FIELDS.map((field) => [field.key, field]),
);

export const ROBOT_MEMORY_KEYS = Object.freeze(
  ROBOT_MEMORY_FIELDS.map((field) => field.key),
);

export const ROBOT_MEMORY_KEY_ENUM = ROBOT_MEMORY_KEYS;

export const ROBOT_MEMORY_METADATA = Object.freeze(
  Object.fromEntries(
    ROBOT_MEMORY_FIELDS.map((field) => [
      field.key,
      Object.freeze({
        category: field.category,
        priority: field.priority,
      }),
    ]),
  ),
);

export const ROBOT_MEMORY_SINGLETON_KEYS = new Set(
  ROBOT_MEMORY_FIELDS.filter((field) => field.singleton).map(
    (field) => field.key,
  ),
);

function getRobotMemoryField(key) {
  return ROBOT_MEMORY_FIELD_BY_KEY.get(String(key || '').trim()) || null;
}

export function getRobotMemoryRank(key) {
  return getRobotMemoryField(key)?.rank ?? 99;
}

export function getRobotMemoryManagerFields() {
  return ROBOT_MEMORY_FIELDS.filter((field) => field.memoryManager);
}
