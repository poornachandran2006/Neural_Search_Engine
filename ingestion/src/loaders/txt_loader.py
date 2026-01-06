# ingestion/src/loaders/txt_loader.py

from pathlib import Path
from typing import Dict


class TxtLoader:
    """
    Loader for plain text (.txt) files
    """

    def load(self, file_path: str) -> Dict:
        """
        Load a TXT file and return text with metadata

        :param file_path: path to .txt file
        :return: dict with 'text' and 'metadata'
        """
        path = Path(file_path)

        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        if path.suffix.lower() != ".txt":
            raise ValueError("TxtLoader supports only .txt files")

        try:
            with open(path, "r", encoding="utf-8") as f:
                text = f.read()
        except UnicodeDecodeError:
            # fallback encoding
            with open(path, "r", encoding="latin-1") as f:
                text = f.read()

        return {
            "text": text,
            "metadata": {
                "source": "txt",
                "file_name": path.name,
                "file_path": str(path.resolve()),
            },
        }
