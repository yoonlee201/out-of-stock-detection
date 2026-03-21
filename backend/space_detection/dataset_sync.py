from __future__ import annotations

import argparse
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence


def _require_hf_hub():
    try:
        from huggingface_hub import HfApi, snapshot_download
    except ImportError as exc:
        raise SystemExit(
            "Missing dependency: huggingface_hub. Install with `pip install huggingface_hub`."
        ) from exc

    return HfApi, snapshot_download


def _validate_dataset_root(dataset_root: Path) -> None:
    data_yaml = dataset_root / "data.yaml"
    if not data_yaml.exists():
        raise SystemExit(f"{dataset_root} is missing data.yaml")


def upload_to_hf(
    repo_id: str,
    source: Path,
    token: str | None,
    private: bool,
    path_in_repo: str,
    commit_message: str,
) -> None:
    HfApi, _ = _require_hf_hub()

    source = source.resolve()
    if not source.exists() or not source.is_dir():
        raise SystemExit(f"Source dataset folder does not exist: {source}")

    _validate_dataset_root(source)

    api = HfApi(token=token)
    api.create_repo(repo_id=repo_id, repo_type="dataset", private=private, exist_ok=True)

    print(f"Uploading {source} -> hf://datasets/{repo_id}/{path_in_repo}")
    api.upload_folder(
        repo_id=repo_id,
        repo_type="dataset",
        folder_path=str(source),
        path_in_repo=path_in_repo,
        commit_message=commit_message,
    )
    print(f"Upload complete: https://huggingface.co/datasets/{repo_id}")


def download_from_hf(
    repo_id: str,
    destination: Path,
    token: str | None,
    revision: str | None,
    force: bool,
    allow_patterns: Sequence[str],
) -> None:
    _, snapshot_download = _require_hf_hub()

    destination = destination.resolve()
    if destination.exists() and any(destination.iterdir()):
        if not force:
            raise SystemExit(
                f"Destination is not empty: {destination}. Use --force to replace it."
            )
        shutil.rmtree(destination)

    destination.mkdir(parents=True, exist_ok=True)

    kwargs: dict[str, object] = {
        "repo_id": repo_id,
        "repo_type": "dataset",
        "local_dir": str(destination),
        "token": token,
    }
    if revision:
        kwargs["revision"] = revision
    if allow_patterns:
        kwargs["allow_patterns"] = list(allow_patterns)

    print(f"Downloading hf://datasets/{repo_id} -> {destination}")
    snapshot_download(**kwargs)
    print(f"Download complete: {destination}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Upload/download the merged YOLO dataset to/from Hugging Face datasets."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    upload_parser = subparsers.add_parser(
        "upload", help="Upload local dataset to Hugging Face."
    )
    upload_parser.add_argument(
        "--repo-id",
        required=True,
        help="Dataset repo id, e.g. username/oos-combined-dataset",
    )
    upload_parser.add_argument(
        "--source", default="combined_dataset", help="Local dataset folder to upload."
    )
    upload_parser.add_argument(
        "--path-in-repo",
        default=".",
        help="Path inside dataset repo where files are uploaded.",
    )
    upload_parser.add_argument(
        "--token",
        default=os.getenv("HF_TOKEN"),
        help="Hugging Face token. Defaults to HF_TOKEN env var.",
    )
    upload_parser.add_argument(
        "--private",
        action="store_true",
        help="Create the dataset repo as private if it does not exist.",
    )
    upload_parser.add_argument(
        "--message",
        default=f"Update combined dataset ({datetime.now(timezone.utc).isoformat()})",
        help="Commit message for uploaded files.",
    )

    download_parser = subparsers.add_parser(
        "download", help="Download dataset from Hugging Face."
    )
    download_parser.add_argument(
        "--repo-id",
        required=True,
        help="Dataset repo id, e.g. username/oos-combined-dataset",
    )
    download_parser.add_argument(
        "--destination",
        default="combined_dataset",
        help="Local folder where dataset files are restored.",
    )
    download_parser.add_argument(
        "--token",
        default=os.getenv("HF_TOKEN"),
        help="Hugging Face token. Defaults to HF_TOKEN env var.",
    )
    download_parser.add_argument(
        "--revision",
        default=None,
        help="Optional branch/tag/commit in the dataset repo.",
    )
    download_parser.add_argument(
        "--allow-pattern",
        action="append",
        default=[],
        help="Optional glob pattern to download subset of files (repeatable).",
    )
    download_parser.add_argument(
        "--force",
        action="store_true",
        help="Replace destination if it already contains files.",
    )

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "upload":
        upload_to_hf(
            repo_id=args.repo_id,
            source=Path(args.source),
            token=args.token,
            private=args.private,
            path_in_repo=args.path_in_repo,
            commit_message=args.message,
        )
        return

    if args.command == "download":
        download_from_hf(
            repo_id=args.repo_id,
            destination=Path(args.destination),
            token=args.token,
            revision=args.revision,
            force=args.force,
            allow_patterns=args.allow_pattern,
        )
        return

    raise SystemExit(f"Unsupported command: {args.command}")


if __name__ == "__main__":
    main()
