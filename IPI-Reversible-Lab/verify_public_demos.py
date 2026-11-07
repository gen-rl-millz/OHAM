#!/usr/bin/env python3
"""Independent finite-state verification of the public IPI reversible companions.
No proprietary FrameCore modules, source data, or backends are used.
Run: python3 verify_public_demos.py
"""
from itertools import permutations
import json, hashlib

WORDS = {
    "ccf":[{"gate":"CCX","c1":0,"c2":1,"target":2}],
    "half":[{"gate":"CCX","c1":0,"c2":1,"target":2},{"gate":"CX","control":0,"target":1}],
    "majority":[{"gate":"CX","control":2,"target":1},{"gate":"CX","control":2,"target":0},{"gate":"CCX","c1":0,"c2":1,"target":2}],
    "parity":[{"gate":"CX","control":0,"target":2},{"gate":"CX","control":1,"target":2}],
    "fredkin":[{"gate":"FREDKIN","control":0,"a":1,"b":2}],
    "identity":[],
}
BIT = lambda s, k: (s >> k) & 1

def gate(g, s):
    k=g["gate"].upper()
    fields={
      "X":("target",),"CX":("control","target"),
      "CCX":("c1","c2","target"),
      "SWAP":("a","b"),"FREDKIN":("control","a","b")
    }
    wires=[g[z] for z in fields[k]]
    assert all(type(w) is int and 0<=w<=2 for w in wires)
    assert len(set(wires))==len(wires)
    if k=="X": return s ^ (1 << g["target"])
    if k=="CX": return s ^ ((BIT(s,g["control"])) << g["target"])
    if k=="CCX": return s ^ ((BIT(s,g["c1"]) & BIT(s,g["c2"])) << g["target"])
    if k=="FREDKIN" and not BIT(s,g["control"]): return s
    return s if BIT(s,g["a"])==BIT(s,g["b"]) else s ^ (1<<g["a"]) ^ (1<<g["b"])

def run(word, x):
    for g in word: x = gate(g, x)
    return x

def bennett(word, x):
    inverse=list(reversed(word))
    w=y=0
    w ^= x
    w = run(word,w)
    y ^= w
    w = run(inverse,w)
    w ^= x
    return (x,w,y)

report={}
for name, word in WORDS.items():
    perm=[run(word,x) for x in range(8)]
    assert sorted(perm)==list(range(8)), (name,"nonbijective")
    reverse=list(reversed(word))
    assert all(run(reverse,perm[x])==x for x in range(8)),(name,"inverse")
    assert all(bennett(word,x)==(x,0,perm[x]) for x in range(8)),(name,"Bennett")
    augmented=word+[{"gate":"CCX","c1":0,"c2":1,"target":2}]*2
    assert all(run(augmented,x)==perm[x] for x in range(8)),(name,"two histories")
    report[name]={"permutation":perm,"inverse_pass":8,"bennett_pass":8,"two_history_equal":True}
# Every primitive test under every allowed distinct assignment:
primitive_checked=0
for t in ("X","CX","CCX","SWAP","FREDKIN"):
    fields={"X":("target",),"CX":("control","target"),"CCX":("c1","c2","target"),"SWAP":("a","b"),"FREDKIN":("control","a","b")}[t]
    for wires in permutations(range(3),len(fields)):
        g={"gate":t,**dict(zip(fields,wires))}
        assert all(gate(g,gate(g,x))==x for x in range(8))
        primitive_checked+=1
result={"status":"PASS","all_words_checked":len(WORDS),"states_per_word":8,"primitive_assignments_checked":primitive_checked,"reports":report}
encoded=json.dumps(result,sort_keys=True,separators=(",",":")).encode()
print(json.dumps({"status":"PASS","programmes":len(WORDS),"checks_each":8,"primitive_assignments":primitive_checked,"receipt_sha256":hashlib.sha256(encoded).hexdigest()},indent=2))
