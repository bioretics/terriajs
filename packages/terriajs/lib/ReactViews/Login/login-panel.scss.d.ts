declare namespace LoginPanelScssNamespace {
  export interface ILoginPanelScss {
    body: string;
    btnPanelHeading: string;
    buttonRow: string;
    fieldGroup: string;
    header: string;
    headerContent: string;
    headerIcon: string;
    "is-collapsed": string;
    "is-loading": string;
    "is-translucent": string;
    "is-visible": string;
    isCollapsed: string;
    isLoading: string;
    isTranslucent: string;
    isVisible: string;
    loadingIndicator: string;
    messageBox: string;
    messageError: string;
    messageInfo: string;
    panel: string;
  passwordField: string;
  passwordToggle: string;
  passwordToggleActive: string;
    pulse: string;
  }
}

declare const LoginPanelScssModule: LoginPanelScssNamespace.ILoginPanelScss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: LoginPanelScssNamespace.ILoginPanelScss;
};

export = LoginPanelScssModule;
