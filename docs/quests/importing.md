# Importing quests

Quest definitions are imported from JSON manifests. Imports are dry runs by default, safely repeatable, and never delete items or modify claims, submissions, approvals, or review history.

```sh
npm run quest:import -- --config config/quests/virtual-road-trip.json
npm run quest:import -- --config config/quests/virtual-road-trip.json --write
```

Add `--prod` to target the production database. Both production access and writes must be requested explicitly. Existing quest statuses are preserved; add `--sync-status` when an intentional lifecycle change in the manifest should be applied.

## Manifest format

Paths in `itemsFile` are relative to the manifest. Badge paths are site paths and must identify an existing SVG under `public/assets/img/quests/`.

```json
{
  "slug": "virtual-road-trip",
  "type": "set",
  "status": "draft",
  "name_i18n": { "en": "Virtual road trip" },
  "description_i18n": { "en": "Visit every county." },
  "instructions_i18n": { "en": "Write a post about the selected county." },
  "administratorUsername": "admin",
  "allowedRoomIds": ["united-states"],
  "defaultRoomId": "united-states",
  "badgeAssetPath": "/assets/img/quests/virtual-road-trip.svg",
  "acceptingSubmissionsAfterCompletion": false,
  "reservationDurationHours": 168,
  "medalThresholds": { "bronze": 0.25, "silver": 0.5, "gold": 0.75 },
  "itemsFile": "virtual-road-trip-items.json"
}
```

Count quests use `"type": "count"` and a positive `targetCount`, and omit `itemsFile`. Set-quest item files are arrays. A string generates a stable key from its label; an object can specify the key and translations explicitly:

```json
[
  "Tioga, PA",
  {
    "key": "centre-pa",
    "label": "Centre, PA",
    "label_i18n": { "en": "Centre, PA" }
  }
]
```

Re-importing may update an existing item's label and supplied translations. Omitting an existing item does not deactivate or delete it; item retirement should be a separate, deliberate operation.
