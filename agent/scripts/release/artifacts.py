#!/usr/bin/env python3
"""Export and verify the exact Docker candidates; publication never builds images."""
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tarfile


COMPONENTS = ("backend", "renderer")
REPOSITORY = "christianpflugradt/PumpBuddy"


def run(*args):
    return subprocess.check_output(args, text=True).strip()


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def binding():
    version = os.environ["EXPECTED_RELEASE_VERSION"]
    source = os.environ["GITHUB_SHA"]
    run_id = os.environ["GITHUB_RUN_ID"]
    attempt = os.environ["GITHUB_RUN_ATTEMPT"]
    if not re.fullmatch(r"[1-9]\d*\.\d+\.\d+", version):
        raise ValueError("Expected a stable-series semantic release version")
    if not re.fullmatch(r"[0-9a-f]{40}", source):
        raise ValueError("Invalid source SHA")
    if not run_id.isdecimal() or not attempt.isdecimal():
        raise ValueError("Invalid workflow provenance")
    if os.environ.get("GITHUB_REPOSITORY") != REPOSITORY:
        raise ValueError("Unexpected release repository")
    if os.environ.get("GITHUB_REF") != "refs/heads/main":
        raise ValueError("Release requires main")
    return {"version": version, "source_sha": source, "run_id": run_id, "attempt": attempt}


def archive_image(path, tag, expected, engine_id=None):
    with tarfile.open(path, "r:") as archive:
        names = set()
        for member in archive:
            name = PurePosixPath(member.name)
            if name.is_absolute() or ".." in name.parts or member.name in names:
                raise ValueError("Unsafe or duplicate archive path")
            if not (member.isfile() or member.isdir()):
                raise ValueError("Unexpected archive entry type")
            names.add(member.name)
        manifests = json.load(archive.extractfile("manifest.json"))
        if len(manifests) != 1 or manifests[0]["RepoTags"] != [tag]:
            raise ValueError("Unexpected image set or tag")
        manifest = manifests[0]
        config_bytes = archive.extractfile(manifest["Config"]).read()
        config = json.loads(config_bytes)
        if (config["os"], config["architecture"]) != ("linux", "amd64"):
            raise ValueError("Candidate platform must remain linux/amd64")
        labels = config["config"]["Labels"]
        if labels["org.opencontainers.image.version"] != "v" + expected["version"]:
            raise ValueError("Image version differs from the planned release")
        if labels["org.opencontainers.image.revision"] != expected["source_sha"]:
            raise ValueError("Image source differs from the planned release")
        if not manifest["Layers"] or any(layer not in names for layer in manifest["Layers"]):
            raise ValueError("Image layers missing")
        config_digest = "sha256:" + hashlib.sha256(config_bytes).hexdigest()
        # Classic Docker identifies images by config; the containerd store can
        # instead return the OCI manifest digest. Both must bind to this config.
        if engine_id is not None and engine_id != config_digest:
            if not re.fullmatch(r"sha256:[0-9a-f]{64}", engine_id):
                raise ValueError("Invalid Docker image identity")
            blob = "blobs/sha256/" + engine_id.removeprefix("sha256:")
            if blob not in names:
                raise ValueError("Docker image identity is absent from the candidate archive")
            manifest_bytes = archive.extractfile(blob).read()
            if "sha256:" + hashlib.sha256(manifest_bytes).hexdigest() != engine_id:
                raise ValueError("OCI manifest digest mismatch")
            if json.loads(manifest_bytes).get("config", {}).get("digest") != config_digest:
                raise ValueError("Docker image manifest differs from the candidate config")
        return config_digest


def verify(directory=Path("dist")):
    expected = binding()
    required = {"metadata.json", *(f"{name}.tar" for name in COMPONENTS)}
    if {path.name for path in directory.iterdir()} != required:
        raise ValueError("Incomplete or unexpected candidate artifact set")
    if any(path.is_symlink() or not path.is_file() for path in directory.iterdir()):
        raise ValueError("Candidate artifacts must be regular files")
    metadata = json.loads((directory / "metadata.json").read_text())
    if metadata["schema_version"] != 1 or metadata["binding"] != expected:
        raise ValueError("Candidate source, version or workflow run/attempt changed")
    if set(metadata["images"]) != set(COMPONENTS):
        raise ValueError("Incomplete image receipts")
    for name in COMPONENTS:
        receipt = metadata["images"][name]
        path = directory / f"{name}.tar"
        tag = f"pumpbuddy-{name}:candidate"
        if receipt["sha256"] != digest(path):
            raise ValueError("Candidate archive checksum mismatch")
        if receipt["config_digest"] != archive_image(path, tag, expected):
            raise ValueError("Candidate image identity mismatch")
    return metadata


def package(directory=Path("dist")):
    expected = binding()
    if run("git", "rev-parse", "HEAD") != expected["source_sha"]:
        raise ValueError("Candidate checkout differs from dispatched source")
    directory.mkdir(exist_ok=True)
    if any(directory.iterdir()):
        raise ValueError("Candidate output must start empty")
    images = {}
    for name in COMPONENTS:
        path = directory / f"{name}.tar"
        tag = f"pumpbuddy-{name}:candidate"
        subprocess.run(["docker", "image", "save", "--output", str(path), tag], check=True)
        engine_id = run("docker", "image", "inspect", "--format", "{{.Id}}", tag)
        config_digest = archive_image(path, tag, expected, engine_id)
        images[name] = {"sha256": digest(path), "config_digest": config_digest}
    (directory / "metadata.json").write_text(json.dumps({
        "schema_version": 1, "binding": expected, "images": images,
    }, indent=2) + "\n")
    verify(directory)


def load(directory=Path("dist")):
    metadata = verify(directory)
    for name in COMPONENTS:
        subprocess.run(["docker", "image", "load", "--input", str(directory / f"{name}.tar")], check=True)
        loaded_image_id(directory, name, metadata)


def loaded_image_id(directory, name, metadata):
    tag = f"pumpbuddy-{name}:candidate"
    engine_id = run("docker", "image", "inspect", "--format", "{{.Id}}", tag)
    config_digest = archive_image(directory / f"{name}.tar", tag, metadata["binding"], engine_id)
    if config_digest != metadata["images"][name]["config_digest"]:
        raise ValueError("Loaded image differs from verified candidate")
    return engine_id


def publish(directory=Path("dist")):
    metadata = verify(directory)
    subprocess.run(["node", str(Path(__file__).with_name("source-guard.mjs")), "--source"], check=True)
    for name in COMPONENTS:
        image_id = loaded_image_id(directory, name, metadata)
        target = f"ghcr.io/christianpflugradt/pumpbuddy-{name}:v{metadata['binding']['version']}"
        subprocess.run(["docker", "image", "tag", image_id, target], check=True)
        subprocess.run(["docker", "image", "push", target], check=True)
        manifest = json.loads(run("docker", "buildx", "imagetools", "inspect", "--raw", target))
        if manifest["config"]["digest"] != metadata["images"][name]["config_digest"]:
            raise ValueError("Published image differs from the verified candidate")


if __name__ == "__main__":
    commands = {"package": package, "verify": verify, "load": load, "publish": publish}
    if len(sys.argv) != 2 or sys.argv[1] not in commands:
        raise SystemExit("Usage: artifacts.py package|verify|load|publish")
    commands[sys.argv[1]]()
