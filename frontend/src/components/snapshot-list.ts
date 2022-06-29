import { css, html, render } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';

import { appState } from '../states/app-state';

import { lib } from '../../wailsjs/go/models';

import { GridActiveItemChangedEvent, GridColumn, GridItemModel } from '@vaadin/grid';

import '@vaadin/horizontal-layout';
import '@vaadin/grid';

// -------------------------------------------------------------------------------------------------
 
// Snapshot list / table.

@customElement('restoric-snapshot-list')
export class RestoricSnapshotList extends MobxLitElement {
  
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
    #grid {
      height: unset;
      flex: 1;
    }
  `;
  
  @state() 
  private _selectedItems: lib.Snapshot[] = [];

  // @query("#grid")
  // private _grid!: Grid<lib.Snapshot>;

  constructor() {
    super();

    // mobx.reaction(
    //   () => appState.snapShots, 
    //   () => {
    //     if (this._grid) {
    //       this._grid.recalculateColumnWidths();
    //     }
    //   }
    // );
  }

  firstUpdated() {
    this._selectedItems = appState.snapShots.length ? 
      [appState.snapShots[0]] : [];
  }
 
  private _timeRenderer(
    root: HTMLElement, 
    _column: GridColumn<lib.Snapshot>, 
    model: GridItemModel<lib.Snapshot>
  ) {
    render(html`${new Date(model.item.time).toLocaleString()}`, root);
  }

  render() {
    const header = html`
      <vaadin-horizontal-layout id="header" style="">
        <strong style="flex: 1;">Snapshots</strong>
      </vaadin-horizontal-layout>
    `;

    return html`
      ${header}
      <vaadin-grid
        id="grid"
        theme="compact no-border" 
        .items=${appState.snapShots}
        .selectedItems=${this._selectedItems}
        @active-item-changed=${(e: GridActiveItemChangedEvent<lib.Snapshot>) => {
          const item = e.detail.value;
          appState.selectedSnapshotID = item ? item.id : "";
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

declare global {
  interface HTMLElementTagNameMap {
    'restoric-snapshot-list': RestoricSnapshotList
  }
}
