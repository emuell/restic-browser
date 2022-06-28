import { css, html, LitElement } from 'lit'
import { customElement } from 'lit/decorators.js'

// -------------------------------------------------------------------------------------------------
 
// File list / table.

@customElement('restoric-file-list')
export class RestoricFileList extends LitElement {
  
  static styles = css`
    #header {
      align-items: center; 
      background: var(--lumo-shade-10pct);
      padding: 8px;
    }
    #grid {
      height: inherit;
    }
  `;
 
  render() {
    const header = html`
      <vaadin-horizontal-layout id="header" style="">
        <strong style="flex: 1;">Files</strong>
      </vaadin-horizontal-layout>
    `;
    return html`
      ${header}
      <vaadin-horizontal-layout>TODO</vaadin-horizontal-layout>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'restoric-file-list': RestoricFileList
  }
}
