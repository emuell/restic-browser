import { css, html, LitElement } from 'lit'
import { customElement } from 'lit/decorators.js'

import './components/file-list';
import './components/snapshot-list';

import '@vaadin/icon';
import '@vaadin/icons';
import '@vaadin/button';
import '@vaadin/vertical-layout';
import '@vaadin/horizontal-layout';

// -------------------------------------------------------------------------------------------------
 
// Main app layout.

@customElement('restoric-app')
export class RestoricApp extends LitElement {
  
  static styles = css`
    h3 {
      font-size: var(--lumo-font-size-l);
      margin-left: 20px;
      margin-right: 20px;
    }
  `;
 
  private _selectRepository() {
    console.info("Select")
  }
  render()
  {
      return html`
        <vaadin-vertical-layout style="align-items: stretch; width: 100vw;">

          <!-- Header -->
          <vaadin-horizontal-layout style="align-items: center;">
            <h3>Restoric</h3>
            <vaadin-button @click=${this._selectRepository}>Select Repository</vaadin-button>
          </vaadin-horizontal-layout>

          <!-- Snapshots -->
          <restoric-snapshot-list style="height: 200px;">Snapshots</restoric-snapshot-list>

          <!-- Contents -->
          <restoric-file-list style="height: 100%;">Contents</restoric-file-list>
        
        </vaadin-vertical-layout>
      `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'restoric-app': RestoricApp
  }
}