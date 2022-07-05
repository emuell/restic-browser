import { css, html, render } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';
import prettyBytes from 'pretty-bytes';
import * as mobx from 'mobx'

import { GridActiveItemChangedEvent, GridColumn, GridItemModel } from '@vaadin/grid';
import { Notification } from '@vaadin/notification';

import '../components/error-message';

import { appState } from '../states/app-state';

import { lib } from '../../wailsjs/go/models';
import { GetFilesForPath, DumpFile, DumpFileToTemp, OpenFileOrUrl } 
  from '../../wailsjs/go/lib/ResticBrowserApp';

import '@vaadin/grid';
import '@vaadin/text-field';
import '@vaadin/button';
import '@vaadin/notification';

// -------------------------------------------------------------------------------------------------
 
// File list / table.

@customElement('restic-browser-file-list')
export class ResticBrowserFileList extends MobxLitElement {
  
  @state() 
  private _files: lib.File[] = [];
  
  @state()
  private _fetchError: string = "";

  @state()
  private _isFetching: boolean = false;
  
  @state() 
  private _selectedFiles: lib.File[] = [];
  
  @mobx.observable
  private _rootPath: string = "";

  // @query("#grid")
  // private _grid!: Grid<lib.File>;

  constructor() {
    super();
    mobx.makeObservable(this);

    // fetch file list on repo path, snapshot or root dir changes - debounced
    mobx.reaction(
      () => appState.repoLocation.type + ":" + appState.repoLocation.path + ":" + 
              appState.selectedSnapshotID + ":" + this._rootPath,
      () => this._fetchFiles(),
      { fireImmediately: true })

    // bind context for renderers
    this._pathRenderer = this._pathRenderer.bind(this);
    this._modeRenderer = this._modeRenderer.bind(this);
    this._cTimeRenderer = this._cTimeRenderer.bind(this);
    this._mTimeRenderer = this._mTimeRenderer.bind(this);
    this._aTimeRenderer = this._aTimeRenderer.bind(this);
  }

  @mobx.action
  private _setRootPath(newPath: string): void {
    this._rootPath = newPath;
  }

  private _openFile(file: lib.File): void {
    DumpFileToTemp(appState.selectedSnapshotID, file)
      .then((path) => { 
        if (path instanceof Error) {
          throw path;
        }
        OpenFileOrUrl(path)
          .catch(_err => {
            // ignore
          })
      })
      .catch((err) => { 
        Notification.show(`Failed to restore file: ${err.message || err}`, {
          position: 'middle',
          theme: "error"
        });
      });
  }

  private _dumpFile(file: lib.File): void {
    DumpFile(appState.selectedSnapshotID, file)
      .then((path) => { 
        if (path instanceof Error) {
          throw path;
        }
        if (path) {
          Notification.show(`Successfully restored to: '${path}'`, {
            position: 'bottom-center',
            theme: "info"
          });
        }
      })
      .catch((err) => { 
        Notification.show(`Restore operation failed: ${err.message || err}`, {
          position: 'middle',
          theme: "error"
        });
      });
  }

  private _parentRootPath(): string | undefined {
    let rootPath = this._rootPath.trim();
    if (rootPath && rootPath != "/") {
      if (rootPath.endsWith("/")) {
        rootPath = rootPath.substring(0, rootPath.length - 1);
      }
      return rootPath.substring(0, rootPath.lastIndexOf("/")) || "/";
    }
    return undefined;
  }
  
  private _fetchFiles() {
    if (appState.selectedSnapshotID) {
      this._isFetching = true;
      GetFilesForPath(appState.selectedSnapshotID, this._rootPath || "/")
        .then((files) => {
          if (files instanceof Error) {
            throw files;
          } 
          // remove . entry
          files = files.filter((f) => f.path !== this._rootPath);
          // add .. entry
          const parentRootPath = this._parentRootPath();
          if (parentRootPath) {
            files.push({name: "..", type: "dir", path: parentRootPath})
          }
          // assign and sort
          this._files = files;
          this._applyColumnSorting();
          // reset error - if any
          this._fetchError = "";
          this._isFetching = false;
        })
        .catch((error) => {
          this._fetchError = error.message || String(error);
          this._files = [];
          this._isFetching = false;
        })
    }
    else {
      this._fetchError = "No snapshot selected";
      this._files = [];
    }
  }

  private _applyColumnSorting() {
    this._files.sort((a, b) => {
      if (a.type === "dir" && b.type !== "dir") {
        return -1;
      } 
      else if (a.type !== "dir" && b.type === "dir") {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  private _pathRenderer(
    root: HTMLElement, 
    _column: GridColumn<lib.File>, 
    model: GridItemModel<lib.File>
  ) {
    const downloadButton = html`
      <vaadin-button theme="small secondary icon" style="height: 1.5rem; margin: unset;"
          @click=${() => this._dumpFile(model.item)}>
        <vaadin-icon icon="vaadin:download"></vaadin-icon>
      </vaadin-button>
    `;
    if (model.item.type === "dir") {
      const setRootpathButton = html`
        <vaadin-button theme="small primary icon" style="height: 1.5rem; margin: unset;" 
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
          <vaadin-button theme="small secondary icon" style="height: 1.5rem; margin: unset;" 
              @click=${() => this._openFile(model.item)}>
            <vaadin-icon icon="lumo:eye"></vaadin-icon>
          </vaadin-button>
          ${downloadButton}
        `, root)
    }     
  }
  
  private _sizeRenderer(
    root: HTMLElement, 
    _column: GridColumn<lib.File>, 
    model: GridItemModel<lib.File>
  ) {
    render(html`
        ${model.item.size ? prettyBytes(model.item.size) : "-"}
      `, root);
  }

  private _modeRenderer(
    root: HTMLElement, 
    _column: GridColumn<lib.File>, 
    model: GridItemModel<lib.File>
  ) {
    render(html`
        ${model.item.mode ? (model.item.mode & 0xFFFF).toString(8) : "-"}
      `, root);
  } 
  
  private _aTimeRenderer(
    root: HTMLElement, 
    _column: GridColumn<lib.File>, 
    model: GridItemModel<lib.File>
  ) {
    render(html`
        ${model.item.atime ? new Date(model.item.atime).toLocaleString() : "-"}
      `, root);
  }
  
  private _cTimeRenderer(
    root: HTMLElement, 
    _column: GridColumn<lib.File>, 
    model: GridItemModel<lib.File>
  ) {
    render(html`
        ${model.item.ctime ? new Date(model.item.ctime).toLocaleString() : "-"}
      `, root);
  }
  
  private _mTimeRenderer(
    root: HTMLElement, 
    _column: GridColumn<lib.File>, 
    model: GridItemModel<lib.File>
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
      padding: 8px;
    }
    #header #title {
      flex: 0;
      margin: 0px 10px;
      padding: 8px 0px;
     }
     #header #rootPath {
      flex: 1;
      padding: unset;
      padding-left: 4px;
      padding-right: 8px;
     }
     #grid {
      height: unset;
      flex: 1;
      margin: 0px 12px;
    }
  `;

  render() {
    const header = html`
      <vaadin-horizontal-layout id="header">
        <strong id="title">Files</strong>
        <vaadin-button id="rootPathButton" theme="icon small secondary" 
            @click=${() => this._setRootPath(this._parentRootPath() || "/")}
            .disabled=${! this._parentRootPath()}
            .hidden=${! appState.selectedSnapshotID}>
          <vaadin-icon icon="vaadin:level-up"></vaadin-icon>
        </vaadin-button>
        <vaadin-text-field 
          id="rootPath"
          theme="small"
          placeholder="/"
          value=${this._rootPath} 
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

    if (this._fetchError && ! this._isFetching) {
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
    else {
      return html`
        ${header}
        <vaadin-grid
          id="grid"
          theme="compact no-border small" 
          .items=${this._files}
          .selectedItems=${this._selectedFiles}
          @active-item-changed=${(e: GridActiveItemChangedEvent<lib.File>) => {
            const item = e.detail.value;
            this._selectedFiles = item ? [item] : [];
          }}
        >
          <vaadin-grid-column .flexGrow=${0} .autoWidth=${true} path="path" 
            .renderer=${this._pathRenderer}></vaadin-grid-column>
          <vaadin-grid-column .flexGrow=${1} path="name"></vaadin-grid-column>
          <vaadin-grid-column .flexGrow=${0} .width=${"6rem"} path="size"
            .renderer=${this._sizeRenderer}></vaadin-grid-column>
          <vaadin-grid-column .flexGrow=${0} .width=${"6rem"} path="mode"
            .renderer=${this._modeRenderer}></vaadin-grid-column>
          <vaadin-grid-column .flexGrow=${0} .autoWidth=${true} path="mtime" 
            .renderer=${this._mTimeRenderer}></vaadin-grid-column>
          <vaadin-grid-column .flexGrow=${0} .autoWidth=${true} path="atime" 
            .renderer=${this._aTimeRenderer}></vaadin-grid-column>
          <vaadin-grid-column .flexGrow=${0} .autoWidth=${true} path="ctime" 
            .renderer=${this._cTimeRenderer}></vaadin-grid-column>
        </vaadin-grid>         
      `;
    }
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    'restic-browser-file-list': ResticBrowserFileList
  }
}
