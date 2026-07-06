declare namespace ViewshedPanelScssNamespace {
  export interface IViewshedPanelScss {
    body: string;
    btnPanelHeading: string;
    header: string;
    "is-collapsed": string;
    "is-translucent": string;
    "is-visible": string;
    isCollapsed: string;
    isTranslucent: string;
    isVisible: string;
    panel: string;
  }
}

declare const ViewshedPanelScssModule: ViewshedPanelScssNamespace.IViewshedPanelScss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: ViewshedPanelScssNamespace.IViewshedPanelScss;
};

export = ViewshedPanelScssModule;
