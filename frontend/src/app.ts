import { css, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';

import './components/file-list';
import './components/snapshot-list';
import './components/password-dialog';
import './components/error-message';

import { OpenRepo, SelectRepo } from '../wailsjs/go/lib/Restoric'

import { appState } from './states/app-state';

import '@vaadin/button';
import '@vaadin/vertical-layout';
import '@vaadin/horizontal-layout';

// -------------------------------------------------------------------------------------------------
 
// Main app layout.

@customElement('restoric-app')
export class RestoricApp extends MobxLitElement {
  
  @state()
  private _showPasswordDialog: boolean = false;
  
  private _selectRepository() {
    SelectRepo()
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
    OpenRepo(appState.repoPath, appState.repoPass)
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
        <restoric-password-dialog 
          .onClose=${() => {
            this._showPasswordDialog = false;
            this._openRepository();
          }}
          .onCancel=${() => {
            this._showPasswordDialog = false; 
            appState.repoPath = ""; 
          }}></restoric-password-dialog>
      `;
    }
    // app content
    else {
      const selectedRepositoryText = appState.repoPath ? 
        html`<span id="repoPath">${appState.repoPath}</span>` : 
        html`<span id="repoPath" class="disabled">no repository selected</span>`;
      const header = html`
        <vaadin-horizontal-layout id="header">
          <h3>Restoric</h3>
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
            <restoric-error-message type=${appState.repoError ? "error" : "info"} 
               message=${errorMessage}></restoric-error-message>
          </vaadin-vertical-layout>
        `;
      }
      else {
        return html`
          <vaadin-vertical-layout id="layout">
            ${header}
            <restoric-snapshot-list id="snapshots"></restoric-snapshot-list>
            <restoric-file-list id="filelist"></restoric-file-list>
          </vaadin-vertical-layout>
        `;
      }
    }
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    'restoric-app': RestoricApp
  }
}
