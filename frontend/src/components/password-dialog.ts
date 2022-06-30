import { html, LitElement, render } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { guard } from 'lit/directives/guard.js'

import { appState } from '../states/app-state';

import '@vaadin/dialog';
import '@vaadin/password-field';

// -------------------------------------------------------------------------------------------------
 
// Modal dialog to set appState.repoPassword 

@customElement('restic-browser-password-dialog')
export class ResticBrowserPasswordDialog extends LitElement {
  
  @property()
  onClose!: () => void;

  @property()
  onCancel!: () => void;
 
  @state()
  _handledClose: boolean = false;

  render() {
    const dialogLayout = html`
      <vaadin-vertical-layout style="align-items: stretch; width: 24rem; max-width: 100%;">
        <vaadin-password-field 
          autofocus
          @change=${(event: CustomEvent) => {
            appState.repoPass = (event.target as HTMLInputElement).value; 
            this._handledClose = true;
            this.onClose();
          }}
          label="Password"
        ></vaadin-password-field>
      </vaadin-vertical-layout>
    `;

    const footerLayout = html`
      <vaadin-button @click="${() => { 
          this._handledClose = true;
          this.onCancel(); 
        }}">
        Cancel 
      </vaadin-button>
      <vaadin-button theme="primary" @click="${() => { 
          this._handledClose = true;
          this.onClose();
      }}">
        Okay
      </vaadin-button>
    `;

    return html`
      <vaadin-dialog
        header-title="Respository Password"
        .opened=${true}
        @opened-changed=${(event: CustomEvent) => {
          if (! event.detail.value && ! this._handledClose) {
            this.onCancel();
          } 
        }}
        .footerRenderer="${guard([], () => (root: HTMLElement) => {
          render(footerLayout, root);
        })}"
        .renderer="${guard([], () => (root: HTMLElement) => {
          render(dialogLayout, root);
        })}"
      ></vaadin-dialog>
    `;
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    'restic-browser-password-dialog': ResticBrowserPasswordDialog
  }
}
