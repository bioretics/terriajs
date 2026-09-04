declare namespace MobileLoginMenuItemScssNamespace {
  export interface IMobileLoginMenuItemScss {
    logoutCancelBtn: string;
    logoutConfirm: string;
    logoutConfirmActions: string;
    logoutConfirmBtn: string;
    logoutConfirmMessage: string;
  }
}

declare const MobileLoginMenuItemScssModule: MobileLoginMenuItemScssNamespace.IMobileLoginMenuItemScss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: MobileLoginMenuItemScssNamespace.IMobileLoginMenuItemScss;
};

export = MobileLoginMenuItemScssModule;
