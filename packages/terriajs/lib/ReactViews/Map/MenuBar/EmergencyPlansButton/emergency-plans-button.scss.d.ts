declare namespace EmergencyPlansButtonScssNamespace {
  export interface IEmergencyPlansButtonScss {
    emergencyPlansBtn: string;
  }
}

declare const EmergencyPlansButtonScssModule: EmergencyPlansButtonScssNamespace.IEmergencyPlansButtonScss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: EmergencyPlansButtonScssNamespace.IEmergencyPlansButtonScss;
};

export = EmergencyPlansButtonScssModule;
