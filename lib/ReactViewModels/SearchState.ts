// import CatalogItemNameSearchProviderViewModel from "../ViewModels/CatalogItemNameSearchProviderViewModel";
import {
  observable,
  reaction,
  IReactionDisposer,
  computed,
  action
} from "mobx";
import Terria from "../Models/Terria";
import SearchProviderResults from "../Models/SearchProviders/SearchProviderResults";
import SearchProvider from "../Models/SearchProviders/SearchProvider";
import filterOutUndefined from "../Core/filterOutUndefined";
import CatalogSearchProvider from "../Models/SearchProviders/CatalogSearchProvider";
import CatalogItemsSearchProvider from "../Models/SearchProviders/CatalogItemsSearchProvider";

interface SearchStateOptions {
  terria: Terria;
  catalogSearchProvider?: CatalogSearchProvider;
  catalogItemsSearchProvider?: CatalogItemsSearchProvider;
  locationSearchProviders?: SearchProvider[];
}

export default class SearchState {
  @observable
  catalogSearchProvider: SearchProvider | undefined;

  @observable catalogItemsSearchProvider: SearchProvider | undefined;

  @observable locationSearchProviders: SearchProvider[];

  @observable catalogSearchText: string = "";
  @observable isWaitingToStartCatalogSearch: boolean = false;

  @observable catalogItemsSearchText: string = "";
  @observable isWaitingToStartCatalogItemsSearch: boolean = false;

  @observable locationSearchText: string = "";
  @observable isWaitingToStartLocationSearch: boolean = false;

  @observable unifiedSearchText: string = "";
  @observable isWaitingToStartUnifiedSearch: boolean = false;

  @observable showLocationSearchResults: boolean = false;
  @observable showMobileLocationSearch: boolean = false;
  @observable showMobileCatalogSearch: boolean = false;

  @observable locationSearchResults: SearchProviderResults[] = [];
  @observable catalogSearchResults: SearchProviderResults | undefined;
  @observable catalogItemsSearchResults: SearchProviderResults | undefined;
  @observable unifiedSearchResults: SearchProviderResults[] = [];

  private _catalogSearchDisposer: IReactionDisposer;
  private _catalogItemsSearchDisposer: IReactionDisposer;
  private _locationSearchDisposer: IReactionDisposer;
  private _unifiedSearchDisposer: IReactionDisposer;

  constructor(options: SearchStateOptions) {
    this.catalogSearchProvider =
      options.catalogSearchProvider ||
      new CatalogSearchProvider({ terria: options.terria });
    this.catalogItemsSearchProvider = new CatalogItemsSearchProvider({
      terria: options.terria
    });
    this.locationSearchProviders = options.locationSearchProviders || [];

    this._catalogSearchDisposer = reaction(
      () => this.catalogSearchText,
      () => {
        this.isWaitingToStartCatalogSearch = true;
        if (this.catalogSearchProvider) {
          this.catalogSearchResults = this.catalogSearchProvider.search("");
        }
      }
    );

    this._catalogItemsSearchDisposer = reaction(
      () => this.catalogItemsSearchText,
      () => {
        this.isWaitingToStartCatalogItemsSearch = true;
        if (this.catalogItemsSearchProvider) {
          this.catalogItemsSearchResults =
            this.catalogItemsSearchProvider.search("");
        }
      }
    );

    this._locationSearchDisposer = reaction(
      () => this.locationSearchText,
      () => {
        this.isWaitingToStartLocationSearch = true;
        this.locationSearchResults = this.locationSearchProviders.map(
          (provider) => {
            return provider.search("");
          }
        );
      }
    );

    this._unifiedSearchDisposer = reaction(
      () => this.unifiedSearchText,
      () => {
        this.isWaitingToStartUnifiedSearch = true;
        this.unifiedSearchResults = this.unifiedSearchProviders.map(
          (provider) => {
            return provider.search("");
          }
        );
      }
    );
  }

  dispose() {
    this._catalogSearchDisposer();
    this._catalogItemsSearchDisposer();
    this._locationSearchDisposer();
    this._unifiedSearchDisposer();
  }

  @computed
  get unifiedSearchProviders(): SearchProvider[] {
    return filterOutUndefined([
      this.catalogSearchProvider,
      ...this.locationSearchProviders
    ]);
  }

  @action
  searchCatalog() {
    if (this.isWaitingToStartCatalogSearch) {
      this.isWaitingToStartCatalogSearch = false;
      if (this.catalogSearchResults) {
        this.catalogSearchResults.isCanceled = true;
      }
      if (this.catalogSearchProvider) {
        this.catalogSearchResults = this.catalogSearchProvider.search(
          this.catalogSearchText
        );
      }
    }
  }

  @action
  searchCatalogItems() {
    if (this.isWaitingToStartCatalogItemsSearch) {
      this.isWaitingToStartCatalogItemsSearch = false;
      if (this.catalogItemsSearchResults) {
        this.catalogItemsSearchResults.isCanceled = true;
      }
      if (this.catalogItemsSearchProvider) {
        this.catalogItemsSearchResults = this.catalogItemsSearchProvider.search(
          this.catalogItemsSearchText
        );
      }
    }
  }

  @action
  setCatalogItemsSearchText(newText: string) {
    this.catalogItemsSearchText = newText;
  }

  @action
  setCatalogSearchText(newText: string) {
    this.catalogSearchText = newText;
  }

  @action
  searchLocations() {
    if (this.isWaitingToStartLocationSearch) {
      this.isWaitingToStartLocationSearch = false;
      this.locationSearchResults.forEach((results) => {
        results.isCanceled = true;
      });
      this.locationSearchResults = this.locationSearchProviders.map(
        (searchProvider) => searchProvider.search(this.locationSearchText)
      );
    }

    if (this.catalogItemsSearchProvider && this.locationSearchText === "") {
      this.catalogItemsSearchResults = undefined;
    }
  }

  @action
  searchUnified() {
    if (this.isWaitingToStartUnifiedSearch) {
      this.isWaitingToStartUnifiedSearch = false;
      this.unifiedSearchResults.forEach((results) => {
        results.isCanceled = true;
      });
      this.unifiedSearchResults = this.unifiedSearchProviders.map(
        (searchProvider) => searchProvider.search(this.unifiedSearchText)
      );
    }
  }
}
