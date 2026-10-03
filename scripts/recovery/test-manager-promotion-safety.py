import os,runpy,tempfile
from pathlib import Path
m=runpy.run_path(str(Path(__file__).resolve().parents[2]/"deploy"/"promote-frontend.py"))
def build(p):
    (p/"assets").mkdir(parents=True)
    (p/"index.html").write_text('<div id="root"></div><script src="/assets/entry.js"></script>')
    (p/"assets"/"entry.js").write_text("safe")
for kind in ("external-file","internal-file","directory","fifo"):
    with tempfile.TemporaryDirectory() as t:
        root=Path(t); releases=root/"releases"; releases.mkdir()
        old=releases/"old"; stage=root/"stage"; build(old);build(stage)
        current=root/"current"; current.symlink_to(old)
        secret=root/"secret"; secret.write_text("private fixture")
        if kind=="external-file": (stage/"extra.txt").symlink_to(secret)
        elif kind=="internal-file": (stage/"alias.js").symlink_to(stage/"assets"/"entry.js")
        elif kind=="directory": (stage/"linked-dir").symlink_to(root,target_is_directory=True)
        else: os.mkfifo(stage/"pipe")
        try: m["promote"](stage,current,releases,lambda *a:None)
        except ValueError: pass
        else: raise AssertionError(kind+" was accepted")
        assert current.resolve()==old
        print("PASS unsafe entry rejected:",kind)
with tempfile.TemporaryDirectory() as t:
    root=Path(t); releases=root/"releases"; releases.mkdir()
    old=releases/"old"; stage=root/"stage"; build(old);build(stage)
    current=root/"current";current.symlink_to(old)
    secret=root/"secret";secret.write_text("private fixture")
    copy=m["shutil"].copytree
    def insert_link(src,dest,*args,**kwargs):
        if Path(src)==stage: (stage/"late.txt").symlink_to(secret)
        return copy(src,dest,*args,**kwargs)
    m["shutil"].copytree=insert_link
    try:
        try:m["promote"](stage,current,releases,lambda *a:None)
        except ValueError:pass
        else:raise AssertionError("late symlink accepted")
        assert current.resolve()==old
        print("PASS symlink added between validation and copy remains a link and is rejected")
    finally:m["shutil"].copytree=copy
