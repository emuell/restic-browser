import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { dialogFooterRenderer, dialogRenderer } from '@vaadin/dialog/lit.js';

import '@vaadin/dialog';
import '@vaadin/horizontal-layout';
import '@vaadin/button';

// -------------------------------------------------------------------------------------------------

/**
 * Modal dialog to query a name and save options for a new location preset.
 */

@customElement('restic-browser-location-save-preset-dialog')
export class ResticBrowserLocationSavePresetDialog extends LitElement {

  // optional custom label for the password field: by default "Password".
  @property()
  onClose!: (name: string, savePasswords: boolean) => boolean;

  // called when the dialog's 'Cancel' button was invoked or the dialog got cancelled.
  @property()
  onCancel!: () => void;

  private _name: string = "";
  private _savePasswords: boolean = false;
  
  private _handledClose: boolean = false;

  constructor() {
    super();
    
    // bind this to all callbacks
    this._handleDialogClose = this._handleDialogClose.bind(this);
    this._handleDialogCancel = this._handleDialogCancel.bind(this);
  }

  render() {
    const dialogLayout = html`
      <vaadin-vertical-layout id="dialogContent">
        <vaadin-text-field 
          label="Preset Name"
          style="width: 100%;"
          required
          autofocus
          value=${this._name}
          @change=${(event: CustomEvent) => {
            this._name = (event.target as HTMLInputElement).value;
          }}
        ></vaadin-text-field>
        <vaadin-checkbox 
          id="checkbox" 
          label="Save Password (not recommended)"
          .checked=${this._savePasswords}
          @change=${(event: CustomEvent) => {
            this._savePasswords = (event.target as HTMLInputElement).checked;
          }}
          ></vaadin-checkbox>
      </vaadin-vertical-layout>
    `;

    const footerLayout = html`
      <vaadin-horizontal-layout id="footerContent">
        <div style="flex-grow: 1"></div>
        <vaadin-button @click=${this._handleDialogCancel}>
          Cancel 
        </vaadin-button>
        <div style="width: 0.5rem"></div>
        <vaadin-button theme="primary" @click=${this._handleDialogClose}>
          Okay
        </vaadin-button>
      </vaadin-horizontal-layout">
    `;

    return html`
      <vaadin-dialog 
        header-title="Save new Preset"
        .opened=${true}
        .noCloseOnOutsideClick=${true}
        @opened-changed=${(event: CustomEvent) => {
          if (! event.detail.value && ! this._handledClose) {
            this._handleDialogCancel();
          }
        }}
        ${dialogFooterRenderer(() => footerLayout, [])}
        ${dialogRenderer(() => dialogLayout, [])}
      ></vaadin-dialog>
    `;
  }

  private _handleDialogClose() {
    if (this.onClose(this._name, this._savePasswords)) {
      this._handledClose = true;
    }
  }

  private _handleDialogCancel() {
    this._handledClose = true;
    this.onCancel();
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    'restic-browser-location-save-preset-dialog': ResticBrowserLocationSavePresetDialog
  }
}
