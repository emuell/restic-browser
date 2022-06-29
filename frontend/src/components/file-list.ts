import { css, html, render } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';
import * as mobx from 'mobx'

import '../components/error-message';

import { appState } from '../states/app-state';

import { lib } from '../../wailsjs/go/models';
import { GetFilesForPath } from '../../wailsjs/go/lib/Restoric'

import '@vaadin/grid';
import '@vaadin/text-field';
import { GridActiveItemChangedEvent, GridColumn, GridItemModel } from '@vaadin/grid';

// -------------------------------------------------------------------------------------------------
 
// File list / table.

@customElement('restoric-file-list')
export class RestoricFileList extends MobxLitElement {
  
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
    flex: 2;
   }
   #header #rootPath {
    flex: 1;
   }
    #grid {
      height: unset;
      flex: 1;
    }
  `;

  @state() 
  private _files: lib.File[] = [];

  @state()
  private _fetchError: string = "";

  @state() 
  private _selectedFiles: lib.File[] = [];
  
  @mobx.observable
  private _rootPath: string = "";

  // @query("#grid")
  // private _grid!: Grid<lib.File>;

  constructor() {
    super();

    mobx.makeObservable(this);

    // fetch file list on repo path, snapshot or root dir changes
    mobx.reaction(
      () => appState.repoPath + ":" + appState.selectedSnapshotID + ":" + this._rootPath,
      () => this._fetchFiles(),
      { delay: 100, fireImmediately: true })
  }

  private _fetchFiles() {
    if (appState.selectedSnapshotID) {
      GetFilesForPath(appState.selectedSnapshotID, this._rootPath || "/")
        .then((files) => {
          if (files instanceof Error) {
            this._fetchError = files.message;
            this._files = [];
          } else {
            this._fetchError = "";
            this._files = files || [];
            // if (this._grid) {
            //   this._grid.recalculateColumnWidths();
            // }
          }
        })
        .catch((error) => {
          this._fetchError = error.message || String(error);
          this._files = [];
        })
    } 
    else {
      this._fetchError = "No snapshot selected";
      this._files = [];
    }
  }
 
  private _modeRenderer(
    root: HTMLElement, 
    _column: GridColumn<lib.File>, 
    model: GridItemModel<lib.File>
  ) {
    render(html`${model.item.mode ? model.item.mode.toString(8) : "-"}`, root);
  } 
  private _aTimeRenderer(
    root: HTMLElement, 
    _column: GridColumn<lib.File>, 
    model: GridItemModel<lib.File>
  ) {
    render(html`${model.item.atime ? new Date(model.item.atime).toLocaleString() : "-"}`, root);
  }
  
  private _cTimeRenderer(
    root: HTMLElement, 
    _column: GridColumn<lib.File>, 
    model: GridItemModel<lib.File>
  ) {
    render(html`${model.item.ctime ? new Date(model.item.ctime).toLocaleString() : "-"}`, root);
  }
  
  private _mTimeRenderer(
    root: HTMLElement, 
    _column: GridColumn<lib.File>, 
    model: GridItemModel<lib.File>
  ) {
    render(html`${model.item.mtime ? new Date(model.item.mtime).toLocaleString() : "-"}`, root);
  }

  render() {
    const header = html`
      <vaadin-horizontal-layout id="header" style="">
        <strong id="title">Files</strong>
        <vaadin-text-field 
            id="rootPath"
            label="Root Path"    
            placeholder="/"
            theme="small"
            value=${this._rootPath} 
            .hidden=${! appState.selectedSnapshotID}
            @change=${(event: CustomEvent) => {
              this._rootPath = (event.target as HTMLInputElement).value; 
            }} 
            clear-button-visible
          >
          <vaadin-icon slot="prefix" icon="vaadin:folder"></vaadin-icon>
        </vaadin-text-field>
      </vaadin-horizontal-layout>
    `;

    if (this._fetchError) {
      return html`
        ${header}
        <restoric-error-message message=${"Failed to fetch files: " + this._fetchError}></restoric-error-message>
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
          <vaadin-grid-column .flexGrow=${1} path="name"></vaadin-grid-column>
          <vaadin-grid-column .flexGrow=${0} .autoWidth=${true} path="type"></vaadin-grid-column>
          <vaadin-grid-column .flexGrow=${1} path="path"></vaadin-grid-column>
          <vaadin-grid-column .flexGrow=${0} .autoWidth=${true} path="size"></vaadin-grid-column>
          <vaadin-grid-column .flexGrow=${0} .autoWidth=${true} path="mode"
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

declare global {
  interface HTMLElementTagNameMap {
    'restoric-file-list': RestoricFileList
  }
}
