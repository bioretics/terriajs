declare namespace MeasurablePanelScssNamespace {
  export interface IMeasurablePanelScss {
    body: string;
    "btn--close-feature": string;
    "btn--download": string;
    "btn-location": string;
    "btn-location-selected": string;
    btnCloseFeature: string;
    btnDownload: string;
    btnLocation: string;
    btnLocationSelected: string;
    btnPanelHeading: string;
    btnToggleFeature: string;
    elevation: string;
    header: string;
    "is-collapsed": string;
    "is-translucent": string;
    "is-visible": string;
    isCollapsed: string;
    isTranslucent: string;
    isVisible: string;
    location: string;
    "no-results": string;
    noResults: string;
    panel: string;
  }
}

declare const MeasurablePanelScssModule: MeasurablePanelScssNamespace.IMeasurablePanelScss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: MeasurablePanelScssNamespace.IMeasurablePanelScss;
};

export = MeasurablePanelScssModule;
