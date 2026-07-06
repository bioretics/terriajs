declare namespace MicrozonationButtonScssNamespace {
  export interface IMicrozonationButtonScss {
    microzonationBtn: string;
  }
}

declare const MicrozonationButtonScssModule: MicrozonationButtonScssNamespace.IMicrozonationButtonScss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: MicrozonationButtonScssNamespace.IMicrozonationButtonScss;
};

export = MicrozonationButtonScssModule;
