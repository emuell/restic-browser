import { css, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';

import { appState } from '../states/app-state';

import { lib } from '../../wailsjs/go/models';

import { GridActiveItemChangedEvent } from '@vaadin/grid';

import '@vaadin/horizontal-layout';
import '@vaadin/grid';

// -------------------------------------------------------------------------------------------------
 
// Snapshot list / table.

@customElement('restoric-snapshot-list')
export class RestoricSnapshotList extends MobxLitElement {
  
  static styles = css`
    #header {
      align-items: center; 
      background: var(--lumo-shade-10pct);
      padding: 8px;
    }
    #grid {
      height: 25vh;
    }
  `;
  
  @state() 
  private _selectedItems: lib.Snapshot[] = [];

  firstUpdated() {
    this._selectedItems = appState.snapShots.length ? 
      [appState.snapShots[0]] : [];
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
          appState.selectedSnapshotID = item ? item.short_id : "";
          this._selectedItems = item ? [item] : [];
        }}
      >
        <vaadin-grid-column path="short_id"></vaadin-grid-column>
        <vaadin-grid-column path="time"></vaadin-grid-column>
        <vaadin-grid-column path="paths"></vaadin-grid-column>
        <vaadin-grid-column path="hostname"></vaadin-grid-column>
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
