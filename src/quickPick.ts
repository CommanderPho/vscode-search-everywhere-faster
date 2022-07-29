import * as vscode from "vscode";
import {
  getHelpPhrase,
  getItemsFilterPhrases,
  shouldHighlightSymbol,
  shouldUseDebounce,
  shouldUseItemsFilterPhrases,
} from "./config";
import ItemsFilterPhrases from "./interface/itemsFilterPhrases";
import QuickPickItem from "./interface/quickPickItem";
const debounce = require("debounce");

class QuickPick {
  private quickPick!: vscode.QuickPick<QuickPickItem>;
  private items: QuickPickItem[];
  private shouldUseItemsFilterPhrases!: boolean;
  private helpPhrase!: string;
  private itemsFilterPhrases!: ItemsFilterPhrases;
  private helpItems!: QuickPickItem[];

  private onDidChangeValueEventListeners: vscode.Disposable[];

  constructor() {
    this.items = [];
    this.onDidChangeValueEventListeners = [];

    this.fetchConfig();
    this.fetchHelpData();
  }

  init(): void {
    this.quickPick = vscode.window.createQuickPick();
    this.quickPick.matchOnDetail = true;
    this.quickPick.matchOnDescription = true;

    this.quickPick.onDidHide(this.handleDidHide);
    this.quickPick.onDidAccept(this.handleDidAccept);
    this.quickPick.onDidChangeValue(this.handleDidChangeValue);
    this.registerOnDidChangeValueEventListeners();
  }

  reloadOnDidChangeValueEventListener(): void {
    this.disposeOnDidChangeValueEventListeners();
    this.registerOnDidChangeValueEventListeners();
  }

  reload(): void {
    this.fetchConfig();
    this.fetchHelpData();
  }

  isInitialized(): boolean {
    return !!this.quickPick;
  }

  show(): void {
    this.quickPick.show();
  }

  loadItems(loadHelp: boolean = false): void {
    this.quickPick.items = loadHelp ? this.helpItems : this.items;
  }

  setItems(items: QuickPickItem[]): void {
    this.items = items;
  }

  showLoading(value: boolean): void {
    this.quickPick.busy = value;
  }

  setText(text: string): void {
    this.quickPick.value = text;
  }

  setPlaceholder(isBusy: boolean): void {
    this.quickPick.placeholder = isBusy
      ? "Please wait, loading..."
      : this.shouldUseItemsFilterPhrases
      ? `${
          this.helpPhrase
            ? `Type ${this.helpPhrase} for help or start typing file or symbol name...`
            : `Help phrase not set. Start typing file or symbol name...`
        }`
      : "Start typing file or symbol name...";
  }

  private disposeOnDidChangeValueEventListeners(): void {
    this.onDidChangeValueEventListeners.forEach(
      (eventListener: vscode.Disposable) => eventListener.dispose()
    );
    this.onDidChangeValueEventListeners = [];
  }

  private registerOnDidChangeValueEventListeners(): void {
    shouldUseDebounce()
      ? this.registerOnDidChangeValueWithDebounceEventListeners()
      : this.registerOnDidChangeValueWithoutDebounceEventListeners();
  }

  private registerOnDidChangeValueWithDebounceEventListeners(): void {
    const onDidChangeValueClearingEventListener =
      this.quickPick.onDidChangeValue(this.handleDidChangeValueClearing);
    const onDidChangeValueEventListener = this.quickPick.onDidChangeValue(
      debounce(this.handleDidChangeValue, 400)
    );

    this.onDidChangeValueEventListeners.push(
      onDidChangeValueClearingEventListener
    );
    this.onDidChangeValueEventListeners.push(onDidChangeValueEventListener);
  }

  private registerOnDidChangeValueWithoutDebounceEventListeners(): void {
    const onDidChangeValueEventListener = this.quickPick.onDidChangeValue(
      debounce(this.handleDidChangeValue, 400)
    );

    this.onDidChangeValueEventListeners.push(onDidChangeValueEventListener);
  }

  private async openSelected(qpItem: QuickPickItem): Promise<void> {
    this.shouldLoadItemsForFilterPhrase(qpItem)
      ? this.loadItemsForFilterPhrase(qpItem)
      : await this.openItem(qpItem);
  }

  private shouldLoadItemsForFilterPhrase(qpItem: QuickPickItem): boolean {
    return this.shouldUseItemsFilterPhrases && !!qpItem.isHelp;
  }

  private loadItemsForFilterPhrase(qpItem: QuickPickItem): void {
    const filterPhrase = this.itemsFilterPhrases[qpItem.symbolKind];
    this.setText(filterPhrase);
    this.loadItems();
  }

  private async openItem(qpItem: QuickPickItem): Promise<void> {
    const document = await vscode.workspace.openTextDocument(
      qpItem.uri!.scheme === "file" ? (qpItem.uri!.fsPath as any) : qpItem.uri
    );
    const editor = await vscode.window.showTextDocument(document);
    this.selectQpItem(editor, qpItem);
  }

  private selectQpItem(editor: vscode.TextEditor, qpItem: QuickPickItem): void {
    editor.selection = this.getSelectionForQpItem(
      qpItem,
      shouldHighlightSymbol()
    );

    editor.revealRange(
      qpItem.range as vscode.Range,
      vscode.TextEditorRevealType.Default
    );
  }

  private getSelectionForQpItem(
    qpItem: QuickPickItem,
    shouldHighlightSymbol: boolean
  ): vscode.Selection {
    const { range } = qpItem;
    const start = new vscode.Position(
      range!.start.line,
      range!.start.character
    );
    const end = new vscode.Position(range!.end.line, range!.end.character);

    return shouldHighlightSymbol
      ? new vscode.Selection(start, end)
      : new vscode.Selection(start, start);
  }

  private getHelpItems(): QuickPickItem[] {
    const items: QuickPickItem[] = [];
    for (const kind in this.itemsFilterPhrases) {
      const filterPhrase = this.itemsFilterPhrases[kind];
      const item: QuickPickItem = this.getHelpItemForKind(kind, filterPhrase);
      items.push(item);
    }
    return items;
  }

  private getHelpItemForKind(
    symbolKind: string,
    itemFilterPhrase: string
  ): QuickPickItem {
    return {
      label: `${
        this.helpPhrase
      } Type ${itemFilterPhrase} for limit results to ${
        vscode.SymbolKind[parseInt(symbolKind)]
      } only`,
      symbolKind: Number(symbolKind),
      isHelp: true,
      uri: vscode.Uri.parse("#"),
    } as QuickPickItem;
  }

  private fetchConfig(): void {
    this.shouldUseItemsFilterPhrases = shouldUseItemsFilterPhrases();
    this.helpPhrase = getHelpPhrase();
    this.itemsFilterPhrases = getItemsFilterPhrases();
  }

  private fetchHelpData(): void {
    this.helpItems = this.getHelpItems();
  }

  private handleDidChangeValueClearing = (): void => {
    this.quickPick.items = [];
  };

  private handleDidChangeValue = (text: string): void => {
    this.shouldLoadHelpItems(text) ? this.loadItems(true) : this.loadItems();
  };

  private shouldLoadHelpItems(text: string): boolean {
    return (
      this.shouldUseItemsFilterPhrases &&
      !!this.helpPhrase &&
      text === this.helpPhrase
    );
  }

  private handleDidAccept = async (): Promise<void> => {
    const selectedItem = this.quickPick.selectedItems[0];
    selectedItem && (await this.openSelected(selectedItem));
  };

  private handleDidHide = (): void => {
    this.setText("");
  };
}

export default QuickPick;
