# Grafo delle Connessioni tra Branch

Questo progetto analizza i branch del repository Git e genera una visualizzazione grafica delle connessioni tra di essi.

## File Generati

1. **grafo_branch.html** - Visualizzazione interattiva del grafo nel browser
   - Usa vis.js per una visualizzazione interattiva
   - Permette di zoomare, panare e interagire con i nodi
   - I branch principali (v8, main, master) sono evidenziati in rosso

2. **grafo_branch.dot** - File DOT per Graphviz
   - Può essere usato per generare immagini statiche (PNG, SVG, PDF)
   - Esempio: `dot -Tpng grafo_branch.dot -o grafo_branch.png`

3. **grafo_branch.json** - Dati strutturati del grafo
   - Contiene tutte le informazioni sulle relazioni tra branch
   - Formato JSON per ulteriori elaborazioni

4. **analizza_branch.py** - Script Python per l'analisi
   - Esegue l'analisi dei branch e genera i file sopra

## Come Usare

### Visualizzazione HTML
Apri semplicemente `grafo_branch.html` nel tuo browser preferito. La visualizzazione è interattiva:
- **Zoom**: Usa la rotella del mouse o i controlli
- **Pan**: Trascina il grafo
- **Selezione**: Clicca su un nodo per evidenziarlo
- **Layout**: Il grafo è organizzato gerarchicamente con i branch principali in alto

### Generazione Immagine da DOT
Se hai Graphviz installato:
```bash
# PNG
dot -Tpng grafo_branch.dot -o grafo_branch.png

# SVG (vettoriale, consigliato)
dot -Tsvg grafo_branch.dot -o grafo_branch.svg

# PDF
dot -Tpdf grafo_branch.dot -o grafo_branch.pdf
```

### Rigenerare il Grafo
Per rigenerare il grafo con dati aggiornati:
```bash
python3 analizza_branch.py
```

## Struttura del Grafo

Il grafo mostra:
- **Nodi**: Ogni branch del repository
- **Archi**: Relazioni di derivazione tra branch
  - Un arco da A a B significa che B deriva da A
- **Colori**:
  - Rosso: Branch principali (v8, main, master)
  - Blu: Altri branch

## Note

- L'analisi si basa sul merge-base tra branch per determinare le relazioni
- Branch molto vecchi o orfani potrebbero non essere collegati
- Il grafo mostra principalmente le relazioni con i branch principali
- Con 300+ branch, la visualizzazione può essere densa; usa lo zoom per esplorare

## Statistiche

- **Totale branch analizzati**: 368
- **Branch connessi**: 366
- **Relazioni principali**: 2 (main, v8)
