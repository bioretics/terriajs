# Grafo delle Connessioni tra Branch

Questo documento descrive l'analisi dei branch del repository creati dagli utenti **glughi** e **FrancescoPazz**, considerando `rer3d_from_8.7.9` come branch principale.

## File Generati

1. **`branch_graph.dot`** - File DOT per Graphviz che contiene il grafo delle connessioni tra i branch
2. **`branch_graph_report.md`** - Report in formato Markdown con la lista completa dei branch e le loro connessioni
3. **`branch_graph_data.json`** - Dati strutturati in formato JSON per ulteriori analisi

## Statistiche

- **Branch principale:** `rer3d_from_8.7.9`
- **Branch totali analizzati:** 133
  - **Branch creati da glughi:** 41
  - **Branch creati da FrancescoPazz:** 92

## Visualizzazione del Grafo

Per visualizzare il grafo, puoi:

1. **Usare Graphviz** (se installato):
   ```bash
   dot -Tpng branch_graph.dot -o branch_graph.png
   dot -Tsvg branch_graph.dot -o branch_graph.svg
   ```

2. **Usare strumenti online:**
   - Copia il contenuto di `branch_graph.dot` in [Graphviz Online](https://dreampuf.github.io/GraphvizOnline/)
   - Oppure usa [edotor.net](https://edotor.net/)

3. **Visualizzare il report Markdown:**
   - Apri `branch_graph_report.md` in qualsiasi visualizzatore Markdown

## Legenda del Grafo

- **Nodi blu chiaro:** Branch principale (`rer3d_from_8.7.9`)
- **Nodi verde chiaro:** Branch creati da glughi
- **Nodi giallo chiaro:** Branch creati da FrancescoPazz
- **Frecce:** Indicano la relazione "deriva da" (parent -> child)

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
