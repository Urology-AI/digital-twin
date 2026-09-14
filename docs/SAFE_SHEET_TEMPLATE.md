# Safe sheet — template notes for COMPASS parsing

COMPASS parses a pasted safe sheet in the browser: no upload, no server, and
identifiers are removed before anything reads the text. The parser is
deterministic, so how the sheet is written decides how much it can pull out.

This is what the parser expects, and the one change worth making to the sheet.

## The one gap: prostate volume

The current sheet has **no field for prostate volume**. It is not a parsing
failure — the value simply is not on the page.

Without it COMPASS cannot compute PSA density and falls back to a 45 cc
default. PSAD is an input to several models, so a real 52 cc gland scored
against an assumed 45 cc shifts the numbers for no reason a reader can see.

Adding one cell fixes it:

```
Prostate volume        52 cc
```

`Volume`, `Vol`, `PV`, with or without `cc`/`mL`, all parse. Putting it on the
MRI row (`MRI  <date>  52 cc  PI-RADS 5 …`) also works, since that is usually
where the measurement comes from.

## What already parses

| Row | Written as | Notes |
|---|---|---|
| `Patient` | `BMI: 29.1  SMITH, JOHN 64  MRN …  DOB …` | Age is taken as the lone 18–110 number left after identifiers are stripped. Two candidates and it is left blank rather than guessed. |
| `PSA` | `11.4   SHIM 18   Left: 2   Right: 3` | `Left`/`Right` are read as the surgeon's **expected** nerve-sparing grade (1–3). |
| `Biopsy` | `7/14   Gleason 4+3 (GG3) right base posterolateral 65%` | A bare `7/14` is read as positive/total cores. |
| `MRI` | `PI-RADS 5 right posterolateral PZ mid to base, 1.8cm, ADC 620` | `mid to base` becomes one lesion per level. |
| `MUS` | `PRI-MUS 5 right mid posterolateral; PRI-MUS 3 left apex` | Semicolons separate findings. |
| `PSMA` | `SUVmax 14.2 right mid gland` | |

Spelling is normalised, so `PI-RADS`/`PIRADS`, `PRI-MUS`/`PRIMUS`,
`SUVmax`/`SUV` and spelled-out `posterolateral` all work.

## Rows COMPASS ignores

`ASA`, `DVT Risk`, `Research consent`, `Trans operative care`,
`Additional Images`, `Discrepancy`, `Abdominal wall`, `UA/UCx`,
`Type of surgery`, `LNs on PSMA`.

These are recorded for other purposes and have no model input to land in. They
are ignored deliberately rather than captured into fields that do not exist.

## What gets removed before parsing

Patient name, MRN, DOB, date of surgery, all study dates, accession numbers,
phone, email, SSN, and any remaining 6+ digit run — removed **in the browser**,
before the text is parsed, stored, or sent anywhere. The import screen reports
what it took out.

This is best-effort, not a compliance guarantee: an unlabelled name in free
text can survive, which is why the scrubbed values are shown for review before
anything is applied.

## Writing tips

- Keep one finding per cell, or separate them with `;`.
- Give a side and a level (`right mid`, `left apex`) — a finding with neither is
  dropped, because it cannot be placed on the map.
- State negatives explicitly (`No SVI`, `No IDC`). An explicit negative beats
  anything inferred elsewhere.
- Do not reformat the row labels. The label is what scopes the value: `64` on
  the `Patient` row is an age, the same digits elsewhere are not.
