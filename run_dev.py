#!/usr/bin/env python3
"""Launch the Flask backend and React frontend together (cross-platform).

Usage:
    python run_dev.py

Stop with Ctrl+C; the script will terminate both child processes.
"""

from __future__ import annotations

import os
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

def load_dotenv(dotenv_path: Path) -> None:
    if not dotenv_path.exists():
        return

    for raw_line in dotenv_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())

ROOT = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT / "frontend"
BACKEND_CMD = [sys.executable, "src/shortestPath.py"]
NPM_BIN = shutil.which("npm.cmd" if os.name == "nt" else "npm")


def main() -> int:
    load_dotenv(ROOT / ".env")

    if NPM_BIN is None:
        print("npm is required but was not found in PATH.", file=sys.stderr)
        return 1

    processes: list[subprocess.Popen] = []

    try:
        print("Starting Flask backend (python src/shortestPath.py)…")
        backend_proc = subprocess.Popen(BACKEND_CMD, cwd=ROOT)
        processes.append(backend_proc)

        time.sleep(1)  # simple delay so backend log appears first

        print("Starting React frontend (npm run dev)…")
        frontend_proc = subprocess.Popen(
            [NPM_BIN, "run", "dev"], cwd=FRONTEND_DIR
        )
        processes.append(frontend_proc)

        # Monitor both processes until one exits or user interrupts.
        while True:
            time.sleep(0.5)
            for proc in processes:
                if proc.poll() is not None:
                    print("One of the processes exited. Stopping both…")
                    return 0
    except KeyboardInterrupt:
        print("\nReceived Ctrl+C. Stopping…")
        return 0
    finally:
        for proc in processes:
            if proc.poll() is None:
                if os.name == "nt":
                    proc.terminate()
                else:
                    proc.send_signal(signal.SIGTERM)
        for proc in processes:
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()


if __name__ == "__main__":
    sys.exit(main())
