declare namespace FontesButtonScssNamespace {
  export interface IFontesButtonScss {
    fontesBtn: string;
  }
}

declare const FontesButtonScssModule: FontesButtonScssNamespace.IFontesButtonScss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: FontesButtonScssNamespace.IFontesButtonScss;
};

export = FontesButtonScssModule;
