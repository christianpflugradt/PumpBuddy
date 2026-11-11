import copy
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch
import uuid


spec = importlib.util.spec_from_file_location("artifacts", Path(__file__).with_name("artifacts.py"))
artifacts = importlib.util.module_from_spec(spec)
spec.loader.exec_module(artifacts)


class CandidateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.directory = Path(self.tmp.name)
        self.env = {
            "EXPECTED_RELEASE_VERSION": "4.4.0", "GITHUB_SHA": "a" * 40,
            "GITHUB_RUN_ID": "123", "GITHUB_RUN_ATTEMPT": "2",
            "GITHUB_REPOSITORY": artifacts.REPOSITORY, "GITHUB_REF": "refs/heads/main",
        }
        self.environment = patch.dict(os.environ, self.env)
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.metadata = {"schema_version": 1, "binding": artifacts.binding(), "images": {}}
        for name in artifacts.COMPONENTS:
            config = json.dumps({
                "os": "linux", "architecture": "amd64",
                "config": {"Labels": {
                    "org.opencontainers.image.version": "v4.4.0",
                    "org.opencontainers.image.revision": "a" * 40,
                }},
            }).encode()
            image_id = hashlib.sha256(config).hexdigest()
            manifest = [{"Config": image_id + ".json", "RepoTags": [f"pumpbuddy-{name}:candidate"], "Layers": ["layer.tar"]}]
            with tarfile.open(self.directory / f"{name}.tar", "w") as archive:
                for path, content in [(image_id + ".json", config), ("manifest.json", json.dumps(manifest).encode()), ("layer.tar", b"fixture")]:
                    member = tarfile.TarInfo(path)
                    member.size = len(content)
                    archive.addfile(member, io.BytesIO(content))
            self.metadata["images"][name] = {
                "sha256": artifacts.digest(self.directory / f"{name}.tar"),
                "config_digest": "sha256:" + image_id,
            }
        self.save()

    def save(self):
        (self.directory / "metadata.json").write_text(json.dumps(self.metadata))

    def test_complete_bound_candidate_is_accepted_without_docker(self):
        with patch.object(artifacts.subprocess, "check_output", side_effect=AssertionError("verification must not run tools")):
            self.assertEqual(artifacts.verify(self.directory), self.metadata)

    def test_source_version_and_run_attempt_are_bound(self):
        for field in ["source_sha", "version", "run_id", "attempt"]:
            with self.subTest(field=field):
                original = copy.deepcopy(self.metadata)
                self.metadata["binding"][field] = "changed"
                self.save()
                with self.assertRaises(ValueError):
                    artifacts.verify(self.directory)
                self.metadata = original

    def test_missing_or_extra_artifacts_are_rejected(self):
        (self.directory / "extra").write_text("unexpected")
        with self.assertRaises(ValueError):
            artifacts.verify(self.directory)
        (self.directory / "extra").unlink()
        (self.directory / "backend.tar").unlink()
        with self.assertRaises(ValueError):
            artifacts.verify(self.directory)

    def test_corruption_and_forged_image_receipts_are_rejected(self):
        self.metadata["images"]["backend"]["config_digest"] = "sha256:" + "b" * 64
        self.save()
        with self.assertRaises(ValueError):
            artifacts.verify(self.directory)
        with (self.directory / "backend.tar").open("ab") as stream:
            stream.write(b"corruption")
        with self.assertRaises(ValueError):
            artifacts.verify(self.directory)

    def test_image_version_and_source_are_checked_independently(self):
        for key in ["version", "source_sha"]:
            wrong = artifacts.binding() | {key: "different"}
            with self.assertRaises(ValueError):
                artifacts.archive_image(self.directory / "backend.tar", "pumpbuddy-backend:candidate", wrong)

    def test_symlink_and_traversal_are_rejected(self):
        archive_path = self.directory / "backend.tar"
        with tarfile.open(archive_path, "a") as archive:
            archive.addfile(tarfile.TarInfo("../escape"))
        self.metadata["images"]["backend"]["sha256"] = artifacts.digest(archive_path)
        self.save()
        with self.assertRaises(ValueError):
            artifacts.verify(self.directory)

    def test_non_amd64_candidate_is_rejected_even_with_a_valid_archive(self):
        source = self.directory / "backend.tar"
        output = self.directory / "arm64.tar"
        with tarfile.open(source) as old, tarfile.open(output, "w") as new:
            for member in old:
                content = old.extractfile(member).read()
                if member.name.endswith(".json") and member.name != "manifest.json":
                    config = json.loads(content)
                    config["architecture"] = "arm64"
                    content = json.dumps(config).encode()
                member.size = len(content)
                new.addfile(member, io.BytesIO(content))
        with self.assertRaisesRegex(ValueError, "linux/amd64"):
            artifacts.archive_image(output, "pumpbuddy-backend:candidate", artifacts.binding())

    def test_wrong_loaded_image_fails(self):
        with patch.object(artifacts.subprocess, "run"), patch.object(artifacts, "run", return_value="wrong"):
            with self.assertRaises(ValueError):
                artifacts.load(self.directory)

    def test_real_docker_archive_preserves_candidate_identity(self):
        tag = f"pumpbuddy-artifact-test:{uuid.uuid4().hex}"
        context = self.directory / "context"
        context.mkdir()
        (context / "marker").write_text("offline fixture\n")
        (context / "Dockerfile").write_text(
            "FROM scratch\n"
            "LABEL org.opencontainers.image.version=v4.4.0\n"
            "LABEL org.opencontainers.image.revision=" + "a" * 40 + "\n"
            "COPY marker /offline-fixture\n"
        )
        subprocess.run([
            "docker", "build", "--platform", "linux/amd64", "--network", "none",
            "--pull=false", "--provenance=false", "--sbom=false", "--tag", tag, str(context),
        ], capture_output=True, check=True)
        self.addCleanup(subprocess.run, ["docker", "image", "rm", tag], capture_output=True, check=True)
        image_id = artifacts.run("docker", "image", "inspect", "--format", "{{.Id}}", tag)
        output = self.directory / "real-image.tar"
        subprocess.run(["docker", "image", "save", "--output", str(output), tag], capture_output=True, check=True)
        config_digest = artifacts.archive_image(output, tag, artifacts.binding(), image_id)
        self.assertRegex(config_digest, r"^sha256:[0-9a-f]{64}$")
        subprocess.run(["docker", "image", "load", "--input", str(output)], capture_output=True, check=True)
        loaded_id = artifacts.run("docker", "image", "inspect", "--format", "{{.Id}}", tag)
        self.assertEqual(loaded_id, image_id)
        self.assertEqual(artifacts.archive_image(output, tag, artifacts.binding(), loaded_id), config_digest)

    def test_publish_uses_verified_loaded_ids_and_checks_registry_identity(self):
        calls = []
        def tool(*args):
            if args[0] == "git":
                return "a" * 40 + " refs/heads/main"
            name = "backend" if "backend" in args[-1] else "renderer"
            config_digest = self.metadata["images"][name]["config_digest"]
            if args[1] == "image":
                return config_digest
            return json.dumps({"config": {"digest": config_digest}})
        with patch.object(artifacts, "run", side_effect=tool), patch.object(artifacts.subprocess, "run", side_effect=lambda args, **_: calls.append(args)):
            artifacts.publish(self.directory)
        self.assertEqual(len(calls), 5)
        self.assertEqual(calls.pop(0), ["node", str(Path(artifacts.__file__).with_name("source-guard.mjs")), "--source"])
        self.assertEqual(calls[0], ["docker", "image", "tag", self.metadata["images"]["backend"]["config_digest"], "ghcr.io/christianpflugradt/pumpbuddy-backend:v4.4.0"])
        self.assertFalse(any("build" in call for call in calls))

    def test_failed_local_source_guard_prevents_any_push(self):
        with patch.object(artifacts.subprocess, "run", side_effect=subprocess.CalledProcessError(1, "node")) as write:
            with self.assertRaises(subprocess.CalledProcessError):
                artifacts.publish(self.directory)
            write.assert_called_once_with(["node", str(Path(artifacts.__file__).with_name("source-guard.mjs")), "--source"], check=True)


if __name__ == "__main__":
    unittest.main()
