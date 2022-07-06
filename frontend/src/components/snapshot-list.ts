import { css, html, render } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';

import { appState } from '../states/app-state';

import { lib } from '../../wailsjs/go/models';

import { GridActiveItemChangedEvent, GridColumn, GridItemModel } from '@vaadin/grid';

import './spinner';

import '@vaadin/horizontal-layout';
import '@vaadin/grid';

// -------------------------------------------------------------------------------------------------
 
// Snapshot list / table.

@customElement('restic-browser-snapshot-list')
export class ResticBrowserSnapshotList extends MobxLitElement {
  
  @state() 
  private _selectedItems: lib.Snapshot[] = [];

  // @query("#grid")
  // private _grid!: Grid<lib.Snapshot>;

  constructor() {
    super();

    // bind this to renderers
    this._timeRenderer = this._timeRenderer.bind(this);
  }

  private _timeRenderer(
    root: HTMLElement, 
    _column: GridColumn<lib.Snapshot>, 
    model: GridItemModel<lib.Snapshot>
  ) {
    render(html`${new Date(model.item.time).toLocaleString()}`, root);
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
      margin: 0px 10px;
      padding: 8px 0px;
    }
    #loading {
      height: 100%; 
      align-items: center;
      justify-content: center;
    }
    #grid {
      height: unset;
      flex: 1;
      margin: 0px 12px;
    }
  `;
  
  render() {
    const header = html`
      <vaadin-horizontal-layout id="header" style="">
        <strong id="title">Snapshots</strong>
      </vaadin-horizontal-layout>
    `;

    if (appState.isLoadingSnapshots > 0) {
      return html`
        ${header}
        <vaadin-horizontal-layout id="loading">
          <restic-browser-spinner size="24px"></restic-browser-spinner>
        </vaadin-horizontal-layout>
      `;
    }

    return html`
      ${header}
      <vaadin-grid
        id="grid"
        theme="compact no-border" 
        .items=${appState.snapShots}
        .selectedItems=${this._selectedItems}
        @active-item-changed=${(e: GridActiveItemChangedEvent<lib.Snapshot>) => {
          const item = e.detail.value;
          appState.setNewSnapshotId(item ? item.id : "");
          this._selectedItems = item ? [item] : [];
        }}
      >
        <vaadin-grid-column .flexGrow=${0} .autoWidth=${true} path="short_id"></vaadin-grid-column>
        <vaadin-grid-column .flexGrow=${0} .autoWidth=${true} path="time" 
           .renderer=${this._timeRenderer}></vaadin-grid-column>
        <vaadin-grid-column .flexGrow=${1} path="paths"></vaadin-grid-column>
        <vaadin-grid-column .flexGrow=${1} path="tags"></vaadin-grid-column>
        <vaadin-grid-column .flexGrow=${0} path="hostname"></vaadin-grid-column>
        <!-- <vaadin-grid-column path="username"></vaadin-grid-column> -->
      </vaadin-grid>
    `;
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    'restic-browser-snapshot-list': ResticBrowserSnapshotList
  }
}
