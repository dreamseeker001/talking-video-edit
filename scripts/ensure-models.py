"""Download only missing pinned model snapshots during installation."""
import json
import sys
from importlib.metadata import version
from pathlib import Path
from huggingface_hub import snapshot_download
from huggingface_hub.errors import LocalEntryNotFoundError

with open(sys.argv[1], encoding="utf-8-sig") as stream:
    models = json.load(stream)["models"]
constraints = Path(sys.argv[1]).with_name("whisperx-constraints.txt")
for spec in constraints.read_text(encoding="utf-8-sig").splitlines():
    if "==" in spec and not spec.startswith("#"):
        package, pinned = spec.strip().split("==")
        actual = version(package)
        if actual.split("+")[0] != pinned:
            raise RuntimeError(f"Dependency drift: {package} {actual}, expected {pinned}; repair this isolated environment")
        print(f"Dependency: {package}=={actual}")
for model in models:
    args = {"repo_id": model["repo"], "revision": model["revision"]}
    required = (["model.bin", "config.json", "tokenizer.json", "vocabulary.txt"]
                if model["repo"].startswith("Systran/") else
                ["pytorch_model.bin", "config.json", "preprocessor_config.json", "vocab.json", "special_tokens_map.json"])
    try:
        path = snapshot_download(**args, local_files_only=True)
        missing = [name for name in required if not (Path(path) / name).is_file()]
        if missing:
            path = snapshot_download(**args, allow_patterns=required)
            print(f"Repaired missing model files: {missing}")
        else:
            print(f"Cached: {model['repo']} {path}")
    except LocalEntryNotFoundError:
        path = snapshot_download(**args, allow_patterns=required)
        print(f"Downloaded: {model['repo']} {path}")
    # WhisperX requests the model's main ref when loading by the public model name.
    # Populate a missing ref for fresh caches; never rewrite another user's existing ref.
    ref = Path(path).parent.parent / "refs" / "main"
    if ref.exists() and ref.read_text().strip() != model["revision"]:
        raise RuntimeError(f"Model main differs from the tested pin: {ref}; use a separate cache")
    if not ref.exists():
        ref.parent.mkdir(parents=True, exist_ok=True)
        ref.write_text(model["revision"], encoding="utf-8")
