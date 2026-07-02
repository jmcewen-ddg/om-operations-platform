"""
Push sprint_backlog.csv as Draft items into a GitHub ProjectV2 board.

Usage:
    python push_backlog_to_github.py                  # opens file picker
    python push_backlog_to_github.py path\to\file.csv # uses the given path

Idempotent: skips items whose Title already exists on the board.

CSV template available at: /workspaces/om-operations-platform/OM_Platform_ProjectItem_Template.csv
"""
import csv
import sys
from pathlib import Path

# Local helper module in \\ddg-gis-fs\GIS-MANAGEMENT\Scripts\Python\Library
sys.path.insert(0, r"\\ddg-gis-fs\GIS-MANAGEMENT\Scripts\Python\Library")
from ddg_github_helpers import (
    get_user_project, get_existing_draft_titles, add_draft,
    set_single_select, set_text, set_number, set_iteration,
)

# ----------------------------------------------------------------------
# CONFIG
# ----------------------------------------------------------------------
import os
# use an environmental variable to store the pw
PUSH_PAT = os.environ["PUSH_PAT"]  # fine-grained PAT, project + repo scope
# add githubt user account name.
OWNER   = "OWNER"  # personal account login
PROJECT_NUMBER = 2

# Field name on the board -> CSV column. Adjust if names differ.
FIELD_MAP = {
    "Status":   "Status",
    "Area":     "Area",
    "Priority": "Priority",
    "Estimate": "Estimate",
    "Sprint":   "Sprint",
}
# ----------------------------------------------------------------------


def pick_csv_path() -> Path:
    """Resolve the CSV path to load.

    Order of precedence:
      1. Command-line argument (sys.argv[1])
      2. Native file-picker dialog (tkinter)
    Exits the script if neither is provided.
    """
    # 1) CLI arg wins
    if len(sys.argv) > 1:
        p = Path(sys.argv[1]).expanduser().resolve()
        if not p.is_file():
            sys.exit(f"ERROR: file not found: {p}")
        print(f"Using CSV from CLI arg: {p}")
        return p

    # 2) GUI file picker
    try:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()                    # hide the empty root window
        root.attributes("-topmost", True)  # force dialog to the front

        picked = filedialog.askopenfilename(
            title="Select backlog CSV to push to GitHub Project",
            initialdir=str(Path.home() / "Desktop"),
            filetypes=[("CSV files", "*.csv"), ("All files", "*.*")],
        )
        root.destroy()
    except Exception as e:
        sys.exit(f"ERROR: file picker unavailable ({e}); pass a path as an argument instead.")

    if not picked:
        sys.exit("No file selected. Exiting.")

    p = Path(picked).resolve()
    print(f"Using CSV from picker: {p}")
    return p


# ----------------------------------------------------------------------


def main(csv_path: Path):
    print(f"Loading project #{PROJECT_NUMBER} for {GITHUB_OWNER}...")
    proj = get_user_project(GITHUB_PAT, GITHUB_OWNER, PROJECT_NUMBER)
    print(f"  Project: {proj['title']}  ({proj['id']})")
    print(f"  Fields available: {list(proj['fields'].keys())}")

    print("Fetching existing item titles for dedupe...")
    existing = get_existing_draft_titles(GITHUB_PAT, proj["id"])
    print(f"  {len(existing)} existing items on board")

    with csv_path.open("r", encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    created = skipped = failed = 0
    for i, row in enumerate(rows, 1):
        title = (row.get("Title") or "").strip()
        if not title:
            continue
        if title.lower() in existing:
            print(f"  [{i:3d}/{len(rows)}] SKIP (exists): {title[:70]}")
            skipped += 1
            continue

        body = (row.get("Body") or "").strip()
        try:
            item_id = add_draft(GITHUB_PAT, proj["id"], title, body)
        except Exception as e:
            print(f"  [{i:3d}/{len(rows)}] FAIL add_draft: {title[:60]} -> {e}")
            failed += 1
            continue

        # Set each mapped field
        for field_name, csv_col in FIELD_MAP.items():
            val = (row.get(csv_col) or "").strip()
            if not val:
                continue
            field = proj["fields"].get(field_name)
            if not field:
                print(f"        WARN: field '{field_name}' not on board, skipping")
                continue
            try:
                dtype = field["dataType"]
                if dtype == "SINGLE_SELECT":
                    opt_id = field.get("options", {}).get(val)
                    if not opt_id:
                        print(f"        WARN: '{field_name}' has no option '{val}'  "
                              f"(known: {list(field.get('options', {}).keys())})")
                        continue
                    set_single_select(GITHUB_PAT, proj["id"], item_id, field["id"], opt_id)
                elif dtype == "TEXT":
                    set_text(GITHUB_PAT, proj["id"], item_id, field["id"], val)
                elif dtype == "NUMBER":
                    set_number(GITHUB_PAT, proj["id"], item_id, field["id"], float(val))
                elif dtype == "ITERATION":
                    it_id = field.get("iterations", {}).get(val)
                    if not it_id:
                        print(f"        WARN: '{field_name}' has no iteration '{val}'")
                        continue
                    set_iteration(GITHUB_PAT, proj["id"], item_id, field["id"], it_id)
                else:
                    print(f"        WARN: unsupported dataType {dtype} for {field_name}")
            except Exception as e:
                print(f"        FAIL set {field_name}={val}: {e}")

        print(f"  [{i:3d}/{len(rows)}] OK: {title[:70]}")
        created += 1
        existing.add(title.lower())

    print("\n----- Summary -----")
    print(f"  Created: {created}")
    print(f"  Skipped: {skipped}")
    print(f"  Failed : {failed}")


if __name__ == "__main__":
    csv_path = pick_csv_path()
    main(csv_path)
