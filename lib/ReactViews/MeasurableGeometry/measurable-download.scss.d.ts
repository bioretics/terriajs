declare namespace MeasurableDownloadScssNamespace {
  export interface IMeasurableDownloadScss {
    btn: string;
    download: string;
    dropdownButton: string;
    dropdownList: string;
    dropdown__button: string;
    dropdown__list: string;
    "icon--download": string;
    iconDownload: string;
  }
}

declare const MeasurableDownloadScssModule: MeasurableDownloadScssNamespace.IMeasurableDownloadScss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: MeasurableDownloadScssNamespace.IMeasurableDownloadScss;
};

export = MeasurableDownloadScssModule;
