import runpy,tempfile
from pathlib import Path
m=runpy.run_path(str(Path(__file__).resolve().parents[2]/"deploy"/"manager-fast-worker.py"))
g=m["apply_edits"].__globals__
with tempfile.TemporaryDirectory() as t:
    root=Path(t); workspace=root/"workspace"; (workspace/"src").mkdir(parents=True)
    g.update(ROOT=root,WORKSPACE=workspace,CLOUDFLARED=root/"cloudflared",reset_workspace=lambda:None)
    match=m["is_managed_process"]
    assert match("cloudflared",[str(root/"cloudflared"),"tunnel","--url","http://127.0.0.1:4173"],root)
    assert not match("cloudflared",[str(root/"cloudflared"),"tunnel","--url","http://127.0.0.1:9000"],root)
    assert not match("cloudflared",["/other/cloudflared","--url","http://127.0.0.1:4173"],root)
    args=["node",str(workspace/"node_modules/vite/bin/vite.js"),"--port","4173"]
    assert match("vite",args,workspace)
    assert not match("vite",args,root/"other")
    assert not match("vite",["node","/other/node_modules/vite/bin/vite.js","--port","4173"],workspace)
    print("PASS process management is confined to this preview's directory, executable and port")
    file=workspace/"src"/"a.ts";file.write_text("before")
    alias=workspace/"src"/"alias.ts";alias.symlink_to(file)
    for path in ["src/alias.ts","src/../secret","src/../../secret"]:
        try:m["apply_edits"]([{"path":path,"old":"before","new":"after"}])
        except RuntimeError:pass
        else:raise AssertionError("unsafe target accepted")
        assert file.read_text()=="before"
    print("PASS symlink aliases and traversal rejected")
    try:m["apply_edits"]([{"path":"src/a.ts","old":"before","new":"after"},{"path":"src/missing.ts","old":"bad","new":"x"}])
    except RuntimeError:pass
    else:raise AssertionError("invalid second edit accepted")
    assert file.read_text()=="before"
    m["apply_edits"]([{"path":"src/a.ts","old":"before","new":"after"}])
    assert file.read_text()=="after"
    print("PASS whole patch validated before writes; valid edit still works")
