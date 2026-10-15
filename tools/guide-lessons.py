# Elenco delle immagini della Guida: ogni voce costruisce la scena nell'app e salva un WebP in tools/guide-shots.
# Vuoto per ora: la Guida usa le immagini di helpimg.js. Aggiungi una funzione con @shot per crearne di nuove.
import importlib.util, os, sys
_spec = importlib.util.spec_from_file_location('gs', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'guide-shots.py'))
gs = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(gs)
spec, SCENE, FULL = gs.spec, gs.SCENE, gs.FULL
SHOTS = {}
def shot(f): SHOTS[f.__name__.replace('_', '-')] = f; return f
