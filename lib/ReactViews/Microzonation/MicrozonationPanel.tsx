import React, { useCallback, useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useTranslation } from "react-i18next";
import styled, { useTheme } from "styled-components";

import triggerResize from "../../Core/triggerResize";
import Box from "../../Styled/Box";
import Button, { RawButton } from "../../Styled/Button";
import Icon, { StyledIcon } from "../../Styled/Icon";
import Select from "../../Styled/Select";
import Text from "../../Styled/Text";
import { useViewState } from "../Context";

import Styles from "./microzonation-panel.scss";
import {
  Filters,
  MicrozonationDetail,
  MicrozonationRecord,
  emptyFilters,
  fetchMicrozonationDetail,
  fetchMicrozonationList,
  filterRecords,
  formatValue,
  uniqueSorted
} from "./Microzonation";

interface Props {
  isVisible?: boolean;
  animationDuration?: number;
}

const Panel = styled(Box)<{ isVisible?: boolean; isHidden?: boolean }>`
  transition: all 0.25s;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  width: 420px;
  min-width: 420px;
  height: 100vh;
  ${(props) =>
    props.isVisible &&
    `
    visibility: visible;
    margin-right: 0;
  `}
  ${(props) =>
    props.isHidden &&
    `
    visibility: hidden;
    margin-right: -100%;
  `}
`;

const MicrozonationPanel: React.FC<Props> = observer((props) => {
  const viewState = useViewState();
  const terria = viewState.terria;
  const theme = useTheme();
  const { t } = useTranslation();

  const apiConfig = terria.configParameters?.microzonationApi;
  const listUrl = apiConfig?.listUrl;
  const detailUrl = apiConfig?.detailUrl;

  const [records, setRecords] = useState<MicrozonationRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<MicrozonationRecord[]>(
    []
  );
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<
    MicrozonationRecord | undefined
  >(undefined);
  const [detail, setDetail] = useState<MicrozonationDetail | undefined>(
    undefined
  );
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [listError, setListError] = useState<string | undefined>(undefined);
  const [detailError, setDetailError] = useState<string | undefined>(undefined);
  const [hasLoaded, setHasLoaded] = useState(false);

  const resolveApiErrorMessage = useCallback(
    (error: unknown, fallbackKey: string) => {
      if (error instanceof Error) {
        if (error.message === "resolve") {
          return t("microzonation.errorCannotResolveDetailUrl");
        }
        const status = Number(error.message);
        if (!Number.isNaN(status)) {
          return t("microzonation.errorApiStatus", { status });
        }
        return error.message || t(fallbackKey);
      }
      return t(fallbackKey);
    },
    [t]
  );

  useEffect(() => {
    setHasLoaded(false);
    setRecords([]);
    setFilteredRecords([]);
    setHasSearched(false);
    setSelectedRecord(undefined);
    setDetail(undefined);
    setListError(undefined);
    setDetailError(undefined);
  }, [listUrl]);

  useEffect(() => {
    if (!props.isVisible || hasLoaded) {
      return;
    }

    if (!listUrl) {
      setListError(t("microzonation.errorMissingListUrl"));
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    const load = async () => {
      try {
        setLoadingList(true);
        setListError(undefined);
        const normalized = await fetchMicrozonationList(
          listUrl,
          controller.signal
        );
        if (isMounted) {
          setRecords(normalized);
          setHasLoaded(true);
        }
      } catch (error: any) {
        if (isMounted && error?.name !== "AbortError") {
          setListError(
            resolveApiErrorMessage(error, "microzonation.errorLoadingList")
          );
        }
      } finally {
        if (isMounted) {
          setLoadingList(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [props.isVisible, listUrl, hasLoaded, resolveApiErrorMessage, t]);

  const provinceOptions = useMemo(
    () => uniqueSorted(records.map((r) => r.province)),
    [records]
  );
  const municipalityOptions = useMemo(
    () => uniqueSorted(records.map((r) => r.municipality)),
    [records]
  );
  const microzonationOptions = useMemo(
    () => uniqueSorted(records.map((r) => r.microzonation)),
    [records]
  );
  const cleOptions = useMemo(
    () => uniqueSorted(records.map((r) => r.cle)),
    [records]
  );

  const applyFilters = () => {
    const next = filterRecords(records, filters);
    setFilteredRecords(next);
    setHasSearched(true);
    setSelectedRecord(undefined);
    setDetail(undefined);
    setDetailError(undefined);
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setFilteredRecords([]);
    setHasSearched(false);
    setSelectedRecord(undefined);
    setDetail(undefined);
    setDetailError(undefined);
  };

  const loadDetail = async (record: MicrozonationRecord) => {
    if (!detailUrl) {
      setDetailError(t("microzonation.errorMissingDetailUrl"));
      return;
    }

    const controller = new AbortController();

    try {
      setLoadingDetail(true);
      setDetailError(undefined);
      const normalizedDetail = await fetchMicrozonationDetail(
        detailUrl,
        record,
        controller.signal
      );
      setDetail(normalizedDetail);
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        setDetailError(
          resolveApiErrorMessage(error, "microzonation.errorLoadingDetail")
        );
      }
    } finally {
      setLoadingDetail(false);
    }
  };

  const closePanel = () => {
    viewState.toggleMicrozonationPanel();
    terria.currentViewer.notifyRepaintRequired();
    setTimeout(function () {
      triggerResize();
    }, props.animationDuration || 1);
  };

  return (
    <Panel
      isVisible={props.isVisible}
      isHidden={!props.isVisible}
      charcoalGreyBg
      column
    >
      <Box right>
        <RawButton
          css={`
            padding: 15px;
          `}
          onClick={closePanel}
        >
          <StyledIcon
            styledWidth={"16px"}
            fillColor={theme.textLightDimmed}
            opacity={0.5}
            glyph={Icon.GLYPHS.closeLight}
          />
        </RawButton>
      </Box>
      <Box
        column
        paddedHorizontally={2}
        styledHeight="100%"
        overflowY="auto"
        scroll
      >
        <Text bold extraExtraLarge textLight>
          {t("microzonation.panelTitle")}
        </Text>
        <Text medium color={theme.textLightDimmed}>
          {t("microzonation.panelBody")}
        </Text>

        <div className={Styles.sectionTitle}>
          {t("microzonation.searchTitle")}
        </div>

        <div className={Styles.filterGrid}>
          <div className={Styles.field}>
            <label className={Styles.fieldLabel}>
              {t("microzonation.province")}
            </label>
            <Select
              value={filters.province}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                setFilters((prev) => ({
                  ...prev,
                  province: event.target.value
                }))
              }
              light
            >
              <option value="">{t("microzonation.allFeminine")}</option>
              {provinceOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </div>
          <div className={Styles.field}>
            <label className={Styles.fieldLabel}>
              {t("microzonation.municipality")}
            </label>
            <Select
              value={filters.municipality}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                setFilters((prev) => ({
                  ...prev,
                  municipality: event.target.value
                }))
              }
              light
            >
              <option value="">{t("microzonation.allMasculine")}</option>
              {municipalityOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </div>
          <div className={Styles.field}>
            <label className={Styles.fieldLabel}>
              {t("microzonation.microzonation")}
            </label>
            <Select
              value={filters.microzonation}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                setFilters((prev) => ({
                  ...prev,
                  microzonation: event.target.value
                }))
              }
              light
            >
              <option value="">{t("microzonation.allFeminine")}</option>
              {microzonationOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </div>
          <div className={Styles.field}>
            <label className={Styles.fieldLabel}>
              {t("microzonation.cle")}
            </label>
            <Select
              value={filters.cle}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                setFilters((prev) => ({
                  ...prev,
                  cle: event.target.value
                }))
              }
              light
            >
              <option value="">{t("microzonation.allFeminine")}</option>
              {cleOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className={Styles.actionsRow}>
          <Button
            primary
            onClick={applyFilters}
            disabled={loadingList || !records.length}
          >
            {t("microzonation.searchButton")}
          </Button>
          <Button secondary onClick={clearFilters}>
            {t("microzonation.clearButton")}
          </Button>
        </div>

        {loadingList && (
          <div className={Styles.notice}>{t("microzonation.loadingList")}</div>
        )}
        {listError && <div className={Styles.error}>{listError}</div>}

        {hasSearched && (
          <>
            <div className={Styles.sectionTitle}>
              {t("microzonation.listTitle")}
            </div>
            <div className={Styles.tableWrapper}>
              <table className={Styles.table}>
                <thead>
                  <tr>
                    <th>{t("microzonation.province")}</th>
                    <th>{t("microzonation.municipality")}</th>
                    <th>{t("microzonation.microzonation")}</th>
                    <th>{t("microzonation.msOrdinance")}</th>
                    <th>{t("microzonation.cle")}</th>
                    <th>{t("microzonation.cleOrdinance")}</th>
                    <th>{t("microzonation.municipalPlan")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length === 0 && (
                    <tr>
                      <td colSpan={7} className={Styles.emptyState}>
                        {t("microzonation.noResults")}
                      </td>
                    </tr>
                  )}
                  {filteredRecords.map((record, index) => {
                    const isSelected = selectedRecord === record;
                    return (
                      <tr
                        key={`${record.id ?? index}`}
                        className={
                          isSelected ? Styles.rowSelected : Styles.rowClickable
                        }
                        onClick={() => {
                          setSelectedRecord(record);
                          loadDetail(record);
                        }}
                      >
                        <td>{formatValue(record.province)}</td>
                        <td>{formatValue(record.municipality)}</td>
                        <td>{formatValue(record.microzonation)}</td>
                        <td>{formatValue(record.msOrdinance)}</td>
                        <td>{formatValue(record.cle)}</td>
                        <td>{formatValue(record.cleOrdinance)}</td>
                        <td>{formatValue(record.municipalPlan)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {(loadingDetail || detailError || detail) && (
          <div className={Styles.sectionTitle}>
            {t("microzonation.detailTitle")}
          </div>
        )}
        {loadingDetail && (
          <div className={Styles.notice}>
            {t("microzonation.loadingDetail")}
          </div>
        )}
        {detailError && <div className={Styles.error}>{detailError}</div>}

        {detail && (
          <div className={Styles.detailWrapper}>
            <div className={Styles.detailSection}>
              <div className={Styles.detailHeading}>
                {t("microzonation.generalInfo")}
              </div>
              <table className={Styles.detailTable}>
                <tbody>
                  <tr>
                    <td>{t("microzonation.province")}</td>
                    <td>{formatValue(detail.generalInfo.province)}</td>
                  </tr>
                  <tr>
                    <td>{t("microzonation.municipality")}</td>
                    <td>{formatValue(detail.generalInfo.municipality)}</td>
                  </tr>
                  <tr>
                    <td>{t("microzonation.notes")}</td>
                    <td>{formatValue(detail.generalInfo.notes)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={Styles.detailSection}>
              <div className={Styles.detailHeading}>
                {t("microzonation.microzonation")}
              </div>
              <table className={Styles.detailTable}>
                <tbody>
                  <tr>
                    <td>{t("microzonation.microzonation")}</td>
                    <td>{formatValue(detail.microzonation.microzonation)}</td>
                  </tr>
                  <tr>
                    <td>{t("microzonation.msOrdinance")}</td>
                    <td>{formatValue(detail.microzonation.msOrdinance)}</td>
                  </tr>
                  <tr>
                    <td>{t("microzonation.msValidation")}</td>
                    <td>{formatValue(detail.microzonation.msValidation)}</td>
                  </tr>
                  <tr>
                    <td>{t("microzonation.msStandard")}</td>
                    <td>{formatValue(detail.microzonation.msStandard)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={Styles.detailSection}>
              <div className={Styles.detailHeading}>
                {t("microzonation.cle")}
              </div>
              <table className={Styles.detailTable}>
                <tbody>
                  <tr>
                    <td>{t("microzonation.cle")}</td>
                    <td>{formatValue(detail.cle.cle)}</td>
                  </tr>
                  <tr>
                    <td>{t("microzonation.cleOrdinance")}</td>
                    <td>{formatValue(detail.cle.cleOrdinance)}</td>
                  </tr>
                  <tr>
                    <td>{t("microzonation.cleValidation")}</td>
                    <td>{formatValue(detail.cle.cleValidation)}</td>
                  </tr>
                  <tr>
                    <td>{t("microzonation.cleStandard")}</td>
                    <td>{formatValue(detail.cle.cleStandard)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={Styles.detailSection}>
              <div className={Styles.detailHeading}>
                {t("microzonation.civilProtectionPlan")}
              </div>
              <table className={Styles.detailTable}>
                <tbody>
                  <tr>
                    <td>{t("microzonation.municipalPlan")}</td>
                    <td>
                      {formatValue(detail.civilProtectionPlan.municipalPlan)}
                    </td>
                  </tr>
                  <tr>
                    <td>{t("microzonation.planLink")}</td>
                    <td>
                      {detail.civilProtectionPlan.link ? (
                        <a
                          href={detail.civilProtectionPlan.link}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t("microzonation.open")}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={Styles.detailSection}>
              <div className={Styles.detailHeading}>
                {t("microzonation.documents")}
              </div>
              <div className={Styles.tableWrapper}>
                <table className={Styles.table}>
                  <thead>
                    <tr>
                      <th>{t("microzonation.docType")}</th>
                      <th>{t("microzonation.docDescription")}</th>
                      <th>{t("microzonation.docStart")}</th>
                      <th>{t("microzonation.docEnd")}</th>
                      <th>{t("microzonation.docDownload")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.documents.length === 0 && (
                      <tr>
                        <td colSpan={5} className={Styles.emptyState}>
                          {t("microzonation.noDocuments")}
                        </td>
                      </tr>
                    )}
                    {detail.documents.map((doc, index) => (
                      <tr key={`${doc.type ?? "doc"}-${index}`}>
                        <td>{formatValue(doc.type)}</td>
                        <td>{formatValue(doc.description)}</td>
                        <td>{formatValue(doc.start)}</td>
                        <td>{formatValue(doc.end)}</td>
                        <td>
                          {doc.attachmentUrl ? (
                            <a
                              href={doc.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {t("microzonation.download")}
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Box>
    </Panel>
  );
});

export default MicrozonationPanel;
