# Building and publishing the PyPI package

The wheel bundles the platform binary at `src/oham/bin/oham`. From the
repository root, once a PyPI token is configured:

```sh
cd packages/pypi
mkdir -p src/oham/bin
cp ../../bin/linux-x86_64/oham src/oham/bin/oham
cp ../../README.md .
python3 -m pip install --quiet build twine
python3 -m build --wheel
# the wheel is linux-x86_64-specific; tag it honestly:
#   pip install wheel; python3 -m wheel tags --platform-tag manylinux_2_28_x86_64 dist/*.whl
python3 -m twine upload dist/*.whl        # needs TWINE_API token (owner)
```

More platforms = more wheels, same recipe per binary. The name `oham`
was free on PyPI when this was written (2026-08-06).
