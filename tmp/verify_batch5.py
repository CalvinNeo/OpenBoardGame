import re, os, sys
ROOT='static/games'
# batch5
BATCH=['high_society','dnd_starter_set','for_sale','grand_austria_hotel','gizmos']
EMOJI=re.compile('([\u4e00-\u9fffA-Za-z])\\s*[\uff08(]\ufe0f?[\u2190-\u27bf\U0001f000-\U0001faff]')
ANY=re.compile('[\u2190-\u27bf\U0001f000-\U0001faff]')
SEMI=re.compile(r'[\uff1b;]')
def read(n):
    p=os.path.join(ROOT,n)
    return open(p,encoding='utf-8',errors='ignore').read() if os.path.exists(p) else ''
def balanced(s,start):
    i=s.find('{',start)
    if i<0: return ''
    d=0
    for c in range(i,len(s)):
        if s[c]=='{': d+=1
        elif s[c]=='}':
            d-=1
            if d==0: return s[i:c+1]
    return ''
def resolve(s,call):
    at=s.find(call+'(')
    if at<0: return ''
    arg=at+len(call)+1
    tail=s[arg:]
    if tail.lstrip().startswith('{'): return balanced(s,arg)
    m=re.match(r'\s*([A-Za-z_$][\w$]*)',tail)
    if not m: return ''
    const=m.group(1)
    for kw in ('const','let','var'):
        f=re.search(kw+r'\s+'+re.escape(const)+r'\s*=\s*',s)
        if f: return balanced(s,f.end())
    return ''
def expl(s):
    cfg=resolve(s,'obgCreateExplain')
    m=re.search(r'explanations:\s*([A-Za-z_$][\w$]*)',cfg)
    if not m: return cfg
    const=m.group(1)
    for kw in ('const','let','var'):
        f=re.search(kw+r'\s+'+re.escape(const)+r'\s*=\s*',s)
        if f: return balanced(s,f.end())
    return cfg
idx=open('static/index.html',encoding='utf-8').read()
print(f"{'game':<20} {'sec':>4} {'keys':>5}  status")
print('-'*68)
fails=0
for g in BATCH:
    js=read(g+'.js'); html=read(g+'.html')
    probs=[]; sec=0; keys=0
    if 'obgCreateHelp' not in js:
        probs.append('not migrated')
    else:
        cfg=resolve(js,'obgCreateHelp')
        sec=cfg.count('label:')
        if 'zh:' not in cfg or 'en:' not in cfg: probs.append('R1')
        basic=cfg[cfg.find('basic:'):] if 'basic:' in cfg else ''
        for f in ('win:','turn:','key:'):
            if f not in basic: probs.append('R3-'+f)
        n=len(SEMI.findall(cfg))
        if n>2: probs.append(f'R2({n})')
        if ANY.search(cfg) and not EMOJI.search(cfg): probs.append('R4')
        if sec<3: probs.append(f'R6({sec})')
        if 'obgCreateExplain(' not in js: probs.append('no explain')
        ec=expl(js)
        keys=len(re.findall(r'^\s+([a-z0-9_]+):\s*\{', ec, re.M))
        m=re.search(r'attribute:\s*"([^"]+)"',js)
        if m:
            used=set(re.findall(re.escape(m.group(1))+r'="([^"]+)"', html+idx))
            miss=used-set(re.findall(r'^\s+([a-z0-9_]+):\s*\{', ec, re.M))
            if miss: probs.append('unexplained:'+','.join(sorted(miss)[:3]))
        else: probs.append('no attribute')
    ok=not probs
    if not ok: fails+=1
    print(f'{g:<20} {sec:>4} {keys:>5}  ' + ('OK' if ok else '; '.join(probs)))
print('-'*68)
print(f'{len(BATCH)-fails}/{len(BATCH)} games pass')