#!/usr/bin/env python3
from __future__ import annotations

import argparse
import socket
import sys
import time
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_ROOT = PROJECT_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


from app import create_app  # noqa: E402
from app.services.shelf_analysis_jobs import (  # noqa: E402
    claim_next_shelf_analysis_job,
    process_shelf_analysis_job,
)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Poll and process queued shelf-analysis jobs.")
    parser.add_argument(
        "--poll-interval",
        type=float,
        default=5.0,
        help="Seconds to wait between polls when the queue is empty.",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Process at most one queued job and then exit.",
    )
    parser.add_argument(
        "--worker-id",
        default=f"{socket.gethostname()}-arc-worker",
        help="Identifier stored on claimed jobs.",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    app = create_app()

    print(f"Starting shelf-analysis worker `{args.worker_id}`")
    print(f"Polling interval: {args.poll_interval:.1f}s")
    print(f"Mode: {'single-job' if args.once else 'continuous'}")

    with app.app_context():
        while True:
            job = claim_next_shelf_analysis_job(worker_id=args.worker_id)
            if job is None:
                if args.once:
                    print("No queued jobs found.")
                    return 0

                time.sleep(args.poll_interval)
                continue

            print(f"Claimed job {job.job_id} ({job.original_filename or 'unnamed upload'})")
            try:
                process_shelf_analysis_job(job.job_id, worker_id=args.worker_id)
                print(f"Completed job {job.job_id}")
            except Exception as error:  # noqa: BLE001
                print(f"Failed job {job.job_id}: {error}", file=sys.stderr)

            if args.once:
                return 0


if __name__ == "__main__":
    raise SystemExit(main())
