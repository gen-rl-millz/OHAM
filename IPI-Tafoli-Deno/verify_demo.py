#!/usr/bin/env python3
"""Standalone exact classical demonstration; NOT FrameCore native proof suite."""
import hashlib,itertools,json,pathlib
root=pathlib.Path(__file__).resolve().parent
bits=range(8)
def apply(g,x):
    n,*v=g
    if n=='x': return x^(1<<v[0])
    if n=='cx': return x^((1<<v[1]) if ((x>>v[0])&1) else 0)
    if n=='ccx': return x^((1<<v[2]) if ((x>>v[0])&1) and ((x>>v[1])&1) else 0)
    raise ValueError(g)
def perm(g): return tuple(apply(g,x) for x in bits)
def compose(p,q):return tuple(p[q[i]] for i in bits)
def word_table(word):
    p=tuple(bits)
    for g in word:p=compose(perm(g),p)
    return p
def closure(gs):
    seen={tuple(bits)};stack=[tuple(bits)];gp=[perm(g) for g in gs]
    while stack:
        p=stack.pop()
        for q in gp:
            v=compose(q,p)
            if v not in seen:seen.add(v);stack.append(v)
    return len(seen)
def bennett(a,b,w,y):
    s=a|(b<<1)|(w<<2)|(y<<3)
    if a and b:s^=4
    if s&4:s^=8
    if a and b:s^=4
    return s
def main():
    x=[('x',i) for i in range(3)]
    cx=[('cx',i,j) for i in range(3) for j in range(3) if i!=j]
    ccx=('ccx',0,1,2)
    p=perm(ccx);assert p==(0,1,2,7,4,5,6,3)
    assert compose(p,p)==tuple(bits) and len(set(p))==8
    agl=closure(x+cx);s8=closure(x+cx+[ccx])
    assert agl==1344 and s8==40320
    for a,b,w,y in itertools.product((0,1),repeat=4):
        s=bennett(a,b,w,y)
        assert bennett(s&1,(s>>1)&1,(s>>2)&1,(s>>3)&1)==a|(b<<1)|(w<<2)|(y<<3)
    for a,b in itertools.product((0,1),repeat=2):
        assert bennett(a,b,0,0)==a|(b<<1)|((a&b)<<3)
    w1=[('x',0),('x',1)];w2=[('x',1),('x',0)]
    assert w1!=w2 and word_table(w1)==word_table(w2)
    source={'id':'SYNTH-HARBOR-001','r0':'Harbor report: chilled tuna shipment.','r1':'Harbor report: chilled tuna shipment; departure verified.'}
    requests={'A':{'type':'term-count','revision':'r1'},'B':{'type':'exact-history','revision':'r1'}}
    receipt={'schema':'ipi_tafoli_deno_reference_v1','scope':'independent synthetic classical demo; not FrameCore Rust laboratory evidence','toffoli_truth_table':list(p),'involution':True,'affine_group_order':agl,'full_group_order':s8,'bennett_full_register_inverse_cases':16,'bennett_clean_work_cases':4,'same_permutation_distinct_words':True,'source':source,'requests':requests}
    data=json.dumps(receipt,sort_keys=True,ensure_ascii=False,indent=2)+'\n'
    (root/'demo_receipt.json').write_text(data,encoding='utf-8')
    (root/'demo_receipt.sha256').write_text(hashlib.sha256(data.encode()).hexdigest()+'  demo_receipt.json\n',encoding='ascii')
    print('PASS: Toffoli, 8 states; affine group 1344; S8 40320; Bennett inverse 16/16; distinct ordered histories')
    print('Receipt written to demo_receipt.json')
if __name__=='__main__':main()
