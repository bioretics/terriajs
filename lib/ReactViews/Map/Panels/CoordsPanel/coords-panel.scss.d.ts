declare namespace CoordsPanelScssNamespace {
  export interface ICoordsPanelScss {
    "crs--item": string;
    crsItem: string;
    "dropdown-inner": string;
    dropdownInner: string;
    explanation: string;
    "format-button": string;
    formatButton: string;
    shareUrlfield: string;
  }
}

declare const CoordsPanelScssModule: CoordsPanelScssNamespace.ICoordsPanelScss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: CoordsPanelScssNamespace.ICoordsPanelScss;
};

export = CoordsPanelScssModule;
