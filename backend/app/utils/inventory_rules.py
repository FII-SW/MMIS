"""Shared inventory rules used across request, restock, and duplicate detection."""

SKIP_TEST_AREA_PROJECTS = frozenset({"Hi-Lo", "Flying Probe", "Development"})

DEFAULT_TEST_AREAS = (
    "ICT_Mobo",
    "BSI_Mobo",
    "FBT_Mobo",
    "ICT_Agora",
    "FBT_Agora",
    "TOOLS",
    "ORT",
    "L10_Racks",
)


def project_requires_test_area(project_name: str | None) -> bool:
    if not project_name or not str(project_name).strip():
        return True
    return str(project_name).strip() not in SKIP_TEST_AREA_PROJECTS
