import runpy,tempfile
from pathlib import Path
m=runpy.run_path(str(Path(__file__).resolve().parents[2]/"deploy"/"promote-frontend.py"))
def build(p,text):
    (p/"assets").mkdir(parents=True)
    (p/"index.html").write_text('<div id="root"></div><script src="/assets/entry.js"></script>')
    (p/"assets"/"entry.js").write_text(text)
with tempfile.TemporaryDirectory(prefix="kfaah-promotion-test-") as t:
    p=Path(t); releases=p/"releases"; releases.mkdir()
    old=releases/"old"; stage=p/"stage"; build(old,"old");build(stage,"new")
    (old/"assets"/"previous-tab.js").write_text("old chunk")
    current=p/"current";current.symlink_to(old)
    final,previous=m["promote"](stage,current,releases,lambda release,assets:None)
    assert current.resolve()==final and previous==old and (old/"assets"/"entry.js").read_text()=="old"
    assert (final/"assets"/"previous-tab.js").is_file()
    print("PASS atomic promotion and preservation of old tabs")
    def fail(*a): raise ValueError("simulated HTTP mismatch")
    try:m["promote"](stage,current,releases,fail)
    except ValueError:pass
    else:raise AssertionError("failure not propagated")
    assert current.resolve()==final
    print("PASS rollback after HTTP verification failure")
    (stage/"assets"/"entry.js").unlink()
    try:m["promote"](stage,current,releases,lambda *a:None)
    except ValueError:pass
    else:raise AssertionError("invalid staging accepted")
    assert current.resolve()==final
    print("PASS missing asset rejected before pointer change")
with tempfile.TemporaryDirectory(prefix="kfaah-promotion-invalid-") as t:
    p=Path(t);build(p,"source")
    index=p/"index.html"
    index.write_text(index.read_text()+'<script src="https://project.supabase.co/script.js"></script>')
    try:m["validate_release"](p)
    except ValueError:pass
    else:raise AssertionError("blocked source origin accepted")
    print("PASS blocked source rejected")
