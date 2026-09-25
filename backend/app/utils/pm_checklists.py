"""Preventive maintenance checklists per test area family (FBT, ICT)."""

PM_TYPES = ("weekly", "biweekly", "monthly", "quarterly")
PM_INTERVAL_DAYS = {"weekly": 7, "biweekly": 14, "monthly": 30, "quarterly": 90}
# A PM counts as "due soon" once it is within this many days of its due date.
PM_DUE_SOON_DAYS = {"weekly": 2, "biweekly": 3, "monthly": 5, "quarterly": 10}
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


def get_checklist(pm_type: str, test_area: str | None) -> dict | None:
    """Return the checklist for a PM type and test area, or None when not configured."""
    pm_type = (pm_type or "").strip().lower()
    family = _family(test_area)
    config = _CHECKLISTS.get(family, {}).get(pm_type) if family else None
    if not config:
        return None

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
    }
