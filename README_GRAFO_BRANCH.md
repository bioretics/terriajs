# Grafo delle Connessioni tra Branch

Questo documento descrive l'analisi dei branch del repository creati dagli utenti **glughi** e **FrancescoPazz** dopo il **10 ottobre 2024**, considerando `rer3d_from_8.7.9` come branch principale.

## File Generati

1. **`branch_graph.dot`** - File DOT per Graphviz che contiene il grafo delle connessioni tra i branch
2. **`branch_graph.html`** - File HTML interattivo per visualizzare il grafo nel browser (usa vis.js)
3. **`branch_graph_report.md`** - Report in formato Markdown con la lista completa dei branch e le loro connessioni
4. **`branch_graph_data.json`** - Dati strutturati in formato JSON per ulteriori analisi

## Statistiche

- **Branch principale:** `rer3d_from_8.7.9`
- **Data minima:** 10 ottobre 2024
- **Branch totali analizzati:** 132 (creati dopo il 10/10/2024)
  - **Branch creati da glughi:** 41
  - **Branch creati da FrancescoPazz:** 91
- **Informazioni PR:** I branch includono informazioni sulle Pull Request associate (identificativi PR#)

## Visualizzazione del Grafo

Per visualizzare il grafo, puoi:

1. **Usare Graphviz** (se installato):
   ```bash
   dot -Tpng branch_graph.dot -o branch_graph.png
   dot -Tsvg branch_graph.dot -o branch_graph.svg
   ```

2. **Aprire il file HTML interattivo:**
   - Apri `branch_graph.html` direttamente nel browser
   - Il grafo è interattivo: puoi trascinare i nodi, zoomare e vedere i dettagli delle PR al passaggio del mouse

3. **Usare strumenti online:**
   - Copia il contenuto di `branch_graph.dot` in [Graphviz Online](https://dreampuf.github.io/GraphvizOnline/)
   - Oppure usa [edotor.net](https://edotor.net/)

4. **Visualizzare il report Markdown:**
   - Apri `branch_graph_report.md` in qualsiasi visualizzatore Markdown

## Legenda del Grafo

- **Nodi blu chiaro:** Branch principale (`rer3d_from_8.7.9`)
- **Nodi verde chiaro:** Branch creati da glughi
- **Nodi giallo chiaro:** Branch creati da FrancescoPazz
- **Frecce:** Indicano la relazione "deriva da" (parent -> child)
- **PR:** I numeri delle Pull Request sono mostrati nei label dei nodi (formato: PR#123, PR#456, ...)

## Connessioni Interessanti

Alcune connessioni notevoli tra branch:

- `migrate-marche-features-to-new-version` → `prepare-marche-features-merge`
- `formats-export-extended-data` → `refactor-centralize-export-logic`
- `point-measure-tool` → `refactor-csv-files-upload`
- `expand-path-handling-kml-geojson` → `refactor-measure-tool`
- `linking-elevation-chart-to-map` → `upstream-main-merge-linking-elevation-chart-to-map`
- `cesium2d-viewer` → `rer3d_from_8.7.7`
- `add-cesiumGlobeColor-parameter` → `rer3d_from_8.7.8`

## Note

- La maggior parte dei branch deriva direttamente da `rer3d_from_8.7.9` o da `main`/`v8`
- Le connessioni sono state determinate analizzando:
  - I messaggi di commit di merge
  - I merge-base tra i branch
  - Le date di creazione dei branch

## Script di Analisi

Lo script `analyze_branches.py` può essere eseguito per rigenerare l'analisi:

```bash
python3 analyze_branches.py
```
