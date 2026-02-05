DROP TABLE IF EXISTS search_index;
CREATE VIRTUAL TABLE search_index USING fts5(
  id,
  title,
  description,
  url,
  category,
  keywords,
  priority UNINDEXED
);
