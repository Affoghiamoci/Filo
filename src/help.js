// Guida di Filo: contenuti in italiano e inglese. Le figure sono {{img:nome|didascalia}}.
export const GROUPS = {
  it: { start: 'Per iniziare', create: 'Creare', select: 'Selezionare', transform: 'Trasformare', model: 'Modellare', solids: 'Fori e unione', measure: 'Misurare', ref: 'Riferimento' },
  en: { start: 'Getting started', create: 'Create', select: 'Select', transform: 'Transform', model: 'Shape', solids: 'Holes and joining', measure: 'Measure', ref: 'Reference' },
};

const K = (...k) => k.map(x => `<kbd>${x}</kbd>`).join(' ');

export const HELP = {
  it: [
    { id: 'start', g: 'start', t: 'Benvenuto', h: `
      <p>Filo è un modellatore 3D semplice per oggetti da stampare, come scatole, ganci e supporti. Parti da forme di base, fai i fori e unisci tutto. Funziona offline e i file restano sul tuo computer.</p>
      <ol><li>Aggiungi una forma dalla barra a sinistra (o con un tasto: ${K('B')} scatola, ${K('C')} cilindro).</li><li>Cambia misure e posizione dal pannello a destra, oppure trascina le maniglie colorate.</li><li>Per fare un foro, selezionalo e premi ${K('X')}: diventa arancione trasparente. Poi ${K('⌘E')} (Combina) lo sottrae dai solidi.</li><li>Esporta in 3MF (consigliato) o STL e apri il file nello slicer.</li></ol>
      <div class="tip"><b>Piatto di stampa.</b> In basso, in "Piano di lavoro", scegli la tua stampante (A1 mini, X1C, H2D…) o una misura libera. Z = 0 è il piatto.</div>
      <p>Usa il menu a sinistra per leggere come funziona ogni strumento. Con <kbd>?</kbd> riapri questa guida quando vuoi.</p>` },
    { id: 'view', g: 'start', t: 'Muovere la vista', h: `
      <ul><li><b>Ruotare</b>: trascina nel vuoto o con il tasto destro. Un clic destro senza trascinare apre il menu.</li><li><b>Spostare</b>: ${K('Spazio')} + trascina.</li><li><b>Zoom</b>: rotella o pizzico sul trackpad; ${K('⌥')} + scorrimento funziona con qualsiasi dispositivo.</li><li><b>Adatta alla vista</b>: ${K('⌘0')}; doppio clic su un oggetto per centrarlo.</li></ul>
      <p>Il cubo in alto a sinistra mostra l'orientamento. Nella barra in basso, "Vista" porta subito Davanti, Sopra, Destra o 3D. Davanti, Sopra e Destra sono senza prospettiva, comode per allineare.</p>
      <ul><li>${K('M')} mostra le <b>Misure</b> reali degli oggetti.</li><li>${K('Z')} attiva i <b>Raggi X</b>: i contorni delle parti coperte.</li><li>${K('Tab')} riduce la barra laterale.</li></ul>` },
    { id: 'shapes', g: 'create', t: 'Forme', h: `
      {{img:forme|Scatola, cilindro, sfera, cono, prisma e toro}}
      <p>Scatola ${K('B')}, cilindro ${K('C')}, sfera ${K('S')}, cono ${K('O')}, prisma ${K('P')}, toro (dalla barra). Ogni forma nasce con misure semplici e si regola dal pannello a destra.</p>
      <ul><li><b>Misure</b> in mm (L, P, A). Il lucchetto le tiene proporzionate; con ${K('⇧')} trascini senza proporzioni.</li><li><b>Angoli e bordi</b>: raggio degli angoli verticali, bordo alto e basso, arrotondato o smussato.</li><li><b>Cima %</b>: restringe la parte alta e fa tronchi di piramide o di cono.</li><li><b>Prisma</b>: scegli quanti lati (esagono, ottagono…). <b>Cono</b>: raggio della punta.</li><li><b>Rotazione</b> su X, Y e Z; "Appoggia sul piatto" porta l'oggetto a Z = 0.</li></ul>
      <p>Anche <b>Scatolina con coperchio</b> (dal menu di benvenuto) crea corpo e coperchio già dimensionati.</p>` },
    { id: 'text', g: 'create', t: 'Testo', h: `
      <p>${K('T')} scrive testo 3D. Scegli il font (Inter, Bebas Neue, Lora, VT323) oppure carica un tuo font con "+ Carica font…". Regoli dimensione, spessore e spaziatura. Il testo è un oggetto come gli altri: puoi renderlo un foro per inciderlo in una scatola.</p>` },
    { id: 'io', g: 'create', t: 'Importare ed esportare', h: `
      <ul><li><b>Importa</b>: ${K('⌘O')} oppure trascina il file sulla finestra. Accetta 3MF, STL e SVG (loghi e sagome diventano pezzi spessi 1 mm: servono i riempimenti, non i soli contorni).</li><li>Se un file ha più parti staccate, Filo chiede se tenerle unite o dividerle in livelli.</li><li><b>Esporta</b>: ${K('⌘S')}. Il <b>3MF</b> è consigliato (tiene i nomi e i colori); l'STL è un solo corpo.</li></ul>
      <div class="tip">Prima di esportare, Filo toglie i vertici doppi e ripara le fessure più piccole. I pezzi fatti con Combina e Taglia escono già chiusi. Per essere sicuro, usa <b>Controlla</b> in alto a destra (vedi Controlla stampa).</div>` },
    { id: 'move', g: 'select', t: 'Sposta e duplica', h: `
      <p>${K('V')}: seleziona e trascina gli oggetti sul piatto.</p>
      <ul><li>${K('⇧')} mentre trascini: blocca un asse (e spegne l'aggancio).</li><li>${K('⌘')} premuto prima di trascinare: sposta su e giù.</li><li>${K('⌥')} + trascina: duplica.</li><li>Frecce: spostano di uno scatto (con ${K('⇧')}, di dieci). ${K('[')} ${K(']')}: giù e su.</li><li>${K('⌘D')} duplica, ${K('⌘C')} ${K('⌘X')} ${K('⌘V')} copia, taglia, incolla; ${K('⌘⇧V')} incolla sul posto.</li><li>${K('Canc')} elimina, ${K('Esc')} deseleziona.</li></ul>
      <p>I quadratini colorati intorno all'oggetto ridimensionano: ${K('⇧')} proporzionale, ${K('⌥')} dal centro.</p>` },
    { id: 'marquee', g: 'select', t: 'Riquadro e Lazo', h: `
      {{img:riquadro|Riquadro: seleziona tutto ciò che si vede nell'area}}
      <p>${K('Q')} Riquadro e ${K('W')} Lazo selezionano trascinando. Prendono solo ciò che si vede davvero, non gli oggetti nascosti dietro.</p>
      {{img:lazo|Lazo: disegni una linea libera attorno agli oggetti}}
      <ul><li>${K('⇧')} aggiunge alla selezione; ${K('⌘')} la toglie.</li><li>Un clic nel vuoto deseleziona.</li></ul>
      <div class="tip">Nella barra a sinistra gli strumenti con il triangolino nell'angolo hanno una seconda funzione (Riquadro e Lazo, Taglia e Allunga, Combina e Interseca). Per aprirla tieni premuto, fai clic destro o clicca il triangolino. Il pulsante ricorda l'ultimo strumento scelto, tranne Combina che resta sempre Combina. Le scorciatoie funzionano sempre in modo diretto.</div>` },
    { id: 'groups', g: 'select', t: 'Gruppi, livelli e cronologia', h: `
      <ul><li><b>Gruppo</b>: ${K('⌘G')} unisce più oggetti perché si muovano insieme; ${K('⇧⌘G')} li separa.</li><li><b>Livelli</b> (${K('F7')}): elenco degli oggetti, con blocco e nascondi. ${K('⇧')} + clic aggiunge, ${K('⌘')} + clic prende un intervallo.</li><li><b>Cronologia</b> (${K('F8')}): ogni passaggio con anteprima, per tornare indietro. ${K('⌘Z')} annulla, ${K('⇧⌘Z')} ripete. Dopo un annulla ritrovi anche gli spigoli e i lati che avevi selezionato, così puoi ritentare con un'altra misura.</li></ul>
      <p>Con due o più oggetti selezionati, clicca quello che vuoi come <b>chiave</b>: gli altri si allineano a lui.</p>` },
    { id: 'ctx', g: 'select', t: 'Menu del tasto destro', h: `
      <p>Fai clic destro, senza trascinare, su un oggetto o sul vuoto: compare un menu corto con le azioni più usate, ognuna con la sua scorciatoia. Trascinando con il destro la scena continua a ruotare.</p>
      <ul><li><b>Su un oggetto</b>: Duplica, Copia, Trasforma in foro o in solido, Appoggia sul piatto, Blocca, Nascondi, Elimina. Se l'oggetto non era selezionato, si seleziona.</li><li><b>Con più oggetti selezionati</b>: in più Combina, Interseca e Raggruppa (o Separa gruppo).</li><li><b>Sul vuoto</b>: Incolla, Seleziona tutto, Inquadra tutto, Raggi X e Misure.</li></ul>
      <div class="tip">Blocca e Nascondi tolgono l'oggetto dalla selezione: per riprenderlo apri i <b>Livelli</b> (${K('F7')}), oppure premi ${K('⌘Z')}: Annulla riporta indietro anche Blocca e Nascondi. Esc chiude il menu, le frecce su e giù scorrono le voci e Invio sceglie.</div>` },
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
      {{img:ruota|L'anello si illumina, poi lo spicchio mostra l'angolo mentre ruoti}}
      <p>${K('R')} mostra tre anelli, uno per asse. Trascina un anello per ruotare: di default scatta ogni 15°, con ${K('⇧')} ogni 5°, con ${K('⌥')} è libero.</p>
      <p>Passando sopra un anello si illumina, e mentre ruoti vedi uno spicchio arancione con l'angolo fatto. Nel pannello a destra i pulsanti X, Y, Z ruotano di 90° (con ${K('⇧')} nel verso opposto) e i campi Rotazione accettano un angolo preciso.</p>` },
    { id: 'face', g: 'model', t: 'Lato', h: `
      {{img:lato|Un lato selezionato con la sua maniglia}}
      <p>${K('L')}: clicca un lato piatto e tira o spingi la maniglia per spostarlo. La forma si allunga o si accorcia da quella parte.</p>
      <ul><li>${K('⇧')} + clic aggiunge altri lati.</li><li>Un lato a filo con altri dello stesso gruppo si muove insieme.</li><li>Sui cilindri il lato curvo è un pezzo unico.</li></ul>` },
    { id: 'edge', g: 'model', t: 'Spigolo', h: `
      <p>${K('E')}: clicca uno spigolo (con ${K('⇧')} ne scegli altri) e decidi cosa farne.</p>
      <h3>Arrotonda o smussa</h3>
      {{img:spigolo|Due spigoli arrotondati su una scatola}}
      <p>Scrivi la misura e premi Applica. Su scatola e prisma ogni spigolo ha il suo raggio, e puoi cambiarlo dopo: riseleziona lo spigolo, con 0 lo togli. Su cilindro e cono vale per il bordo alto e per quello basso: si possono modificare anche dal pannello a destra (Bordo alto, Bordo basso). Gli altri pezzi (pezzi uniti o importati) vengono modificati in modo definitivo, ma puoi sempre annullare. Sfera e toro non hanno spigoli.</p>
      <h3>Sposta lo spigolo</h3>
      {{img:spigolo-sposta|Trascinando lo spigolo il cubo diventa un trapezio}}
      {{img:esagono|Un lato dell'esagono tirato in fuori con la parete dritta}}
      <p>Su uno spigolo compare un quadratino. Trascinalo, oppure scegli la direzione e scrivi i mm. Con X, Y o Z la faccia si inclina, e da un cubo puoi ottenere un trapezio. Dopo questa modifica il pezzo non è più parametrico.</p>
      <ul><li><b>⊥ (perpendicolare)</b>: sui lati storti, come quelli dell'esagono, sposta lo spigolo dritto verso l'esterno. Sugli spigoli verticali del prisma va in fuori lungo il raggio.</li><li><b>Parete dritta</b> (spento di default): per gli spigoli orizzontali sposta anche la base sotto o sopra, così la parete resta verticale e la faccia si allunga davvero invece di inclinarsi. Lascialo spento per spostare il solo spigolo e inclinare la parete.</li><li>Sul prisma puoi scegliere anche gli spigoli verticali.</li></ul>
      <ul><li>La calamita ti aiuta a tornare com'era, ad allinearti ai vertici paralleli e agli altri oggetti. Lo scatto vale quando la calamita non aggancia nulla.</li><li>Se lo spigolo è arrotondato, togli prima l'arrotondamento.</li></ul>
      <h3>Ridimensiona un anello</h3>
      <p>Su un cerchio, o sugli spigoli di una faccia, trascina la maniglia o scrivi la scala in %. Con 50 % sul bordo alto, un cilindro diventa un cono tronco. Con la calamita attiva la maniglia si aggancia a 100 % (come prima) e al raggio dell'altro anello, così torni a un cilindro dritto.</p>` },
    { id: 'stretch', g: 'model', t: 'Allunga', h: `
      <p>${K('U')}: scegli un asse e una posizione, poi di quanti mm spostare tutto ciò che sta oltre il piano. Un numero positivo allunga, uno negativo accorcia.</p>
      {{img:allunga|Piano di Allunga su una barra}}
      {{img:allunga-fine|Dopo aver applicato +14 mm}}
      <ul><li>Trascina il piano con il mouse, oppure clicca sull'oggetto per metterlo lì.</li><li>Il pezzo viene tagliato sul piano e lo spazio si riempie con la stessa sezione: i fori e le pareti inclinate restano come sono.</li><li>Accorciando, la fetta tra il piano e il piano meno la distanza viene tolta.</li></ul>` },
    { id: 'cut', g: 'model', t: 'Taglia', h: `
      {{img:taglia|Il piano di taglio si trascina con il mouse}}
      <p>${K('K')}: scegli un asse e la posizione del piano, poi premi Taglia. Ottieni due oggetti separati.</p>
      {{img:taglia-fine|Le due metà dopo il taglio}}
      <ul><li>Trascina il piano, scrivi la posizione o clicca sull'oggetto.</li><li>Sui modelli grandi compare una barra di avanzamento.</li></ul>` },
    { id: 'solids', g: 'solids', t: 'Fori, Combina e Interseca', h: `
      <p>${K('X')} trasforma l'oggetto selezionato in foro (arancione trasparente), e viceversa.</p>
      {{img:foro|Un cilindro-foro dentro una scatola}}
      <p>${K('⌘E')} è Combina: unisce i solidi e sottrae i fori. Le parti che restano staccate diventano livelli separati.</p>
      {{img:foro-fine|Il foro scavato}}
      <p>${K('⇧⌘E')} è Interseca: tiene solo la parte in comune tra i solidi selezionati (servono almeno due solidi). I fori, se ci sono, scavano il risultato. Se gli oggetti non si toccano compare un avviso e non cambia nulla. Utile per ricavare forme particolari, come una scatola arrotondata da una scatola e una sfera.</p>
      <div class="tip">Con tanti fori Combina può metterci qualche secondo, e compare una barra di caricamento. Il risultato è sempre un solido chiuso.</div>` },
    { id: 'repeat', g: 'solids', t: 'Ripeti', h: `
      {{img:ripeti|Griglia a nido d'ape di prismi esagonali}}
      <p>Copia la selezione in griglia, a nido d'ape o in cerchio. Scegli righe, colonne e lo spazio tra le copie: la distanza è l'ingombro dell'oggetto più lo spazio, quindi con 0 le copie si toccano.</p>
      <ul><li>Nido d'ape: le righe dispari sono spostate di mezzo passo. Lo Spazio Y parte da un valore che tiene le righe vicine, ma puoi cambiarlo.</li><li>Cerchio: numero di copie, angolo e centro.</li><li>Se copi un foro puoi fare una griglia di fori, poi premi Combina.</li></ul>` },
    { id: 'ruler', g: 'measure', t: 'Metro e Misure', h: `
      {{img:distanza-alt|Con ${K('⌥')} premuto: larghezza e altezza del lato sotto il mouse}}
      <p>${K('D')}: clicca un punto o un lato, poi un secondo. Vedi la distanza e le differenze su X, Y e Z. Tra due lati paralleli misura la distanza tra i piani. Il punto si aggancia ad angoli, metà dei lati e lati vicini, e prima del clic vedi dove cadrà.</p>
      <h3>Cosa significano i segni</h3>
      <p>Prima del clic, sul pezzo compare un segno: dice a cosa si aggancerà il punto. Se ce n'è più di uno vicino vince il primo della lista.</p>
      <ul class="hp-leg"><li><i class="mk v"></i><span><b>Quadrato</b>: un angolo (vertice) del pezzo. È l'aggancio più forte, perché di solito misuri da un angolo all'altro.</span></li><li><i class="mk m"></i><span><b>Rombo pieno</b>: la metà di un lato. Utile per centrare un foro o trovare il centro di una parete.</span></li><li><i class="mk e"></i><span><b>Cerchio vuoto</b>: un punto qualsiasi lungo uno spigolo. Il punto resta sullo spigolo, ma non è né un angolo né la metà.</span></li><li><i class="mk f"></i><span><b>Puntino piccolo e tenue</b>: nessun aggancio, il punto cade dove punti sulla faccia.</span></li><li><i class="mk p"></i><span><b>Cerchio bianco con bordo arancione</b>: i due punti che hai già cliccato. La linea arancione li unisce e la misura sta a metà.</span></li></ul>
      <p>Con ${K('⌥')} premuto i segni cambiano significato: il quadrato indica un angolo del lato e il cerchio uno spigolo, per leggere gli angoli invece delle distanze.</p>
      <ul><li>Tieni premuto ${K('⌥')} e passa su un lato: si illumina e vedi larghezza e altezza (o profondità), anche se il lato è inclinato.</li><li>Sempre con ${K('⌥')}, su un angolo vedi l'angolo del lato e la lunghezza dei due bordi; su uno spigolo vedi l'angolo tra i due lati e la sua lunghezza.</li><li>${K('M')} mostra le dimensioni reali degli oggetti.</li></ul>` },
    { id: 'shortcuts', g: 'ref', t: 'Scorciatoie', h: `
      <div class="sc-grid">
        <div><h3>Strumenti</h3><table>
          <tr><td>${K('V')}</td><td>Sposta</td></tr><tr><td>${K('Q')}</td><td>Riquadro</td></tr><tr><td>${K('W')}</td><td>Lazo</td></tr><tr><td>${K('R')}</td><td>Ruota</td></tr><tr><td>${K('L')}</td><td>Lato</td></tr><tr><td>${K('E')}</td><td>Spigolo</td></tr><tr><td>${K('U')}</td><td>Allunga</td></tr><tr><td>${K('K')}</td><td>Taglia</td></tr><tr><td>${K('D')}</td><td>Metro</td></tr></table></div>
        <div><h3>Forme</h3><table>
          <tr><td>${K('B')}</td><td>Scatola</td></tr><tr><td>${K('C')}</td><td>Cilindro</td></tr><tr><td>${K('S')}</td><td>Sfera</td></tr><tr><td>${K('O')}</td><td>Cono</td></tr><tr><td>${K('P')}</td><td>Prisma</td></tr><tr><td>${K('T')}</td><td>Testo</td></tr><tr><td>${K('X')}</td><td>Foro / Solido</td></tr><tr><td>${K('⌘E')}</td><td>Combina</td></tr><tr><td>${K('⇧⌘E')}</td><td>Interseca</td></tr><tr><td>${K('⌘G')}</td><td>Raggruppa</td></tr></table></div>
        <div><h3>Vista</h3><table>
          <tr><td>${K('Spazio')}</td><td>Sposta la vista</td></tr><tr><td>${K('⌘0')}</td><td>Adatta</td></tr><tr><td>${K('⌘+')} ${K('⌘-')}</td><td>Zoom</td></tr><tr><td>${K('M')}</td><td>Misure</td></tr><tr><td>${K('Z')}</td><td>Raggi X</td></tr><tr><td>${K('Tab')}</td><td>Riduci barra</td></tr><tr><td>${K('F7')}</td><td>Livelli</td></tr><tr><td>${K('F8')}</td><td>Cronologia</td></tr><tr><td>${K('?')}</td><td>Questa guida</td></tr></table></div>
        <div><h3>Modifica</h3><table>
          <tr><td>${K('⌘Z')}</td><td>Annulla</td></tr><tr><td>${K('⇧⌘Z')}</td><td>Ripeti</td></tr><tr><td>${K('⌘D')}</td><td>Duplica</td></tr><tr><td>${K('⌘C')} ${K('⌘X')} ${K('⌘V')}</td><td>Copia, taglia, incolla</td></tr><tr><td>${K('⌘A')}</td><td>Seleziona tutto</td></tr><tr><td>${K('⌘O')}</td><td>Importa</td></tr><tr><td>${K('⌘S')}</td><td>Esporta</td></tr><tr><td>${K('Canc')}</td><td>Elimina</td></tr><tr><td>${K('Esc')}</td><td>Deseleziona</td></tr></table></div>
      </div>
      <p class="sc-note">Mentre trascini: ${K('⇧')} blocca un asse e spegne l'aggancio · ${K('⌘')} spegne la calamita (o sposta in verticale se premuto prima) · ${K('⌥')} duplica.</p>` },
    { id: 'check', g: 'ref', t: 'Controlla stampa', h: `
      {{img:controlla|Il pannello Controlla stampa con l'anteprima a strati}}
      <p>Il pulsante <b>Controlla</b> (in alto, vicino a Esporta) apre un pannello a destra che resta aperto mentre guardi il modello. Analizza i pezzi selezionati, oppure tutto il visibile se non c'è nulla di selezionato. L'esportazione invece porta sempre tutto il piatto.</p>
      <ul><li><b>Solido chiuso</b>: se ci sono crepe o facce sovrapposte, lo slicer può sbagliare. Ti dice quali pezzi.</li><li><b>Anteprima a strati</b>: scorri lo slider e vedi la sezione a ogni altezza. Nel modello compare un piano arancione alla stessa altezza.</li><li><b>Pareti sottili</b>: le zone sotto lo spessore minimo (0,8 mm di default) diventano rosse nell'anteprima.</li><li><b>Pezzi sospesi</b> e base a contatto con il piatto.</li><li><b>Sbalzi oltre 45°</b>: in rosso nel modello, per capire dove servirebbero i supporti.</li><li>Una stima di strati, grammi di PLA e tempo.</li></ul>
      <div class="tip">È un controllo veloce, non uno slicer: la stima è indicativa e il G-code lo fa sempre Bambu Studio. Se modifichi il pezzo mentre il pannello è aperto, si aggiorna da solo.</div>` },
    { id: 'print', g: 'ref', t: 'Consigli per la stampa', h: `
      <ul><li><b>Appoggia sul piatto.</b> Con Z = 0 lo slicer non vede il pezzo in aria. Il pulsante nel pannello (o la voce nel menu del tasto destro) raddrizza anche il pezzo inclinato: lo posa sul lato piatto più vicino. Con più oggetti selezionati li tratta come un blocco unico.</li><li><b>Tolleranze.</b> Per gli incastri lascia 0,2-0,4 mm di gioco. Con Ripeti lo Spazio serve a questo.</li><li><b>Fori piccoli.</b> Vengono più stretti del previsto, quindi prova prima con un campione.</li><li><b>Esporta in 3MF</b> se vuoi tenere nomi e colori.</li><li><b>Prima di stampare</b> dai un'occhiata all'anteprima dello slicer.</li></ul>` },
  ],
  en: [
    { id: 'start', g: 'start', t: 'Welcome', h: `
      <p>Filo is a simple 3D modeler for printable objects, like boxes, hooks and holders. Start from basic shapes, make the holes and join everything. It works offline and your files stay on your computer.</p>
      <ol><li>Add a shape from the bar on the left (or with a key: ${K('B')} box, ${K('C')} cylinder).</li><li>Change size and position in the right panel, or drag the colored handles.</li><li>To make a hole, select it and press ${K('X')}: it turns translucent orange. Then ${K('⌘E')} (Combine) subtracts it from the solids.</li><li>Export as 3MF (recommended) or STL and open the file in your slicer.</li></ol>
      <div class="tip"><b>Print bed.</b> At the bottom, in "Work plane", pick your printer (A1 mini, X1C, H2D…) or a custom size. Z = 0 is the bed.</div>
      <p>Use the menu on the left to read how each tool works. Press <kbd>?</kbd> to reopen this guide whenever you want.</p>` },
    { id: 'view', g: 'start', t: 'Moving the view', h: `
      <ul><li><b>Orbit</b>: drag in empty space or with the right button. A right-click without dragging opens the menu.</li><li><b>Pan</b>: ${K('Space')} + drag.</li><li><b>Zoom</b>: wheel or pinch on the trackpad; ${K('⌥')} + scroll works with any device.</li><li><b>Fit to view</b>: ${K('⌘0')}; double click an object to center it.</li></ul>
      <p>The cube at the top left shows the orientation. In the bottom bar, "View" jumps to Front, Top, Right or 3D. Front, Top and Right have no perspective, handy for aligning.</p>
      <ul><li>${K('M')} shows the real <b>Dimensions</b> of objects.</li><li>${K('Z')} toggles <b>X-ray</b>: outlines of hidden parts.</li><li>${K('Tab')} collapses the sidebar.</li></ul>` },
    { id: 'shapes', g: 'create', t: 'Shapes', h: `
      {{img:forme|Box, cylinder, sphere, cone, prism and torus}}
      <p>Box ${K('B')}, cylinder ${K('C')}, sphere ${K('S')}, cone ${K('O')}, prism ${K('P')}, torus (from the bar). Each shape starts with simple sizes and is adjusted in the right panel.</p>
      <ul><li><b>Size</b> in mm (W, D, H). The lock keeps proportions; hold ${K('⇧')} while dragging to ignore it.</li><li><b>Corners and edges</b>: radius of vertical corners, top and bottom edge, rounded or chamfered.</li><li><b>Top %</b>: narrows the top and makes tapered boxes or truncated cones.</li><li><b>Prism</b>: pick the number of sides (hexagon, octagon…). <b>Cone</b>: tip radius.</li><li><b>Rotation</b> on X, Y and Z; "Rest on bed" brings the object to Z = 0.</li></ul>
      <p><b>Small box with lid</b> (from the welcome menu) creates a body and a lid already sized.</p>` },
    { id: 'text', g: 'create', t: 'Text', h: `
      <p>${K('T')} writes 3D text. Pick a font (Inter, Bebas Neue, Lora, VT323) or load your own with "+ Load font…". Adjust size, depth and letter spacing. Text is an object like any other: make it a hole to engrave it into a box.</p>` },
    { id: 'io', g: 'create', t: 'Import and export', h: `
      <ul><li><b>Import</b>: ${K('⌘O')} or drag the file onto the window. Accepts 3MF, STL and SVG (logos and shapes become 1 mm thick pieces: it needs filled shapes, not outlines only).</li><li>If a file has several detached parts, Filo asks whether to keep them together or split them into layers.</li><li><b>Export</b>: ${K('⌘S')}. <b>3MF</b> is recommended (keeps names and colors); STL is a single body.</li></ul>
      <div class="tip">Before exporting, Filo removes duplicate vertices and repairs the smallest gaps. Pieces made with Combine and Cut already come out closed. To be sure, use <b>Check</b> at the top right (see Print check).</div>` },
    { id: 'move', g: 'select', t: 'Move and duplicate', h: `
      <p>${K('V')}: select and drag objects on the bed.</p>
      <ul><li>${K('⇧')} while dragging: lock an axis (and switch off snapping).</li><li>${K('⌘')} held before dragging: move up and down.</li><li>${K('⌥')} + drag: duplicate.</li><li>Arrows: move one step (with ${K('⇧')}, ten). ${K('[')} ${K(']')}: down and up.</li><li>${K('⌘D')} duplicates, ${K('⌘C')} ${K('⌘X')} ${K('⌘V')} copy, cut, paste; ${K('⌘⇧V')} pastes in place.</li><li>${K('Del')} deletes, ${K('Esc')} deselects.</li></ul>
      <p>The colored squares around the object resize it: ${K('⇧')} proportional, ${K('⌥')} from center.</p>` },
    { id: 'marquee', g: 'select', t: 'Marquee and Lasso', h: `
      {{img:riquadro|Marquee: selects everything visible in the area}}
      <p>${K('Q')} Marquee and ${K('W')} Lasso select by dragging. They only take what is really visible, not objects hidden behind.</p>
      {{img:lazo|Lasso: draw a free line around the objects}}
      <ul><li>${K('⇧')} adds to the selection; ${K('⌘')} removes.</li><li>A click in empty space deselects.</li></ul>
      <div class="tip">In the bar on the left, tools with a small triangle in the corner have a second function (Marquee and Lasso, Cut and Stretch, Combine and Intersect). To open it, hold the button, right-click or click the triangle. The button remembers the last tool you picked, except Combine, which always stays Combine. Shortcuts always work directly.</div>` },
    { id: 'groups', g: 'select', t: 'Groups, layers and history', h: `
      <ul><li><b>Group</b>: ${K('⌘G')} joins several objects so they move together; ${K('⇧⌘G')} ungroups.</li><li><b>Layers</b> (${K('F7')}): list of objects, with lock and hide. ${K('⇧')} + click adds, ${K('⌘')} + click picks a range.</li><li><b>History</b> (${K('F8')}): every step with a preview, to go back. ${K('⌘Z')} undoes, ${K('⇧⌘Z')} redoes. After an undo, the edges and faces you had selected are selected again, so you can retry with another value.</li></ul>
      <p>With two or more objects selected, click the one you want as the <b>key</b>: the others align to it.</p>` },
    { id: 'ctx', g: 'select', t: 'Right-click menu', h: `
      <p>Right-click, without dragging, on an object or on empty space: a short menu shows the most used actions, each with its shortcut. Dragging with the right button still orbits the scene.</p>
      <ul><li><b>On an object</b>: Duplicate, Copy, Turn into hole or solid, Drop to plate, Lock, Hide, Delete. If the object was not selected, it gets selected.</li><li><b>With several objects selected</b>: also Combine, Intersect and Group (or Ungroup).</li><li><b>On empty space</b>: Paste, Select all, Fit all, X-ray and Size.</li></ul>
      <div class="tip">Lock and Hide remove the object from the selection: to get it back open <b>Layers</b> (${K('F7')}), or press ${K('⌘Z')}: Undo also reverts Lock and Hide. Esc closes the menu, the up and down arrows move through the items and Enter picks one.</div>` },
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
      {{img:ruota|The ring lights up, then the wedge shows the angle while you rotate}}
      <p>${K('R')} shows three rings, one per axis. Drag a ring to rotate: it snaps every 15° by default, every 5° with ${K('⇧')}, and is free with ${K('⌥')}.</p>
      <p>A ring lights up when you hover it, and while you rotate you see an orange wedge with the angle done so far. In the right panel the X, Y, Z buttons rotate by 90° (the other way with ${K('⇧')}) and the Rotation fields take an exact angle.</p>` },
    { id: 'face', g: 'model', t: 'Face', h: `
      {{img:lato|A selected face with its handle}}
      <p>${K('L')}: click a flat face and pull or push its handle to move it. The shape grows or shrinks on that side.</p>
      <ul><li>${K('⇧')} + click adds more faces.</li><li>A face flush with others in the same group moves together.</li><li>On cylinders the curved side is a single piece.</li></ul>` },
    { id: 'edge', g: 'model', t: 'Edge', h: `
      <p>${K('E')}: click an edge (hold ${K('⇧')} to pick more) and decide what to do with it.</p>
      <h3>Round or chamfer</h3>
      {{img:spigolo|Two rounded edges on a box}}
      <p>Type the size and press Apply. On box and prism each edge has its own radius, and you can change it later: reselect the edge, use 0 to remove it. On cylinder and cone this works on the top and bottom edge, and you can also edit them from the right panel (Top edge, Bottom edge). Other pieces (merged or imported) are changed for good, but you can always undo. Sphere and torus have no edges.</p>
      <h3>Move the edge</h3>
      {{img:spigolo-sposta|Dragging the edge turns the cube into a trapezoid}}
      {{img:esagono|One side of the hexagon pulled out with the straight wall}}
      <p>A small square appears on the edge. Drag it, or pick the direction and type the mm. With X, Y or Z the face tilts, and a cube can become a trapezoid. After this the piece is no longer parametric.</p>
      <ul><li><b>⊥ (perpendicular)</b>: on slanted sides, like the hexagon's, it moves the edge straight outwards. On the prism's vertical edges it goes out along the radius.</li><li><b>Straight wall</b> (off by default): for horizontal edges it also moves the base below or above, so the wall stays vertical and the face really lengthens instead of tilting. Leave it off to move just the edge and tilt the wall.</li><li>On the prism you can also pick the vertical edges.</li></ul>
      <ul><li>The magnet helps you go back to how it was, line up with parallel vertices and with other objects. Snap step applies when the magnet finds nothing.</li><li>If the edge is rounded, remove the rounding first.</li></ul>
      <h3>Resize a ring</h3>
      <p>On a circle, or on the edges of a face, drag the handle or type the scale in %. With 50 % on the top edge, a cylinder becomes a truncated cone. With the magnet on, the handle snaps to 100 % (as before) and to the radius of the other ring, so you can get back to a straight cylinder.</p>` },
    { id: 'stretch', g: 'model', t: 'Stretch', h: `
      <p>${K('U')}: pick an axis and a position, then how many mm to move everything beyond the plane. A positive number stretches, a negative one shortens.</p>
      {{img:allunga|Stretch plane on a bar}}
      {{img:allunga-fine|After applying +14 mm}}
      <ul><li>Drag the plane with the mouse, or click on the object to put it there.</li><li>The piece is cut on the plane and the gap is filled with the same section: holes and slanted walls stay as they are.</li><li>When shortening, the slice between the plane and the plane minus the distance is removed.</li></ul>` },
    { id: 'cut', g: 'model', t: 'Cut', h: `
      {{img:taglia|The cutting plane can be dragged with the mouse}}
      <p>${K('K')}: pick an axis and the plane position, then press Cut. You get two separate objects.</p>
      {{img:taglia-fine|The two halves after the cut}}
      <ul><li>Drag the plane, type the position or click on the object.</li><li>On large models a progress bar appears.</li></ul>` },
    { id: 'solids', g: 'solids', t: 'Holes, Combine and Intersect', h: `
      <p>${K('X')} turns the selected object into a hole (translucent orange), and back.</p>
      {{img:foro|A cylinder-hole inside a box}}
      <p>${K('⌘E')} is Combine: it joins the solids and subtracts the holes. Parts that end up detached become separate layers.</p>
      {{img:foro-fine|The hole carved out}}
      <p>${K('⇧⌘E')} is Intersect: it keeps only the part the selected solids have in common (you need at least two solids). Holes, if any, carve the result. If the objects do not touch, a notice appears and nothing changes. Handy for special shapes, like a rounded box from a box and a sphere.</p>
      <div class="tip">With many holes Combine can take a few seconds, and a loading bar appears. The result is always a closed solid.</div>` },
    { id: 'repeat', g: 'solids', t: 'Repeat', h: `
      {{img:ripeti|Honeycomb grid of hexagonal prisms}}
      <p>Copies the selection in a grid, honeycomb or circle. Pick rows, columns and the space between copies: the distance is the object's size plus the space, so with 0 the copies touch.</p>
      <ul><li>Honeycomb: odd rows are shifted by half a step. Space Y starts from a value that keeps rows close, but you can change it.</li><li>Circle: number of copies, angle and center.</li><li>If you copy a hole you can make a grid of holes, then press Combine.</li></ul>` },
    { id: 'ruler', g: 'measure', t: 'Tape measure and Dimensions', h: `
      {{img:distanza-alt|With ${K('⌥')} held: width and height of the face under the mouse}}
      <p>${K('D')}: click a point or a face, then a second one. You see the distance and the differences on X, Y and Z. Between two parallel faces it measures the distance between the planes. The point snaps to corners, edge midpoints and nearby edges, and before the click you see where it will land.</p>
      <h3>What the marks mean</h3>
      <p>Before you click, a mark appears on the piece: it tells you what the point will snap to. If several are close, the first on the list wins.</p>
      <ul class="hp-leg"><li><i class="mk v"></i><span><b>Square</b>: a corner (vertex) of the piece. It is the strongest snap, because you usually measure from one corner to another.</span></li><li><i class="mk m"></i><span><b>Filled diamond</b>: the middle of an edge. Handy to centre a hole or find the middle of a wall.</span></li><li><i class="mk e"></i><span><b>Empty circle</b>: any point along an edge. The point stays on the edge, but it is neither a corner nor the middle.</span></li><li><i class="mk f"></i><span><b>Small faint dot</b>: no snap, the point lands where you aim on the face.</span></li><li><i class="mk p"></i><span><b>White circle with orange border</b>: the two points you already clicked. The orange line joins them and the measurement sits in the middle.</span></li></ul>
      <p>With ${K('⌥')} held the marks change meaning: the square shows a corner of the face and the circle an edge, so you read angles instead of distances.</p>
      <ul><li>Hold ${K('⌥')} and move over a face: it lights up and you see width and height (or depth), even if the face is tilted.</li><li>Still with ${K('⌥')}, over a corner you see the face angle and the length of the two edges; over an edge you see the angle between the two faces and its length.</li><li>${K('M')} shows the real size of the objects.</li></ul>` },
    { id: 'shortcuts', g: 'ref', t: 'Shortcuts', h: `
      <div class="sc-grid">
        <div><h3>Tools</h3><table>
          <tr><td>${K('V')}</td><td>Move</td></tr><tr><td>${K('Q')}</td><td>Marquee</td></tr><tr><td>${K('W')}</td><td>Lasso</td></tr><tr><td>${K('R')}</td><td>Rotate</td></tr><tr><td>${K('L')}</td><td>Face</td></tr><tr><td>${K('E')}</td><td>Edge</td></tr><tr><td>${K('U')}</td><td>Stretch</td></tr><tr><td>${K('K')}</td><td>Cut</td></tr><tr><td>${K('D')}</td><td>Tape measure</td></tr></table></div>
        <div><h3>Shapes</h3><table>
          <tr><td>${K('B')}</td><td>Box</td></tr><tr><td>${K('C')}</td><td>Cylinder</td></tr><tr><td>${K('S')}</td><td>Sphere</td></tr><tr><td>${K('O')}</td><td>Cone</td></tr><tr><td>${K('P')}</td><td>Prism</td></tr><tr><td>${K('T')}</td><td>Text</td></tr><tr><td>${K('X')}</td><td>Hole / Solid</td></tr><tr><td>${K('⌘E')}</td><td>Combine</td></tr><tr><td>${K('⇧⌘E')}</td><td>Intersect</td></tr><tr><td>${K('⌘G')}</td><td>Group</td></tr></table></div>
        <div><h3>View</h3><table>
          <tr><td>${K('Space')}</td><td>Pan the view</td></tr><tr><td>${K('⌘0')}</td><td>Fit</td></tr><tr><td>${K('⌘+')} ${K('⌘-')}</td><td>Zoom</td></tr><tr><td>${K('M')}</td><td>Dimensions</td></tr><tr><td>${K('Z')}</td><td>X-ray</td></tr><tr><td>${K('Tab')}</td><td>Collapse sidebar</td></tr><tr><td>${K('F7')}</td><td>Layers</td></tr><tr><td>${K('F8')}</td><td>History</td></tr><tr><td>${K('?')}</td><td>This guide</td></tr></table></div>
        <div><h3>Edit</h3><table>
          <tr><td>${K('⌘Z')}</td><td>Undo</td></tr><tr><td>${K('⇧⌘Z')}</td><td>Redo</td></tr><tr><td>${K('⌘D')}</td><td>Duplicate</td></tr><tr><td>${K('⌘C')} ${K('⌘X')} ${K('⌘V')}</td><td>Copy, cut, paste</td></tr><tr><td>${K('⌘A')}</td><td>Select all</td></tr><tr><td>${K('⌘O')}</td><td>Import</td></tr><tr><td>${K('⌘S')}</td><td>Export</td></tr><tr><td>${K('Del')}</td><td>Delete</td></tr><tr><td>${K('Esc')}</td><td>Deselect</td></tr></table></div>
      </div>
      <p class="sc-note">While dragging: ${K('⇧')} locks an axis and switches off snapping · ${K('⌘')} switches off the magnet (or moves vertically if held before) · ${K('⌥')} duplicates.</p>` },
    { id: 'check', g: 'ref', t: 'Print check', h: `
      {{img:controlla|The Print check panel with the layer preview}}
      <p>The <b>Check</b> button (top, next to Export) opens a panel on the right that stays open while you look at the model. It analyzes the selected pieces, or everything visible if nothing is selected. Export, instead, always takes the whole plate.</p>
      <ul><li><b>Closed solid</b>: with cracks or overlapping faces the slicer can get it wrong. It tells you which pieces.</li><li><b>Layer preview</b>: drag the slider to see the section at every height. An orange plane shows the same height in the model.</li><li><b>Thin walls</b>: areas below the minimum thickness (0.8 mm by default) turn red in the preview.</li><li><b>Floating pieces</b> and the base touching the bed.</li><li><b>Overhangs past 45°</b>: red in the model, to see where supports would be needed.</li><li>An estimate of layers, grams of PLA and time.</li></ul>
      <div class="tip">It is a quick check, not a slicer: the estimate is approximate and the G-code is always made by Bambu Studio. If you edit the piece while the panel is open, it updates by itself.</div>` },
    { id: 'print', g: 'ref', t: 'Printing tips', h: `
      <ul><li><b>Rest on the bed.</b> With Z = 0 the slicer does not see the piece floating. The button in the panel (or the right-click menu item) also straightens a tilted piece: it lays it on the nearest flat side. With several objects selected it treats them as one block.</li><li><b>Tolerances.</b> For fits leave 0.2-0.4 mm of clearance. In Repeat, Space is for this.</li><li><b>Small holes.</b> They come out narrower than expected, so try a sample first.</li><li><b>Export as 3MF</b> if you want to keep names and colors.</li><li><b>Before printing</b> take a look at the slicer preview.</li></ul>` },
  ],
};
