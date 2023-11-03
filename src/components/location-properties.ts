import { CSSResultGroup, css, html, nothing } from 'lit'
import { customElement, property  } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';
import * as mobx from 'mobx';

import { appState } from '../states/app-state';
import { Location } from '../states/location';

import { Notification } from '@vaadin/notification';

import { open } from '@tauri-apps/api/dialog';
import { fs } from '@tauri-apps/api';

import '@vaadin/horizontal-layout';
import '@vaadin/vertical-layout';
import '@vaadin/password-field';
import '@vaadin/item';
import '@vaadin/checkbox';
import '@vaadin/button';
import '@vaadin/select';
import '@vaadin/notification';

// -------------------------------------------------------------------------------------------------

/**
 * Location properties form, part of the location dialog.
 */

@customElement('restic-browser-location-properties')
export class ResticBrowserLocationProperties extends MobxLitElement {

  // when false, all form fields are disabled
  @property()
  allowEditing: boolean = true;

  // get actual edited state of the location
  get location(): Location {
    return this._location;
  }

  @mobx.observable
  _location: Location = new Location();

  constructor() {
    super();
    mobx.makeObservable(this);
    
    // initialize from app state and auto-update on changes
    mobx.autorun(() => {
      this._location.setFromOtherLocation(appState.repoLocation);
    })

    // bind this to callbacks
    this._browseLocalRepositoryPath = this._browseLocalRepositoryPath.bind(this);
    this._readRepositoryPasswordFile = this._readRepositoryPasswordFile.bind(this);
  }

  static override styles: CSSResultGroup = css`
    #layout {
      align-items: stretch; 
      width: 24rem; 
      max-width: 100%;      
    }
  `;

  render() {
    const locationTypes = appState.supportedLocationTypes;
    const locationInfo = locationTypes.find(v => v.type === this._location.type);
    return html`
      <vaadin-vertical-layout id="layout">
        <vaadin-select
          label="Type"
          .items=${locationTypes.map(v => { return { label: v.displayName, value: v.type } })}
          .value=${this._location.type}
          .disabled=${! this.allowEditing}
          @change=${mobx.action((event: CustomEvent) => {
            this._location.type = (event.target as HTMLInputElement).value;
          })}
        ></vaadin-select>
        <vaadin-horizontal-layout style="width: 24rem">
          <vaadin-text-field style="width: 100%; margin-right: 4px;" 
            label=${this._location.type === "local"
              ? "Path" : (["sftp", "rest"].includes(this._location.type)) ? "URL" : "Bucket"}
            required
            .disabled=${! this.allowEditing}
            value=${this._location.path}
            @change=${mobx.action((event: CustomEvent) => {
              this._location.path = (event.target as HTMLInputElement).value;
            })}>
            <div slot="prefix">${locationInfo?.prefix ? locationInfo.prefix + ":" : ""}
            </div>
          </vaadin-text-field>
            ${this._location.type === "local" && this.allowEditing
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
            .disabled=${! this.allowEditing}
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
            .disabled=${! this.allowEditing}
            value=${this._location.password}
            @change=${mobx.action((event: CustomEvent) => {
              this._location.password = (event.target as HTMLInputElement).value;
            })}
          >
          </vaadin-password-field>
          ${this.allowEditing 
            ? html`<vaadin-button theme="primary" style="width: 4rem; margin-top: 35.5px;" 
                      @click=${this._readRepositoryPasswordFile}>Read</vaadin-button>`
            : nothing
          }
        </vaadin-horizontal-layout>

      ${this._location.type !== "local"
        ? html`<vaadin-form-item style="margin-top: 10.5px;">
                <vaadin-checkbox 
                  id="checkbox" 
                  label="Insecure TLS (skip TLS certificate verifications)"
                  .checked=${this._location.insecureTls}
                  .disabled=${! this.allowEditing}
                  @change=${mobx.action((event: CustomEvent) => {
                    this._location.insecureTls = (event.target as HTMLInputElement).checked;
                  })}
                ></vaadin-checkbox>`
        : nothing
      }
      </vaadin-vertical-layout>
    `;
  }

  private _browseLocalRepositoryPath() {
    open({
      directory: true,
      multiple: false,
      title: "Please select the root folder of a restic repository"
    })
      .then((directory) => {
        if (Array.isArray(directory)) {
          if (directory.length > 0) {
            directory = directory[0];
          } else {
            directory = null;
          }
        }
        if (directory != null) {
          mobx.action((directory: string) => {
            this._location.path = directory;
          })(directory);
        }
      })
      .catch((err) => {
        Notification.show(`Failed to open file dialog: '${err.message || err}'`, {
          position: 'bottom-center',
          theme: "error"
        });
      });
  }

  private _readRepositoryPasswordFile() {
    open({ multiple: false, title: "Select file to read password from", directory: false })
      .then(mobx.action((file) => {
        if (Array.isArray(file)) {
          if (file.length > 0) {
            file = file[0];
          } else {
            file = null;
          }
        }
        if (file != null) {
          fs.readTextFile(file).then(contents => {
            mobx.action((contents: string) => {
              this._location.password = contents;
            })(contents);
          }).catch(err => {
            Notification.show(`Failed to read password file: '${err.message || err}'`, {
              position: 'bottom-center',
              theme: "error"
            });
          });
        }
      }))
      .catch((err) => {
        Notification.show(`Failed to open file dialog: '${err.message || err}'`, {
          position: 'bottom-center',
          theme: "error"
        });
      });
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    'restic-browser-location-properties': ResticBrowserLocationProperties,
  }
}
