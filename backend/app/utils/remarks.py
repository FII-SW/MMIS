# backend/app/utils/remarks.py


def clean_remarks(remarks: str | None) -> str | None:
    """User-facing remarks: returns store "REQUEST_TX_ID:<id>|<remarks>" to link back to their request."""
    if not remarks:
        return None
    if remarks.startswith("REQUEST_TX_ID:"):
        _, _, rest = remarks.partition("|")
        return rest.strip() or None
    return remarks
