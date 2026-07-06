declare namespace ColorPanelScssNamespace {
  export interface IColorPanelScss {
    "dropdown-inner": string;
    dropdownInner: string;
  }
}

declare const ColorPanelScssModule: ColorPanelScssNamespace.IColorPanelScss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: ColorPanelScssNamespace.IColorPanelScss;
};

export = ColorPanelScssModule;
