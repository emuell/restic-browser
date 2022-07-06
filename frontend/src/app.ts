import { css, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';
import * as mobx from 'mobx';

import './components/file-list';
import './components/snapshot-list';
import './components/location-dialog';
import './components/error-message';

import { appState } from './states/app-state';

import '@vaadin/button';
import '@vaadin/vertical-layout';
import '@vaadin/horizontal-layout';

// -------------------------------------------------------------------------------------------------
 
// Main app layout.

@customElement('restic-browser-app')
export class ResticBrowserApp extends MobxLitElement {
  
  @state()
  private _showLocationDialog: boolean = false;

  @state()
  private _statusMessage: string = "";

  constructor() {
    super();

    let messageTimeoutId: number | undefined = undefined;
    mobx.autorun(() => {
      let newMessage = "";
      if (appState.isLoadingSnapshots > 0) {
        newMessage = "Fetching snapshots...";
      } 
      else if (appState.isLoadingFiles > 0) {
        newMessage = "Fetching files...";
      }
      if (newMessage !== "") {
        if (messageTimeoutId !== undefined) {
          clearTimeout(messageTimeoutId);
          messageTimeoutId = undefined;
        }
        this._statusMessage = newMessage;
      } 
      else {
        messageTimeoutId = setTimeout(() => {
          this._statusMessage = "";
          messageTimeoutId = undefined;
        }, 1000);
      }
    });
  }

  static styles = css`
    #layout {
       align-items: stretch; 
       width: 100vw; 
       height: 100%;
    }
    #header {
      align-items: center;
    }
    #header h3 {
      font-size: var(--lumo-font-size-l);
      margin-left: 20px;
      margin-right: 20px;
    }
    #header #repoPath {
      margin-left: 10px;
      color: var(--lumo-tint-50pct);
      margin-top: 4px;
      margin-right: 20px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #header #repoPath.disabled {
      color: var(--lumo-tint-10pct);
    }
    #snapshots {
      height: 35vh;
    }
    #filelist {
      height: 100%;
    }
    #footer {
      background: var(--lumo-shade-10pct);
      height: 44px;
      padding: 0 8px;
      align-items: center;
    }
  `;

  render() {

    // repository location dialog
    if (this._showLocationDialog) {
      return html`
        <restic-browser-location-dialog 
          .onClose=${() => {
            this._showLocationDialog = false;
            appState.openRepository();
          }}
          .onCancel=${() => {
            this._showLocationDialog = false; 
            appState.resetLocation(); 
          }}>
        </restic-browser-location-dialog>
      `;
    }
    
    // repository content
    else {
      const location = appState.repoLocation;
      
      const selectedRepositoryText = location.path ? 
        html`<div id="repoPath">
          ${(location.prefix ? `${location.prefix}: ` : "") + location.path}</div>` : 
        html`<div id="repoPath" class="disabled">
          no repository selected</div>`;
      const header = html`
        <vaadin-horizontal-layout id="header">
          <h3>Restic-Browser</h3>
          <vaadin-button theme="primary" @click=${() => this._showLocationDialog = true}>
            Open Repository
          </vaadin-button>
          ${selectedRepositoryText}
        </vaadin-horizontal-layout>
      `;
      
      const footer = html`
        <vaadin-horizontal-layout id="footer">
          ${this._statusMessage}
        </vaadin-horizontal-layout>`;

      if (appState.repoError || ! location.path) {
        const errorMessage = appState.repoError ? 
          `Failed to open repository: ${appState.repoError}` : 
          "No repository selected";
        return html`
          <vaadin-vertical-layout id="layout">
            ${header}
            <restic-browser-error-message 
               type=${appState.repoError ? "error" : "info"} 
               message=${errorMessage}>
            </restic-browser-error-message>
          </vaadin-vertical-layout>
        `;
      }
      else {
        return html`
          <vaadin-vertical-layout id="layout">
            ${header}
            <restic-browser-snapshot-list id="snapshots"></restic-browser-snapshot-list>
            <restic-browser-file-list id="filelist"></restic-browser-file-list>
            ${footer} 
          </vaadin-vertical-layout>
        `;
      }
    }
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    'restic-browser-app': ResticBrowserApp
  }
}
