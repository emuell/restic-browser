import { css, html, LitElement } from 'lit'
import { customElement, property } from 'lit/decorators.js'

import '@vaadin/icons';
import '@vaadin/icon';

import '@vaadin/vaadin-lumo-styles/vaadin-iconset.js';

// -------------------------------------------------------------------------------------------------
 
// Shows a message along with an error icon

@customElement('restic-browser-spinner')
export class ResticBrowserSpinner extends LitElement {
  
  @property()
  size: string = "16px";

  @property()
  color: string = "var(--lumo-primary-text-color)";

  static styles = css`
    #spinner {
      margin: auto;
      animation: spinner 1.25s linear infinite;
    }

    @keyframes spinner {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }  
  `;

  render() {
    return html`
      <vaadin-icon
        id="spinner" 
        icon="vaadin:spinner-third"
        style="color: ${this.color}; width: ${this.size}; height: ${this.size}">
      </vaadin-icon>
    `;
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    'restic-browser-spinner': ResticBrowserSpinner
  }
}


