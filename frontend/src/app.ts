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
    #snapshots {
      height: 200px;
    }
    #filelist {
      height: 100%;
    }
  `;
  
  @state()
  private _showPasswordDialog: boolean = false;

  private _selectRepository() {
    SelectRepo()
      .then((directory) => {
        if (directory instanceof Error) {
          appState.repoError = directory.message || String(directory);
        } else {
          appState.repoPath = directory;
          appState.repoError = "";
          this._showPasswordDialog = true;
        }
      })
      .catch((err) => {
        appState.repoError = err.message || String(err);
      });
  }

  private _openRepository() {
    OpenRepo(appState.repoPath, appState.repoPass)
      .then((result) => {
        if (result instanceof Error) {
          appState.repoError = result.message || String(result);
        } 
        else {
          appState.repoError = "";
        } 
      })
      .catch((err) => {
        appState.repoError = err.message || String(err);
      });
  }
  
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
      const header = html`
        <vaadin-horizontal-layout id="header">
          <h3>Restoric</h3>
          <vaadin-button theme="primary" @click=${this._selectRepository}>
            Select Repository
          </vaadin-button>
        </vaadin-horizontal-layout>
      `;
      
      if (appState.repoError || ! appState.repoPath) {
        const errorMessage = appState.repoError ? 
          `Failed to open repository: ${appState.repoError}` : 
          "No repository selected";
        return html`
          <vaadin-vertical-layout id="layout">
            ${header}
            <restoric-error-message message=${errorMessage}></restoric-error-message>
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
