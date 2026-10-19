// Traduzione IT ⇄ EN: i testi originali sono in italiano, l'inglese si applica al volo su tutto il DOM.
const EN = {
  'Posizione anche per gruppi e selezioni multiple': 'Position for groups and multiple selections too',
  'Spigoli singoli su scatola e prisma, non distruttivi: ogni spigolo ha il suo raggio o smusso e resta modificabile': 'Single edges on box and prism, non-destructive: each edge has its own radius or chamfer and stays editable',
  'Metro con ⌥: larghezza e altezza del lato sotto il mouse in tempo reale': 'Tape measure with ⌥: width and height of the face under the mouse in real time',
  'Distribuisci: spazi uguali tra tre o più oggetti; i pulsanti Allinea che non servono sono attenuati': 'Distribute: equal gaps between three or more objects; unneeded Align buttons are dimmed',
  'larghezza × profondità': 'width × depth', 'larghezza × altezza': 'width × height', 'Tieni premuto ⌥ per vedere larghezza e altezza del lato sotto il mouse, e gli angoli se passi su un angolo o uno spigolo.': 'Hold ⌥ to see the width and height of the face under the mouse, and angles when you pass over a corner or an edge.',
  'Distribuisci': 'Distribute', 'Per distribuire servono almeno 3 oggetti': 'You need at least 3 objects to distribute',
  'Servono almeno 3 oggetti': 'At least 3 objects needed', 'Con un solo oggetto in altezza si può solo appoggiare al piatto': 'With one object, height can only rest on the bed',
  'Spigolo: sposta uno spigolo trascinando la maniglia o scrivendo i mm, per inclinare o allungare una faccia (da cubo a trapezio)': 'Edge: move an edge by dragging the handle or typing mm, to tilt or lengthen a face (cube to trapezoid)',
  'Sposta lo spigolo': 'Move the edge', 'Sposta': 'Move',
  "Trascina il quadratino sullo spigolo oppure scrivi di quanto spostarlo (negativo per l'altro verso). La faccia si inclina o si allunga: da un cubo si ottiene un trapezio. Il pezzo diventa libero, non più parametrico.": 'Drag the square on the edge or type how far to move it (negative for the other way). The face tilts or lengthens: a cube becomes a trapezoid. The piece becomes free, no longer parametric.',
  'Questo spigolo è arrotondato: per spostarlo togli prima l\'arrotondamento': 'This edge is rounded: remove the rounding first to move it',
  'Scrivi di quanti mm spostare lo spigolo': 'Type how many mm to move the edge',
  'Questa direzione è lungo lo spigolo: scegline un\'altra': 'That direction runs along the edge: pick another one',
  'Taglia e Allunga: il piano si trascina con il mouse': 'Cut and Stretch: the plane can be dragged with the mouse',
  'come prima': 'as before', 'parallelo': 'parallel', 'allineato': 'aligned',
  'Calamita anche sullo spostamento degli spigoli: torna com\'era, si allinea ai vertici paralleli e agli altri oggetti': 'Magnet also on edge moving: back to where it was, aligns to parallel vertices and other objects',
  'Elenco strumenti compatto sulle finestre basse e sfumatura che segnala i pannelli che scorrono': 'Compact tool list on short windows and a fade that shows scrollable panels',
  "Ripeti: Spazio tra le copie al posto del passo (ingombro reale più spazio); nido d'ape con Spazio Y modificabile": 'Repeat: Gap between copies instead of step (real size plus gap); honeycomb with editable Gap Y',
  'Scatto a tendina, con 0,1 mm e Libero (senza aggancio)': 'Step as a dropdown, with 0.1 mm and Free (no snapping)',
  'Calamita: aggancio agli angoli e ai lati degli altri oggetti, a contatto o a filo, anche su modelli con molti fori; si spegne dalla barra o con ⌘+⌥ premuti insieme': 'Magnet: snaps to the corners and sides of other objects, touching or flush, even on models with many holes; switch it off from the bar or hold ⌘+⌥ together',
  'Distanza: anteprima del punto preso, aggancio a angoli, metà lato e lati': 'Distance: preview of the picked point, snapping to corners, edge midpoints and edges',
  'Strumento Allunga (U): sposta una parte oltre un piano per allungarla o accorciarla': 'Stretch tool (U): moves a part beyond a plane to lengthen or shorten it',
  'Barra di lavoro durante le operazioni pesanti (Combina, Taglia, Ripeti); Combina con molti fori fino a 2,5 volte più veloce': 'Progress bar during heavy operations (Combine, Cut, Repeat); Combine with many holes up to 2.5 times faster',
  'Riparazione automatica delle crepe lasciate da Combina e Taglia (giunzioni a T)': 'Automatic repair of cracks left by Combine and Cut (T-junctions)',
  'Angoli e bordi anche per cilindro, cono e prisma (angoli verticali solo per il prisma)': 'Corners and edges for cylinder, cone and prism too (vertical corners for the prism only)',
  'Strumento Taglia (K): piano su X, Y o Z con posizione in mm o con un clic sull\'oggetto; il risultato sono due livelli separati': 'Cut tool (K): plane on X, Y or Z with a position in mm or a click on the object; the result is two separate layers',
  'Taglia': 'Cut', 'Allunga': 'Stretch', 'Applica': 'Apply', 'Sposta di (mm)': 'Move by (mm)', 'Allunga o accorcia una parte, da un piano in poi': 'Stretch or shorten a part, from a plane onwards', 'Trascina il piano per scegliere da dove. Tutto ciò che sta oltre il piano si sposta: positivo allunga, negativo accorcia. Va meglio su parti con sezione costante, come un manico.': 'Everything beyond the plane moves: positive stretches, negative shortens. Works best on parts with a constant cross-section, like a handle.', 'Allungo la parte…': 'Stretching the part…', 'Seleziona l\'oggetto da allungare, poi scegli il piano': 'Select the object to stretch, then choose the plane', 'Scrivi di quanti millimetri allungare (negativo per accorciare)': 'Enter how many millimetres to stretch (negative to shorten)', 'Combino gli oggetti…': 'Combining objects…', 'Taglio l\'oggetto…': 'Cutting the object…', 'Creo le copie…': 'Creating copies…', 'Importo il file…': 'Importing the file…', 'Taglia un oggetto con un piano': 'Cuts an object with a plane', 'Scegli l\'asse e la posizione del piano, oppure clicca sull\'oggetto per metterlo lì. Il risultato sono due oggetti separati.': 'Choose the axis and position of the plane, or click the object to put it there. The result is two separate objects.', 'Oggetto tagliato in due': 'Object cut in two', 'Il piano non attraversa nessun oggetto selezionato': 'The plane does not cross any selected object', 'Seleziona l\'oggetto da tagliare, poi scegli il piano': 'Select the object to cut, then choose the plane',
  'Strumenti Riquadro (Q) e Lazo (W): selezionano ciò che toccano, solo le parti visibili (tutto con Raggi X); ⇧ aggiunge': 'Marquee (Q) and Lasso (W) tools: select what they touch, visible parts only (everything with X-ray); ⇧ adds',
  'Calamita: gli oggetti si agganciano a angoli e lati degli altri. ⌘+⌥ premuti insieme la spengono per un trascinamento': 'Magnet: objects snap to the corners and sides of others. Hold ⌘+⌥ together to turn it off during a drag',
  'Calamita attiva': 'Magnet on', 'Selezionato 1 oggetto': 'Selected 1 object', 'Riquadro: da sinistra prende ciò che è tutto dentro, da destra anche ciò che tocchi': 'Marquee: drag right = fully enclosed, drag left = touching too', 'Lazo: prende gli oggetti con il centro dentro la linea': 'Lasso: picks objects whose centre is inside the line', 'Calamita spenta': 'Magnet off',
  'Pillola Beta con la versione e zoom più ravvicinato': 'Beta pill with the version and closer zoom',
  'Dopo Combina, le parti staccate diventano livelli separati; importando un file con più parti staccate, Filo propone di dividerle': 'After Combine, detached parts become separate layers; importing a file with several detached parts, Filo offers to split them',
  'Dimenticare le impostazioni di stampa?': 'Forget the print settings?', 'Cosa fa.': 'What it does.', 'Cosa non cambia.': 'What stays the same.', 'Dopo.': 'Afterwards.',
  "Cancella da questo browser le impostazioni di stampa che Filo aveva memorizzato dall'ultimo 3MF di Bambu Studio importato: stampante, profilo di qualità, filamento, riempimento, pareti, supporti, temperature e velocità.": 'Deletes from this browser the print settings Filo stored from the last Bambu Studio 3MF you imported: printer, quality profile, filament, infill, walls, supports, temperatures and speeds.',
  'Il tuo modello e i file già esportati restano come sono. Non viene toccato nulla in Bambu Studio.': 'Your model and the files you already exported stay as they are. Nothing in Bambu Studio is touched.',
  'I nuovi 3MF escono senza impostazioni, e Bambu Studio userà le sue. Per riaverle, importa di nuovo un 3MF di Bambu Studio.': 'New 3MF files come out without settings, and Bambu Studio will use its own. To get them back, import a Bambu Studio 3MF again.',
  'Livelli, Cronologia, pannello laterale e barra in basso non si sovrappongono più': 'Layers, History, the side panel and the bottom bar no longer overlap',
  'Frammenti senza volume (resti di un testo inciso portato a filo) tolti in automatico: lo slicer non dà più errore': 'Zero-volume fragments (leftovers of engraved text pushed flush) are removed automatically: the slicer no longer errors',
  'Mantieni le impostazioni di stampa': 'Keep print settings', 'Stampante, qualità e filamento restano quelli del file importato. Ricontrolla supporti e colori dei pezzi.': 'Printer, quality and filament stay as in the imported file. Check supports and part colors.', 'Dimentica': 'Forget', 'Esporta 3MF mantenendo le impostazioni di stampa del file importato (Bambu Studio)': 'Export 3MF keeping the print settings of the imported file (Bambu Studio)',
  'Barra in basso in sezioni (Vista, Mostra, Scatto, Piano di lavoro, Pannelli), con icone e scorciatoie al passaggio del mouse': 'Bottom bar in sections (View, Show, Step, Workspace, Panels), with icons and shortcuts on hover', 'Scatto di spostamento e distanza della griglia separati': 'Move step and grid spacing now separate', 'Vista attiva evidenziata nella barra': 'Active view highlighted in the bar', 'Livelli: ⌘ + clic seleziona un intervallo': 'Layers: ⌘ + click selects a range',
  'Distanza griglia': 'Grid spacing',
  'Distanza tra i punti della griglia': 'Spacing of the grid points',
  '⇧ aggiunge · ⌘ seleziona un intervallo': '⇧ adds · ⌘ selects a range', 'Piatto di stampa': 'Print bed', 'Libero': 'Free', 'senza aggancio': 'no snapping', 'fine': 'fine', 'standard': 'standard', 'Di quanto si sposta un oggetto': 'How far an object moves', 'Scatto di spostamento': 'Move step', 'Scatto: libero': 'Step: free', 'fitta': 'dense', 'media': 'medium', 'larga': 'wide', 'Scatto': 'Step', 'Scatto mm': 'Step mm',
  'Di quanto si sposta un oggetto, in mm': 'How far an object moves, in mm',
  'Filo · modellatore 3D semplice': 'Filo · simple 3D modeler',
  // barra laterale
  'Strumenti': 'Tools', 'Forme': 'Shapes', 'Modifica': 'Edit', 'Modelli': 'Templates',
  '[1] Strumenti': '[1] Tools', '[2] Forme': '[2] Shapes', '[3] Modifica': '[3] Edit', '[4] Modelli': '[4] Templates',
  'Riquadro': 'Marquee', 'Seleziona trascinando un riquadro': 'Select by dragging a box', 'Lazo': 'Lasso', 'Seleziona disegnando una linea libera': 'Select by drawing a free line', 'Il file ha più parti staccate': 'The file has several detached parts', 'Tieni unito': 'Keep together', 'Dividi in livelli': 'Split into layers', 'Mano': 'Hand', 'Ruota': 'Rotate', 'Lato': 'Face',
  'Spigolo': 'Edge', 'Arrotonda o smussa uno spigolo': 'Round or chamfer an edge', 'Arrotonda, smussa o sposta uno spigolo': 'Round, chamfer or move an edge', 'Scorri per vedere altro': 'Scroll to see more', 'Parametri forma': 'Shape settings', 'Altro sotto: scorri': 'More below: scroll', 'Arrotondato': 'Rounded', 'Smussato': 'Chamfered', 'Smusso': 'Chamfer', 'Tipo': 'Type', 'Misura': 'Size', 'spigolo': 'edge', 'spigoli': 'edges', 'Clicca uno spigolo del pezzo. Maiusc + clic: aggiungi o togli spigoli.': 'Click an edge of the part. Shift + click: add or remove edges.', 'Scegli il tipo e la misura, poi Applica.': 'Pick the type and size, then Apply.', 'Arrotondato: spigolo tondo. Smussato: taglio a 45°.': 'Rounded: round edge. Chamfered: 45° cut.', 'Scrivi una misura in mm': 'Enter a size in mm', 'Questo spigolo è troppo particolare per un raccordo': 'This edge is too unusual for a fillet', 'Il risultato è vuoto: la misura è troppo grande': 'The result is empty: the size is too large', 'Scatola': 'Box', 'Cilindro': 'Cylinder', 'Sfera': 'Sphere', 'Cono': 'Cone', 'Prisma': 'Prism', 'Toro': 'Torus', 'Cima %': 'Top %', 'Lati': 'Sides', 'Spessore %': 'Thickness %', 'Forma': 'Shape', 'Cono o tronco di cono': 'Cone or truncated cone', 'Esagono, ottagono e altri poligoni': 'Hexagon, octagon and other polygons', 'Anello per guarnizioni e maniglie': 'Ring for gaskets and handles',
  'Foro / Solido': 'Hole / Solid', 'Combina': 'Combine', 'Separa': 'Separate', 'Divide le parti staccate in livelli distinti': 'Splits detached parts into separate layers', 'È già un pezzo unico: non ci sono parti da separare': 'Already a single piece: nothing to separate', 'Parti separate: le trovi nei Livelli (F7)': 'Parts separated: find them in Layers (F7)', 'Raggruppa': 'Group', 'Duplica': 'Duplicate', 'Elimina': 'Delete',
  'Scatolina con coperchio': 'Box with lid',
  'Seleziona e sposta. ⇧ + trascina blocca un asse, ⌘ + trascina sposta in altezza, Alt + trascina duplica. Nel vuoto ruota la vista.': 'Select and move. ⇧ + drag locks the axis, ⌘ + drag moves up and down (Z), Alt + drag duplicates. Drag in empty space to orbit the view.',
  'Sposta la vista. Tieni premuto Spazio per usarla al volo.': 'Pan the view. Hold Space to use it on the fly.',
  'Ruota gli oggetti selezionati: trascina un anello (rosso X, verde Y, blu Z). Scatta ogni 15°, ⇧ ogni 5°, Alt libero.': 'Rotate the selection: drag a ring (red X, green Y, blue Z). Snaps every 15°, ⇧ every 5°, Alt for free rotation.',
  'Seleziona un lato piatto (⇧ + clic per più lati): spingilo, tiralo o applicagli una texture.': 'Select a flat face (⇧ + click for several): push it, pull it or give it a texture.',
  'Aggiunge un blocco. Trascina le maniglie per allungarlo o usa i campi a destra.': 'Adds a block. Drag the handles to stretch it or use the fields on the right.',
  'Aggiunge un cilindro: perfetto per ganci, perni e fori tondi.': 'Adds a cylinder: perfect for hooks, pins and round holes.',
  'Aggiunge una sfera, anche schiacciabile in ellissoide.': 'Adds a sphere, which can also be squashed into an ellipsoid.',
  'Trasforma l’oggetto in un foro: quando combini, scava negli altri.': 'Turns the object into a hole: when you combine, it cuts into the others.',
  'Unisce i solidi selezionati e sottrae i fori. Seleziona con ⇧ + clic.': 'Merges the selected solids and subtracts the holes. Select with ⇧ + click.',
  'Tratta più oggetti come uno solo: si selezionano e si muovono insieme. ⇧⌘G li separa.': 'Treats several objects as one: they select and move together. ⇧⌘G ungroups them.',
  'Crea una copia dell’oggetto selezionato.': 'Makes a copy of the selected object.',
  'Rimuove gli oggetti selezionati.': 'Removes the selected objects.',
  'Corpo e coperchio con le misure che scegli, pronti da stampare.': 'Body and lid with the sizes you choose, ready to print.',
  'Riduci o espandi la barra (Tab)': 'Collapse or expand the sidebar (Tab)',
  'Riduci o espandi la barra laterale': 'Collapse or expand the sidebar',
  // pannelli
  'Solido': 'Solid', 'Foro': 'Hole',
  'Posizione (mm)': 'Position (mm)', 'Posizione': 'Position', 'Misure (mm)': 'Size (mm)', 'Angoli arrotondati': 'Rounded corners', 'Raggio': 'Radius',
  'Rotazione (°)': 'Rotation (°)', 'Ruota di 90°': 'Rotate by 90°',
  'In altezza il piatto è solo la base': 'In height the plate is only the base',
  'Rilascia per importare': 'Drop to import', 'File 3MF o STL': '3MF or STL file',
  'Colore': 'Color', 'Predefinito': 'Default',
  'Testo': 'Text', 'Scrivi qui': 'Type here', 'Dim.': 'Size', 'Sp.': 'Depth', 'Lett.': 'Spacing',
  '+ Carica font…': '+ Load font…', 'File 3MF, STL o SVG': '3MF, STL or SVG file',
  'Scrive un testo in 3D: scegli font, dimensione e spessore. Puoi caricare i tuoi font (TTF, OTF, WOFF). Come foro, incide.': 'Writes 3D text: pick font, size and thickness. You can load your own fonts (TTF, OTF, WOFF). As a hole, it engraves.',
  'WOFF2 non è supportato: usa TTF, OTF o WOFF': 'WOFF2 is not supported: use TTF, OTF or WOFF',
  'Nome del file': 'File name', 'Esporta': 'Export', '3MF · consigliato': '3MF · recommended',
  'Seleziona e muovi gli oggetti': 'Select and move objects', 'Ruota con scatto a 15°': 'Rotate in 15° steps', 'Spingi o tira un lato piatto': 'Push or pull a flat face', 'Aggiunge un blocco': 'Adds a block', 'Aggiunge un cilindro': 'Adds a cylinder', 'Scrive testo 3D con font a scelta': '3D text in the font you choose', 'Aggiunge una sfera': 'Adds a sphere', 'Trasforma in foro per scavare': 'Turns into a hole to cut', 'Unisce i solidi, sottrae i fori': 'Merges solids, subtracts holes', 'Muove più oggetti come uno': 'Moves several objects as one', 'Copia l’oggetto selezionato': 'Copies the selected object', 'Rimuove la selezione': 'Removes the selection', 'Corpo e coperchio su misura': 'Custom body and lid',
  'Nuova guida: finestra grande con categorie, spiegazioni, screenshot e GIF (tasto ? o F1)': 'New guide: large window with categories, explanations, screenshots and GIFs (? or F1)',
  'Strumenti, scorciatoie e consigli per la stampa, con immagini e GIF.': 'Tools, shortcuts and printing tips, with images and GIFs.', 'Apri guida': 'Open guide',
  'Combina, Taglia, Allunga e spigoli ora usano Manifold: solidi sempre chiusi e fino a decine di volte più veloci': 'Combine, Cut, Stretch and edges now use Manifold: always-closed solids and up to tens of times faster',
  'Dall\'alto': 'Top view', 'Sezione: corpo e coperchio': 'Section: body and lid', 'Spessore delle pareti, a passi di 0,4 mm (una linea dell\'ugello)': 'Wall thickness, in 0.4 mm steps (one nozzle line)', 'Spazio tra coperchio e corpo: 0,3 mm per un incastro che scorre': 'Space between lid and body: 0.3 mm for a sliding fit', 'Raggio degli angoli verticali. 0 = spigoli vivi': 'Radius of the vertical corners. 0 = sharp edges',
  'angolo del lato': 'face angle', 'angolo tra i due lati': 'angle between the two faces',
  'Metro con ⌥ misura anche gli angoli (su un angolo di un lato, o tra i due lati di uno spigolo) e la lunghezza dei bordi, con una etichetta più chiara': 'Tape measure with ⌥ also measures angles (at a face corner, or between the two faces of an edge) and edge lengths, with a clearer label',
  'Lunghezza': 'Length',
  'Lo strumento Distanza si chiama ora Metro (tasto D)': 'The Distance tool is now called Tape measure (key D)',
  'Allunga e Accorcia con Manifold: la sezione viene estrusa esatta, anche sulle pareti inclinate; la taglierina si trascina senza vibrare; Ruota con tacche, alone e spicchio dell\'angolo': 'Stretch and Shorten with Manifold: the section is extruded exactly, even on slanted walls; the cutting plane drags without jitter; Rotate with ticks, halo and angle wedge',
  'In alternativa usa lo strumento Ruota (R). Gli anelli scattano ogni 15°.': 'Or use the Rotate tool (R). The rings snap every 15°.',
  'Copia la selezione in griglia, a nido d\'ape o in cerchio. Con un foro puoi fare una griglia di fori e poi usare Combina.': 'Copies the selection in a grid, honeycomb or circle. With a hole you can make a grid of holes and then use Combine.',
  'Trascina il quadratino arancione sul lato (si aggancia ai piani vicini) oppure scrivi i mm. Positivo tira fuori, negativo spinge dentro. Maiusc + clic per scegliere più lati.': 'Drag the orange square on the face (it snaps to nearby planes) or type the mm. Positive pulls out, negative pushes in. Shift + click to pick more faces.',
  'Arrotondato fa uno spigolo tondo. Smussato lo taglia in diagonale a 45°.': 'Rounded makes a round edge. Chamfered cuts it diagonally at 45°.',
  'Trascina il quadratino sullo spigolo, oppure scrivi di quanto spostarlo (un numero negativo lo sposta dall\'altra parte). Con un cubo puoi ottenere un trapezio. Dopo la modifica il pezzo non è più parametrico.': 'Drag the square on the edge, or type how far to move it (a negative number moves it the other way). With a cube you can make a trapezoid. After this the piece is no longer parametric.',
  'Trascina il quadratino arancione sull\'anello oppure scrivi la scala in percentuale. Va bene su un cerchio o su tutti gli spigoli di una faccia (Maiusc + clic per sceglierli). Su un cilindro, 50 % sul bordo alto lo trasforma in un cono tronco.': 'Drag the orange square on the ring or type the scale in percent. It works on a circle or on all the edges of a face (Shift + click to pick them). On a cylinder, 50 % on the top edge turns it into a truncated cone.',
  'Trascina il piano per scegliere da dove allungare. Tutto quello che sta oltre il piano si sposta: un numero positivo allunga, uno negativo accorcia.': 'Drag the plane to choose where to stretch from. Everything beyond the plane moves: a positive number stretches, a negative one shortens.',
  'Scegli l\'asse e la posizione del piano. Puoi trascinare il piano o cliccare sull\'oggetto. Alla fine hai due oggetti separati.': 'Pick the axis and the plane position. You can drag the plane or click on the object. You end up with two separate objects.',
  'Clicca uno spigolo. Con Maiusc ne scegli più di uno.': 'Click an edge. Hold Shift to pick more than one.',
  'Direzione': 'Direction',
  'uguale all\'altro anello': 'same as the other ring',
  'Ridimensiona un anello con la calamita: si aggancia a 100 % e al raggio dell\'altro anello (da cono tronco a cilindro)': 'Resize a ring with the magnet: it snaps to 100 % and to the radius of the other ring (truncated cone back to cylinder)',
  
  
  
  'Spigolo: sposta uno spigolo (anche in perpendicolare sui lati storti, come l\'esagono) o ridimensiona un anello, con calamita': 'Edge: move an edge (also perpendicular on slanted sides, like a hexagon) or resize a ring, with magnet',
  
  'Controlla': 'Check', 'Controlla se il pezzo è pronto da stampare': 'Check if the piece is ready to print', 'Controlla stampa': 'Print check', 'Sto analizzando…': 'Analyzing…', 'Strato': 'Layer', 'Parete minima': 'Minimum wall', 'Sbalzi in rosso nel modello': 'Overhangs in red on the model', 'Stima indicativa: non sostituisce lo slicer.': 'Approximate estimate: it does not replace the slicer.',
  'Solido non chiuso': 'Solid not closed', 'ha crepe o facce sovrapposte, lo slicer potrebbe sbagliare. Rifai l\'ultima operazione o ricostruisci il pezzo.': 'has cracks or overlapping faces, the slicer may get it wrong. Redo the last operation or rebuild the piece.', 'Solido chiuso': 'Closed solid', 'Nessuna crepa: lo slicer lo legge come un oggetto pieno.': 'No cracks: the slicer reads it as a full object.',
  'Pezzo sospeso': 'Floating piece', 'parte non tocca il piatto': 'part does not touch the bed', 'parti non toccano il piatto': 'parts do not touch the bed', 'più in basso': 'lowest', 'Senza supporti non si stampa.': 'It cannot be printed without supports.', 'Parti separate ma tutte sul piatto': 'Separate parts, all on the bed', 'Poggia sul piatto': 'Sits on the bed', 'Base a contatto': 'Contact base',
  'Base molto piccola': 'Very small base', 'Poca superficie a contatto: il pezzo potrebbe staccarsi. Valuta un brim o un appoggio più largo.': 'Little contact area: the piece may come off. Consider a brim or a wider base.', 'Pareti sottili': 'Thin walls', 'In': 'In', 'strati controllati su': 'layers checked out of', 'ci sono parti sotto': 'there are parts below', 'prima a': 'first at', 'Scorri lo strato: sono in rosso.': 'Scroll the layer: they are in red.', 'Pareti abbastanza spesse': 'Walls thick enough', 'Niente sotto': 'Nothing below',
  'Sbalzi oltre 45°': 'Overhangs past 45°', 'servono probabilmente i supporti, o ruota il pezzo.': 'supports are probably needed, or rotate the piece.', 'pochi, di solito si stampano bene.': 'few, they usually print fine.', 'Nessuno sbalzo critico': 'No critical overhangs', 'Niente facce che sporgono troppo.': 'No faces that stick out too much.', 'strati': 'layers', 'alto': 'tall', 'parete sottile': 'thin wall',
  'Parete dritta (sposta anche sopra e sotto)': 'Straight wall (also moves above and below)',
  'Niente da controllare: aggiungi almeno un solido': 'Nothing to check: add at least one solid', 'Il motore non è pronto: riprova tra un attimo': 'The engine is not ready: try again in a moment', 'Non sono riuscito ad analizzare il pezzo': 'I could not analyze the piece',
  'Spigolo spostato di': 'Edge moved by',
  
  
  
  
  
  
  
  'Strati': 'Layers', 'Peso': 'Weight', 'Tempo': 'Time',
  
  'Trascina per spostare': 'Drag to move',
  "Riprendi": "Resume",
  "Ultimo lavoro salvato in questo browser.": "Last work saved in this browser.",
  "Elimina il lavoro salvato": "Delete the saved work",
  "adesso": "just now",
  "min fa": "min ago",
  "ora fa": "hour ago",
  "ore fa": "hours ago",
  "pezzo": "piece",
  "pezzi": "pieces",
  "Non c'è niente da riprendere": "There is nothing to resume",
  "Lavoro salvato eliminato": "Saved work deleted",
  "Ripreso l'ultimo lavoro": "Last work resumed",
  'Perpendicolare allo spigolo, verso l\'esterno': 'Perpendicular to the edge, outwards',
  
  
  
  
  
  
  'Strumento Spigolo (arrotonda e smussa), nuove forme (cono, prisma, toro)': 'Edge tool (round and chamfer), new shapes (cone, prism, torus)',
  'Tema chiaro, scuro o automatico, vista Raggi X, Ripeti in griglia, nido d\'ape e cerchio': 'Light, dark or automatic theme, X-ray view, Repeat in grid, honeycomb and circle',
  'Viste senza prospettiva, copia e incolla, esportazione 3MF riparata': 'Views without perspective, copy and paste, repaired 3MF export',
  'Modelli pesanti più fluidi e import 3MF di Bambu e Orca corretto': 'Smoother heavy models and fixed 3MF import from Bambu and Orca',
  'Cronologia con anteprima e Livelli con blocco e nascondi': 'History with preview and Layers with lock and hide',
  'Testo 3D con font tuoi e importazione SVG, colori per oggetto': '3D text with your own fonts and SVG import, color per object',
  'Ridimensionamento di gruppi e oggetti ruotati, blocco sull\'asse con Maiusc': 'Resizing of groups and rotated objects, axis lock with Shift',
  'Guida': 'Guide', 'Strumenti, scorciatoie e trucchi': 'Tools, shortcuts and tips', 'Guida (F1)': 'Guide (F1)',
  'Blocca': 'Lock', 'Sblocca': 'Unlock', 'Sblocca tutto': 'Unlock all', 'Sbloccato': 'Unlocked', 'Sbloccati': 'Unlocked', 'Nascondi': 'Hide',
  'Inizia': 'Start', 'Cosa vuoi creare?': 'What do you want to make?', 'Blocchi, cilindri, coni, poligoni e anelli da combinare e forare.': 'Blocks, cylinders, cones, polygons and rings to combine and cut.', 'Scrivi in 3D con 4 font a scelta o carica il tuo (TTF, OTF, WOFF).': 'Write in 3D with 4 fonts or load your own (TTF, OTF, WOFF).', 'Apri un 3MF o STL da modificare, oppure un SVG: diventa un solido da 1 mm. Puoi anche trascinare il file qui.': 'Open a 3MF or STL to edit, or an SVG: it becomes a 1 mm solid. You can also drop the file here.', 'Scatolina con coperchio su misura, pronta da stampare.': 'Custom box with lid, ready to print.', 'Scatolina': 'Small box',
  'Cronologia': 'History', 'Mostra o nascondi la cronologia (F8)': 'Show or hide the history (F8)',
  'Inizio': 'Start', 'Lato modificato': 'Face edited',
  'Chiaro': 'Light', 'Automatico': 'Auto', 'Scuro': 'Dark', 'Tema': 'Theme', 'Licenze': 'Licenses', 'Privacy': 'Privacy',
  'Filo usa software libero di terze parti, tutto open source e usabile liberamente, anche per scopi commerciali.': 'Filo uses third-party free software, all open source and free to use, including commercially.',
  'Testi completi delle licenze': 'Full license texts',
  'Appoggia sul piatto': 'Drop to plate', "Raddrizza sul lato piatto più vicino e porta l'oggetto a Z = 0": 'Straightens the object on its nearest flat side and moves it to Z = 0', 'Raddrizza la selezione sul lato piatto più vicino e portala a Z = 0': 'Straightens the selection on its nearest flat side and moves it to Z = 0',
  'Blocca le proporzioni': 'Lock proportions', 'Blocca le proporzioni: le tre misure cambiano insieme. Con Maiusc trascini senza proporzioni': 'Lock proportions: the three sizes change together. Hold Shift while dragging to resize freely',
  'Ruota di 90° attorno a X (⇧ per il verso opposto)': 'Rotate 90° around X (⇧ for the opposite direction)',
  'Ruota di 90° attorno a Y (⇧ per il verso opposto)': 'Rotate 90° around Y (⇧ for the opposite direction)',
  'Ruota di 90° attorno a Z (⇧ per il verso opposto)': 'Rotate 90° around Z (⇧ for the opposite direction)',
  'Oppure usa lo strumento Ruota (R): gli anelli scattano ogni 15°.': 'Or use the Rotate tool (R): the rings snap every 15°.',
  'Allinea': 'Align', 'Allinea a sinistra': 'Align left', 'Allinea a destra': 'Align right', 'Centra su X': 'Center on X',
  'Allinea davanti': 'Align front', 'Allinea dietro': 'Align back', 'Centra su Y': 'Center on Y',
  'Allinea alla base': 'Align to base', 'Allinea in alto': 'Align to top', 'Centra in altezza': 'Center vertically',
  'Spingi / tira': 'Push / pull', 'Di': 'By',
  '100 = prisma dritto. Meno di 100 restringe la cima, più di 100 la allarga: così nascono pomelli e ganci': '100 = straight prism. Below 100 narrows the top, above 100 widens it: this is how knobs and hooks are made',
  'Scala il lato': 'Scale the face',
  'Ingrandisce o rimpicciolisce il contorno del lato attorno al suo centro, e i lati vicini si inclinano: 50 lo dimezza, 150 lo allarga. Con Estrudi prima e Scala poi si fanno pomelli e ganci.': 'Grows or shrinks the outline of the face around its centre, and the neighbouring faces tilt: 50 halves it, 150 widens it. Extrude first and Scale after to make knobs and hooks.',
  'La scala funziona su un lato piatto alla volta': 'Scaling works on one flat face at a time',
  'Questo lato ha dei buchi o un contorno non chiuso: non lo posso ridimensionare': "This face has holes or an open outline: I can't resize it",
  'Lato ridimensionato': 'Face resized',
  'Lato: nuovo interruttore Allunga / Estrudi (con icone) e campo Scala per ridimensionare il lato': 'Face: new Stretch / Extrude switch (with icons) and a Scale field to resize the face',
  'Allunga segue sempre le linee del pezzo: se il lato sparirebbe, Filo dice la misura massima': 'Stretch always follows the lines of the piece: if the face would vanish, Filo tells you the maximum',
  'I numeri nei campi sono valori veri: Applica usa quello che vedi': 'The numbers in the fields are real values: Apply uses what you see',
  'Questa superficie curva non si può spostare in modo pulito: per allargare il pezzo usa le maniglie di Sposta (V)': "This curved surface can't be moved cleanly: to widen the piece use the Move (V) handles",
  'Motore nuovo: Allunga, Estrudi e i raccordi lavorano direttamente sulla forma del pezzo, con misure esatte e senza bordini o cuciture': 'New engine: Stretch, Extrude and fillets work directly on the shape of the piece, with exact sizes and no lips or seams',
  'Angolo a pallina dove tre spigoli raccordati dello stesso raggio si incontrano': 'Ball corner where three filleted edges with the same radius meet',
  'Raccordi anche quando lo spigolo arriva su un tetto o su più facce': 'Fillets also when the edge reaches a roof or several faces',
  'Righe e pareti sui pezzi a rotazione: righe in rilievo parametriche (numero, profondità, forma, torsione, margine) e Svuota con pareti di spessore costante': 'Ribs and walls on pieces of revolution: parametric raised ribs (count, depth, shape, twist, margin) and Hollow with walls of constant thickness',
  "Cono e cilindro possono allargarsi verso l'alto: Cima fino a 300 %": 'Cones and cylinders can widen upwards: Top up to 300 %',
  "Righe in rilievo e Svuota con l'anteprima: mentre cambi i valori vedi già il pezzo, Applica per confermare": 'Raised ribs and Hollow with a preview: you see the piece while changing the values, Apply to confirm',
  "Un vaso si fa unendo due coni e raccordando l'anello della pancia": 'A vase is made by joining two cones and filleting the ring of the belly',
  'Righe e pareti': 'Ribs and walls',
  'Righe in rilievo': 'Raised ribs',
  'Svuota': 'Hollow',
  'a metà': 'halfway',
  'Questo pezzo è troppo sottile per svuotarlo': 'This piece is too thin to hollow out',
  'Passi': 'Steps',
  'Messaggi': 'Messages',
  'Nessun messaggio': 'No messages',
  'Anteprima di Righe e Svuota con spigoli e Raggi X: con Raggi X acceso si vede la cavità prima di applicare': 'Ribs and Hollow preview with edges and X-ray: with X-ray on you see the cavity before applying',
  'Espandi': 'Expand',
  'Espandi (tasto destro): un pezzo parametrico diventa una forma fissa': 'Expand (right click): a parametric piece becomes a fixed shape',
  'Raggi X su tutte le forme: le parti coperte si vedono in trasparenza': 'X-ray on every shape: hidden parts show through',
  "Margine delle righe: fascia liscia dell'altezza scritta": 'Rib margin: a smooth band as tall as you write',
  'Questi pezzi sono già forme fisse': 'These pieces are already fixed shapes',
  'Espanso: ora è una forma fissa': 'Expanded: now it is a fixed shape',
  'Pezzo pieno': 'Solid piece',
  'Righe tolte': 'Ribs removed',
  'Spessore delle pareti. 0 = pieno': 'Wall thickness. 0 = solid',
  'Spessore del fondo': 'Bottom thickness',
  'Per i pezzi a rotazione (cilindri, coni, sfere, vasi, pezzi torniti importati) e per quelli che salgono dritti (scatole, prismi, forme unite alte uguali): righe in rilievo sulla parete esterna. Restano modificabili.': 'For pieces of revolution (cylinders, cones, spheres, vases, imported turned pieces) and straight-rising ones (boxes, prisms, joined shapes of the same height): raised ribs on the outer wall. They stay editable.',
  'Svuota il pezzo lasciando pareti di spessore costante, aperto in alto. Funziona sugli stessi pezzi delle Righe e resta modificabile. Parete 0 = pieno.': 'Hollows the piece leaving walls of constant thickness, open at the top. Works on the same pieces as Ribs and stays editable. Wall 0 = solid.',
  'Per i pezzi a rotazione (cilindri, coni, sfere, vasi, pezzi torniti importati) e per quelli che salgono dritti (scatole, prismi, forme unite alte uguali): righe in rilievo sulla parete esterna e pareti cave di spessore costante. Restano modificabili.': 'For pieces of revolution (cylinders, cones, spheres, vases, imported turned pieces) and for straight-rising ones (boxes, prisms, joined shapes of the same height): raised ribs on the outer wall and hollow walls of constant thickness. They stay editable.',
  'Righe e pareti anche su scatole, prismi e forme unite che salgono dritte: righe faccia per faccia con gli spigoli netti': 'Ribs and walls also on boxes, prisms and joined shapes that rise straight: ribs face by face with sharp corners',
  'Per i pezzi a rotazione (cilindri, coni, sfere, vasi fatti unendo coni e raccordi, pezzi torniti importati): righe in rilievo sulla parete esterna e pareti cave di spessore costante. Restano modificabili.': 'For pieces of revolution (cylinders, cones, spheres, vases made by joining cones and fillets, imported turned pieces): raised ribs on the outer wall and hollow walls of constant thickness. They stay editable.',
  'Quante righe': 'How many ribs',
  'Quante righe attorno al pezzo. 0 = liscio': 'How many ribs around the piece. 0 = smooth',
  "Quanto sporgono. Almeno 0,4 mm (una linea dell'ugello) perché si vedano in stampa": 'How far they stick out. At least 0.4 mm (one nozzle line) to show in print',
  'Tonde': 'Round',
  'A punta': 'Pointed',
  'Squadrate': 'Square',
  'Torsione': 'Twist',
  "Le righe girano a spirale di questi gradi dal basso all'alto": 'The ribs spiral by these degrees from bottom to top',
  'Margine': 'Margin',
  'Fascia liscia in alto e in basso, alta quanto scrivi': 'Smooth band at the top and bottom, as tall as you write',
  'Parete': 'Wall',
  'Svuota il pezzo lasciando pareti di questo spessore, aperto in alto. 0 = pieno': 'Hollows the piece leaving walls of this thickness, open at the top. 0 = solid',
  'Fondo': 'Bottom',
  'Spessore del fondo quando il pezzo è svuotato': 'Bottom thickness when the piece is hollowed',
  'Pezzo troppo pesante per ricostruirlo': 'Piece too heavy to rebuild',
  'Righe e pareti funzionano sui pezzi a rotazione (cilindri, coni, sfere, vasi): questo pezzo non lo è': 'Ribs and walls work on pieces of revolution (cylinders, cones, spheres, vases): this piece is not one',
  'Pezzo a rotazione, liscio': 'Piece of revolution, smooth',
  'Pezzo che sale dritto, liscio': 'Straight-rising piece, smooth',
  'Righe e Svuota funzionano sui pezzi a rotazione (cilindri, coni, vasi) e su quelli che salgono dritti (scatole, prismi): questo pezzo non lo è': 'Ribs and Hollow work on pieces of revolution (cylinders, cones, vases) and on straight-rising ones (boxes, prisms): this piece is neither',
  'Un attimo: il motore si sta ancora caricando': 'One moment: the engine is still loading',
  'Non riesco a calcolare le pareti': "I can't compute the walls",
  'Svuota funziona su un pezzo pieno, senza cavità': 'Hollow works on a solid piece, without cavities',
  'Svuota funziona su un pezzo con la cima piatta': 'Hollow works on a piece with a flat top',
  'Pareti troppo spesse per questo pezzo': 'Walls too thick for this piece',
  'Fondo troppo spesso per questo pezzo': 'Bottom too thick for this piece',
  'Modo': 'Mode', 'Estrudi': 'Extrude',
  "Allunga: il pezzo si allunga da quella parte seguendo le sue linee (i lati vicini proseguono con la loro inclinazione). Estrudi: dal lato esce un blocco dritto con la stessa sagoma (con un valore negativo scava) e i lati vicini restano com'erano.": "Stretch: the piece grows on that side following its own lines (the neighbouring faces keep their slope). Extrude: a straight block with the same outline grows from the face (a negative value digs) and the neighbouring faces stay as they were.",
  'Non riesco a estrudere questo lato: prova con Allunga': "I can't extrude this face: try Stretch",
  'Dopo ogni operazione le facce quasi complanari si fondono (meno linee e triangoli inutili)': 'After every operation nearly flat faces are merged (fewer lines and useless triangles)',
  'Trascina il quadratino arancione sul lato (si aggancia ai piani vicini) o scrivi i mm. Positivo: tira fuori. Negativo: spingi dentro.': 'Drag the orange square on the face (it snaps to nearby planes) or type the mm. Positive: pull out. Negative: push in.',
  '⇧ + clic: aggiungi o togli lati': '⇧ + click: add or remove faces',
  'Texture': 'Texture', 'Tubi': 'Tubes', 'Esagoni': 'Hexagons', 'Pallini': 'Dots',
  'Verticali': 'Vertical', 'Orizzontali': 'Horizontal', 'Rilievo': 'Raised', 'Incisione': 'Engraved',
  'Elementi per cm': 'Elements per cm', 'Profondità mm': 'Depth mm', 'Margine mm': 'Margin mm', 'Applica texture': 'Apply texture',
  'Troppi elementi: riduci gli elementi per cm.': 'Too many elements: lower the elements per cm.',
  'Nessun elemento: riduci il margine.': 'No elements: reduce the margin.',
  'Livelli': 'Layers', 'Chiudi': 'Close', 'Apri o chiudi': 'Open or close', 'chiave': 'key',
  'Separa il gruppo (⇧⌘G)': 'Ungroup (⇧⌘G)',
  'Nessun oggetto. Aggiungine uno dalla barra a sinistra.': 'No objects. Add one from the sidebar.',
  // barra bassa
  'Davanti': 'Front', 'Sopra': 'Top', 'Destra': 'Right', 'Misure': 'Size', 'Adatta': 'Fit', 'Griglia': 'Grid',
  'Piatto': 'Plate', 'Importa': 'Import', 'Esporta STL': 'Export STL',
  'Mostra le dimensioni reali': 'Show real dimensions', 'Adatta alla vista (al pezzo selezionato, se c’è)': 'Fit to view (to the selected piece, if any)', 'Passo della griglia': 'Grid step',
  'Mostra o nascondi i livelli (F7)': 'Show or hide layers (F7)', 'Dimensione del piatto di stampa': 'Print plate size',
  'Importa un file 3MF o STL (⌘O)': 'Import a 3MF or STL file (⌘O)',
  'Valore negativo per accorciare. Invio per applicare': 'Negative to shorten. Press Enter to apply',
  'allunga di': 'extend by',
  'cima': 'top', '100 = dritto, meno di 100 restringe la cima, più di 100 la allarga': '100 = straight, below 100 narrows the top, above 100 widens it',
  'sposta di': 'move by', 'estrudi di': 'extrude by', 'scala': 'scale', 'Anello': 'Ring',
  'Doppio clic su una maniglia: compare un campo per scrivere la misura (Sposta, Lato e Spigolo, tutti uguali)': 'Double-click a handle: a field appears to type the value (Move, Face and Edge all work the same)',
  'Inizia da una forma': 'Start from a shape',
  'Scegli Scatola, Cilindro o Sfera a sinistra, oppure crea una scatolina con coperchio dai Modelli.': 'Pick Box, Cylinder or Sphere on the left, or create a box with lid from Templates.',
  'Corpo e coperchio vengono affiancati, pronti da stampare sul piatto.': 'Body and lid are placed side by side, ready to print on the plate.',
  'Larghezza': 'Width', 'Profondità': 'Depth', 'Altezza': 'Height', 'Pareti': 'Walls', 'Gioco': 'Clearance', 'Angoli': 'Corners',
  'Annulla': 'Cancel', 'Crea': 'Create',
  'Info': 'Info',
  'Comandi': 'Controls',
  'Forza la rotella del mouse come zoom': 'Force the mouse wheel as zoom',
  'Filo è un modellatore 3D semplice per creare e modificare oggetti da stampare in 3D: forme di base, fori, testo, allineamenti e importazione di file 3MF, STL e SVG. Pensato per oggetti pratici come mollette, ganci e scatoline.': 'Filo is a simple 3D modeler for creating and editing objects to 3D print: basic shapes, holes, text, alignment and 3MF, STL and SVG import. Made for practical objects like clips, hooks and small boxes.',
  'Questa app è stata generata con l’ausilio dell’intelligenza artificiale.': 'This app was generated with the help of artificial intelligence.',
  'Controlla se è disponibile una versione più recente.': 'Check whether a newer version is available.',
  'Impossibile controllare ora: riprova più tardi.': 'Could not check right now: try again later.',
  'Hai già la versione più recente.': 'You already have the latest version.',
  'Modello complesso: per tenerlo fluido ho ridotto risoluzione, ombre e bordi. Per modificarlo conviene semplificarlo prima (Bambu Studio: tasto destro, Semplifica modello).': 'Complex model: to keep it smooth I lowered resolution, shadows and edges. Simplify it first to edit it (Bambu Studio: right click, Simplify model).',
  'a contatto': 'touching', 'angolo su angolo': 'corner to corner', 'Calamita tra lati: spostando un pezzo, lati e angoli vicini si agganciano a contatto': 'Snap: when moving a piece, nearby sides and corners snap together',
  'Angoli verticali': 'Vertical corners', 'Bordo alto': 'Top edge', 'Bordo basso': 'Bottom edge',
  'Ripeti': 'Repeat', "Nido d'ape": 'Honeycomb', 'Cerchio': 'Circle', 'Colonne': 'Columns', 'Righe': 'Rows', 'Spazio X': 'Gap X', 'Spazio Y': 'Gap Y', 'Copie': 'Copies', 'Angolo': 'Angle', 'Centro X': 'Center X', 'Centro Y': 'Center Y',
  'Versione in sviluppo': 'Version under development',
  'Le righe dispari sono spostate di mezzo passo': 'Odd rows are shifted by half a step',
  "Copia la selezione in righe e colonne, a nido d'ape o in cerchio. Usala con un foro per fare griglie di fori, poi Combina.": 'Copies the selection in rows and columns, honeycomb or a circle. Use it on a hole to make a grid of holes, then Combine.',
  'Seleziona prima un oggetto': 'Select an object first', "Con questi numeri non c'è nulla da copiare": 'Nothing to copy with these numbers',
  "Ripeti: copie in griglia, nido d'ape o in cerchio": 'Repeat: copies in a grid, honeycomb or circle',
  'Frecce su e giù nei campi numerici (⇧ per salti da 10 passi)': 'Up and down arrows in number fields (⇧ for 10-step jumps)',
  'Viste Davanti, Sopra e Destra senza prospettiva, per allineare con precisione': 'Front, Top and Right views without perspective, for precise alignment',
  'Arrotondamento applicato: resta modificabile dal pannello': 'Rounding applied: you can still edit it from the panel', 'Smusso applicato: resta modificabile dal pannello': 'Chamfer applied: you can still edit it from the panel', 'Questo spigolo è troppo particolare per arrotondarlo': 'This edge is too unusual to round',
  '0,5 mm': '0.5 mm', 'Esporta 3MF riparato (spigoli non chiusi o doppi), con Filo nei metadati': 'Repaired 3MF export (open or doubled edges), with Filo in the metadata', "Lato a filo con un'altra superficie (anche sul fondo di un testo inciso): le facce si fondono in una sola": 'Face pushed flush with another surface (even the floor of engraved text): the faces merge into one',
  'Modello molto pesante': 'Very heavy model', 'Questa operazione può bloccare il browser per diversi minuti. Conviene semplificarlo prima (in Bambu Studio: tasto destro, Semplifica modello). Continuare lo stesso?': 'This operation can freeze the browser for several minutes. It is better to simplify it first (in Bambu Studio: right click, Simplify model). Continue anyway?',
  'Copiato': 'Copied', 'Tagliato': 'Cut', 'Incollato': 'Pasted', 'Niente da incollare': 'Nothing to paste',
  'Copia, taglia e incolla (⌘C, ⌘X, ⌘V), anche sul posto (⌘⇧V)': 'Copy, cut and paste (⌘C, ⌘X, ⌘V), also in place (⌘⇧V)', 'Modelli molto pesanti più fluidi, con avviso': 'Smoother very heavy models, with a warning',
  'Angoli di rotazione più coerenti dopo i quarti di giro': 'More consistent rotation angles after quarter turns',
  'Meglio da computer': 'Better on a computer', 'Filo non è ottimizzato per il mobile: è pensato per mouse e tastiera, con scorciatoie e maniglie di precisione. Da telefono o tablet puoi guardarlo e provarlo, ma alcune cose saranno scomode.': 'Filo is not optimized for mobile: it is made for mouse and keyboard, with shortcuts and precision handles. On a phone or tablet you can look around and try it, but some things will be awkward.', 'Ho capito': 'Got it',
  'Avviso per chi apre Filo da mobile': 'Warning for people opening Filo on mobile',
  'Lato: non si può più spingere fino a spessore zero': 'Side tool: you can no longer push a side down to zero thickness',
  'Il lato arriverebbe a spessore zero: il pezzo sparirebbe. Usa una distanza minore': 'The side would reach zero thickness and the piece would vanish. Use a smaller distance',
  'Scanalature': 'Grooves', 'Tondo': 'Round', 'Onda': 'Wave', 'Quadro': 'Square', 'Incidi': 'Cut', 'Rialza': 'Raise', 'Passo': 'Pitch', 'Prof.': 'Depth', 'Margine dal bordo': 'Edge margin', 'Applica scanalature': 'Apply grooves',
  'Righe parallele su un lato piatto o su un cilindro (verticali o anelli). Misure in mm. Con margine 0 arrivano al bordo. Fora: tagli quadri che attraversano il pezzo, a filo. Solo su lati piatti e cilindri circolari, non su coni, sfere e tori.': 'Parallel lines on a flat side or a cylinder (vertical or rings). Sizes in mm. With margin 0 they reach the edge. Pierce: square cuts that go through the piece, flush. Only on flat faces and circular cylinders, not on cones, spheres and tori.',
  'Scanalature su lati piatti e cilindri, un clic dal pannello Lato': 'Grooves on flat sides and cylinders, one click from the Side panel',
  'Le scanalature funzionano sui lati piatti e sui cilindri': 'Grooves work on flat sides and cylinders',
  'Il lato è troppo piccolo per questo passo o margine': 'The side is too small for this pitch or margin',
  'Troppe scanalature: aumenta il passo': 'Too many grooves: increase the pitch',
  'Le scanalature funzionano su cilindri circolari (larghezza uguale a profondità)': 'Grooves work on circular cylinders (width equal to depth)',
  'Il cilindro è troppo basso per questo margine': 'The cylinder is too short for this margin',
  'Il cilindro è troppo basso per questo passo o margine': 'The cylinder is too short for this pitch or margin',
  'Nessuna scanalatura dentro la sagoma del lato': 'No grooves fit inside the shape of the side',
  'Esporta: un solo passaggio, con scelta del formato nella finestra': 'Export: a single step, with the format choice in the dialog',
  'Linea retta': 'Straight line', 'Raggi X': 'X-ray', 'Mostra i contorni delle parti coperte (Z)': 'Show the outlines of hidden parts (Z)',
  'Vista Raggi X (Z): mostra i contorni delle parti coperte': 'X-ray view (Z): shows the outlines of hidden parts',
  'Lato curvo di un cilindro: profilo pulito, senza fessure': 'Curved side of a cylinder: clean outline, no gaps',
  'Metro': 'Tape measure', 'Misura tra due punti o lati': 'Measure between two points or sides',
  'Clicca un punto o un lato, poi un secondo. Su due lati paralleli misura la distanza tra i piani.': 'Click a point or a side, then a second one. On two parallel sides it measures the distance between the planes.',
  'Ora clicca il secondo punto o lato.': 'Now click the second point or side.',
  'Distanza tra i due lati paralleli': 'Distance between the two parallel sides',
  'Strumento Distanza (D) e vista Raggi X (Z)': 'Distance tool (D) and X-ray view (Z)',
  'Scanalature su lati piatti e cilindri, anche per forare a filo': 'Grooves on flat faces and cylinders, also to cut flush through',
  'Cilindro: il lato è un pezzo unico, si allarga o si stringe trascinando': 'Cylinder: the side is a single piece, drag to widen or narrow it',
  'Spigoli ad anello (cerchi o tutti i lati di una faccia): si ridimensionano trascinando o in %': 'Ring edges (circles or all sides of a face): resize by dragging or in %',
  'Cubo di orientamento e lingua scelta dal menu iniziale': 'Orientation cube and language picker in the welcome menu',
  'Esporta in un solo passaggio': 'Export in a single step',
  'Modelli pesanti più fluidi, con un avviso quando riduco risoluzione e ombre, e import 3MF di Bambu e Orca corretto': 'Smoother heavy models, with a note when resolution and shadows are lowered, and correct Bambu and Orca 3MF import',
  'Lucchetto: Maiusc ridimensiona senza proporzioni': 'Lock: Shift resizes without proportions',
  'Angoli di rotazione più coerenti': 'More consistent rotation angles',
  'Le texture funzionano sui lati piatti': 'Textures only work on flat faces',
  "Nessun riempimento trovato nell'SVG (i soli contorni non sono supportati)": 'No fill found in the SVG (outlines only are not supported)',
  'È già un gruppo: ⇧⌘G per separarlo': 'Already a group: ⇧⌘G to ungroup it',
  'Cima % su scatola, cilindro e prisma (tronchi e coni)': 'Top % on box, cylinder and prism (frustums and cones)',
  '· nessuno selezionato': '· none selected', 'Cima': 'Top', 'Fora': 'Pierce', 'Fora a filo: le scanalature attraversano il pezzo': 'Cut flush through: the grooves go through the piece',
  'Non trovo il retro del pezzo: usa Incidi': "Can't find the back of the piece: use Cut", 'Un cilindro pieno non si può forare: usa Incidi': "A solid cylinder can't be pierced: use Cut",
  'Il lato curvo deve girare tutto intorno (cilindro circolare)': 'The curved side must go all the way around (circular cylinder)', 'Le scanalature funzionano solo su lati piatti e su cilindri circolari, non su coni, sfere e tori': 'Grooves only work on flat faces and circular cylinders, not on cones, spheres and tori',
  'Ridimensiona': 'Resize', 'Scala': 'Scale', "Trascina il quadratino arancione sull'anello oppure scrivi la scala. Funziona su un cerchio o su tutti gli spigoli di una faccia (Maiusc + clic). Sul bordo superiore di un cilindro, 50 % lo trasforma in un cono tronco.": 'Drag the orange square on the ring or type the scale. Works on a circle or on all the edges of a face (Shift + click). On the top edge of a cylinder, 50 % turns it into a truncated cone.',
  'Questi spigoli non formano un anello piano': 'These edges do not form a flat ring', 'Scrivi una scala in % (da 1 a 1000)': 'Enter a scale in % (1 to 1000)', 'Spigolo ridimensionato': 'Edge resized',
  'Spigolo ad anello: si ridimensiona in % (un cilindro diventa un cono)': 'Ring edge: resize it in % (a cylinder becomes a cone)',
  'Cilindro: il lato è un pezzo unico, si allarga con Lato e resta un cilindro modificabile': 'Cylinder: the side is a single piece, widen it with Side and it stays an editable cylinder',
  'Texture anche sui cilindri (canne, anelli, esagoni, punti)': 'Textures on cylinders too (tubes, rings, hexagons, dots)',
  'Strumento Distanza (D): misura tra due punti o due lati': 'Distance tool (D): measures between two points or two sides',
  'Cubo di orientamento: mostra da dove guardi e porta alla vista con un clic': 'Orientation cube: shows where you are looking from and jumps to a view with one click',
  'Dietro': 'Back', 'Sinistra': 'Left', 'Sotto': 'Bottom',
  'Lingua, tema e info in basso con lo stesso stile': 'Language, theme and info buttons at the bottom share the same style',
  'Numeri nei campi non più coperti dalle freccette': 'Numbers in fields no longer covered by the arrows',
  'Import 3MF: ignora i volumi modificatori dei file Bambu e Orca': '3MF import: ignores modifier volumes in Bambu and Orca files',
  'Contatore di visite anonimo sul sito ufficiale': 'Anonymous visit counter on the official site',
  'Sul sito ufficiale Filo conta solo le visite in forma anonima. Nessun dato personale, nessun cookie. I tuoi modelli restano sul tuo dispositivo.': 'On the official site Filo only counts visits anonymously. No personal data, no cookies. Your models stay on your device.',
  'Novità': 'What’s new', 'Con il lucchetto attivo, Maiusc ridimensiona senza proporzioni': 'With the lock on, Shift resizes without proportions', 'Selettore della lingua nel menu iniziale': 'Language switch in the start menu', 'Nuovo menu iniziale numerato': 'New numbered start menu', 'Spigoli arrotondati e smussati con superficie liscia': 'Rounded and chamfered edges with a smooth surface', 'Il tasto T non cancella più il testo appena creato': 'The T key no longer wipes the text you just created', 'Versioni precedenti': 'Previous versions', 'Prime versioni': 'First versions',
  'Nuovo strumento Spigolo: arrotondare e smussare': 'New Edge tool: rounding and chamfering', 'Nuove forme: cono, prisma con n lati e toro': 'New shapes: cone, n-sided prism and torus', 'Tasti adattati a Windows e Linux': 'Shortcuts adapted for Windows and Linux', 'Tema chiaro, scuro o automatico': 'Light, dark or automatic theme', 'Misure con il tasto M': 'Measures with the M key',
  'Cronologia con anteprima (F8)': 'History with preview (F8)', 'Livelli con blocco e nascondi': 'Layers with lock and hide', 'Testo 3D con font tuoi e importazione SVG': '3D text with your own fonts and SVG import', 'Colori per ogni oggetto': 'A color for every object', 'Nome del file all’esportazione': 'File name when exporting', 'Correzioni su foro con testo e lati dei gruppi': 'Fixes for text holes and faces of groups',
  'Ridimensionamento di gruppi e oggetti ruotati': 'Resizing of groups and rotated objects', 'Blocco sull’asse con Maiusc': 'Axis lock with Shift', 'Schermata di trascinamento file': 'Drop screen for dragged files', 'Allineamento sempre disponibile': 'Alignment always available',
  'Forme base, fori, combinazione, gruppi e rotazione': 'Basic shapes, holes, combine, groups and rotation', 'Strumento Lato per spingere e tirare': 'Face tool to push and pull', 'Esportazione 3MF e STL, italiano e inglese': '3MF and STL export, Italian and English',
  'Dona su Ko-fi': 'Donate on Ko-fi',
  'Se Filo ti è utile, puoi sostenerne lo sviluppo con una donazione.': 'If Filo is useful to you, you can support its development with a donation.',
  'Esporta il modello (⌘S)': 'Export the model (⌘S)', 'consigliato': 'recommended',
  'Millimetri, più pezzi in un file. Apre Bambu Studio senza sorprese.': 'Millimeters, several parts in one file. Opens in Bambu Studio without surprises.',
  'Solo la forma, compatibile con qualsiasi programma.': 'Shape only, compatible with any program.',
  // messaggi
  'Seleziona almeno due oggetti da raggruppare': 'Select at least two objects to group',
  'Nessun gruppo selezionato': 'No group selected', 'Gruppo separato': 'Group ungrouped',
  'Seleziona almeno due oggetti, di cui un solido (⇧ + clic)': 'Select at least two objects, one of them solid (⇧ + click)',
  'Il risultato è vuoto: i fori coprono tutto': 'The result is empty: the holes cover everything',
  'Il risultato è vuoto': 'The result is empty',
  'La calamita funziona anche con ⇧ premuto e con le maniglie di ridimensionamento': 'The magnet now also works with ⇧ held and with the resize handles',
  'Combina, Interseca e Stampo: il pulsante ricorda l\'ultimo scelto': 'Combine, Intersect and Mold: the button remembers the last one used',
  'La calamita si spegne con ⌘+⌥ insieme, così resta attiva anche negli spostamenti verticali': 'The magnet now switches off with ⌘+⌥ together, so it stays on for vertical moves',
  'Spigoli esterni e interni insieme: applica prima gli uni, poi gli altri': 'Outer and inner edges together: apply one kind first, then the other',
  'Lato inclinato: si sposta lungo la sua direzione e il piano sopra e sotto restano orizzontali': 'Slanted side: it moves along its own direction, and the top and bottom planes stay level',
  'Spigoli interni dei pezzi combinati: si scelgono e si raccordano o smussano, aggiungendo materiale': 'Inner edges of combined pieces can be picked and filleted or chamfered, adding material',
  'Lo spigolo sotto il mouse è blu, quello scelto arancione': 'The edge under the mouse is blue, the selected one orange',
  'La scatola nasce cubo': 'The box starts as a cube',
  'Doppio clic su un campo: evidenzia il valore': 'Double-click a field to highlight its value',
  'Nei campi la virgola diventa punto (prima in un browser inglese "4,5" diventava 45); in inglese i decimali hanno il punto': 'In fields a comma now becomes a period (before, in an English browser "4,5" turned into 45); in English, decimals use a period',
  'Nei campi numerici si possono scrivere i conti: 10+1, 2*5, (3+2)/2': 'Number fields accept sums: 10+1, 2*5, (3+2)/2',
  'Stampo': 'Mold', 'Dal primo oggetto selezionato toglie tutti gli altri: resta solo il vuoto': 'Cuts every other object out of the first selected one: only the void is left', 'Ricavo lo stampo…': 'Making the mold…', 'Stampo ricavato': 'Mold made',
  'Seleziona il blocco, poi (⇧ + clic) gli oggetti da cui ricavare lo stampo': 'Select the block, then (⇧ + click) the objects to make the mold from',
  'Il primo oggetto selezionato è un foro: serve un solido, il blocco da cui togliere gli altri': 'The first selected object is a hole: it must be a solid, the block to cut the others out of',
  'Gli altri oggetti non toccano il blocco: non c’è niente da togliere': 'The other objects do not touch the block: there is nothing to cut out',
  'Gli altri oggetti coprono tutto il blocco: non resta nessun vuoto': 'The other objects cover the whole block: no void is left',
  'Nuovo comando Stampo: dal blocco toglie gli altri oggetti e ti lascia solo il vuoto, da riusare altrove': 'New Mold command: cuts the other objects out of the block and leaves just the void, ready to reuse elsewhere',
  'Interseca': 'Intersect', 'Tiene solo la parte in comune tra i solidi': 'Keeps only the part the solids have in common', 'Interseco gli oggetti…': 'Intersecting objects…',
  'Seleziona almeno due solidi da intersecare (⇧ + clic)': 'Select at least two solids to intersect (⇧ + click)',
  'Gli oggetti non si sovrappongono: non c’è niente in comune': 'The objects do not overlap: nothing in common',
  'Tieni premuto per altre varianti': 'Hold for more variants',
  'Copia': 'Copy', 'Trasforma in foro': 'Turn into hole', 'Trasforma in solido': 'Turn into solid', 'Separa gruppo': 'Ungroup',
  'Incolla': 'Paste', 'Seleziona tutto': 'Select all', 'Inquadra tutto': 'Fit all',
  'Bloccato: lo sblocchi dai Livelli (F7) o con il tasto destro': 'Locked: unlock it from Layers (F7) or with a right-click', 'Nascosto: lo ritrovi nei Livelli (F7)': 'Hidden: find it again in Layers (F7)', 'È già appoggiato al piatto': 'Already on the plate', 'Nessun lato piatto stabile: è già appoggiato al piatto': 'No stable flat side: already on the plate', 'Nessun lato piatto stabile: l’ho solo appoggiato al piatto': 'No stable flat side: I only dropped it to the plate', 'Cerco il lato su cui appoggiare…': 'Finding the side to rest on…',
  'Proporzioni bloccate: le misure cambiano insieme': 'Proportions locked: sizes change together', 'Proporzioni libere': 'Proportions free',
  'Aggiungi una forma per vedere le misure': 'Add a shape to see its size',
  'Niente da esportare: aggiungi almeno un solido': 'Nothing to export: add at least one solid',
  'Misure non valide': 'Invalid sizes',
  'Questo lato non è piatto': 'This face is not flat',
  'Le texture funzionano sui lati piatti e sui cilindri': 'Textures work on flat faces and cylinders',
  'Le texture funzionano su cilindri circolari (larghezza uguale a profondità)': 'Textures work on circular cylinders (width equal to depth)',
  'Il cilindro è troppo piccolo per questi elementi': 'The cylinder is too small for these elements',
  'Troppi elementi: riduci gli elementi per cm': 'Too many elements: lower the elements per cm',
  'Nessun elemento: riduci margine o elementi per cm': 'No elements: reduce the margin or the elements per cm',
  'Impossibile creare la texture': 'Could not create the texture',
  'Impossibile spostare questo lato': 'Could not move this face',
  'Nessuna forma trovata nel file': 'No shape found in the file',
  'Vista': 'View', 'Mostra': 'Show', 'Piano di lavoro': 'Workspace', 'Pannelli': 'Panels',
  'Angoli e bordi': 'Corners and edges', 'Dimensione (mm)': 'Size (mm)', 'Spessore (mm)': 'Thickness (mm)', 'Spaziatura tra le lettere': 'Letter spacing',
  'Spigoli verticali': 'Vertical corners', 'Bordo superiore': 'Top edge', 'Bordo inferiore': 'Bottom edge',
  'Aumenta': 'Increase', 'Diminuisci': 'Decrease', 'Orientamento': 'Orientation', 'Calamita': 'Magnet',
  'Strumenti, scorciatoie e consigli per la stampa.': 'Tools, shortcuts and printing tips.',
  'Dentro il file ci sono': 'The file contains',
  'parti non collegate tra loro. Puoi dividerle in livelli separati, così le muovi e le elimini una alla volta, oppure tenerle come un solo oggetto.': 'parts that are not connected to each other. You can split them into separate layers, so you can move and delete them one at a time, or keep them as one object.',
  'Creata 1 copia': 'Created 1 copy', 
  'Scrivi una misura in mm (0 per togliere)': 'Type a size in mm (0 to remove)',
  'La misura è troppo grande per questa scatola': 'The size is too big for this box', 'La misura è troppo grande per questo pezzo': 'The size is too big for this piece',
  'Controlla stampa: anteprima a strati, pareti sottili, sbalzi, pezzi sospesi e stima di peso e tempo': 'Check print: layer preview, thin walls, overhangs, floating pieces and weight and time estimate',
  'Spigolo: ogni spigolo ha il suo raggio e resta modificabile; gli anelli si ridimensionano con la calamita': 'Edge: each edge has its own radius and stays editable; rings resize with the magnet',
  'Codice': 'Code',
  'Il codice di Filo è pubblico, con licenza PolyForm Noncommercial: puoi leggerlo, usarlo e proporre modifiche su GitHub per scopi non commerciali. Quello che crei è tuo.': 'Filo’s code is public, under the PolyForm Noncommercial license: you can read it, use it and suggest changes on GitHub for non-commercial purposes. What you create is yours.',
  'copia in più': 'extra copy', 'copie in più': 'extra copies', 'Ripeti: l\'originale resta al centro e, mentre cambi i numeri, le copie compaiono come sagome arancioni con il totale e l\'ingombro; restano mentre ti muovi, spariscono con Esc e diventano vere con il pulsante Ripeti': 'Repeat: the original stays in the middle and, while you change the numbers, the copies appear as orange outlines with the total and the overall size; they stay while you move around, disappear with Esc and become real with the Repeat button',
  'Lato intero': 'Whole face', 'Cerca nella Guida': 'Search the Guide', 'Nessun risultato': 'No results', 'risultato': 'result', 'risultati': 'results',
  'Nuovo motore per Combina, Taglia e Allunga: solidi sempre chiusi e più veloci': 'New engine for Combine, Cut and Stretch: always closed solids, and faster',
  'Nuova guida: finestra grande con immagini e GIF (tasto ? o F1)': 'New guide: large window with images and GIFs (? key or F1)',
  'Metro, Ruota, Distribuisci e Ripeti più completi; Scatto da 0,1 mm e Libero': 'Tape measure, Rotate, Distribute and Repeat improved; 0.1 mm Step and Free',
  'Riprendi l\'ultimo lavoro dalla schermata iniziale, con avviso prima di ricaricare la pagina': 'Resume your last work from the start screen, with a warning before reloading the page',
  'Export 3MF con le impostazioni di Bambu Studio e riparazione automatica delle crepe': '3MF export with Bambu Studio settings and automatic crack repair',
  'Vista 3D isometrica vera, anche all\'avvio': 'True isometric 3D view, also at startup',
  'Icone di rotazione nuove; la rotellina del mouse si può forzare come zoom': 'New rotation icons; the mouse wheel can be forced as zoom',
  'Premendo una scorciatoia, il suo tasto nel menu laterale si illumina': 'Pressing a shortcut lights up its key in the side menu',
  'Nuovo logo, pannello a destra più leggero, piatto Max': 'New logo, lighter right panel, Max plate',
  'Calcoli più robusti sui pezzi con tanti dettagli piccoli, come le zigrinature': 'More robust calculations on parts with many small details, like knurling',
  'Nuovo comando Interseca (⇧⌘E) e strumenti in seconda funzione nella barra': 'New Intersect command (⇧⌘E) and tools with a second function in the bar',
  'Menu con il tasto destro su oggetti e sul vuoto': 'Right-click menu on objects and on empty space',
  'Appoggia sul piatto raddrizza il pezzo sul lato piatto più vicino': 'Drop to plate straightens the piece on its nearest flat side',
  'Ripeti con anteprima delle copie e Metro con linee guida (⌥)': 'Repeat with a preview of the copies, and Tape measure with guide lines (⌥)',
  'Guida più completa, con ricerca in tempo reale': 'More complete Guide, with live search',
  'Più veloce: Combina, apertura dei 3MF e Controlla stampa': 'Faster: Combine, 3MF opening and Print check',
  'I tuoi lavori salvati nella cache compariranno qui': 'Your work saved in the cache will show up here',
  'Si salva da solo, fino a 5 lavori in questo browser.': 'It saves itself, up to 5 works in this browser.',
  'Eliminare per sempre?': 'Delete for good?',
  'Il lavoro salvato sparirà e non si può recuperare.': 'The saved work will be gone and cannot be recovered.',
};
const NAMEMAP = { Scatola: 'Box', Cilindro: 'Cylinder', Sfera: 'Sphere', Cono: 'Cone', Prisma: 'Prism', Toro: 'Torus', Pezzo: 'Part', Testo: 'Text' };
const RULES = [
  [/^Spigolo spostato di (.+) mm su ([XYZ])$/, (m) => `Edge moved by ${m[1]} mm on ${m[2]}`],
  [/^Distribuiti con (.+) mm tra uno e l'altro$/, (m) => `Distributed with ${m[1]} mm between each`],
  [/^Distribuiti, ma si sovrappongono di (.+) mm$/, (m) => `Distributed, but they overlap by ${m[1]} mm`],
  [/^Spazi uguali tra gli oggetti su (.), tenendo fermi i due agli estremi$/, (m) => `Equal gaps between objects on ${m[1]}, keeping the two outer ones fixed`],
  [/^Allungato di (.+) mm$/, (m) => `Stretched by ${m[1]} mm`],
  [/^Accorciato di (.+) mm$/, (m) => `Shortened by ${m[1]} mm`],
  [/^Aggiunto: (.*)$/, (m) => `Added: ${tn(m[1])}`],
  [/^Eliminato: (.*)$/, (m) => `Deleted: ${tn(m[1])}`],
  [/^Aggiunti (\d+) oggetti$/, (m) => `Added ${m[1]} objects`],
  [/^Eliminati (\d+) oggetti$/, (m) => `Deleted ${m[1]} objects`],
  [/^Combinati (\d+) oggetti$/, (m) => `Combined ${m[1]} objects`],
  [/^Importato (.+): diviso in (\d+) pezzi separati$/, (m) => `Imported ${m[1]}: split into ${m[2]} separate pieces`],
  [/^Tagliati (\d+) oggetti$/, (m) => `Cut ${m[1]} objects`],
  [/^Selezionati (\d+) oggetti$/, (m) => `Selected ${m[1]} objects`],
  [/^Raddrizzato di ([\d,]+)° e appoggiato sul piatto$/, (m) => `Straightened by ${m[1].replace(',', '.')}° and dropped to the plate`],
  [/^Stampo ricavato da «(.*)», togliendo (\d+) oggett(?:o|i)$/, (m) => `Mold made from «${m[1]}», cutting out ${m[2]} object${m[2] === '1' ? '' : 's'}`],
  [/^Stampo ricavato da «(.*)»: il risultato è in (\d+) pezzi separati$/, (m) => `Mold made from «${m[1]}»: the result is ${m[2]} separate pieces`],
  [/^Intersecati (\d+) oggetti$/, (m) => `Intersected ${m[1]} objects`],
  [/^Intersecati (\d+) oggetti: il risultato è in (\d+) pezzi separati$/, (m) => `Intersected ${m[1]} objects: the result is ${m[2]} separate pieces`],
  [/^Combinati (\d+) oggetti: il risultato è in (\d+) pezzi separati$/, (m) => `Combined ${m[1]} objects: the result is ${m[2]} separate pieces`],
  [/^Ora sono (\d+) pezzi separati: li trovi nei Livelli \(F7\)$/, (m) => `Now ${m[1]} separate pieces: find them in Layers (F7)`],
  [/^(Spostato|Ruotato|Ridimensionato|Rinominato|Colore|Raggruppato|Foro|Solido|Testo modificato|Nascosto|Mostrato|Bloccato|Sbloccato): (.*)$/, (m) => `${{ Spostato: 'Moved', Ruotato: 'Rotated', Ridimensionato: 'Resized', Rinominato: 'Renamed', Colore: 'Color', Raggruppato: 'Grouped', Foro: 'Hole', Solido: 'Solid', 'Testo modificato': 'Text edited', Nascosto: 'Hidden', Mostrato: 'Shown', Bloccato: 'Locked', Sbloccato: 'Unlocked' }[m[1]]}: ${/^\d+ oggetti$/.test(m[2]) ? m[2].replace('oggetti', 'objects') : tn(m[2])}`],
  [/^Disponibile la versione (.*)\.$/, (m) => `Version ${m[1]} is available.`],
  [/^Gruppo · (\d+)$/, (m) => `Group · ${m[1]}`],
  [/^Gruppo · (\d+) oggetti$/, (m) => `Group · ${m[1]} objects`],
  [/^(\d+) oggetti$/, (m) => `${m[1]} objects`],
  [/^Raggruppati (\d+) oggetti: .*$/, (m) => `Grouped ${m[1]} objects: ⇧⌘G to ungroup`],
  [/^Combinati (\d+) oggetti$/, (m) => `Combined ${m[1]} objects`],
  [/^Espansi (\d+) pezzi: ora sono forme fisse$/, (m) => `Expanded ${m[1]} pieces: now they are fixed shapes`],
  [/^Con pareti da (.*) mm dentro non resta spazio: al massimo (.*) mm$/, (m) => `With ${m[1]} mm walls there is no room left inside: ${m[2]} mm at most`],
  [/^Il fondo da (.*) mm è alto quanto il pezzo \((.*) mm\): scrivi meno di (.*) mm$/, (m) => `A ${m[1]} mm bottom is as tall as the piece (${m[2]} mm): write less than ${m[3]} mm`],
  [/^Oggetto chiave: (.*)$/, (m) => `Key object: ${tn(m[1])}`],
  [/^Esportato (.*)\.(stl|3mf) \((\d+) (?:pezzo|pezzi)\)( con le impostazioni di stampa)?(?:, senza (\d+) frammenti vuoti)?$/, (m) => `Exported ${m[1]}.${m[2]} (${m[3]} ${m[3] === '1' ? 'piece' : 'pieces'})${m[4] ? ' with print settings' : ''}${m[5] ? `, without ${m[5]} empty fragments` : ''}`],
  [/^Create (\d+) copie$/, (m) => `Created ${m[1]} copies`],
  [/^Massimo (\d+)$/, (m) => `Maximum ${m[1]}`],
  [/^Massimo (\d+) pezzi in tutto$/, (m) => `Maximum ${m[1]} pieces in total`],
  [/^Troppi pezzi: (\d+) × (\d+) = (\d+), il massimo è (\d+)$/, (m) => `Too many pieces: ${m[1]} × ${m[2]} = ${m[3]}, the maximum is ${m[4]}`],
  [/^Troppe copie: (\d+), il massimo è (\d+)$/, (m) => `Too many copies: ${m[1]}, the maximum is ${m[2]}`],
  [/^La misura è troppo grande per questo pezzo: massimo (.+) mm$/, (m) => `The size is too big for this piece: maximum ${m[1]} mm`],
  [/^Si può accorciare al massimo fino a (.+) mm$/, (m) => `It can be shortened by at most ${m[1]} mm`],
  [/^Font aggiunto: (.*)$/, (m) => `Font added: ${m[1]}`],
  [/^Impossibile leggere il font (.*)$/, (m) => `Could not read the font ${m[1]}`],
  [/^Tolto da (\d+) (spigolo|spigoli)$/, (m) => `Removed from ${m[1]} ${m[1] === '1' ? 'edge' : 'edges'}`],
  [/^(Arrotondamento|Smusso) di (.+) mm su (\d+) (spigolo|spigoli): resta modificabile$/, (m) => `${m[1] === 'Arrotondamento' ? 'Rounding' : 'Chamfer'} of ${m[2]} mm on ${m[3]} ${m[3] === '1' ? 'edge' : 'edges'}: still editable`],
  [/^Spigolo spostato di (.+) mm in perpendicolare$/, (m) => `Edge moved by ${m[1]} mm perpendicular`],
  [/^Importato (.+): spessore 1 mm, lato maggiore 60 mm(?: · (\d+) pezzi raggruppati)?$/, (m) => `Imported ${m[1]}: thickness 1 mm, longest side 60 mm${m[2] ? ` · ${m[2]} pieces grouped` : ''}`],
  [/^Strato (\d+) \/ (\d+) · (.*)$/, (m) => `Layer ${m[1]} / ${m[2]} · ${m[3]}`],
  [/^Attenzione: i pezzi superano il piatto da (.*) mm$/, (m) => `Warning: the parts exceed the ${m[1]} mm plate`],
  [/^Griglia: (.*) mm$/, (m) => `Grid: ${m[1].replace(',', '.')} mm`],
  [/^Impostazioni di stampa dimenticate$/, () => 'Print settings forgotten'],
  [/^Esportato (.*) con le impostazioni di stampa$/, (m) => `Exported ${m[1]} with print settings`],
  [/^Tolti (\d+) frammenti senza volume$/, (m) => `Removed ${m[1]} zero-volume fragments`],
  [/^(Esportato .*), senza (\d+) frammenti vuoti$/, (m) => `${m[1]}, without ${m[2]} empty fragments`],
  [/^Scatto: (.*) mm$/, (m) => `Step: ${m[1].replace(',', '.')} mm`],
  [/^Griglia ogni (.*) mm$/, (m) => `Grid every ${m[1]} mm`],
  [/^Piatto: (.*)$/, (m) => `Plate: ${m[1]}`],
  [/^Texture applicata: (\d+) elementi(?: su (\d+) lati)?$/, (m) => `Texture applied: ${m[1]} elements${m[2] ? ` on ${m[2]} faces` : ''}`],
  [/^Lato estruso di (.*) mm, con la cima al (.*) %$/, (m) => `Face extruded by ${m[1]} mm, top at ${m[2]} %`],
  [/^Oltre (.*) mm il lato sparisce \(i lati vicini si incontrano\): allunga al massimo di (.*) mm, oppure usa Estrudi$/, (m) => `Beyond ${m[1]} mm the face vanishes (the neighbouring faces meet): stretch by at most ${m[2]} mm, or use Extrude`],
  [/^(-?[\d.,]+) mm · oltre il massimo$/, (m) => `${m[1]} mm · past the maximum`],
  [/^(\d+) righe da (.*) mm(, pareti da (.*) mm)?$/, (m) => `${m[1]} ribs of ${m[2]} mm${m[3] ? ', walls of ' + m[4] + ' mm' : ''}`],
  [/^Svuotato: pareti da (.*) mm, fondo (.*) mm$/, (m) => `Hollowed: walls of ${m[1]} mm, bottom ${m[2]} mm`],
  [/^Scavato di (.*) mm con la sagoma del lato$/, (m) => `Dug ${m[1]} mm with the face outline`],
  [/^(Estrudi|Scava|Allunga) ([+-]?[\d.,]+) mm(.*)$/, (m) => `${({ Estrudi: 'Extrude', Scava: 'Dig', Allunga: 'Stretch' })[m[1]]} ${m[2]} mm${m[3] ? m[3].replace(' · allineato', ' · aligned') : ''}`],
  [/^(?:(\d+) lati|Lato) (estruso|tirato|spinto) di (.*) mm(?: \(.*\))?$/, (m) => `${m[1] ? m[1] + ' faces' : 'Face'} ${{ estruso: 'extruded', tirato: 'pulled', spinto: 'pushed' }[m[2]]} by ${m[3]} mm${m[2] === 'estruso' ? ' (face outline, neighbours untouched)' : ''}`],
  [/^Formato non supportato: (.*)$/, (m) => `Unsupported format: ${m[1]}`],
  [/^Impossibile leggere (.*)$/, (m) => `Could not read ${m[1]}`],
  [/^(Arrotondamento|Smusso) di (.+) mm su (\d+) (spigolo|spigoli)$/, (m) => `${m[1] === 'Arrotondamento' ? 'Rounding' : 'Chamfer'} of ${m[2]} mm on ${m[3]} ${m[3] === '1' ? 'edge' : 'edges'}`],
  [/^· (\d+) (spigolo|spigoli)$/, (m) => `· ${m[1]} ${m[1] === '1' ? 'edge' : 'edges'}`],
  [/^Modello molto pesante \((.+) triangoli\): ho spento bordi.*$/, (m) => `Very heavy model (${m[1]} triangles): I turned off edges, shadows and face preview to keep it smooth. To edit it, simplify it first (in Bambu Studio: right click, Simplify model).`],
  [/^(Copiato|Incollato): (\d+) oggetti$/, (m) => `${m[1] === 'Copiato' ? 'Copied' : 'Pasted'}: ${m[2]} objects`],
  [/^Importato (.+): (\d+) (?:oggetto|oggetti), (.+) triangoli$/, (m) => `Imported ${m[1]}: ${m[2]} ${m[2] === '1' ? 'object' : 'objects'}, ${m[3]} triangles`],
  [/^≈ (\d+) elementi( \(ultimo lato\))?$/, (m) => `≈ ${m[1]} elements${m[2] ? ' (last face)' : ''}`],
  [/^· (\d+) lati selezionati$/, (m) => `· ${m[1]} faces selected`],
  [/^(.*) mm · (irregolare|curvo)$/, (m) => `${m[1]} mm · ${m[2] === 'curvo' ? 'curved' : 'irregular'}`],
  [/^(Scatola|Cilindro|Sfera|Cono|Prisma|Toro|Pezzo|Testo)( \d+)?( copia( \d+)?)?$/, (m) => `${NAMEMAP[m[1]]}${m[2] || ''}${m[3] ? ' copy' + (m[4] || '') : ''}`],
];
function tn(s) { for (const [re, f] of RULES.slice(-1)) { const m = s.match(re); if (m) return f(m); } return s; }
let lang = 'it';
/* tasti: su Windows/Linux ⌘ diventa Ctrl, ⇧ Maiusc/Shift, ⌥ Alt, ⌫ Canc/Del */
export const IS_MAC = /Mac|iPhone|iPad/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || '');
const MODS = /[⇧⌘⌥]+|⌫/g;
export function plat(s, more) {
  if (IS_MAC || !/[⇧⌘⌥⌫]/.test(s)) return s;
  return s.replace(MODS, (m, off, str) => {
    if (m === '⌫') return lang === 'en' ? 'Del' : 'Canc';
    const set = new Set(m);
    const names = [];
    if (set.has('⌘')) names.push('Ctrl');
    if (set.has('⌥')) names.push('Alt');
    if (set.has('⇧')) names.push(lang === 'en' ? 'Shift' : 'Maiusc');
    const next = str[off + m.length];
    return names.join('+') + ((next && next !== ' ' && next !== '<') || (!next && more) ? '+' : '');
  });
}
export function tr(s, ctx, more) { return plat(tr0(s, ctx), more); }
function tr0(s, ctx) {
  if (lang === 'it') return s;
  const t = s.trim();
  if (!t) return s;
  if (ctx === 'label' && { L: 'W', P: 'D', A: 'H' }[t]) return s.replace(t, { L: 'W', P: 'D', A: 'H' }[t]);
  let out = EN[t];
  if (out === undefined) for (const [re, f] of RULES) { const m = t.match(re); if (m) { out = f(m); break; } }
  const dec = x => x.replace(/(\d),(\d)/g, '$1.$2');                   // in inglese i decimali hanno il punto (0,5 → 0.5)
  return dec(out === undefined ? s : s.replace(t, out));
}
const SKIP = new Set(['SCRIPT', 'STYLE']);
const ATTRS = ['title', 'placeholder', 'aria-label'];
function ctxOf(node) { const p = node.parentElement; return p && p.matches('label.f') ? 'label' : undefined; }
function inNav(el) { return el && el.closest && el.closest('[data-i18n-html]'); }
function doText(node) {
  const p = node.parentElement;
  if (!p || SKIP.has(p.tagName) || inNav(p)) return;
  if (node.__out !== undefined && node.data === node.__out) { // già tradotto da noi
    const o = tr(node.__it, ctxOf(node), !!node.nextSibling);
    if (node.data !== o) { node.data = o; node.__out = o; }
    return;
  }
  node.__it = node.data;                                 // testo nuovo (originale italiano)
  const o = tr(node.data, ctxOf(node), !!node.nextSibling);
  node.__out = o;
  if (o !== node.data) node.data = o;
}
function doAttrs(el) {
  if (SKIP.has(el.tagName) || inNav(el)) return;
  el.__ia = el.__ia || {}; el.__oa = el.__oa || {};
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v === null) continue;
    if (el.__oa[a] !== undefined && v === el.__oa[a]) { const o = tr(el.__ia[a]); if (o !== v) { el.setAttribute(a, o); el.__oa[a] = o; } continue; }
    el.__ia[a] = v;
    const o = tr(v);
    el.__oa[a] = o;
    if (o !== v) el.setAttribute(a, o);
  }
}
function walk(root) {
  if (root.nodeType === 3) return doText(root);
  if (root.nodeType !== 1) return;
  if (!SKIP.has(root.tagName)) doAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) n.nodeType === 3 ? doText(n) : doAttrs(n);
}
let obs = null, busy = false;
export function setLang(l, save = true) {
  lang = l === 'en' ? 'en' : 'it';
  document.documentElement.lang = lang;
  busy = true; walk(document.documentElement); busy = false;
  document.querySelectorAll('[data-lang]').forEach(b => b.classList.toggle('on', b.dataset.lang === lang));
  if (save) { try { localStorage.setItem('forma.lang', lang); } catch (e) {} }
}
export function initI18n() {
  let l = 'it';
  try { l = localStorage.getItem('forma.lang') || 'it'; } catch (e) {}
  obs = new MutationObserver(muts => {
    if (busy || (lang === 'it' && IS_MAC)) return;
    busy = true;
    for (const m of muts) {
      if (m.type === 'childList') m.addedNodes.forEach(n => walk(n));
      else if (m.type === 'characterData') doText(m.target);
      else if (m.type === 'attributes') doAttrs(m.target);
    }
    busy = false;
  });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-lang]'); if (b) setLang(b.dataset.lang); });
  setLang(l, false);
}
export const getLang = () => lang;
