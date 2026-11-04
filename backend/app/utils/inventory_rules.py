"""Shared inventory rules used across request, restock, and duplicate detection."""

IC_PROGRAMMING_PROJECT = "IC Programming"
IC_PROGRAMMING_LEGACY_NAME = "Hi-Lo"
IC_PROGRAMMING_TEST_AREA = "IC_Programming"
IC_PROGRAMMING_MACHINES = (
    "AT3-310A2",
    "AT3-310A2N",
)

SKIP_TEST_AREA_PROJECTS = frozenset(
    {IC_PROGRAMMING_PROJECT, IC_PROGRAMMING_LEGACY_NAME, "Flying Probe", "Development"}
)

# Keep in sync with frontend src/utils/projects.js DEFAULT_PROJECTS
DEFAULT_PROJECTS = (
    "Astoria",
    "Athena",
    "Turin",
    "Bondi Beach",
    "Development",
    "Zebra Beach",
    "Mandolin Beach",
    "Gulp",
    "Xena",
    "Asahi",
    "Humu Beach",
    "Keysight",
    IC_PROGRAMMING_PROJECT,
    "Flying Probe",
)

DEFAULT_TEST_AREAS = (
    "ICT_Mobo",
    "BSI_Mobo",
    "FBT_Mobo",
    "ICT_Agora",
    "FBT_Agora",
    "TOOLS",
    "ORT",
    "L10_Racks",
    "Golden_Board",
    "3070",
    IC_PROGRAMMING_TEST_AREA,
)


def normalize_project_name(project_name: str | None) -> str | None:
    if project_name is None:
        return None
    name = str(project_name).strip()
    if not name:
        return None
    if name == IC_PROGRAMMING_LEGACY_NAME:
        return IC_PROGRAMMING_PROJECT
    return name


def is_ic_programming_project(project_name: str | None) -> bool:
    name = str(project_name or "").strip()
    return name in (IC_PROGRAMMING_PROJECT, IC_PROGRAMMING_LEGACY_NAME)


def project_requires_test_area(project_name: str | None) -> bool:
    if not project_name or not str(project_name).strip():
        return True
    return str(project_name).strip() not in SKIP_TEST_AREA_PROJECTS


def project_requires_fixture(project_name: str | None) -> bool:
    """IC Programming needs a machine; Development / Flying Probe do not."""
    name = str(project_name or "").strip()
    if not name:
        return False
    if is_ic_programming_project(name):
        return True
    return name not in {"Flying Probe", "Development"}
