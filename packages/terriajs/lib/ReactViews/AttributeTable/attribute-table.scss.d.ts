declare namespace AttributeTableScssNamespace {
  export interface IAttributeTableScss {
    "dashboard-grid": string;
    "dashboard-widget": string;
    "dashboard-widget-header": string;
    dashboardGrid: string;
    dashboardWidget: string;
    dashboardWidgetHeader: string;
    dialog: string;
    "dialog-actions": string;
    "dialog-backdrop": string;
    dialogActions: string;
    dialogBackdrop: string;
    "editable-cell": string;
    editableCell: string;
    "empty-state": string;
    emptyState: string;
    "error-banner": string;
    errorBanner: string;
    "grid-wrap": string;
    gridWrap: string;
    "panel-content": string;
    panelContent: string;
    "search-input": string;
    searchInput: string;
    "status-bar": string;
    statusBar: string;
    "tab-list": string;
    "tab-list__item": string;
    "tab-panel": string;
    tabList: string;
    tabListItem: string;
    tabPanel: string;
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
