import { CSSResultGroup, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';
import * as mobx from 'mobx';

import { appState } from '../states/app-state';
import { Location } from '../states/location';

import { Notification } from '@vaadin/notification';

import { DialogFilter, open } from '@tauri-apps/api/dialog';
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

// Credential display types.
enum CredentialDisplayType {
  Password,
  Text,
  File
};

// Known credential display types. Defaults to "Password" when undefined.
const credentialDisplayTypes: Map<string, CredentialDisplayType> = new Map([
  ["AWS_ACCESS_KEY_ID", CredentialDisplayType.Text],
  ["AZURE_ACCOUNT_NAME", CredentialDisplayType.Text],
  ["B2_ACCOUNT_ID", CredentialDisplayType.Text],
  ["GOOGLE_PROJECT_ID", CredentialDisplayType.Text],
  ["GOOGLE_APPLICATION_CREDENTIALS", CredentialDisplayType.File],
]);

// Dialog file filters for known file credentials. Defaults to "All files *.*".
const credentialFileFilters: Map<string, DialogFilter[]> = new Map([
  ["GOOGLE_APPLICATION_CREDENTIALS", [{ name: "json", extensions: ["json"] }]]
]);

// -------------------------------------------------------------------------------------------------

/**
 * Location properties form, part of the location dialog.
 */

@customElement('restic-browser-location-properties')
export class ResticBrowserLocationProperties extends MobxLitElement {

  // when false, all form fields are disabled
  @property({ type: Boolean })
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
    this._browseCredentialsPath = this._browseCredentialsPath.bind(this);
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

    const locationType = html`
      <vaadin-select
        label="Type"
        .items=${locationTypes.map(v => { return { label: v.displayName, value: v.type } })}
        .value=${this._location.type}
        .disabled=${! this.allowEditing}
        @change=${mobx.action((event: CustomEvent) => {
          this._location.type = (event.target as HTMLInputElement).value;
        })}
      ></vaadin-select>`
    ;

    let pathLabel;
    switch (this._location.prefix) {
      default:
      case "local":
        pathLabel = "Path";
        break;
      case "rclone":
        pathLabel = "Remote";
        break;
      case "sftp":
      case "rest":
        pathLabel = "URL";
        break;
      case "s3":
      case "b2":
      case "azure":
        pathLabel = "Bucket";
        break;
      case "gs":
        pathLabel = "Container";
        break;
    }
    
    const locationPath = html`
      <vaadin-horizontal-layout style="width: 24rem">
        <vaadin-text-field style="width: 100%; margin-right: 4px;" 
          label=${pathLabel}
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
          ? html`<vaadin-button theme="primary" style="width: 4rem; margin-top: auto;" 
                    @click=${this._browseLocalRepositoryPath}>Browse</vaadin-button>`
          : nothing
        }
      </vaadin-horizontal-layout>
    `;

    const credentials = this._location.credentials.map((value) => {
      switch (credentialDisplayTypes.get(value.name)) {
        default:
        case CredentialDisplayType.Password:
          return html`
              <vaadin-password-field 
                label=${value.name}
                required
                .disabled=${! this.allowEditing}
                value=${value.value}
                @change=${mobx.action((event: CustomEvent) => {
                  value.value = (event.target as HTMLInputElement).value;
                })}
              ></vaadin-password-field>`;
        case CredentialDisplayType.Text:
          return html`
              <vaadin-text-field 
                label=${value.name}
                required
                .disabled=${! this.allowEditing}
                value=${value.value}
                @change=${mobx.action((event: CustomEvent) => {
                  value.value = (event.target as HTMLInputElement).value;
                })}
              ></vaadin-text-field>`;
        case CredentialDisplayType.File:
          return html`
              <vaadin-horizontal-layout style="width: 24rem">
                <vaadin-text-field 
                  style="width: 100%; margin-right: 4px;"
                  label=${value.name}
                  required
                  .disabled=${! this.allowEditing}
                  value=${value.value}
                  @change=${mobx.action((event: CustomEvent) => {
                    value.value = (event.target as HTMLInputElement).value;
                  })}
                ></vaadin-text-field>
                ${this.allowEditing
                  ? html`<vaadin-button theme="primary" style="width: 4rem; margin-top: auto;" 
                            @click=${() => this._browseCredentialsPath(value.name)}>Browse</vaadin-button>`
                  : nothing
                }
              </vaadin-horizontal-layout>`;
      }
    });

    const password = (this._location.allowEmptyPassword == false) ? html`
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
        ></vaadin-password-field>
        ${this.allowEditing
          ? html`<vaadin-button theme="primary" style="width: 4rem; margin-top: auto;" 
            @click=${this._readRepositoryPasswordFile}>Read</vaadin-button>`
          : nothing
        }
      </vaadin-horizontal-layout>` : nothing
    ;

    const allowEmptyPassword = html`
      <vaadin-horizontal-layout style="width: 24rem">
        <vaadin-checkbox 
          id="checkbox" 
          label="Set no password"
          .checked=${this._location.allowEmptyPassword}
          .disabled=${! this.allowEditing}
          @change=${mobx.action((event: CustomEvent) => {
            this._location.allowEmptyPassword = (event.target as HTMLInputElement).checked;
          })}
        ></vaadin-checkbox>
      </vaadin-horizontal-layout>
    `;

    const insecureTsl = (this._location.type !== "local") ? html`
      <vaadin-horizontal-layout>
        <vaadin-form-item style="margin-top: 10.5px;">
          <vaadin-checkbox 
            id="checkbox" 
            label="Skip TLS certificate verification"
            .checked=${this._location.insecureTls}
            .disabled=${! this.allowEditing}
            @change=${mobx.action((event: CustomEvent) => {
              this._location.insecureTls = (event.target as HTMLInputElement).checked;
            })}
          ></vaadin-checkbox>
        </vaadin-form-item>` : nothing;

    return html`
      <vaadin-vertical-layout id="layout">
        ${locationType}
        ${locationPath}
        ${credentials}
        ${password} 
        ${allowEmptyPassword}
        ${insecureTsl}
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
          mobx.runInAction(() => {
            this._location.path = directory as string;
          });
        }
      })
      .catch((err) => {
        Notification.show(`Failed to open file dialog: '${err.message || err}'`, {
          position: 'bottom-center',
          theme: "error"
        });
      });
  }

  private _browseCredentialsPath(credential_name: string) {
    open({
      directory: false,
      multiple: false,
      filters: credentialFileFilters.get(credential_name),
      title: "Please select a google application credentials JSON file"
    })
      .then((file) => {
        if (Array.isArray(file)) {
          if (file.length > 0) {
            file = file[0];
          } else {
            file = null;
          }
        }
        if (file != null) {
          mobx.runInAction(() => {
            let credential = this._location.credentials.find(
              (item) => item.name == credential_name);
            if (credential) {
              credential.value = file as string;
            }
          });
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
              this._location.password = contents.trim();
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
