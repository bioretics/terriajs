declare namespace QueryWindowScssNamespace {
  export interface IQueryWindowScss {
    "panel-content": string;
    panelContent: string;
    "tab-list": string;
    "tab-list__item": string;
    "tab-panel": string;
    tabList: string;
    tabListItem: string;
    tabPanel: string;
  }
}

declare const QueryWindowScssModule: QueryWindowScssNamespace.IQueryWindowScss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: QueryWindowScssNamespace.IQueryWindowScss;
};

export = QueryWindowScssModule;
