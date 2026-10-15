# Elenco delle immagini della Guida: ogni voce costruisce la scena nell'app e salva un WebP.
import importlib.util, os, sys
_spec = importlib.util.spec_from_file_location('gs', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'guide-shots.py'))
gs = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(gs)
spec, SCENE, FULL = gs.spec, gs.SCENE, gs.FULL
SHOTS = {}
def shot(f): SHOTS[f.__name__.replace('_', '-')] = f; return f

BOX = {'name': 'Scatola 1', 'kind': 'box', 'p': {'w': 40, 'd': 30, 'h': 20, 'r': 0}, 'pos': [0, 0, 0]}

HL = "forma.__hl=document.createElement('style');forma.__hl.textContent='#tools .tool[data-s=\"1\"][data-i=\"0\"]{outline:2px solid #ff6a00;outline-offset:-2px}';document.head.appendChild(forma.__hl)"

@shot
def l1_scatola(S):      # "Scatola" evidenziata nella barra + la scatola sul piatto
    S.combo('l1-scatola', spec([{**BOX, 'p': {'w': 30, 'd': 30, 'h': 20, 'r': 0}}], select=[0]) + ";" + HL,
            [(12, 330, 292, 330), (360, 300, 720, 330)], out=(816, 264), zoom_out=500)

@shot
def l1_pannello(S):     # pannello proprietà: posizione e misure
    S.ui('l1-pannello', spec([BOX], select=[0]), (1160, 200, 280, 250))

@shot
def l1_misure(S):       # scatola con le misure scritte sopra
    S.scene('l1-misure', spec([BOX]) + ";forma.setDims(true)")
