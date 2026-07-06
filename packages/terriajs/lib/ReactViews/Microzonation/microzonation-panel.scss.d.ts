declare namespace MicrozonationPanelScssNamespace {
  export interface IMicrozonationPanelScss {
    actionsRow: string;
    detailHeading: string;
    detailSection: string;
    detailTable: string;
    detailWrapper: string;
    emergencyPlansLink: string;
    emptyState: string;
    error: string;
    field: string;
    fieldLabel: string;
    filterGrid: string;
    notice: string;
    resizeHandle: string;
    rowClickable: string;
    rowSelected: string;
    sectionTitle: string;
    table: string;
    tableWrapper: string;
  }
}

declare const MicrozonationPanelScssModule: MicrozonationPanelScssNamespace.IMicrozonationPanelScss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: MicrozonationPanelScssNamespace.IMicrozonationPanelScss;
};

export = MicrozonationPanelScssModule;
