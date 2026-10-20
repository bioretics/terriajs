declare namespace MobileHeaderScssNamespace {
  export interface IMobileHeaderScss {
    btn: string;
    "btn-icon": string;
    "btn-now-viewing": string;
    btnIcon: string;
    btnNowViewing: string;
    doubleDigit: string;
    formSearchData: string;
    "group-left": string;
    "group-right": string;
    groupLeft: string;
    groupRight: string;
    "mobile-header": string;
    mobileHeader: string;
    nowViewingCount: string;
    ui: string;
  }
}

declare const MobileHeaderScssModule: MobileHeaderScssNamespace.IMobileHeaderScss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: MobileHeaderScssNamespace.IMobileHeaderScss;
};

export = MobileHeaderScssModule;
