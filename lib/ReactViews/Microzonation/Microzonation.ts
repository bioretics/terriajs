export type MicrozonationRecord = {
  id?: string | number;
  province?: string;
  municipality?: string;
  microzonation?: string;
  msOrdinance?: string;
  cle?: string;
  cleOrdinance?: string;
  municipalPlan?: string;
  [key: string]: unknown;
};

export type MicrozonationDetail = {
  generalInfo: {
    province?: string;
    municipality?: string;
    notes?: string;
  };
  microzonation: {
    microzonation?: string;
    msOrdinance?: string;
    msValidation?: string;
    msStandard?: string;
  };
  cle: {
    cle?: string;
    cleOrdinance?: string;
    cleValidation?: string;
    cleStandard?: string;
  };
  civilProtectionPlan: {
    municipalPlan?: string;
    link?: string;
  };
  documents: Array<{
    type?: string;
    description?: string;
    start?: string;
    end?: string;
    attachmentUrl?: string;
  }>;
};

export type Filters = {
  province: string;
  municipality: string;
  microzonation: string;
  cle: string;
};

export const emptyFilters: Filters = {
  province: "",
  municipality: "",
  microzonation: "",
  cle: ""
};

export const uniqueSorted = (values: Array<string | undefined>) =>
  Array.from(
    new Set(values.filter((value): value is string => Boolean(value)))
  ).sort((a, b) => a.localeCompare(b));

export const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
};

export const normalizeRecord = (raw: any): MicrozonationRecord => ({
  id:
    raw?.id ??
    raw?.ID ??
    raw?.codice ??
    raw?.codice_comune ??
    raw?.codiceComune ??
    raw?.uuid,
  province: raw?.province ?? raw?.Province ?? raw?.provincia ?? raw?.Provincia,
  municipality:
    raw?.municipality ?? raw?.Municipality ?? raw?.comune ?? raw?.Comune,
  microzonation:
    raw?.microzonation ??
    raw?.Microzonation ??
    raw?.microzonazione ??
    raw?.Microzonazione ??
    raw?.ms ??
    raw?.livelloMs,
  msOrdinance:
    raw?.msOrdinance ??
    raw?.ms_ordinance ??
    raw?.ordinanzaMs ??
    raw?.ordinanza_ms ??
    raw?.ordinanzaMS ??
    raw?.ordinanza,
  cle: raw?.cle ?? raw?.CLE ?? raw?.cleLevel ?? raw?.cle_level,
  cleOrdinance:
    raw?.cleOrdinance ??
    raw?.cle_ordinance ??
    raw?.ordinanzaCle ??
    raw?.ordinanza_cle ??
    raw?.ordinanzaCLE,
  municipalPlan:
    raw?.municipalPlan ??
    raw?.pianoComunale ??
    raw?.piano_comunale ??
    raw?.pianoProtezioneCivile ??
    raw?.piano_protezione_civile
});

export const normalizeDetail = (
  raw: any,
  fallback?: MicrozonationRecord
): MicrozonationDetail => {
  const info =
    raw?.generalInfo ??
    raw?.infoGenerali ??
    raw?.info_generali ??
    raw?.info ??
    {};
  const micro =
    raw?.microzonation ??
    raw?.microzonationInfo ??
    raw?.microzonazione ??
    raw?.microzonazioneInfo ??
    raw?.microzonazione_info ??
    {};
  const cle = raw?.cle ?? raw?.cleInfo ?? raw?.cle_info ?? {};
  const plan =
    raw?.civilProtectionPlan ??
    raw?.pianoProtezioneCivile ??
    raw?.piano_protezione_civile ??
    raw?.piano ??
    {};
  const documents = raw?.documents ?? raw?.documenti ?? raw?.allegati ?? [];

  return {
    generalInfo: {
      province:
        info?.province ??
        info?.Province ??
        info?.provincia ??
        info?.Provincia ??
        fallback?.province ??
        "",
      municipality:
        info?.municipality ??
        info?.Municipality ??
        info?.comune ??
        info?.Comune ??
        fallback?.municipality ??
        "",
      notes: info?.notes ?? info?.note ?? info?.Note ?? raw?.note ?? ""
    },
    microzonation: {
      microzonation:
        micro?.microzonation ??
        micro?.Microzonation ??
        micro?.microzonazione ??
        micro?.Microzonazione ??
        fallback?.microzonation ??
        "",
      msOrdinance:
        micro?.msOrdinance ??
        micro?.ms_ordinance ??
        micro?.ordinanzaMs ??
        micro?.ordinanza_ms ??
        micro?.ordinanzaMS ??
        fallback?.msOrdinance ??
        "",
      msValidation:
        micro?.msValidation ?? micro?.ms_validation ?? micro?.convalidaMs ?? "",
      msStandard:
        micro?.msStandard ?? micro?.ms_standard ?? micro?.standardMs ?? ""
    },
    cle: {
      cle: cle?.cle ?? cle?.CLE ?? fallback?.cle ?? "",
      cleOrdinance:
        cle?.cleOrdinance ??
        cle?.cle_ordinance ??
        cle?.ordinanzaCle ??
        cle?.ordinanza_cle ??
        fallback?.cleOrdinance ??
        "",
      cleValidation:
        cle?.cleValidation ?? cle?.cle_validation ?? cle?.convalidaCle ?? "",
      cleStandard:
        cle?.cleStandard ?? cle?.cle_standard ?? cle?.standardCle ?? ""
    },
    civilProtectionPlan: {
      municipalPlan:
        plan?.municipalPlan ??
        plan?.pianoComunale ??
        plan?.piano_comunale ??
        fallback?.municipalPlan ??
        "",
      link: plan?.link ?? plan?.url ?? ""
    },
    documents: (Array.isArray(documents) ? documents : []).map((doc) => ({
      type: doc?.type ?? doc?.tipo ?? doc?.Tipo,
      description: doc?.description ?? doc?.descrizione ?? doc?.Descrizione,
      start: doc?.start ?? doc?.inizio ?? doc?.Inizio,
      end: doc?.end ?? doc?.fine ?? doc?.Fine,
      attachmentUrl:
        doc?.attachmentUrl ??
        doc?.allegatoUrl ??
        doc?.allegato_url ??
        doc?.url ??
        doc?.link
    }))
  };
};

export const filterRecords = (
  records: MicrozonationRecord[],
  filters: Filters
) =>
  records.filter((record) => {
    if (filters.province && record.province !== filters.province) {
      return false;
    }
    if (filters.municipality && record.municipality !== filters.municipality) {
      return false;
    }
    if (
      filters.microzonation &&
      record.microzonation !== filters.microzonation
    ) {
      return false;
    }
    if (filters.cle && record.cle !== filters.cle) {
      return false;
    }
    return true;
  });

export const getRecordId = (record: MicrozonationRecord) =>
  record.id ??
  `${record.province ?? ""}-${record.municipality ?? ""}-${
    record.microzonation ?? ""
  }-${record.cle ?? ""}`;

export const buildDetailUrl = (detailUrl: string, id: string) => {
  if (!detailUrl) {
    return undefined;
  }
  if (detailUrl.includes("{id}")) {
    return detailUrl.replace("{id}", encodeURIComponent(id));
  }
  return `${detailUrl}/${encodeURIComponent(id)}`;
};

export const fetchMicrozonationList = async (
  listUrl: string,
  signal?: AbortSignal
) => {
  const response = await fetch(listUrl, { signal });
  if (!response.ok) {
    throw new Error(String(response.status));
  }
  const json = await response.json();
  const rawList = Array.isArray(json)
    ? json
    : json?.results ?? json?.items ?? [];
  return rawList.map(normalizeRecord);
};

export const fetchMicrozonationDetail = async (
  detailUrl: string,
  record: MicrozonationRecord,
  signal?: AbortSignal
) => {
  const id = getRecordId(record);
  const resolvedUrl = buildDetailUrl(detailUrl, String(id));
  if (!resolvedUrl) {
    throw new Error("resolve");
  }
  const response = await fetch(resolvedUrl, { signal });
  if (!response.ok) {
    throw new Error(String(response.status));
  }
  const json = await response.json();
  return normalizeDetail(json, record);
};
