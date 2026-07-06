declare namespace QueryTabPanelScssNamespace {
  export interface IQueryTabPanelScss {
    "data-explorer": string;
    dataExplorer: string;
    root: string;
  }
}

declare const QueryTabPanelScssModule: QueryTabPanelScssNamespace.IQueryTabPanelScss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: QueryTabPanelScssNamespace.IQueryTabPanelScss;
};

export = QueryTabPanelScssModule;
