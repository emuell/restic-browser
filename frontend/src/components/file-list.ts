import { css, html, LitElement } from 'lit'
import { customElement } from 'lit/decorators.js'

// -------------------------------------------------------------------------------------------------
 
// File list / table.

@customElement('restoric-file-list')
export class RestoricFileList extends LitElement {
  
  static styles = css`
  `;
 
  render()
  {
    return html`
      Files
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'restoric-file-list': RestoricFileList
  }
}
