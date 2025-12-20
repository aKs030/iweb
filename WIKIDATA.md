Ziel: Wikidata‑Item für Abdulkerim Sesli anlegen und mit deinen Profilen + Website verbinden.

Kurzanleitung (QuickStatements v1):
1. Geh zu https://quickstatements.toolforge.org/ und melde dich mit deinem Wikidata‑Account an.
2. Füge die folgenden Zeilen (angepasst falls nötig) ein und führe sie aus:

CREATE
LAST|Len|"Abdulkerim Sesli"
LAST|Den|"Digital Creator und Webentwickler aus Berlin"@de
LAST|P31|Q5
LAST|P106|Q6859454
LAST|P106|Q33231
LAST|P27|Q183
LAST|P856|"https://abdulkerimsesli.de"
LAST|P2037|"aKs030"  # GitHub username (P2037) — ändere falls nötig
LAST|P2002|"abdulkerim_twitter"  # optional: Twitter handle (P2002)

Hinweise:
- P31 = instance of (verwende Q5 = human)
- P106 = occupation (Q6859454 = web developer, Q33231 = photographer)
- P27 = country of citizenship (Q183 = Germany)
- P856 = official website
- P2037 = GitHub username (external-id)
- P2002 = Twitter username (external-id)

Wenn du ein Profilbild auf Wikimedia Commons hast, kannst du zusätzlich P18|"Dateiname.jpg" setzen.

Was ich für dich vorbereitet habe:
- Eine kurze QuickStatements‑Vorlage (oben) — du musst sie nur in QuickStatements einfügen und ausführen.
- Ein Wikipedia‑Stub (siehe `WIKIPEDIA-STUB.de.md`) als Entwurfstext.

Wichtig: Wikipedia verlangt unabhängige, zuverlässige Sekundärquellen (z. B. Presseartikel, Interviews, Magazin‑Features). Ein eigener Webseiten‑Eintrag ohne solche Quellen wird sehr wahrscheinlich abgelehnt.

Wenn du möchtest, kann ich:
- die QuickStatements für dich anpassen (z. B. Twitter‑Handle, Geburtsdatum, weitere Occupations)
- prüfen, ob es Presse‑Quellen gibt, die als Referenzen für einen Wikipedia‑Artikel taugen
- nach dem Erstellen dein `content/components/head/head.html` automatisch mit der neuen Wikidata‑URL und ggf. der Wikipedia‑URL in `sameAs` ergänzen

Sag Bescheid, wie du fortfahren möchtest.