# LIVLO — Luxury Inspired Living

The direct-booking site for **Palmasis Oasis** (Palm Coast, Florida) and
**Rivertrail Retreat** (Kitchener, Ontario) — two privately owned homes, booked directly
with the owner rather than through a platform.

Static, three pages, no framework and no build step. Open `index.html` and it runs.

```
index.html                 home
palmasis.html              property
rivertrail.html            property
assets/site.css            the whole design system
assets/site.js             nav, reveals, lightbox, calendar, forms
assets/availability.json   which nights are free  ← regenerate this
refresh-availability.py    regenerates the above
photos/                    108 photographs, unaltered
```

`CLAUDE.md` and `_v1-archive/` exist on the working machine but are deliberately not in
this repository — the first is a private working note, the second is the superseded build.

## The design

**The palette is sampled from the LIVLO key**, which runs `#67D0D6` at the bow down to
`#3F5882` at the tip.

| token | value | used for |
|---|---|---|
| `--bone` | `#F4F1EA` | the default ground |
| `--ink` | `#15171B` | type; the darkest band |
| `--deep` | `#33506F` | brand blue — reviews, "why book direct" |
| `--teal` | `#67D0D6` | accents on dark ground, stars, eyebrows |
| `--clay` | `#2C6C79` | deep teal — accent text on light ground |
| `--wash` / `--wash-warm` | `#EAEEEF` / `#EFEBE3` | tinted panels |

Sections alternate grounds — bone, tinted wash, deep blue — so the page reads as chapters
rather than one long scroll. Every pairing was measured; the lowest contrast ratio
anywhere on the site is **4.6:1**, above the 4.5 AA threshold.

**Type.** Cormorant Garamond for anything that carries weight; Jost, light, for
everything functional. Eyebrow labels are tracked to `.22em`.

**Space.** Sections run `clamp(64px, 7.5vw, 116px)` top and bottom — open, but not
cavernous. Content caps at 1280px.

**Motion.** Deliberately just below the threshold of notice: an 1100ms rise on reveal,
a 2600ms scale settle on hero images, headline letter-spacing that closes from `.1em`
to normal, hairline rules that draw in from the left. Everything collapses to nothing
under `prefers-reduced-motion`.

## The photographs

All 108 come from the two live Airbnb listings, downloaded at their `/original/` URLs
and served locally. **No file has been resized, cropped, recoloured or retouched** —
they are byte-for-byte what Airbnb serves. They arrive at 1200px, which is already a
sensible web size, so nothing needed doing.

Ordering and room grouping are Airbnb's own (pulled from the listing's photo-tour data),
so the sequence you curated there is the sequence here. Where you wrote a real caption it
appears under the photograph in italic; where the label was auto-generated
("Living room image 6") nothing is shown.

The one overlay anywhere is the gradient scrim behind hero headlines. That is a UI layer
sitting *above* the photograph so white type stays legible — the file underneath is
untouched.

## The site never names the platform

This is a direct-booking site, so **no page mentions Airbnb, or any other platform, by
name.** Sending a visitor off to go and look up the listing defeats the entire point.
That rule covers headings, the review counts, the calendar stamp, meta descriptions and
the guest-tenure badges. Keep it that way when you edit.

Where the wording used to lean on the platform, it now stands on its own:

| was | now |
|---|---|
| "59 reviews on Airbnb" | "59 guest reviews" |
| "reviews left on Airbnb, reproduced as written" | "reviews guests have left, lightly condensed but never softened" |
| "Availability as shown on Airbnb on …" | "Availability as of …" |
| "rated in the top ten percent on Airbnb" | "kept to the same standard" |
| "Airbnb adds its cut at checkout" | "Booking platforms take their cut at checkout" |
| "Three years hosting, Superhost throughout" | "Three years of hosting" |
| "8 years on Airbnb · Stayed with kids" | "Stayed with kids" |

The `refresh-availability.py` script and this README still name it, because they have to —
a maintenance doc that cannot say where the data comes from is useless. Nothing a visitor
sees does.

## What is honest about the content

- **Reviews are real**, including the critical ones — Jason's four-star about the snake in
  the pool and the boat on the dock, Stacey's "numerous issues", Channing's four-star.
  Nothing was filtered.
- **They are lightly condensed, not verbatim.** Long reviews were trimmed for length, and
  in four of them the platform's name was swapped for a neutral word ("this is the best
  Airbnb we have stayed in" → "…the best place we have stayed in"). The sense of every
  sentence is unchanged, but they are not word-for-word transcripts and the page no longer
  claims they are. If you would rather those four ran exactly as written, drop them
  instead — they are Dustin's, Melissa's, Krista's and Anna's.
- **24 reviews are shown per property**, out of 59 and 158. The rest sit behind a paginated
  API that resisted scripted extraction. The overall ratings, the star distribution and the
  category scores are the real published figures.
- **The "Local Perks Passport" from v1 is gone.** It described negotiated discounts with
  local businesses that do not exist yet. Put it back the moment they do.

## The availability calendar — read this bit

Each property page carries a calendar of which nights are free. Taken nights are struck
through; choosing an arrival and a departure carries the dates down into the enquiry form.
A stay that would span a taken night is refused outright, so nobody can enquire about
something that was never available.

**It is a dated snapshot, not a live feed.** The browser cannot query Airbnb directly —
Airbnb sends no CORS headers, so a static page is blocked from reading it. The data
therefore lives in `assets/availability.json` and the page prints the date it was taken:

> *Availability as shown on Airbnb on 23 August 2026. Dates are confirmed by reply — a
> night marked free here may have gone since.*

That sentence is doing real work. Leave it in.

### Keeping it current

```bash
cd "/Users/pavly/Desktop/AirBnB Website"
python3 refresh-availability.py
```

Run it whenever you take or cancel a booking. Or let it run itself every morning:

```bash
crontab -e
# then add:
0 6 * * * cd "/Users/pavly/Desktop/AirBnB Website" && /usr/bin/python3 refresh-availability.py
```

Current snapshot: **141 nights free at Palmasis, 85 at Rivertrail**, over twelve months.

### Two sources, and why you may want to switch

By default the script reads Airbnb's own listing endpoint. It works with no setup, but it
is undocumented — if Airbnb changes it, it stops.

The durable route is Airbnb's **iCal export**, which is a supported feature:

> Airbnb → Listings → *[listing]* → Availability → Connect to another website
> → Export calendar → copy the `.ics` link

```bash
python3 refresh-availability.py \
  --ical palmasis=https://www.airbnb.ca/calendar/ical/XXXX.ics \
  --ical rivertrail=https://www.airbnb.ca/calendar/ical/YYYY.ics
```

iCal is also the answer if you ever list on Vrbo or Booking.com too — pass several
`--ical` flags for the same house and the busy dates get merged, so the site reflects
every channel at once. The parser honours the exclusive-`DTEND` rule, so a booking that
ends on the 12th leaves the 12th free for the next guest.

If a fetch fails, the script keeps the previous data for that house rather than blanking
the calendar. If the JSON is missing entirely, the page quietly replaces the calendar with
a line asking the guest to send dates instead — it never shows an empty or invented one.

## Forms

Both the enquiry form and the guest-review form build a pre-filled `mailto:` to
**pavly.samuel@gmail.com**. Nothing sends itself, and no payment is taken anywhere on
the site.

This means **guest reviews do not appear on the page automatically** — they land in your
inbox and you add them by hand. That is stated plainly on the page. If you want them to
publish themselves you need a backend; Formspree or a small Netlify/Cloudflare function
would do it without much work.

## Verified

- No contrast failures across all three pages (244 text nodes measured against WCAG AA)
- Every form control labelled, every image has alt text, one `h1` per page, no heading skips
- No horizontal scroll at 375px; layout ladder checked at 375 / 560 / 768 / 1024 / 1280 / 1440
- Lightbox: click, arrow keys, Escape, focus return, focus trap, neighbour preloading
- Calendar: real data both houses, taken nights struck and non-selectable, ranges spanning
  a taken night refused, minimum-night rules enforced, month bounds respected at both ends,
  arrow-key navigation, every touch target ≥ 44px
- The iCal parser is unit-tested for exclusive `DTEND`, single-night stays and folded lines
- No calls to any third party at runtime — the only external hosts are Google Fonts
- 54 of 56 images lazy-loaded per property page (hero eager, as it should be)

## Still worth doing

1. A real domain and hosting (any static host — Netlify, Cloudflare Pages, GitHub Pages).
   Whichever you pick, run `refresh-availability.py` as part of the deploy so the calendar
   is never shipped stale.
2. Switch the calendar to the iCal source above — it is the supported route and it covers
   other channels if you ever list beyond Airbnb.
3. A backend for guest reviews, if you want them self-publishing.
4. Instant booking, if enquiry-by-email ever becomes the bottleneck. Lodgify / OwnerRez /
   Hospitable embed a real booking engine with payments; that is the point at which this
   stops being a static site.
5. Rivertrail has no exterior or street-view photograph in the listing set — worth shooting.
