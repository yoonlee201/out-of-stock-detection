from __future__ import annotations

import argparse

from pipeline_utils import file_md5


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Compare md5 hashes of two files (used to verify best.pt copy)."
    )
    parser.add_argument("file_a", help="First file path")
    parser.add_argument("file_b", help="Second file path")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    hash_a = file_md5(args.file_a)
    hash_b = file_md5(args.file_b)

    print(f"{args.file_a}: {hash_a}")
    print(f"{args.file_b}: {hash_b}")
    print(f"match: {hash_a == hash_b}")


if __name__ == "__main__":
    main()
