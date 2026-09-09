import globeGif from "../Styles/globe.gif";
import Styles from "./loader.scss";

export const Loader = () => {
  return (
    <div
      className={Styles.loaderUi}
      style={{
        // Matches the theme background ($dark in lib/Styles/variables-overrides.scss)
        backgroundColor: "#11151c"
      }}
    >
      <img src={globeGif} />
    </div>
  );
};
