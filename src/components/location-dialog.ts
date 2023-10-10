import { html, nothing, render } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';
import * as mobx from 'mobx';

import { appState } from '../states/app-state';
import { locationInfos, RepositoryType, Location } from '../states/location';

import { SelectLocalRepo, SelectAndReadPasswordFromFile } from '../backend/app';

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

  @mobx.observable
  _location: Location = new Location();

  constructor() {
    super();
    mobx.makeObservable(this);
    // initialize from app state
    this._location.setFromOtherLocation(appState.repoLocation);
    // bind this to callbacks
    this._browseLocalRepositoryPath = this._browseLocalRepositoryPath.bind(this);
    this._readRepositoryPasswordFile = this._readRepositoryPasswordFile.bind(this);
  }

  private _browseLocalRepositoryPath() {
    SelectLocalRepo()
      .then(mobx.action((directory) => {
        if (directory.length) {
          this._location.path = directory;
        }
      }))
      .catch((err) => {
        Notification.show(`Invalid repository: '${err.message || err}'`, {
          position: 'bottom-center',
          theme: "error"
        }); 
      });
  }

  private _readRepositoryPasswordFile() {
    SelectAndReadPasswordFromFile()
      .then(mobx.action((password) => {
          this._location.password = password;
      }))
      .catch((err) => {
        Notification.show(`Invalid password file: '${err.message || err}'`, {
          position: 'bottom-center',
          theme: "error"
        }); 
      });
  }

  private _handleClose() {
    appState.repoLocation.setFromOtherLocation(this._location);
    this._handledClose = true; 
    this.onClose();
  }
  
  private _handleCancel() {
    this._handledClose = true; 
    this.onCancel();
  }

  render() {
    const locationInfo = locationInfos.find(v => v.type === this._location.type);
    const dialogLayout = html`
      <vaadin-vertical-layout style="align-items: stretch; width: 24rem; max-width: 100%;">
        <vaadin-select
          label="Type"
          .items=${locationInfos.map(v => { return { label: v.displayName, value: v.type }})}
          .value=${this._location.type}
          @change=${mobx.action((event: CustomEvent) => {
            this._location.type = (event.target as HTMLInputElement).value as RepositoryType;
          })}
        ></vaadin-select>
        <vaadin-horizontal-layout style="width: 24rem">
          <vaadin-text-field style="width: 100%; margin-right: 4px;" 
            label=${this._location.type === "local" 
              ? "Path" : (["sftp", "rest"].includes(this._location.type)) ? "URL" : "Bucket"}
            required
            value=${this._location.path}
            @change=${mobx.action((event: CustomEvent) => {
              this._location.path = (event.target as HTMLInputElement).value; 
            })}>
            <div slot="prefix">${locationInfo?.prefix ? locationInfo.prefix + ":" : ""}
            </div>
          </vaadin-text-field>
            ${this._location.type === "local"
              ? html`<vaadin-button theme="primary" style="width: 4rem; margin-top: 35.5px;" 
                        @click=${this._browseLocalRepositoryPath}>Browse</vaadin-button>` 
              : nothing
            }
          </vaadin-text-field>
        </vaadin-horizontal-layout>
        ${this._location.credentials.map((value) => html`
          <vaadin-password-field 
            label=${value.name}
            required
            value=${value.value}
            @change=${mobx.action((event: CustomEvent) => {
              value.value = (event.target as HTMLInputElement).value; 
            })}>
          </vaadin-password-field>
        `)}
        <vaadin-horizontal-layout style="width: 24rem">
          <vaadin-password-field
            style="width: 100%; margin-right: 4px;"
            label="Repository Password"
            required
            value=${this._location.password}
            @change=${mobx.action((event: CustomEvent) => {
              this._location.password = (event.target as HTMLInputElement).value;
            })}
          >
          </vaadin-password-field>
          <vaadin-button theme="primary" style="width: 4rem; margin-top: 35.5px;" 
            @click=${this._readRepositoryPasswordFile}>Read</vaadin-button>
        </vaadin-horizontal-layout>

      </vaadin-vertical-layout>
    `;

    const footerLayout = html`
      <vaadin-button @click=${() => { 
          this._handleCancel();
        }}>
        Cancel 
      </vaadin-button>
      <vaadin-button theme="primary" @click=${() => { 
          this._handleClose();
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
            this._handleCancel();
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
