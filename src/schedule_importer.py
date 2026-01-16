################################################################################
# Quest Schedule Parser -> JSON store
################################################################################

from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

DATA_STORE = Path(__file__).resolve().parent / "schedule_data.json"
RAW_TEXT_STORE = Path(__file__).resolve().parent / "schedule.txt"

DATE_FORMATS: Sequence[str] = ("%m/%d/%Y", "%d/%m/%Y")
TERM_MONTHS: Dict[str, Sequence[int]] = {
    "winter": (1, 2, 3, 4),
    "spring": (5, 6, 7, 8),
    "fall": (8, 9, 10, 11, 12),
}


def parse_quest_date(value: str, term: Optional[str] = None) -> datetime:
    candidates: List[datetime] = []
    for fmt in DATE_FORMATS:
        try:
            candidates.append(datetime.strptime(value, fmt))
        except ValueError:
            continue
    if not candidates:
        raise ValueError(f"time data '{value}' does not match expected Quest formats")

    if len(candidates) == 1 or not term:
        return candidates[0]

    season = term.split()[0].lower()
    allowed = TERM_MONTHS.get(season)
    if not allowed:
        return candidates[0]

    def score(dt: datetime) -> Tuple[int, int]:
        in_range = 0 if dt.month in allowed else 1
        proximity = min(abs(dt.month - month) for month in allowed)
        return (in_range, proximity)

    return min(candidates, key=score)


def parse_schedule_text(text: str) -> List[Dict[str, Any]]:
    entries: List[Dict[str, Any]] = []

    term_match = re.search(r"(Winter|Spring|Fall)\s+\d{4}", text)
    term = term_match.group(0) if term_match else "Unknown Term"

    course_blocks = re.split(r"\n(?=[A-Z]{2,4}\s\d{3,4}\s-\s)", text)

    day_token = r"(?:M|T|W|Th|F|Sa|Su)+"
    time_token = r"[\d:AMP ]+-[\d:AMP ]+"
    room_token = r"[A-Za-z0-9\- ]+(?:\s-\s[A-Za-z0-9\- ]+)?"

    pattern = re.compile(
        rf"(?P<class_nbr>\d+)\s+(?P<section>\S+)\s+(?P<component>[A-Z]+)\s+"
        rf"(?P<days>{day_token})\s+(?P<time>{time_token})\s+"
        rf"(?P<room>{room_token})\s+"
        r"(?P<instructor>.+?)\s+"
        r"(?P<start>\d{2}/\d{2}/\d{4})\s*-\s*(?P<end>\d{2}/\d{2}/\d{4})"
    )

    partial_pattern = re.compile(
        rf"(?P<days>{day_token})\s+(?P<time>{time_token})\s+"
        rf"(?P<room>{room_token})\s+"
        r"(?P<instructor>.+?)\s+"
        r"(?P<start>\d{2}/\d{2}/\d{4})\s*-\s*(?P<end>\d{2}/\d{2}/\d{4})"
    )

    for block in course_blocks:
        header_match = re.match(r"([A-Z]{2,4}\s\d{3,4})\s-\s(.+)", block.strip())
        if not header_match:
            continue

        course_code, course_name = header_match.groups()
        seen = set()
        contexts: List[Tuple[int, str, str]] = []

        for match in pattern.finditer(block):
            section = match.group("section")
            component = match.group("component")
            contexts.append((match.start(), section, component))

            key = (
                course_code,
                section,
                component,
                match.group("days"),
                match.group("time"),
                match.group("room").strip(),
                match.group("start"),
                match.group("end"),
            )
            if key in seen:
                continue
            seen.add(key)

            start_iso = parse_quest_date(match.group("start"), term).date().isoformat()
            end_iso = parse_quest_date(match.group("end"), term).date().isoformat()

            entries.append({
                "term": term,
                "course_code": course_code,
                "course_name": course_name.strip(),
                "section": section,
                "component": component,
                "days": match.group("days"),
                "time": match.group("time"),
                "room": match.group("room").strip(),
                "instructor": match.group("instructor").strip(),
                "start_date": start_iso,
                "end_date": end_iso,
            })

        contexts.sort()

        for match in partial_pattern.finditer(block):
            context: Optional[Tuple[int, str, str]] = None
            for ctx in reversed(contexts):
                if ctx[0] <= match.start():
                    context = ctx
                    break
            if not context:
                continue

            _, section, component = context
            key = (
                course_code,
                section,
                component,
                match.group("days"),
                match.group("time"),
                match.group("room").strip(),
                match.group("start"),
                match.group("end"),
            )
            if key in seen:
                continue
            seen.add(key)

            start_iso = parse_quest_date(match.group("start"), term).date().isoformat()
            end_iso = parse_quest_date(match.group("end"), term).date().isoformat()

            entries.append({
                "term": term,
                "course_code": course_code,
                "course_name": course_name.strip(),
                "section": section,
                "component": component,
                "days": match.group("days"),
                "time": match.group("time"),
                "room": match.group("room").strip(),
                "instructor": match.group("instructor").strip(),
                "start_date": start_iso,
                "end_date": end_iso,
            })

    return entries


def save_schedule_entries(entries: List[Dict[str, Any]]) -> None:
    DATA_STORE.parent.mkdir(parents=True, exist_ok=True)
    DATA_STORE.write_text(json.dumps(entries, indent=2), encoding="utf-8")


def load_schedule_entries() -> List[Dict[str, Any]]:
    if not DATA_STORE.exists():
        return []
    try:
        data = json.loads(DATA_STORE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    return data if isinstance(data, list) else []


def persist_raw_schedule(text: str) -> None:
    RAW_TEXT_STORE.parent.mkdir(parents=True, exist_ok=True)
    RAW_TEXT_STORE.write_text(text.strip() + "\n", encoding="utf-8")
