import { css, html } from 'lit'
import { customElement } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';

import { appState } from '../states/app-state';

import { lib } from '../../wailsjs/go/models';

import '@vaadin/grid';
import { GridActiveItemChangedEvent } from '@vaadin/grid';

// -------------------------------------------------------------------------------------------------
 
// Snapshot list / table.

@customElement('restoric-snapshot-list')
export class RestoricSnapshotList extends MobxLitElement {
  
  static styles = css`
    #grid {
      height: inherit;
    }
  `;
  
  render() {
    return html`
      <vaadin-grid
        id="grid"
        theme="compact dark" 
        .items=${appState.snapShots}
        .selectedItems=${[]}
        @active-item-changed=${(e: GridActiveItemChangedEvent<lib.Snapshot>) => {
          const item = e.detail.value;
          appState.selectedSnapshotID = item ? item.short_id : "";
        }}
      >
        <vaadin-grid-column path="short_id"></vaadin-grid-column>
        <vaadin-grid-column path="paths"></vaadin-grid-column>
        <vaadin-grid-column path="hostname"></vaadin-grid-column>
        <!-- <vaadin-grid-column path="username"></vaadin-grid-column> -->
        <vaadin-grid-column path="uid"></vaadin-grid-column>
        <vaadin-grid-column path="gid"></vaadin-grid-column>
      </vaadin-grid>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'restoric-snapshot-list': RestoricSnapshotList
  }
}
