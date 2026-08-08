#!/usr/bin/env bash
# Dogfood OHAM mechanically — every step of DOGFOOD.md, verdicts by byte
# comparison. Run from the repository root. Needs curl + ~250 MB.
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OHAM="$here/bin/linux-x86_64/oham"
WD="${1:-$(mktemp -d /tmp/oham-dogfood.XXXX)}"
HOME_URL="https://storage.googleapis.com/framecore-etch-video"
mkdir -p "$WD"; cd "$WD"
pass=0; fail=0
ok()  { echo "  PASS $1"; pass=$((pass+1)); }
bad() { echo "  FAIL $1"; fail=$((fail+1)); }
s16() { sha256sum "$1" | cut -c1-16; }

echo "== 0 binary checksum"
( cd "$here/bin/linux-x86_64" && sha256sum -c SHA256SUMS >/dev/null 2>&1 ) \
  && ok "binary matches SHA256SUMS" || bad "binary checksum"
"$OHAM" about | grep -q "Paul Phillips — solo developer" \
  && ok "about carries the attribution" || bad "about text"

echo "== 1 fetch the published clips"
[ -f driving60q2.tsb ]  || curl -fsSO "$HOME_URL/driving60q2.tsb"
[ -f driving60q2z.tsb ] || curl -fsSO "$HOME_URL/driving60q2z.tsb"
[ "$(s16 driving60q2.tsb)" = "8796a9f47a4c6978" ] \
  && ok "v1 clip identity 8796a9f47a4c6978" || bad "v1 clip hash $(s16 driving60q2.tsb)"

echo "== 2 structure"
"$OHAM" info driving60q2.tsb  | grep -q "STRUCTURE_OK" && ok "v1 STRUCTURE_OK" || bad "v1 info"
"$OHAM" info driving60q2z.tsb | grep -q "STRUCTURE_OK" && ok "v2 STRUCTURE_OK" || bad "v2 info"

echo "== 3 exact decode vs the published goldens (both wire forms)"
declare -A GOLD=( [50,0]=6c04bb8dd2bff253 [50,1]=9fdf230726bf4bc6 [50,2]=1377ace75d0f8c7d
                  [300,0]=d7b3d597b92edda3 [300,1]=5a8bde6333481685 [300,2]=f3814653d1c95773
                  [900,0]=2965276276479762 [900,1]=2018ef3ddc8ee3a4 [900,2]=65eeb3d655579935 )
for clip in driving60q2.tsb driving60q2z.tsb; do
  for key in 50,1 300,0 900,2; do
    t="${key%,*}"; L="${key#*,}"
    "$OHAM" unseal "$clip" --tick "$t" --level "$L" --raw f.bin >/dev/null
    got=$(s16 f.bin); rm -f f.bin
    [ "$got" = "${GOLD[$key]}" ] \
      && ok "$clip t$t L$L == golden" || bad "$clip t$t L$L got $got want ${GOLD[$key]}"
  done
done

echo "== 4 reversibility"
"$OHAM" repack driving60q2z.tsb rt.tsb --v1 >/dev/null
[ "$(s16 rt.tsb)" = "8796a9f47a4c6978" ] \
  && ok "v2->v1 reconstructs the v1 container byte-identically" \
  || bad "v2->v1 got $(s16 rt.tsb)"
rm -f rt.tsb
"$OHAM" repack driving60q2.tsb rtz.tsb --v2 | grep -q "1200/1200" \
  && ok "v1->v2 self-verified 1200/1200 before write" || bad "v1->v2 roundtrip"
rm -f rtz.tsb

echo "== 5 the still form"
"$OHAM" excerpt driving60q2.tsb still.tsb --tick 300 >/dev/null
"$OHAM" unseal still.tsb --tick 0 --level 0 --raw s.bin >/dev/null
[ "$(s16 s.bin)" = "d7b3d597b92edda3" ] \
  && ok "one-tick excerpt unseal == source frame (still form)" \
  || bad "still unseal $(s16 s.bin)"
rm -f s.bin
"$OHAM" unseal still.tsb --tick 0 --level 0 --window 1024,512,1536,1024 --raw w.bin \
  | grep -qE "· [0-9]+ addresses" \
  && ok "windowed read reports its own (window-sized) cost" || bad "window read"
rm -f w.bin still.tsb

echo "== 6 serve: exact ranges"
"$OHAM" serve . --port 8237 >/dev/null 2>&1 & SRV=$!
sleep 1
curl -fsS -H "Range: bytes=0-87" -o head.bin http://127.0.0.1:8237/driving60q2.tsb
head -c 88 driving60q2.tsb > head.want
cmp -s head.bin head.want && ok "206 range bytes exact" || bad "range serve"
rm -f head.bin head.want; kill $SRV 2>/dev/null

total=$((pass+fail))
echo
echo "DOGFOOD_$([ $fail = 0 ] && echo GREEN || echo RED) $pass/$total  (workdir $WD)"
[ $fail = 0 ]
