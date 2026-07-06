import {
  action,
  computed,
  IReactionDisposer,
  makeObservable,
  observable,
  reaction,
  runInAction
} from "mobx";
import CatalogItemsSearchProviderMixin from "../ModelMixins/SearchProviders/CatalogItemsSearchProviderMixin";
import CatalogSearchProviderMixin from "../ModelMixins/SearchProviders/CatalogSearchProviderMixin";
import LocationSearchProviderMixin from "../ModelMixins/SearchProviders/LocationSearchProviderMixin";
import CatalogItemsSearchProvider from "../Models/SearchProviders/CatalogItemsSearchProvider";
import Terria from "../Models/Terria";

interface SearchStateOptions {
  terria: Terria;
  // Fork (rer3d): allow injecting the catalog-items search provider
  // (configParameters.searchInCatalogItemInfo feature).
  catalogItemsSearchProvider?: CatalogItemsSearchProviderMixin.Instance;
}

export default class SearchState {
  @observable private _catalogSearchText: string = "";

  @observable private _locationSearchText: string = "";

  // Fork (rer3d): search inside catalog item info.
  @observable private _catalogItemsSearchText: string = "";

  @observable showLocationSearchResults: boolean = false;
  @observable showMobileLocationSearch: boolean = false;
  @observable showMobileCatalogSearch: boolean = false;

  private _workbenchItemsSubscription: IReactionDisposer;

  private readonly terria: Terria;

  constructor(options: SearchStateOptions) {
    makeObservable(this);

    this.terria = options.terria;

    // Fork (rer3d): register the catalog-items search provider on the
    // search bar model so UI components can reach it.
    runInAction(() => {
      this.terria.searchBarModel.catalogItemsSearchProvider =
        options.catalogItemsSearchProvider ||
        new CatalogItemsSearchProvider(
          "catalog-items-search-provider",
          options.terria
        );
    });

    this._workbenchItemsSubscription = reaction(
      () => this.terria.workbench.items,
      () => {
        this.showLocationSearchResults = false;
      }
    );
  }

  dispose(): void {
    this._workbenchItemsSubscription();
  }

  @computed
  get locationSearchText() {
    return this._locationSearchText;
  }

  set locationSearchText(newText: string) {
    this._locationSearchText = newText;

    for (const searchProvider of this.locationSearchProviders) {
      searchProvider.cancelSearch();

      if (newText.length > 0) searchProvider.search(newText, false);
    }

    // Fork (rer3d): clearing the location search also clears the
    // catalog-items search results.
    if (newText.length === 0) {
      this.catalogItemsSearchProvider?.cancelSearch();
      this._catalogItemsSearchText = "";
    }
  }

  @computed get catalogSearchText() {
    return this._catalogSearchText;
  }

  set catalogSearchText(newText: string) {
    this._catalogSearchText = newText;

    this.catalogSearchProvider?.cancelSearch();
    if (newText.length > 0) this.catalogSearchProvider?.search(newText, false);
  }

  // Fork (rer3d): text state for the catalog-items search.
  @computed get catalogItemsSearchText() {
    return this._catalogItemsSearchText;
  }

  set catalogItemsSearchText(newText: string) {
    this._catalogItemsSearchText = newText;

    this.catalogItemsSearchProvider?.cancelSearch();
    if (newText.length > 0)
      this.catalogItemsSearchProvider?.search(newText, false);
  }

  @computed
  get locationSearchProviders(): LocationSearchProviderMixin.Instance[] {
    return this.terria.searchBarModel.locationSearchProvidersArray;
  }

  @computed
  get catalogSearchProvider(): CatalogSearchProviderMixin.Instance | undefined {
    return this.terria.catalog.searchProvider;
  }

  // Fork (rer3d): provider used to search inside catalog item info.
  @computed
  get catalogItemsSearchProvider():
    | CatalogItemsSearchProviderMixin.Instance
    | undefined {
    return this.terria.searchBarModel.catalogItemsSearchProvider;
  }

  @action
  searchCatalog(): void {
    this.catalogSearchProvider?.search(this.catalogSearchText, true);
  }

  // Fork (rer3d): trigger a catalog-items search.
  @action
  searchCatalogItems(): void {
    this.catalogItemsSearchProvider?.search(this.catalogItemsSearchText, true);
  }

  @action
  searchLocations(): void {
    for (const searchProvider of this.locationSearchProviders) {
      if (
        !searchProvider.autocompleteEnabled ||
        searchProvider.searchResult.isWaitingToStartSearch ||
        searchProvider.searchResult.isSearching
      )
        searchProvider.search(this.locationSearchText, true);
    }
  }
}
