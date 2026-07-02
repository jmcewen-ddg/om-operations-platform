"""
TSV -> CSV converter for GitHub Projects view exports.
Opens a file picker, converts the selected .tsv to .csv,
and prints the column list so you can see what fields came through.
"""

import pandas as pd
import tkinter as tk
from tkinter import filedialog, messagebox
from pathlib import Path


def main():
    # Hide the root tkinter window - we only want the dialog
    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)  # make sure dialog comes to the front

    # Open file picker - filter for .tsv files but allow all
    tsv_path = filedialog.askopenfilename(
        title="Select the GitHub Projects TSV export",
        filetypes=[
            ("TSV files", "*.tsv"),
            ("Text files", "*.txt"),
            ("All files", "*.*"),
        ],
    )

    if not tsv_path:
        print("No file selected. Exiting.")
        return

    tsv_path = Path(tsv_path)
    csv_path = tsv_path.with_suffix(".csv")

    try:
        df = pd.read_csv(tsv_path, sep="\t")
    except Exception as e:
        messagebox.showerror("Read error", f"Could not read {tsv_path.name}:\n\n{e}")
        return

    try:
        df.to_csv(csv_path, index=False, encoding="utf-8")
    except Exception as e:
        messagebox.showerror("Write error", f"Could not write {csv_path.name}:\n\n{e}")
        return

    # Report back
    cols = df.columns.tolist()
    print(f"Converted: {tsv_path}")
    print(f"     -> :  {csv_path}")
    print(f"Rows:      {len(df)}")
    print(f"Columns:   {cols}")

    messagebox.showinfo(
        "Done",
        f"Converted {len(df)} rows.\n\n"
        f"Saved to:\n{csv_path}\n\n"
        f"Columns ({len(cols)}):\n" + "\n".join(f"  - {c}" for c in cols),
    )


if __name__ == "__main__":
    main()