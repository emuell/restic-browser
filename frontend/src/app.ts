import { css, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';

import './components/file-list';
import './components/snapshot-list';
import './components/password-dialog';
import './components/error-message';

import { OpenRepo, SelectLocalRepo } from '../wailsjs/go/lib/ResticBrowserApp';
import { lib } from '../wailsjs/go/models';

import { appState } from './states/app-state';

import '@vaadin/button';
import '@vaadin/vertical-layout';
import '@vaadin/horizontal-layout';

// -------------------------------------------------------------------------------------------------
 
// Main app layout.

@customElement('restic-browser-app')
export class ResticBrowserApp extends MobxLitElement {
  
  @state()
  private _showPasswordDialog: boolean = false;
  
  private _selectRepository() {
    SelectLocalRepo()
      .then((directory) => {
        if (directory instanceof Error) {
          appState.setNewRepo("", directory.message);
        } else {
          appState.setNewRepo(directory)
          this._showPasswordDialog = true;
        }
      })
      .catch((err) => {
        appState.setNewRepo("", err.message || String(err));
      });
  }

  private _openRepository() {
    const location = lib.Location.createFrom({
      type: "local", 
      prefix: "", 
      path: appState.repoPath, 
      secrets: []}
    );
    OpenRepo(location, appState.repoPass)
      .then((result) => {
        if (result instanceof Error) {
          appState.setNewSnapshots([], result.message);
        } 
        else {
          appState.setNewSnapshots(result);
        } 
      })
      .catch((err) => {
        appState.setNewSnapshots([], err.message || String(err));
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
  `;

  render() {
    // password dialog
    if (this._showPasswordDialog) {
      return html`
        <restic-browser-password-dialog 
          .onClose=${() => {
            this._showPasswordDialog = false;
            this._openRepository();
          }}
          .onCancel=${() => {
            this._showPasswordDialog = false; 
            appState.repoPath = ""; 
          }}></restic-browser-password-dialog>
      `;
    }
    // app content
    else {
      const selectedRepositoryText = appState.repoPath ? 
        html`<span id="repoPath">${appState.repoPath}</span>` : 
        html`<span id="repoPath" class="disabled">no repository selected</span>`;
      const header = html`
        <vaadin-horizontal-layout id="header">
          <h3>Restic-Browser</h3>
          <vaadin-button theme="primary" @click=${this._selectRepository}>
            Select Repository
          </vaadin-button>
          ${selectedRepositoryText}
        </vaadin-horizontal-layout>
      `;
      
      if (appState.repoError || ! appState.repoPath) {
        const errorMessage = appState.repoError ? 
          `Failed to open repository: ${appState.repoError}` : 
          "No repository selected";
        return html`
          <vaadin-vertical-layout id="layout">
            ${header}
            <restic-browser-error-message type=${appState.repoError ? "error" : "info"} 
               message=${errorMessage}></restic-browser-error-message>
          </vaadin-vertical-layout>
        `;
      }
      else {
        return html`
          <vaadin-vertical-layout id="layout">
            ${header}
            <restic-browser-snapshot-list id="snapshots"></restic-browser-snapshot-list>
            <restic-browser-file-list id="filelist"></restic-browser-file-list>
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
