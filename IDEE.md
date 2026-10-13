# Forma · idee future

## Accantonato (deciso il 13/10/2026: "per ora è già oltre")
### 1. Perni e fori di giunzione (da fare per primo)
- Sul lato selezionato: "Aggiungi perno" (cilindro, punta smussata opzionale).
- Sull'altro pezzo: "Aggiungi foro" corrispondente, con tolleranza automatica (~0,2 mm per PLA).
- Parametri: diametro, lunghezza, gioco.
- Usa cilindri, fori e CSG già presenti.

### 2. Filettature
- Vite + dado parametrici generati da un'elica (non filettatura su foro qualsiasi).
- Misure standard M3, M4, M5, M6, M8; gioco regolabile (0,3–0,4 mm per M8 in PLA).
- Attenzione: geometria pesante, CSG sulle eliche lento/instabile; va provata in stampa.
- Per inserti a caldo o viti autofilettanti basta un foro dritto del diametro giusto.

## Altre idee in sospeso
- Estrusione di profili 2D
- Pacchettizzare come app Mac (Tauri/Electron)
- Livelli: visibilità, blocco, riordino con trascinamento
- Controllo aggiornamenti da GitHub
- Selettore asse X/Y/Z per spostare lati curvi

## Spigolo (fatto in 0.6.x)
Raccordo e smusso su spigoli convessi (catene tangenti, anche anelli di cilindri/coni). Da fare: spigoli concavi (raccordo interno), anteprima in tempo reale, misura massima consigliata.
