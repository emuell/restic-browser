import { css, html, LitElement } from 'lit'
import { customElement } from 'lit/decorators.js'

// -------------------------------------------------------------------------------------------------
 
// Snapshot list / table.

@customElement('restoric-snapshot-list')
export class RestoricSnapshotList extends LitElement {
  
  static styles = css`
  `;
 
  render()
  {
      return html`
        Snapshots
      `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'restoric-snapshot-list': RestoricSnapshotList
  }
}