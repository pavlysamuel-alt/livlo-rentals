#!/usr/bin/env python3
"""
Refresh the availability shown on the site.

    python3 refresh-availability.py                 # both houses, 12 months
    python3 refresh-availability.py --months 6
    python3 refresh-availability.py --ical palmasis=https://www.airbnb.ca/calendar/ical/....ics

Writes assets/availability.json, stamped with the date it ran.

TWO SOURCES
-----------
1. Airbnb's public listing endpoint (the default). Works today with no setup, but it is
   undocumented — if Airbnb changes it, this stops working and you fall back to iCal.

2. Airbnb's iCal export (--ical). The supported route, and the one that will not break.
   Get the URL per listing:
       Airbnb → Listings → [listing] → Availability → Connect to another website
       → Export calendar → copy the .ics link
   iCal is also what you want if you ever list on Vrbo or Booking.com as well, since you
   can pass several --ical flags and the busy dates get merged.

The site never shows availability as a promise: the page carries the date this ran and
tells guests dates are confirmed by reply. Re-run it whenever you take a booking, or put
it on a cron:

    0 6 * * *  cd "/Users/pavly/Desktop/AirBnB Website" && /usr/bin/python3 refresh-availability.py
"""
import argparse, datetime, json, os, ssl, subprocess, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "assets", "availability.json")

LISTINGS = {
    "palmasis":   {"name": "Palmasis Oasis",     "id": "1188057205246740022"},
    "rivertrail": {"name": "Rivertrail Retreat", "id": "831090064437671051"},
}
API_KEY = "d306zoyjsyarp7ifhu67rjxn52tv0t20"   # the key Airbnb ships in its own page
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")


def get(url, headers=None):
    """curl, because the system Python here has no CA bundle configured."""
    cmd = ["curl", "-s", "--fail", "-A", UA]
    for k, v in (headers or {}).items():
        cmd += ["-H", f"{k}: {v}"]
    cmd.append(url)
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(f"fetch failed ({r.returncode}) for {url[:80]}")
    return r.stdout.decode("utf-8", "replace")


def from_api(listing_id, months):
    """Per-day availability straight from the listing."""
    today = datetime.date.today()
    url = ("https://www.airbnb.ca/api/v2/homes_pdp_availability_calendar"
           f"?key={API_KEY}&currency=CAD&locale=en&listing_id={listing_id}"
           f"&month={today.month}&year={today.year}&count={months}")
    data = json.loads(get(url, {"X-Airbnb-Api-Key": API_KEY}))
    available, min_nights = [], {}
    for m in data.get("calendar_months", []):
        for d in m.get("days", []):
            if d.get("available"):
                available.append(d["date"])
                n = d.get("min_nights") or 1
                if n > 1:
                    min_nights[d["date"]] = n
    return available, min_nights


def parse_ics(text):
    """Return the set of busy dates from a VEVENT calendar.

    iCal DTEND is exclusive: a booking 10th->12th occupies the 10th and 11th, and the
    12th is free for the next guest to check in. We honour that.
    """
    busy, start, end = set(), None, None
    # unfold folded lines first (RFC 5545: a leading space continues the previous line)
    text = text.replace("\r\n ", "").replace("\n ", "").replace("\r\n", "\n")
    for line in text.split("\n"):
        key = line.split(":", 1)[0].split(";", 1)[0].upper()
        val = line.split(":", 1)[1].strip() if ":" in line else ""
        if line.upper().startswith("BEGIN:VEVENT"):
            start = end = None
        elif key == "DTSTART":
            start = val[:8]
        elif key == "DTEND":
            end = val[:8]
        elif line.upper().startswith("END:VEVENT") and start:
            try:
                a = datetime.datetime.strptime(start, "%Y%m%d").date()
                b = datetime.datetime.strptime(end, "%Y%m%d").date() if end else a + datetime.timedelta(days=1)
            except ValueError:
                start = end = None
                continue
            while a < b:
                busy.add(a.isoformat())
                a += datetime.timedelta(days=1)
            start = end = None
    return busy


def from_ical(urls, months):
    """Everything not marked busy across all feeds is treated as free."""
    busy = set()
    for u in urls:
        busy |= parse_ics(get(u))
    today = datetime.date.today()
    horizon = today + datetime.timedelta(days=31 * months)
    available, day = [], today
    while day < horizon:
        if day.isoformat() not in busy:
            available.append(day.isoformat())
        day += datetime.timedelta(days=1)
    return available, {}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--months", type=int, default=12)
    ap.add_argument("--ical", action="append", default=[],
                    help="key=URL (repeatable; several feeds per house are merged)")
    args = ap.parse_args()

    icals = {}
    for spec in args.ical:
        if "=" not in spec:
            sys.exit(f"--ical needs key=URL, got: {spec}")
        k, u = spec.split("=", 1)
        if k not in LISTINGS:
            sys.exit(f"unknown house '{k}' — expected one of {', '.join(LISTINGS)}")
        icals.setdefault(k, []).append(u)

    out = {"fetched": datetime.date.today().isoformat(), "months": args.months, "properties": {}}
    failed = []
    for key, meta in LISTINGS.items():
        try:
            if key in icals:
                avail, mins = from_ical(icals[key], args.months)
                source = "ical"
            else:
                avail, mins = from_api(meta["id"], args.months)
                source = "airbnb-api"
            out["properties"][key] = {
                "name": meta["name"], "source": source,
                "available": avail, "minNights": mins,
            }
            print(f"  {meta['name']:<20} {len(avail):>4} nights open   (via {source})")
        except Exception as exc:
            failed.append(f"{meta['name']}: {exc}")
            print(f"  {meta['name']:<20} FAILED — {exc}")

    if not out["properties"]:
        sys.exit("\nNothing fetched; leaving the existing availability.json untouched.")
    if failed:
        # keep whatever we already had for the house that failed, rather than dropping it
        if os.path.exists(OUT):
            prev = json.load(open(OUT)).get("properties", {})
            for k, v in prev.items():
                out["properties"].setdefault(k, v)
            print("\n  (kept the previous data for the house that failed)")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"\nWrote {os.path.relpath(OUT, HERE)} — {os.path.getsize(OUT)/1024:.1f} KB, dated {out['fetched']}")


if __name__ == "__main__":
    main()
