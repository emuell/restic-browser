import { css, html, PropertyValues, render } from 'lit'
import { customElement, query, state } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';
import prettyBytes from 'pretty-bytes';
import * as mobx from 'mobx'

import { 
  Grid, GridActiveItemChangedEvent, GridColumn, GridItemModel,
  GridDataProviderCallback, GridDataProviderParams, GridSorterDefinition
} from '@vaadin/grid';

import { Notification } from '@vaadin/notification';

import { restic } from '../../wailsjs/go/models';

import { OpenFileOrUrl } from '../../wailsjs/go/main/ResticBrowserApp';

import { appState } from '../states/app-state';

import './error-message';
import './spinner';

import '@vaadin/grid';
import '@vaadin/grid/vaadin-grid-sort-column.js';
import '@vaadin/text-field';
import '@vaadin/button';
import '@vaadin/notification';

// -------------------------------------------------------------------------------------------------
 
// File list / table.

@customElement('restic-browser-file-list')
export class ResticBrowserFileList extends MobxLitElement {
  
  @mobx.observable
  private _rootPath: string = "";
  
  // NB: not a state or observable: data-provider update is manually triggered 
  private _files: restic.File[] = [];
  
  @state()
  private _fetchError: string = "";

  @state() 
  private _selectedFiles: restic.File[] = [];  
  private _selectedItemsClicked = new Set<string>();

  @query("#grid")
  private _grid!: Grid<restic.File> | null;
  private _recalculateColumnWidths: boolean = false;

  constructor() {
    super();
    mobx.makeObservable(this);

    // fetch file list on repo path, snapshot or root dir changes
    mobx.reaction(
      () => appState.repoLocation.type + ":" + appState.repoLocation.path + ":" + 
              appState.selectedSnapshotID + ":" + this._rootPath,
      () => this._fetchFiles(),
      { fireImmediately: true }
    );

    // bind context for renderers
    this._pathRenderer = this._pathRenderer.bind(this);
    this._nameRenderer = this._nameRenderer.bind(this);
    this._modeRenderer = this._modeRenderer.bind(this);
    this._cTimeRenderer = this._cTimeRenderer.bind(this);
    this._mTimeRenderer = this._mTimeRenderer.bind(this);
    this._aTimeRenderer = this._aTimeRenderer.bind(this);
    // bind context for data provider
    this._dataProvider = this._dataProvider.bind(this);
  }

  @mobx.action
  private _setRootPath(newPath: string): void {
    this._rootPath = newPath;
  }

  private _openFile(file: restic.File): void {
    appState.openFile(file)
      .catch((err) => { 
        Notification.show(`Failed to restore file: ${err.message || err}`, {
          position: 'middle',
          theme: "error"
        });
      });
  }

  private _dumpFile(file: restic.File): void {
    appState.dumpFile(file)
      .then((path) => { 
        if (path) {
          Notification.show(
            html`<p>
              Successfully restored '${file.name}' to 
                <a href=${path} @click=${(e: Event) => { 
                    e.preventDefault()
                    OpenFileOrUrl(path)
                      .catch(_err => { 
                        // ignore 
                      })
                  }}>
                  ${path}
                </a>
             </p>`,
            {
              position: 'bottom-center',
              duration: 10000,
              theme: "info"
            }
          );
        }
      })
      .catch((err) => { 
        Notification.show(`Restore operation of '${file.name}' failed: ${err.message || err}`, {
          position: 'middle',
          theme: "error"
        });
      });
  }

  private _parentRootPath(path: string): string | undefined {
    let rootPath = path.trim();
    if (rootPath && rootPath != "/") {
      if (rootPath.endsWith("/")) {
        rootPath = rootPath.substring(0, rootPath.length - 1);
      }
      return rootPath.substring(0, rootPath.lastIndexOf("/")) || "/";
    }
    return undefined;
  }
  
  private _fetchFiles() {
    if (! appState.selectedSnapshotID) {
      this._fetchError = "No snapshot selected";
      this._selectedFiles = [];
      this._files = [];
      return;
    }
    // memorize rootpath we're fetching files for
    const rootPath = this._rootPath;
    appState.fetchFiles(rootPath)
      .then((files) => {
        const normalizedRootPath = rootPath.replace(/\\/g, "/");
        // remove . entry
        files = files.filter((f) => f.path.replace(/\\/g, "/") !== normalizedRootPath);
        // add .. entry
        const parentRootPath = this._parentRootPath(rootPath)
        if (parentRootPath) {
          files.push({name: "..", type: "dir", path: parentRootPath})
        }
        // assign and request data provider update
        this._selectedFiles = [];
        this._files = files;
        if (this._grid) {
          this._grid.clearCache();
        }
        // request auto column width update
        this._recalculateColumnWidths = true;
        // reset fetch errors - if any
        this._fetchError = "";
      })
      .catch((error) => {
        this._fetchError = error.message || String(error);
        this._selectedFiles = [];
        this._files = [];
      })
  }

  private _sortFiles(params: GridDataProviderParams<restic.File>): restic.File[] {

    // sorting helper functions, copied from @vaadin-grid/array-data-provider.js
    function normalizeEmptyValue(value: any) {
      if ([undefined, null].includes(value)) {
        return '';
      } else if (isNaN(value)) {
        return value.toString();
      }
      return value;
    }
    function compare(a: any, b: any) {
      a = normalizeEmptyValue(a);
      b = normalizeEmptyValue(b);

      if (a < b) {
        return -1;
      }
      if (a > b) {
        return 1;
      }
      return 0;
    }
    function get(path: string, object: any) {
      return path.split('.').reduce((obj, property) => obj[property], object);
    }

    // get sort order (multi sorting not supported ATM)
    let sortOrder: GridSorterDefinition = {
      path: "name",
      direction: "asc"
    };
    if (params.sortOrders && params.sortOrders.length) {
      if (params.sortOrders[0].direction) {
        sortOrder = params.sortOrders[0];
      }
    }

    // get items from files and apply our customized sorting
    const items = Array.from(this._files);
    items.sort((a: restic.File, b: restic.File) => {
      // always keep .. item at top
      if (a.type === "dir" && a.name == "..") {
        return -1;
      } else if (b.type === "dir" && b.name == "..") {
        return 1;
      }
      // keep directories at top or bottom when sorting by name
      if (sortOrder.path === "name") {
        if (a.type === "dir" && b.type !== "dir") {
          return (sortOrder.direction === "asc") ? -1 : 1;
        } else if (a.type !== "dir" && b.type === "dir") {
          return (sortOrder.direction === "asc") ? 1 : -1;
        }
        // and do a "natural" sort on names
        const options = { numeric: true, sensitivity: "base" };
        if (sortOrder.direction === 'asc') {
          return a.name.localeCompare(b.name, undefined, options);
        } else { 
          return b.name.localeCompare(a.name, undefined, options);
        }
      } else {
        // apply custom sorting 
        if (sortOrder.direction === 'asc') {
          return compare(get(sortOrder.path, a), get(sortOrder.path, b));
        } else { 
          return compare(get(sortOrder.path, b), get(sortOrder.path, a));
        }
      }
    });
  
    return items;
  }

  private _dataProvider(
    params: GridDataProviderParams<restic.File>,
    callback: GridDataProviderCallback<restic.File>
  ) {
    const items = this._sortFiles(params);
    const count = Math.min(items.length, params.pageSize);
    const start = params.page * count;
    const end = start + count;
    if (start !== 0 || end !== items.length) {
      callback(items.slice(start, end), items.length);
    } else {
      callback(items, items.length);
    }
  }

  private _activeItemChanged(e: GridActiveItemChangedEvent<restic.File>) {
    const item = e.detail.value;
    // don't deselect selected itesm
    if (item) {
      this._selectedFiles = [item];
    }
    // double click handling
    const doubleClickItem = this._selectedFiles.length ?
      this._selectedFiles[0] : undefined;
    if (doubleClickItem) {
      if (this._selectedItemsClicked.has(doubleClickItem.path)) {
        if (doubleClickItem.type === "dir") {
          this._setRootPath(doubleClickItem.path);
        } else {
          this._openFile(doubleClickItem); 
        }
      }
      this._selectedItemsClicked.add(doubleClickItem.path);
      setTimeout(() => {
        this._selectedItemsClicked.delete(doubleClickItem.path);
      }, 500);
    }
  }

  private _pathRenderer(
    root: HTMLElement, 
    _column: GridColumn<restic.File>, 
    model: GridItemModel<restic.File>
  ) {
    const downloadButton = html`
      <vaadin-button theme="small secondary icon" style="height: 1.5rem; margin: unset; padding: 0;"
          @click=${() => this._dumpFile(model.item)}>
        <vaadin-icon icon="vaadin:download"></vaadin-icon>
      </vaadin-button>
    `;
    if (model.item.type === "dir") {
      const setRootpathButton = html`
        <vaadin-button theme="small primary icon" style="height: 1.5rem; margin: unset; padding: 0;" 
          @click=${() => this._setRootPath(model.item.path)}>
          <vaadin-icon icon="vaadin:level-right"></vaadin-icon>
        </vaadin-button>
      `;
      if (model.item.name == "..") {
        render(html`
            ${setRootpathButton}
          `, root);
      } else {
        render(html`
            ${setRootpathButton}
            ${downloadButton}
          `, root);
      }
    } else {
      render(html`
          <vaadin-button theme="small secondary icon" style="height: 1.5rem; margin: unset;padding: 0;" 
              @click=${() => this._openFile(model.item)}>
            <vaadin-icon icon="lumo:eye"></vaadin-icon>
          </vaadin-button>
          ${downloadButton}
        `, root)
    }     
  }
  
  private _nameRenderer(
    root: HTMLElement, 
    _column: GridColumn<restic.File>, 
    model: GridItemModel<restic.File>
  ) {
    if (model.item.type === "dir") {
      render(html`
          <vaadin-button theme="small tertiary icon" 
              style="height: 1.25rem; margin: unset; padding: 0;">
            <vaadin-icon icon="vaadin:folder"
              style="margin-bottom: 2px; color: var(--lumo-contrast-50pct);">
            </vaadin-icon>
          </vaadin-button>
          ${model.item.name}
        `, root);
    } else{
      render(html`${model.item.name}`, root);
    }
  }
  
  private _sizeRenderer(
    root: HTMLElement, 
    _column: GridColumn<restic.File>, 
    model: GridItemModel<restic.File>
  ) {
    render(html`
        ${model.item.size ? prettyBytes(model.item.size) : "-"}
      `, root);
  }

  private _modeRenderer(
    root: HTMLElement, 
    _column: GridColumn<restic.File>, 
    model: GridItemModel<restic.File>
  ) {
    render(html`
        ${model.item.mode ? (model.item.mode & 0xFFFF).toString(8) : "-"}
      `, root);
  } 
  
  private _aTimeRenderer(
    root: HTMLElement, 
    _column: GridColumn<restic.File>, 
    model: GridItemModel<restic.File>
  ) {
    render(html`
        ${model.item.atime ? new Date(model.item.atime).toLocaleString() : "-"}
      `, root);
  }
  
  private _cTimeRenderer(
    root: HTMLElement, 
    _column: GridColumn<restic.File>, 
    model: GridItemModel<restic.File>
  ) {
    render(html`
        ${model.item.ctime ? new Date(model.item.ctime).toLocaleString() : "-"}
      `, root);
  }
  
  private _mTimeRenderer(
    root: HTMLElement, 
    _column: GridColumn<restic.File>, 
    model: GridItemModel<restic.File>
  ) {
    render(html`
        ${model.item.mtime ? new Date(model.item.mtime).toLocaleString() : "-"}
      `, root);
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
    }
    #header {
      align-items: center; 
      background: var(--lumo-shade-10pct);
      padding: 4px;
    }
    #header #title {
      flex: 0;
      margin: 0px 10px;
      padding: 4px 0px;
     }
    #header #rootPath {
      flex: 1;
      padding: unset;
      padding-left: 4px;
      padding-right: 4px;
    }
    #loading {
      height: 100%; 
      align-items: center;
      justify-content: center;
    }
    #grid {
      height: unset;
      flex: 1;
      margin: 0px 8px;
    }
  `;

  updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    // apply auto column width updates after content got rendered
    if (this._recalculateColumnWidths) {
      this._recalculateColumnWidths = false;
      if (this._grid) {
        this._grid.recalculateColumnWidths();
      }
    }
  }

  render() {
    const header = html`
      <vaadin-horizontal-layout id="header">
        <strong id="title">Files</strong>
        <vaadin-button id="rootPathButton" theme="icon small secondary" 
            @click=${() => this._setRootPath(this._parentRootPath(this._rootPath) || "/")}
            .disabled=${! this._parentRootPath(this._rootPath)}
            .hidden=${! appState.selectedSnapshotID}>
          ${appState.isLoadingFiles 
              ? html`<restic-browser-spinner size="16px" style="margin: 0 2px;"></restic-browser-spinner>` 
              : html`<vaadin-icon icon="vaadin:level-up"></vaadin-icon>`}
        </vaadin-button>
        <vaadin-text-field 
          id="rootPath"
          theme="small"
          placeholder="/"
          value=${this._rootPath}
          .disabled=${appState.isLoadingFiles > 0} 
          .hidden=${! appState.selectedSnapshotID}
          @change=${(event: CustomEvent) => {
            this._setRootPath((event.target as HTMLInputElement).value); 
          }} 
          clear-button-visible
        >
          <vaadin-icon slot="prefix" icon="vaadin:folder"></vaadin-icon>
        </vaadin-text-field>
      </vaadin-horizontal-layout>
    `;

    if (this._fetchError && appState.isLoadingFiles === 0) {
      let errorMessage = this._fetchError;
      if (appState.selectedSnapshotID) {
       errorMessage = "Failed to fetch files: " + errorMessage;
      }
      return html`
        ${header}
        <restic-browser-error-message 
          type=${appState.selectedSnapshotID ? "error" : "info"}
          message=${errorMessage}>
        </restic-browser-error-message>
      `;
    }
    
    return html`
      ${header}
      <vaadin-grid
        id="grid"
        theme="compact no-border small" 
        .dataProvider=${this._dataProvider}
        .selectedItems=${this._selectedFiles}
        @active-item-changed=${this._activeItemChanged}
      >
        <vaadin-grid-column .flexGrow=${0} .autoWidth=${true} path="path" header=""
          .renderer=${this._pathRenderer}></vaadin-grid-column>
          <vaadin-grid-sort-column .flexGrow=${1} path="name" direction="asc"
          .renderer=${this._nameRenderer}></vaadin-grid-sort-column>
        <vaadin-grid-sort-column .flexGrow=${0} .width=${"6rem"} path="size"
          .renderer=${this._sizeRenderer}></vaadin-grid-sort-column>
        <vaadin-grid-sort-column .flexGrow=${0} .width=${"6rem"} path="mode"
          .renderer=${this._modeRenderer}></vaadin-grid-sort-column>
        <vaadin-grid-sort-column .flexGrow=${0} .autoWidth=${true} path="mtime" 
          .renderer=${this._mTimeRenderer}></vaadin-grid-sort-column>
        <vaadin-grid-sort-column .flexGrow=${0} .autoWidth=${true} path="atime" 
          .renderer=${this._aTimeRenderer}></vaadin-grid-sort-column>
        <vaadin-grid-sort-column .flexGrow=${0} .autoWidth=${true} path="ctime" 
          .renderer=${this._cTimeRenderer}></vaadin-grid-sort-column>
      </vaadin-grid>
    `;
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    'restic-browser-file-list': ResticBrowserFileList
  }
}
