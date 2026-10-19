"""Browser checks for Lovelight Leap (Playwright + Chrome).

Usage:  python tests/browser_test.py [URL]
Env:    AXE_PATH=path/to/axe.min.js  (optional, turns on the accessibility checks)
        CHROME=/path/to/chrome       (optional, otherwise Playwright's Chromium)
"""
import asyncio, json, os, sys, subprocess
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000/index.html"
AXE = open(os.environ["AXE_PATH"]).read() if os.environ.get("AXE_PATH") else None
GAME = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
results, problems = [], []
def ok(name, cond, info=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + ((" :: " + str(info)) if (info and not cond) else ""), flush=True)
    if not cond: problems.append(name)
VIEWS = {"desktop": dict(viewport=dict(width=1366, height=768)),
         "mobile": dict(viewport=dict(width=390, height=844), device_scale_factor=3, is_mobile=True, has_touch=True)}
def node(js): return subprocess.run(["node", "-e", js], capture_output=True, text=True, check=True, cwd=GAME).stdout
ROUTE0 = json.loads(node("const S=require('./tests/solver.js'),L=require('./assets/js/levels.js');process.stdout.write(JSON.stringify(S.solve(L,0,{stopAtGoal:true}).route))"))
FINAL = json.loads(node("const B=require('./tests/bots.js'),L=require('./assets/js/levels.js');process.stdout.write(JSON.stringify(B.playFinal(L,{noEnemies:true}).inputs))"))

async def newpage(br, view, motion="no-preference", init=None):
    ctx = await br.new_context(**VIEWS[view], reduced_motion=motion)
    if init: await ctx.add_init_script(init)
    pg = await ctx.new_page(); errs = []
    pg.on("console", lambda m: errs.append(f"console.{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    pg.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
    pg.on("requestfailed", lambda r: errs.append(f"requestfailed: {r.url}"))
    pg.on("response", lambda r: errs.append(f"HTTP {r.status}: {r.url}") if r.status >= 400 else None)
    ext = []
    origin = "/".join(BASE.split("/")[:3])
    pg.on("request", lambda r: ext.append(r.url) if not r.url.startswith(origin) and not r.url.startswith("data:") else None)
    await pg.goto(BASE); await pg.wait_for_timeout(600)
    return ctx, pg, errs, ext

async def axe(pg, label):
    if not AXE: return
    await pg.add_script_tag(content=AXE)
    r = await pg.evaluate("async () => { const r = await axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa']}}); return r.violations.map(v => v.id + ': ' + v.nodes.length + ' ' + v.nodes.slice(0,2).map(n=>n.target.join(' ')).join(' | ')); }")
    ok(f"axe WCAG 2.1 AA: {label}", not r, r)

async def overflow(pg): return await pg.evaluate("Math.max(document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight)")
async def start_play(pg, i=0, opts="{}"):
    await pg.evaluate(f"__LL.start({i},{opts})"); await pg.wait_for_timeout(100)

async def run_view(br, view):
    ctx, pg, errs, ext = await newpage(br, view)
    ok(f"[{view}] title screen visible", await pg.is_visible("#scr-title") and await pg.is_visible("#logo"))
    ok(f"[{view}] game canvas renders at a crisp scale", await pg.evaluate("__LL.K") == await pg.evaluate("Math.max(1,Math.min(4,Math.ceil(document.querySelector('#frame').clientWidth*Math.min(devicePixelRatio,3)/480)))"))
    ok(f"[{view}] no page overflow", await overflow(pg) <= 0, await overflow(pg))
    t0 = await pg.evaluate("__LL.ticks"); await pg.wait_for_timeout(1000); t1 = await pg.evaluate("__LL.ticks")
    ok(f"[{view}] fixed timestep runs at 60 updates per second", 54 <= t1 - t0 <= 66, t1 - t0)
    await axe(pg, f"{view} title")
    # menus
    await pg.click("#btn-howto"); ok(f"[{view}] how to play opens", await pg.is_visible("#scr-howto")); await axe(pg, f"{view} how to play")
    await pg.click("#scr-howto [data-back]")
    await pg.click("#btn-levels"); n = await pg.locator("#level-grid .card").count(); dis = await pg.locator("#level-grid .card:disabled").count()
    ok(f"[{view}] world select lists 4 worlds, 3 locked on a fresh save", n == 4 and dis == 3, (n, dis))
    await axe(pg, f"{view} world select")
    await pg.click("#scr-levels [data-back]")
    await pg.click("#btn-start"); ok(f"[{view}] story card", await pg.is_visible("#scr-story"))
    await pg.click("#btn-story-go"); await pg.wait_for_function("__LL.mode==='play'", timeout=5000); await pg.wait_for_timeout(1300)
    ok(f"[{view}] world 1 starts", await pg.evaluate("__LL.world.index") == 0)
    ok(f"[{view}] pause button shown in play", await pg.is_visible("#btn-pause"))
    if view == "desktop":
        x0 = await pg.evaluate("__LL.world.player.x")
        await pg.keyboard.down("ArrowRight"); await pg.wait_for_timeout(500); await pg.keyboard.up("ArrowRight")
        x1 = await pg.evaluate("__LL.world.player.x")
        ok("keyboard: arrow right runs", x1 - x0 > 40, (x0, x1))
        await pg.keyboard.down("KeyA"); await pg.wait_for_timeout(300); await pg.keyboard.up("KeyA")
        ok("keyboard: A runs left and she faces left", await pg.evaluate("__LL.world.player.facing") == -1)
        y0 = await pg.evaluate("__LL.world.player.y")
        await pg.keyboard.down("Space"); await pg.wait_for_timeout(250)
        y1 = await pg.evaluate("__LL.world.player.y"); await pg.keyboard.up("Space")
        ok("keyboard: Space jumps", y0 - y1 > 25, (y0, y1))
        await pg.wait_for_timeout(800)
        await pg.keyboard.press("KeyZ"); await pg.wait_for_timeout(120)
        ok("keyboard: Z jumps", await pg.evaluate("__LL.world.player.vy") < 0 or not await pg.evaluate("__LL.world.player.onGround"))
        await pg.wait_for_timeout(800)
        await pg.evaluate("__LL.world.player.bow = true")
        await pg.keyboard.press("KeyX"); await pg.wait_for_timeout(50)
        ok("keyboard: X shoots a heart arrow with the bow", await pg.evaluate("__LL.world.arrows.length") >= 1)
        await pg.keyboard.press("KeyP"); await pg.wait_for_timeout(200)
        ok("keyboard: P pauses", await pg.evaluate("__LL.mode") == "paused" and await pg.is_visible("#scr-pause"))
        tp = await pg.evaluate("__LL.world.time"); await pg.wait_for_timeout(400)
        ok("paused game does not advance", await pg.evaluate("__LL.world.time") == tp)
        await axe(pg, "pause menu")
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(200)
        ok("keyboard: Esc resumes", await pg.evaluate("__LL.mode") == "play")
        before = await pg.text_content("#btn-sound")
        await pg.keyboard.press("KeyM"); await pg.wait_for_timeout(100)
        after = await pg.text_content("#btn-sound")
        ok("keyboard: M toggles sound", before != after and await pg.evaluate("__LL.save.settings.sound") is False, (before, after))
        await pg.keyboard.press("KeyM")
        await pg.click("#btn-pause"); ok("pause button opens the pause menu", await pg.evaluate("__LL.mode") == "paused")
        await pg.uncheck("#opt-music"); ok("music toggle is saved", await pg.evaluate("JSON.parse(localStorage.getItem('lovelight-leap-save-v1')).settings.music") is False)
        await pg.check("#opt-music"); await pg.click("#btn-resume")
    else:
        ok("[mobile] touch buttons are shown", await pg.is_visible(".tbtn-jump") and await pg.is_visible("[data-act=left]"))
        box = await pg.locator("[data-act=right]").bounding_box()
        ok("[mobile] touch buttons are big enough to tap (>= 48px)", box["width"] >= 48 and box["height"] >= 48, box)
        x0 = await pg.evaluate("__LL.world.player.x")
        await pg.dispatch_event("[data-act=right]", "pointerdown", {"pointerId": 1, "pointerType": "touch"})
        await pg.wait_for_timeout(450)
        await pg.dispatch_event("[data-act=right]", "pointerup", {"pointerId": 1, "pointerType": "touch"})
        x1 = await pg.evaluate("__LL.world.player.x")
        ok("[mobile] touch right button runs", x1 - x0 > 30, (x0, x1))
        y0 = await pg.evaluate("__LL.world.player.y")
        await pg.dispatch_event("[data-act=jump]", "pointerdown", {"pointerId": 2, "pointerType": "touch"})
        await pg.wait_for_timeout(250)
        y1 = await pg.evaluate("__LL.world.player.y")
        await pg.dispatch_event("[data-act=jump]", "pointerup", {"pointerId": 2, "pointerType": "touch"})
        ok("[mobile] touch jump button jumps", y0 - y1 > 25, (y0, y1))
        await pg.tap("#btn-pause"); await pg.wait_for_timeout(150)
        ok("[mobile] pause button works by tap", await pg.evaluate("__LL.mode") == "paused")
        await pg.tap("#btn-resume")
    ok(f"[{view}] no page overflow during play", await overflow(pg) <= 0)
    # level complete through the UI using the solver route
    await start_play(pg, 0, "{noEnemies:true}")
    await pg.evaluate(f"__LL.autoplay({json.dumps(ROUTE0)})")
    await pg.wait_for_function("__LL.mode==='complete'", timeout=90000)
    await pg.wait_for_timeout(1500)
    ok(f"[{view}] world 1 completes and shows the results", await pg.is_visible("#scr-complete"))
    stars = await pg.locator("#complete-stars span.on").count()
    ok(f"[{view}] stars shown match the result", stars == await pg.evaluate("__LL.world.result.stars"), stars)
    await axe(pg, f"{view} world clear")
    sv = await pg.evaluate("JSON.parse(localStorage.getItem('lovelight-leap-save-v1'))")
    ok(f"[{view}] progress saved: world 2 unlocked, stars and high score stored", sv["unlocked"] == 2 and sv["levels"]["rose-garden"]["stars"] >= 1 and sv["highScore"] > 0, sv)
    score = await pg.evaluate("__LL.world.score")
    await pg.click("#btn-next"); await pg.wait_for_function("__LL.mode==='play' && __LL.world.index===1", timeout=5000)
    ok(f"[{view}] next world keeps the score and lives", await pg.evaluate("__LL.world.score") == score and await pg.evaluate("__LL.world.lives") == 3)
    # reload keeps progress
    await pg.reload(); await pg.wait_for_timeout(600)
    ok(f"[{view}] after reload: Continue button and saved stars", await pg.is_visible("#btn-continue") and "World 2" in (await pg.text_content("#btn-continue")) and not (await pg.text_content("#title-stars")).startswith("0 "))
    # game over
    await start_play(pg, 1)
    await pg.wait_for_timeout(300)
    await pg.evaluate("(()=>{const w=__LL.world; w.lives=1; w.player.x=15.5*16; w.player.y=230; w.player.vy=3;})()")
    await pg.wait_for_function("__LL.mode==='gameover'", timeout=10000); await pg.wait_for_timeout(400)
    ok(f"[{view}] game over screen after the last life", await pg.is_visible("#scr-gameover"))
    await pg.click("#btn-retry"); await pg.wait_for_function("__LL.mode==='play'", timeout=5000)
    ok(f"[{view}] try again restarts the world with 3 lives", await pg.evaluate("__LL.world.lives") == 3 and await pg.evaluate("__LL.world.index") == 1)
    # boss and reunion: exact replay of the bot run
    await start_play(pg, 3, "{noEnemies:true}")
    await pg.evaluate(f"__LL.autoplay({json.dumps(FINAL)})")
    await pg.wait_for_function("__LL.world.boss.active", timeout=60000)
    ok(f"[{view}] boss fight starts and the arena locks", await pg.evaluate("__LL.world.arenaLocked"))
    await pg.wait_for_function("__LL.world.boss.cheered", timeout=60000)
    ok(f"[{view}] boss is cheered up by heart arrows and the gate opens", await pg.evaluate("__LL.world.gateOpen"))
    await pg.wait_for_function("__LL.mode==='ending'", timeout=60000); await pg.wait_for_timeout(600)
    ok(f"[{view}] reunion ending screen", await pg.is_visible("#scr-ending"))
    ok(f"[{view}] finishing the game is saved", await pg.evaluate("JSON.parse(localStorage.getItem('lovelight-leap-save-v1')).finished") is True)
    await axe(pg, f"{view} ending")
    ok(f"[{view}] no console errors, failed requests or warnings", not errs, errs[:5])
    ok(f"[{view}] zero requests to other sites", not ext, ext[:5])
    await ctx.close()

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(executable_path=os.environ.get("CHROME") or None, args=["--no-sandbox"])
        for v in ("desktop", "mobile"): await run_view(br, v)
        # reduced motion: no screen shake
        ctx, pg, errs, ext = await newpage(br, "desktop", motion="reduce")
        await start_play(pg, 0); await pg.wait_for_timeout(300)
        await pg.evaluate("(()=>{const w=__LL.world; __LL.engine.hurt(w, w.player.x+20);})()")
        await pg.wait_for_timeout(50)
        ok("reduced motion: getting hurt does not shake the screen", await pg.evaluate("__LL.vis.shake") == 0)
        await pg.evaluate("__LL.title()"); await pg.wait_for_timeout(300)
        ok("reduced motion: no errors", not errs, errs)
        await ctx.close()
        # landscape phone
        ctx = await br.new_context(viewport=dict(width=844, height=390), device_scale_factor=3, is_mobile=True, has_touch=True)
        pg = await ctx.new_page(); await pg.goto(BASE); await pg.wait_for_timeout(500)
        await pg.evaluate("__LL.start(0)"); await pg.wait_for_timeout(300)
        fb = await pg.locator("#frame").bounding_box()
        ok("landscape phone: game fills the height and touch buttons overlay it", fb["height"] > 300 and await pg.is_visible(".tbtn-jump"), fb)
        ok("landscape phone: no overflow", await overflow(pg) <= 0)
        await ctx.close(); await br.close()
    print(f"\n{sum(1 for _, c in results if c)}/{len(results)} browser checks passed")
    if problems: print("FAILED:", problems); sys.exit(1)
asyncio.run(main())
