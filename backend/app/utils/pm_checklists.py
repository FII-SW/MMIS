"""Preventive maintenance checklists per test area family (FBT, ICT).

The lists below are the built-in defaults. A Super Admin can replace one from the
Checklists tab; that copy is stored on pm_checklist_templates and used here.
"""
import json
import re
from copy import deepcopy
from uuid import uuid4

PM_TYPES = ("weekly", "biweekly", "monthly", "quarterly")
PM_INTERVAL_DAYS = {"weekly": 7, "biweekly": 14, "monthly": 30, "quarterly": 90}
# A PM counts as "due soon" once it is within this many days of its due date (see pm_schedule:
# due dates fall on the last day of a work week / month / quarter, so 7 = "due this week").
PM_DUE_SOON_DAYS = {"weekly": 7, "biweekly": 7, "monthly": 7, "quarterly": 14}
# A second record of the same PM type inside this window needs explicit confirmation.
PM_DUPLICATE_WINDOW_HOURS = 12
PM_TYPE_LABELS = {
    "weekly": "Weekly PM",
    "biweekly": "Biweekly PM",
    "monthly": "Monthly PM",
    "quarterly": "Quarterly PM",
}
# Recording the key PM type also completes the listed types
# (the FBT biweekly checklist includes every weekly task).
PM_COVERS = {"biweekly": ("weekly",)}
RESULT_VALUES = ("passed", "failed", "na")
PM_DIVISION = "SMC TEST ENG"

# Asked on checklists with "details": True. Labels are shared by the form, PDF and exports.
MAINTENANCE_TYPES = {"preventive": "Preventive", "corrective": "Corrective"}
MAX_ACTIVATION_COUNTER = 10**12
MAX_DOWNTIME_MINUTES = 7 * 24 * 60

INDYSOFT_NOTE = (
    "Every replacement, performed activity, and PM must be registered in IndySoft "
    "and reported at the end of PMs."
)

_FBT_REQUIRED_SECTION = "Required every week"
_FBT_REQUIRED = [
    ("tim_pad", "Validate TIM PAD presence and good condition"),
    ("liquid_cooler", "Validate level of liquid cooler"),
    ("commodities", "Inspect for commodities missing or damaged"),
]

_FBT_WEEKLY = [
    ("inspect_fixture", "Inspect fixture and commodities for damaged or missing parts"),
    ("dimm_interposer", "Clean and inspect for damaged DIMM interposer"),
    ("pcie_granite_interposer", "Clean and inspect for damaged PCIe & Granite interposer"),
    ("agora_interposer", "Clean and inspect for damaged Agora interposer"),
    ("sata_interposer", "Clean and inspect for damaged SATA interposer"),
    ("plate_vacuum", "Inspect and clean plate with vacuum"),
    ("clean_top", "Clean top of fixture"),
]

_FBT_BIWEEKLY = [
    ("inspect_mechanical", "Inspect fixture, commodities, screws and mechanical parts for damaged or missing parts"),
    ("power_off_air_clean", "Power off fixture, clean with air and validate connections inside top of fixture"),
    ("fan_propellers", "Clean all fan propellers with air"),
    ("bottom_air_clean", "Clean inside bottom of fixture with air and inspect for missing or damaged commodities, mechanical parts, and screws"),
    ("dimm_block", "Remove and clean DIMM block, inspect for damaged DIMM card and interposer"),
    ("pcie_interposer", "Clean PCIe interposer and inspect for damage"),
    ("agora_interposer", "Clean and inspect for damaged Agora interposer"),
    ("sata_interposer", "Clean and inspect for damaged SATA interposer"),
    ("test_probes", "Clean all test probes and inspect for damage"),
    ("clamping_pins", "Clean all clamping pins and inspect for damage"),
    ("power_supply_connection", "Validate power supply connection inside bottom of fixture"),
    ("air_liquid_connections", "Validate air pressure connections and liquid cooler connections"),
    ("plate_vacuum", "Inspect and clean plate with vacuum"),
    ("clean_top", "Clean top of fixture"),
]

_ICT_MONTHLY = [
    ("fans_filters", "10.1.1 Clean fans and filters"),
    ("testhead_inside", "10.1.2 Clean inside of the testhead"),
    ("air_pressure", "10.1.3 Check air pressure"),
    ("system_vacuum", "10.1.4 System cleaning and vacuuming"),
    ("estop", "10.1.5 Check E-stop operation"),
    ("wiring_communication", "10.1.6 Check wiring and communication"),
    ("full_diagnostic", "10.1.7 Run full diagnostic"),
    ("autoadjust", "10.1.8 Run AutoAdjust"),
    ("verification_test", "10.1.9 Run verification test"),
    ("replaced_parts_report", "10.1.10 Send report of replaced parts"),
    ("calibration_label", "10.1.11 Calibration label"),
]

_ICT_NOTE = (
    "Repair, replace and make adjustments as required. List any comments below. "
    "Order and list any replacement parts needed."
)

# Each family: predicate on the test area + checklist config per PM type.
_CHECKLISTS = {
    "FBT": {
        "weekly": {
            "title": "FBT Fixture Weekly PM",
            "description": "FUNCTIONAL BOARD TEST FIXTURE",
            "summary": "Clean superficially, clean plate, validate commodities, and fill out in IndySoft.",
            "reference": None,
            "note": INDYSOFT_NOTE,
            "details": True,
            "sections": [
                (_FBT_REQUIRED_SECTION, _FBT_REQUIRED),
                ("Weekly PM", _FBT_WEEKLY),
            ],
        },
        "biweekly": {
            "title": "FBT Fixture Biweekly PM",
            "description": "FUNCTIONAL BOARD TEST FIXTURE",
            "summary": (
                "Clean each fixture completely with air and vacuum: mechanical parts, actuators, screws, "
                "DIMM block, PCIe block, fans. Fill out in IndySoft."
            ),
            "reference": None,
            "note": INDYSOFT_NOTE,
            "details": True,
            "sections": [
                (_FBT_REQUIRED_SECTION, _FBT_REQUIRED),
                ("Biweekly PM", _FBT_BIWEEKLY),
            ],
        },
    },
    "ICT": {
        "monthly": {
            "title": "Keysight i3070 System PM - Monthly PM",
            "description": "IN CIRCUIT TEST SYSTEM",
            "summary": "In-circuit test system monthly preventive maintenance.",
            "reference": "Follow the instructions in the document: DOC-001523",
            "note": _ICT_NOTE,
            "sections": [("Monthly PM", _ICT_MONTHLY)],
        },
    },
}


PM_TEST_AREA_PREFIXES = tuple(_CHECKLISTS)


def _family(test_area: str | None) -> str | None:
    area = (test_area or "").strip().upper()
    for family in _CHECKLISTS:
        if area.startswith(family):
            return family
    return None


def is_fbt_test_area(test_area: str | None) -> bool:
    return _family(test_area) == "FBT"


def is_ict_test_area(test_area: str | None) -> bool:
    return _family(test_area) == "ICT"


def configured_pm_types() -> set[str]:
    """PM types that have a checklist in at least one test area family."""
    return {pm_type for config in _CHECKLISTS.values() for pm_type in config}


def get_pm_types(test_area: str | None) -> list[str]:
    """PM types configured for a test area, in PM_TYPES order."""
    family = _family(test_area)
    if not family:
        return []
    return [pm_type for pm_type in PM_TYPES if pm_type in _CHECKLISTS[family]]


_ITEM_ID = re.compile(r"^[a-z][a-z0-9_]{0,48}$")


def code_checklist_body(family: str, pm_type: str) -> dict | None:
    """The built-in checklist, in the shape a Super Admin edits."""
    config = _CHECKLISTS.get(family, {}).get(pm_type)
    if not config:
        return None
    return {
        "title": config["title"],
        "description": config.get("description") or "",
        "summary": config["summary"],
        "reference": config.get("reference"),
        "note": config.get("note") or "",
        "sections": [
            {"name": section, "items": [{"id": item_id, "task": task} for item_id, task in tasks]}
            for section, tasks in config["sections"]
        ],
    }


def checklist_item_ids(body: dict) -> set[str]:
    return {item["id"] for section in body.get("sections") or [] for item in section.get("items") or []}


def normalize_checklist_body(body: dict) -> dict:
    """Check a Super Admin edit and return the stored shape. Raises ValueError."""
    if not isinstance(body, dict):
        raise ValueError("Checklist must be an object")

    def text(key, limit, required=False):
        value = str(body.get(key) or "").strip()
        label = key.replace("_", " ").capitalize()
        if required and not value:
            raise ValueError(f"{label} is required")
        if len(value) > limit:
            raise ValueError(f"{label} is too long (max {limit} characters)")
        return value

    title = text("title", 200, required=True)
    description = text("description", 300)
    summary = text("summary", 1000, required=True)
    reference = text("reference", 300) or None
    note = text("note", 2000)
    raw_sections = body.get("sections")
    if not isinstance(raw_sections, list) or not raw_sections:
        raise ValueError("Add at least one section")
    if len(raw_sections) > 20:
        raise ValueError("Too many sections (max 20)")

    sections = []
    seen = set()
    for section in raw_sections:
        if not isinstance(section, dict):
            raise ValueError("Each section needs a name and tasks")
        name = str(section.get("name") or "").strip()
        if not name or len(name) > 80:
            raise ValueError("Each section needs a name (max 80 characters)")
        items_in = section.get("items")
        if not isinstance(items_in, list) or not items_in:
            raise ValueError(f"Section '{name}' needs at least one task")
        items = []
        for item in items_in:
            if not isinstance(item, dict):
                raise ValueError(f"Section '{name}' has an empty task")
            task = str(item.get("task") or "").strip()
            if not task or len(task) > 500:
                raise ValueError("Each task needs text (max 500 characters)")
            item_id = str(item.get("id") or "").strip().lower().replace(" ", "_").replace("-", "_")
            if not item_id:
                item_id = f"task_{uuid4().hex[:8]}"
            if not _ITEM_ID.match(item_id):
                raise ValueError(f"Task id '{item_id}' must be lowercase letters, numbers and underscores")
            if item_id in seen:
                raise ValueError(f"Task id '{item_id}' is used more than once")
            seen.add(item_id)
            items.append({"id": item_id, "task": task})
        sections.append({"name": name, "items": items})
    if len(seen) > 80:
        raise ValueError("Too many tasks (max 80)")
    return {
        "title": title,
        "description": description,
        "summary": summary,
        "reference": reference,
        "note": note,
        "sections": sections,
    }


def _saved_body(db, family: str, pm_type: str) -> dict | None:
    if db is None:
        return None
    from .. import models

    row = (
        db.query(models.PMChecklistTemplate)
        .filter(
            models.PMChecklistTemplate.family == family,
            models.PMChecklistTemplate.pm_type == pm_type,
        )
        .first()
    )
    if row is None or not row.body:
        return None
    try:
        saved = json.loads(row.body)
    except ValueError:
        return None
    return saved if isinstance(saved, dict) else None


def _apply_saved(config: dict, saved: dict) -> dict:
    config = deepcopy(config)
    for key in ("title", "description", "summary", "reference", "note"):
        if key in saved and saved[key] is not None:
            config[key] = saved[key]
    sections = []
    for section in saved.get("sections") or []:
        tasks = [(item["id"], item["task"]) for item in section.get("items") or [] if item.get("id")]
        if tasks:
            sections.append((section.get("name") or "Tasks", tasks))
    if sections:
        config["sections"] = sections
    return config


def get_checklist(pm_type: str, test_area: str | None, db=None) -> dict | None:
    """Return the checklist for a PM type and test area, or None when not configured."""
    pm_type = (pm_type or "").strip().lower()
    family = _family(test_area)
    config = _CHECKLISTS.get(family, {}).get(pm_type) if family else None
    if not config:
        return None
    saved = _saved_body(db, family, pm_type)
    if saved:
        config = _apply_saved(config, saved)

    items = [
        {"id": item_id, "section": section, "task": task}
        for section, tasks in config["sections"]
        for item_id, task in tasks
    ]

    return {
        "pm_type": pm_type,
        "label": PM_TYPE_LABELS[pm_type],
        "title": config["title"],
        "description": config.get("description"),
        "summary": config["summary"],
        "reference": config["reference"],
        "note": config["note"],
        "indysoft_note": INDYSOFT_NOTE,
        "interval_days": PM_INTERVAL_DAYS[pm_type],
        "items": items,
        # Maintenance type, activation counter, commodity replacement and downtime are required.
        "requires_details": bool(config.get("details")),
        "maintenance_types": [{"value": k, "label": v} for k, v in MAINTENANCE_TYPES.items()],
    }
