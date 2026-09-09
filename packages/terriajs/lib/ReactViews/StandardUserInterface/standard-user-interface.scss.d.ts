declare namespace StandardUserInterfaceScssNamespace {
  export interface IStandardUserInterfaceScss {
    explorerPanelIsVisible: string;
    featureInfo: string;
    featureInfoFullScreen: string;
    feedback: string;
    map: string;
    "story-wrapper": string;
    storyPanel: string;
    storyPanelFullScreen: string;
    storyWrapper: string;
    ui: string;
    "ui-root": string;
    uiInner: string;
    uiRoot: string;
    workspace: string;
    workspaceNoMobileHeader: string;
  }
}

declare const StandardUserInterfaceScssModule: StandardUserInterfaceScssNamespace.IStandardUserInterfaceScss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StandardUserInterfaceScssNamespace.IStandardUserInterfaceScss;
};

export = StandardUserInterfaceScssModule;
