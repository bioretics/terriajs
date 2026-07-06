import AustralianGazetteerSearchProvider from "./AustralianGazetteerSearchProvider";
import BingMapsSearchProvider from "./BingMapsSearchProvider";
import CesiumIonSearchProvider from "./CesiumIonSearchProvider";
import MapboxSearchProvider from "./MapboxSearchProvider";
import NominatimSearchProvider from "./NominatimSearchProvider";
import RerSearchProvider from "./RerSearchProvider";
import SearchProviderFactory from "./SearchProviderFactory";

export default function registerSearchProviders() {
  SearchProviderFactory.register(
    BingMapsSearchProvider.type,
    BingMapsSearchProvider
  );

  SearchProviderFactory.register(RerSearchProvider.type, RerSearchProvider);

  SearchProviderFactory.register(
    CesiumIonSearchProvider.type,
    CesiumIonSearchProvider
  );

  SearchProviderFactory.register(
    NominatimSearchProvider.type,
    NominatimSearchProvider
  );

  SearchProviderFactory.register(
    AustralianGazetteerSearchProvider.type,
    AustralianGazetteerSearchProvider
  );

  SearchProviderFactory.register(
    MapboxSearchProvider.type,
    MapboxSearchProvider
  );
}
