declare namespace MenuBarScssNamespace {
  export interface IMenuBarScss {
    "app-title": string;
    appTitle: string;
    brand: string;
    flex: string;
    langBtn: string;
    left: string;
    menu: string;
    "menu-bar": string;
    "menu-item": string;
    menuBar: string;
    menuItem: string;
    right: string;
  }
}

declare const MenuBarScssModule: MenuBarScssNamespace.IMenuBarScss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: MenuBarScssNamespace.IMenuBarScss;
};

export = MenuBarScssModule;
