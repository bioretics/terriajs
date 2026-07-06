declare namespace LoginButtonScssNamespace {
  export interface ILoginButtonScss {
    loginBtn: string;
    loginContainer: string;
    logoutCancelBtn: string;
    logoutConfirmActions: string;
    logoutConfirmBtn: string;
    logoutConfirmMessage: string;
    logoutConfirmPanel: string;
  }
}

declare const LoginButtonScssModule: LoginButtonScssNamespace.ILoginButtonScss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: LoginButtonScssNamespace.ILoginButtonScss;
};

export = LoginButtonScssModule;
