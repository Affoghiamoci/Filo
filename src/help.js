// Guida di Filo: contenuti in italiano e inglese. Le figure sono {{img:nome|didascalia}}.
export const GROUPS = {
  it: { start: 'Per iniziare', create: 'Creare', select: 'Selezionare', transform: 'Trasformare', model: 'Modellare', solids: 'Fori e unione', measure: 'Misurare', ref: 'Riferimento' },
  en: { start: 'Getting started', create: 'Create', select: 'Select', transform: 'Transform', model: 'Shape', solids: 'Holes and joining', measure: 'Measure', ref: 'Reference' },
};

const K = (...k) => k.map(x => `<kbd>${x}</kbd>`).join(' ');

export const HELP = {
  it: [
    { id: 'start', g: 'start', t: 'Benvenuto', h: `
      <p>Filo è un modellatore 3D semplice per oggetti da stampare: scatole, ganci, supporti, scatoline. Si compone con forme di base, si scavano i fori e si unisce tutto. Funziona offline e il lavoro resta sul tuo computer.</p>
      <ol><li>Aggiungi una forma dalla barra a sinistra (o con un tasto: ${K('B')} scatola, ${K('C')} cilindro).</li><li>Cambia misure e posizione dal pannello a destra, oppure trascina le maniglie colorate.</li><li>Per fare un foro, selezionalo e premi ${K('X')}: diventa arancione trasparente. Poi ${K('⌘E')} (Combina) lo sottrae dai solidi.</li><li>Esporta in 3MF (consigliato) o STL e apri il file nello slicer.</li></ol>
      <div class="tip"><b>Piatto di stampa.</b> In basso, in "Piano di lavoro", scegli la tua stampante (A1 mini, X1C, H2D…) o una misura libera. Z = 0 è il piatto.</div>
      <p>Usa il menu a sinistra per leggere come funziona ogni strumento. Con <kbd>?</kbd> riapri questa guida in qualsiasi momento.</p>` },
    { id: 'view', g: 'start', t: 'Muovere la vista', h: `
      <ul><li><b>Ruotare</b>: trascina nel vuoto o con il tasto destro.</li><li><b>Spostare</b>: ${K('Spazio')} + trascina.</li><li><b>Zoom</b>: rotella o pizzico sul trackpad; ${K('⌥')} + scorrimento funziona con qualsiasi dispositivo.</li><li><b>Adatta alla vista</b>: ${K('⌘0')}; doppio clic su un oggetto per centrarlo.</li></ul>
      <p>Il cubo in alto a sinistra mostra l'orientamento. Nella barra in basso, "Vista" porta subito Davanti, Sopra, Destra o 3D. Le viste Davanti, Sopra e Destra sono senza prospettiva, ideali per allineare con precisione.</p>
      <ul><li>${K('M')} mostra le <b>Misure</b> reali degli oggetti.</li><li>${K('Z')} attiva i <b>Raggi X</b>: i contorni delle parti coperte.</li><li>${K('Tab')} riduce la barra laterale.</li></ul>` },
    { id: 'shapes', g: 'create', t: 'Forme', h: `
      {{img:forme|Scatola, cilindro, sfera, cono, prisma e toro}}
      <p>Scatola ${K('B')}, cilindro ${K('C')}, sfera ${K('S')}, cono ${K('O')}, prisma ${K('P')}, toro (dalla barra). Ogni forma nasce con misure semplici e si regola dal pannello a destra.</p>
      <ul><li><b>Misure</b> in mm (L, P, A). Il lucchetto le tiene proporzionate; con ${K('⇧')} trascini senza proporzioni.</li><li><b>Angoli e bordi</b>: raggio degli angoli verticali, bordo alto e basso, arrotondato o smussato.</li><li><b>Cima %</b>: restringe la parte alta e fa tronchi di piramide o di cono.</li><li><b>Prisma</b>: scegli quanti lati (esagono, ottagono…). <b>Cono</b>: raggio della punta.</li><li><b>Rotazione</b> su X, Y e Z; "Appoggia sul piatto" porta l'oggetto a Z = 0.</li></ul>
      <p>Anche <b>Scatolina con coperchio</b> (dal menu di benvenuto) crea corpo e coperchio già dimensionati.</p>` },
    { id: 'text', g: 'create', t: 'Testo', h: `
      <p>${K('T')} scrive testo 3D. Scegli il font (Inter, Bebas Neue, Lora, VT323) oppure carica un tuo font con "+ Carica font…". Regoli dimensione, spessore e spaziatura. Il testo è un oggetto come gli altri: puoi renderlo un foro per inciderlo in una scatola.</p>` },
    { id: 'io', g: 'create', t: 'Importare ed esportare', h: `
      <ul><li><b>Importa</b>: ${K('⌘O')} oppure trascina il file sulla finestra. Accetta 3MF e STL.</li><li>Se un file ha più parti staccate, Filo chiede se tenerle unite o dividerle in livelli.</li><li><b>Esporta</b>: ${K('⌘S')}. Il <b>3MF</b> è consigliato (tiene i nomi e i colori); l'STL è un solo corpo.</li></ul>
      <div class="tip"><b>Controllo prima dell'export.</b> 3MF e STL ripuliscono i vertici doppi e riparano le piccole fessure lasciate da Combina e Taglia. Restano a volte minuscoli difetti: gli slicer di solito li sistemano da soli.</div>` },
    { id: 'move', g: 'select', t: 'Sposta e duplica', h: `
      <p>${K('V')}: seleziona e trascina gli oggetti sul piatto.</p>
      <ul><li>${K('⇧')} mentre trascini: blocca un asse (e spegne l'aggancio).</li><li>${K('⌘')} premuto prima di trascinare: sposta su e giù.</li><li>${K('⌥')} + trascina: duplica.</li><li>Frecce: spostano di uno scatto (con ${K('⇧')}, di dieci). ${K('[')} ${K(']')}: giù e su.</li><li>${K('⌘D')} duplica, ${K('⌘C')} ${K('⌘X')} ${K('⌘V')} copia, taglia, incolla; ${K('⌘⇧V')} incolla sul posto.</li><li>${K('Canc')} elimina, ${K('Esc')} deseleziona.</li></ul>
      <p>I quadratini colorati intorno all'oggetto ridimensionano: ${K('⇧')} proporzionale, ${K('⌥')} dal centro.</p>` },
    { id: 'marquee', g: 'select', t: 'Riquadro e Lazo', h: `
      {{img:riquadro|Riquadro: seleziona tutto ciò che si vede nell'area}}
      <p>${K('Q')} Riquadro e ${K('W')} Lazo selezionano trascinando. Prendono solo ciò che si vede davvero, non gli oggetti nascosti dietro.</p>
      {{img:lazo|Lazo: disegni una linea libera attorno agli oggetti}}
      <ul><li>${K('⇧')} aggiunge alla selezione; ${K('⌘')} la toglie.</li><li>Un clic nel vuoto deseleziona.</li></ul>` },
    { id: 'groups', g: 'select', t: 'Gruppi, livelli e cronologia', h: `
      <ul><li><b>Gruppo</b>: ${K('⌘G')} unisce più oggetti perché si muovano insieme; ${K('⇧⌘G')} li separa.</li><li><b>Livelli</b> (${K('F7')}): elenco degli oggetti, con blocco e nascondi. ${K('⇧')} + clic aggiunge, ${K('⌘')} + clic prende un intervallo.</li><li><b>Cronologia</b> (${K('F8')}): ogni passaggio con anteprima, per tornare indietro. ${K('⌘Z')} annulla, ${K('⇧⌘Z')} ripete.</li></ul>
      <p>Con due o più oggetti selezionati, clicca quello che vuoi come <b>chiave</b>: gli altri si allineano a lui.</p>` },
    { id: 'align', g: 'transform', t: 'Allinea e distribuisci', h: `
      <p>Con più oggetti selezionati, il pannello a destra mostra Allinea su X, Y e Z (inizio, centro, fine). Si allinea alla selezione, oppure all'oggetto <b>chiave</b> se ne hai cliccato uno.</p>
      <p><b>Distribuisci</b> (X, Y, Z) mette spazi uguali tra tre o più oggetti, lasciando fermi i due agli estremi. Se non ci stanno, ti dice di quanto si sovrappongono.</p>
      {{img:distribuisci-prima|Prima: tre scatole a distanze diverse}}
      {{img:distribuisci|Dopo Distribuisci su X: spazi uguali}}
      <div class="tip">Con un solo oggetto, Allinea lavora sul piatto. I pulsanti che non servono sono attenuati e il tooltip spiega perché.</div>` },
    { id: 'snap', g: 'transform', t: 'Scatto e calamita', h: `
      <p>In basso, <b>Scatto</b> è di quanto si sposta un oggetto: da 0,1 a 10 mm, oppure <b>Libero</b> (senza aggancio).</p>
      <p>La <b>Calamita</b> (pulsante accanto) aggancia angoli e lati agli altri oggetti, sia a contatto sia a filo, anche su modelli con molti fori. Funziona anche in verticale.</p>
      {{img:calamita|Un oggetto trascinato si aggancia a contatto con l'altro}}
      <ul><li>${K('⌘')} premuto mentre trascini spegne la calamita solo per quel movimento.</li><li>${K('⇧')} blocca un asse e spegne anche lo scatto.</li><li>La calamita agisce anche sul trascinamento degli spigoli (vedi Spigolo).</li></ul>` },
    { id: 'rotate', g: 'transform', t: 'Ruota', h: `
      <p>${K('R')} mostra tre anelli, uno per asse. Trascina un anello per ruotare con scatto di 15°; ${K('⇧')} dà scatti di 5°, ${K('⌥')} rotazione libera.</p>
      <p>Nel pannello, i pulsanti X, Y, Z ruotano di 90° (con ${K('⇧')} nel verso opposto), e i campi Rotazione danno l'angolo esatto.</p>` },
    { id: 'face', g: 'model', t: 'Lato', h: `
      {{img:lato|Un lato selezionato con la sua maniglia}}
      <p>${K('L')}: clicca un lato piatto e tira o spingi la maniglia per spostarlo. La forma si allunga o si accorcia da quella parte.</p>
      <ul><li>${K('⇧')} + clic aggiunge altri lati.</li><li>Un lato a filo con altri dello stesso gruppo si muove insieme.</li><li>Sui cilindri il lato curvo è un pezzo unico.</li></ul>` },
    { id: 'edge', g: 'model', t: 'Spigolo', h: `
      <p>${K('E')}: clicca uno spigolo (${K('⇧')} per aggiungerne altri) e scegli cosa farne.</p>
      <h3>Arrotonda o smussa</h3>
      {{img:spigolo|Due spigoli arrotondati su una scatola}}
      <p>Scrivi la misura e premi Applica. Su <b>scatola e prisma</b> ogni spigolo ha il suo raggio e <b>resta modificabile</b>: riseleziona lo spigolo per cambiarlo, con 0 lo togli. Su altri pezzi l'operazione è definitiva (si può annullare).</p>
      <h3>Sposta lo spigolo</h3>
      {{img:spigolo-sposta|Trascinando lo spigolo il cubo diventa un trapezio}}
      <p>Su uno spigolo compare un quadratino: trascinalo, oppure scegli X, Y o Z e scrivi i mm. La faccia si inclina o si allunga. Il pezzo diventa libero (non più parametrico).</p>
      <ul><li>La <b>calamita</b> aiuta: torna "come prima", si allinea ai vertici paralleli del pezzo e agli altri oggetti, e lo dice accanto al valore.</li><li>Lo scatto vale se la calamita non aggancia nulla.</li><li>Su uno spigolo arrotondato, togli prima l'arrotondamento.</li></ul>
      <h3>Ridimensiona un anello</h3>
      <p>Su un cerchio o sui quattro spigoli di una faccia, la maniglia o il campo Scala (%) li ingrandisce o li riduce: un cilindro diventa un cono tronco.</p>` },
    { id: 'stretch', g: 'model', t: 'Allunga', h: `
      <p>${K('U')}: scegli un asse e una posizione, poi di quanti mm spostare tutto ciò che sta oltre il piano. Positivo allunga, negativo accorcia.</p>
      {{img:allunga|Piano di Allunga su una barra}}
      {{img:allunga-fine|Dopo aver applicato +14 mm}}
      <ul><li>Trascina il piano con il mouse, oppure clicca sull'oggetto per metterlo lì.</li><li>Va meglio su parti con la sezione costante, come un manico. Dove la sezione cambia o ci sono fori che attraversano il piano, il risultato può deformarsi.</li><li>Accorciare toglie la fetta tra il piano e il piano meno la distanza.</li></ul>` },
    { id: 'cut', g: 'model', t: 'Taglia', h: `
      {{img:taglia|Il piano di taglio si trascina con il mouse}}
      <p>${K('K')}: scegli un asse e la posizione del piano, poi Taglia. Il risultato sono <b>due oggetti separati</b>.</p>
      {{img:taglia-fine|Le due metà dopo il taglio}}
      <ul><li>Trascina il piano, scrivi la posizione oppure clicca sull'oggetto.</li><li>Sui modelli grandi compare una barra di avanzamento.</li></ul>` },
    { id: 'solids', g: 'solids', t: 'Fori e Combina', h: `
      <p>${K('X')} trasforma l'oggetto selezionato in <b>foro</b> (arancione trasparente) e viceversa.</p>
      {{img:foro|Un cilindro-foro dentro una scatola}}
      <p>${K('⌘E')} <b>Combina</b>: unisce i solidi e sottrae i fori. Le parti che restano staccate diventano livelli separati.</p>
      {{img:foro-fine|Il foro scavato}}
      <div class="tip"><b>Se Combina è lento.</b> Con tanti fori ci vuole qualche secondo e compare una barra di caricamento. Fori che si toccano o si sovrappongono rendono il calcolo molto più lungo: tienili separati quando puoi.</div>` },
    { id: 'repeat', g: 'solids', t: 'Ripeti', h: `
      {{img:ripeti|Griglia a nido d'ape di prismi esagonali}}
      <p>Copia la selezione in <b>griglia</b>, <b>nido d'ape</b> o <b>cerchio</b>. Righe e colonne, e lo <b>spazio</b> tra le copie: la distanza vera è l'ingombro dell'oggetto più lo spazio, quindi con 0 le copie si toccano.</p>
      <ul><li>Nido d'ape: le righe dispari sono spostate di mezzo passo; lo Spazio Y parte dal valore che dà righe a 0,866 del passo e si può cambiare.</li><li>Cerchio: numero di copie, angolo e centro.</li><li>Usalo con un foro per fare griglie di fori, poi Combina.</li></ul>` },
    { id: 'ruler', g: 'measure', t: 'Distanza e Misure', h: `
      {{img:distanza-alt|Con ${K('⌥')} premuto: larghezza e altezza del lato sotto il mouse}}
      <p>${K('D')}: clicca un punto o un lato, poi un secondo. Mostra la distanza e le differenze su X, Y, Z. Su due lati paralleli misura la distanza tra i piani. Il punto si aggancia ad angoli, metà lato e lati vicini; prima del clic vedi un'anteprima.</p>
      <ul><li>Tieni premuto ${K('⌥')} e passa su un lato: si illumina e vedi larghezza e altezza (o profondità) in tempo reale. Anche su lati inclinati o ruotati.</li><li>Con ${K('⌥')} premuto, su un angolo di un lato vedi l'angolo interno (per esempio 90° o 120°); su uno spigolo vedi l'angolo tra i due lati.</li><li>${K('M')} (Misure in basso) mostra le dimensioni reali degli oggetti.</li></ul>` },
    { id: 'shortcuts', g: 'ref', t: 'Scorciatoie', h: `
      <div class="sc-grid">
        <div><h3>Strumenti</h3><table>
          <tr><td>${K('V')}</td><td>Sposta</td></tr><tr><td>${K('Q')}</td><td>Riquadro</td></tr><tr><td>${K('W')}</td><td>Lazo</td></tr><tr><td>${K('R')}</td><td>Ruota</td></tr><tr><td>${K('L')}</td><td>Lato</td></tr><tr><td>${K('E')}</td><td>Spigolo</td></tr><tr><td>${K('U')}</td><td>Allunga</td></tr><tr><td>${K('K')}</td><td>Taglia</td></tr><tr><td>${K('D')}</td><td>Distanza</td></tr></table></div>
        <div><h3>Forme</h3><table>
          <tr><td>${K('B')}</td><td>Scatola</td></tr><tr><td>${K('C')}</td><td>Cilindro</td></tr><tr><td>${K('S')}</td><td>Sfera</td></tr><tr><td>${K('O')}</td><td>Cono</td></tr><tr><td>${K('P')}</td><td>Prisma</td></tr><tr><td>${K('T')}</td><td>Testo</td></tr><tr><td>${K('X')}</td><td>Foro / Solido</td></tr><tr><td>${K('⌘E')}</td><td>Combina</td></tr><tr><td>${K('⌘G')}</td><td>Raggruppa</td></tr></table></div>
        <div><h3>Vista</h3><table>
          <tr><td>${K('Spazio')}</td><td>Sposta la vista</td></tr><tr><td>${K('⌘0')}</td><td>Adatta</td></tr><tr><td>${K('⌘+')} ${K('⌘-')}</td><td>Zoom</td></tr><tr><td>${K('M')}</td><td>Misure</td></tr><tr><td>${K('Z')}</td><td>Raggi X</td></tr><tr><td>${K('Tab')}</td><td>Riduci barra</td></tr><tr><td>${K('F7')}</td><td>Livelli</td></tr><tr><td>${K('F8')}</td><td>Cronologia</td></tr><tr><td>${K('?')}</td><td>Questa guida</td></tr></table></div>
        <div><h3>Modifica</h3><table>
          <tr><td>${K('⌘Z')}</td><td>Annulla</td></tr><tr><td>${K('⇧⌘Z')}</td><td>Ripeti</td></tr><tr><td>${K('⌘D')}</td><td>Duplica</td></tr><tr><td>${K('⌘C')} ${K('⌘X')} ${K('⌘V')}</td><td>Copia, taglia, incolla</td></tr><tr><td>${K('⌘A')}</td><td>Seleziona tutto</td></tr><tr><td>${K('⌘O')}</td><td>Importa</td></tr><tr><td>${K('⌘S')}</td><td>Esporta</td></tr><tr><td>${K('Canc')}</td><td>Elimina</td></tr><tr><td>${K('Esc')}</td><td>Deseleziona</td></tr></table></div>
      </div>
      <p class="sc-note">Mentre trascini: ${K('⇧')} blocca un asse e spegne l'aggancio · ${K('⌘')} spegne la calamita (o sposta in verticale se premuto prima) · ${K('⌥')} duplica.</p>` },
    { id: 'print', g: 'ref', t: 'Consigli per la stampa', h: `
      <ul><li><b>Appoggia sul piatto</b>: Z = 0, altrimenti lo slicer vede il pezzo in aria.</li><li><b>Tolleranze</b>: per incastri lascia 0,2-0,4 mm di gioco; con Ripeti lo Spazio serve proprio a questo.</li><li><b>Fori</b>: i fori piccoli vengono più stretti del previsto; prova con un campione.</li><li><b>Esporta 3MF</b> se vuoi tenere nomi e colori degli oggetti.</li><li><b>Crepe quasi invisibili</b> dopo molte operazioni: Filo le ripara in parte, ma controlla l'anteprima dello slicer.</li></ul>` },
  ],
  en: [
    { id: 'start', g: 'start', t: 'Welcome', h: `
      <p>Filo is a simple 3D modeler for printable objects: boxes, hooks, holders, small cases. You build with basic shapes, cut holes and join everything. It works offline and your work stays on your computer.</p>
      <ol><li>Add a shape from the bar on the left (or with a key: ${K('B')} box, ${K('C')} cylinder).</li><li>Change size and position in the right panel, or drag the colored handles.</li><li>To make a hole, select it and press ${K('X')}: it turns translucent orange. Then ${K('⌘E')} (Combine) subtracts it from the solids.</li><li>Export as 3MF (recommended) or STL and open the file in your slicer.</li></ol>
      <div class="tip"><b>Print bed.</b> At the bottom, in "Work plane", pick your printer (A1 mini, X1C, H2D…) or a custom size. Z = 0 is the bed.</div>
      <p>Use the menu on the left to read how each tool works. Press <kbd>?</kbd> any time to reopen this guide.</p>` },
    { id: 'view', g: 'start', t: 'Moving the view', h: `
      <ul><li><b>Orbit</b>: drag in empty space or with the right button.</li><li><b>Pan</b>: ${K('Space')} + drag.</li><li><b>Zoom</b>: wheel or pinch on the trackpad; ${K('⌥')} + scroll works with any device.</li><li><b>Fit to view</b>: ${K('⌘0')}; double click an object to center it.</li></ul>
      <p>The cube at the top left shows the orientation. In the bottom bar, "View" jumps to Front, Top, Right or 3D. Front, Top and Right have no perspective, ideal for precise alignment.</p>
      <ul><li>${K('M')} shows the real <b>Dimensions</b> of objects.</li><li>${K('Z')} toggles <b>X-ray</b>: outlines of hidden parts.</li><li>${K('Tab')} collapses the sidebar.</li></ul>` },
    { id: 'shapes', g: 'create', t: 'Shapes', h: `
      {{img:forme|Box, cylinder, sphere, cone, prism and torus}}
      <p>Box ${K('B')}, cylinder ${K('C')}, sphere ${K('S')}, cone ${K('O')}, prism ${K('P')}, torus (from the bar). Each shape starts with simple sizes and is adjusted in the right panel.</p>
      <ul><li><b>Size</b> in mm (W, D, H). The lock keeps proportions; hold ${K('⇧')} while dragging to ignore it.</li><li><b>Corners and edges</b>: radius of vertical corners, top and bottom edge, rounded or chamfered.</li><li><b>Top %</b>: narrows the top and makes tapered boxes or truncated cones.</li><li><b>Prism</b>: pick the number of sides (hexagon, octagon…). <b>Cone</b>: tip radius.</li><li><b>Rotation</b> on X, Y and Z; "Rest on bed" brings the object to Z = 0.</li></ul>
      <p><b>Small box with lid</b> (from the welcome menu) creates a body and a lid already sized.</p>` },
    { id: 'text', g: 'create', t: 'Text', h: `
      <p>${K('T')} writes 3D text. Pick a font (Inter, Bebas Neue, Lora, VT323) or load your own with "+ Load font…". Adjust size, depth and letter spacing. Text is an object like any other: make it a hole to engrave it into a box.</p>` },
    { id: 'io', g: 'create', t: 'Import and export', h: `
      <ul><li><b>Import</b>: ${K('⌘O')} or drag the file onto the window. Accepts 3MF and STL.</li><li>If a file has several detached parts, Filo asks whether to keep them together or split them into layers.</li><li><b>Export</b>: ${K('⌘S')}. <b>3MF</b> is recommended (keeps names and colors); STL is a single body.</li></ul>
      <div class="tip"><b>Check before export.</b> 3MF and STL clean duplicate vertices and repair the small gaps left by Combine and Cut. Tiny defects may remain: slicers usually fix them on their own.</div>` },
    { id: 'move', g: 'select', t: 'Move and duplicate', h: `
      <p>${K('V')}: select and drag objects on the bed.</p>
      <ul><li>${K('⇧')} while dragging: lock an axis (and switch off snapping).</li><li>${K('⌘')} held before dragging: move up and down.</li><li>${K('⌥')} + drag: duplicate.</li><li>Arrows: move one step (with ${K('⇧')}, ten). ${K('[')} ${K(']')}: down and up.</li><li>${K('⌘D')} duplicates, ${K('⌘C')} ${K('⌘X')} ${K('⌘V')} copy, cut, paste; ${K('⌘⇧V')} pastes in place.</li><li>${K('Del')} deletes, ${K('Esc')} deselects.</li></ul>
      <p>The colored squares around the object resize it: ${K('⇧')} proportional, ${K('⌥')} from center.</p>` },
    { id: 'marquee', g: 'select', t: 'Marquee and Lasso', h: `
      {{img:riquadro|Marquee: selects everything visible in the area}}
      <p>${K('Q')} Marquee and ${K('W')} Lasso select by dragging. They only take what is really visible, not objects hidden behind.</p>
      {{img:lazo|Lasso: draw a free line around the objects}}
      <ul><li>${K('⇧')} adds to the selection; ${K('⌘')} removes.</li><li>A click in empty space deselects.</li></ul>` },
    { id: 'groups', g: 'select', t: 'Groups, layers and history', h: `
      <ul><li><b>Group</b>: ${K('⌘G')} joins several objects so they move together; ${K('⇧⌘G')} ungroups.</li><li><b>Layers</b> (${K('F7')}): list of objects, with lock and hide. ${K('⇧')} + click adds, ${K('⌘')} + click picks a range.</li><li><b>History</b> (${K('F8')}): every step with a preview, to go back. ${K('⌘Z')} undoes, ${K('⇧⌘Z')} redoes.</li></ul>
      <p>With two or more objects selected, click the one you want as the <b>key</b>: the others align to it.</p>` },
    { id: 'align', g: 'transform', t: 'Align and distribute', h: `
      <p>With several objects selected, the right panel shows Align on X, Y and Z (start, center, end). It aligns to the selection, or to the <b>key</b> object if you clicked one.</p>
      <p><b>Distribute</b> (X, Y, Z) sets equal gaps between three or more objects, keeping the two outer ones fixed. If they do not fit, it tells you by how much they overlap.</p>
      {{img:distribuisci-prima|Before: three boxes at different distances}}
      {{img:distribuisci|After Distribute on X: equal gaps}}
      <div class="tip">With a single object, Align works on the bed. Buttons that do not apply are dimmed and the tooltip says why.</div>` },
    { id: 'snap', g: 'transform', t: 'Step and magnet', h: `
      <p>At the bottom, <b>Step</b> is how far an object moves: from 0.1 to 10 mm, or <b>Free</b> (no snapping).</p>
      <p>The <b>Magnet</b> (button next to it) snaps corners and sides to other objects, touching or flush, even on models with many holes. It works vertically too.</p>
      {{img:calamita|A dragged object snaps into contact with the other}}
      <ul><li>${K('⌘')} held while dragging switches the magnet off for that move only.</li><li>${K('⇧')} locks an axis and switches off the step as well.</li><li>The magnet also acts when dragging edges (see Edge).</li></ul>` },
    { id: 'rotate', g: 'transform', t: 'Rotate', h: `
      <p>${K('R')} shows three rings, one per axis. Drag a ring to rotate in 15° steps; ${K('⇧')} gives 5° steps, ${K('⌥')} free rotation.</p>
      <p>In the panel, the X, Y, Z buttons rotate 90° (with ${K('⇧')} the other way), and the Rotation fields give the exact angle.</p>` },
    { id: 'face', g: 'model', t: 'Face', h: `
      {{img:lato|A selected face with its handle}}
      <p>${K('L')}: click a flat face and pull or push its handle to move it. The shape grows or shrinks on that side.</p>
      <ul><li>${K('⇧')} + click adds more faces.</li><li>A face flush with others in the same group moves together.</li><li>On cylinders the curved side is a single piece.</li></ul>` },
    { id: 'edge', g: 'model', t: 'Edge', h: `
      <p>${K('E')}: click an edge (${K('⇧')} to add more) and choose what to do.</p>
      <h3>Round or chamfer</h3>
      {{img:spigolo|Two rounded edges on a box}}
      <p>Type the size and press Apply. On <b>box and prism</b> each edge has its own radius and <b>stays editable</b>: reselect the edge to change it, use 0 to remove it. On other pieces the operation is final (you can undo).</p>
      <h3>Move the edge</h3>
      {{img:spigolo-sposta|Dragging the edge turns the cube into a trapezoid}}
      <p>A small square appears on an edge: drag it, or pick X, Y or Z and type the mm. The face tilts or lengthens. The piece becomes free (no longer parametric).</p>
      <ul><li>The <b>magnet</b> helps: back to "as before", aligns to parallel vertices of the piece and to other objects, and says so next to the value.</li><li>Step applies when the magnet snaps to nothing.</li><li>On a rounded edge, remove the rounding first.</li></ul>
      <h3>Resize a ring</h3>
      <p>On a circle or the four edges of a face, the handle or the Scale (%) field enlarges or reduces them: a cylinder becomes a truncated cone.</p>` },
    { id: 'stretch', g: 'model', t: 'Stretch', h: `
      <p>${K('U')}: pick an axis and a position, then how many mm to move everything beyond the plane. Positive lengthens, negative shortens.</p>
      {{img:allunga|Stretch plane on a bar}}
      {{img:allunga-fine|After applying +14 mm}}
      <ul><li>Drag the plane with the mouse, or click the object to put it there.</li><li>Works best on parts with a constant cross-section, like a handle. Where the section changes or holes cross the plane, the result may deform.</li><li>Shortening removes the slice between the plane and the plane minus the distance.</li></ul>` },
    { id: 'cut', g: 'model', t: 'Cut', h: `
      {{img:taglia|The cutting plane can be dragged with the mouse}}
      <p>${K('K')}: pick an axis and the plane position, then Cut. The result is <b>two separate objects</b>.</p>
      {{img:taglia-fine|The two halves after the cut}}
      <ul><li>Drag the plane, type the position or click the object.</li><li>On large models a progress bar appears.</li></ul>` },
    { id: 'solids', g: 'solids', t: 'Holes and Combine', h: `
      <p>${K('X')} turns the selected object into a <b>hole</b> (translucent orange) and back.</p>
      {{img:foro|A hole cylinder inside a box}}
      <p>${K('⌘E')} <b>Combine</b>: joins the solids and subtracts the holes. Parts that stay detached become separate layers.</p>
      {{img:foro-fine|The carved hole}}
      <div class="tip"><b>If Combine is slow.</b> With many holes it takes a few seconds and a loading bar appears. Holes that touch or overlap make the calculation much longer: keep them apart when you can.</div>` },
    { id: 'repeat', g: 'solids', t: 'Repeat', h: `
      {{img:ripeti|Honeycomb grid of hexagonal prisms}}
      <p>Copies the selection in a <b>grid</b>, <b>honeycomb</b> or <b>circle</b>. Rows and columns, and the <b>gap</b> between copies: the real distance is the object's size plus the gap, so with 0 the copies touch.</p>
      <ul><li>Honeycomb: odd rows are shifted by half a step; Gap Y starts at the value that gives rows at 0.866 of the pitch and can be changed.</li><li>Circle: number of copies, angle and center.</li><li>Use it with a hole to make grids of holes, then Combine.</li></ul>` },
    { id: 'ruler', g: 'measure', t: 'Distance and Dimensions', h: `
      {{img:distanza-alt|With ${K('⌥')} held: width and height of the face under the mouse}}
      <p>${K('D')}: click a point or an edge, then a second one. It shows the distance and the differences on X, Y, Z. On two parallel faces it measures the distance between planes. The point snaps to corners, edge midpoints and nearby edges; before you click you see a preview.</p>
      <ul><li>Hold ${K('⌥')} and move over a face: it lights up and you see width and height (or depth) in real time. Also on tilted or rotated faces.</li><li>With ${K('⌥')} held, over a face corner you see its inner angle (for example 90° or 120°); over an edge you see the angle between the two faces.</li><li>${K('M')} (Dimensions at the bottom) shows the real size of objects.</li></ul>` },
    { id: 'shortcuts', g: 'ref', t: 'Shortcuts', h: `
      <div class="sc-grid">
        <div><h3>Tools</h3><table>
          <tr><td>${K('V')}</td><td>Move</td></tr><tr><td>${K('Q')}</td><td>Marquee</td></tr><tr><td>${K('W')}</td><td>Lasso</td></tr><tr><td>${K('R')}</td><td>Rotate</td></tr><tr><td>${K('L')}</td><td>Face</td></tr><tr><td>${K('E')}</td><td>Edge</td></tr><tr><td>${K('U')}</td><td>Stretch</td></tr><tr><td>${K('K')}</td><td>Cut</td></tr><tr><td>${K('D')}</td><td>Distance</td></tr></table></div>
        <div><h3>Shapes</h3><table>
          <tr><td>${K('B')}</td><td>Box</td></tr><tr><td>${K('C')}</td><td>Cylinder</td></tr><tr><td>${K('S')}</td><td>Sphere</td></tr><tr><td>${K('O')}</td><td>Cone</td></tr><tr><td>${K('P')}</td><td>Prism</td></tr><tr><td>${K('T')}</td><td>Text</td></tr><tr><td>${K('X')}</td><td>Hole / Solid</td></tr><tr><td>${K('⌘E')}</td><td>Combine</td></tr><tr><td>${K('⌘G')}</td><td>Group</td></tr></table></div>
        <div><h3>View</h3><table>
          <tr><td>${K('Space')}</td><td>Pan the view</td></tr><tr><td>${K('⌘0')}</td><td>Fit</td></tr><tr><td>${K('⌘+')} ${K('⌘-')}</td><td>Zoom</td></tr><tr><td>${K('M')}</td><td>Dimensions</td></tr><tr><td>${K('Z')}</td><td>X-ray</td></tr><tr><td>${K('Tab')}</td><td>Collapse sidebar</td></tr><tr><td>${K('F7')}</td><td>Layers</td></tr><tr><td>${K('F8')}</td><td>History</td></tr><tr><td>${K('?')}</td><td>This guide</td></tr></table></div>
        <div><h3>Edit</h3><table>
          <tr><td>${K('⌘Z')}</td><td>Undo</td></tr><tr><td>${K('⇧⌘Z')}</td><td>Redo</td></tr><tr><td>${K('⌘D')}</td><td>Duplicate</td></tr><tr><td>${K('⌘C')} ${K('⌘X')} ${K('⌘V')}</td><td>Copy, cut, paste</td></tr><tr><td>${K('⌘A')}</td><td>Select all</td></tr><tr><td>${K('⌘O')}</td><td>Import</td></tr><tr><td>${K('⌘S')}</td><td>Export</td></tr><tr><td>${K('Del')}</td><td>Delete</td></tr><tr><td>${K('Esc')}</td><td>Deselect</td></tr></table></div>
      </div>
      <p class="sc-note">While dragging: ${K('⇧')} locks an axis and switches off snapping · ${K('⌘')} switches off the magnet (or moves vertically if held before) · ${K('⌥')} duplicates.</p>` },
    { id: 'print', g: 'ref', t: 'Printing tips', h: `
      <ul><li><b>Rest on the bed</b>: Z = 0, otherwise the slicer sees the piece in mid-air.</li><li><b>Tolerances</b>: for fits leave 0.2-0.4 mm of clearance; in Repeat the Gap is for exactly this.</li><li><b>Holes</b>: small holes come out tighter than expected; test with a sample.</li><li><b>Export 3MF</b> if you want to keep object names and colors.</li><li><b>Almost invisible cracks</b> after many operations: Filo repairs them in part, but check the slicer preview.</li></ul>` },
  ],
};
