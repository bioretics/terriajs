export type FontesFieldType =
  | "text"
  | "number"
  | "bool"
  | "list"
  | "objects"
  | "date";

export interface FontesField {
  key: string;
  label: string;
  type: FontesFieldType;
  unit?: string;
}

export interface FontesSection {
  title: string;
  fields: FontesField[];
}

const field =
  (type: FontesFieldType, unit?: string) =>
  (key: string, label: string): FontesField => ({ key, label, type, unit });
const text = field("text");
const list = field("list");
const objects = field("objects");
const mm = field("number", "mm");
const bool = field("bool");

export const FONTES_SECTIONS: FontesSection[] = [
  {
    title: "Collocazione",
    fields: [
      text("id", "ID"),
      bool("testuale", "Documento testuale"),
      text("collocazione", "Collocazione"),
      text("segnatura", "Segnatura"),
      text("altre_segnature", "Altre segnature"),
      text("serie", "Titolo della serie"),
      text("numerazione_serie", "Numerazione all'interno della serie"),
      text("fascicolo_allegato", "Fascicolo a cui è allegato"),
      text("note_collocazione", "Note collocazione")
    ]
  },
  {
    title: "Titolo",
    fields: [
      text("titolo_originale", "Titolo originale"),
      text("titolo_archivista", "Titolo attribuito dall'archivista"),
      text("titolo_schedatore", "Titolo attribuito dallo schedatore"),
      text("titolo_variante", "Titolo variante"),
      text("note_titolo", "Note titolo")
    ]
  },
  {
    title: "Dimensioni",
    fields: [
      mm("h_supporto_aggiunto", "Altezza del supporto aggiunto"),
      mm("w_supporto_aggiunto", "Larghezza del supporto aggiunto"),
      mm("h_supporto_originale", "Altezza del supporto originale"),
      mm("w_supporto_originale", "Larghezza del supporto originale"),
      mm("h_cornice", "Altezza della cornice"),
      mm("w_cornice", "Larghezza della cornice"),
      mm("h_documento", "Altezza del documento"),
      mm("w_documento", "Larghezza del documento"),
      text("note_dimensioni", "Note dimensioni")
    ]
  },
  {
    title: "Autori",
    fields: [
      { key: "data_di_produzione", label: "Data di produzione", type: "date" },
      text("data_topica", "Data topica"),
      list("autori", "Autori"),
      list("autori_attribuiti", "Autori attribuiti"),
      list("copia_da", "Copia da"),
      objects("autori_dati_biografici", "Autori e dati biografici"),
      text("note_autori", "Note autori")
    ]
  },
  {
    title: "Committenti e destinatari",
    fields: [
      list("committenti", "Committenti"),
      list("destinatari", "Destinatari"),
      text("note_committenti_destinatari", "Note committenti/destinatari")
    ]
  },
  {
    title: "Eventi",
    fields: [objects("eventi", "Eventi"), text("note_eventi", "Note eventi")]
  },
  {
    title: "Dettagli tecnici",
    fields: [
      list("tecnica_preparazione", "Tecnica di preparazione"),
      list("tecnica_esecuzione", "Tecnica di esecuzione"),
      list("tecnica_coloritura", "Tecnica di coloritura"),
      text("stato_conservazione", "Stato di conservazione"),
      text("colorazione", "Colorazione"),
      text("note_stato_conservazione", "Note conservazione"),
      text("supporto", "Supporto"),
      list("dettaglio_stato_conservazione", "Dettagli di conservazione"),
      list("stato", "Stato"),
      text("filigrana", "Filigrana"),
      list("tipologia", "Tipologia"),
      text("tecnica_riproduzione", "Tecnica di riproduzione"),
      list("tradizione", "Tradizione del documento"),
      list("metodo_rappresentazione", "Metodo di rappresentazione"),
      text("forma", "Forma del documento"),
      list("lingua", "Lingua"),
      bool("originale", "Originale"),
      text("note_dettagli_tecnici", "Note dettagli tecnici")
    ]
  },
  {
    title: "Annotazioni",
    fields: [
      text("dichiarazioni_autore", "Dichiarazioni dell'autore"),
      text("annotazioni_coeve_alla_stesura", "Annotazioni coeve alla stesura"),
      text("aggiornamenti", "Aggiornamenti e/o annotazioni successive"),
      text("note_annotazioni", "Note annotazioni")
    ]
  },
  {
    title: "Contenuti",
    fields: [
      text("confini", "Confini"),
      text("legenda", "Legenda"),
      text("sigilli", "Sigilli"),
      text("timbri", "Timbri"),
      text("cartigli", "Cartigli"),
      text("dediche", "Dediche"),
      text("corredo_iconografico", "Corredo iconografico"),
      text("elementi_araldici", "Elementi araldici"),
      list("tematica", "Tematiche dichiarate o desunte"),
      text("note_contenuti", "Note contenuti")
    ]
  },
  {
    title: "Elementi contenuti",
    fields: [
      objects("elementi_naturali", "Elementi naturali"),
      text("note_elemento_naturale", "Note elementi naturali"),
      objects("infrastrutture", "Infrastrutture"),
      text("note_elemento_infrastruttura", "Note infrastrutture"),
      objects("edifici", "Edifici"),
      text("note_elemento_edificio", "Note edifici"),
      objects("uso_suolo", "Uso del suolo"),
      text("note_elemento_uds", "Note uso del suolo")
    ]
  },
  {
    title: "Luoghi",
    fields: [objects("luoghi", "Luoghi"), text("odonimi", "Odonimi")]
  },
  {
    title: "Informazioni cartografiche",
    fields: [
      list(
        "sistema_identificazione_orientamento",
        "Identificazione dell'orientamento"
      ),
      text("orientamento", "Orientamento espresso"),
      text("orientamento_desunto", "Orientamento desunto"),
      text("scala", "Scala di riferimento"),
      list("unita_misura", "Unità di misura"),
      text("note_unita_misura", "Note unità di misura"),
      text(
        "rapporto_rappresentazione",
        "Rapporto di rappresentazione esplicitato"
      ),
      mm("lunghezza_scala_mm", "Lunghezza della scala grafica"),
      text("note_cartografiche", "Note cartografiche")
    ]
  },
  {
    title: "Files",
    fields: [
      { key: "numero_immagini", label: "Numero di immagini", type: "number" },
      bool("recto_georef", "Recto georeferenziato")
    ]
  },
  {
    title: "Note",
    fields: [text("note", "Note")]
  }
];

export const FONTES_FIELDS: FontesField[] = FONTES_SECTIONS.flatMap(
  (section) => section.fields
);
