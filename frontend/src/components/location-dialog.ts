import { html, nothing, render } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';
import * as mobx from 'mobx';

import { appState } from '../states/app-state';
import { locationInfos, RepositoryType } from '../states/location';

import { Notification } from '@vaadin/notification';

import '@vaadin/dialog';
import '@vaadin/password-field';
import '@vaadin/item';
import '@vaadin/list-box';
import '@vaadin/button';
import '@vaadin/select';
import '@vaadin/notification';

// -------------------------------------------------------------------------------------------------
 
// Modal dialog to set appState.repoLocation 

@customElement('restic-browser-location-dialog')
export class ResticBrowserLocationDialog extends MobxLitElement {
  
  @property()
  onClose!: () => void;

  @property()
  onCancel!: () => void;
 
  @state()
  _handledClose: boolean = false;

  private _browseLocalRepositoryPath() {
    appState.browseLocalRepositoryPath()
      .catch((err) => {
        Notification.show(`Invalid repository: '${err.message || err}'`, {
          position: 'bottom-center',
          theme: "error"
        }); 
      });
  }

  render() {
    const location = appState.repoLocation;
    const locationInfo = locationInfos.find(v => v.type === location.type);
    const dialogLayout = html`
      <vaadin-vertical-layout style="align-items: stretch; width: 24rem; max-width: 100%;">
        <vaadin-select
          label="Type"
          .items=${locationInfos.map(v => { return { label: v.displayName, value: v.type }})}
          .value=${location.type}
          @change=${mobx.action((event: CustomEvent) => {
            location.type = (event.target as HTMLInputElement).value as RepositoryType;
          })}
        ></vaadin-select>
        <vaadin-horizontal-layout style="width: 24rem">
          <vaadin-text-field style="width: 100%; margin-right: 4px" 
            label=${location.type === "local" 
              ? "Path" : (["sftp", "rest"].includes(location.type)) ? "URL" : "Bucket"}
            required
            value=${location.path}
            @change=${mobx.action((event: CustomEvent) => {
              location.path = (event.target as HTMLInputElement).value; 
            })}>
            <div slot="prefix">${locationInfo?.prefix ? locationInfo.prefix + ":" : ""}
            </div>
          </vaadin-text-field>
            ${location.type === "local"
              ? html`<vaadin-button theme="primary" style="width: 4rem; margin-top: 35.5px;" 
                        @click=${this._browseLocalRepositoryPath}>Browse</vaadin-button>` 
              : nothing
            }
          </vaadin-text-field>
        </vaadin-horizontal-layout>
        ${location.credentials.map((value) => html`
          <vaadin-password-field 
            label=${value.name}
            required
            value=${value.value}
            @change=${mobx.action((event: CustomEvent) => {
              value.value = (event.target as HTMLInputElement).value; 
            })}>
          </vaadin-password-field>
        `)}
        <vaadin-password-field
          label="Repository Password"
          required
          value=${appState.repoLocation.password}
          @change=${mobx.action((event: CustomEvent) => {
            appState.repoLocation.password = (event.target as HTMLInputElement).value;
            this._handledClose = true;
            this.onClose();
          })}
        ></vaadin-password-field>
      </vaadin-vertical-layout>
    `;

    const footerLayout = html`
      <vaadin-button @click=${() => { 
          this._handledClose = true;
          this.onCancel(); 
        }}>
        Cancel 
      </vaadin-button>
      <vaadin-button theme="primary" @click=${() => { 
          this._handledClose = true;
          this.onClose();
      }}>
        Okay
      </vaadin-button>
    `;

    return html`
      <vaadin-dialog
        header-title="Open Repository"
        .opened=${true}
        @opened-changed=${(event: CustomEvent) => {
          if (! event.detail.value && ! this._handledClose) {
            this.onCancel();
          } 
        }}
        .footerRenderer=${(root: HTMLElement) => {
          render(footerLayout, root);
        }}
        .renderer=${(root: HTMLElement) => {
          render(dialogLayout, root);
        }}
      ></vaadin-dialog>
    `;
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    'restic-browser-location-dialog': ResticBrowserLocationDialog
  }
}
