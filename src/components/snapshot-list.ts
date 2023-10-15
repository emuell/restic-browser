import { css, html, PropertyValues, render } from 'lit'
import { customElement, query, state } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';
import * as mobx from 'mobx';

import { appState } from '../states/app-state';
import { restic } from '../backend/restic';

import { 
  Grid, GridActiveItemChangedEvent, GridCellFocusEvent, GridColumn, GridItemModel 
} from '@vaadin/grid';

import './spinner';

import '@vaadin/horizontal-layout';
import '@vaadin/grid';
import '@vaadin/grid/vaadin-grid-sort-column.js';

// -------------------------------------------------------------------------------------------------
 
// Snapshot list / table.

@customElement('restic-browser-snapshot-list')
export class ResticBrowserSnapshotList extends MobxLitElement {
  
  @state() 
  private _selectedItems: restic.Snapshot[] = [];

  @query("#grid")
  private _grid!: Grid<restic.Snapshot> | null;
  private _recalculateColumnWidths: boolean = false;

  constructor() {
    super();

    // request auto column width update on snapshot changes
    mobx.reaction(
      () => appState.snapShots, 
      () => {
        this._recalculateColumnWidths = true;
      }, 
      { fireImmediately: true }
    );
   
    // sync selection changes with appState
    const updateGridSelectionFromAppState = () => {
      const selectedSnapshot = appState.snapShots.find(v => v.id == appState.selectedSnapshotID);
      if (selectedSnapshot) {
        this._selectedItems = [selectedSnapshot];
      }
    };
    mobx.reaction(
      () => appState.selectedSnapshotID, 
      () => {
        // when switching snapshot ids, update the selection in our grid
       updateGridSelectionFromAppState(); 
      }, 
      { fireImmediately: true }
    );    
    mobx.reaction(
      () => appState.isLoadingSnapshots > 0, 
      (isLoading: boolean) => {
        // when loading finished, this is the first time the grid actually is shown
        if (!isLoading) {
          updateGridSelectionFromAppState();
        }
      }, 
      { fireImmediately: false }
    );
    
    // bind this to renderers
    this._timeRenderer = this._timeRenderer.bind(this);
  }

  private _activeItemChanged(e: GridActiveItemChangedEvent<restic.Snapshot>) {
    const item = e.detail.value;
    // don't deselect selected itesm
    if (item) {
      this._selectedItems = [item];
      appState.setNewSnapshotId(item.id);
    }
  }

  private _cellFocusChanged(event: GridCellFocusEvent<restic.Snapshot>) {
    // auto-select rows on cell focus navigation
    if (event.detail.context?.item) {
      this._selectedItems = [event.detail.context.item];
      appState.setNewSnapshotId(event.detail.context.item.id);
    }
  }
  
  private _timeRenderer(
    root: HTMLElement, 
    _column: GridColumn<restic.Snapshot>, 
    model: GridItemModel<restic.Snapshot>
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
      padding: 4px;
    }
    #header #title {
      margin: 0px 10px;
      padding: 4px 0px;
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
        @active-item-changed=${this._activeItemChanged}
        @cell-focus=${this._cellFocusChanged}
      >
        <vaadin-grid-column .flexGrow=${0} .autoWidth=${true} path="short_id"></vaadin-grid-column>
        <vaadin-grid-sort-column .flexGrow=${0} .autoWidth=${true} path="time" 
           .renderer=${this._timeRenderer} direction="asc"></vaadin-grid-sort-column>
        <vaadin-grid-sort-column .flexGrow=${1} path="paths"></vaadin-grid-sort-column>
        <vaadin-grid-sort-column .flexGrow=${1} path="tags"></vaadin-grid-sort-column>
        <vaadin-grid-sort-column .flexGrow=${0} .autoWidth=${true} path="hostname"></vaadin-grid-sort-column>
        <!-- <vaadin-grid-sort-column path="username"></vaadin-grid-sort-column> -->
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
