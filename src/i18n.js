// Traduzione IT ⇄ EN: i testi originali sono in italiano, l'inglese si applica al volo su tutto il DOM.
const EN = {
  'Filo · modellatore 3D semplice': 'Filo · simple 3D modeler',
  // barra laterale
  'Strumenti': 'Tools', 'Forme': 'Shapes', 'Modifica': 'Edit', 'Modelli': 'Templates',
  '[1] Strumenti': '[1] Tools', '[2] Forme': '[2] Shapes', '[3] Modifica': '[3] Edit', '[4] Modelli': '[4] Templates',
  'Sposta': 'Move', 'Mano': 'Hand', 'Ruota': 'Rotate', 'Lato': 'Face',
  'Spigolo': 'Edge', 'Raccorda o smussa uno spigolo': 'Fillet or chamfer an edge', 'Raccordo': 'Fillet', 'Smusso': 'Chamfer', 'Tipo': 'Type', 'Misura': 'Size', 'spigolo': 'edge', 'spigoli': 'edges', 'Clicca uno spigolo del pezzo. Maiusc + clic: aggiungi o togli spigoli.': 'Click an edge of the part. Shift + click: add or remove edges.', 'Scegli il tipo e la misura, poi Applica.': 'Pick the type and size, then Apply.', 'Raccordo: spigolo arrotondato. Smusso: taglio a 45°.': 'Fillet: rounded edge. Chamfer: 45° cut.', 'Scrivi una misura in mm': 'Enter a size in mm', 'Questo spigolo è troppo particolare per un raccordo': 'This edge is too unusual for a fillet', 'Il risultato è vuoto: la misura è troppo grande': 'The result is empty: the size is too large', 'Scatola': 'Box', 'Cilindro': 'Cylinder', 'Sfera': 'Sphere', 'Cono': 'Cone', 'Prisma': 'Prism', 'Toro': 'Torus', 'Cima %': 'Top %', 'Lati': 'Sides', 'Spessore %': 'Thickness %', 'Forma': 'Shape', 'Cono o tronco di cono': 'Cone or truncated cone', 'Esagono, ottagono e altri poligoni': 'Hexagon, octagon and other polygons', 'Anello per guarnizioni e maniglie': 'Ring for gaskets and handles',
  'Foro / Solido': 'Hole / Solid', 'Combina': 'Combine', 'Raggruppa': 'Group', 'Duplica': 'Duplicate', 'Elimina': 'Delete',
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
  'Posizione (mm)': 'Position (mm)', 'Misure (mm)': 'Size (mm)', 'Angoli arrotondati': 'Rounded corners', 'Raggio': 'Radius',
  'Rotazione (°)': 'Rotation (°)', 'Ruota di 90°': 'Rotate by 90°',
  'Allinea al piatto.': 'Align to the plate.', 'In altezza il piatto è solo la base': 'In height the plate is only the base',
  'Rilascia per importare': 'Drop to import', 'File 3MF o STL': '3MF or STL file',
  'Colore': 'Color', 'Predefinito': 'Default',
  'Testo': 'Text', 'Scrivi qui': 'Type here', 'Dim.': 'Size', 'Sp.': 'Depth', 'Lett.': 'Spacing',
  '+ Carica font…': '+ Load font…', 'File 3MF, STL o SVG': '3MF, STL or SVG file',
  'Scrive un testo in 3D: scegli font, dimensione e spessore. Puoi caricare i tuoi font (TTF, OTF, WOFF). Come foro, incide.': 'Writes 3D text: pick font, size and thickness. You can load your own fonts (TTF, OTF, WOFF). As a hole, it engraves.',
  'WOFF2 non è supportato: usa TTF, OTF o WOFF': 'WOFF2 is not supported: use TTF, OTF or WOFF',
  'Nome del file': 'File name', 'Esporta': 'Export', '3MF · consigliato': '3MF · recommended',
  'Seleziona e muovi gli oggetti': 'Select and move objects', 'Ruota con scatto a 15°': 'Rotate in 15° steps', 'Spingi o tira un lato piatto': 'Push or pull a flat face', 'Aggiunge un blocco': 'Adds a block', 'Aggiunge un cilindro': 'Adds a cylinder', 'Scrive testo 3D con font a scelta': '3D text in the font you choose', 'Aggiunge una sfera': 'Adds a sphere', 'Trasforma in foro per scavare': 'Turns into a hole to cut', 'Unisce i solidi, sottrae i fori': 'Merges solids, subtracts holes', 'Muove più oggetti come uno': 'Moves several objects as one', 'Copia l’oggetto selezionato': 'Copies the selected object', 'Rimuove la selezione': 'Removes the selection', 'Corpo e coperchio su misura': 'Custom body and lid',
  'Aiuto': 'Help',
  'Blocca': 'Lock', 'Nascondi': 'Hide',
  'Inizia': 'Start', 'Cosa vuoi creare?': 'What do you want to make?', 'Blocchi, cilindri, coni, poligoni e anelli da combinare e forare.': 'Blocks, cylinders, cones, polygons and rings to combine and cut.', 'Scrivi in 3D con 4 font a scelta o carica il tuo (TTF, OTF, WOFF).': 'Write in 3D with 4 fonts or load your own (TTF, OTF, WOFF).', 'Apri un 3MF o STL da modificare, oppure un SVG: diventa un solido da 1 mm. Puoi anche trascinare il file qui.': 'Open a 3MF or STL to edit, or an SVG: it becomes a 1 mm solid. You can also drop the file here.', 'Scatolina con coperchio su misura, pronta da stampare.': 'Custom box with lid, ready to print.', 'Scatolina': 'Small box',
  'Cronologia': 'History', 'Mostra o nascondi la cronologia (F8)': 'Show or hide the history (F8)',
  'Inizio': 'Start', 'Lato modificato': 'Face edited',
  'Chiaro': 'Light', 'Automatico': 'Auto', 'Scuro': 'Dark', 'Tema': 'Theme', 'Licenze': 'Licenses', 'Privacy': 'Privacy',
  'Filo usa software libero di terze parti, tutto open source e usabile liberamente, anche per scopi commerciali.': 'Filo uses third-party free software, all open source and free to use, including commercially.',
  'Testi completi delle licenze': 'Full license texts',
  'Appoggia sul piatto': 'Drop to plate', "Porta l'oggetto a Z = 0": 'Moves the object to Z = 0',
  'Blocca le proporzioni': 'Lock proportions', 'Blocca le proporzioni: le tre misure cambiano insieme. Con Maiusc trascini senza proporzioni': 'Lock proportions: the three sizes change together. Hold Shift while dragging to resize freely',
  'Ruota di 90° attorno a X (⇧ per il verso opposto)': 'Rotate 90° around X (⇧ for the opposite direction)',
  'Ruota di 90° attorno a Y (⇧ per il verso opposto)': 'Rotate 90° around Y (⇧ for the opposite direction)',
  'Ruota di 90° attorno a Z (⇧ per il verso opposto)': 'Rotate 90° around Z (⇧ for the opposite direction)',
  'Oppure usa lo strumento Ruota (R): gli anelli scattano ogni 15°.': 'Or use the Rotate tool (R): the rings snap every 15°.',
  'Allinea': 'Align', 'Allinea a sinistra': 'Align left', 'Allinea a destra': 'Align right', 'Centra su X': 'Center on X',
  'Allinea davanti': 'Align front', 'Allinea dietro': 'Align back', 'Centra su Y': 'Center on Y',
  'Allinea alla base': 'Align to base', 'Allinea in alto': 'Align to top', 'Centra in altezza': 'Center vertically',
  'Allineo alla selezione. Per scegliere un oggetto chiave, clicca uno degli oggetti selezionati.': 'Aligning to the selection. To pick a key object, click one of the selected objects.',
  'Spingi / tira': 'Push / pull', 'Di': 'By', 'Applica': 'Apply',
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
  'Mostra le dimensioni reali': 'Show real dimensions', 'Adatta alla vista': 'Fit to view', 'Passo della griglia': 'Grid step',
  'Mostra o nascondi i livelli (F7)': 'Show or hide layers (F7)', 'Dimensione del piatto di stampa': 'Print plate size',
  'Importa un file 3MF o STL (⌘O)': 'Import a 3MF or STL file (⌘O)',
  'Valore negativo per accorciare. Invio per applicare': 'Negative to shorten. Press Enter to apply',
  'allunga di': 'extend by',
  'Inizia da una forma': 'Start from a shape',
  'Scegli Scatola, Cilindro o Sfera a sinistra, oppure crea una scatolina con coperchio dai Modelli.': 'Pick Box, Cylinder or Sphere on the left, or create a box with lid from Templates.',
  'Corpo e coperchio vengono affiancati, pronti da stampare sul piatto.': 'Body and lid are placed side by side, ready to print on the plate.',
  'Larghezza': 'Width', 'Profondità': 'Depth', 'Altezza': 'Height', 'Pareti': 'Walls', 'Gioco': 'Clearance', 'Angoli': 'Corners',
  'Annulla': 'Cancel', 'Crea': 'Create',
  'Info': 'Info',
  'Filo è un modellatore 3D semplice per creare e modificare oggetti da stampare in 3D: forme di base, fori, testo, allineamenti e importazione di file 3MF, STL e SVG. Pensato per oggetti pratici come mollette, ganci e scatoline.': 'Filo is a simple 3D modeler for creating and editing objects to 3D print: basic shapes, holes, text, alignment and 3MF, STL and SVG import. Made for practical objects like clips, hooks and small boxes.',
  'Questa app è stata generata con l’ausilio dell’intelligenza artificiale.': 'This app was generated with the help of artificial intelligence.',
  'Controlla se è disponibile una versione più recente.': 'Check whether a newer version is available.',
  'Impossibile controllare ora: riprova più tardi.': 'Could not check right now: try again later.',
  'Hai già la versione più recente.': 'You already have the latest version.',
  'Modello molto pesante': 'Very heavy model', 'Questa operazione può bloccare il browser per diversi minuti. Conviene semplificarlo prima (in Bambu Studio: tasto destro, Semplifica modello). Continuare lo stesso?': 'This operation can freeze the browser for several minutes. It is better to simplify it first (in Bambu Studio: right click, Simplify model). Continue anyway?',
  'Copiato': 'Copied', 'Tagliato': 'Cut', 'Incollato': 'Pasted', 'Niente da incollare': 'Nothing to paste',
  'Copia, taglia e incolla (⌘C, ⌘X, ⌘V)': 'Copy, cut and paste (⌘C, ⌘X, ⌘V)', 'Modelli molto pesanti più fluidi, con avviso': 'Smoother very heavy models, with a warning',
  'Angoli di rotazione più coerenti dopo i quarti di giro': 'More consistent rotation angles after quarter turns',
  'Meglio da computer': 'Better on a computer', 'Filo non è ottimizzato per il mobile: è pensato per mouse e tastiera, con scorciatoie e maniglie di precisione. Da telefono o tablet puoi guardarlo e provarlo, ma alcune cose saranno scomode.': 'Filo is not optimized for mobile: it is made for mouse and keyboard, with shortcuts and precision handles. On a phone or tablet you can look around and try it, but some things will be awkward.', 'Ho capito': 'Got it',
  'Avviso per chi apre Filo da mobile': 'Warning for people opening Filo on mobile',
  'Lato: non si può più spingere fino a spessore zero': 'Side tool: you can no longer push a side down to zero thickness',
  'Il lato arriverebbe a spessore zero: il pezzo sparirebbe. Usa una distanza minore': 'The side would reach zero thickness and the piece would vanish. Use a smaller distance',
  'Scanalature': 'Grooves', 'Tondo': 'Round', 'Onda': 'Wave', 'Quadro': 'Square', 'Incidi': 'Cut', 'Rialza': 'Raise', 'Passo': 'Pitch', 'Prof.': 'Depth', 'Margine dal bordo': 'Edge margin', 'Applica scanalature': 'Apply grooves',
  'Righe parallele su un lato piatto o su un cilindro (verticali o anelli). Misure in mm. Con margine 0 arrivano al bordo.': 'Parallel lines on a flat side or a cylinder (vertical or rings). Sizes in mm. With margin 0 they reach the edge.',
  'Scanalature su lati piatti e cilindri, un clic dal pannello Lato': 'Grooves on flat sides and cylinders, one click from the Side panel',
  'Le scanalature funzionano sui lati piatti e sui cilindri': 'Grooves work on flat sides and cylinders',
  'Il lato è troppo piccolo per questo passo o margine': 'The side is too small for this pitch or margin',
  'Troppe scanalature: aumenta il passo': 'Too many grooves: increase the pitch',
  'Le scanalature funzionano su cilindri circolari (larghezza uguale a profondità)': 'Grooves work on circular cylinders (width equal to depth)',
  'Il cilindro è troppo basso per questo margine': 'The cylinder is too short for this margin',
  'Il cilindro è troppo basso per questo passo o margine': 'The cylinder is too short for this pitch or margin',
  'Nessuna scanalatura dentro la sagoma del lato': 'No grooves fit inside the shape of the side',
  'Esporta: un solo passaggio, con scelta del formato nella finestra': 'Export: a single step, with the format choice in the dialog',
  'Wireframe': 'Wireframe', 'Mostra i contorni delle parti coperte (W)': 'Show the outlines of hidden parts (W)',
  'Vista Wireframe (W): mostra i contorni delle parti coperte': 'Wireframe view (W): shows the outlines of hidden parts',
  'Lato curvo di un cilindro: profilo pulito, senza fessure': 'Curved side of a cylinder: clean outline, no gaps',
  'Distanza': 'Distance', 'Misura tra due punti o lati': 'Measure between two points or sides',
  'Clicca un punto o un lato, poi un secondo. Su due lati paralleli misura la distanza tra i piani.': 'Click a point or a side, then a second one. On two parallel sides it measures the distance between the planes.',
  'Ora clicca il secondo punto o lato.': 'Now click the second point or side.',
  'Distanza tra i due lati paralleli': 'Distance between the two parallel sides',
  'Strumento Distanza (D): misura tra due punti o due lati': 'Distance tool (D): measures between two points or two sides',
  'Cubo di orientamento: mostra da dove guardi e porta alla vista con un clic': 'Orientation cube: shows where you are looking from and jumps to a view with one click',
  'Dietro': 'Back', 'Sinistra': 'Left', 'Sotto': 'Bottom',
  'Lingua, tema e info in basso con lo stesso stile': 'Language, theme and info buttons at the bottom share the same style',
  'Numeri nei campi non più coperti dalle freccette': 'Numbers in fields no longer covered by the arrows',
  'Import 3MF: ignora i volumi modificatori dei file Bambu e Orca': '3MF import: ignores modifier volumes in Bambu and Orca files',
  'Contatore di visite anonimo sul sito ufficiale': 'Anonymous visit counter on the official site',
  'Sul sito ufficiale Filo conta solo le visite in forma anonima. Nessun dato personale, nessun cookie. I tuoi modelli restano sul tuo dispositivo.': 'On the official site Filo only counts visits anonymously. No personal data, no cookies. Your models stay on your device.',
  'Novità': 'What’s new', 'Con il lucchetto attivo, Maiusc ridimensiona senza proporzioni': 'With the lock on, Shift resizes without proportions', 'Selettore della lingua nel menu iniziale': 'Language switch in the start menu', 'Nuovo menu iniziale numerato': 'New numbered start menu', 'Raccordi e smussi con superficie liscia': 'Fillets and chamfers with a smooth surface', 'Il tasto T non cancella più il testo appena creato': 'The T key no longer wipes the text you just created', 'Versioni precedenti': 'Previous versions', 'Prime versioni': 'First versions',
  'Nuovo strumento Spigolo: raccordi e smussi': 'New Edge tool: fillets and chamfers', 'Nuove forme: cono, prisma con n lati e toro': 'New shapes: cone, n-sided prism and torus', 'Tasti adattati a Windows e Linux': 'Shortcuts adapted for Windows and Linux', 'Tema chiaro, scuro o automatico': 'Light, dark or automatic theme', 'Misure con il tasto M': 'Measures with the M key',
  'Cronologia con anteprima (F8)': 'History with preview (F8)', 'Livelli con blocco e nascondi': 'Layers with lock and hide', 'Testo 3D con font tuoi e importazione SVG': '3D text with your own fonts and SVG import', 'Colori per ogni oggetto': 'A color for every object', 'Nome del file all’esportazione': 'File name when exporting', 'Correzioni su foro con testo e lati dei gruppi': 'Fixes for text holes and faces of groups',
  'Ridimensionamento di gruppi e oggetti ruotati': 'Resizing of groups and rotated objects', 'Blocco sull’asse con Maiusc': 'Axis lock with Shift', 'Schermata di trascinamento file': 'Drop screen for dragged files', 'Allineamento sempre disponibile': 'Alignment always available',
  'Forme base, fori, combinazione, gruppi e rotazione': 'Basic shapes, holes, combine, groups and rotation', 'Strumento Lato per spingere e tirare': 'Face tool to push and pull', 'Esportazione 3MF e STL, italiano e inglese': '3MF and STL export, Italian and English',
  'Dona su Ko-fi': 'Donate on Ko-fi',
  'Se Filo ti è utile, puoi sostenerne lo sviluppo con una donazione.': 'If Filo is useful to you, you can support its development with a donation.',
  'Esporta il modello (⌘S)': 'Export the model (⌘S)', 'consigliato': 'recommended',
  'Millimetri, più pezzi in un file. Apre Bambu Studio senza sorprese.': 'Millimeters, several parts in one file. Opens in Bambu Studio without surprises.',
  'Solo la forma, compatibile con qualsiasi programma.': 'Shape only, compatible with any program.',
  // messaggi
  'È già un gruppo: ⇧⌘G per separarlo': 'Already a group: ⇧⌘G to ungroup it',
  'Seleziona almeno due oggetti da raggruppare': 'Select at least two objects to group',
  'Nessun gruppo selezionato': 'No group selected', 'Gruppo separato': 'Group ungrouped',
  'Seleziona almeno due oggetti, di cui un solido (⇧ + clic)': 'Select at least two objects, one of them solid (⇧ + click)',
  'Il risultato è vuoto: i fori coprono tutto': 'The result is empty: the holes cover everything',
  'Il risultato è vuoto': 'The result is empty',
  'Proporzioni bloccate: le misure cambiano insieme': 'Proportions locked: sizes change together', 'Proporzioni libere': 'Proportions free',
  'Aggiungi una forma per vedere le misure': 'Add a shape to see its size',
  'Niente da esportare: aggiungi almeno un solido': 'Nothing to export: add at least one solid',
  'Misure non valide': 'Invalid sizes',
  'Questo lato non è piatto': 'This face is not flat',
  'Le texture funzionano sui lati piatti': 'Textures only work on flat faces',
  'Troppi elementi: riduci gli elementi per cm': 'Too many elements: lower the elements per cm',
  'Nessun elemento: riduci margine o elementi per cm': 'No elements: reduce the margin or the elements per cm',
  'Impossibile creare la texture': 'Could not create the texture',
  'Impossibile spostare questo lato': 'Could not move this face',
  'Nessuna forma trovata nel file': 'No shape found in the file',
};
const NAV = {
  it: '<b>Vista</b><br>Trascina nel vuoto o col tasto destro: ruota<br><b>Spazio</b> + trascina: sposta · Pizzico o rotella: zoom<br><b>⌘0</b> adatta · doppio clic: centra<br><br><b>Oggetti</b><br><b>⇧</b> + trascina: blocca un asse<br><b>⌘</b> + trascina: alza e abbassa · <b>[ ]</b> su e giù<br><b>⌥</b> + trascina: duplica<br><b>⌘G</b> raggruppa · <b>⇧⌘G</b> separa<br><b>⇧</b> + clic con Lato: più lati<br>Ruota: <b>⇧</b> scatto 5° · <b>⌥</b> libero<br><br><b>Maniglie</b><br><b>⇧</b> proporzionale · <b>⌥</b> dal centro<br><br>Con 2+ oggetti clicca quello <b>chiave</b>, poi allinea.',
  en: '<b>View</b><br>Drag in empty space or with the right button: orbit<br><b>Space</b> + drag: pan · Pinch or wheel: zoom<br><b>⌘0</b> fit · double click: center<br><br><b>Objects</b><br><b>⇧</b> + drag: lock axis<br><b>⌘</b> + drag: move up and down · <b>[ ]</b> up and down<br><b>⌥</b> + drag: duplicate<br><b>⌘G</b> group · <b>⇧⌘G</b> ungroup<br><b>⇧</b> + click with Face: more faces<br>Rotate: <b>⇧</b> 5° steps · <b>⌥</b> free<br><br><b>Handles</b><br><b>⇧</b> proportional · <b>⌥</b> from center<br><br>With 2+ objects click the <b>key</b> one, then align.',
};
const NAMEMAP = { Scatola: 'Box', Cilindro: 'Cylinder', Sfera: 'Sphere', Cono: 'Cone', Prisma: 'Prism', Toro: 'Torus', Pezzo: 'Part' };
const RULES = [
  [/^Aggiunto: (.*)$/, (m) => `Added: ${tn(m[1])}`],
  [/^Eliminato: (.*)$/, (m) => `Deleted: ${tn(m[1])}`],
  [/^Aggiunti (\d+) oggetti$/, (m) => `Added ${m[1]} objects`],
  [/^Eliminati (\d+) oggetti$/, (m) => `Deleted ${m[1]} objects`],
  [/^Combinati (\d+) oggetti$/, (m) => `Combined ${m[1]} objects`],
  [/^(Spostato|Ruotato|Ridimensionato|Rinominato|Colore|Raggruppato|Foro|Solido|Testo modificato): (.*)$/, (m) => `${{ Spostato: 'Moved', Ruotato: 'Rotated', Ridimensionato: 'Resized', Rinominato: 'Renamed', Colore: 'Color', Raggruppato: 'Grouped', Foro: 'Hole', Solido: 'Solid', 'Testo modificato': 'Text edited' }[m[1]]}: ${/^\d+ oggetti$/.test(m[2]) ? m[2].replace('oggetti', 'objects') : tn(m[2])}`],
  [/^Disponibile la versione (.*)\.$/, (m) => `Version ${m[1]} is available.`],
  [/^Gruppo · (\d+)$/, (m) => `Group · ${m[1]}`],
  [/^Gruppo · (\d+) oggetti$/, (m) => `Group · ${m[1]} objects`],
  [/^(\d+) oggetti$/, (m) => `${m[1]} objects`],
  [/^Raggruppati (\d+) oggetti: .*$/, (m) => `Grouped ${m[1]} objects: ⇧⌘G to ungroup`],
  [/^Combinati (\d+) oggetti$/, (m) => `Combined ${m[1]} objects`],
  [/^Oggetto chiave: (.*)$/, (m) => `Key object: ${tn(m[1])}`],
  [/^Esportato (.*)\.(stl|3mf) \((\d+) (?:pezzo|pezzi)\)$/, (m) => `Exported ${m[1]}.${m[2]} (${m[3]} ${m[3] === '1' ? 'piece' : 'pieces'})`],
  [/^Attenzione: i pezzi superano il piatto da (.*) mm$/, (m) => `Warning: the parts exceed the ${m[1]} mm plate`],
  [/^Griglia: (.*) mm$/, (m) => `Grid: ${m[1].replace(',', '.')} mm`],
  [/^Piatto: (.*)$/, (m) => `Plate: ${m[1]}`],
  [/^Texture applicata: (\d+) elementi(?: su (\d+) lati)?$/, (m) => `Texture applied: ${m[1]} elements${m[2] ? ` on ${m[2]} faces` : ''}`],
  [/^(?:(\d+) lati|Lato) (estruso|tirato|spinto) di (.*) mm(?: \(.*\))?$/, (m) => `${m[1] ? m[1] + ' faces' : 'Face'} ${{ estruso: 'extruded', tirato: 'pulled', spinto: 'pushed' }[m[2]]} by ${m[3]} mm${m[2] === 'estruso' ? ' (face outline, neighbours untouched)' : ''}`],
  [/^Formato non supportato: (.*)$/, (m) => `Unsupported format: ${m[1]}`],
  [/^Impossibile leggere (.*)$/, (m) => `Could not read ${m[1]}`],
  [/^(Raccordo|Smusso) di (.+) mm su (\d+) (spigolo|spigoli)$/, (m) => `${m[1] === 'Raccordo' ? 'Fillet' : 'Chamfer'} of ${m[2]} mm on ${m[3]} ${m[3] === '1' ? 'edge' : 'edges'}`],
  [/^· (\d+) (spigolo|spigoli)$/, (m) => `· ${m[1]} ${m[1] === '1' ? 'edge' : 'edges'}`],
  [/^Modello molto pesante \((.+) triangoli\): ho spento bordi.*$/, (m) => `Very heavy model (${m[1]} triangles): I turned off edges, shadows and face preview to keep it smooth. To edit it, simplify it first (in Bambu Studio: right click, Simplify model).`],
  [/^(Copiato|Incollato): (\d+) oggetti$/, (m) => `${m[1] === 'Copiato' ? 'Copied' : 'Pasted'}: ${m[2]} objects`],
  [/^Importato (.+): (\d+) (?:oggetto|oggetti), (.+) triangoli$/, (m) => `Imported ${m[1]}: ${m[2]} ${m[2] === '1' ? 'object' : 'objects'}, ${m[3]} triangles`],
  [/^≈ (\d+) elementi( \(ultimo lato\))?$/, (m) => `≈ ${m[1]} elements${m[2] ? ' (last face)' : ''}`],
  [/^· (\d+) lati selezionati$/, (m) => `· ${m[1]} faces selected`],
  [/^(.*) mm · (irregolare|curvo)$/, (m) => `${m[1]} mm · ${m[2] === 'curvo' ? 'curved' : 'irregular'}`],
  [/^(Scatola|Cilindro|Sfera|Cono|Prisma|Toro|Pezzo)( \d+)?( copia( \d+)?)?$/, (m) => `${NAMEMAP[m[1]]}${m[2] || ''}${m[3] ? ' copy' + (m[4] || '') : ''}`],
];
function tn(s) { for (const [re, f] of RULES.slice(-1)) { const m = s.match(re); if (m) return f(m); } return s; }
let lang = 'it';
/* tasti: su Windows/Linux ⌘ diventa Ctrl, ⇧ Maiusc/Shift, ⌥ Alt, ⌫ Canc/Del */
export const IS_MAC = /Mac|iPhone|iPad/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || '');
const MODS = /[⇧⌘⌥]+|⌫/g;
function plat(s, more) {
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
  return out === undefined ? s : s.replace(t, out);
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
  const nav = document.querySelector('[data-i18n-html]');
  if (nav) nav.innerHTML = plat(NAV[lang]);
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
