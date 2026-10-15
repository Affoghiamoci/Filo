#!/usr/bin/env python3
"""Immagini della Guida: si costruiscono nell'app vera con Playwright, quindi nessuna risorsa esterna.
Uso: node build.mjs && python3 tools/guide-shots.py [nome ...]   (senza nomi: tutte)
Crea tools/guide-shots/<nome>.webp; poi: node tools/pack-help-images.mjs per metterle in src/helpimg2.js"""
import os, sys, io
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file://' + ROOT + '/dist/forma.html'
OUT = os.path.join(ROOT, 'tools', 'guide-shots')
HIDE = "#side,#props,#topbar,#viewcube,#bar,#layers,#history,#toast,#tip,#hpop,#ruler-card,#perf-note{display:none!important}"
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"]
SCENE = (1200, 680)   # scena senza interfaccia
FULL = (1440, 900)    # interfaccia intera

def save(png_bytes, name, size=None, q=84):
    im = Image.open(io.BytesIO(png_bytes)).convert('RGB')
    if size: im = im.resize(size, Image.LANCZOS)
    im.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=q, method=6)
    print('ok', name, im.size, os.path.getsize(os.path.join(OUT, name + '.webp')) // 1024, 'KB')

class Shots:
    def __init__(self, p, lang='it'):
        self.p, self.lang = p, lang
        self.b = p.chromium.launch(args=ARGS)
        self.pg = None

    def open(self, size):
        if self.pg: self.pg.context.close()
        ctx = self.b.new_context(viewport={'width': size[0], 'height': size[1]}, color_scheme='light')
        ctx.add_init_script("try{localStorage.setItem('forma.theme','light');localStorage.setItem('forma.lang','%s')}catch(e){}" % self.lang)
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: print('PAGEERROR', e))
        pg.goto(URL); pg.wait_for_function("window.forma && document.documentElement.classList.contains('ui-ready')", timeout=30000)
        pg.wait_for_timeout(500)
        self.pg = pg
        return pg

    def scene(self, name, setup, size=SCENE, view=None, out=None, fit=True):
        """scena senza interfaccia: setup è codice JS eseguito nell'app"""
        pg = self.open(size)
        pg.evaluate(setup)
        if view: pg.evaluate("v=>{const b=[...document.querySelectorAll('#bar [data-view]')].find(x=>x.dataset.view===v);b&&b.click()}", view)
        if fit: pg.evaluate("forma.fitView()")
        pg.add_style_tag(content=HIDE)
        pg.wait_for_timeout(900)
        save(pg.screenshot(), name, out)

    def ui(self, name, setup, clip, size=FULL, out=None, after=None):
        """interfaccia intera, ritagliata; una versione per lingua (nome e nome-en)"""
        for lang, suf in (('it', ''), ('en', '-en')):
            self.lang = lang
            pg = self.open(size)
            pg.evaluate(setup)
            pg.evaluate("forma.fitView()")
            pg.add_style_tag(content='#toast,#tip{display:none!important}')
            pg.wait_for_timeout(900)
            if after: after(pg)
            x, y, w, h = clip
            save(pg.screenshot(clip={'x': x, 'y': y, 'width': w, 'height': h}), name + suf, out)
        self.lang = 'it'

    def combo(self, name, setup, parts, size=FULL, gap=8, out=None, zoom_out=0):
        """più ritagli dell'interfaccia affiancati in un'immagine sola (una per lingua). parts: [(x,y,w,h), ...]"""
        for lang, suf in (('it', ''), ('en', '-en')):
            self.lang = lang
            pg = self.open(size)
            pg.evaluate(setup)
            pg.evaluate("forma.fitView()")
            pg.add_style_tag(content='#toast,#tip{display:none!important}')
            pg.wait_for_timeout(900)
            if zoom_out:
                pg.mouse.move(size[0] * 0.6, size[1] * 0.5); pg.mouse.wheel(0, zoom_out); pg.wait_for_timeout(700)
            ims = [Image.open(io.BytesIO(pg.screenshot(clip={'x': x, 'y': y, 'width': w, 'height': h}))).convert('RGB') for (x, y, w, h) in parts]
            H = max(i.height for i in ims); W = sum(i.width for i in ims) + gap * (len(ims) - 1)
            canvas = Image.new('RGB', (W, H), (246, 246, 246)); x0 = 0
            for i in ims: canvas.paste(i, (x0, 0)); x0 += i.width + gap
            buf = io.BytesIO(); canvas.save(buf, 'PNG'); save(buf.getvalue(), name + suf, out)
        self.lang = 'it'

    def close(self): self.b.close()

def spec(items, select=None, ops=None):
    """items: lista di dict {kind,p,pos,hole,name}; il JS passa per loadExample, la stessa strada di "Prova ora" """
    import json
    return "forma.loadExample(%s)" % json.dumps({'it': 'x', 'en': 'x', 'items': items, 'select': select or [], 'ops': ops or []})

if __name__ == '__main__':
    import importlib.util
    spec = importlib.util.spec_from_file_location('lessons', os.path.join(ROOT, 'tools', 'guide-lessons.py'))
    mod = importlib.util.module_from_spec(spec); sys.modules['lessons'] = mod; spec.loader.exec_module(mod)
    want = set(sys.argv[1:])
    with sync_playwright() as p:
        S = Shots(p)
        for name, fn in mod.SHOTS.items():
            if not want or name in want: fn(S)
        S.close()
