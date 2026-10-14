import { observer } from "mobx-react";
import { FC, Fragment, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Rnd } from "react-rnd";
import styled, { useTheme } from "styled-components";
import Box from "../../Styled/Box";
import Button, { RawButton } from "../../Styled/Button";
import Icon, { StyledIcon } from "../../Styled/Icon";
import Text from "../../Styled/Text";
import Collapsible from "../Custom/Collapsible/Collapsible";
import { useViewState } from "../Context";
import { FontesDocument, getFontesDocuments } from "./Fontes";
import { FONTES_SECTIONS, FontesField } from "./fontesFields";
import FontesImageViewer from "./FontesImageViewer";
import { addRectoToMap, zoomToDocument } from "./fontesMap";

const OPEN_SECTIONS = 2;

const columnLabel = (key: string) =>
  (key.charAt(0).toUpperCase() + key.slice(1)).replace(/_/g, " ");

const RecordsTable: FC<{ records: unknown[] }> = ({ records }) => {
  const rows = records.filter(
    (record): record is Record<string, unknown> =>
      typeof record === "object" && record !== null
  );
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return (
    <Table>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column}>{columnLabel(column)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {columns.map((column) => (
              <td key={column}>{String(row[column] ?? "")}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  );
};

const FieldValue: FC<{ field: FontesField; value: unknown }> = ({
  field,
  value
}) => {
  const { t } = useTranslation();
  switch (field.type) {
    case "bool":
      return <>{value ? t(($) => $.fontes.yes) : t(($) => $.fontes.no)}</>;
    case "number":
      return <>{field.unit ? `${value} ${field.unit}` : String(value)}</>;
    case "list":
      return <>{(value as unknown[]).join(", ")}</>;
    case "objects":
      return <RecordsTable records={value as unknown[]} />;
    default:
      return <PreLine>{String(value)}</PreLine>;
  }
};

export const FontesDocumentDetails: FC<{ doc: FontesDocument }> = ({ doc }) => (
  <>
    {FONTES_SECTIONS.map((section) => ({
      title: section.title,
      fields: section.fields.filter(
        (field) => doc.properties[field.key] !== undefined
      )
    }))
      .filter((section) => section.fields.length > 0)
      .map((section, index) => (
        <Box column key={section.title} styledMargin="0 0 8px 0">
          <Collapsible title={section.title} isOpen={index < OPEN_SECTIONS}>
            <Fields>
              {section.fields.map((field) => (
                <Fragment key={field.key}>
                  <dt>{field.label}</dt>
                  <dd>
                    <FieldValue
                      field={field}
                      value={doc.properties[field.key]}
                    />
                  </dd>
                </Fragment>
              ))}
            </Fields>
          </Collapsible>
        </Box>
      ))}
  </>
);

const FontesDocumentWindow: FC = observer(() => {
  const viewState = useViewState();
  const terria = viewState.terria;
  const theme = useTheme();
  const { t } = useTranslation();
  const config = terria.configParameters.fontesConfig;
  const id = viewState.fontesDocumentId;
  const [doc, setDoc] = useState<FontesDocument | null>();
  const [side, setSide] = useState<"recto" | "verso">("recto");

  useEffect(() => {
    if (!config || !id) return;
    let current = true;
    setDoc(undefined);
    setSide("recto");
    getFontesDocuments(config.documentsUrl, terria.corsProxy)
      .then((docs) => current && setDoc(docs.find((d) => d.id === id) ?? null))
      .catch(() => current && setDoc(null));
    return () => {
      current = false;
    };
  }, [config, id, terria]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") viewState.closeFontesDocument();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [viewState]);

  if (!config || !id) return null;

  const { properties } = doc ?? { properties: {} as Record<string, unknown> };
  const imageUrl =
    side === "recto" ? properties.recto_cog_url : properties.verso_cog_url;
  const canDownload =
    properties.download_consentito !== false &&
    terria.isFeatureAllowedByProfile("FontesDownload");
  const downloads = [
    {
      label: t(($) => $.fontes.downloadRecto),
      url: properties.recto_download_url ?? properties.recto_cog_url
    },
    {
      label: t(($) => $.fontes.downloadVerso),
      url: properties.verso_download_url ?? properties.verso_cog_url
    },
    { label: t(($) => $.fontes.downloadPdf), url: properties.fascicolo_pdf_url }
  ].filter(
    (download): download is { label: string; url: string } =>
      typeof download.url === "string"
  );

  return (
    <Overlay
      className={viewState.topElement === "FontesDocument" ? "top-element" : ""}
    >
      <Rnd
        bounds="parent"
        default={{
          x: window.innerWidth * 0.1,
          y: window.innerHeight * 0.08,
          width: window.innerWidth * 0.8,
          height: window.innerHeight * 0.8
        }}
        minWidth={480}
        minHeight={320}
        dragHandleClassName="fontes-window-drag"
        cancel="button, a"
        style={{ pointerEvents: "auto" }}
        onMouseDown={() => viewState.setTopElement("FontesDocument")}
      >
        <Window column fullWidth fullHeight>
          <Box
            className="fontes-window-drag"
            verticalCenter
            paddedRatio={2}
            css={`
              cursor: move;
              background: ${theme.colorPrimary};
            `}
          >
            <Text textLight bold medium css={"flex: 1;"}>
              {doc ? `${doc.id} · ${doc.title}` : id}
            </Text>
            <RawButton
              title={t(($) => $.fontes.close)}
              onClick={() => viewState.closeFontesDocument()}
            >
              <StyledIcon
                styledWidth="14px"
                light
                glyph={Icon.GLYPHS.closeLight}
              />
            </RawButton>
          </Box>
          <Box fullWidth css={"flex: 1; min-height: 0;"}>
            <Box column css={"flex: 1; min-width: 0;"}>
              <Box paddedRatio={1} gap={1}>
                {(["recto", "verso"] as const).map((name) => (
                  <Button
                    key={name}
                    primary={side === name}
                    secondary={side !== name}
                    disabled={typeof properties[`${name}_cog_url`] !== "string"}
                    onClick={() => setSide(name)}
                  >
                    {name === "recto"
                      ? t(($) => $.fontes.recto)
                      : t(($) => $.fontes.verso)}
                  </Button>
                ))}
              </Box>
              {typeof imageUrl === "string" ? (
                <FontesImageViewer key={imageUrl} url={imageUrl} />
              ) : (
                <Box centered css={"flex: 1;"}>
                  <Text textLight medium>
                    {doc === undefined
                      ? t(($) => $.fontes.loading)
                      : doc === null
                        ? t(($) => $.fontes.documentNotFound, { id })
                        : t(($) => $.fontes.noImage)}
                  </Text>
                </Box>
              )}
            </Box>
            {doc && (
              <Sidebar column>
                <FontesDocumentDetails doc={doc} />
                <Box column gap={1} styledMargin="8px 0 0 0">
                  {doc.geometry && (
                    <Button
                      secondary
                      onClick={() => zoomToDocument(terria, doc)}
                    >
                      {t(($) => $.fontes.showPlaces)}
                    </Button>
                  )}
                  {properties.recto_georef === true && (
                    <Button
                      primary
                      onClick={() => addRectoToMap(terria, doc, config)}
                    >
                      {t(($) => $.fontes.addToMap)}
                    </Button>
                  )}
                  {canDownload &&
                    downloads.map((download) => (
                      <DownloadLink
                        key={download.label}
                        href={download.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                      >
                        {download.label}
                      </DownloadLink>
                    ))}
                </Box>
              </Sidebar>
            )}
          </Box>
        </Window>
      </Rnd>
    </Overlay>
  );
});

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 99;
`;

const Window = styled(Box)`
  background: ${(p) => p.theme.dark};
  border-radius: 4px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  overflow: hidden;
`;

const Sidebar = styled(Box)`
  width: 340px;
  flex-shrink: 0;
  overflow-y: auto;
  padding: 10px;
  border-left: 1px solid ${(p) => p.theme.darkLighter};
`;

const Fields = styled.dl`
  margin: 6px 0 0 0;
  dt {
    font-weight: bold;
    margin-top: 6px;
  }
  dd {
    margin: 2px 0 0 0;
  }
`;

const PreLine = styled.span`
  white-space: pre-line;
`;

const Table = styled.table`
  border-collapse: collapse;
  width: 100%;
  th,
  td {
    border: 1px solid ${(p) => p.theme.darkLighter};
    padding: 2px 4px;
    text-align: left;
  }
`;

const DownloadLink = styled.a`
  color: ${(p) => p.theme.textLight};
  text-decoration: underline;
`;

export default FontesDocumentWindow;
