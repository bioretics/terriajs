declare namespace AttributeTableScssNamespace {
  export interface IAttributeTableScss {
    "chart-preview": string;
    chartPreview: string;
    "column-explorer-row": string;
    "column-explorer-row--hidden": string;
    columnExplorerRow: string;
    columnExplorerRowHidden: string;
    "dashboard-grid": string;
    "dashboard-widget": string;
    "dashboard-widget-header": string;
    dashboardGrid: string;
    dashboardWidget: string;
    dashboardWidgetHeader: string;
    dialog: string;
    "dialog-actions": string;
    "dialog-backdrop": string;
    "dialog-body": string;
    "dialog-header": string;
    dialogActions: string;
    dialogBackdrop: string;
    dialogBody: string;
    dialogHeader: string;
    "editable-cell": string;
    editableCell: string;
    "empty-state": string;
    emptyState: string;
    "error-banner": string;
    errorBanner: string;
    "grid-wrap": string;
    gridWrap: string;
    "header-tab": string;
    "header-tab--current": string;
    "header-tabs": string;
    headerTab: string;
    headerTabCurrent: string;
    headerTabs: string;
    "panel-body": string;
    "panel-content": string;
    panelBody: string;
    panelContent: string;
    "search-input": string;
    searchInput: string;
    "status-bar": string;
    statusBar: string;
    toolbar: string;
    "toolbar-spacer": string;
    toolbarSpacer: string;
  }
}

declare const AttributeTableScssModule: AttributeTableScssNamespace.IAttributeTableScss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: AttributeTableScssNamespace.IAttributeTableScss;
};

export = AttributeTableScssModule;
