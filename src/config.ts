import * as vscode from "vscode";
import { getConfigByKey, updateConfigByKey } from "./cache";
import ConfigKey from "./enum/configKey";
import ExcludeMode from "./enum/excludeMode";
import Icons from "./interface/icons";
import ItemsFilter from "./interface/itemsFilter";
import ItemsFilterPhrases from "./interface/itemsFilterPhrases";

class Config {
  private default = {
    shouldDisplayNotificationInStatusBar: false,
    shouldInitOnStartup: false,
    shouldHighlightSymbol: false,
    shouldUseDebounce: false,
    icons: {} as Icons,
    itemsFilter: {
      allowedKinds: [],
      ignoredKinds: [],
      ignoredNames: [],
    } as ItemsFilter,
    shouldUseItemsFilterPhrases: false,
    itemsFilterPhrases: {} as ItemsFilterPhrases,
    helpPhrase: "?",
    exclude: [] as string[],
    include: "",
    excludeMode: ExcludeMode.SearchEverywhere,
  };
  private readonly defaultSection = "searchEverywhere";

  constructor() {}

  shouldDisplayNotificationInStatusBar(): boolean {
    return this.get(
      ConfigKey.shouldDisplayNotificationInStatusBar,
      this.default.shouldDisplayNotificationInStatusBar
    );
  }

  shouldInitOnStartup(): boolean {
    return this.get(
      ConfigKey.shouldInitOnStartup,
      this.default.shouldInitOnStartup
    );
  }

  shouldHighlightSymbol(): boolean {
    return this.get(
      ConfigKey.shouldHighlightSymbol,
      this.default.shouldHighlightSymbol
    );
  }

  shouldUseDebounce(): boolean {
    return this.get(
      ConfigKey.shouldUseDebounce,
      this.default.shouldUseDebounce
    );
  }

  getIcons(): Icons {
    return this.get(ConfigKey.icons, this.default.icons);
  }

  getItemsFilter(): ItemsFilter {
    return this.get(ConfigKey.itemsFilter, this.default.itemsFilter);
  }

  shouldUseItemsFilterPhrases(): boolean {
    return this.get(
      ConfigKey.shouldUseItemsFilterPhrases,
      this.default.shouldUseItemsFilterPhrases
    );
  }

  getItemsFilterPhrases(): ItemsFilterPhrases {
    return this.get(
      ConfigKey.itemsFilterPhrases,
      this.default.itemsFilterPhrases
    );
  }

  getHelpPhrase(): string {
    return this.get(ConfigKey.helpPhrase, this.default.helpPhrase);
  }

  getExclude(): string[] {
    return this.get(ConfigKey.exclude, this.default.exclude);
  }

  getInclude(): string {
    return this.get(ConfigKey.include, this.default.include);
  }

  getFilesAndSearchExclude(): string[] {
    let excludePatterns: Array<string> = [];
    const filesExcludePatterns = this.getFilesExclude();
    const searchExcludePatterns = this.getSearchExclude();

    const allExcludePatterns = Object.assign(
      {},
      filesExcludePatterns,
      searchExcludePatterns
    );
    for (let [key, value] of Object.entries(allExcludePatterns)) {
      value && excludePatterns.push(key);
    }

    return excludePatterns;
  }

  getExcludeMode(): ExcludeMode {
    return this.get(ConfigKey.excludeMode, this.default.excludeMode);
  }

  private getFilesExclude(): string[] {
    return this.get(ConfigKey.exclude, this.default.exclude, "files");
  }

  private getSearchExclude(): string[] {
    return this.get(ConfigKey.exclude, this.default.exclude, "search");
  }

  private get<T>(key: string, defaultValue: T, customSection?: string): T {
    const cacheKey = `${
      customSection ? customSection : this.defaultSection
    }.${key}`;
    let value = getConfigByKey<T>(cacheKey);
    if (!value) {
      value = this.getConfigurationByKey<T>(key, defaultValue, customSection);
      updateConfigByKey(cacheKey, value);
    }
    return value as T;
  }

  private getConfigurationByKey<T>(
    key: string,
    defaultValue: T,
    customSection?: string
  ): T {
    return this.getConfiguration<T>(
      `${customSection ? customSection : this.defaultSection}.${key}`,
      defaultValue
    );
  }

  private getConfiguration<T>(section: string, defaultValue: T): T {
    const config = vscode.workspace.getConfiguration("");
    return config.get<T>(section, defaultValue);
  }
}

export default Config;
