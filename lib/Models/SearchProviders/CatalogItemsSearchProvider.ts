import { computed, observable, runInAction, action } from "mobx";
import { fromPromise } from "mobx-utils";
import isDefined from "../../Core/isDefined";
import { TerriaErrorSeverity } from "../../Core/TerriaError";
import Terria from "../Terria";
import SearchProvider from "./SearchProvider";
import SearchProviderResults from "./SearchProviderResults";
import SearchableCatalogItemMixin from "../../ModelMixins/SearchableCatalogItemMixin";
import SearchResult from "./SearchResult";
interface CatalogItemsSearchProviderOptions {
  terria: Terria;
}

async function searchInOpenedCatalogItems(
  terria: Terria,
  searchTextLowercase: string
): Promise<SearchResult[][]> {
  //TODO: the results will probably have to be kept separate in the future
  const searchableCatalogItems = terria.workbench.items.filter((item) =>
    SearchableCatalogItemMixin.isMixedInto(item)
  ) as SearchableCatalogItemMixin.Instance[];
  const searchPromiseList = searchableCatalogItems.map((item) => {
    return item.searchWithinItemData(searchTextLowercase);
  });
  return Promise.all(searchPromiseList);
}

export default class CatalogItemsSearchProvider extends SearchProvider {
  readonly terria: Terria;
  @observable isSearching: boolean = false;
  @observable debounceDurationOnceLoaded: number = 300;

  constructor(options: CatalogItemsSearchProviderOptions) {
    super();

    this.terria = options.terria;
    this.name = "Layers aperti";
  }

  @computed get canUse() {
    return this.terria.workbench.items.some(
      (item) =>
        SearchableCatalogItemMixin.isMixedInto(item) &&
        (item.nameOfCatalogItemSearchField || item.catalogItemWebSearch)
    );
  }

  @computed get resultsAreReferences() {
    return (
      isDefined(this.terria.catalogIndex?.loadPromise) &&
      fromPromise(this.terria.catalogIndex!.loadPromise).state === "fulfilled"
    );
  }

  @action
  protected async doSearch(
    searchText: string,
    searchResults: SearchProviderResults
  ): Promise<void> {
    runInAction(() => (this.isSearching = true));

    searchResults.results.length = 0;
    searchResults.message = undefined;

    if (searchText === undefined || /^\s*$/.test(searchText)) {
      runInAction(() => (this.isSearching = false));
      return Promise.resolve();
    }

    try {
      const res = await searchInOpenedCatalogItems(
        this.terria,
        searchText.toLowerCase()
      );
      runInAction(() => (searchResults.results = res.flat()));

      runInAction(() => {
        this.isSearching = false;
      });

      if (searchResults.isCanceled) {
        // A new search has superseded this one, so ignore the result.
        return;
      }

      if (searchResults.results.length === 0) {
        searchResults.message = "Sorry, no locations match your search query.";
      }
    } catch (e) {
      this.terria.raiseErrorToUser(e, {
        message: "An error occurred while searching",
        severity: TerriaErrorSeverity.Warning
      });
      if (searchResults.isCanceled) {
        // A new search has superseded this one, so ignore the result.
        return;
      }

      searchResults.message =
        "An error occurred while searching.  Please check your internet connection or try again later.";
    }
  }
}
