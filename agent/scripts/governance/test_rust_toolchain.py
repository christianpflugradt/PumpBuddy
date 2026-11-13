"""Offline contract tests for the host released-Rust prerequisite."""

import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).with_name("require-release-rust.sh")


class ReleasedRustTests(unittest.TestCase):
    def compiler(self, version, status=0):
        with tempfile.TemporaryDirectory() as directory:
            rustc = Path(directory) / "rustc"
            rustc.write_text(f"#!/bin/sh\nprintf '%s\\n' '{version}'\nexit {status}\n")
            rustc.chmod(0o755)
            return subprocess.run(
                ["sh", str(SCRIPT)], text=True, capture_output=True, env=dict(os.environ, PATH=directory + os.pathsep + os.environ["PATH"])
            )

    def test_released_compilers_do_not_need_an_exact_project_version(self):
        for version in ("rustc 1.97.1 (built from a source tarball)", "rustc 1.99.0 (fixture)"):
            with self.subTest(version=version):
                self.assertEqual(self.compiler(version).returncode, 0)

    def test_prerelease_compilers_are_rejected_with_actionable_guidance(self):
        for suffix in ("nightly", "beta.1", "dev"):
            result = self.compiler(f"rustc 1.99.0-{suffix} (fixture)")
            self.assertEqual(result.returncode, 1)
            self.assertIn("released Rust compiler is required", result.stderr)

    def test_missing_or_failed_compilers_cannot_satisfy_the_prerequisite(self):
        for status in (1, 127):
            result = self.compiler("", status)
            self.assertEqual(result.returncode, status)

    def test_unrecognizable_version_output_is_rejected(self):
        for version in ("", "unknown compiler", "rustc unavailable"):
            self.assertEqual(self.compiler(version).returncode, 1)


if __name__ == "__main__":
    unittest.main()
