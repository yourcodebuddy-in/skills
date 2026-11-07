import argparse


def parser():
    p = argparse.ArgumentParser(prog="prune")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--yes", action="store_true", help="skip the confirmation prompt")
    return p
