import { html, nothing, render } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';
import * as mobx from 'mobx';

import { appState, repositoryPrefixes, RepositoryType } from '../states/app-state';
import { SelectLocalRepo } from '../../wailsjs/go/lib/ResticBrowserApp';

import '@vaadin/dialog';
import '@vaadin/password-field';
import '@vaadin/item';
import '@vaadin/list-box';
import '@vaadin/button';
import '@vaadin/select';
import { SelectItem } from '@vaadin/select';

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

  private static readonly _typeItems: SelectItem[] = [
    { label: "Local Path", value: "local" },
    { label: "SFTP", value: "sftp" },
    { label: "REST Server", value: "rest" },
    { label: "Amazon S3", value: "amazons3" },
    { label: "Backblaze B2", value: "backblaze" },
    { label: "Azure Blob Storage", value: "msazure" }
  ];

  private _browseLocalRepositoryPath() {
    SelectLocalRepo()
      .then(mobx.action((directory) => {
        if (directory instanceof Error) {
          throw directory; 
        }
        appState.repoLocation.path = directory;
      }))
      .catch((_err) => {
        // nothing to do
      });
  }

  render() {
    const location = appState.repoLocation;
    const dialogLayout = html`
      <vaadin-vertical-layout style="align-items: stretch; width: 24rem; max-width: 100%;">
        <vaadin-select
          label="Type"
          .items=${ResticBrowserLocationDialog._typeItems}
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
            <div slot="prefix">${repositoryPrefixes.get(location.type as RepositoryType) 
              ? repositoryPrefixes.get(location.type as RepositoryType)! + ":" 
              : ""}
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
          value=${appState.repoPass}
          @change=${mobx.action((event: CustomEvent) => {
            appState.repoPass = (event.target as HTMLInputElement).value;
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
        header-title="Open Respository"
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
